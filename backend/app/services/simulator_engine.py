from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.content.registry import AcademyRegistry
from app.models.academy import SimulationOrder, SimulationSession, SimulationTrade, User
from app.schemas.academy import SimulatorCreate, SimulatorOrderIn
from app.services.calculators import maximum_drawdown, q_money

ZERO = Decimal(0)
FOUR_DP = Decimal("0.0001")


def _decimal(value: Any) -> Decimal:
    return Decimal(str(value))


def scenario_candles(registry: AcademyRegistry, scenario_id: str) -> list[dict[str, Any]]:
    scenario = registry.scenario_by_id(scenario_id)
    if scenario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Simulation scenario not found.")
    candles = scenario.get("candles") or scenario.get("data") or []
    if isinstance(candles, dict):
        candles = candles.get("candles") or []
    if not candles and isinstance(scenario.get("generator"), dict):
        candles = _generate_candles(int(scenario.get("seed", 0)), scenario["generator"])
    if not isinstance(candles, list) or not candles:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Simulation scenario has no deterministic candle dataset.",
        )
    normalized: list[dict[str, Any]] = []
    for index, candle in enumerate(candles):
        if not isinstance(candle, dict):
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                f"Simulation scenario candle {index} is invalid.",
            )
        try:
            row = {
                "time": candle.get("time") or candle.get("timestamp") or index,
                "open": _decimal(candle["open"]),
                "high": _decimal(candle["high"]),
                "low": _decimal(candle["low"]),
                "close": _decimal(candle["close"]),
                "volume": _decimal(candle.get("volume", 0)),
            }
        except (InvalidOperation, KeyError, ValueError) as exc:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                f"Simulation scenario candle {index} has invalid OHLC values.",
            ) from exc
        if row["low"] > min(row["open"], row["close"]) or row["high"] < max(
            row["open"], row["close"]
        ):
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                f"Simulation scenario candle {index} has inconsistent OHLC values.",
            )
        normalized.append(row)
    return normalized


def _generate_candles(seed: int, config: dict[str, Any]) -> list[dict[str, Any]]:
    """Implement content/academy's integer-only lcg-ohlcv-v1 contract."""

    if config.get("algorithm") != "lcg-ohlcv-v1":
        return []
    count = max(2, min(int(config.get("candle_count", 48)), 10_000))
    interval_minutes = max(1, min(int(config.get("interval_minutes", 5)), 1440))
    price = _decimal(config.get("start_price", 100))
    base_drift = _decimal(config.get("drift", 0))
    base_volatility = abs(_decimal(config.get("volatility", "0.005")))
    volume_base = max(1, int(config.get("volume_base", 1000)))
    raw_segments = config.get("segments")
    segments: list[Any] = raw_segments if isinstance(raw_segments, list) else []
    state = seed % (2**32)
    modulus = Decimal(2**32)
    four_places = Decimal("0.0001")

    def next_uniform() -> Decimal:
        nonlocal state
        state = (1_664_525 * state + 1_013_904_223) % (2**32)
        return Decimal(state) / modulus

    start = datetime(2025, 1, 2, 8, 0, tzinfo=UTC)
    generated: list[dict[str, Any]] = []
    for index in range(count):
        drift = base_drift
        volatility = base_volatility
        volume_multiplier = Decimal(1)
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            if (
                int(segment.get("from_index", 0))
                <= index
                <= int(segment.get("to_index", count - 1))
            ):
                drift = _decimal(segment.get("drift", drift))
                volatility = abs(_decimal(segment.get("volatility", volatility)))
                volume_multiplier = _decimal(segment.get("volume_multiplier", 1))
                break
        open_price = price
        move = drift + (Decimal(2) * next_uniform() - Decimal(1)) * volatility
        close_price = max(Decimal("0.01"), open_price * (Decimal(1) + move)).quantize(
            four_places, rounding=ROUND_HALF_UP
        )
        upper_wick = abs(next_uniform() - Decimal("0.5")) * volatility
        lower_wick = abs(next_uniform() - Decimal("0.5")) * volatility
        high = (max(open_price, close_price) * (Decimal(1) + upper_wick)).quantize(
            four_places, rounding=ROUND_HALF_UP
        )
        low = max(
            Decimal("0.01"), min(open_price, close_price) * (Decimal(1) - lower_wick)
        ).quantize(four_places, rounding=ROUND_HALF_UP)
        volume_noise = Decimal("0.75") + Decimal("0.5") * next_uniform()
        generated.append(
            {
                "time": (start + timedelta(minutes=index * interval_minutes)).isoformat(),
                "open": open_price.quantize(four_places, rounding=ROUND_HALF_UP),
                "high": high,
                "low": low,
                "close": close_price,
                "volume": int(
                    (Decimal(volume_base) * volume_multiplier * volume_noise).quantize(
                        Decimal("1"), rounding=ROUND_HALF_UP
                    )
                ),
            }
        )
        price = close_price
    return generated


def _event_time(candle: dict[str, Any]) -> datetime:
    raw = candle.get("time")
    if isinstance(raw, str):
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)
        except ValueError:
            pass
    return datetime.now(UTC)


def _execution_price(session: SimulationSession, price: Decimal, *, buy: bool) -> Decimal:
    adjustment = (session.spread_bps / Decimal(2) + session.slippage_bps) / Decimal(10000)
    return q_money(price * (Decimal(1) + adjustment if buy else Decimal(1) - adjustment))


def _commission(session: SimulationSession, price: Decimal, quantity: Decimal) -> Decimal:
    return q_money(
        session.commission_fixed + abs(price * quantity) * session.commission_bps / Decimal(10000)
    )


def create_session(
    db: Session,
    user: User,
    request: SimulatorCreate,
    registry: AcademyRegistry,
) -> SimulationSession:
    scenario = registry.scenario_by_id(request.scenario_id)
    candles = scenario_candles(registry, request.scenario_id)
    start_index = int(
        (scenario or {}).get("start_index")
        or (scenario or {}).get("reveal_start")
        or next(
            (
                point.get("candle_index")
                for point in (scenario or {}).get("decision_points", [])
                if isinstance(point, dict) and point.get("candle_index") is not None
            ),
            None,
        )
        or min(20, len(candles) - 1)
    )
    start_index = max(0, min(start_index, len(candles) - 1))
    session = SimulationSession(
        user_id=user.id,
        scenario_id=request.scenario_id,
        scenario_version=registry.schema_version,
        initial_balance=request.initial_balance,
        cash_balance=request.initial_balance,
        equity=request.initial_balance,
        spread_bps=request.spread_bps,
        slippage_bps=request.slippage_bps,
        commission_fixed=request.commission_fixed,
        commission_bps=request.commission_bps,
        planned_risk=request.planned_risk,
        current_candle_index=start_index,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def owned_session(
    db: Session, user_id: UUID, session_id: UUID, *, for_update: bool = False
) -> SimulationSession:
    statement = select(SimulationSession).where(
        SimulationSession.id == session_id, SimulationSession.user_id == user_id
    )
    if for_update:
        statement = statement.with_for_update()
    session = db.scalar(statement)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Simulation session not found.")
    return session


def _fill_entry(
    db: Session,
    session: SimulationSession,
    order: SimulationOrder,
    raw_price: Decimal,
    candle: dict[str, Any],
) -> None:
    if session.position_quantity != 0:
        order.status = "rejected"
        order.rejection_reason = "Close the current position before opening another."
        return
    price = _execution_price(session, raw_price, buy=order.side == "buy")
    protection_error = _protective_levels_error(
        order.side,
        price,
        stop_loss=order.stop_loss,
        take_profit=order.take_profit,
    )
    if protection_error is not None:
        order.status = "rejected"
        order.rejection_reason = protection_error
        return
    entry_commission = _commission(session, price, order.quantity)
    session.cash_balance = q_money(session.cash_balance - entry_commission)
    session.position_quantity = order.quantity if order.side == "buy" else -order.quantity
    session.average_entry_price = price
    session.position_stop_loss = order.stop_loss
    session.position_take_profit = order.take_profit
    session.position_opened_at = _event_time(candle)
    order.planned_risk = (
        q_money(abs(price - order.stop_loss) * order.quantity)
        if order.stop_loss is not None
        else session.planned_risk
    )
    order.status = "filled"
    order.filled_price = price
    order.filled_at = _event_time(candle)


def place_order(
    db: Session,
    session: SimulationSession,
    request: SimulatorOrderIn,
    registry: AcademyRegistry,
) -> SimulationOrder:
    if session.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Simulation session is not active.")
    existing = db.scalar(
        select(SimulationOrder).where(
            SimulationOrder.user_id == session.user_id,
            SimulationOrder.client_order_id == request.client_order_id,
        )
    )
    if existing is not None:
        replay_matches = all(
            (
                existing.session_id == session.id,
                existing.side == request.side,
                existing.order_type == request.order_type,
                existing.quantity == request.quantity,
                existing.trigger_price == request.trigger_price,
                existing.stop_loss == request.stop_loss,
                existing.take_profit == request.take_profit,
            )
        )
        if not replay_matches:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "client_order_id was already used with a different order.",
            )
        return existing
    if session.version != request.expected_version:
        raise HTTPException(status.HTTP_409_CONFLICT, "Simulation session version changed.")
    current_candle = scenario_candles(registry, session.scenario_id)[session.current_candle_index]
    reference_price = _decimal(
        request.trigger_price
        if request.order_type in {"limit", "stop"}
        else current_candle["close"]
    )
    protection_error = _protective_levels_error(
        request.side,
        reference_price,
        stop_loss=request.stop_loss,
        take_profit=request.take_profit,
    )
    if protection_error is not None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, protection_error)
    order = SimulationOrder(
        session_id=session.id,
        user_id=session.user_id,
        client_order_id=request.client_order_id,
        side=request.side,
        order_type=request.order_type,
        quantity=request.quantity,
        trigger_price=request.trigger_price,
        stop_loss=request.stop_loss,
        take_profit=request.take_profit,
    )
    db.add(order)
    db.flush()
    notional = request.quantity * reference_price
    leverage = notional / session.equity if session.equity > 0 else Decimal("999")
    order_violations: list[str] = []
    scenario = registry.scenario_by_id(session.scenario_id) or {}
    raw_account = scenario.get("account")
    account: dict[str, Any] = raw_account if isinstance(raw_account, dict) else {}
    daily_loss_limit = _decimal(account.get("daily_loss_limit", "0.02"))
    daily_limit_reached = session.realized_pnl <= -(session.initial_balance * daily_loss_limit)
    if daily_limit_reached:
        order_violations.append("daily_loss_limit_reached")
        order.status = "rejected"
        order.rejection_reason = "The scenario daily loss limit has been reached."
    elif leverage > Decimal(5):
        order_violations.append("leverage_above_5x")
        order.status = "rejected"
        order.rejection_reason = "Educational simulator caps leverage at 5x."
    else:
        if leverage > Decimal(2):
            order_violations.append("leverage_above_2x")
        if request.stop_loss is None:
            order_violations.append("missing_stop_loss")
        else:
            planned = abs(reference_price - request.stop_loss) * request.quantity
            risk_cap = _decimal(account.get("max_risk_per_trade", "0.02"))
            if session.equity > 0 and planned / session.equity > risk_cap:
                order_violations.append("risk_above_scenario_cap")
    order.rule_violations = order_violations
    session.rule_violations = sorted(set(session.rule_violations).union(order_violations))
    if request.order_type == "market":
        if order.status != "rejected":
            _fill_entry(db, session, order, current_candle["close"], current_candle)
            _update_equity(session, current_candle["close"])
    session.version += 1
    db.commit()
    db.refresh(order)
    return order


def _protective_levels_error(
    side: str,
    entry_price: Decimal,
    *,
    stop_loss: Decimal | None,
    take_profit: Decimal | None,
) -> str | None:
    if side == "buy":
        if stop_loss is not None and stop_loss >= entry_price:
            return "A long-position stop_loss must be below the entry price."
        if take_profit is not None and take_profit <= entry_price:
            return "A long-position take_profit must be above the entry price."
    else:
        if stop_loss is not None and stop_loss <= entry_price:
            return "A short-position stop_loss must be above the entry price."
        if take_profit is not None and take_profit >= entry_price:
            return "A short-position take_profit must be below the entry price."
    return None


def _order_trigger(order: SimulationOrder, candle: dict[str, Any]) -> Decimal | None:
    trigger = order.trigger_price
    if trigger is None:
        return None
    if order.side == "buy" and order.order_type == "limit" and candle["low"] <= trigger:
        return min(candle["open"], trigger)
    if order.side == "buy" and order.order_type == "stop" and candle["high"] >= trigger:
        return max(candle["open"], trigger)
    if order.side == "sell" and order.order_type == "limit" and candle["high"] >= trigger:
        return max(candle["open"], trigger)
    if order.side == "sell" and order.order_type == "stop" and candle["low"] <= trigger:
        return min(candle["open"], trigger)
    return None


def _update_equity(session: SimulationSession, mark_price: Decimal) -> None:
    if session.position_quantity and session.average_entry_price is not None:
        session.unrealized_pnl = q_money(
            (mark_price - session.average_entry_price) * session.position_quantity
        )
    else:
        session.unrealized_pnl = ZERO
    session.equity = q_money(session.cash_balance + session.unrealized_pnl)


def close_position(
    db: Session,
    session: SimulationSession,
    raw_price: Decimal,
    candle: dict[str, Any],
    *,
    reason: str,
) -> SimulationTrade | None:
    quantity_signed = Decimal(session.position_quantity)
    entry = session.average_entry_price
    if quantity_signed == 0 or entry is None or session.position_opened_at is None:
        return None
    quantity = abs(quantity_signed)
    is_long = quantity_signed > 0
    exit_price = _execution_price(session, raw_price, buy=not is_long)
    gross = q_money((exit_price - entry) * quantity_signed)
    entry_commission = _commission(session, entry, quantity)
    exit_commission = _commission(session, exit_price, quantity)
    total_commission = q_money(entry_commission + exit_commission)
    net = q_money(gross - total_commission)
    session.cash_balance = q_money(session.cash_balance + gross - exit_commission)
    session.realized_pnl = q_money(session.realized_pnl + net)
    entry_order = db.scalar(
        select(SimulationOrder)
        .where(
            SimulationOrder.session_id == session.id,
            SimulationOrder.user_id == session.user_id,
            SimulationOrder.status == "filled",
        )
        .order_by(SimulationOrder.filled_at.desc(), SimulationOrder.id.desc())
        .limit(1)
    )
    risk = entry_order.planned_risk if entry_order is not None else session.planned_risk
    r_multiple = (net / risk).quantize(FOUR_DP, rounding=ROUND_HALF_UP) if risk else None
    trade = SimulationTrade(
        session_id=session.id,
        user_id=session.user_id,
        entry_order_id=entry_order.id if entry_order else None,
        side="long" if is_long else "short",
        quantity=quantity,
        entry_price=entry,
        exit_price=exit_price,
        gross_pnl=gross,
        commission=total_commission,
        net_pnl=net,
        planned_risk=risk,
        r_multiple=r_multiple,
        opened_at=session.position_opened_at,
        closed_at=_event_time(candle),
        exit_reason=reason,
        rule_violations=list(entry_order.rule_violations) if entry_order is not None else [],
    )
    db.add(trade)
    session.position_quantity = ZERO
    session.average_entry_price = None
    session.position_stop_loss = None
    session.position_take_profit = None
    session.position_opened_at = None
    _update_equity(session, exit_price)
    return trade


def _apply_bracket(
    db: Session, session: SimulationSession, candle: dict[str, Any]
) -> SimulationTrade | None:
    quantity = Decimal(session.position_quantity)
    if quantity == 0:
        return None
    stop = session.position_stop_loss
    target = session.position_take_profit
    if quantity > 0:
        if stop is not None and candle["low"] <= stop:
            return close_position(db, session, stop, candle, reason="stop_loss")
        if target is not None and candle["high"] >= target:
            return close_position(db, session, target, candle, reason="take_profit")
    else:
        if stop is not None and candle["high"] >= stop:
            return close_position(db, session, stop, candle, reason="stop_loss")
        if target is not None and candle["low"] <= target:
            return close_position(db, session, target, candle, reason="take_profit")
    return None


def step_session(
    db: Session,
    session: SimulationSession,
    registry: AcademyRegistry,
    *,
    steps: int,
    expected_version: int,
) -> SimulationSession:
    if session.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Simulation session is not active.")
    if session.version != expected_version:
        raise HTTPException(status.HTTP_409_CONFLICT, "Simulation session version changed.")
    candles = scenario_candles(registry, session.scenario_id)
    target_index = min(session.current_candle_index + steps, len(candles) - 1)
    pending = list(
        db.scalars(
            select(SimulationOrder).where(
                SimulationOrder.session_id == session.id,
                SimulationOrder.user_id == session.user_id,
                SimulationOrder.status == "pending",
            )
        )
    )
    for index in range(session.current_candle_index + 1, target_index + 1):
        candle = candles[index]
        for order in pending:
            if order.status != "pending":
                continue
            fill_price = _order_trigger(order, candle)
            if fill_price is not None:
                _fill_entry(db, session, order, fill_price, candle)
        _apply_bracket(db, session, candle)
        _update_equity(session, candle["close"])
        session.current_candle_index = index
    if target_index >= len(candles) - 1:
        final_candle = candles[-1]
        close_position(db, session, final_candle["close"], final_candle, reason="scenario_end")
        for order in pending:
            if order.status == "pending":
                order.status = "cancelled"
        session.status = "completed"
        session.completed_at = _event_time(final_candle)
    session.version += 1
    db.commit()
    db.refresh(session)
    return session


def session_metrics(
    trades: list[SimulationTrade], *, orders: list[SimulationOrder] | None = None
) -> dict[str, Any]:
    net_values = [Decimal(trade.net_pnl) for trade in trades]
    wins = [value for value in net_values if value > 0]
    losses = [value for value in net_values if value < 0]
    gross_profit = sum(wins, ZERO)
    gross_loss = sum(losses, ZERO)
    count = len(net_values)
    average_win = gross_profit / len(wins) if wins else ZERO
    average_loss = abs(gross_loss / len(losses)) if losses else ZERO
    win_rate = Decimal(len(wins)) / Decimal(count) * Decimal(100) if count else ZERO
    expectancy_value = sum(net_values, ZERO) / Decimal(count) if count else ZERO
    payoff = average_win / average_loss if average_loss else None
    profit_factor = gross_profit / abs(gross_loss) if gross_loss else None
    equity = [ZERO]
    running = ZERO
    for value in net_values:
        running += value
        equity.append(running)
    drawdown = maximum_drawdown(equity)["maximum_drawdown"]
    r_values = [Decimal(trade.r_multiple) for trade in trades if trade.r_multiple is not None]
    holding = [
        Decimal(str((trade.closed_at - trade.opened_at).total_seconds())) for trade in trades
    ]
    return {
        "net_pnl": q_money(sum(net_values, ZERO)),
        "gross_profit": q_money(gross_profit),
        "gross_loss": q_money(gross_loss),
        "win_rate": win_rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        "average_win": q_money(average_win),
        "average_loss": q_money(average_loss),
        "payoff_ratio": payoff.quantize(FOUR_DP) if payoff is not None else None,
        "expectancy": q_money(expectancy_value),
        "profit_factor": profit_factor.quantize(FOUR_DP) if profit_factor is not None else None,
        "maximum_drawdown": q_money(drawdown),
        "average_r": (sum(r_values, ZERO) / len(r_values)).quantize(FOUR_DP) if r_values else None,
        "best_trade": max(net_values) if net_values else None,
        "worst_trade": min(net_values) if net_values else None,
        "average_holding_seconds": (sum(holding, ZERO) / len(holding)).quantize(Decimal("0.01"))
        if holding
        else None,
        "rule_violations": sum(len(order.rule_violations or []) for order in (orders or []))
        if orders is not None
        else sum(len(trade.rule_violations) for trade in trades),
    }

from collections.abc import Iterable
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
EIGHT_DP = Decimal("0.00000001")


def q_money(value: Decimal) -> Decimal:
    return value.quantize(EIGHT_DP, rounding=ROUND_HALF_UP)


def position_size(
    account_balance: Decimal,
    risk_percent: Decimal,
    entry_price: Decimal,
    stop_price: Decimal,
) -> dict[str, Decimal]:
    distance = abs(entry_price - stop_price)
    if distance == 0:
        raise ValueError("entry_price and stop_price must differ")
    risk_amount = account_balance * risk_percent / Decimal(100)
    quantity = risk_amount / distance
    return {
        "risk_amount": q_money(risk_amount),
        "risk_per_unit": q_money(distance),
        "quantity": q_money(quantity),
        "position_value": q_money(quantity * entry_price),
    }


def reward_to_risk(
    entry_price: Decimal,
    stop_price: Decimal,
    target_price: Decimal,
    side: str,
) -> dict[str, Decimal]:
    risk = entry_price - stop_price if side == "long" else stop_price - entry_price
    reward = target_price - entry_price if side == "long" else entry_price - target_price
    if risk <= 0:
        raise ValueError("stop_price must define positive risk for the selected side")
    if reward <= 0:
        raise ValueError("target_price must define positive reward for the selected side")
    return {
        "risk_per_unit": q_money(risk),
        "reward_per_unit": q_money(reward),
        "reward_to_risk": (reward / risk).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP),
    }


def expectancy(
    win_rate_percent: Decimal, average_win: Decimal, average_loss: Decimal
) -> dict[str, Decimal]:
    win_probability = win_rate_percent / Decimal(100)
    loss_probability = Decimal(1) - win_probability
    value = win_probability * average_win - loss_probability * average_loss
    break_even = (
        average_loss / (average_win + average_loss) * Decimal(100)
        if average_win + average_loss > 0
        else Decimal(0)
    )
    return {
        "expectancy": q_money(value),
        "break_even_win_rate": break_even.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
    }


def maximum_drawdown(values: Iterable[Decimal]) -> dict[str, Decimal]:
    curve = list(values)
    if not curve:
        raise ValueError("equity curve cannot be empty")
    peak = curve[0]
    maximum = Decimal(0)
    maximum_percent = Decimal(0)
    for value in curve:
        if value > peak:
            peak = value
        drawdown = peak - value
        percent = drawdown / peak * Decimal(100) if peak > 0 else Decimal(0)
        maximum = max(maximum, drawdown)
        maximum_percent = max(maximum_percent, percent)
    return {
        "maximum_drawdown": q_money(maximum),
        "maximum_drawdown_percent": maximum_percent.quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        ),
    }

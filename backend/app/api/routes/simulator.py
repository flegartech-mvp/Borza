from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import JsonValue
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.api.routes.catalog import registry_or_503
from app.database import get_db
from app.models.academy import SimulationOrder, SimulationSession, SimulationTrade, User
from app.schemas.academy import (
    SimulatorCloseIn,
    SimulatorCreate,
    SimulatorMetrics,
    SimulatorOrderIn,
    SimulatorOrderRead,
    SimulatorProcessEvaluation,
    SimulatorResults,
    SimulatorSessionRead,
    SimulatorStepIn,
    SimulatorTradeRead,
)
from app.services.simulator_engine import (
    close_position,
    create_session,
    evaluate_process,
    owned_session,
    place_order,
    scenario_candles,
    session_metrics,
    step_session,
)

router = APIRouter(prefix="/api/v1/simulator", tags=["simulator"])


def _payload(db: Session, session: SimulationSession) -> SimulatorSessionRead:
    registry = registry_or_503()
    candles = scenario_candles(registry, session.scenario_id)
    # This slice is the privacy boundary for hidden future candles.
    visible = candles[: session.current_candle_index + 1]
    orders = list(
        db.scalars(
            select(SimulationOrder)
            .where(
                SimulationOrder.session_id == session.id,
                SimulationOrder.user_id == session.user_id,
            )
            .order_by(SimulationOrder.created_at, SimulationOrder.id)
        )
    )
    trades = list(
        db.scalars(
            select(SimulationTrade)
            .where(
                SimulationTrade.session_id == session.id,
                SimulationTrade.user_id == session.user_id,
            )
            .order_by(SimulationTrade.closed_at, SimulationTrade.id)
        )
    )
    return SimulatorSessionRead(
        id=session.id,
        scenario_id=session.scenario_id,
        status=session.status,
        initial_balance=session.initial_balance,
        cash_balance=session.cash_balance,
        equity=session.equity,
        realized_pnl=session.realized_pnl,
        unrealized_pnl=session.unrealized_pnl,
        position_quantity=session.position_quantity,
        average_entry_price=session.average_entry_price,
        position_stop_loss=session.position_stop_loss,
        position_take_profit=session.position_take_profit,
        current_candle_index=session.current_candle_index,
        decision_note=session.decision_note,
        risk_defined_before_entry=session.risk_defined_before_entry,
        concentration_checked=session.concentration_checked,
        visible_candles=visible,
        version=session.version,
        rule_violations=list(session.rule_violations),
        orders=[SimulatorOrderRead.model_validate(item) for item in orders],
        pending_orders=[
            SimulatorOrderRead.model_validate(item) for item in orders if item.status == "pending"
        ],
        trades=[SimulatorTradeRead.model_validate(item) for item in trades],
    )


@router.post("/sessions", response_model=SimulatorSessionRead, status_code=status.HTTP_201_CREATED)
def start_session(
    request: SimulatorCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulatorSessionRead:
    session = create_session(db, user, request, registry_or_503())
    return _payload(db, session)


@router.get("/sessions", response_model=list[SimulatorSessionRead])
def list_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SimulatorSessionRead]:
    sessions = list(
        db.scalars(
            select(SimulationSession)
            .where(SimulationSession.user_id == user.id)
            .order_by(desc(SimulationSession.started_at), desc(SimulationSession.id))
            .limit(limit)
        )
    )
    return [_payload(db, item) for item in sessions]


@router.get("/sessions/{session_id}", response_model=SimulatorSessionRead)
def get_session(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulatorSessionRead:
    return _payload(db, owned_session(db, user.id, session_id))


@router.post("/sessions/{session_id}/orders", response_model=SimulatorSessionRead)
def submit_order(
    session_id: UUID,
    request: SimulatorOrderIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulatorSessionRead:
    session = owned_session(db, user.id, session_id, for_update=True)
    place_order(db, session, request, registry_or_503())
    db.refresh(session)
    return _payload(db, session)


@router.post("/sessions/{session_id}/step", response_model=SimulatorSessionRead)
def step(
    session_id: UUID,
    request: SimulatorStepIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulatorSessionRead:
    session = owned_session(db, user.id, session_id, for_update=True)
    step_session(
        db,
        session,
        registry_or_503(),
        steps=request.candles,
        expected_version=request.expected_version,
    )
    return _payload(db, session)


@router.post("/sessions/{session_id}/close", response_model=SimulatorSessionRead)
def close(
    session_id: UUID,
    request: SimulatorCloseIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulatorSessionRead:
    session = owned_session(db, user.id, session_id, for_update=True)
    if session.version != request.expected_version:
        raise HTTPException(status.HTTP_409_CONFLICT, "Simulation session version changed.")
    candle = scenario_candles(registry_or_503(), session.scenario_id)[session.current_candle_index]
    if close_position(db, session, candle["close"], candle, reason=request.reason) is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Simulation session has no open position.")
    session.version += 1
    db.commit()
    db.refresh(session)
    return _payload(db, session)


@router.get("/sessions/{session_id}/results", response_model=SimulatorResults)
def results(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulatorResults:
    session = owned_session(db, user.id, session_id)
    if session.status != "completed":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Results and scenario debrief are available after the replay is completed.",
        )
    orders = list(
        db.scalars(
            select(SimulationOrder)
            .where(
                SimulationOrder.session_id == session.id,
                SimulationOrder.user_id == user.id,
            )
            .order_by(SimulationOrder.created_at, SimulationOrder.id)
        )
    )
    trades = list(
        db.scalars(
            select(SimulationTrade)
            .where(
                SimulationTrade.session_id == session.id,
                SimulationTrade.user_id == user.id,
            )
            .order_by(SimulationTrade.closed_at, SimulationTrade.id)
        )
    )
    scenario = registry_or_503().scenario_by_id(session.scenario_id) or {}
    process_rules = scenario.get("process_rules") or []
    typed_process_rules = [item for item in process_rules if isinstance(item, dict)]
    score, followed, violations, unevaluated = evaluate_process(
        session, orders, typed_process_rules
    )
    process = SimulatorProcessEvaluation(
        score=score,
        followed_rules=followed,
        violated_rules=violations,
        unevaluated_scenario_rules=unevaluated,
    )
    raw_debrief = scenario.get("debrief")
    debrief: dict[str, JsonValue] = raw_debrief if isinstance(raw_debrief, dict) else {}
    return SimulatorResults(
        metrics=SimulatorMetrics(**session_metrics(trades, orders=orders)),
        process=process,
        orders=[SimulatorOrderRead.model_validate(item) for item in orders],
        trades=[SimulatorTradeRead.model_validate(item) for item in trades],
        debrief=debrief,
        related_lessons=[str(item) for item in (scenario.get("related_lessons") or [])],
        recommended_review_cards=[
            str(item) for item in (scenario.get("recommended_review_cards") or [])
        ],
    )

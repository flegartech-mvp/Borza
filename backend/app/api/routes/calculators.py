from collections.abc import Callable
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status

from app.schemas.academy import (
    DrawdownIn,
    DrawdownResult,
    ExpectancyIn,
    ExpectancyResult,
    PositionSizeIn,
    PositionSizeResult,
    RewardRiskIn,
    RewardRiskResult,
)
from app.services.calculators import expectancy, maximum_drawdown, position_size, reward_to_risk

router = APIRouter(prefix="/api/v1/calculators", tags=["calculators"])


def _calculation(callable_: Callable[..., dict[str, Decimal]], *args: object) -> dict[str, Decimal]:
    try:
        return callable_(*args)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc


@router.post("/position-size", response_model=PositionSizeResult)
def calculate_position_size(request: PositionSizeIn) -> PositionSizeResult:
    return PositionSizeResult(
        **_calculation(
            position_size,
            request.account_balance,
            request.risk_percent,
            request.entry_price,
            request.stop_price,
        )
    )


@router.post("/reward-to-risk", response_model=RewardRiskResult)
def calculate_reward_to_risk(request: RewardRiskIn) -> RewardRiskResult:
    return RewardRiskResult(
        **_calculation(
            reward_to_risk,
            request.entry_price,
            request.stop_price,
            request.target_price,
            request.side,
        )
    )


@router.post("/expectancy", response_model=ExpectancyResult)
def calculate_expectancy(request: ExpectancyIn) -> ExpectancyResult:
    return ExpectancyResult(
        **expectancy(request.win_rate, request.average_win, request.average_loss)
    )


@router.post("/drawdown", response_model=DrawdownResult)
def calculate_drawdown(request: DrawdownIn) -> DrawdownResult:
    return DrawdownResult(**maximum_drawdown(request.equity_curve))

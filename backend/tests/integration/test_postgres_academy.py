from decimal import Decimal
from uuid import UUID

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, engine
from app.models.academy import SimulationSession, TradingJournal, User

pytestmark = pytest.mark.postgres


def test_postgres_head_and_composite_owner_foreign_key() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("POSTGRES_TEST_DATABASE_URL is required")

    tables = set(inspect(engine).get_table_names())
    assert {"articles", "users", "simulation_sessions", "trading_journals"} <= tables

    owner_id = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    other_id = UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    with SessionLocal() as db:
        db.add_all([User(id=owner_id, is_demo=True), User(id=other_id, is_demo=True)])
        db.flush()
        simulation = SimulationSession(
            user_id=owner_id,
            scenario_id="scenario-trend-continuation",
            scenario_version="1",
            initial_balance=Decimal("10000"),
            cash_balance=Decimal("10000"),
            equity=Decimal("10000"),
        )
        db.add(simulation)
        db.flush()
        db.add(
            TradingJournal(
                user_id=other_id,
                simulation_session_id=simulation.id,
                setup="invalid-cross-owner-reference",
                thesis="The composite owner foreign key must reject this row.",
            )
        )
        with pytest.raises(IntegrityError):
            db.flush()

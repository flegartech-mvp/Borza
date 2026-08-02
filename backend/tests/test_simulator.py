from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from app.content.registry import load_academy_registry
from app.database import SessionLocal
from app.models.academy import SimulationOrder, SimulationSession, User
from app.services.simulator_engine import (
    _apply_bracket,
    _order_trigger,
    evaluate_process,
    scenario_candles,
)


def test_process_score_rewards_precommitment_not_profit() -> None:
    disciplined_loss = SimulationSession(
        decision_note="The setup fails below support and I will stop at the daily limit.",
        risk_defined_before_entry=True,
        concentration_checked=True,
    )
    disciplined_order = SimulationOrder(rule_violations=[])
    disciplined = evaluate_process(
        disciplined_loss,
        [disciplined_order],
        [{"id": "risk_within_cap"}, {"id": "journal_reason"}],
    )

    reckless_win = SimulationSession(
        decision_note="Looks good",
        risk_defined_before_entry=False,
        concentration_checked=False,
    )
    reckless_order = SimulationOrder(
        rule_violations=["missing_stop_loss", "risk_above_scenario_cap"]
    )
    reckless = evaluate_process(
        reckless_win,
        [reckless_order],
        [{"id": "risk_within_cap"}, {"id": "journal_reason"}],
    )

    assert disciplined[0] == 100
    assert reckless[0] == 0
    assert "decision_reason_documented" in disciplined[1]
    assert "risk_not_defined_before_entry" in reckless[2]


def test_lcg_generator_matches_known_seed_and_is_repeatable() -> None:
    registry = load_academy_registry()
    first = scenario_candles(registry, "scenario-trend-continuation")
    second = scenario_candles(registry, "scenario-trend-continuation")

    assert first == second
    assert len(first) == 48
    assert first[0] == {
        "time": "2025-01-02T08:00:00+00:00",
        "open": Decimal("100.0000"),
        "high": Decimal("100.3932"),
        "low": Decimal("99.9267"),
        "close": Decimal("100.2502"),
        "volume": Decimal("1154"),
    }
    assert first[18]["close"] == Decimal("100.9860")


def test_pending_orders_use_open_price_when_a_candle_gaps_through_trigger() -> None:
    cases = [
        ("buy", "limit", Decimal("95"), Decimal("90"), Decimal("90")),
        ("sell", "limit", Decimal("105"), Decimal("110"), Decimal("110")),
        ("buy", "stop", Decimal("105"), Decimal("110"), Decimal("110")),
        ("sell", "stop", Decimal("95"), Decimal("90"), Decimal("90")),
    ]
    for side, order_type, trigger, candle_open, expected in cases:
        candle = {
            "open": candle_open,
            "high": Decimal("115"),
            "low": Decimal("85"),
            "close": Decimal("100"),
        }
        order = SimulationOrder(
            user_id=UUID("11111111-1111-4111-8111-111111111111"),
            session_id=UUID("33333333-3333-4333-8333-333333333333"),
            client_order_id=f"{side}-{order_type}",
            side=side,
            order_type=order_type,
            quantity=Decimal(1),
            trigger_price=trigger,
        )
        assert _order_trigger(order, candle) == expected


def test_bracket_uses_conservative_stop_first_when_both_levels_trade() -> None:
    user_id = UUID("11111111-1111-4111-8111-111111111111")
    with SessionLocal() as db:
        db.add(User(id=user_id, is_demo=True))
        db.flush()
        session = SimulationSession(
            user_id=user_id,
            scenario_id="test",
            scenario_version="1",
            initial_balance=Decimal("10000"),
            cash_balance=Decimal("10000"),
            equity=Decimal("10000"),
            position_quantity=Decimal("1"),
            average_entry_price=Decimal("100"),
            position_stop_loss=Decimal("95"),
            position_take_profit=Decimal("105"),
            position_opened_at=datetime(2025, 1, 1, tzinfo=UTC),
        )
        db.add(session)
        db.flush()
        db.add(
            SimulationOrder(
                session_id=session.id,
                user_id=user_id,
                client_order_id="entry",
                side="buy",
                order_type="market",
                quantity=Decimal("1"),
                planned_risk=Decimal("5"),
                status="filled",
                filled_price=Decimal("100"),
                filled_at=datetime(2025, 1, 1, tzinfo=UTC),
                rule_violations=[],
            )
        )
        db.flush()
        trade = _apply_bracket(
            db,
            session,
            {
                "time": "2025-01-02T08:00:00+00:00",
                "open": Decimal("100"),
                "high": Decimal("106"),
                "low": Decimal("94"),
                "close": Decimal("100"),
            },
        )

        assert trade is not None
        assert trade.exit_reason == "stop_loss"
        assert trade.exit_price == Decimal("95.00000000")


def test_orders_validate_versions_protection_and_expose_rejections(client, auth_headers) -> None:
    created = client.post(
        "/api/v1/simulator/sessions",
        headers=auth_headers,
        json={"scenario_id": "scenario-trend-continuation"},
    )
    assert created.status_code == 201
    session = created.json()
    session_id = session["id"]
    entry = Decimal(session["visible_candles"][-1]["close"])

    invalid = client.post(
        f"/api/v1/simulator/sessions/{session_id}/orders",
        headers=auth_headers,
        json={
            "expected_version": 1,
            "client_order_id": "invalid-long",
            "side": "buy",
            "order_type": "market",
            "quantity": "1",
            "stop_loss": str(entry + Decimal("1")),
        },
    )
    assert invalid.status_code == 422

    accepted_payload = {
        "expected_version": 1,
        "client_order_id": "valid-long",
        "side": "buy",
        "order_type": "market",
        "quantity": "10",
        "stop_loss": str(entry - Decimal("0.25")),
        "take_profit": str(entry + Decimal("2")),
    }
    accepted = client.post(
        f"/api/v1/simulator/sessions/{session_id}/orders",
        headers=auth_headers,
        json=accepted_payload,
    )
    assert accepted.status_code == 200
    assert accepted.json()["orders"][-1]["status"] == "filled"
    assert accepted.json()["version"] == 2

    replay = client.post(
        f"/api/v1/simulator/sessions/{session_id}/orders",
        headers=auth_headers,
        json=accepted_payload,
    )
    assert replay.status_code == 200
    assert replay.json()["version"] == 2

    stale = dict(accepted_payload, client_order_id="stale-order")
    stale_response = client.post(
        f"/api/v1/simulator/sessions/{session_id}/orders",
        headers=auth_headers,
        json=stale,
    )
    assert stale_response.status_code == 409


def test_rejected_leverage_order_remains_visible_and_no_trade_scores_well(
    client, auth_headers
) -> None:
    created = client.post(
        "/api/v1/simulator/sessions",
        headers=auth_headers,
        json={"scenario_id": "scenario-trend-continuation"},
    ).json()
    entry = Decimal(created["visible_candles"][-1]["close"])
    rejected = client.post(
        f"/api/v1/simulator/sessions/{created['id']}/orders",
        headers=auth_headers,
        json={
            "expected_version": 1,
            "client_order_id": "oversized",
            "side": "buy",
            "order_type": "market",
            "quantity": "600",
            "stop_loss": str(entry - Decimal("0.01")),
        },
    )
    assert rejected.status_code == 200
    assert rejected.json()["orders"][-1]["status"] == "rejected"
    assert rejected.json()["orders"][-1]["rejection_reason"]
    rejected_completed = client.post(
        f"/api/v1/simulator/sessions/{created['id']}/step",
        headers=auth_headers,
        json={"candles": 100, "expected_version": 2},
    )
    assert rejected_completed.status_code == 200
    rejected_results = client.get(
        f"/api/v1/simulator/sessions/{created['id']}/results", headers=auth_headers
    )
    assert rejected_results.json()["metrics"]["rule_violations"] == 1

    no_trade = client.post(
        "/api/v1/simulator/sessions",
        headers=auth_headers,
        json={
            "scenario_id": "scenario-trend-continuation",
            "decision_note": "The setup has no clean invalidation, so I will preserve the daily risk budget.",
            "risk_defined_before_entry": True,
            "concentration_checked": True,
        },
    ).json()
    before = client.get(
        f"/api/v1/simulator/sessions/{no_trade['id']}/results", headers=auth_headers
    )
    assert before.status_code == 409
    completed = client.post(
        f"/api/v1/simulator/sessions/{no_trade['id']}/step",
        headers=auth_headers,
        json={"candles": 100, "expected_version": 1},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    results = client.get(
        f"/api/v1/simulator/sessions/{no_trade['id']}/results", headers=auth_headers
    )
    assert results.status_code == 200
    assert results.json()["process"]["score"] == 100
    assert "no_trade_choice" in results.json()["process"]["followed_rules"]
    assert "decision_reason_documented" in results.json()["process"]["followed_rules"]
    assert results.json()["debrief"]

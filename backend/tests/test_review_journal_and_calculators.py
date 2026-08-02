from datetime import UTC, datetime, timedelta


def _review_payload(*, again: bool, reps: int, lapses: int) -> dict:
    now = datetime.now(UTC)
    return {
        "rating": "again" if again else "good",
        "due_at": (now + timedelta(minutes=10 if again else 1, days=0 if again else 2)).isoformat(),
        "stability": "0.5" if again else "2.5",
        "difficulty": "5.0",
        "state": "relearning" if again else "review",
        "reps": reps,
        "lapses": lapses,
        "last_review": now.isoformat(),
    }


def test_review_persists_client_ts_fsrs_state_and_recall_lapse(client, auth_headers) -> None:
    queue = client.get("/api/v1/review/queue?limit=1", headers=auth_headers)
    assert queue.status_code == 200
    card_id = queue.json()[0]["card"]["id"]

    first = client.post(
        f"/api/v1/review/cards/{card_id}",
        headers=auth_headers,
        json=_review_payload(again=False, reps=1, lapses=0),
    )
    assert first.status_code == 200
    assert first.json()["review_count"] == 1

    second = client.post(
        f"/api/v1/review/cards/{card_id}",
        headers=auth_headers,
        json=_review_payload(again=True, reps=2, lapses=1),
    )
    assert second.status_code == 200
    assert second.json()["lapse_count"] == 1

    dashboard = client.get("/api/v1/dashboard", headers=auth_headers).json()
    assert any(item["state"] == "needs_review" for item in dashboard["mastery"])
    achievement_ids = {
        item["achievement_id"]
        for item in client.get("/api/v1/achievements", headers=auth_headers).json()
    }
    assert "first-review" in achievement_ids


def test_journal_summary_has_period_setup_and_mistake_aggregates(client, auth_headers) -> None:
    entries = [
        {
            "setup": "breakout",
            "thesis": "A conditional, simulated setup with predefined invalidation.",
            "result_amount": "40",
            "r_multiple": "1.5",
            "rule_adherence": 90,
            "emotions_before": "calm",
            "tags": ["late-entry", "chasing"],
        },
        {
            "setup": "breakout",
            "thesis": "A second simulated example reviewed independently of outcome.",
            "result_amount": "-20",
            "r_multiple": "-0.5",
            "rule_adherence": 70,
            "emotions_before": "impatient",
            "tags": ["late-entry"],
        },
        {
            "setup": "pullback",
            "thesis": "A planned pullback with an explicit risk boundary.",
            "result_amount": "10",
            "r_multiple": "0.5",
            "rule_adherence": 95,
            "emotions_before": "calm",
            "tags": [],
        },
    ]
    for entry in entries:
        response = client.post("/api/v1/journal", headers=auth_headers, json=entry)
        assert response.status_code == 201

    summary = client.get("/api/v1/journal/summary", headers=auth_headers)
    assert summary.status_code == 200
    payload = summary.json()
    assert payload["entry_count"] == 3
    assert payload["top_setups"][0] == {"name": "breakout", "count": 2}
    assert payload["repeated_mistakes"][0] == {"name": "late-entry", "count": 2}
    assert payload["last_7_days"]["entry_count"] == 3
    assert payload["strongest_setups"]
    assert payload["weakest_setups"]


def test_decimal_calculators_have_explicit_stable_results(client) -> None:
    position = client.post(
        "/api/v1/calculators/position-size",
        json={
            "account_balance": "10000",
            "risk_percent": "1",
            "entry_price": "50",
            "stop_price": "49",
        },
    )
    assert position.status_code == 200
    assert position.json() == {
        "risk_amount": "100.00000000",
        "risk_per_unit": "1.00000000",
        "quantity": "100.00000000",
        "position_value": "5000.00000000",
    }

    invalid = client.post(
        "/api/v1/calculators/reward-to-risk",
        json={
            "entry_price": "50",
            "stop_price": "51",
            "target_price": "55",
            "side": "long",
        },
    )
    assert invalid.status_code == 422

    wrong_target = client.post(
        "/api/v1/calculators/reward-to-risk",
        json={
            "entry_price": "50",
            "stop_price": "49",
            "target_price": "48",
            "side": "long",
        },
    )
    negative_equity = client.post(
        "/api/v1/calculators/drawdown",
        json={"equity_curve": ["100", "-10"]},
    )
    assert wrong_target.status_code == 422
    assert negative_equity.status_code == 422

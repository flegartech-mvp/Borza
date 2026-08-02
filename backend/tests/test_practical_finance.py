from __future__ import annotations


def test_public_practical_content_is_versioned_and_multilingual(client) -> None:
    response = client.get("/api/v1/practical-content")
    assert response.status_code == 200
    payload = response.json()
    assert payload["locales"] == ["de", "sl", "en"]
    assert len(payload["life_simulator"]["scenario"]["rounds"]) == 8
    assert len(payload["scam_scenarios"]) == 8
    assert len(payload["decision_cases"]) >= 10
    assert len(payload["classroom_activities"]) >= 6


def test_decision_attempt_creates_server_scored_owner_scoped_passport(
    client, auth_headers, other_auth_headers
) -> None:
    created = client.post(
        "/api/v1/practical/attempts",
        headers=auth_headers,
        json={
            "activity_type": "decision_lab",
            "activity_id": "car-repair-or-finance",
            "content_version": "1.0",
            "selected_option_id": "diagnose-repair",
            "reasoning": "I would verify repair life and preserve an emergency buffer first.",
            "assumptions": ["The second diagnosis supports repair."],
            "calculations": {"repair": 1400, "finance_cash_out": 15540},
        },
    )
    assert created.status_code == 201
    assert created.json()["process_score"] >= 78
    assert created.json()["feedback"]["quality"] == "strong"

    own = client.get("/api/v1/practical/attempts", headers=auth_headers)
    hidden = client.get("/api/v1/practical/attempts", headers=other_auth_headers)
    assert len(own.json()) == 1
    assert hidden.json() == []

    passport = client.get("/api/v1/practical/passport", headers=auth_headers)
    evidence = {item["competence_id"]: item for item in passport.json() if item["evidence_count"]}
    assert set(evidence) >= {"credit-debt", "insurance", "decision-making"}
    assert all(item["recent_evidence"] for item in evidence.values())


def test_scam_score_is_derived_from_canonical_signals(client, auth_headers) -> None:
    response = client.post(
        "/api/v1/practical/attempts",
        headers=auth_headers,
        json={
            "activity_type": "scam_detector",
            "activity_id": "fake-bank-call",
            "content_version": "1.0",
            "selected_option_id": "pause-and-verify",
            "reasoning": "I would hang up and call the number printed on the bank card myself.",
            "response": {"selected_signal_ids": ["otp", "safe-account"]},
        },
    )
    assert response.status_code == 201
    assert response.json()["process_score"] >= 85
    assert response.json()["feedback"]["missed_signal_ids"] == []


def test_life_session_applies_server_side_effects_and_rejects_cross_owner(
    client, auth_headers, other_auth_headers
) -> None:
    created = client.post(
        "/api/v1/practical/life-sessions",
        headers=auth_headers,
        json={"profile_id": "first-job-renter"},
    )
    assert created.status_code == 201
    session = created.json()
    original_stress = session["financial_state"]["stress"]

    updated = client.put(
        f"/api/v1/practical/life-sessions/{session['id']}",
        headers=auth_headers,
        json={
            "expected_round": 0,
            "selected_option_id": "stable",
            "reasoning": "The predictable net income protects my still-small emergency reserve.",
            "calculations": {"monthly_margin": 330},
        },
    )
    assert updated.status_code == 200
    assert updated.json()["current_round"] == 1
    assert updated.json()["financial_state"]["stress"] < original_stress

    hidden = client.put(
        f"/api/v1/practical/life-sessions/{session['id']}",
        headers=other_auth_headers,
        json={
            "expected_round": 1,
            "selected_option_id": "shared-rent",
            "reasoning": "This should not reveal or mutate another learner's private session.",
        },
    )
    assert hidden.status_code == 404


def test_teacher_code_join_response_aggregate_and_owner_boundary(
    client, auth_headers, other_auth_headers
) -> None:
    created = client.post(
        "/api/v1/teacher/classrooms",
        headers=auth_headers,
        json={
            "activity_type": "credit_comparison",
            "activity_id": "credit-total-cost",
            "content_version": "1.0",
            "duration_minutes": 45,
            "settings": {"show_aggregate_only": True},
        },
    )
    assert created.status_code == 201
    classroom = created.json()
    assert len(classroom["classroom_code"]) == 7

    joined = client.post(
        "/api/v1/classrooms/join",
        json={"classroom_code": classroom["classroom_code"], "pseudonym": "Modri Ris"},
    )
    assert joined.status_code == 200
    participant = joined.json()
    assert participant["participant_token"] not in str(classroom)

    answered = client.post(
        f"/api/v1/classrooms/{classroom['id']}/responses",
        headers={"X-Classroom-Token": participant["participant_token"]},
        json={
            "item_id": "car-repair-or-finance",
            "answer": {
                "selected_option_id": "diagnose-repair",
                "calculations": {"repair": 1400},
            },
            "reasoning": "I compared the total cost and kept enough liquid emergency savings.",
            "completed": True,
        },
    )
    assert answered.status_code == 201
    assert answered.json()["process_score"] >= 78

    dashboard = client.get(
        f"/api/v1/teacher/classrooms/{classroom['id']}/dashboard", headers=auth_headers
    )
    assert dashboard.status_code == 200
    assert dashboard.json()["completed_participants"] == 1
    assert dashboard.json()["decision_distribution"] == {"diagnose-repair": 1}
    assert "pseudonym" not in str(dashboard.json()).lower()

    hidden = client.get(
        f"/api/v1/teacher/classrooms/{classroom['id']}/dashboard",
        headers=other_auth_headers,
    )
    assert hidden.status_code == 404

    report = client.get(
        f"/api/v1/teacher/classrooms/{classroom['id']}/report.csv", headers=auth_headers
    )
    assert report.status_code == 200
    assert "class_process_score" in report.text
    assert "Modri Ris" not in report.text


def test_partnership_interest_requires_consent_and_rejects_honeypot(client) -> None:
    payload = {
        "kind": "classroom_sponsor",
        "organisation": "Primer Fundacija",
        "contact_role": "Program lead",
        "contact_email": "program@example.org",
        "message": "We want to discuss supporting an anonymous classroom pilot responsibly.",
        "consent": True,
    }
    accepted = client.post("/api/v1/partnership-interests", json=payload)
    assert accepted.status_code == 202
    assert accepted.json()["retention_days"] >= 30
    assert "contact_email" not in accepted.json()

    spammed = client.post(
        "/api/v1/partnership-interests", json={**payload, "website": "https://spam.example"}
    )
    assert spammed.status_code == 422


def test_mentor_is_explicit_guided_fallback_when_provider_is_disabled(client, auth_headers) -> None:
    response = client.post(
        "/api/v1/practical/mentor",
        headers=auth_headers,
        json={
            "context_type": "decision_lab",
            "context_id": "car-repair-or-finance",
            "learner_message": "I am focused on the monthly payment. What else should I check?",
            "decision_summary": "Repair compared with a five-year financing offer.",
            "locale": "sl",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "guided_fallback"
    assert "brez odgovora modela" in payload["safety_note"]
    assert payload["referenced_content_ids"] == ["car-repair-or-finance"]

from app.content.registry import load_academy_registry


def _correct_quiz_answers(lesson_id: str) -> list[dict]:
    questions = load_academy_registry().questions_for_quiz(lesson_id)
    answers = []
    for question in questions:
        answer_key = question["answer"]
        if "correct_option_ids" in answer_key:
            answer = answer_key["correct_option_ids"]
        elif "ordered_ids" in answer_key:
            answer = {"ordered_ids": answer_key["ordered_ids"]}
        elif "matched_pair_ids" in answer_key:
            answer = {"matched_pair_ids": answer_key["matched_pair_ids"]}
        elif "matches" in answer_key:
            answer = {"matches": answer_key["matches"]}
        elif "value" in answer_key:
            answer = {"value": answer_key["value"]}
        else:
            answer = "A concrete alternative with a clear amount and time horizon."
        answers.append({"question_id": question["id"], "answer": answer})
    return answers


def test_progress_quiz_mastery_streak_and_dashboard(client, auth_headers) -> None:
    lesson_id = "lesson-ff-finance-map"
    response = client.put(
        f"/api/v1/lessons/{lesson_id}/progress",
        headers=auth_headers,
        json={"status": "completed", "progress_percent": 100},
    )
    assert response.status_code == 200

    dashboard = client.get("/api/v1/dashboard", headers=auth_headers)
    assert dashboard.status_code == 200
    assert dashboard.json()["completed_lesson_count"] == 1
    assert dashboard.json()["streak"]["current_days"] == 1

    achievements = client.get("/api/v1/achievements", headers=auth_headers)
    assert [item["achievement_id"] for item in achievements.json()] == ["first-lesson"]

    quiz_payload = {"answers": _correct_quiz_answers(lesson_id)}
    first = client.post(
        f"/api/v1/quizzes/{lesson_id}/attempts",
        headers=auth_headers,
        json=quiz_payload,
    )
    assert first.status_code == 200
    assert first.json()["score_percent"] == "100.00"
    mastery = client.get("/api/v1/dashboard", headers=auth_headers).json()["mastery"]
    assert mastery[0]["state"] != "mastered"

    for _ in range(2):
        repeated = client.post(
            f"/api/v1/quizzes/{lesson_id}/attempts",
            headers=auth_headers,
            json=quiz_payload,
        )
        assert repeated.status_code == 200
    mastery = client.get("/api/v1/dashboard", headers=auth_headers).json()["mastery"]
    assert mastery[0]["state"] == "mastered"
    assert mastery[0]["evidence_count"] == 4


def test_user_owned_notes_are_not_visible_to_another_user(
    client, auth_headers, other_auth_headers
) -> None:
    lesson_id = "lesson-ff-finance-map"
    created = client.put(
        f"/api/v1/lessons/{lesson_id}/notes",
        headers=auth_headers,
        json={"body": "My private note"},
    )
    assert created.status_code == 200

    hidden = client.get(f"/api/v1/lessons/{lesson_id}/notes", headers=other_auth_headers)
    assert hidden.status_code == 404


def test_simulator_sessions_and_journals_are_owner_scoped(
    client, auth_headers, other_auth_headers
) -> None:
    session = client.post(
        "/api/v1/simulator/sessions",
        headers=auth_headers,
        json={"scenario_id": "scenario-trend-continuation"},
    )
    assert session.status_code == 201
    session_id = session.json()["id"]
    assert (
        client.get(
            f"/api/v1/simulator/sessions/{session_id}", headers=other_auth_headers
        ).status_code
        == 404
    )

    journal = client.post(
        "/api/v1/journal",
        headers=auth_headers,
        json={
            "setup": "owner-scope-check",
            "thesis": "Only the verified owner may retrieve or mutate this private record.",
        },
    )
    assert journal.status_code == 201
    journal_id = journal.json()["id"]
    assert (
        client.get(f"/api/v1/journal/{journal_id}", headers=other_auth_headers).status_code
        == 404
    )
    assert (
        client.put(
            f"/api/v1/journal/{journal_id}",
            headers=other_auth_headers,
            json={"setup": "forbidden", "thesis": "This update must never cross owners."},
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/v1/journal/{journal_id}", headers=other_auth_headers).status_code
        == 404
    )


def test_private_routes_require_authentication(client) -> None:
    response = client.get("/api/v1/dashboard")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"

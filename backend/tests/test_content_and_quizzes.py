from decimal import Decimal

from sqlalchemy import func, select

from app.content.registry import load_academy_registry
from app.database import SessionLocal
from app.models.academy import QuizAttempt
from app.services.quiz_scoring import score_answer


def test_registry_resolves_modules_cards_and_practice() -> None:
    registry = load_academy_registry()

    assert len(registry.paths) == 12
    assert len(registry.modules) >= 24
    assert len(registry.lessons) >= 32
    assert len(registry.questions) >= 72
    assert len(registry.review_cards) == len(registry.glossary)
    assert len(registry.practice["simulation_scenarios"]) == 10
    card = registry.review_card_by_id("card-return")
    assert card is not None
    assert card["back"]["en"]


def test_scoring_supports_every_content_answer_shape() -> None:
    assert score_answer({"type": "single_choice", "answer": {"correct_option_ids": ["b"]}}, "b")
    assert score_answer(
        {"type": "multiple_choice", "answer": {"correct_option_ids": ["a", "c"]}},
        {"selected_option_ids": ["c", "a"]},
    )
    assert score_answer(
        {"type": "formula_calculation", "answer": {"value": 5, "tolerance": 0.01}},
        {"value": Decimal("5.005")},
    )
    assert score_answer(
        {"type": "ordering", "answer": {"ordered_ids": ["a", "b"]}},
        {"ordered_ids": ["a", "b"]},
    )
    assert score_answer(
        {"type": "matching", "answer": {"matches": {"left-a": "right-b"}}},
        {"matches": {"left-a": "right-b"}},
    )
    assert score_answer(
        {"type": "short_reflection", "answer": {"rubric": {"en": ["specific"]}}},
        "I would compare the concrete alternative and its timing.",
    )
    assert not score_answer(
        {"type": "short_reflection", "answer": {"rubric": {"en": ["specific"]}}},
        "Not sure",
    )


def test_public_catalog_hides_replay_future_and_enriches_lesson(client) -> None:
    catalog = client.get("/api/v1/catalog")
    assert catalog.status_code == 200
    assert catalog.json()["counts"]["modules"] >= 24

    scenario = client.get("/api/v1/scenarios/scenario-trend-continuation")
    assert scenario.status_code == 200
    assert not {"seed", "generator", "process_rules", "debrief"}.intersection(scenario.json())

    path = client.get("/api/v1/learning-paths/path-finance-foundations")
    assert path.status_code == 200
    assert path.json()["lesson_count"] == 8
    assert path.json()["modules"][0]["lessons"]

    path_catalog = client.get("/api/v1/learning-paths").json()
    coming_next = [item for item in path_catalog if item["status"] == "coming_next"]
    assert coming_next
    assert all(item["lesson_count"] == 0 for item in coming_next)

    lesson = client.get("/api/v1/lessons/lesson-ff-finance-map")
    assert lesson.status_code == 200
    payload = lesson.json()
    assert payload["resolved_sources"][0]["url"].startswith("https://")
    assert payload["resolved_glossary"]
    assert payload["resolved_review_cards"]
    assert "answer" not in payload["knowledge_check_metadata"][0]

    glossary = client.get("/api/v1/glossary?path_id=path-risk-management")
    assert glossary.status_code == 200
    assert glossary.json()
    assert all("path-risk-management" in item["path_ids"] for item in glossary.json())


def test_lesson_id_is_stable_quiz_id_and_partial_submission_is_rejected(
    client, auth_headers
) -> None:
    quiz = client.get("/api/v1/quizzes/lesson-ff-finance-map")
    assert quiz.status_code == 200
    payload = quiz.json()
    assert payload["id"] == payload["lesson_id"] == "lesson-ff-finance-map"
    assert all("answer" not in question for question in payload["questions"])

    response = client.post(
        "/api/v1/quizzes/lesson-ff-finance-map/attempts",
        headers=auth_headers,
        json={"answers": [{"question_id": payload["questions"][0]["id"], "answer": "b"}]},
    )
    assert response.status_code == 422
    assert "missing" in response.json()["detail"]
    with SessionLocal() as db:
        assert db.scalar(select(func.count(QuizAttempt.id))) == 0


def test_public_practice_catalog_does_not_expose_solutions(client) -> None:
    charts = client.get("/api/v1/chart-exercises")
    calculators = client.get("/api/v1/calculator-exercises")

    assert charts.status_code == 200
    assert calculators.status_code == 200
    assert all("solution" not in item for item in charts.json())
    assert all(
        "expected" not in item and "worked_example" not in item for item in calculators.json()
    )


def test_openapi_uses_named_catalog_contracts(client) -> None:
    document = client.get("/openapi.json").json()
    paths = document["paths"]

    assert paths["/api/v1/catalog"]["get"]["responses"]["200"]["content"]["application/json"][
        "schema"
    ]["$ref"].endswith("/CatalogSummary")
    for endpoint in (
        "/api/v1/learning-paths",
        "/api/v1/glossary",
        "/api/v1/chart-exercises",
        "/api/v1/calculator-exercises",
        "/api/v1/scenarios",
    ):
        item_schema = paths[endpoint]["get"]["responses"]["200"]["content"]["application/json"][
            "schema"
        ]["items"]
        assert "$ref" in item_schema

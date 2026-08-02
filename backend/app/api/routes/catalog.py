import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status

from app.content.registry import AcademyRegistry, ContentRegistryError, load_academy_registry
from app.schemas.academy import (
    CalculatorExerciseRead,
    CatalogSummary,
    ChartExerciseRead,
    GlossaryTermRead,
    LearningPathDetail,
    LearningPathRead,
    LessonRead,
    ScenarioMetadata,
)

router = APIRouter(prefix="/api/v1", tags=["catalog"])
logger = logging.getLogger(__name__)


def registry_or_503():
    try:
        return load_academy_registry()
    except ContentRegistryError as exc:
        logger.exception("Academy content registry could not be loaded")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Academy content is temporarily unavailable.",
        ) from exc


@router.get("/catalog", response_model=CatalogSummary)
def catalog_summary() -> dict[str, Any]:
    registry = registry_or_503()
    return {
        "schema_version": registry.schema_version,
        "default_locale": registry.default_locale,
        "locales": registry.locales,
        "counts": {
            "paths": len(registry.paths),
            "modules": len(registry.modules),
            "lessons": len(registry.lessons),
            "questions": len(registry.questions),
            "glossary": len(registry.glossary),
            "review_cards": len(registry.review_cards),
            "chart_exercises": len(registry.practice.get("chart_exercises", [])),
            "calculator_exercises": len(registry.practice.get("calculator_exercises", [])),
            "simulation_scenarios": len(registry.practice.get("simulation_scenarios", [])),
        },
    }


@router.get("/learning-paths", response_model=list[LearningPathRead])
def list_learning_paths() -> list[dict[str, Any]]:
    registry = registry_or_503()
    return [_path_summary(registry, path) for path in registry.paths]


@router.get("/learning-paths/{path_id}", response_model=LearningPathDetail)
def get_learning_path(path_id: str) -> dict[str, Any]:
    registry = registry_or_503()
    path = registry.path_by_id(path_id)
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Learning path not found.")
    result = _path_summary(registry, path)
    path_lessons = [lesson for lesson in registry.lessons if lesson.get("path_id") == path_id]
    result["lessons"] = sorted(path_lessons, key=lambda item: int(item.get("order", 0)))
    modules = []
    for module in registry.modules:
        if module.get("path_id") != path_id:
            continue
        module_payload = dict(module)
        module_payload["lessons"] = sorted(
            [item for item in path_lessons if item.get("module_id") == module.get("id")],
            key=lambda item: int(item.get("order", 0)),
        )
        modules.append(module_payload)
    result["modules"] = sorted(modules, key=lambda item: int(item.get("order", 0)))
    return result


def _path_summary(registry: AcademyRegistry, path: dict[str, Any]) -> dict[str, Any]:
    path_id = str(path.get("id"))
    return {
        **path,
        "lesson_count": sum(item.get("path_id") == path_id for item in registry.lessons),
        "module_count": sum(item.get("path_id") == path_id for item in registry.modules),
    }


@router.get("/lessons/{lesson_id}", response_model=LessonRead)
def get_lesson(lesson_id: str) -> dict[str, Any]:
    registry = registry_or_503()
    lesson = registry.lesson_by_id(lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found.")
    result = dict(lesson)
    source_ids = [str(item) for item in (lesson.get("sources") or [])]
    glossary_ids = [str(item) for item in (lesson.get("glossary") or [])]
    review_card_ids = [str(item) for item in (lesson.get("review_cards") or [])]
    question_ids = {str(item) for item in (lesson.get("knowledge_checks") or [])}
    result["resolved_sources"] = [
        source for source_id in source_ids if (source := registry.source_by_id(source_id))
    ]
    result["resolved_glossary"] = [
        term for glossary_id in glossary_ids if (term := registry.glossary_by_id(glossary_id))
    ]
    result["resolved_review_cards"] = [
        card for card_id in review_card_ids if (card := registry.review_card_by_id(card_id))
    ]
    result["knowledge_check_metadata"] = [
        {
            key: value
            for key, value in question.items()
            if key not in {"answer", "correct_answer", "correct_answers", "feedback"}
        }
        for question in registry.questions
        if str(question.get("id")) in question_ids
    ]
    return result


@router.get("/glossary", response_model=list[GlossaryTermRead])
def glossary(
    path_id: str | None = Query(default=None, max_length=100),
) -> list[dict[str, Any]]:
    items = list(registry_or_503().glossary)
    return [item for item in items if not path_id or path_id in (item.get("path_ids") or [])]


@router.get("/chart-exercises", response_model=list[ChartExerciseRead])
def chart_exercises() -> list[dict[str, Any]]:
    return list(registry_or_503().practice.get("chart_exercises", []))


@router.get("/calculator-exercises", response_model=list[CalculatorExerciseRead])
def calculator_exercises() -> list[dict[str, Any]]:
    return list(registry_or_503().practice.get("calculator_exercises", []))


@router.get("/scenarios", response_model=list[ScenarioMetadata])
def scenarios() -> list[dict[str, Any]]:
    registry = registry_or_503()
    result = []
    for item in registry.practice.get("simulation_scenarios", []):
        if isinstance(item, dict):
            result.append(_safe_scenario(item))
    return result


@router.get("/scenarios/{scenario_id}", response_model=ScenarioMetadata)
def scenario(scenario_id: str) -> dict[str, Any]:
    item = registry_or_503().scenario_by_id(scenario_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Simulation scenario not found.")
    return _safe_scenario(item)


def _safe_scenario(item: dict[str, Any]) -> dict[str, Any]:
    return {
        key: item[key]
        for key in (
            "id",
            "order",
            "simulated",
            "title",
            "brief",
            "account",
            "decision_points",
            "related_lessons",
            "recommended_review_cards",
        )
        if key in item
    }

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings


class ContentRegistryError(RuntimeError):
    """Raised when version-controlled Academy content is missing or inconsistent."""


def _read_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError as exc:
        raise ContentRegistryError(f"Academy content file is missing: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ContentRegistryError(
            f"Academy content JSON is invalid at {path}:{exc.lineno}:{exc.colno}"
        ) from exc
    except OSError as exc:
        raise ContentRegistryError(f"Academy content file cannot be read: {path}") from exc


def _collection_items(payload: Any, key: str) -> list[dict[str, Any]]:
    aliases = {"glossary": "terms"}
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict) and isinstance(payload.get(key), list):
        items = payload[key]
    elif isinstance(payload, dict) and isinstance(payload.get(aliases.get(key, "")), list):
        items = payload[aliases[key]]
    elif isinstance(payload, dict) and all(isinstance(value, dict) for value in payload.values()):
        items = list(payload.values())
    else:
        raise ContentRegistryError(f"Academy collection {key!r} must contain a JSON array")
    if not all(isinstance(item, dict) for item in items):
        raise ContentRegistryError(f"Academy collection {key!r} contains a non-object item")
    return items


def _generated_review_cards(
    payload: Any,
    glossary: list[dict[str, Any]],
    locales: tuple[str, ...],
) -> list[dict[str, Any]]:
    if not isinstance(payload, dict) or not isinstance(payload.get("generation"), dict):
        return _collection_items(payload, "review_cards")
    generation = payload["generation"]
    if generation.get("mode") != "one_per_glossary_term":
        raise ContentRegistryError("Unsupported generated review-card mode")
    replacement = generation.get("id_prefix_replacement") or {}
    source_prefix = str(replacement.get("from") or "term-")
    target_prefix = str(replacement.get("to") or "card-")
    templates = generation.get("front_template") or {}
    overrides = payload.get("kind_overrides") or {}
    if not isinstance(templates, dict) or not isinstance(overrides, dict):
        raise ContentRegistryError("Generated review-card templates and kinds must be objects")
    kind_by_id = {
        str(card_id): str(kind)
        for kind, card_ids in overrides.items()
        if isinstance(card_ids, list)
        for card_id in card_ids
    }
    cards: list[dict[str, Any]] = []
    for glossary_item in glossary:
        glossary_id = str(glossary_item.get("id") or "")
        card_id = (
            f"{target_prefix}{glossary_id.removeprefix(source_prefix)}"
            if glossary_id.startswith(source_prefix)
            else f"{target_prefix}{glossary_id}"
        )
        terms = glossary_item.get("term")
        definitions = glossary_item.get("definition")
        if not isinstance(terms, dict) or not isinstance(definitions, dict):
            raise ContentRegistryError(f"{glossary_id} cannot generate a review card")
        front: dict[str, str] = {}
        back: dict[str, str] = {}
        for locale in locales:
            template = templates.get(locale)
            term = terms.get(locale)
            definition = definitions.get(locale)
            if (
                not isinstance(template, str)
                or not template
                or not isinstance(term, str)
                or not term
                or not isinstance(definition, str)
                or not definition
            ):
                raise ContentRegistryError(
                    f"{glossary_id} is missing generated review-card locale {locale}"
                )
            front[locale] = template.format(term=term)
            back[locale] = definition
        cards.append(
            {
                "id": card_id,
                "glossary_id": glossary_id,
                "path_ids": list(glossary_item.get("path_ids") or []),
                "kind": kind_by_id.get(card_id, "concept"),
                "front": front,
                "back": back,
            }
        )
    return cards


@dataclass(frozen=True)
class AcademyRegistry:
    path: Path
    schema_version: str
    default_locale: str
    locales: tuple[str, ...]
    paths: tuple[dict[str, Any], ...]
    modules: tuple[dict[str, Any], ...]
    lessons: tuple[dict[str, Any], ...]
    questions: tuple[dict[str, Any], ...]
    glossary: tuple[dict[str, Any], ...]
    review_cards: tuple[dict[str, Any], ...]
    practice: dict[str, Any]
    sources: tuple[dict[str, Any], ...]

    def _by_id(self, items: tuple[dict[str, Any], ...], item_id: str) -> dict[str, Any] | None:
        return next((item for item in items if str(item.get("id")) == item_id), None)

    def path_by_id(self, path_id: str) -> dict[str, Any] | None:
        return self._by_id(self.paths, path_id)

    def lesson_by_id(self, lesson_id: str) -> dict[str, Any] | None:
        return self._by_id(self.lessons, lesson_id)

    def source_by_id(self, source_id: str) -> dict[str, Any] | None:
        return self._by_id(self.sources, source_id)

    def glossary_by_id(self, glossary_id: str) -> dict[str, Any] | None:
        return self._by_id(self.glossary, glossary_id)

    def scenario_by_id(self, scenario_id: str) -> dict[str, Any] | None:
        scenarios = self.practice.get("simulation_scenarios", [])
        return next(
            (
                item
                for item in scenarios
                if isinstance(item, dict) and item.get("id") == scenario_id
            ),
            None,
        )

    def review_card_by_id(self, card_id: str) -> dict[str, Any] | None:
        return self._by_id(self.review_cards, card_id)

    def questions_for_quiz(self, quiz_id: str) -> list[dict[str, Any]]:
        direct = [item for item in self.questions if item.get("quiz_id") == quiz_id]
        if direct:
            return direct
        lesson = self.lesson_by_id(quiz_id)
        if lesson is not None:
            ids = lesson.get("knowledge_checks") or []
            id_set = {str(item.get("id") if isinstance(item, dict) else item) for item in ids}
            return [item for item in self.questions if str(item.get("id")) in id_set]
        return [item for item in self.questions if item.get("lesson_id") == quiz_id]

    def validate(self) -> list[str]:
        issues: list[str] = []
        required_locales = set(self.locales)
        collections = {
            "path": self.paths,
            "module": self.modules,
            "lesson": self.lessons,
            "question": self.questions,
            "glossary": self.glossary,
            "review card": self.review_cards,
        }
        all_ids: set[str] = set()
        for label, items in collections.items():
            seen: set[str] = set()
            for item in items:
                item_id = str(item.get("id") or "").strip()
                if not item_id:
                    issues.append(f"{label} is missing a stable id")
                    continue
                if item_id in seen or item_id in all_ids:
                    issues.append(f"duplicate content id: {item_id}")
                seen.add(item_id)
                all_ids.add(item_id)
                translated = item.get("title") or item.get("term") or item.get("prompt")
                if isinstance(translated, dict):
                    missing = required_locales - set(translated)
                    if missing:
                        issues.append(f"{item_id} is missing locales: {', '.join(sorted(missing))}")

        path_ids = {str(item.get("id")) for item in self.paths}
        module_ids = {str(item.get("id")) for item in self.modules}
        lesson_ids = {str(item.get("id")) for item in self.lessons}
        for module in self.modules:
            if str(module.get("path_id")) not in path_ids:
                issues.append(f"{module.get('id')} references unknown path {module.get('path_id')}")
        for lesson in self.lessons:
            lesson_id = str(lesson.get("id"))
            if str(lesson.get("path_id")) not in path_ids:
                issues.append(f"{lesson_id} references unknown path {lesson.get('path_id')}")
            if str(lesson.get("module_id")) not in module_ids:
                issues.append(f"{lesson_id} references unknown module {lesson.get('module_id')}")
            for prerequisite in lesson.get("prerequisites") or []:
                prerequisite_id = str(
                    prerequisite.get("id") if isinstance(prerequisite, dict) else prerequisite
                )
                if prerequisite_id not in lesson_ids:
                    issues.append(f"{lesson_id} references unknown prerequisite {prerequisite_id}")
        for question in self.questions:
            lesson_id = str(question.get("lesson_id") or "")
            if lesson_id and lesson_id not in lesson_ids:
                issues.append(f"{question.get('id')} references unknown lesson {lesson_id}")
        return issues


def _resolve_collection(index_path: Path, value: Any) -> Any:
    if isinstance(value, str):
        collection_path = (index_path.parent / value).resolve()
        if index_path.parent.resolve() not in collection_path.parents:
            raise ContentRegistryError(
                "Academy registry collection paths must stay in its directory"
            )
        return _read_json(collection_path)
    return value


@lru_cache(maxsize=8)
def _load_registry_cached(path_value: str, modified_ns: int) -> AcademyRegistry:
    del modified_ns
    path = Path(path_value)
    raw = _read_json(path)
    if not isinstance(raw, dict):
        raise ContentRegistryError("Academy registry root must be a JSON object")
    collections = raw.get("collections")
    if not isinstance(collections, dict):
        raise ContentRegistryError("Academy registry requires a collections object")

    loaded = {key: _resolve_collection(path, value) for key, value in collections.items()}
    practice = loaded.get("practice", {})
    if isinstance(practice, list):
        practice = {"chart_exercises": practice}
    if not isinstance(practice, dict):
        raise ContentRegistryError("Academy practice collection must be a JSON object")

    locales = tuple(str(item) for item in (raw.get("locales") or ["de", "sl", "en"]))
    glossary = _collection_items(loaded.get("glossary", []), "glossary")
    review_cards = _generated_review_cards(loaded.get("review_cards", []), glossary, locales)
    registry = AcademyRegistry(
        path=path,
        schema_version=str(raw.get("schema_version") or "1"),
        default_locale=str(raw.get("default_locale") or "de"),
        locales=locales,
        paths=tuple(_collection_items(loaded.get("paths", []), "paths")),
        modules=tuple(_collection_items(loaded.get("lessons", []), "modules")),
        lessons=tuple(_collection_items(loaded.get("lessons", []), "lessons")),
        questions=tuple(_collection_items(loaded.get("questions", []), "questions")),
        glossary=tuple(glossary),
        review_cards=tuple(review_cards),
        practice=practice,
        sources=tuple(_collection_items(loaded.get("sources", []), "sources")),
    )
    issues = registry.validate()
    if issues:
        preview = "; ".join(issues[:10])
        remainder = f" (+{len(issues) - 10} more)" if len(issues) > 10 else ""
        raise ContentRegistryError(f"Academy registry validation failed: {preview}{remainder}")
    return registry


def load_academy_registry(path: Path | None = None) -> AcademyRegistry:
    registry_path = (path or get_settings().academy_content_registry_path).resolve()
    try:
        modified_ns = registry_path.stat().st_mtime_ns
    except FileNotFoundError as exc:
        raise ContentRegistryError(f"Academy content registry is missing: {registry_path}") from exc
    return _load_registry_cached(str(registry_path), modified_ns)

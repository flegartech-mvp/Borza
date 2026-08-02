"""Validate the version-controlled Borza Academy content registry.

The validator intentionally uses only the Python standard library so it can run
in local development, CI, and release packaging without the application stack.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlsplit


LOCALES = ("de", "sl", "en")
EXPECTED_PATH_IDS = (
    "path-finance-foundations",
    "path-economics-for-markets",
    "path-financial-statements",
    "path-corporate-finance",
    "path-investing",
    "path-trading-foundations",
    "path-technical-analysis",
    "path-risk-management",
    "path-trading-psychology",
    "path-strategy-development",
    "path-derivatives",
    "path-practical-finance-skills",
)
EXPECTED_ACTIVE_PATH_IDS = {
    "path-finance-foundations",
    "path-trading-foundations",
    "path-technical-analysis",
    "path-risk-management",
}
EXPECTED_QUESTION_TYPES = {
    "single_choice",
    "multiple_choice",
    "numerical",
    "formula_calculation",
    "ordering",
    "matching",
    "chart_based",
    "scenario_decision",
    "short_reflection",
}
REQUIRED_COLLECTIONS = {
    "paths",
    "lessons",
    "questions",
    "glossary",
    "review_cards",
    "practice",
    "sources",
}
REQUIRED_LESSON_SECTIONS = {
    "learn",
    "core",
    "visual",
    "interactive",
    "worked_example",
    "common_mistake",
    "takeaway",
}
ALLOWED_SOURCE_DOMAINS = {
    "investor.gov",
    "finra.org",
    "cftc.gov",
    "ecb.europa.eu",
    "esma.europa.eu",
}
GENERATOR_ALGORITHM = "lcg-ohlcv-v1"
GENERATOR_KEYS = {
    "algorithm",
    "start_price",
    "candle_count",
    "interval_minutes",
    "drift",
    "volatility",
    "volume_base",
    "segments",
}
SEGMENT_KEYS = {
    "from_index",
    "to_index",
    "drift",
    "volatility",
    "volume_multiplier",
}
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
RULE_ID_RE = re.compile(r"^[a-z0-9]+(?:[_-][a-z0-9]+)*$")


class ContentValidationError(ValueError):
    """Raised when one or more Academy registry invariants fail."""


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ContentValidationError(f"missing JSON file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ContentValidationError(
            f"invalid JSON in {path}: line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc


def _has_allowed_domain(hostname: str) -> bool:
    return any(
        hostname == domain or hostname.endswith(f".{domain}")
        for domain in ALLOWED_SOURCE_DOMAINS
    )


def validate_registry(root: str | Path) -> dict[str, int]:
    """Validate an Academy registry directory and return its resolved counts."""

    content_root = Path(root).resolve()
    errors: list[str] = []

    def check(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    def nonempty_string(value: Any, label: str) -> bool:
        valid = isinstance(value, str) and bool(value.strip())
        check(valid, f"{label} must be a non-empty string")
        return valid

    def identifier(value: Any, label: str) -> bool:
        valid = isinstance(value, str) and bool(ID_RE.fullmatch(value))
        check(valid, f"{label} must be a lowercase kebab-case identifier")
        return valid

    def localized(value: Any, label: str, *, list_values: bool = False) -> None:
        if not isinstance(value, dict):
            errors.append(f"{label} must be a localized object")
            return
        check(
            set(value) == set(LOCALES),
            f"{label} must contain exactly the locales {list(LOCALES)}",
        )
        for locale in LOCALES:
            item = value.get(locale)
            if list_values:
                valid = (
                    isinstance(item, list)
                    and bool(item)
                    and all(isinstance(part, str) and part.strip() for part in item)
                )
                check(valid, f"{label}.{locale} must be a non-empty string list")
            else:
                nonempty_string(item, f"{label}.{locale}")

    def unique_ids(items: Any, label: str) -> dict[str, dict[str, Any]]:
        if not isinstance(items, list):
            errors.append(f"{label} must be an array")
            return {}
        result: dict[str, dict[str, Any]] = {}
        for index, item in enumerate(items):
            item_label = f"{label}[{index}]"
            if not isinstance(item, dict):
                errors.append(f"{item_label} must be an object")
                continue
            item_id = item.get("id")
            if not identifier(item_id, f"{item_label}.id"):
                continue
            check(item_id not in result, f"duplicate {label} id: {item_id}")
            result[item_id] = item
        return result

    def contiguous_orders(items: Iterable[dict[str, Any]], label: str) -> None:
        orders = [item.get("order") for item in items]
        check(
            orders == list(range(1, len(orders) + 1)),
            f"{label} orders must be contiguous and stored in order; got {orders}",
        )

    def references(values: Any, available: set[str], label: str) -> None:
        if not isinstance(values, list):
            errors.append(f"{label} must be an array")
            return
        check(len(values) == len(set(values)), f"{label} contains duplicate references")
        for value in values:
            check(value in available, f"{label} references missing id: {value}")

    def acyclic(graph: dict[str, list[str]], label: str) -> None:
        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(node: str, trail: list[str]) -> None:
            if node in visiting:
                errors.append(f"{label} contains a cycle: {' -> '.join(trail + [node])}")
                return
            if node in visited:
                return
            visiting.add(node)
            for dependency in graph.get(node, []):
                if dependency in graph:
                    visit(dependency, trail + [node])
            visiting.remove(node)
            visited.add(node)

        for node in graph:
            visit(node, [])

    registry = _read_json(content_root / "registry.json")
    manifest = _read_json(content_root / "manifest.json")
    if not isinstance(registry, dict) or not isinstance(manifest, dict):
        raise ContentValidationError("registry.json and manifest.json must contain objects")

    check(registry.get("schema_version") == 1, "registry schema_version must be 1")
    check(registry.get("default_locale") == "de", "registry default_locale must be de")
    check(registry.get("locales") == list(LOCALES), "registry locales must be de, sl, en")
    check(manifest.get("schema_version") == 1, "manifest schema_version must be 1")
    check(manifest.get("product") == "Borza Academy", "manifest product must be Borza Academy")
    check(manifest.get("default_locale") == "de", "manifest default_locale must be de")
    check(manifest.get("locales") == list(LOCALES), "manifest locales must be de, sl, en")

    collections = registry.get("collections")
    if not isinstance(collections, dict):
        raise ContentValidationError("registry collections must be an object")
    check(set(collections) == REQUIRED_COLLECTIONS, "registry collections are incomplete or unknown")
    payloads: dict[str, dict[str, Any]] = {}
    for name in REQUIRED_COLLECTIONS:
        filename = collections.get(name)
        if not nonempty_string(filename, f"registry.collections.{name}"):
            continue
        candidate = Path(filename)
        check(
            not candidate.is_absolute() and candidate.name == filename,
            f"registry.collections.{name} must be a local filename",
        )
        loaded = _read_json(content_root / candidate)
        if isinstance(loaded, dict):
            payloads[name] = loaded
        else:
            errors.append(f"collection {name} must contain an object")

    if set(payloads) != REQUIRED_COLLECTIONS:
        raise ContentValidationError("\n".join(errors or ["not all collections could be loaded"]))

    manifest_files = manifest.get("files")
    check(isinstance(manifest_files, dict), "manifest files must be an object")
    if isinstance(manifest_files, dict):
        check(manifest_files.get("registry") == "registry.json", "manifest registry filename drifted")
        for name, filename in collections.items():
            check(manifest_files.get(name) == filename, f"manifest file mismatch for {name}")

    paths = payloads["paths"].get("paths")
    modules = payloads["lessons"].get("modules")
    lessons = payloads["lessons"].get("lessons")
    questions = payloads["questions"].get("questions")
    terms = payloads["glossary"].get("terms")
    sources = payloads["sources"].get("sources")
    charts = payloads["practice"].get("chart_exercises")
    calculators = payloads["practice"].get("calculator_exercises")
    scenarios = payloads["practice"].get("simulation_scenarios")

    path_by_id = unique_ids(paths, "paths")
    module_by_id = unique_ids(modules, "modules")
    lesson_by_id = unique_ids(lessons, "lessons")
    question_by_id = unique_ids(questions, "questions")
    term_by_id = unique_ids(terms, "glossary terms")
    source_by_id = unique_ids(sources, "sources")
    chart_by_id = unique_ids(charts, "chart exercises")
    calculator_by_id = unique_ids(calculators, "calculator exercises")
    scenario_by_id = unique_ids(scenarios, "simulation scenarios")

    all_raw_ids: list[str] = []
    for mapping in (
        path_by_id,
        module_by_id,
        lesson_by_id,
        question_by_id,
        term_by_id,
        source_by_id,
        chart_by_id,
        calculator_by_id,
        scenario_by_id,
    ):
        all_raw_ids.extend(mapping)
    collisions = [item_id for item_id, count in Counter(all_raw_ids).items() if count > 1]
    check(not collisions, f"IDs collide across collections: {collisions}")

    ordered_paths = paths if isinstance(paths, list) else []
    contiguous_orders(ordered_paths, "paths")
    check(tuple(path_by_id) == EXPECTED_PATH_IDS, "the canonical 12-path curriculum order drifted")
    active_path_ids = {
        path_id for path_id, path in path_by_id.items() if path.get("status") == "active"
    }
    check(active_path_ids == EXPECTED_ACTIVE_PATH_IDS, "the canonical active path set drifted")
    path_graph: dict[str, list[str]] = {}
    for path_id, path in path_by_id.items():
        label = f"path {path_id}"
        localized(path.get("title"), f"{label}.title")
        localized(path.get("summary"), f"{label}.summary")
        localized(path.get("preview_topics"), f"{label}.preview_topics", list_values=True)
        check(path.get("difficulty") in {"beginner", "intermediate", "advanced"}, f"{label} difficulty is invalid")
        check(isinstance(path.get("estimated_minutes"), int) and path["estimated_minutes"] > 0, f"{label} estimated_minutes must be positive")
        prereqs = path.get("prerequisite_path_ids")
        references(prereqs, set(path_by_id), f"{label}.prerequisite_path_ids")
        path_graph[path_id] = prereqs if isinstance(prereqs, list) else []
        check(path_id not in path_graph[path_id], f"{label} cannot require itself")
        if path.get("status") == "active":
            nonempty_string(path.get("final_assessment_id"), f"{label}.final_assessment_id")
            completion = path.get("completion_criteria")
            check(isinstance(completion, dict), f"{label}.completion_criteria must be configured")
        else:
            check(path.get("status") == "coming_next", f"{label} status must be active or coming_next")
            check(path.get("final_assessment_id") is None, f"{label} preview must not expose a final assessment")
            check(path.get("completion_criteria") is None, f"{label} preview must not expose completion controls")
    acyclic(path_graph, "path prerequisites")

    modules_by_path: dict[str, list[dict[str, Any]]] = defaultdict(list)
    ordered_modules = modules if isinstance(modules, list) else []
    for module_id, module in module_by_id.items():
        label = f"module {module_id}"
        path_id = module.get("path_id")
        check(path_id in active_path_ids, f"{label} must belong to an active path")
        if path_id in path_by_id:
            modules_by_path[path_id].append(module)
        localized(module.get("title"), f"{label}.title")
        localized(module.get("objective"), f"{label}.objective")
    for path_id in EXPECTED_ACTIVE_PATH_IDS:
        grouped = modules_by_path[path_id]
        check(len(grouped) >= 6, f"{path_id} must contain at least six modules")
        contiguous_orders(grouped, f"modules in {path_id}")

    lessons_by_path: dict[str, list[dict[str, Any]]] = defaultdict(list)
    lessons_by_module: dict[str, list[dict[str, Any]]] = defaultdict(list)
    lesson_graph: dict[str, list[str]] = {}
    for lesson_id, lesson in lesson_by_id.items():
        label = f"lesson {lesson_id}"
        path_id = lesson.get("path_id")
        module_id = lesson.get("module_id")
        check(path_id in active_path_ids, f"{label} must belong to an active path")
        check(module_id in module_by_id, f"{label} references missing module {module_id}")
        if module_id in module_by_id:
            check(module_by_id[module_id].get("path_id") == path_id, f"{label} path and module disagree")
        if path_id in path_by_id:
            lessons_by_path[path_id].append(lesson)
        if module_id in module_by_id:
            lessons_by_module[module_id].append(lesson)
        check(isinstance(lesson.get("duration_minutes"), int) and lesson["duration_minutes"] > 0, f"{label} duration must be positive")
        check(lesson.get("difficulty") in {"beginner", "intermediate", "advanced"}, f"{label} difficulty is invalid")
        localized(lesson.get("title"), f"{label}.title")
        localized(lesson.get("summary"), f"{label}.summary")
        localized(lesson.get("objectives"), f"{label}.objectives", list_values=True)
        content = lesson.get("content")
        check(isinstance(content, dict), f"{label}.content must be an object")
        if isinstance(content, dict):
            check(REQUIRED_LESSON_SECTIONS <= set(content), f"{label} is missing required lesson sections")
            for section in ("learn", "core", "worked_example", "common_mistake", "takeaway"):
                localized(content.get(section), f"{label}.content.{section}")
            for section in ("decision_framework", "reflection_prompt"):
                if section in content:
                    localized(content.get(section), f"{label}.content.{section}")
            next_action = content.get("next_action")
            if next_action is not None:
                check(isinstance(next_action, dict), f"{label}.content.next_action must be an object")
                if isinstance(next_action, dict):
                    href = next_action.get("href")
                    check(
                        isinstance(href, str) and href.startswith("/") and not href.startswith("//"),
                        f"{label}.content.next_action.href must be a safe internal path",
                    )
                    localized(next_action.get("label"), f"{label}.content.next_action.label")
            if lesson.get("path_id") == "path-risk-management":
                check(
                    {"decision_framework", "reflection_prompt", "next_action"} <= set(content),
                    f"{label} must include the flagship decision framework, reflection, and next action",
                )
            visual = content.get("visual")
            check(isinstance(visual, dict), f"{label}.content.visual must be an object")
            if isinstance(visual, dict):
                nonempty_string(visual.get("kind"), f"{label}.content.visual.kind")
                localized(visual.get("caption"), f"{label}.content.visual.caption")
            interactive = content.get("interactive")
            check(isinstance(interactive, dict), f"{label}.content.interactive must be an object")
            if isinstance(interactive, dict):
                nonempty_string(interactive.get("kind"), f"{label}.content.interactive.kind")
                localized(interactive.get("prompt"), f"{label}.content.interactive.prompt")
        prereqs = lesson.get("prerequisites")
        references(prereqs, set(lesson_by_id), f"{label}.prerequisites")
        lesson_graph[lesson_id] = prereqs if isinstance(prereqs, list) else []
        check(lesson_id not in lesson_graph[lesson_id], f"{label} cannot require itself")
        for ref_field in ("knowledge_checks", "review_cards", "glossary", "sources"):
            refs = lesson.get(ref_field)
            check(isinstance(refs, list) and bool(refs), f"{label}.{ref_field} must be non-empty")
    for path_id in EXPECTED_ACTIVE_PATH_IDS:
        check(len(lessons_by_path[path_id]) >= 6, f"{path_id} must contain at least six lessons")
    for module_id, grouped in lessons_by_module.items():
        contiguous_orders(grouped, f"lessons in {module_id}")
    acyclic(lesson_graph, "lesson prerequisites")

    path_rank = {path_id: index for index, path_id in enumerate(EXPECTED_PATH_IDS)}
    module_rank = {module_id: module.get("order", 0) for module_id, module in module_by_id.items()}
    lesson_rank = {
        lesson_id: (
            path_rank.get(lesson.get("path_id"), math.inf),
            module_rank.get(lesson.get("module_id"), math.inf),
            lesson.get("order", math.inf),
        )
        for lesson_id, lesson in lesson_by_id.items()
    }
    for lesson_id, prereqs in lesson_graph.items():
        for prereq in prereqs:
            if prereq in lesson_rank:
                check(lesson_rank[prereq] < lesson_rank[lesson_id], f"{lesson_id} has a forward prerequisite {prereq}")

    supported_types = payloads["questions"].get("supported_types")
    check(
        isinstance(supported_types, list) and set(supported_types) == EXPECTED_QUESTION_TYPES,
        "supported question types must contain the canonical nine types",
    )
    used_types: set[str] = set()
    for question_id, question in question_by_id.items():
        label = f"question {question_id}"
        lesson_id = question.get("lesson_id")
        check(lesson_id in lesson_by_id, f"{label} references missing lesson {lesson_id}")
        question_type = question.get("type")
        check(question_type in EXPECTED_QUESTION_TYPES, f"{label} has unsupported type {question_type}")
        if question_type in EXPECTED_QUESTION_TYPES:
            used_types.add(question_type)
        localized(question.get("prompt"), f"{label}.prompt")
        feedback = question.get("feedback")
        check(isinstance(feedback, dict), f"{label}.feedback must be an object")
        if isinstance(feedback, dict):
            localized(feedback.get("correct"), f"{label}.feedback.correct")
            localized(feedback.get("incorrect"), f"{label}.feedback.incorrect")
        check(type(question.get("review_recommended")) is bool, f"{label}.review_recommended must be boolean")
        answer = question.get("answer")
        check(isinstance(answer, dict), f"{label}.answer must be an object")
        if not isinstance(answer, dict):
            continue

        if question_type in {"single_choice", "multiple_choice", "chart_based", "scenario_decision"}:
            options = question.get("options")
            option_by_id = unique_ids(options, f"{label}.options")
            check(len(option_by_id) >= 2, f"{label} must provide at least two options")
            for option_id, option in option_by_id.items():
                localized(option.get("text"), f"{label}.options.{option_id}.text")
            correct = answer.get("correct_option_ids")
            references(correct, set(option_by_id), f"{label}.answer.correct_option_ids")
            check(isinstance(correct, list) and bool(correct), f"{label} must have a correct option")
            if question_type in {"single_choice", "chart_based", "scenario_decision"}:
                check(isinstance(correct, list) and len(correct) == 1, f"{label} requires exactly one correct option")
        if question_type in {"numerical", "formula_calculation"}:
            check(isinstance(answer.get("value"), (int, float)), f"{label}.answer.value must be numeric")
            check(isinstance(answer.get("tolerance"), (int, float)) and answer["tolerance"] >= 0, f"{label}.answer.tolerance must be non-negative")
            nonempty_string(answer.get("unit"), f"{label}.answer.unit")
            if question_type == "formula_calculation":
                nonempty_string(answer.get("formula"), f"{label}.answer.formula")
        if question_type == "ordering":
            item_by_id = unique_ids(question.get("items"), f"{label}.items")
            check(len(item_by_id) >= 2, f"{label} must provide at least two ordered items")
            for item_id, item in item_by_id.items():
                localized(item.get("text"), f"{label}.items.{item_id}.text")
            ordered_ids = answer.get("ordered_ids")
            check(isinstance(ordered_ids, list) and set(ordered_ids) == set(item_by_id) and len(ordered_ids) == len(item_by_id), f"{label}.answer.ordered_ids must cover every item exactly once")
        if question_type == "matching":
            check("pairs" not in question and "matched_pair_ids" not in answer, f"{label} uses the answer-revealing legacy matching shape")
            left_by_id = unique_ids(question.get("left_items"), f"{label}.left_items")
            right_by_id = unique_ids(question.get("right_items"), f"{label}.right_items")
            check(len(left_by_id) >= 2 and len(left_by_id) == len(right_by_id), f"{label} matching sides must have equal size of at least two")
            for item_id, item in left_by_id.items():
                check(item_id.startswith("left-"), f"{label} left id must use left- namespace: {item_id}")
                localized(item.get("text"), f"{label}.left_items.{item_id}.text")
            for item_id, item in right_by_id.items():
                check(item_id.startswith("right-"), f"{label} right id must use right- namespace: {item_id}")
                localized(item.get("text"), f"{label}.right_items.{item_id}.text")
            matches = answer.get("matches")
            check(isinstance(matches, dict), f"{label}.answer.matches must be an object map")
            if isinstance(matches, dict):
                check(set(matches) == set(left_by_id), f"{label}.answer.matches must cover every left item")
                check(set(matches.values()) == set(right_by_id), f"{label}.answer.matches must be a bijection over right items")
                check(len(matches.values()) == len(set(matches.values())), f"{label}.answer.matches cannot reuse a right item")
                left_order = list(left_by_id)
                right_order = list(right_by_id)
                publicly_aligned = len(left_order) == len(right_order) and all(
                    matches.get(left_id) == right_order[index]
                    for index, left_id in enumerate(left_order)
                )
                check(not publicly_aligned, f"{label} right_items must be shuffled so order does not reveal answers")
        if question_type == "short_reflection":
            localized(answer.get("rubric"), f"{label}.answer.rubric", list_values=True)
        if question_type == "chart_based":
            check(question.get("chart_exercise_id") in chart_by_id, f"{label} references a missing chart exercise")
        if question_type == "scenario_decision":
            check(question.get("scenario_id") in scenario_by_id, f"{label} references a missing scenario")
    check(used_types == EXPECTED_QUESTION_TYPES, "question bank must exercise all nine supported types")

    for lesson_id, lesson in lesson_by_id.items():
        knowledge_checks = lesson.get("knowledge_checks", [])
        references(knowledge_checks, set(question_by_id), f"lesson {lesson_id}.knowledge_checks")
        for question_id in knowledge_checks:
            if question_id in question_by_id:
                check(question_by_id[question_id].get("lesson_id") == lesson_id, f"{question_id} points back to the wrong lesson")

    for term_id, term in term_by_id.items():
        label = f"glossary term {term_id}"
        localized(term.get("term"), f"{label}.term")
        localized(term.get("definition"), f"{label}.definition")
        path_ids = term.get("path_ids")
        references(path_ids, set(path_by_id), f"{label}.path_ids")
        check(isinstance(path_ids, list) and bool(path_ids), f"{label}.path_ids must be non-empty")
    for lesson_id, lesson in lesson_by_id.items():
        references(lesson.get("glossary"), set(term_by_id), f"lesson {lesson_id}.glossary")
    used_terms = {term_id for lesson in lesson_by_id.values() for term_id in lesson.get("glossary", [])}
    check(used_terms == set(term_by_id), "every glossary term must be referenced by a lesson")

    review_payload = payloads["review_cards"]
    generation = review_payload.get("generation")
    check(isinstance(generation, dict), "review card generation must be an object")
    if isinstance(generation, dict):
        check(generation.get("mode") == "one_per_glossary_term", "review cards must be generated one per glossary term")
        replacement = generation.get("id_prefix_replacement")
        check(replacement == {"from": "term-", "to": "card-"}, "review card id derivation drifted")
        localized(generation.get("front_template"), "review card front_template")
        check(generation.get("back_source") == "glossary.definition", "review card backs must use localized glossary definitions")
        check(generation.get("locales") == list(LOCALES), "review card locales must be de, sl, en")
    card_ids = {
        f"card-{term_id.removeprefix('term-')}"
        for term_id in term_by_id
    }
    kind_overrides = review_payload.get("kind_overrides")
    check(isinstance(kind_overrides, dict), "review card kind_overrides must be an object")
    if isinstance(kind_overrides, dict):
        overridden: list[str] = []
        for kind, ids in kind_overrides.items():
            identifier(kind.replace("_", "-"), f"review card kind {kind}")
            references(ids, card_ids, f"review card kind {kind}")
            if isinstance(ids, list):
                overridden.extend(ids)
        check(len(overridden) == len(set(overridden)), "a review card cannot have multiple kind overrides")
    for lesson_id, lesson in lesson_by_id.items():
        references(lesson.get("review_cards"), card_ids, f"lesson {lesson_id}.review_cards")

    contract = payloads["practice"].get("deterministic_generator_contract")
    check(isinstance(contract, dict), "deterministic_generator_contract must be an object")
    if isinstance(contract, dict):
        check(contract.get("algorithm") == GENERATOR_ALGORITHM, "generator contract algorithm must be lcg-ohlcv-v1")
        check(contract.get("integer_state") == "state = (1664525 * state + 1013904223) mod 2^32", "LCG integer state contract drifted")
        check(contract.get("uniform") == "u = state / 2^32 after each state update", "LCG uniform scaling contract drifted")
        check(contract.get("segment_rule") == "Segments use inclusive from_index and to_index; the first matching segment overrides base drift, volatility, and volume multiplier.", "LCG segment inclusivity contract drifted")
        check(contract.get("time_rule") == "Timestamps begin at 2025-01-02T08:00:00Z and advance interval_minutes; generated data is always labelled simulated.", "LCG timestamp/simulation contract drifted")
        candle_steps = contract.get("candle_steps")
        check(isinstance(candle_steps, list) and len(candle_steps) == 6 and all(isinstance(step, str) and step.strip() for step in candle_steps), "LCG candle_steps must contain the six canonical operations")

    def validate_generator(config: Any, label: str, *, seed_required: bool) -> None:
        if not isinstance(config, dict):
            errors.append(f"{label} must be an object")
            return
        expected_keys = GENERATOR_KEYS | ({"seed"} if seed_required else set())
        check(set(config) == expected_keys, f"{label} must contain exactly {sorted(expected_keys)}")
        check(config.get("algorithm") == GENERATOR_ALGORITHM, f"{label}.algorithm must be lcg-ohlcv-v1")
        if seed_required:
            check(type(config.get("seed")) is int and 0 < config["seed"] < 2**32, f"{label}.seed must be a non-zero uint32")
        check(isinstance(config.get("start_price"), (int, float)) and config["start_price"] > 0, f"{label}.start_price must be positive")
        candle_count = config.get("candle_count")
        check(type(candle_count) is int and candle_count >= 24, f"{label}.candle_count must be an integer of at least 24")
        check(type(config.get("interval_minutes")) is int and config["interval_minutes"] > 0, f"{label}.interval_minutes must be positive")
        check(type(config.get("drift")) is float and abs(config["drift"]) <= 0.1, f"{label}.drift must be a decimal return float between -0.1 and 0.1")
        check(type(config.get("volatility")) is float and 0 < config["volatility"] <= 0.1, f"{label}.volatility must be a decimal return float in (0, 0.1]")
        check(isinstance(config.get("volume_base"), (int, float)) and config["volume_base"] > 0, f"{label}.volume_base must be positive")
        segments = config.get("segments")
        if not isinstance(segments, list):
            errors.append(f"{label}.segments must be an array")
            return
        previous_to = -1
        for index, segment in enumerate(segments):
            segment_label = f"{label}.segments[{index}]"
            if not isinstance(segment, dict):
                errors.append(f"{segment_label} must be an object")
                continue
            check(set(segment) == SEGMENT_KEYS, f"{segment_label} must contain exactly {sorted(SEGMENT_KEYS)}")
            start = segment.get("from_index")
            end = segment.get("to_index")
            valid_bounds = type(start) is int and type(end) is int and type(candle_count) is int and 0 <= start <= end < candle_count
            check(valid_bounds, f"{segment_label} must use inclusive in-range from_index/to_index")
            if valid_bounds:
                check(start > previous_to, f"{segment_label} overlaps or is not ordered")
                previous_to = end
            check(type(segment.get("drift")) is float and abs(segment["drift"]) <= 0.1, f"{segment_label}.drift must be a decimal return float between -0.1 and 0.1")
            check(type(segment.get("volatility")) is float and 0 < segment["volatility"] <= 0.1, f"{segment_label}.volatility must be a decimal return float in (0, 0.1]")
            check(isinstance(segment.get("volume_multiplier"), (int, float)) and segment["volume_multiplier"] > 0, f"{segment_label}.volume_multiplier must be positive")

    ordered_charts = charts if isinstance(charts, list) else []
    contiguous_orders(ordered_charts, "chart exercises")
    chart_seeds: list[int] = []
    for chart_id, chart in chart_by_id.items():
        label = f"chart exercise {chart_id}"
        check(chart.get("lesson_id") in lesson_by_id, f"{label} references a missing lesson")
        localized(chart.get("title"), f"{label}.title")
        localized(chart.get("prompt"), f"{label}.prompt")
        localized(chart.get("accessibility_summary"), f"{label}.accessibility_summary")
        solution = chart.get("solution")
        check(isinstance(solution, dict), f"{label}.solution must be an object")
        if isinstance(solution, dict):
            nonempty_string(solution.get("required_action"), f"{label}.solution.required_action")
            localized(solution.get("feedback"), f"{label}.solution.feedback")
        validate_generator(chart.get("data"), f"{label}.data", seed_required=True)
        if isinstance(chart.get("data"), dict) and type(chart["data"].get("seed")) is int:
            chart_seeds.append(chart["data"]["seed"])
    check(len(chart_seeds) == len(set(chart_seeds)), "chart exercise seeds must be unique")

    ordered_calculators = calculators if isinstance(calculators, list) else []
    contiguous_orders(ordered_calculators, "calculator exercises")
    for calculator_id, calculator in calculator_by_id.items():
        label = f"calculator exercise {calculator_id}"
        check(calculator.get("lesson_id") in lesson_by_id, f"{label} references a missing lesson")
        localized(calculator.get("title"), f"{label}.title")
        localized(calculator.get("prompt"), f"{label}.prompt")
        localized(calculator.get("worked_example"), f"{label}.worked_example")
        localized(calculator.get("interpretation"), f"{label}.interpretation")
        localized(calculator.get("common_mistake"), f"{label}.common_mistake")
        nonempty_string(calculator.get("formula"), f"{label}.formula")
        check(isinstance(calculator.get("inputs"), dict) and bool(calculator["inputs"]), f"{label}.inputs must be non-empty")
        expected = calculator.get("expected")
        check(isinstance(expected, dict), f"{label}.expected must be an object")
        if isinstance(expected, dict):
            tolerance = expected.get("tolerance")
            check(isinstance(tolerance, (int, float)) and tolerance >= 0, f"{label}.expected.tolerance must be non-negative")
            result_fields = {key: value for key, value in expected.items() if key not in {"tolerance", "unit"}}
            check(bool(result_fields) and all(isinstance(value, (int, float)) for value in result_fields.values()), f"{label}.expected must contain one or more numeric results")
            if "unit" in expected:
                nonempty_string(expected.get("unit"), f"{label}.expected.unit")

    ordered_scenarios = scenarios if isinstance(scenarios, list) else []
    contiguous_orders(ordered_scenarios, "simulation scenarios")
    scenario_seeds: list[int] = []
    for scenario_id, scenario in scenario_by_id.items():
        label = f"simulation scenario {scenario_id}"
        check(scenario.get("simulated") is True, f"{label} must be explicitly simulated")
        seed = scenario.get("seed")
        check(type(seed) is int and 0 < seed < 2**32, f"{label}.seed must be a non-zero uint32")
        if type(seed) is int:
            scenario_seeds.append(seed)
        localized(scenario.get("title"), f"{label}.title")
        localized(scenario.get("brief"), f"{label}.brief")
        generator = scenario.get("generator")
        validate_generator(generator, f"{label}.generator", seed_required=False)
        account = scenario.get("account")
        check(isinstance(account, dict) and bool(account), f"{label}.account must be configured")
        decision_points = scenario.get("decision_points")
        check(isinstance(decision_points, list) and bool(decision_points), f"{label}.decision_points must be non-empty")
        candle_count = generator.get("candle_count") if isinstance(generator, dict) else None
        if isinstance(decision_points, list):
            for index, decision in enumerate(decision_points):
                decision_label = f"{label}.decision_points[{index}]"
                check(isinstance(decision, dict), f"{decision_label} must be an object")
                if not isinstance(decision, dict):
                    continue
                candle_index = decision.get("candle_index")
                check(type(candle_index) is int and type(candle_count) is int and 0 <= candle_index < candle_count, f"{decision_label}.candle_index must be in range")
                localized(decision.get("prompt"), f"{decision_label}.prompt")
                actions = decision.get("allowed_actions")
                check(isinstance(actions, list) and bool(actions) and all(isinstance(action, str) and action.strip() for action in actions), f"{decision_label}.allowed_actions must be non-empty")
        rules = scenario.get("process_rules")
        check(isinstance(rules, list) and bool(rules), f"{label}.process_rules must be non-empty")
        if isinstance(rules, list):
            rule_ids: set[str] = set()
            weight = 0
            for index, rule in enumerate(rules):
                rule_label = f"{label}.process_rules[{index}]"
                check(isinstance(rule, dict), f"{rule_label} must be an object")
                if not isinstance(rule, dict):
                    continue
                rule_id = rule.get("id")
                check(isinstance(rule_id, str) and bool(RULE_ID_RE.fullmatch(rule_id)), f"{rule_label}.id must be a stable lowercase token")
                check(rule_id not in rule_ids, f"{label} has duplicate process rule {rule_id}")
                rule_ids.add(rule_id)
                rule_weight = rule.get("weight")
                check(type(rule_weight) is int and rule_weight > 0, f"{rule_label}.weight must be a positive integer")
                if type(rule_weight) is int:
                    weight += rule_weight
                nonempty_string(rule.get("criterion"), f"{rule_label}.criterion")
            check(weight == 100, f"{label} process rule weights must total 100")
        debrief = scenario.get("debrief")
        check(isinstance(debrief, dict), f"{label}.debrief must be an object")
        if isinstance(debrief, dict):
            localized(debrief.get("what_happened"), f"{label}.debrief.what_happened")
            localized(debrief.get("process_focus"), f"{label}.debrief.process_focus")
        references(scenario.get("related_lessons"), set(lesson_by_id), f"{label}.related_lessons")
        references(scenario.get("recommended_review_cards"), card_ids, f"{label}.recommended_review_cards")
    check(len(scenario_seeds) == len(set(scenario_seeds)), "simulation scenario seeds must be unique")
    check(not set(chart_seeds) & set(scenario_seeds), "chart and scenario seeds must not collide")

    for source_id, source in source_by_id.items():
        label = f"source {source_id}"
        nonempty_string(source.get("publisher"), f"{label}.publisher")
        nonempty_string(source.get("title"), f"{label}.title")
        url = source.get("url")
        if nonempty_string(url, f"{label}.url"):
            parsed = urlsplit(url)
            check(parsed.scheme == "https", f"{label} must use HTTPS")
            check(parsed.username is None and parsed.password is None, f"{label} URL cannot contain credentials")
            check(not parsed.fragment, f"{label} URL cannot contain a fragment")
            hostname = (parsed.hostname or "").lower()
            check(_has_allowed_domain(hostname), f"{label} domain is not an approved public authority: {hostname}")
    for lesson_id, lesson in lesson_by_id.items():
        references(lesson.get("sources"), set(source_by_id), f"lesson {lesson_id}.sources")
    used_sources = {source_id for lesson in lesson_by_id.values() for source_id in lesson.get("sources", [])}
    check(used_sources == set(source_by_id), "every source must support at least one lesson")

    counts = {
        "paths": len(path_by_id),
        "active_paths": len(active_path_ids),
        "modules": len(module_by_id),
        "lessons": len(lesson_by_id),
        "questions": len(question_by_id),
        "glossary_terms": len(term_by_id),
        "review_cards": len(card_ids),
        "chart_exercises": len(chart_by_id),
        "calculator_exercises": len(calculator_by_id),
        "simulation_scenarios": len(scenario_by_id),
    }
    minimums = manifest.get("launch_minimums")
    check(isinstance(minimums, dict), "manifest launch_minimums must be an object")
    expected_minimum_keys = {
        "paths",
        "active_paths",
        "modules_per_active_path",
        "lessons",
        "questions",
        "glossary_terms",
        "review_cards",
        "chart_exercises",
        "calculator_exercises",
        "simulation_scenarios",
    }
    if isinstance(minimums, dict):
        check(set(minimums) == expected_minimum_keys, "manifest launch minimum keys drifted")
        for key, minimum in minimums.items():
            check(type(minimum) is int and minimum > 0, f"manifest minimum {key} must be positive")
            if key == "modules_per_active_path":
                for path_id in EXPECTED_ACTIVE_PATH_IDS:
                    check(len(modules_by_path[path_id]) >= minimum, f"{path_id} misses manifest module minimum")
            elif key in counts and type(minimum) is int:
                check(counts[key] >= minimum, f"{key} count {counts[key]} is below manifest minimum {minimum}")

    if errors:
        rendered = "\n".join(f"- {message}" for message in errors)
        raise ContentValidationError(f"Academy content validation failed:\n{rendered}")
    return counts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "content" / "academy",
        help="Academy content directory (default: repository content/academy)",
    )
    args = parser.parse_args(argv)
    try:
        counts = validate_registry(args.root)
    except ContentValidationError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print("Academy content validation: PASS")
    print(json.dumps(counts, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

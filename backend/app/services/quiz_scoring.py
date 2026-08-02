from decimal import Decimal, InvalidOperation
from typing import Any


def _normalized(value: Any) -> Any:
    if isinstance(value, str):
        return " ".join(value.strip().lower().split())
    if isinstance(value, list):
        return [_normalized(item) for item in value]
    return value


def score_answer(question: dict[str, Any], answer: Any) -> bool:
    expected = question.get("answer", question.get("correct_answer"))
    if not isinstance(expected, dict):
        return False
    question_type = str(question.get("type") or "single_choice")
    if question_type in {"single_choice", "multiple_choice", "chart_based", "scenario_decision"}:
        actual = _answer_value(answer, "selected_option_ids", "correct_option_ids")
        if isinstance(actual, str):
            actual = [actual]
        expected_ids = expected.get("correct_option_ids")
        if not isinstance(actual, list) or not isinstance(expected_ids, list):
            return False
        return sorted(map(str, _normalized(actual))) == sorted(map(str, _normalized(expected_ids)))
    if question_type in {"numerical", "formula_calculation"}:
        actual = _answer_value(answer, "value")
        try:
            actual_number = Decimal(str(actual))
            expected_number = Decimal(str(expected["value"]))
            tolerance = Decimal(str(expected.get("tolerance", "0.01")))
        except (InvalidOperation, KeyError, TypeError, ValueError):
            return False
        return abs(actual_number - expected_number) <= tolerance
    if question_type == "ordering":
        actual = _answer_value(answer, "ordered_ids")
        return isinstance(actual, list) and _normalized(actual) == _normalized(
            expected.get("ordered_ids")
        )
    if question_type == "matching":
        expected_matches = expected.get("matches")
        if isinstance(expected_matches, dict):
            actual_matches = _answer_value(answer, "matches")
            return isinstance(actual_matches, dict) and {
                str(key): str(value) for key, value in actual_matches.items()
            } == {str(key): str(value) for key, value in expected_matches.items()}
        # Transitional compatibility for versioned content authored before the
        # explicit left-to-right mapping contract.
        actual = _answer_value(answer, "matched_pair_ids")
        expected_ids = expected.get("matched_pair_ids")
        return (
            isinstance(actual, list)
            and isinstance(expected_ids, list)
            and sorted(map(str, _normalized(actual))) == sorted(map(str, _normalized(expected_ids)))
        )
    if question_type == "short_reflection":
        actual = _answer_value(answer, "text", "reflection")
        if not isinstance(actual, str):
            return False
        normalized = " ".join(actual.split())
        return len(normalized) >= 20 and len(normalized.split()) >= 4
    return False


def _answer_value(answer: Any, *keys: str) -> Any:
    if isinstance(answer, dict):
        for key in keys:
            if key in answer:
                return answer[key]
    return answer


def localized(value: Any, locale: str) -> Any:
    if isinstance(value, dict) and any(key in value for key in ("de", "sl", "en")):
        return value.get(locale) or value.get("de") or value.get("en") or next(iter(value.values()))
    return value

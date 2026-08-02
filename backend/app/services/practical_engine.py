from __future__ import annotations

import hashlib
import hmac
import secrets
from collections.abc import Iterable
from typing import Any

from app.content.registry import AcademyRegistry
from app.core.config import Settings
from app.schemas.academy import DecisionAttemptIn

QUALITY_SCORES = {"strong": 78, "reasonable": 62, "weak": 38, "dangerous": 18}
STATE_EFFECT_KEYS = {
    "income": "monthly_income",
    "costs": "monthly_costs",
    "savings": "savings",
    "debt": "debt",
    "investments": "investments",
    "stress": "stress",
    "risk": "risk_exposure",
}
CLASSROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class PracticalContentError(ValueError):
    """Raised when a submitted practical-finance answer does not match canonical content."""


def hash_classroom_secret(value: str, settings: Settings, *, purpose: str) -> str:
    key = settings.classroom_code_secret.get_secret_value().encode("utf-8")
    return hmac.new(key, f"{purpose}:{value}".encode(), hashlib.sha256).hexdigest()


def new_classroom_code() -> str:
    return "".join(secrets.choice(CLASSROOM_ALPHABET) for _ in range(7))


def new_participant_token() -> str:
    return secrets.token_urlsafe(32)


def _quality_score(
    quality: Any, reasoning: str, assumptions: Iterable[Any], calculations: Any
) -> int:
    score = QUALITY_SCORES.get(str(quality), 25)
    score += min(8, len(reasoning.strip()) // 80)
    if any(str(item).strip() for item in assumptions):
        score += 5
    if isinstance(calculations, dict) and calculations:
        score += 7
    return min(100, score)


def _find_option(item: dict[str, Any], option_id: str) -> dict[str, Any]:
    option = next(
        (
            candidate
            for candidate in item.get("options", [])
            if isinstance(candidate, dict) and candidate.get("id") == option_id
        ),
        None,
    )
    if option is None:
        raise PracticalContentError("The selected option is not part of this content version.")
    return option


def _life_scenario(registry: AcademyRegistry) -> dict[str, Any]:
    scenario = registry.life_simulator.get("scenario")
    if not isinstance(scenario, dict):
        raise PracticalContentError("The Life Simulator content is unavailable.")
    return scenario


def life_profile(
    registry: AcademyRegistry, profile_id: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    scenario = _life_scenario(registry)
    profile = next(
        (
            item
            for item in scenario.get("profiles", [])
            if isinstance(item, dict) and item.get("id") == profile_id
        ),
        None,
    )
    if profile is None:
        raise PracticalContentError("Life Simulator profile not found.")
    return scenario, profile


def life_round(registry: AcademyRegistry, index: int) -> tuple[dict[str, Any], dict[str, Any]]:
    scenario = _life_scenario(registry)
    rounds = scenario.get("rounds")
    if not isinstance(rounds, list) or not 0 <= index < len(rounds):
        raise PracticalContentError("Life Simulator round not found.")
    round_item = rounds[index]
    if not isinstance(round_item, dict):
        raise PracticalContentError("Life Simulator round is invalid.")
    return scenario, round_item


def apply_life_option(
    state: dict[str, Any],
    round_item: dict[str, Any],
    option_id: str,
    reasoning: str,
    calculations: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], int]:
    option = _find_option(round_item, option_id)
    updated: dict[str, Any] = dict(state)
    for effect_key, state_key in STATE_EFFECT_KEYS.items():
        effect = (option.get("effects") or {}).get(effect_key, 0)
        if not isinstance(effect, (int, float)):
            raise PracticalContentError("Life Simulator effects must be numeric.")
        current = updated.get(state_key, 0)
        if not isinstance(current, (int, float)):
            raise PracticalContentError("Life Simulator state must be numeric.")
        updated[state_key] = round(float(current) + float(effect), 2)
    updated["savings"] = max(0, updated.get("savings", 0))
    updated["debt"] = max(0, updated.get("debt", 0))
    updated["stress"] = min(100, max(0, updated.get("stress", 0)))
    updated["risk_exposure"] = min(100, max(0, updated.get("risk_exposure", 0)))
    score = _quality_score(option.get("quality"), reasoning, [], calculations)
    feedback = {
        "quality": option.get("quality"),
        "message": option.get("feedback"),
        "next_action": option.get("next_action"),
        "competences": round_item.get("competences", []),
    }
    return updated, feedback, score


def evaluate_attempt(
    registry: AcademyRegistry, request: DecisionAttemptIn
) -> tuple[int, dict[str, Any], list[str]]:
    if request.activity_type == "decision_lab":
        item = registry.decision_case_by_id(request.activity_id)
        if item is None:
            raise PracticalContentError("Decision Lab case not found.")
        if str(item.get("version")) != request.content_version:
            raise PracticalContentError("Decision Lab content version does not match.")
        option = _find_option(item, request.selected_option_id)
        score = _quality_score(
            option.get("quality"), request.reasoning, request.assumptions, request.calculations
        )
        return (
            score,
            {
                "quality": option.get("quality"),
                "message": option.get("feedback"),
                "reflection": item.get("reflection"),
                "missing_information": item.get("missing_information", []),
                "next_action": item.get("next_action"),
            },
            [str(value) for value in item.get("objectives", [])],
        )

    if request.activity_type == "scam_detector":
        item = registry.scam_scenario_by_id(request.activity_id)
        if item is None:
            raise PracticalContentError("Scam Detector scenario not found.")
        if str(item.get("version")) != request.content_version:
            raise PracticalContentError("Scam Detector content version does not match.")
        selected = request.response.get("selected_signal_ids", [])
        if not isinstance(selected, list) or not all(isinstance(value, str) for value in selected):
            raise PracticalContentError("selected_signal_ids must be an array of signal IDs.")
        available = {
            str(signal.get("id")): bool(signal.get("red_flag"))
            for signal in item.get("signals", [])
            if isinstance(signal, dict)
        }
        if not set(selected) <= set(available):
            raise PracticalContentError("A selected scam signal is not part of this version.")
        expected = {signal_id for signal_id, red_flag in available.items() if red_flag}
        selected_set = set(selected)
        true_positive = len(selected_set & expected)
        precision = true_positive / len(selected_set) if selected_set else 0
        recall = true_positive / len(expected) if expected else 1
        classification = round(70 * ((precision + recall) / 2))
        safe_action_bonus = 15 if request.selected_option_id == "pause-and-verify" else 0
        reasoning_bonus = min(10, len(request.reasoning.strip()) // 80)
        assumptions_bonus = 5 if request.assumptions else 0
        score = min(100, classification + safe_action_bonus + reasoning_bonus + assumptions_bonus)
        return (
            score,
            {
                "risk_level": item.get("risk_level"),
                "correct_signal_ids": sorted(expected),
                "missed_signal_ids": sorted(expected - selected_set),
                "incorrect_signal_ids": sorted(selected_set - expected),
                "safe_action": item.get("safe_action"),
                "verification_checks": item.get("verification_checks", []),
                "next_action": item.get("next_action"),
            },
            [str(value) for value in item.get("competences", [])],
        )

    if request.activity_type == "life_simulator":
        scenario = _life_scenario(registry)
        if str(scenario.get("version")) != request.content_version:
            raise PracticalContentError("Life Simulator content version does not match.")
        round_item = next(
            (
                item
                for item in scenario.get("rounds", [])
                if isinstance(item, dict) and item.get("id") == request.activity_id
            ),
            None,
        )
        if round_item is None:
            raise PracticalContentError("Life Simulator round not found.")
        option = _find_option(round_item, request.selected_option_id)
        score = _quality_score(
            option.get("quality"), request.reasoning, request.assumptions, request.calculations
        )
        return (
            score,
            {
                "quality": option.get("quality"),
                "message": option.get("feedback"),
                "next_action": option.get("next_action"),
            },
            [str(value) for value in round_item.get("competences", [])],
        )

    raise PracticalContentError("Unsupported activity type.")


def evaluate_classroom_response(
    registry: AcademyRegistry,
    item_id: str,
    answer: dict[str, Any],
    reasoning: str,
) -> tuple[int, list[str]]:
    selected_option = answer.get("selected_option_id")
    selected_option_id = selected_option if isinstance(selected_option, str) else ""
    case = registry.decision_case_by_id(item_id)
    if case is not None:
        option = _find_option(case, selected_option_id)
        score = _quality_score(option.get("quality"), reasoning, [], answer.get("calculations"))
        misconceptions = (
            [selected_option_id] if option.get("quality") in {"weak", "dangerous"} else []
        )
        return score, misconceptions
    scam = registry.scam_scenario_by_id(item_id)
    if scam is not None:
        request = DecisionAttemptIn(
            activity_type="scam_detector",
            activity_id=item_id,
            content_version=str(scam.get("version")),
            selected_option_id=selected_option_id,
            reasoning=reasoning,
            response=answer,
        )
        score, feedback, _ = evaluate_attempt(registry, request)
        return score, [str(value) for value in feedback.get("missed_signal_ids", [])]
    scenario = _life_scenario(registry)
    round_item = next(
        (
            item
            for item in scenario.get("rounds", [])
            if isinstance(item, dict) and item.get("id") == item_id
        ),
        None,
    )
    if round_item is not None:
        option = _find_option(round_item, selected_option_id)
        score = _quality_score(option.get("quality"), reasoning, [], answer.get("calculations"))
        return score, [selected_option_id] if option.get("quality") in {"weak", "dangerous"} else []
    # Teacher-authored activity prompts can be open-ended. Reward an explained
    # process, never an outcome, while keeping the score deliberately provisional.
    score = min(70, 25 + len(reasoning.strip()) // 12)
    return score, []

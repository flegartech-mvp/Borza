from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import Settings
from app.schemas.academy import MentorRequest, MentorResponse

GUIDED_QUESTIONS = {
    "de": {
        "question": "Welche Annahme trägt deine Entscheidung am stärksten, und wie könntest du sie unabhängig prüfen?",
        "prompts": [
            "Welche Zahl oder Information fehlt dir?",
            "Was ist der tragbare Verlust, wenn du falsch liegst?",
            "Welche reversible Alternative kannst du zuerst testen?",
        ],
        "note": "Geführter Lernmodus: keine Modellantwort und keine individuelle Finanzberatung.",
    },
    "sl": {
        "question": "Katera predpostavka najbolj vpliva na tvojo odločitev in kako jo lahko neodvisno preveriš?",
        "prompts": [
            "Kateri podatek ali informacija ti manjka?",
            "Kolikšna izguba je zate vzdržna, če se motiš?",
            "Katero povratno možnost lahko najprej preizkusiš?",
        ],
        "note": "Vodeni učni način: brez odgovora modela in brez osebnega finančnega svetovanja.",
    },
    "en": {
        "question": "Which assumption carries the most weight in your decision, and how could you verify it independently?",
        "prompts": [
            "Which number or piece of information is missing?",
            "What loss remains affordable if you are wrong?",
            "Which reversible alternative could you test first?",
        ],
        "note": "Guided learning mode: no model response and no personal financial advice.",
    },
}


def guided_mentor(request: MentorRequest, *, unavailable: bool = False) -> MentorResponse:
    content = GUIDED_QUESTIONS[request.locale]
    note = str(content["note"])
    if unavailable:
        suffix = {
            "de": " Der optionale Modellanbieter ist vorübergehend nicht verfügbar.",
            "sl": " Izbirni ponudnik modela trenutno ni na voljo.",
            "en": " The optional model provider is temporarily unavailable.",
        }[request.locale]
        note += suffix
    return MentorResponse(
        mode="guided_fallback",
        question=str(content["question"]),
        follow_up_prompts=[str(value) for value in content["prompts"]],
        safety_note=note,
        referenced_content_ids=[request.context_id],
    )


def _response_text(payload: dict[str, Any]) -> str:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct:
        return direct
    for output in payload.get("output", []):
        if not isinstance(output, dict) or output.get("type") != "message":
            continue
        for content in output.get("content", []):
            if isinstance(content, dict) and content.get("type") == "output_text":
                text = content.get("text")
                if isinstance(text, str) and text:
                    return text
    raise ValueError("The mentor provider returned no text output.")


def ai_mentor(
    request: MentorRequest,
    settings: Settings,
    *,
    safety_identifier: str,
) -> MentorResponse:
    if not settings.mentor_enabled or settings.openai_api_key is None:
        return guided_mentor(request)
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "question": {"type": "string", "minLength": 10, "maxLength": 700},
            "follow_up_prompts": {
                "type": "array",
                "minItems": 2,
                "maxItems": 4,
                "items": {"type": "string", "minLength": 5, "maxLength": 300},
            },
            "safety_note": {"type": "string", "minLength": 10, "maxLength": 500},
            "referenced_content_ids": {
                "type": "array",
                "minItems": 1,
                "maxItems": 5,
                "items": {"type": "string", "minLength": 1, "maxLength": 120},
            },
        },
        "required": [
            "question",
            "follow_up_prompts",
            "safety_note",
            "referenced_content_ids",
        ],
    }
    system_prompt = (
        "You are the Borza Academy Socratic finance-learning mentor. Ask one concise "
        "question that helps the learner inspect assumptions, calculations, alternatives, "
        "risk capacity, or independent evidence. Do not make the decision for them. Do not "
        "give personalised financial, investment, tax, legal, credit, or trading advice. "
        "Do not predict prices, promise returns, rank products, transmit orders, or ask for "
        "account credentials, exact balances, identity numbers, or other sensitive data. "
        "Refer only to the supplied Academy context ID. State that this is educational. "
        f"Answer in locale {request.locale}."
    )
    user_context = json.dumps(
        {
            "context_type": request.context_type,
            "context_id": request.context_id,
            "learner_message": request.learner_message,
            "decision_summary": request.decision_summary,
        },
        ensure_ascii=False,
    )
    try:
        response = httpx.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key.get_secret_value()}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.openai_model,
                "instructions": system_prompt,
                "input": user_context,
                "reasoning": {"effort": "low"},
                "text": {
                    "verbosity": "low",
                    "format": {
                        "type": "json_schema",
                        "name": "socratic_mentor_response",
                        "strict": True,
                        "schema": schema,
                    },
                },
                "max_output_tokens": 500,
                "store": False,
                "safety_identifier": safety_identifier,
            },
            timeout=settings.openai_timeout_seconds,
            follow_redirects=False,
        )
        response.raise_for_status()
        parsed = json.loads(_response_text(response.json()))
        return MentorResponse(mode="ai", **parsed)
    except (httpx.HTTPError, json.JSONDecodeError, TypeError, ValueError):
        return guided_mentor(request, unavailable=True)

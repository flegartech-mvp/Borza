from __future__ import annotations

import csv
import io
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from statistics import mean
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.api.routes.catalog import registry_or_503
from app.core.config import Settings, get_settings
from app.database import get_db
from app.models.academy import (
    ClassroomParticipant,
    ClassroomResponse,
    ClassroomSession,
    CompetenceEvidence,
    DecisionAttempt,
    LifeSimulationSession,
    PartnershipInterest,
    User,
)
from app.schemas.academy import (
    ClassroomCreate,
    ClassroomCreated,
    ClassroomDashboard,
    ClassroomJoin,
    ClassroomJoined,
    ClassroomResponseIn,
    ClassroomSessionRead,
    CompetenceProfileItem,
    DecisionAttemptIn,
    DecisionAttemptRead,
    LifeSessionCreate,
    LifeSessionRead,
    LifeSessionUpdate,
    MentorRequest,
    MentorResponse,
    PartnershipInterestAccepted,
    PartnershipInterestIn,
)
from app.services.mentor import ai_mentor
from app.services.practical_engine import (
    PracticalContentError,
    apply_life_option,
    evaluate_attempt,
    evaluate_classroom_response,
    hash_classroom_secret,
    life_profile,
    life_round,
    new_classroom_code,
    new_participant_token,
)

router = APIRouter(prefix="/api/v1", tags=["practical finance"])


def _content_error(exc: PracticalContentError) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))


def _is_expired(value: datetime) -> bool:
    candidate = value if value.tzinfo else value.replace(tzinfo=UTC)
    return candidate <= datetime.now(UTC)


@router.get("/practical-content")
def practical_content() -> dict[str, Any]:
    registry = registry_or_503()
    return {
        "schema_version": registry.schema_version,
        "locales": registry.locales,
        "life_simulator": registry.life_simulator,
        "scam_scenarios": list(registry.scam_scenarios),
        "decision_cases": list(registry.decision_cases),
        "competences": list(registry.competences),
        "classroom_activities": list(registry.classroom_activities),
        "disclaimer": {
            "de": "Bildungsinhalte und Simulationen, keine individuelle Finanzberatung.",
            "sl": "Izobraževalne vsebine in simulacije, ne osebno finančno svetovanje.",
            "en": "Educational content and simulations, not personal financial advice.",
        },
    }


@router.post(
    "/practical/attempts",
    response_model=DecisionAttemptRead,
    status_code=status.HTTP_201_CREATED,
)
def create_attempt(
    request: DecisionAttemptIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DecisionAttempt:
    registry = registry_or_503()
    try:
        score, feedback, competence_ids = evaluate_attempt(registry, request)
    except PracticalContentError as exc:
        raise _content_error(exc) from exc
    now = datetime.now(UTC)
    attempt = DecisionAttempt(
        user_id=user.id,
        activity_type=request.activity_type,
        activity_id=request.activity_id,
        content_version=request.content_version,
        status="completed",
        selected_option_id=request.selected_option_id,
        reasoning=request.reasoning,
        assumptions=request.assumptions,
        calculations=request.calculations,
        feedback=feedback,
        process_score=score,
        completed_at=now,
    )
    db.add(attempt)
    db.flush()
    for competence_id in competence_ids:
        if registry.competence_by_id(competence_id) is None:
            continue
        db.add(
            CompetenceEvidence(
                user_id=user.id,
                competence_id=competence_id,
                source_type=request.activity_type,
                source_id=str(attempt.id),
                content_version=request.content_version,
                score=score,
                summary=f"Server-scored {request.activity_type.replace('_', ' ')} evidence",
                details={"activity_id": request.activity_id, "feedback": feedback},
            )
        )
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/practical/attempts", response_model=list[DecisionAttemptRead])
def list_attempts(
    activity_type: str | None = Query(default=None, max_length=32),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DecisionAttempt]:
    statement = select(DecisionAttempt).where(DecisionAttempt.user_id == user.id)
    if activity_type:
        statement = statement.where(DecisionAttempt.activity_type == activity_type)
    return list(db.scalars(statement.order_by(DecisionAttempt.started_at.desc())).all())


def _competence_level(score: int, evidence_count: int) -> str:
    if evidence_count == 0:
        return "not_started"
    if evidence_count == 1 or score < 45:
        return "introduced"
    if evidence_count < 3 or score < 65:
        return "practising"
    if evidence_count < 5 or score < 82:
        return "demonstrated"
    return "strong"


@router.get("/practical/passport", response_model=list[CompetenceProfileItem])
def competence_passport(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict[str, Any]]:
    registry = registry_or_503()
    evidence = list(
        db.scalars(
            select(CompetenceEvidence)
            .where(CompetenceEvidence.user_id == user.id)
            .order_by(CompetenceEvidence.created_at.desc())
        ).all()
    )
    grouped: dict[str, list[CompetenceEvidence]] = defaultdict(list)
    for item in evidence:
        grouped[item.competence_id].append(item)
    result: list[dict[str, Any]] = []
    for definition in registry.competences:
        competence_id = str(definition.get("id"))
        items = grouped.get(competence_id, [])
        score = round(mean(item.score for item in items[:10])) if items else 0
        result.append(
            {
                "competence_id": competence_id,
                "level": _competence_level(score, len(items)),
                "score": score,
                "evidence_count": len(items),
                "recent_evidence": items[:3],
            }
        )
    return result


@router.post(
    "/practical/life-sessions",
    response_model=LifeSessionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_life_session(
    request: LifeSessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LifeSimulationSession:
    registry = registry_or_503()
    try:
        scenario, profile = life_profile(registry, request.profile_id)
    except PracticalContentError as exc:
        raise _content_error(exc) from exc
    session = LifeSimulationSession(
        user_id=user.id,
        profile_id=request.profile_id,
        scenario_id=str(scenario.get("id")),
        scenario_version=str(scenario.get("version")),
        financial_state=dict(profile.get("state") or {}),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/practical/life-sessions", response_model=list[LifeSessionRead])
def list_life_sessions(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[LifeSimulationSession]:
    return list(
        db.scalars(
            select(LifeSimulationSession)
            .where(LifeSimulationSession.user_id == user.id)
            .order_by(LifeSimulationSession.updated_at.desc())
        ).all()
    )


@router.put("/practical/life-sessions/{session_id}", response_model=LifeSessionRead)
def update_life_session(
    session_id: UUID,
    request: LifeSessionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LifeSimulationSession:
    session = db.scalar(
        select(LifeSimulationSession).where(
            LifeSimulationSession.id == session_id,
            LifeSimulationSession.user_id == user.id,
        )
    )
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Life Simulator session not found.")
    if session.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "Life Simulator session is not active.")
    if session.current_round != request.expected_round:
        raise HTTPException(status.HTTP_409_CONFLICT, "Life Simulator round has changed.")
    registry = registry_or_503()
    try:
        scenario, round_item = life_round(registry, session.current_round)
        if (
            str(scenario.get("id")) != session.scenario_id
            or str(scenario.get("version")) != session.scenario_version
        ):
            raise PracticalContentError("This session uses a content version that is unavailable.")
        updated_state, feedback, score = apply_life_option(
            session.financial_state,
            round_item,
            request.selected_option_id,
            request.reasoning,
            request.calculations,
        )
    except PracticalContentError as exc:
        raise _content_error(exc) from exc
    history = list(session.decision_history)
    history.append(
        {
            "round_id": round_item.get("id"),
            "selected_option_id": request.selected_option_id,
            "reasoning": request.reasoning,
            "calculations": request.calculations,
            "feedback": feedback,
            "process_score": score,
        }
    )
    session.financial_state = updated_state
    session.decision_history = history
    session.current_round += 1
    session.process_score = round(mean(int(item["process_score"]) for item in history))
    rounds = scenario.get("rounds", [])
    if session.current_round >= len(rounds):
        session.status = "completed"
        session.completed_at = datetime.now(UTC)
    for competence_id in round_item.get("competences", []):
        db.add(
            CompetenceEvidence(
                user_id=user.id,
                competence_id=str(competence_id),
                source_type="life_simulator",
                source_id=f"{session.id}:{round_item.get('id')}",
                content_version=session.scenario_version,
                score=score,
                summary="Server-scored Life Simulator decision",
                details={"round_id": round_item.get("id"), "feedback": feedback},
            )
        )
    db.commit()
    db.refresh(session)
    return session


def _teacher_session(db: Session, session_id: UUID, user_id: UUID) -> ClassroomSession:
    classroom = db.scalar(
        select(ClassroomSession).where(
            ClassroomSession.id == session_id,
            ClassroomSession.teacher_user_id == user_id,
        )
    )
    if classroom is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Classroom session not found.")
    return classroom


@router.post(
    "/teacher/classrooms",
    response_model=ClassroomCreated,
    status_code=status.HTTP_201_CREATED,
)
def create_classroom(
    request: ClassroomCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    registry = registry_or_503()
    activity = registry.classroom_activity_by_id(request.activity_id)
    if activity is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Classroom activity not found.")
    if str(activity.get("version")) != request.content_version:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Classroom content version does not match."
        )
    code = new_classroom_code()
    classroom = ClassroomSession(
        teacher_user_id=user.id,
        code_hash=hash_classroom_secret(code, settings, purpose="classroom-code"),
        activity_type=request.activity_type,
        activity_id=request.activity_id,
        content_version=request.content_version,
        duration_minutes=request.duration_minutes,
        status="active",
        settings=request.settings,
        expires_at=datetime.now(UTC) + timedelta(hours=4),
        started_at=datetime.now(UTC),
    )
    db.add(classroom)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Please create a new classroom code."
        ) from exc
    db.refresh(classroom)
    return {**ClassroomSessionRead.model_validate(classroom).model_dump(), "classroom_code": code}


@router.get("/teacher/classrooms", response_model=list[ClassroomSessionRead])
def list_classrooms(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ClassroomSession]:
    return list(
        db.scalars(
            select(ClassroomSession)
            .where(ClassroomSession.teacher_user_id == user.id)
            .order_by(ClassroomSession.created_at.desc())
        ).all()
    )


@router.post("/teacher/classrooms/{session_id}/close", response_model=ClassroomSessionRead)
def close_classroom(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClassroomSession:
    classroom = _teacher_session(db, session_id, user.id)
    classroom.status = "closed"
    classroom.closed_at = datetime.now(UTC)
    db.commit()
    db.refresh(classroom)
    return classroom


def _classroom_dashboard(db: Session, classroom: ClassroomSession) -> dict[str, Any]:
    participants = list(
        db.scalars(
            select(ClassroomParticipant).where(
                ClassroomParticipant.classroom_session_id == classroom.id
            )
        ).all()
    )
    responses = list(
        db.scalars(
            select(ClassroomResponse).where(ClassroomResponse.classroom_session_id == classroom.id)
        ).all()
    )
    decisions: Counter[str] = Counter()
    misconceptions: Counter[str] = Counter()
    for response in responses:
        selected = response.answer.get("selected_option_id")
        if isinstance(selected, str):
            decisions[selected] += 1
        misconceptions.update(str(value) for value in response.misconceptions)
    active = sum(item.status == "active" for item in participants)
    completed = sum(item.status == "completed" for item in participants)
    total = len(participants)
    return {
        "session": classroom,
        "active_participants": active,
        "completed_participants": completed,
        "completion_rate": round(100 * completed / total) if total else 0,
        "response_count": len(responses),
        "class_process_score": round(mean(item.process_score for item in responses))
        if responses
        else 0,
        "decision_distribution": dict(decisions),
        "common_misconceptions": [
            {"name": name, "count": count} for name, count in misconceptions.most_common(5)
        ],
        "concepts_requiring_review": [name for name, _ in misconceptions.most_common(3)],
    }


@router.get("/teacher/classrooms/{session_id}/dashboard", response_model=ClassroomDashboard)
def classroom_dashboard(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return _classroom_dashboard(db, _teacher_session(db, session_id, user.id))


@router.get("/teacher/classrooms/{session_id}/report.csv")
def classroom_report(
    session_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    dashboard = _classroom_dashboard(db, _teacher_session(db, session_id, user.id))
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["metric", "value"])
    for key in (
        "active_participants",
        "completed_participants",
        "completion_rate",
        "response_count",
        "class_process_score",
    ):
        writer.writerow([key, dashboard[key]])
    for option_id, count in dashboard["decision_distribution"].items():
        writer.writerow([f"decision:{option_id}", count])
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="classroom-{session_id}.csv"'},
    )


@router.post("/classrooms/join", response_model=ClassroomJoined)
def join_classroom(
    request: ClassroomJoin,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    normalized_code = request.classroom_code.replace("-", "").upper()
    code_hash = hash_classroom_secret(normalized_code, settings, purpose="classroom-code")
    classroom = db.scalar(select(ClassroomSession).where(ClassroomSession.code_hash == code_hash))
    if classroom is None or classroom.status != "active" or _is_expired(classroom.expires_at):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Active classroom not found.")
    token = new_participant_token()
    participant = ClassroomParticipant(
        classroom_session_id=classroom.id,
        pseudonym=request.pseudonym.strip(),
        access_token_hash=hash_classroom_secret(token, settings, purpose="participant-token"),
    )
    db.add(participant)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This pseudonym is already in use in the classroom."
        ) from exc
    db.refresh(participant)
    return {
        "session_id": classroom.id,
        "participant_id": participant.id,
        "participant_token": token,
        "activity_type": classroom.activity_type,
        "activity_id": classroom.activity_id,
        "content_version": classroom.content_version,
        "expires_at": classroom.expires_at,
    }


@router.post(
    "/classrooms/{session_id}/responses",
    status_code=status.HTTP_201_CREATED,
)
def submit_classroom_response(
    session_id: UUID,
    request: ClassroomResponseIn,
    participant_token: str = Header(alias="X-Classroom-Token", min_length=32, max_length=200),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    token_hash = hash_classroom_secret(participant_token, settings, purpose="participant-token")
    participant = db.scalar(
        select(ClassroomParticipant).where(
            ClassroomParticipant.classroom_session_id == session_id,
            ClassroomParticipant.access_token_hash == token_hash,
            ClassroomParticipant.status == "active",
        )
    )
    classroom = db.get(ClassroomSession, session_id)
    if (
        participant is None
        or classroom is None
        or classroom.status != "active"
        or _is_expired(classroom.expires_at)
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Active classroom participant not found.")
    try:
        score, misconceptions = evaluate_classroom_response(
            registry_or_503(), request.item_id, request.answer, request.reasoning
        )
    except PracticalContentError as exc:
        raise _content_error(exc) from exc
    response = ClassroomResponse(
        classroom_session_id=session_id,
        participant_id=participant.id,
        item_id=request.item_id,
        answer=request.answer,
        reasoning=request.reasoning,
        process_score=score,
        misconceptions=misconceptions,
    )
    db.add(response)
    if request.completed:
        participant.status = "completed"
        participant.completed_at = datetime.now(UTC)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This classroom item was already answered."
        ) from exc
    return {"accepted": True, "process_score": score}


@router.post(
    "/partnership-interests",
    response_model=PartnershipInterestAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def partnership_interest(
    request: PartnershipInterestIn,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    interest = PartnershipInterest(
        kind=request.kind,
        organisation=request.organisation.strip(),
        contact_role=request.contact_role.strip(),
        contact_email=request.contact_email,
        message=request.message.strip(),
        consent=request.consent,
        expires_at=datetime.now(UTC) + timedelta(days=settings.partnership_retention_days),
    )
    db.add(interest)
    db.commit()
    db.refresh(interest)
    return {
        "id": interest.id,
        "retention_days": settings.partnership_retention_days,
        "status": "accepted",
    }


@router.post("/practical/mentor", response_model=MentorResponse)
def practical_mentor(
    request: MentorRequest,
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> MentorResponse:
    safety_identifier = hash_classroom_secret(
        str(user.id), settings, purpose="openai-safety-identifier"
    )
    return ai_mentor(request, settings, safety_identifier=safety_identifier)

from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.academy import (
    ActivityEvent,
    StudyStreak,
    UserAchievement,
    UserSkillMastery,
)


def record_learning_activity(
    db: Session,
    user_id: UUID,
    *,
    event_type: str,
    entity_id: str | None,
    idempotency_key: str,
    payload: dict | None = None,
) -> bool:
    """Record one durable event and update streak/earned milestones once."""

    existing = db.scalar(
        select(ActivityEvent.id).where(
            ActivityEvent.user_id == user_id,
            ActivityEvent.idempotency_key == idempotency_key,
        )
    )
    if existing is not None:
        return False
    now = datetime.now(UTC)
    db.add(
        ActivityEvent(
            user_id=user_id,
            event_type=event_type,
            entity_id=entity_id,
            idempotency_key=idempotency_key,
            payload=payload or {},
            occurred_at=now,
        )
    )
    streak = db.get(StudyStreak, user_id)
    if streak is None:
        streak = StudyStreak(user_id=user_id, current_days=1, longest_days=1)
        db.add(streak)
    today = now.date()
    previous = date.fromisoformat(streak.last_activity_date) if streak.last_activity_date else None
    if previous != today:
        streak.current_days = (
            streak.current_days + 1 if previous == today - timedelta(days=1) else 1
        )
        streak.longest_days = max(streak.longest_days, streak.current_days)
        streak.last_activity_date = today.isoformat()

    achievement = {
        "lesson_completed": "first-lesson",
        "flashcard_reviewed": "first-review",
        "journal_created": "first-journal",
    }.get(event_type)
    if achievement is not None:
        _award_once(db, user_id, achievement)
    if streak.current_days >= 7:
        _award_once(db, user_id, "seven-day-streak")
    return True


def _award_once(db: Session, user_id: UUID, achievement_id: str) -> None:
    existing = db.scalar(
        select(UserAchievement.id).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == achievement_id,
        )
    )
    if existing is None:
        db.add(
            UserAchievement(
                user_id=user_id,
                achievement_id=achievement_id,
                progress=100,
            )
        )


def record_mastery_evidence(
    db: Session,
    user_id: UUID,
    skill_ids: set[str],
    *,
    evidence: str,
    score_percent: int | None = None,
    recalled: bool | None = None,
) -> None:
    """Update explainable mastery from repeated lesson, quiz, and recall evidence."""

    for skill_id in sorted(skill_ids):
        mastery = db.scalar(
            select(UserSkillMastery).where(
                UserSkillMastery.user_id == user_id,
                UserSkillMastery.skill_id == skill_id,
            )
        )
        if mastery is None:
            mastery = UserSkillMastery(user_id=user_id, skill_id=skill_id)
            db.add(mastery)
            db.flush()
        current = mastery.mastery_score
        needs_review = False
        if evidence == "lesson_completed":
            updated = max(current, 20)
        elif evidence == "quiz":
            score = score_percent or 0
            delta = 25 if score >= 80 else 12 if score >= 60 else -10
            updated = current + delta
        elif evidence == "review":
            if recalled is False:
                updated = current - 15
                needs_review = True
            else:
                updated = current + 10
        else:
            raise ValueError(f"Unsupported mastery evidence: {evidence}")
        mastery.mastery_score = max(0, min(100, updated))
        mastery.evidence_count += 1
        mastery.last_evidence_at = datetime.now(UTC)
        if needs_review:
            mastery.state = "needs_review"
        elif mastery.mastery_score >= 85 and mastery.evidence_count >= 3:
            mastery.state = "mastered"
        elif mastery.mastery_score >= 65:
            mastery.state = "proficient"
        elif mastery.mastery_score >= 35:
            mastery.state = "practising"
        else:
            mastery.state = "introduced"

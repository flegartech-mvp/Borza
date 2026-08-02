from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.api.routes.catalog import registry_or_503
from app.database import get_db
from app.models.academy import FlashcardReview, ReviewSchedule, User
from app.schemas.academy import ReviewGradeIn, ReviewGradeResult, ReviewQueueItem
from app.services.learning_state import record_learning_activity, record_mastery_evidence

router = APIRouter(prefix="/api/v1/review", tags=["review"])
RATINGS = {"again": 1, "hard": 2, "good": 3, "easy": 4}


def _ensure_schedules(db: Session, user: User) -> None:
    registry = registry_or_503()
    existing = set(
        db.scalars(select(ReviewSchedule.card_id).where(ReviewSchedule.user_id == user.id))
    )
    now = datetime.now(UTC)
    for card in registry.review_cards:
        card_id = str(card.get("id"))
        if card_id not in existing:
            db.add(
                ReviewSchedule(
                    user_id=user.id,
                    card_id=card_id,
                    due_at=now,
                    stability=Decimal(0),
                    difficulty=Decimal(5),
                    state="new",
                )
            )
    db.commit()


@router.get("/queue", response_model=list[ReviewQueueItem])
def review_queue(
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReviewQueueItem]:
    _ensure_schedules(db, user)
    now = datetime.now(UTC)
    schedules = list(
        db.scalars(
            select(ReviewSchedule)
            .where(ReviewSchedule.user_id == user.id, ReviewSchedule.due_at <= now)
            .order_by(ReviewSchedule.due_at, ReviewSchedule.id)
            .limit(limit)
        )
    )
    registry = registry_or_503()
    result: list[ReviewQueueItem] = []
    for schedule in schedules:
        card = registry.review_card_by_id(schedule.card_id)
        if card is not None:
            result.append(
                ReviewQueueItem.model_validate(
                    {
                        "card": card,
                        "schedule": {
                            "id": schedule.id,
                            "due_at": schedule.due_at,
                            "stability": schedule.stability,
                            "difficulty": schedule.difficulty,
                            "state": schedule.state,
                            "reps": schedule.review_count,
                            "lapses": schedule.lapse_count,
                            "last_review": schedule.last_reviewed_at,
                        },
                    }
                )
            )
    return result


@router.post("/{card_id}/grade", response_model=ReviewGradeResult, include_in_schema=False)
@router.post("/cards/{card_id}", response_model=ReviewGradeResult)
def grade_review(
    card_id: str,
    request: ReviewGradeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReviewGradeResult:
    schedule = db.scalar(
        select(ReviewSchedule).where(
            ReviewSchedule.user_id == user.id, ReviewSchedule.card_id == card_id
        )
    )
    if schedule is None or registry_or_503().review_card_by_id(card_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review card not found.")
    now = datetime.now(UTC)
    last_review = request.last_review.astimezone(UTC)
    due_at = request.due_at.astimezone(UTC)
    if abs((last_review - now).total_seconds()) > 600:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "last_review must represent the current review event.",
        )
    if due_at < last_review or due_at > last_review + timedelta(days=36500):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "due_at is outside safe bounds.")
    if request.reps != schedule.review_count + 1:
        raise HTTPException(status.HTTP_409_CONFLICT, "Review repetition counter changed.")
    expected_lapses = schedule.lapse_count + (1 if request.rating == "again" else 0)
    if request.lapses != expected_lapses:
        raise HTTPException(status.HTTP_409_CONFLICT, "Review lapse counter is inconsistent.")
    previous = {
        "due_at": schedule.due_at.isoformat(),
        "stability": str(schedule.stability),
        "difficulty": str(schedule.difficulty),
        "state": schedule.state,
        "reps": schedule.review_count,
        "lapses": schedule.lapse_count,
        "last_review": schedule.last_reviewed_at.isoformat() if schedule.last_reviewed_at else None,
    }
    schedule.due_at = due_at
    schedule.stability = request.stability
    schedule.difficulty = request.difficulty
    schedule.state = request.state
    schedule.review_count = request.reps
    schedule.lapse_count = request.lapses
    schedule.last_reviewed_at = last_review
    next_state = {
        "due_at": due_at.isoformat(),
        "stability": str(request.stability),
        "difficulty": str(request.difficulty),
        "state": request.state,
        "reps": request.reps,
        "lapses": request.lapses,
        "last_review": last_review.isoformat(),
    }
    review = FlashcardReview(
        schedule_id=schedule.id,
        user_id=user.id,
        rating=RATINGS[request.rating],
        previous_state=previous,
        next_state=next_state,
        reviewed_at=last_review,
    )
    db.add(review)
    lesson_ids = {
        str(lesson.get("id"))
        for lesson in registry_or_503().lessons
        if card_id in (lesson.get("review_cards") or [])
    }
    record_mastery_evidence(
        db,
        user.id,
        lesson_ids or {card_id},
        evidence="review",
        recalled=request.rating != "again",
    )
    record_learning_activity(
        db,
        user.id,
        event_type="flashcard_reviewed",
        entity_id=card_id,
        idempotency_key=f"flashcard_review:{review.id}",
        payload={"rating": request.rating},
    )
    db.commit()
    return ReviewGradeResult(
        card_id=card_id,
        rating=request.rating,
        due_at=schedule.due_at,
        stability=schedule.stability,
        difficulty=schedule.difficulty,
        state=schedule.state,
        review_count=schedule.review_count,
        lapse_count=schedule.lapse_count,
    )

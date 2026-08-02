from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.api.routes.catalog import registry_or_503
from app.database import get_db
from app.models.academy import (
    LessonBookmark,
    LessonNote,
    LessonProgress,
    Profile,
    QuestionResponse,
    QuizAttempt,
    User,
)
from app.schemas.academy import (
    BookmarkRead,
    NoteRead,
    NoteWrite,
    ProgressRead,
    ProgressUpdate,
    QuestionFeedback,
    QuizRead,
    QuizResult,
    QuizSubmission,
)
from app.services.learning_state import record_learning_activity, record_mastery_evidence
from app.services.quiz_scoring import localized, score_answer

router = APIRouter(prefix="/api/v1", tags=["learning"])


def _require_lesson(lesson_id: str):
    lesson = registry_or_503().lesson_by_id(lesson_id)
    if lesson is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson not found.")
    return lesson


@router.get("/progress", response_model=list[ProgressRead])
def list_progress(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[LessonProgress]:
    return list(
        db.scalars(
            select(LessonProgress)
            .where(LessonProgress.user_id == user.id)
            .order_by(desc(LessonProgress.updated_at))
        )
    )


@router.put("/progress/lessons/{lesson_id}", response_model=ProgressRead, include_in_schema=False)
@router.put("/lessons/{lesson_id}/progress", response_model=ProgressRead)
def update_progress(
    lesson_id: str,
    request: ProgressUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LessonProgress:
    _require_lesson(lesson_id)
    progress = db.scalar(
        select(LessonProgress).where(
            LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id
        )
    )
    current = datetime.now(UTC)
    if progress is None:
        progress = LessonProgress(user_id=user.id, lesson_id=lesson_id)
        db.add(progress)
    was_completed = progress.status == "completed"
    progress.status = request.status
    progress.progress_percent = request.progress_percent
    progress.content_version = request.content_version
    progress.started_at = progress.started_at or current
    if request.best_score is not None:
        progress.best_score = max(progress.best_score or Decimal(0), request.best_score)
    if request.status == "completed":
        progress.completed_at = progress.completed_at or current
        if not was_completed:
            record_mastery_evidence(db, user.id, {lesson_id}, evidence="lesson_completed")
            record_learning_activity(
                db,
                user.id,
                event_type="lesson_completed",
                entity_id=lesson_id,
                idempotency_key=f"lesson_completed:{lesson_id}",
            )
    db.commit()
    db.refresh(progress)
    return progress


@router.get("/lessons/{lesson_id}/notes", response_model=NoteRead)
def get_note(
    lesson_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LessonNote:
    note = db.scalar(
        select(LessonNote).where(LessonNote.user_id == user.id, LessonNote.lesson_id == lesson_id)
    )
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson note not found.")
    return note


@router.put("/lessons/{lesson_id}/notes", response_model=NoteRead)
def put_note(
    lesson_id: str,
    request: NoteWrite,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LessonNote:
    _require_lesson(lesson_id)
    note = db.scalar(
        select(LessonNote).where(LessonNote.user_id == user.id, LessonNote.lesson_id == lesson_id)
    )
    if note is None:
        note = LessonNote(user_id=user.id, lesson_id=lesson_id, body=request.body)
        db.add(note)
    else:
        note.body = request.body
    db.commit()
    db.refresh(note)
    return note


@router.get("/bookmarks", response_model=list[BookmarkRead])
def list_bookmarks(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[LessonBookmark]:
    return list(
        db.scalars(
            select(LessonBookmark)
            .where(LessonBookmark.user_id == user.id)
            .order_by(desc(LessonBookmark.created_at))
        )
    )


@router.put("/lessons/{lesson_id}/bookmark", response_model=BookmarkRead)
def add_bookmark(
    lesson_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LessonBookmark:
    _require_lesson(lesson_id)
    bookmark = db.scalar(
        select(LessonBookmark).where(
            LessonBookmark.user_id == user.id, LessonBookmark.lesson_id == lesson_id
        )
    )
    if bookmark is None:
        bookmark = LessonBookmark(user_id=user.id, lesson_id=lesson_id)
        db.add(bookmark)
        db.commit()
        db.refresh(bookmark)
    return bookmark


@router.delete("/lessons/{lesson_id}/bookmark", status_code=status.HTTP_204_NO_CONTENT)
def remove_bookmark(
    lesson_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    bookmark = db.scalar(
        select(LessonBookmark).where(
            LessonBookmark.user_id == user.id, LessonBookmark.lesson_id == lesson_id
        )
    )
    if bookmark is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson bookmark not found.")
    db.delete(bookmark)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/quizzes/{quiz_id}", response_model=QuizRead)
def get_quiz(quiz_id: str) -> QuizRead:
    registry = registry_or_503()
    lesson = registry.lesson_by_id(quiz_id)
    if lesson is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Quiz not found. Academy lesson quizzes use the lesson ID as their stable quiz ID.",
        )
    questions = registry.questions_for_quiz(quiz_id)
    if not questions:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found.")
    public_questions = []
    for question in questions:
        public_questions.append(
            {
                key: value
                for key, value in question.items()
                if key not in {"answer", "correct_answer", "correct_answers", "feedback"}
            }
        )
    return QuizRead(id=quiz_id, lesson_id=quiz_id, questions=public_questions)


@router.post("/quizzes/{quiz_id}/attempts", response_model=QuizResult)
def submit_quiz(
    quiz_id: str,
    request: QuizSubmission,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QuizResult:
    registry = registry_or_503()
    questions = registry.questions_for_quiz(quiz_id)
    if registry.lesson_by_id(quiz_id) is None or not questions:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found.")
    question_map = {str(item.get("id")): item for item in questions}
    submitted_ids = {answer.question_id for answer in request.answers}
    expected_ids = set(question_map)
    if submitted_ids != expected_ids:
        unknown = sorted(submitted_ids - expected_ids)
        missing = sorted(expected_ids - submitted_ids)
        details = []
        if unknown:
            details.append(f"unknown: {', '.join(unknown)}")
        if missing:
            details.append(f"missing: {', '.join(missing)}")
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Quiz submission must answer every question exactly once ({'; '.join(details)}).",
        )
    profile = db.get(Profile, user.id)
    locale = profile.locale if profile else "de"
    lesson_ids = {str(item.get("lesson_id")) for item in questions if item.get("lesson_id")}
    lesson_id = next(iter(lesson_ids)) if len(lesson_ids) == 1 else None
    attempt = QuizAttempt(
        id=uuid4(),
        user_id=user.id,
        quiz_id=quiz_id,
        lesson_id=lesson_id,
        status="submitted",
        question_count=len(questions),
        submitted_at=datetime.now(UTC),
    )
    db.add(attempt)
    # QuestionResponse uses an explicit composite owner FK. Flush the parent so
    # SQLAlchemy cannot reorder independent mapped classes ahead of it.
    db.flush()
    feedback: list[QuestionFeedback] = []
    correct_count = 0
    submitted = {item.question_id: item.answer for item in request.answers}
    for question_id, question in question_map.items():
        answer = submitted.get(question_id)
        correct = score_answer(question, answer)
        correct_count += int(correct)
        feedback_payload = question.get("feedback") or question.get("explanation") or ""
        if isinstance(feedback_payload, dict) and (
            "correct" in feedback_payload or "incorrect" in feedback_payload
        ):
            feedback_payload = feedback_payload.get("correct" if correct else "incorrect", "")
        explanation = localized(feedback_payload, locale)
        answer_key = question.get("answer", question.get("correct_answer"))
        correct_answer = (
            localized(answer_key.get("rubric"), locale)
            if question.get("type") == "short_reflection" and isinstance(answer_key, dict)
            else answer_key
        )
        response = QuestionResponse(
            attempt_id=attempt.id,
            user_id=user.id,
            question_id=question_id,
            answer=answer,
            is_correct=correct,
            explanation=str(explanation),
        )
        db.add(response)
        feedback.append(
            QuestionFeedback(
                question_id=question_id,
                correct=correct,
                explanation=explanation,
                correct_answer=correct_answer,
                review_recommended=bool(question.get("review_recommended") and not correct),
            )
        )
    attempt.correct_count = correct_count
    attempt.score_percent = (
        Decimal(correct_count) / Decimal(len(questions)) * Decimal(100)
    ).quantize(Decimal("0.01"))
    mastery_skills = lesson_ids or {quiz_id}
    record_mastery_evidence(
        db,
        user.id,
        mastery_skills,
        evidence="quiz",
        score_percent=int(attempt.score_percent),
    )
    record_learning_activity(
        db,
        user.id,
        event_type="quiz_submitted",
        entity_id=quiz_id,
        idempotency_key=f"quiz_attempt:{attempt.id}",
        payload={"score_percent": str(attempt.score_percent)},
    )
    if lesson_id:
        progress = db.scalar(
            select(LessonProgress).where(
                LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id
            )
        )
        if progress is not None:
            progress.best_score = max(progress.best_score or Decimal(0), attempt.score_percent)
            progress.attempts += 1
    db.commit()
    return QuizResult(
        attempt_id=attempt.id,
        quiz_id=quiz_id,
        correct_count=correct_count,
        question_count=len(questions),
        score_percent=attempt.score_percent,
        feedback=feedback,
    )

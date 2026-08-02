from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.api.deps.auth import get_current_user
from app.database import get_db
from app.models.academy import (
    LessonBookmark,
    LessonNote,
    LessonProgress,
    OnboardingProfile,
    Profile,
    ReviewSchedule,
    SimulationSession,
    StudyStreak,
    TradingJournal,
    User,
    UserAchievement,
    UserSkillMastery,
)
from app.schemas.academy import AchievementRead, AnalyticsRead, DashboardRead

router = APIRouter(prefix="/api/v1", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardRead)
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    now = datetime.now(UTC)
    profile = db.get(Profile, user.id)
    onboarding = db.get(OnboardingProfile, user.id)
    progress = list(
        db.scalars(
            select(LessonProgress)
            .where(LessonProgress.user_id == user.id)
            .order_by(desc(LessonProgress.updated_at))
        )
    )
    bookmarks = list(
        db.scalars(
            select(LessonBookmark.lesson_id)
            .where(LessonBookmark.user_id == user.id)
            .order_by(desc(LessonBookmark.created_at))
        )
    )
    due_reviews = (
        db.scalar(
            select(func.count(ReviewSchedule.id)).where(
                ReviewSchedule.user_id == user.id, ReviewSchedule.due_at <= now
            )
        )
        or 0
    )
    note_count = (
        db.scalar(select(func.count(LessonNote.id)).where(LessonNote.user_id == user.id)) or 0
    )
    recent_journal = list(
        db.scalars(
            select(TradingJournal)
            .where(TradingJournal.user_id == user.id)
            .order_by(desc(TradingJournal.created_at))
            .limit(5)
        )
    )
    recent_session = db.scalar(
        select(SimulationSession)
        .where(SimulationSession.user_id == user.id)
        .order_by(desc(SimulationSession.started_at))
        .limit(1)
    )
    mastery = list(
        db.scalars(
            select(UserSkillMastery)
            .where(UserSkillMastery.user_id == user.id)
            .order_by(desc(UserSkillMastery.mastery_score))
        )
    )
    streak = db.get(StudyStreak, user.id)
    return {
        "profile": {
            "display_name": profile.display_name,
            "locale": profile.locale,
            "timezone": profile.timezone,
        }
        if profile
        else None,
        "onboarding": {
            "completed": onboarding is not None,
            "recommended_path_id": onboarding.recommended_path_id if onboarding else None,
        },
        "progress": [
            {
                "lesson_id": item.lesson_id,
                "status": item.status,
                "progress_percent": item.progress_percent,
                "best_score": item.best_score,
                "updated_at": item.updated_at,
            }
            for item in progress
        ],
        "completed_lesson_count": sum(item.status == "completed" for item in progress),
        "bookmarks": bookmarks,
        "note_count": note_count,
        "due_review_count": due_reviews,
        "recent_journal": [
            {
                "id": item.id,
                "setup": item.setup,
                "result_amount": item.result_amount,
                "r_multiple": item.r_multiple,
                "created_at": item.created_at,
            }
            for item in recent_journal
        ],
        "simulator": {
            "session_id": recent_session.id,
            "scenario_id": recent_session.scenario_id,
            "status": recent_session.status,
            "equity": recent_session.equity,
            "realized_pnl": recent_session.realized_pnl,
        }
        if recent_session
        else None,
        "mastery": [
            {
                "skill_id": item.skill_id,
                "state": item.state,
                "score": item.mastery_score,
                "evidence_count": item.evidence_count,
            }
            for item in mastery
        ],
        "streak": {
            "current_days": streak.current_days,
            "longest_days": streak.longest_days,
            "last_activity_date": streak.last_activity_date,
        }
        if streak
        else {"current_days": 0, "longest_days": 0, "last_activity_date": None},
    }


@router.get("/analytics", response_model=AnalyticsRead)
def analytics(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    completed = (
        db.scalar(
            select(func.count(LessonProgress.id)).where(
                LessonProgress.user_id == user.id, LessonProgress.status == "completed"
            )
        )
        or 0
    )
    quiz_average = db.scalar(
        select(func.avg(LessonProgress.best_score)).where(
            LessonProgress.user_id == user.id,
            LessonProgress.best_score.is_not(None),
        )
    )
    return {
        "completed_lessons": completed,
        "average_best_lesson_score": quiz_average,
    }


@router.get("/achievements", response_model=list[AchievementRead])
def achievements(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    items = list(
        db.scalars(
            select(UserAchievement)
            .where(UserAchievement.user_id == user.id)
            .order_by(desc(UserAchievement.awarded_at))
        )
    )
    return [
        {
            "achievement_id": item.achievement_id,
            "progress": item.progress,
            "awarded_at": item.awarded_at,
        }
        for item in items
    ]

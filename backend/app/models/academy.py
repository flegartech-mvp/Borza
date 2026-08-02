from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

MONEY = Numeric(20, 8)
RATIO = Numeric(12, 6)


def new_uuid() -> UUID:
    return uuid4()


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320))
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (CheckConstraint("locale IN ('de', 'sl', 'en')", name="ck_profiles_locale"),)

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str | None] = mapped_column(String(120))
    locale: Mapped[str] = mapped_column(String(2), nullable=False, default="de")
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Europe/Berlin")
    bio: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class UserPreference(Base):
    __tablename__ = "user_preferences"
    __table_args__ = (
        CheckConstraint("theme IN ('light', 'dark', 'system')", name="ck_preferences_theme"),
        CheckConstraint("weekly_study_minutes BETWEEN 15 AND 2400", name="ck_preferences_weekly"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    theme: Mapped[str] = mapped_column(String(12), nullable=False, default="system")
    weekly_study_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    reduced_motion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    email_reminders: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class OnboardingProfile(Base):
    __tablename__ = "onboarding_profiles"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    learning_goal: Mapped[str] = mapped_column(String(80), nullable=False)
    experience_level: Mapped[str] = mapped_column(String(32), nullable=False)
    primary_interest: Mapped[str] = mapped_column(String(32), nullable=False)
    weekly_study_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    prior_market_experience: Mapped[str] = mapped_column(String(32), nullable=False)
    risk_knowledge: Mapped[str] = mapped_column(String(32), nullable=False)
    learning_style: Mapped[str] = mapped_column(String(32), nullable=False)
    recommended_path_id: Mapped[str] = mapped_column(String(100), nullable=False)
    placement_score: Mapped[int | None] = mapped_column(Integer)
    answers: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("user_id", "path_id", name="uq_enrollments_user_path"),
        CheckConstraint(
            "status IN ('active', 'completed', 'paused')", name="ck_enrollments_status"
        ),
        Index("ix_enrollments_user_status", "user_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    path_id: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_lesson_progress_user_lesson"),
        CheckConstraint(
            "status IN ('not_started', 'in_progress', 'completed')",
            name="ck_lesson_progress_status",
        ),
        CheckConstraint("progress_percent BETWEEN 0 AND 100", name="ck_lesson_progress_percent"),
        Index("ix_lesson_progress_user_status_updated", "user_id", "status", "updated_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    lesson_id: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="not_started")
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    best_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content_version: Mapped[str | None] = mapped_column(String(40))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class LessonNote(Base):
    __tablename__ = "lesson_notes"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_lesson_notes_user_lesson"),
        Index("ix_lesson_notes_user_updated", "user_id", "updated_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    lesson_id: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class LessonBookmark(Base):
    __tablename__ = "lesson_bookmarks"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_lesson_bookmarks_user_lesson"),
        Index("ix_lesson_bookmarks_user_created", "user_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    lesson_id: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_quiz_attempts_id_user"),
        CheckConstraint("status IN ('started', 'submitted')", name="ck_quiz_attempts_status"),
        Index("ix_quiz_attempts_user_quiz_started", "user_id", "quiz_id", "started_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    quiz_id: Mapped[str] = mapped_column(String(120), nullable=False)
    lesson_id: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="started")
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    score_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class QuestionResponse(Base):
    __tablename__ = "question_responses"
    __table_args__ = (
        ForeignKeyConstraint(
            ["attempt_id", "user_id"],
            ["quiz_attempts.id", "quiz_attempts.user_id"],
            ondelete="CASCADE",
            name="fk_question_responses_attempt_owner",
        ),
        UniqueConstraint("attempt_id", "question_id", name="uq_question_response_attempt_question"),
        Index("ix_question_responses_user_created", "user_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    attempt_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    user_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    question_id: Mapped[str] = mapped_column(String(120), nullable=False)
    answer: Mapped[object] = mapped_column(JSON, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReviewSchedule(Base):
    __tablename__ = "review_schedules"
    __table_args__ = (
        UniqueConstraint("user_id", "card_id", name="uq_review_schedules_user_card"),
        UniqueConstraint("id", "user_id", name="uq_review_schedules_id_user"),
        CheckConstraint("difficulty BETWEEN 1 AND 10", name="ck_review_schedules_difficulty"),
        CheckConstraint("stability >= 0", name="ck_review_schedules_stability"),
        Index("ix_review_schedules_user_due", "user_id", "due_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    card_id: Mapped[str] = mapped_column(String(120), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    stability: Mapped[Decimal] = mapped_column(RATIO, nullable=False, default=0)
    difficulty: Mapped[Decimal] = mapped_column(RATIO, nullable=False, default=5)
    state: Mapped[str] = mapped_column(String(16), nullable=False, default="new")
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lapse_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"
    __table_args__ = (
        ForeignKeyConstraint(
            ["schedule_id", "user_id"],
            ["review_schedules.id", "review_schedules.user_id"],
            ondelete="CASCADE",
            name="fk_flashcard_reviews_schedule_owner",
        ),
        CheckConstraint("rating BETWEEN 1 AND 4", name="ck_flashcard_reviews_rating"),
        Index("ix_flashcard_reviews_user_reviewed", "user_id", "reviewed_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    schedule_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    user_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    previous_state: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    next_state: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class UserSkillMastery(Base):
    __tablename__ = "user_skill_mastery"
    __table_args__ = (
        UniqueConstraint("user_id", "skill_id", name="uq_user_skill_mastery_user_skill"),
        CheckConstraint("mastery_score BETWEEN 0 AND 100", name="ck_skill_mastery_score"),
        CheckConstraint(
            "state IN ('not_started', 'introduced', 'practising', 'proficient', 'needs_review', 'mastered')",
            name="ck_skill_mastery_state",
        ),
        Index("ix_user_skill_mastery_user_state", "user_id", "state"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    skill_id: Mapped[str] = mapped_column(String(120), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="not_started")
    mastery_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    evidence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_evidence_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SimulationSession(Base):
    __tablename__ = "simulation_sessions"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_simulation_sessions_id_user"),
        CheckConstraint("status IN ('active', 'completed', 'abandoned')", name="ck_sim_status"),
        CheckConstraint("current_candle_index >= 0", name="ck_sim_candle_index"),
        CheckConstraint("version >= 1", name="ck_sim_version"),
        Index("ix_simulation_sessions_user_started", "user_id", "started_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    scenario_id: Mapped[str] = mapped_column(String(120), nullable=False)
    scenario_version: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    initial_balance: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    cash_balance: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    equity: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    realized_pnl: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    unrealized_pnl: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    position_quantity: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    average_entry_price: Mapped[Decimal | None] = mapped_column(MONEY)
    position_stop_loss: Mapped[Decimal | None] = mapped_column(MONEY)
    position_take_profit: Mapped[Decimal | None] = mapped_column(MONEY)
    position_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_candle_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    spread_bps: Mapped[Decimal] = mapped_column(RATIO, nullable=False, default=0)
    slippage_bps: Mapped[Decimal] = mapped_column(RATIO, nullable=False, default=0)
    commission_fixed: Mapped[Decimal] = mapped_column(MONEY, nullable=False, default=0)
    commission_bps: Mapped[Decimal] = mapped_column(RATIO, nullable=False, default=0)
    planned_risk: Mapped[Decimal | None] = mapped_column(MONEY)
    decision_note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    risk_defined_before_entry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    concentration_checked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    rule_violations: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SimulationOrder(Base):
    __tablename__ = "simulation_orders"
    __table_args__ = (
        ForeignKeyConstraint(
            ["session_id", "user_id"],
            ["simulation_sessions.id", "simulation_sessions.user_id"],
            ondelete="CASCADE",
            name="fk_simulation_orders_session_owner",
        ),
        UniqueConstraint("id", "user_id", name="uq_simulation_orders_id_user"),
        UniqueConstraint("user_id", "client_order_id", name="uq_sim_orders_user_client"),
        CheckConstraint("side IN ('buy', 'sell')", name="ck_sim_orders_side"),
        CheckConstraint("order_type IN ('market', 'limit', 'stop')", name="ck_sim_orders_type"),
        CheckConstraint(
            "status IN ('pending', 'filled', 'cancelled', 'rejected')", name="ck_sim_orders_status"
        ),
        CheckConstraint("quantity > 0", name="ck_sim_orders_quantity"),
        Index("ix_simulation_orders_session_status", "session_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    session_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    user_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    client_order_id: Mapped[str] = mapped_column(String(100), nullable=False)
    side: Mapped[str] = mapped_column(String(4), nullable=False)
    order_type: Mapped[str] = mapped_column(String(8), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    trigger_price: Mapped[Decimal | None] = mapped_column(MONEY)
    stop_loss: Mapped[Decimal | None] = mapped_column(MONEY)
    take_profit: Mapped[Decimal | None] = mapped_column(MONEY)
    planned_risk: Mapped[Decimal | None] = mapped_column(MONEY)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="pending")
    filled_price: Mapped[Decimal | None] = mapped_column(MONEY)
    filled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(String(240))
    rule_violations: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SimulationTrade(Base):
    __tablename__ = "simulation_trades"
    __table_args__ = (
        ForeignKeyConstraint(
            ["session_id", "user_id"],
            ["simulation_sessions.id", "simulation_sessions.user_id"],
            ondelete="CASCADE",
            name="fk_simulation_trades_session_owner",
        ),
        ForeignKeyConstraint(
            ["entry_order_id", "user_id"],
            ["simulation_orders.id", "simulation_orders.user_id"],
            name="fk_simulation_trades_entry_order_owner",
        ),
        CheckConstraint("side IN ('long', 'short')", name="ck_sim_trades_side"),
        CheckConstraint("quantity > 0", name="ck_sim_trades_quantity"),
        Index("ix_simulation_trades_session_closed", "session_id", "closed_at"),
        Index("ix_simulation_trades_user_closed", "user_id", "closed_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    session_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    user_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    entry_order_id: Mapped[UUID | None] = mapped_column(Uuid)
    side: Mapped[str] = mapped_column(String(5), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    entry_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    exit_price: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    gross_pnl: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    commission: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    net_pnl: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    planned_risk: Mapped[Decimal | None] = mapped_column(MONEY)
    r_multiple: Mapped[Decimal | None] = mapped_column(RATIO)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exit_reason: Mapped[str] = mapped_column(String(32), nullable=False)
    rule_violations: Mapped[list] = mapped_column(JSON, nullable=False, default=list)


class TradingJournal(Base):
    __tablename__ = "trading_journals"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_trading_journals_id_user"),
        ForeignKeyConstraint(
            ["simulation_session_id", "user_id"],
            ["simulation_sessions.id", "simulation_sessions.user_id"],
            name="fk_trading_journals_session_owner",
        ),
        Index("ix_trading_journals_user_created", "user_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    simulation_session_id: Mapped[UUID | None] = mapped_column(Uuid)
    setup: Mapped[str] = mapped_column(String(160), nullable=False)
    thesis: Mapped[str] = mapped_column(Text, nullable=False)
    market_context: Mapped[str] = mapped_column(Text, nullable=False, default="")
    entry_price: Mapped[Decimal | None] = mapped_column(MONEY)
    stop_price: Mapped[Decimal | None] = mapped_column(MONEY)
    target_price: Mapped[Decimal | None] = mapped_column(MONEY)
    planned_risk: Mapped[Decimal | None] = mapped_column(MONEY)
    actual_risk: Mapped[Decimal | None] = mapped_column(MONEY)
    result_amount: Mapped[Decimal | None] = mapped_column(MONEY)
    r_multiple: Mapped[Decimal | None] = mapped_column(RATIO)
    emotions_before: Mapped[str | None] = mapped_column(String(240))
    emotions_during: Mapped[str | None] = mapped_column(String(240))
    emotions_after: Mapped[str | None] = mapped_column(String(240))
    rule_adherence: Mapped[int | None] = mapped_column(Integer)
    lesson_learned: Mapped[str] = mapped_column(Text, nullable=False, default="")
    chart_snapshot_url: Mapped[str | None] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class JournalTag(Base):
    __tablename__ = "journal_tags"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_journal_tags_user_name"),
        UniqueConstraint("id", "user_id", name="uq_journal_tags_id_user"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(64), nullable=False)


class TradingJournalTag(Base):
    __tablename__ = "trading_journal_tags"
    __table_args__ = (
        ForeignKeyConstraint(
            ["journal_id", "user_id"],
            ["trading_journals.id", "trading_journals.user_id"],
            ondelete="CASCADE",
            name="fk_trading_journal_tags_journal_owner",
        ),
        ForeignKeyConstraint(
            ["tag_id", "user_id"],
            ["journal_tags.id", "journal_tags.user_id"],
            ondelete="CASCADE",
            name="fk_trading_journal_tags_tag_owner",
        ),
    )

    journal_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    tag_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievements_user_item"),
        Index("ix_user_achievements_user_awarded", "user_id", "awarded_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    achievement_id: Mapped[str] = mapped_column(String(120), nullable=False)
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StudyStreak(Base):
    __tablename__ = "study_streaks"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    current_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    longest_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_activity_date: Mapped[str | None] = mapped_column(String(10))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ActivityEvent(Base):
    __tablename__ = "activity_events"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_activity_events_user_key"),
        Index("ix_activity_events_user_occurred", "user_id", "occurred_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=new_uuid)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(120))
    idempotency_key: Mapped[str] = mapped_column(String(160), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

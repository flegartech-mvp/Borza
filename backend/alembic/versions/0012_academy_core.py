"""add Borza Academy identity and learner state without dropping legacy news data

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-01
"""

import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

ACADEMY_TABLES = (
    "users",
    "profiles",
    "user_preferences",
    "onboarding_profiles",
    "enrollments",
    "lesson_progress",
    "lesson_notes",
    "lesson_bookmarks",
    "quiz_attempts",
    "question_responses",
    "review_schedules",
    "flashcard_reviews",
    "user_skill_mastery",
    "simulation_sessions",
    "simulation_orders",
    "simulation_trades",
    "trading_journals",
    "journal_tags",
    "trading_journal_tags",
    "user_achievements",
    "study_streaks",
    "activity_events",
)


def _now(name: str, *, nullable: bool = False) -> sa.Column:
    return sa.Column(
        name, sa.DateTime(timezone=True), nullable=nullable, server_default=sa.func.now()
    )


def _user_id(*, primary_key: bool = False) -> sa.Column:
    return sa.Column(
        "user_id",
        sa.Uuid(),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=primary_key,
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320)),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        _now("created_at"),
        _now("updated_at"),
        _now("last_seen_at"),
    )
    op.create_table(
        "profiles",
        _user_id(primary_key=True),
        sa.Column("display_name", sa.String(120)),
        sa.Column("locale", sa.String(2), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("bio", sa.String(500)),
        _now("created_at"),
        _now("updated_at"),
        sa.CheckConstraint("locale IN ('de', 'sl', 'en')", name="ck_profiles_locale"),
    )
    op.create_table(
        "user_preferences",
        _user_id(primary_key=True),
        sa.Column("theme", sa.String(12), nullable=False),
        sa.Column("weekly_study_minutes", sa.Integer(), nullable=False),
        sa.Column("reduced_motion", sa.Boolean(), nullable=False),
        sa.Column("email_reminders", sa.Boolean(), nullable=False),
        _now("updated_at"),
        sa.CheckConstraint("theme IN ('light', 'dark', 'system')", name="ck_preferences_theme"),
        sa.CheckConstraint(
            "weekly_study_minutes BETWEEN 15 AND 2400", name="ck_preferences_weekly"
        ),
    )
    op.create_table(
        "onboarding_profiles",
        _user_id(primary_key=True),
        sa.Column("learning_goal", sa.String(80), nullable=False),
        sa.Column("experience_level", sa.String(32), nullable=False),
        sa.Column("primary_interest", sa.String(32), nullable=False),
        sa.Column("weekly_study_minutes", sa.Integer(), nullable=False),
        sa.Column("prior_market_experience", sa.String(32), nullable=False),
        sa.Column("risk_knowledge", sa.String(32), nullable=False),
        sa.Column("learning_style", sa.String(32), nullable=False),
        sa.Column("recommended_path_id", sa.String(100), nullable=False),
        sa.Column("placement_score", sa.Integer()),
        sa.Column("answers", sa.JSON(), nullable=False),
        _now("completed_at"),
    )
    op.create_table(
        "enrollments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("path_id", sa.String(100), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        _now("enrolled_at"),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("user_id", "path_id", name="uq_enrollments_user_path"),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'paused')", name="ck_enrollments_status"
        ),
    )
    op.create_index("ix_enrollments_user_status", "enrollments", ["user_id", "status"])
    op.create_table(
        "lesson_progress",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("lesson_id", sa.String(120), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("progress_percent", sa.Integer(), nullable=False),
        sa.Column("best_score", sa.Numeric(5, 2)),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("content_version", sa.String(40)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        _now("updated_at"),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_lesson_progress_user_lesson"),
        sa.CheckConstraint(
            "status IN ('not_started', 'in_progress', 'completed')",
            name="ck_lesson_progress_status",
        ),
        sa.CheckConstraint("progress_percent BETWEEN 0 AND 100", name="ck_lesson_progress_percent"),
    )
    op.create_index(
        "ix_lesson_progress_user_status_updated",
        "lesson_progress",
        ["user_id", "status", "updated_at"],
    )
    op.create_table(
        "lesson_notes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("lesson_id", sa.String(120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        _now("created_at"),
        _now("updated_at"),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_lesson_notes_user_lesson"),
    )
    op.create_index("ix_lesson_notes_user_updated", "lesson_notes", ["user_id", "updated_at"])
    op.create_table(
        "lesson_bookmarks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("lesson_id", sa.String(120), nullable=False),
        _now("created_at"),
        sa.UniqueConstraint("user_id", "lesson_id", name="uq_lesson_bookmarks_user_lesson"),
    )
    op.create_index(
        "ix_lesson_bookmarks_user_created", "lesson_bookmarks", ["user_id", "created_at"]
    )
    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("quiz_id", sa.String(120), nullable=False),
        sa.Column("lesson_id", sa.String(120)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("score_percent", sa.Numeric(5, 2), nullable=False),
        _now("started_at"),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("id", "user_id", name="uq_quiz_attempts_id_user"),
        sa.CheckConstraint("status IN ('started', 'submitted')", name="ck_quiz_attempts_status"),
    )
    op.create_index(
        "ix_quiz_attempts_user_quiz_started",
        "quiz_attempts",
        ["user_id", "quiz_id", "started_at"],
    )
    op.create_table(
        "question_responses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("attempt_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("question_id", sa.String(120), nullable=False),
        sa.Column("answer", sa.JSON(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        _now("created_at"),
        sa.ForeignKeyConstraint(
            ["attempt_id", "user_id"],
            ["quiz_attempts.id", "quiz_attempts.user_id"],
            ondelete="CASCADE",
            name="fk_question_responses_attempt_owner",
        ),
        sa.UniqueConstraint(
            "attempt_id", "question_id", name="uq_question_response_attempt_question"
        ),
    )
    op.create_index(
        "ix_question_responses_user_created",
        "question_responses",
        ["user_id", "created_at"],
    )
    op.create_table(
        "review_schedules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("card_id", sa.String(120), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("stability", sa.Numeric(12, 6), nullable=False),
        sa.Column("difficulty", sa.Numeric(12, 6), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("review_count", sa.Integer(), nullable=False),
        sa.Column("lapse_count", sa.Integer(), nullable=False),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True)),
        _now("updated_at"),
        sa.UniqueConstraint("user_id", "card_id", name="uq_review_schedules_user_card"),
        sa.UniqueConstraint("id", "user_id", name="uq_review_schedules_id_user"),
        sa.CheckConstraint("difficulty BETWEEN 1 AND 10", name="ck_review_schedules_difficulty"),
        sa.CheckConstraint("stability >= 0", name="ck_review_schedules_stability"),
    )
    op.create_index("ix_review_schedules_user_due", "review_schedules", ["user_id", "due_at"])
    op.create_table(
        "flashcard_reviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("schedule_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("previous_state", sa.JSON(), nullable=False),
        sa.Column("next_state", sa.JSON(), nullable=False),
        _now("reviewed_at"),
        sa.ForeignKeyConstraint(
            ["schedule_id", "user_id"],
            ["review_schedules.id", "review_schedules.user_id"],
            ondelete="CASCADE",
            name="fk_flashcard_reviews_schedule_owner",
        ),
        sa.CheckConstraint("rating BETWEEN 1 AND 4", name="ck_flashcard_reviews_rating"),
    )
    op.create_index(
        "ix_flashcard_reviews_user_reviewed",
        "flashcard_reviews",
        ["user_id", "reviewed_at"],
    )
    op.create_table(
        "user_skill_mastery",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("skill_id", sa.String(120), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("mastery_score", sa.Integer(), nullable=False),
        sa.Column("evidence_count", sa.Integer(), nullable=False),
        sa.Column("last_evidence_at", sa.DateTime(timezone=True)),
        _now("updated_at"),
        sa.UniqueConstraint("user_id", "skill_id", name="uq_user_skill_mastery_user_skill"),
        sa.CheckConstraint("mastery_score BETWEEN 0 AND 100", name="ck_skill_mastery_score"),
        sa.CheckConstraint(
            "state IN ('not_started', 'introduced', 'practising', 'proficient', 'needs_review', 'mastered')",
            name="ck_skill_mastery_state",
        ),
    )
    op.create_index("ix_user_skill_mastery_user_state", "user_skill_mastery", ["user_id", "state"])
    op.create_table(
        "simulation_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("scenario_id", sa.String(120), nullable=False),
        sa.Column("scenario_version", sa.String(40)),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("initial_balance", sa.Numeric(20, 8), nullable=False),
        sa.Column("cash_balance", sa.Numeric(20, 8), nullable=False),
        sa.Column("equity", sa.Numeric(20, 8), nullable=False),
        sa.Column("realized_pnl", sa.Numeric(20, 8), nullable=False),
        sa.Column("unrealized_pnl", sa.Numeric(20, 8), nullable=False),
        sa.Column("position_quantity", sa.Numeric(20, 8), nullable=False),
        sa.Column("average_entry_price", sa.Numeric(20, 8)),
        sa.Column("position_stop_loss", sa.Numeric(20, 8)),
        sa.Column("position_take_profit", sa.Numeric(20, 8)),
        sa.Column("position_opened_at", sa.DateTime(timezone=True)),
        sa.Column("current_candle_index", sa.Integer(), nullable=False),
        sa.Column("spread_bps", sa.Numeric(12, 6), nullable=False),
        sa.Column("slippage_bps", sa.Numeric(12, 6), nullable=False),
        sa.Column("commission_fixed", sa.Numeric(20, 8), nullable=False),
        sa.Column("commission_bps", sa.Numeric(12, 6), nullable=False),
        sa.Column("planned_risk", sa.Numeric(20, 8)),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("rule_violations", sa.JSON(), nullable=False),
        _now("started_at"),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        _now("updated_at"),
        sa.UniqueConstraint("id", "user_id", name="uq_simulation_sessions_id_user"),
        sa.CheckConstraint("status IN ('active', 'completed', 'abandoned')", name="ck_sim_status"),
        sa.CheckConstraint("current_candle_index >= 0", name="ck_sim_candle_index"),
        sa.CheckConstraint("version >= 1", name="ck_sim_version"),
    )
    op.create_index(
        "ix_simulation_sessions_user_started",
        "simulation_sessions",
        ["user_id", "started_at"],
    )
    op.create_table(
        "simulation_orders",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("client_order_id", sa.String(100), nullable=False),
        sa.Column("side", sa.String(4), nullable=False),
        sa.Column("order_type", sa.String(8), nullable=False),
        sa.Column("quantity", sa.Numeric(20, 8), nullable=False),
        sa.Column("trigger_price", sa.Numeric(20, 8)),
        sa.Column("stop_loss", sa.Numeric(20, 8)),
        sa.Column("take_profit", sa.Numeric(20, 8)),
        sa.Column("planned_risk", sa.Numeric(20, 8)),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("filled_price", sa.Numeric(20, 8)),
        sa.Column("filled_at", sa.DateTime(timezone=True)),
        sa.Column("rejection_reason", sa.String(240)),
        sa.Column("rule_violations", sa.JSON(), nullable=False),
        _now("created_at"),
        sa.ForeignKeyConstraint(
            ["session_id", "user_id"],
            ["simulation_sessions.id", "simulation_sessions.user_id"],
            ondelete="CASCADE",
            name="fk_simulation_orders_session_owner",
        ),
        sa.UniqueConstraint("id", "user_id", name="uq_simulation_orders_id_user"),
        sa.UniqueConstraint("user_id", "client_order_id", name="uq_sim_orders_user_client"),
        sa.CheckConstraint("side IN ('buy', 'sell')", name="ck_sim_orders_side"),
        sa.CheckConstraint("order_type IN ('market', 'limit', 'stop')", name="ck_sim_orders_type"),
        sa.CheckConstraint(
            "status IN ('pending', 'filled', 'cancelled', 'rejected')",
            name="ck_sim_orders_status",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_sim_orders_quantity"),
    )
    op.create_index(
        "ix_simulation_orders_session_status",
        "simulation_orders",
        ["session_id", "status"],
    )
    op.create_table(
        "simulation_trades",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("entry_order_id", sa.Uuid()),
        sa.Column("side", sa.String(5), nullable=False),
        sa.Column("quantity", sa.Numeric(20, 8), nullable=False),
        sa.Column("entry_price", sa.Numeric(20, 8), nullable=False),
        sa.Column("exit_price", sa.Numeric(20, 8), nullable=False),
        sa.Column("gross_pnl", sa.Numeric(20, 8), nullable=False),
        sa.Column("commission", sa.Numeric(20, 8), nullable=False),
        sa.Column("net_pnl", sa.Numeric(20, 8), nullable=False),
        sa.Column("planned_risk", sa.Numeric(20, 8)),
        sa.Column("r_multiple", sa.Numeric(12, 6)),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exit_reason", sa.String(32), nullable=False),
        sa.Column("rule_violations", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id", "user_id"],
            ["simulation_sessions.id", "simulation_sessions.user_id"],
            ondelete="CASCADE",
            name="fk_simulation_trades_session_owner",
        ),
        sa.ForeignKeyConstraint(
            ["entry_order_id", "user_id"],
            ["simulation_orders.id", "simulation_orders.user_id"],
            name="fk_simulation_trades_entry_order_owner",
        ),
        sa.CheckConstraint("side IN ('long', 'short')", name="ck_sim_trades_side"),
        sa.CheckConstraint("quantity > 0", name="ck_sim_trades_quantity"),
    )
    op.create_index(
        "ix_simulation_trades_session_closed",
        "simulation_trades",
        ["session_id", "closed_at"],
    )
    op.create_index(
        "ix_simulation_trades_user_closed", "simulation_trades", ["user_id", "closed_at"]
    )
    op.create_table(
        "trading_journals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("simulation_session_id", sa.Uuid()),
        sa.Column("setup", sa.String(160), nullable=False),
        sa.Column("thesis", sa.Text(), nullable=False),
        sa.Column("market_context", sa.Text(), nullable=False),
        sa.Column("entry_price", sa.Numeric(20, 8)),
        sa.Column("stop_price", sa.Numeric(20, 8)),
        sa.Column("target_price", sa.Numeric(20, 8)),
        sa.Column("planned_risk", sa.Numeric(20, 8)),
        sa.Column("actual_risk", sa.Numeric(20, 8)),
        sa.Column("result_amount", sa.Numeric(20, 8)),
        sa.Column("r_multiple", sa.Numeric(12, 6)),
        sa.Column("emotions_before", sa.String(240)),
        sa.Column("emotions_during", sa.String(240)),
        sa.Column("emotions_after", sa.String(240)),
        sa.Column("rule_adherence", sa.Integer()),
        sa.Column("lesson_learned", sa.Text(), nullable=False),
        sa.Column("chart_snapshot_url", sa.String(2000)),
        _now("created_at"),
        _now("updated_at"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["simulation_session_id", "user_id"],
            ["simulation_sessions.id", "simulation_sessions.user_id"],
            name="fk_trading_journals_session_owner",
        ),
        sa.UniqueConstraint("id", "user_id", name="uq_trading_journals_id_user"),
    )
    op.create_index(
        "ix_trading_journals_user_created", "trading_journals", ["user_id", "created_at"]
    )
    op.create_table(
        "journal_tags",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("name", sa.String(64), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_journal_tags_user_name"),
        sa.UniqueConstraint("id", "user_id", name="uq_journal_tags_id_user"),
    )
    op.create_table(
        "trading_journal_tags",
        sa.Column("journal_id", sa.Uuid(), primary_key=True),
        sa.Column("tag_id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["journal_id", "user_id"],
            ["trading_journals.id", "trading_journals.user_id"],
            ondelete="CASCADE",
            name="fk_trading_journal_tags_journal_owner",
        ),
        sa.ForeignKeyConstraint(
            ["tag_id", "user_id"],
            ["journal_tags.id", "journal_tags.user_id"],
            ondelete="CASCADE",
            name="fk_trading_journal_tags_tag_owner",
        ),
    )
    op.create_table(
        "user_achievements",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("achievement_id", sa.String(120), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        _now("awarded_at"),
        sa.UniqueConstraint("user_id", "achievement_id", name="uq_user_achievements_user_item"),
    )
    op.create_index(
        "ix_user_achievements_user_awarded",
        "user_achievements",
        ["user_id", "awarded_at"],
    )
    op.create_table(
        "study_streaks",
        _user_id(primary_key=True),
        sa.Column("current_days", sa.Integer(), nullable=False),
        sa.Column("longest_days", sa.Integer(), nullable=False),
        sa.Column("last_activity_date", sa.String(10)),
        _now("updated_at"),
    )
    op.create_table(
        "activity_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_id(),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("entity_id", sa.String(120)),
        sa.Column("idempotency_key", sa.String(160), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        _now("occurred_at"),
        sa.UniqueConstraint("user_id", "idempotency_key", name="uq_activity_events_user_key"),
    )
    op.create_index(
        "ix_activity_events_user_occurred",
        "activity_events",
        ["user_id", "occurred_at"],
    )
    _protect_supabase_tables()


def _protect_supabase_tables() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    statements: list[str] = []
    for table in ACADEMY_TABLES:
        owner_column = "id" if table == "users" else "user_id"
        statements.extend(
            [
                f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;",
                f"REVOKE ALL PRIVILEGES ON TABLE public.{table} FROM anon, authenticated;",
                f"DROP POLICY IF EXISTS academy_direct_server_access ON public.{table};",
                f"CREATE POLICY academy_direct_server_access ON public.{table} FOR ALL TO PUBLIC "
                "USING (NOT pg_has_role(current_user, 'anon', 'member') "
                "AND NOT pg_has_role(current_user, 'authenticated', 'member')) "
                "WITH CHECK (NOT pg_has_role(current_user, 'anon', 'member') "
                "AND NOT pg_has_role(current_user, 'authenticated', 'member'));",
                f"DROP POLICY IF EXISTS academy_owner_access ON public.{table};",
                f"CREATE POLICY academy_owner_access ON public.{table} FOR ALL TO authenticated "
                f"USING ((select auth.uid()) = {owner_column}) "
                f"WITH CHECK ((select auth.uid()) = {owner_column});",
            ]
        )
    sql = "\n".join(statements)
    op.execute(
        sa.text(
            f"""
DO $academy$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'auth') THEN
        {sql}
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
            REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public
            REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
    END IF;
END
$academy$;
"""
        )
    )


def downgrade() -> None:
    for table in reversed(ACADEMY_TABLES):
        op.drop_table(table)

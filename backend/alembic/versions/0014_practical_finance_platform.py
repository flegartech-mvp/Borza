"""add practical finance, classroom, and competence evidence models

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-02
"""

import sqlalchemy as sa

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decision_attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("activity_type", sa.String(32), nullable=False),
        sa.Column("activity_id", sa.String(120), nullable=False),
        sa.Column("content_version", sa.String(40), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="in_progress"),
        sa.Column("selected_option_id", sa.String(120)),
        sa.Column("reasoning", sa.Text(), nullable=False, server_default=""),
        sa.Column("assumptions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("calculations", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("feedback", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("process_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "activity_type IN ('life_simulator', 'scam_detector', 'decision_lab')",
            name="ck_decision_attempts_activity_type",
        ),
        sa.CheckConstraint(
            "status IN ('in_progress', 'completed', 'abandoned')",
            name="ck_decision_attempts_status",
        ),
        sa.CheckConstraint("process_score BETWEEN 0 AND 100", name="ck_decision_process_score"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("id", "user_id", name="uq_decision_attempts_id_user"),
    )
    op.create_index(
        "ix_decision_attempts_user_activity",
        "decision_attempts",
        ["user_id", "activity_type", "completed_at"],
    )

    op.create_table(
        "competence_evidence",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("competence_id", sa.String(100), nullable=False),
        sa.Column("source_type", sa.String(40), nullable=False),
        sa.Column("source_id", sa.String(120), nullable=False),
        sa.Column("content_version", sa.String(40), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("summary", sa.String(500), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("score BETWEEN 0 AND 100", name="ck_competence_evidence_score"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "user_id", "source_type", "source_id", "competence_id", name="uq_competence_source"
        ),
    )
    op.create_index(
        "ix_competence_evidence_user_competence",
        "competence_evidence",
        ["user_id", "competence_id", "created_at"],
    )

    op.create_table(
        "life_simulation_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.String(100), nullable=False),
        sa.Column("scenario_id", sa.String(120), nullable=False),
        sa.Column("scenario_version", sa.String(40), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("current_round", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("financial_state", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("decision_history", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("process_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'abandoned')", name="ck_life_sessions_status"
        ),
        sa.CheckConstraint("current_round >= 0", name="ck_life_sessions_round"),
        sa.CheckConstraint("process_score BETWEEN 0 AND 100", name="ck_life_process_score"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("id", "user_id", name="uq_life_sessions_id_user"),
    )
    op.create_index(
        "ix_life_sessions_user_updated", "life_simulation_sessions", ["user_id", "updated_at"]
    )

    op.create_table(
        "classroom_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("teacher_user_id", sa.Uuid(), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("activity_type", sa.String(40), nullable=False),
        sa.Column("activity_id", sa.String(120), nullable=False),
        sa.Column("content_version", sa.String(40), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="draft"),
        sa.Column("settings", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("duration_minutes IN (45, 90)", name="ck_classroom_duration"),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'closed', 'expired')", name="ck_classroom_status"
        ),
        sa.ForeignKeyConstraint(["teacher_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("id", "teacher_user_id", name="uq_classroom_sessions_id_teacher"),
        sa.UniqueConstraint("code_hash", name="uq_classroom_sessions_code_hash"),
    )
    op.create_index(
        "ix_classroom_teacher_created", "classroom_sessions", ["teacher_user_id", "created_at"]
    )
    op.create_index("ix_classroom_status_expires", "classroom_sessions", ["status", "expires_at"])

    op.create_table(
        "classroom_participants",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("classroom_session_id", sa.Uuid(), nullable=False),
        sa.Column("pseudonym", sa.String(32), nullable=False),
        sa.Column("access_token_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="active"),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'removed')", name="ck_classroom_participant_status"
        ),
        sa.ForeignKeyConstraint(
            ["classroom_session_id"], ["classroom_sessions.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("id", "classroom_session_id", name="uq_classroom_participant_session"),
        sa.UniqueConstraint(
            "classroom_session_id", "pseudonym", name="uq_classroom_participant_pseudonym"
        ),
        sa.UniqueConstraint("access_token_hash", name="uq_classroom_access_token_hash"),
    )
    op.create_index(
        "ix_classroom_participants_session_joined",
        "classroom_participants",
        ["classroom_session_id", "joined_at"],
    )

    op.create_table(
        "classroom_responses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("classroom_session_id", sa.Uuid(), nullable=False),
        sa.Column("participant_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.String(120), nullable=False),
        sa.Column("answer", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("reasoning", sa.Text(), nullable=False, server_default=""),
        sa.Column("process_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("misconceptions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("process_score BETWEEN 0 AND 100", name="ck_classroom_response_score"),
        sa.ForeignKeyConstraint(
            ["participant_id", "classroom_session_id"],
            ["classroom_participants.id", "classroom_participants.classroom_session_id"],
            ondelete="CASCADE",
            name="fk_classroom_response_participant_session",
        ),
        sa.UniqueConstraint("participant_id", "item_id", name="uq_classroom_response_item"),
    )
    op.create_index(
        "ix_classroom_responses_session_created",
        "classroom_responses",
        ["classroom_session_id", "created_at"],
    )

    op.create_table(
        "partnership_interests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("organisation", sa.String(160), nullable=False),
        sa.Column("contact_role", sa.String(100), nullable=False),
        sa.Column("contact_email", sa.String(320), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("consent", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="new"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "kind IN ('teacher_pilot', 'classroom_sponsor', 'foundation', 'partner')",
            name="ck_partnership_interest_kind",
        ),
        sa.CheckConstraint(
            "status IN ('new', 'reviewed', 'closed', 'expired')", name="ck_partnership_status"
        ),
    )
    op.create_index("ix_partnership_kind_created", "partnership_interests", ["kind", "created_at"])
    op.create_index("ix_partnership_expires", "partnership_interests", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_partnership_expires", table_name="partnership_interests")
    op.drop_index("ix_partnership_kind_created", table_name="partnership_interests")
    op.drop_table("partnership_interests")
    op.drop_index("ix_classroom_responses_session_created", table_name="classroom_responses")
    op.drop_table("classroom_responses")
    op.drop_index("ix_classroom_participants_session_joined", table_name="classroom_participants")
    op.drop_table("classroom_participants")
    op.drop_index("ix_classroom_status_expires", table_name="classroom_sessions")
    op.drop_index("ix_classroom_teacher_created", table_name="classroom_sessions")
    op.drop_table("classroom_sessions")
    op.drop_index("ix_life_sessions_user_updated", table_name="life_simulation_sessions")
    op.drop_table("life_simulation_sessions")
    op.drop_index("ix_competence_evidence_user_competence", table_name="competence_evidence")
    op.drop_table("competence_evidence")
    op.drop_index("ix_decision_attempts_user_activity", table_name="decision_attempts")
    op.drop_table("decision_attempts")

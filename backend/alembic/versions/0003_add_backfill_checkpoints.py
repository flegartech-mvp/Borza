"""add resumable GDELT backfill checkpoints

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-27
"""

import sqlalchemy as sa

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "backfill_checkpoints",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("query_group", sa.String(length=32), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("raw_record_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stored_article_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "provider",
            "query_group",
            "window_start",
            "window_end",
            name="uq_backfill_checkpoint_window",
        ),
    )
    op.create_index("ix_backfill_checkpoints_status", "backfill_checkpoints", ["status"])


def downgrade():
    op.drop_table("backfill_checkpoints")

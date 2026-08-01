"""add title_fingerprint column and pagination indexes to articles

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-31
"""

import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "articles",
        sa.Column("title_fingerprint", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_articles_published_at_id",
        "articles",
        [sa.text("published_at DESC"), sa.text("id DESC")],
        unique=False,
    )
    op.create_index(
        "ix_articles_title_fingerprint_published_at",
        "articles",
        ["title_fingerprint", sa.text("published_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_articles_title_fingerprint_published_at", table_name="articles")
    op.drop_index("ix_articles_published_at_id", table_name="articles")
    op.drop_column("articles", "title_fingerprint")

"""create articles table

Revision ID: 0001
Revises:
Create Date: 2026-07-20
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "articles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("article_url", sa.String(2000), nullable=False),
        sa.Column("normalized_url", sa.String(2000), nullable=False),
        sa.Column("source", sa.String(120), nullable=False),
        sa.Column("image_url", sa.String(2000)),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True)),
        sa.Column("sentiment", sa.String(16), nullable=False),
        sa.Column("sentiment_confidence", sa.Float(), nullable=False),
        sa.Column("positive_probability", sa.Float(), nullable=False),
        sa.Column("negative_probability", sa.Float(), nullable=False),
        sa.Column("neutral_probability", sa.Float(), nullable=False),
        sa.Column("impact_score", sa.Integer(), nullable=False),
        sa.Column("urgency", sa.String(16), nullable=False),
        sa.Column("tickers", sa.JSON(), nullable=False),
        sa.Column("sector", sa.String(80)),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("processing_error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("external_id"),
        sa.UniqueConstraint("content_hash"),
    )
    for name, columns in [
        ("ix_articles_published_at", ["published_at"]),
        ("ix_articles_sentiment", ["sentiment"]),
        ("ix_articles_impact_score", ["impact_score"]),
        ("ix_articles_content_hash", ["content_hash"]),
        ("ix_articles_external_id", ["external_id"]),
    ]:
        op.create_index(name, "articles", columns)


def downgrade():
    op.drop_table("articles")

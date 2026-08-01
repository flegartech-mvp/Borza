"""add normalized source, relevance, and duplicate metadata

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-01
"""

import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("articles") as batch_op:
        batch_op.add_column(sa.Column("source_id", sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column("source_domain", sa.String(length=255), nullable=True))
        batch_op.add_column(
            sa.Column(
                "source_type", sa.String(length=20), nullable=False, server_default="editorial"
            )
        )
        batch_op.add_column(sa.Column("canonical_url", sa.String(length=2000), nullable=True))
        batch_op.add_column(sa.Column("original_url", sa.String(length=2000), nullable=True))
        batch_op.add_column(sa.Column("latitude", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("longitude", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("categories", sa.JSON(), nullable=False, server_default="[]"))
        batch_op.add_column(
            sa.Column("organizations", sa.JSON(), nullable=False, server_default="[]")
        )
        batch_op.add_column(sa.Column("companies", sa.JSON(), nullable=False, server_default="[]"))
        batch_op.add_column(
            sa.Column("asset_classes", sa.JSON(), nullable=False, server_default="[]")
        )
        batch_op.add_column(
            sa.Column("trust_score", sa.Integer(), nullable=False, server_default="50")
        )
        batch_op.add_column(
            sa.Column("relevance_score", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(sa.Column("relevance_reason", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("duplicate_group_id", sa.String(length=64), nullable=True))
        batch_op.add_column(
            sa.Column("duplicate_count", sa.Integer(), nullable=False, server_default="1")
        )
        batch_op.add_column(
            sa.Column("alternative_sources", sa.JSON(), nullable=False, server_default="[]")
        )
        batch_op.add_column(
            sa.Column(
                "extraction_status",
                sa.String(length=24),
                nullable=False,
                server_default="provider_metadata",
            )
        )
        batch_op.add_column(
            sa.Column("is_stale", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(
            sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.false())
        )

    op.execute("UPDATE articles SET canonical_url = normalized_url, original_url = article_url")
    op.execute(
        "UPDATE articles SET source_type = CASE "
        "WHEN provider = 'rss' THEN 'official' "
        "WHEN provider = 'gdelt' THEN 'discovery' "
        "WHEN provider = 'demo' THEN 'demo' "
        "ELSE 'editorial' END"
    )
    op.execute(
        "UPDATE articles SET trust_score = CASE "
        "WHEN provider = 'rss' THEN 90 "
        "WHEN provider = 'gdelt' THEN 45 "
        "WHEN provider = 'demo' THEN 0 "
        "ELSE 60 END, "
        "relevance_score = COALESCE(impact_score_base, impact_score, 0), "
        "is_demo = CASE WHEN provider = 'demo' THEN true ELSE false END"
    )
    op.create_index("ix_articles_source_domain", "articles", ["source_domain"])
    op.create_index(
        "ix_articles_source_type_published_at", "articles", ["source_type", "published_at"]
    )
    op.create_index(
        "ix_articles_relevance_published_at", "articles", ["relevance_score", "published_at"]
    )
    op.create_index("ix_articles_duplicate_group_id", "articles", ["duplicate_group_id"])


def downgrade() -> None:
    op.drop_index("ix_articles_duplicate_group_id", table_name="articles")
    op.drop_index("ix_articles_relevance_published_at", table_name="articles")
    op.drop_index("ix_articles_source_type_published_at", table_name="articles")
    op.drop_index("ix_articles_source_domain", table_name="articles")
    with op.batch_alter_table("articles") as batch_op:
        for column in (
            "is_demo",
            "is_stale",
            "extraction_status",
            "alternative_sources",
            "duplicate_count",
            "duplicate_group_id",
            "relevance_reason",
            "relevance_score",
            "trust_score",
            "asset_classes",
            "companies",
            "organizations",
            "categories",
            "longitude",
            "latitude",
            "original_url",
            "canonical_url",
            "source_type",
            "source_domain",
            "source_id",
        ):
            batch_op.drop_column(column)

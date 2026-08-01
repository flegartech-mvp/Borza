"""add provider and geography metadata to articles

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-27
"""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    # batch mode keeps this migration valid for the zero-config SQLite path as
    # well as PostgreSQL deployments.
    with op.batch_alter_table("articles") as batch_op:
        batch_op.add_column(sa.Column("provider", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("provider_article_id", sa.String(length=255), nullable=True))
        batch_op.add_column(
            sa.Column("provider_payload_version", sa.String(length=32), nullable=True)
        )
        batch_op.add_column(sa.Column("source_country", sa.String(length=8), nullable=True))
        batch_op.add_column(sa.Column("language", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("country_code", sa.String(length=8), nullable=True))
        batch_op.add_column(sa.Column("country_name", sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column("region", sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column("geography_confidence", sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column("geography_reason", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("geography_is_inferred", sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column("sentiment_source", sa.String(length=64), nullable=True))
        batch_op.create_unique_constraint(
            "uq_articles_provider_provider_article_id", ["provider", "provider_article_id"]
        )


def downgrade():
    with op.batch_alter_table("articles") as batch_op:
        batch_op.drop_constraint("uq_articles_provider_provider_article_id", type_="unique")
        batch_op.drop_column("sentiment_source")
        batch_op.drop_column("geography_is_inferred")
        batch_op.drop_column("geography_reason")
        batch_op.drop_column("geography_confidence")
        batch_op.drop_column("region")
        batch_op.drop_column("country_name")
        batch_op.drop_column("country_code")
        batch_op.drop_column("language")
        batch_op.drop_column("source_country")
        batch_op.drop_column("provider_payload_version")
        batch_op.drop_column("provider_article_id")
        batch_op.drop_column("provider")

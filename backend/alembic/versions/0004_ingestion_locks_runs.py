import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "ingestion_locks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("lock_name", sa.String(80), nullable=False, unique=True),
        sa.Column("owner_token", sa.String(80), nullable=False),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("heartbeat_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("job_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("requested_from", sa.DateTime(timezone=True)),
        sa.Column("requested_to", sa.DateTime(timezone=True)),
        sa.Column("records_received", sa.Integer()),
        sa.Column("records_inserted", sa.Integer()),
        sa.Column("request_count", sa.Integer()),
        sa.Column("saturated_windows", sa.Integer()),
        sa.Column("failed_windows", sa.Integer()),
        sa.Column("last_error", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )


def downgrade():
    op.drop_table("ingestion_runs")
    op.drop_table("ingestion_locks")

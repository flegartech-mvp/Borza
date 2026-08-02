"""record simulator precommitment evidence for process scoring

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-02
"""

import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("simulation_sessions") as batch_op:
        batch_op.add_column(
            sa.Column("decision_note", sa.Text(), nullable=False, server_default="")
        )
        batch_op.add_column(
            sa.Column(
                "risk_defined_before_entry",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(
            sa.Column(
                "concentration_checked",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("simulation_sessions") as batch_op:
        batch_op.drop_column("concentration_checked")
        batch_op.drop_column("risk_defined_before_entry")
        batch_op.drop_column("decision_note")

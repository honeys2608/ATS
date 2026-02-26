from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "07e2a75dda5f"
down_revision = "8e4d90151c39"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "live_interviews",
        sa.Column("scheduled_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("live_interviews", "scheduled_at")

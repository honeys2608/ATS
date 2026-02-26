"""add submission_id to live_interviews

Revision ID: a280f290c02f
Revises: c19cfb2d3698
Create Date: 2026-01-30 12:17:42.699288
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a280f290c02f"
down_revision: Union[str, Sequence[str], None] = "c19cfb2d3698"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1️⃣ Add submission_id column (nullable first – SAFE)
    op.add_column(
        "live_interviews",
        sa.Column("submission_id", sa.String(), nullable=True),
    )

    # 2️⃣ Add foreign key constraint
    op.create_foreign_key(
        "fk_live_interviews_submission_id",
        "live_interviews",
        "candidate_submissions",
        ["submission_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # Reverse safely
    op.drop_constraint(
        "fk_live_interviews_submission_id",
        "live_interviews",
        type_="foreignkey",
    )
    op.drop_column("live_interviews", "submission_id")

"""add created_by and shortlisted_at to job_applications

Revision ID: b2123df9a3fb
Revises: f7b5244b2367
Create Date: 2026-01-07 17:31:37.480728
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2123df9a3fb'
down_revision: Union[str, Sequence[str], None] = 'f7b5244b2367'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 👇 recruiter id store karne ke liye
    op.add_column(
        "job_applications",
        sa.Column("created_by", sa.String(), nullable=True)
    )

    # 👇 shortlist timestamp ke liye
    op.add_column(
        "job_applications",
        sa.Column("shortlisted_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("job_applications", "shortlisted_at")
    op.drop_column("job_applications", "created_by")

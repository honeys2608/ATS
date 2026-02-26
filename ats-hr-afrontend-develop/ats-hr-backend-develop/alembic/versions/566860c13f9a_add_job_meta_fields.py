"""add job meta fields

Revision ID: 566860c13f9a
Revises: 2be8618c6bd4
Create Date: 2026-01-19 11:34:52.419861

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '566860c13f9a'
down_revision: Union[str, Sequence[str], None] = '2be8618c6bd4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "jobs",
        sa.Column("job_type", sa.String(length=50), nullable=True)
    )

    op.add_column(
        "jobs",
        sa.Column("salary_range", sa.String(length=100), nullable=True)
    )

    op.add_column(
        "jobs",
        sa.Column("apply_by", sa.Date(), nullable=True)
    )

    op.add_column(
        "jobs",
        sa.Column("sla_days", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("jobs", "sla_days")
    op.drop_column("jobs", "apply_by")
    op.drop_column("jobs", "salary_range")
    op.drop_column("jobs", "job_type")

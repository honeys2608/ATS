"""add linkedin and portfolio to job applications

Revision ID: 860b54eab7e0
Revises: 33908239abd8
Create Date: 2025-12-16 16:32:17.436517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '860b54eab7e0'
down_revision: Union[str, Sequence[str], None] = '33908239abd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "job_applications",
        sa.Column("linkedin_url", sa.String(), nullable=True)
    )
    op.add_column(
        "job_applications",
        sa.Column("portfolio_url", sa.String(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("job_applications", "linkedin_url")
    op.drop_column("job_applications", "portfolio_url")

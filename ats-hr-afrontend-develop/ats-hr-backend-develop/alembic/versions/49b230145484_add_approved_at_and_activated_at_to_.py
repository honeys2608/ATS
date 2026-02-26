"""add approved_at and activated_at to requirements

Revision ID: 49b230145484
Revises: 32d3f1dd08a6
Create Date: 2026-01-07 17:21:47.425706
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '49b230145484'
down_revision: Union[str, Sequence[str], None] = '32d3f1dd08a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "requirements",
        sa.Column("approved_at", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "requirements",
        sa.Column("activated_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("requirements", "activated_at")
    op.drop_column("requirements", "approved_at")

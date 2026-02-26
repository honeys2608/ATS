"""add job_id to jobs table

Revision ID: a67663c297ef
Revises: bd7965cb4e89
Create Date: 2025-12-12 14:03:24.109633

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a67663c297ef'
down_revision: Union[str, Sequence[str], None] = 'bd7965cb4e89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

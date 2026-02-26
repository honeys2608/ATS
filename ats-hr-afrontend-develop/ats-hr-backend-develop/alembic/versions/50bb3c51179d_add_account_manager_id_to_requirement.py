"""add account_manager_id to requirement

Revision ID: 50bb3c51179d
Revises: ece853b08106
Create Date: 2026-01-07 14:02:58.079804

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '50bb3c51179d'
down_revision: Union[str, Sequence[str], None] = 'ece853b08106'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

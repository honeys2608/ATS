"""add account_manager_id to users

Revision ID: ece853b08106
Revises: 75164168fe0e
Create Date: 2026-01-07 13:48:48.399909

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ece853b08106'
down_revision: Union[str, Sequence[str], None] = '75164168fe0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

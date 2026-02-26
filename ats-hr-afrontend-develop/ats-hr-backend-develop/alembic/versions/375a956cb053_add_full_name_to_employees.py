"""add full_name to employees

Revision ID: 375a956cb053
Revises: 8e1e0cc9ce70
Create Date: 2026-01-05 18:01:45.018141

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '375a956cb053'
down_revision: Union[str, Sequence[str], None] = '8e1e0cc9ce70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

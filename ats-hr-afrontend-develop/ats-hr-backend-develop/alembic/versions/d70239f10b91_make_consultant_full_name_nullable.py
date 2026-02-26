"""make consultant full_name nullable

Revision ID: d70239f10b91
Revises: 88ae87a1e260
Create Date: 2025-12-17 15:33:34.918123

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd70239f10b91'
down_revision: Union[str, Sequence[str], None] = '88ae87a1e260'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

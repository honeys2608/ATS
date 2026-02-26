"""update candidate job employee models

Revision ID: 1355724b75c4
Revises: 4106fc762996
Create Date: 2025-12-12 17:33:05.508183

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1355724b75c4'
down_revision: Union[str, Sequence[str], None] = '4106fc762996'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

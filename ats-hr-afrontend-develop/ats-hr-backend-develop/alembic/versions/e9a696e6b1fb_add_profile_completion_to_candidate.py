"""add profile_completion to candidate

Revision ID: e9a696e6b1fb
Revises: 70acf4b5e6fb
Create Date: 2026-01-02 22:09:55.219517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9a696e6b1fb'
down_revision: Union[str, Sequence[str], None] = '70acf4b5e6fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

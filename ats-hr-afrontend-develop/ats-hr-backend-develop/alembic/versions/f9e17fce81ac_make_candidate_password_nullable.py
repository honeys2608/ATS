"""make candidate password nullable

Revision ID: f9e17fce81ac
Revises: 174c7d0ae436
Create Date: 2025-12-15 13:13:02.230106

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9e17fce81ac'
down_revision: Union[str, Sequence[str], None] = '174c7d0ae436'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

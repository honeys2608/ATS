"""add employee logs

Revision ID: 08791fa1a618
Revises: 9b500ab468b1
Create Date: 2026-01-09 16:31:14.396071

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08791fa1a618'
down_revision: Union[str, Sequence[str], None] = '9b500ab468b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

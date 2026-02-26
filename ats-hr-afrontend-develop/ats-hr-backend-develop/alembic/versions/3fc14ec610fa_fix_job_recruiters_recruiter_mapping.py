"""fix job_recruiters recruiter mapping

Revision ID: 3fc14ec610fa
Revises: 332a96041bc4
Create Date: 2025-12-23 12:40:41.086495

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3fc14ec610fa'
down_revision: Union[str, Sequence[str], None] = '332a96041bc4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

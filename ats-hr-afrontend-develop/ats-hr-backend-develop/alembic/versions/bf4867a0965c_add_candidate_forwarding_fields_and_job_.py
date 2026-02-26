"""add candidate forwarding fields and job_id field update

Revision ID: bf4867a0965c
Revises: a67663c297ef
Create Date: 2025-12-12 14:41:14.286347

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bf4867a0965c'
down_revision: Union[str, Sequence[str], None] = 'a67663c297ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

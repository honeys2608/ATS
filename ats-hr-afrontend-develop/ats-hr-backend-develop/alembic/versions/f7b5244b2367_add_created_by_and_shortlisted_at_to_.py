"""add created_by and shortlisted_at to job_applications

Revision ID: f7b5244b2367
Revises: 49b230145484
Create Date: 2026-01-07 17:27:58.211335

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7b5244b2367'
down_revision: Union[str, Sequence[str], None] = '49b230145484'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

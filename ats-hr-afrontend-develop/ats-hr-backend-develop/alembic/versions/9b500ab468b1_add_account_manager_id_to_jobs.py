"""add account_manager_id to jobs

Revision ID: 9b500ab468b1
Revises: c5b67ab26c21
Create Date: 2026-01-09 14:09:52.117342

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b500ab468b1'
down_revision: Union[str, Sequence[str], None] = 'c5b67ab26c21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # column already exists — no-op
    pass

def downgrade() -> None:
    pass

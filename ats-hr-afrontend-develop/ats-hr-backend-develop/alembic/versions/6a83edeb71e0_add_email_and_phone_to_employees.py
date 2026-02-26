"""add email and phone to employees

Revision ID: 6a83edeb71e0
Revises: d87c047b6e36
Create Date: 2026-01-06 11:53:33.963172

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a83edeb71e0'
down_revision: Union[str, Sequence[str], None] = 'd87c047b6e36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

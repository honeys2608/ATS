"""add missing fields to candidates

Revision ID: 174c7d0ae436
Revises: db9995969979
Create Date: 2025-12-15 13:02:08.863525

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '174c7d0ae436'
down_revision: Union[str, Sequence[str], None] = 'db9995969979'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    pass



def downgrade() -> None:
    """Downgrade schema."""
    pass

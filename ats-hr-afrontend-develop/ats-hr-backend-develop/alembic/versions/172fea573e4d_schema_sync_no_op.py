"""schema sync (no-op)

Revision ID: 172fea573e4d
Revises: 05cebc04ab1a
Create Date: 2026-01-13 15:59:18.014354

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '172fea573e4d'
down_revision: Union[str, Sequence[str], None] = '05cebc04ab1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

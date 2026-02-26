"""fix user account_manager_id

Revision ID: 2724aec16862
Revises: 50bb3c51179d
Create Date: 2026-01-07 14:18:37.257583

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2724aec16862'
down_revision: Union[str, Sequence[str], None] = '50bb3c51179d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

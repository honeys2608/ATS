"""merge alembic heads

Revision ID: 4cdc7c7fde26
Revises: 4f1a20088c93, user_profile_settings_module
Create Date: 2026-01-28 16:22:48.953254

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cdc7c7fde26'
down_revision: Union[str, Sequence[str], None] = ('4f1a20088c93', 'user_profile_settings_module')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

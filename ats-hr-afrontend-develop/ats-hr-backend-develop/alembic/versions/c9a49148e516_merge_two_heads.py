"""merge two heads

Revision ID: c9a49148e516
Revises: a4c9960013fd, df3094f030e0
Create Date: 2025-12-05 16:32:10.546354

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9a49148e516'
down_revision: Union[str, Sequence[str], None] = ('a4c9960013fd', 'df3094f030e0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

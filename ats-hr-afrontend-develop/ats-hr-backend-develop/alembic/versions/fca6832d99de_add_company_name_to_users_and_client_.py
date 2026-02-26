"""add company_name to users and client_contacts table

Revision ID: fca6832d99de
Revises: 953c56ef011b
Create Date: 2025-12-29 22:57:38.479315

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fca6832d99de'
down_revision: Union[str, Sequence[str], None] = '953c56ef011b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

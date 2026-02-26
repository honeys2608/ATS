"""merge heads after submission_id

Revision ID: 4f1a20088c93
Revises: 75205bdf8117, add_submission_id_interviews
Create Date: 2026-01-26 22:05:11.876574

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f1a20088c93'
down_revision: Union[str, Sequence[str], None] = ('75205bdf8117', 'add_submission_id_interviews')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

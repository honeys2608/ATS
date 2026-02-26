"""rename meeting_url to meeting_link in live_interviews

Revision ID: c19cfb2d3698
Revises: 5e8a1c5c4346
Create Date: 2026-01-29 15:40:30.546942

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c19cfb2d3698'
down_revision: Union[str, Sequence[str], None] = '5e8a1c5c4346'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename column meeting_url → meeting_link
    op.alter_column(
        "live_interviews",
        "meeting_url",
        new_column_name="meeting_link"
    )


def downgrade() -> None:
    # Revert column meeting_link → meeting_url
    op.alter_column(
        "live_interviews",
        "meeting_link",
        new_column_name="meeting_url"
    )

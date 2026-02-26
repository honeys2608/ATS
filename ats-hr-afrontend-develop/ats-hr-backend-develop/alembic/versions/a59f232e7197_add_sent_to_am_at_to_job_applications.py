"""add sent_to_am_at to job_applications

Revision ID: a59f232e7197
Revises: 86988e8d2c13
Create Date: 2026-01-08 17:39:57.878984

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a59f232e7197'
down_revision: Union[str, Sequence[str], None] = '86988e8d2c13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "job_applications",
        sa.Column("sent_to_am_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("job_applications", "sent_to_am_at")

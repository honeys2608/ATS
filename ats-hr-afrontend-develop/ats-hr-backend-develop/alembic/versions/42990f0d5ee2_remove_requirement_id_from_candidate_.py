"""remove requirement_id from candidate_submissions

Revision ID: 42990f0d5ee2
Revises: 4cdc7c7fde26
Create Date: 2026-01-28 16:24:24.618988

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42990f0d5ee2'
down_revision: Union[str, Sequence[str], None] = '4cdc7c7fde26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column("candidate_submissions", "requirement_id")


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "candidate_submissions",
        sa.Column("requirement_id", sa.String(), nullable=True)
    )

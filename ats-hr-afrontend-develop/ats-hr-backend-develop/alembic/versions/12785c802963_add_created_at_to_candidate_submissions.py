"""add created_at to candidate_submissions

Revision ID: 12785c802963
Revises: a280f290c02f
Create Date: 2026-01-30 15:52:04.581458

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '12785c802963'
down_revision: Union[str, Sequence[str], None] = 'a280f290c02f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1️⃣ Add column with TEMP default (safe for existing rows)
    op.add_column(
        'candidate_submissions',
        sa.Column(
            'created_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            nullable=False
        )
    )

    # 2️⃣ Remove server default (keep app-level default)
    op.alter_column(
        'candidate_submissions',
        'created_at',
        server_default=None
    )


def downgrade() -> None:
    op.drop_column('candidate_submissions', 'created_at')

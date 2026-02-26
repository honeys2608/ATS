"""add candidate merge fields

Revision ID: 8e4d90151c39
Revises: 566860c13f9a
Create Date: 2026-01-19 15:59:09.808417

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e4d90151c39'
down_revision: Union[str, Sequence[str], None] = '566860c13f9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================
    # Candidate merge support
    # ============================

    # 1️⃣ Add is_active with DEFAULT (very important)
    op.add_column(
        'candidates',
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.true()
        )
    )

    # 2️⃣ Add merged_into_id
    op.add_column(
        'candidates',
        sa.Column(
            'merged_into_id',
            sa.String(),
            nullable=True
        )
    )

    # 3️⃣ Self-referencing FK
    op.create_foreign_key(
        'fk_candidates_merged_into',
        'candidates',
        'candidates',
        ['merged_into_id'],
        ['id']
    )

    # ============================
    # (Optional but recommended)
    # Remove server default after backfill
    # ============================
    op.alter_column(
        'candidates',
        'is_active',
        server_default=None
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_candidates_merged_into',
        'candidates',
        type_='foreignkey'
    )
    op.drop_column('candidates', 'merged_into_id')
    op.drop_column('candidates', 'is_active')

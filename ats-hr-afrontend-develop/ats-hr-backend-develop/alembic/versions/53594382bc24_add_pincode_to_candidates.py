"""add pincode to candidates

Revision ID: 53594382bc24
Revises: e7e43f6611b1
Create Date: 2026-01-21 16:35:25.649368

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '53594382bc24'
down_revision: Union[str, Sequence[str], None] = 'e7e43f6611b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column(
        'candidates',
        sa.Column('pincode', sa.String(length=20), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('candidates', 'pincode')

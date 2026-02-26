"""add profile_completion to candidates

Revision ID: a2804d8771a8
Revises: e9a696e6b1fb
Create Date: 2026-01-02 22:12:26.792573

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2804d8771a8'
down_revision: Union[str, Sequence[str], None] = 'e9a696e6b1fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column(
            "profile_completion",
            sa.Integer(),
            nullable=False,
            server_default="0"
        )
    )


def downgrade() -> None:
    op.drop_column("candidates", "profile_completion")

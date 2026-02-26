"""add classification to candidates

Revision ID: cd211093e375
Revises: 83497ae7f8a2
Create Date: 2025-12-16 12:29:06.049067
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cd211093e375'
down_revision: Union[str, Sequence[str], None] = '83497ae7f8a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Upgrade schema.
    """
    # ✅ add classification column
    op.add_column(
        "candidates",
        sa.Column(
            "classification",
            sa.String(length=50),
            nullable=False,
            server_default="unclassified"
        )
    )


def downgrade() -> None:
    """
    Downgrade schema.
    """
    # ❌ remove classification column
    op.drop_column("candidates", "classification")

"""add identity fields to consultant

Revision ID: 88ae87a1e260
Revises: 2f6959b38037
Create Date: 2025-12-17 14:08:41.265456
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "88ae87a1e260"
down_revision: Union[str, Sequence[str], None] = "2f6959b38037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1️⃣ Add columns as NULLABLE first
    op.add_column(
        "consultants",
        sa.Column("full_name", sa.String(), nullable=True),
    )
    op.add_column(
        "consultants",
        sa.Column("email", sa.String(), nullable=True),
    )
    op.add_column(
        "consultants",
        sa.Column("phone", sa.String(), nullable=True),
    )

    # 2️⃣ Backfill existing rows safely
    op.execute(
        """
        UPDATE consultants
        SET full_name = 'Unknown Consultant'
        WHERE full_name IS NULL
        """
    )

    op.execute(
        """
        UPDATE consultants
        SET email = CONCAT(id, '@placeholder.local')
        WHERE email IS NULL
        """
    )

    # 3️⃣ Now enforce NOT NULL
    op.alter_column("consultants", "full_name", nullable=False)
    op.alter_column("consultants", "email", nullable=False)



def downgrade() -> None:
    # 🔄 ROLLBACK
    op.drop_column("consultants", "phone")
    op.drop_column("consultants", "email")
    op.drop_column("consultants", "full_name")

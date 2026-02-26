"""add account_manager_id to users

Revision ID: 8ee2c61755ca
Revises: 2724aec16862
Create Date: 2026-01-07 14:24:18.795695
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8ee2c61755ca"
down_revision: Union[str, Sequence[str], None] = "2724aec16862"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ✅ ADD COLUMN
    op.add_column(
        "users",
        sa.Column("account_manager_id", sa.String(), nullable=True)
    )


def downgrade() -> None:
    # ✅ REMOVE COLUMN
    op.drop_column("users", "account_manager_id")

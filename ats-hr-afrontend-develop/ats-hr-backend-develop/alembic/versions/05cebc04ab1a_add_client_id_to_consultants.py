"""add client_id to consultants

Revision ID: 05cebc04ab1a
Revises: 6e803c9319b0
Create Date: 2026-01-12 18:12:58.566094
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "05cebc04ab1a"
down_revision: Union[str, Sequence[str], None] = "6e803c9319b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ✅ ONLY what we want
    op.add_column(
        "consultants",
        sa.Column("client_id", sa.String(), nullable=True)
    )

    op.create_foreign_key(
        "fk_consultants_client_id_users",
        "consultants",
        "users",
        ["client_id"],
        ["id"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_consultants_client_id_users",
        "consultants",
        type_="foreignkey"
    )

    op.drop_column("consultants", "client_id")

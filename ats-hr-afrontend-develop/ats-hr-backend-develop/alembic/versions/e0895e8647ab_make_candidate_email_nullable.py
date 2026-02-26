"""make candidate email nullable

Revision ID: e0895e8647ab
Revises: 12785c802963
Create Date: 2026-01-30 18:13:12.032452
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "e0895e8647ab"
down_revision = "12785c802963"
branch_labels = None
depends_on = None


def upgrade():
    # ✅ ONLY what we want: allow NULL email
    op.alter_column(
        "candidates",
        "email",
        existing_type=sa.String(),
        nullable=True
    )


def downgrade():
    # ⚠️ Only downgrade if you are sure no NULL emails exist
    op.alter_column(
        "candidates",
        "email",
        existing_type=sa.String(),
        nullable=False
    )

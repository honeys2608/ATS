"""add skills master table

Revision ID: 58884b0e34cd
Revises: 07e2a75dda5f
Create Date: 2026-01-20 13:10:13.135106

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58884b0e34cd'
down_revision: Union[str, Sequence[str], None] = '07e2a75dda5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "skills",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("normalized_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("normalized_name", name="uq_skill_normalized"),
    )

    op.create_index(
        "ix_skills_normalized_name",
        "skills",
        ["normalized_name"],
    )


def downgrade() -> None:
    op.drop_index("ix_skills_normalized_name", table_name="skills")
    op.drop_table("skills")

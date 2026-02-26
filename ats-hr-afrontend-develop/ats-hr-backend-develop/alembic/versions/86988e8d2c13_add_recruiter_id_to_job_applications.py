"""add recruiter_id to job_applications

Revision ID: 86988e8d2c13
Revises: b2123df9a3fb
Create Date: 2026-01-07 18:41:54.714307
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "86988e8d2c13"
down_revision: Union[str, Sequence[str], None] = "b2123df9a3fb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ✅ 1. Add recruiter_id column
    op.add_column(
        "job_applications",
        sa.Column("recruiter_id", sa.String(), nullable=True)
    )

    # ✅ 2. Create foreign key to users.id
    op.create_foreign_key(
        "fk_job_applications_recruiter_id",
        source_table="job_applications",
        referent_table="users",
        local_cols=["recruiter_id"],
        remote_cols=["id"]
    )


def downgrade() -> None:
    # 🔁 Reverse operations safely
    op.drop_constraint(
        "fk_job_applications_recruiter_id",
        "job_applications",
        type_="foreignkey"
    )
    op.drop_column("job_applications", "recruiter_id")

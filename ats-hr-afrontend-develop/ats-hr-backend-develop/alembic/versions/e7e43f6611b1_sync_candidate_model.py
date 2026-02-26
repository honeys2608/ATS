"""sync candidate model

Revision ID: e7e43f6611b1
Revises: 58884b0e34cd
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e7e43f6611b1"
down_revision = "58884b0e34cd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # =====================================================
    # TIMESHEETS ENUM FIX
    # Drop default → cast → add default
    # =====================================================

    # 1. Drop default
    op.execute(
        "ALTER TABLE timesheets ALTER COLUMN status DROP DEFAULT"
    )

    # 2. Change type to enum
    op.execute(
        "ALTER TABLE timesheets "
        "ALTER COLUMN status TYPE timesheet_status "
        "USING status::timesheet_status"
    )

    # 3. Re-add default
    op.execute(
        "ALTER TABLE timesheets "
        "ALTER COLUMN status SET DEFAULT 'draft'"
    )

    # =====================================================
    # JOB APPLICATIONS FIXES
    # =====================================================

    op.alter_column(
        "job_applications",
        "ready_for_assignment",
        existing_type=sa.BOOLEAN(),
        nullable=True,
        existing_server_default=sa.text("false"),
    )

    op.drop_index(
        "uq_job_applications_unique",
        table_name="job_applications",
    )

    op.drop_column(
        "job_applications",
        "created_by",
    )

    # =====================================================
    # FOREIGN KEYS
    # =====================================================

    op.create_foreign_key(
        None,
        "requirements",
        "users",
        ["account_manager_id"],
        ["id"],
    )

    op.create_foreign_key(
        None,
        "users",
        "users",
        ["account_manager_id"],
        ["id"],
    )


def downgrade() -> None:
    # =====================================================
    # SAFE MINIMAL DOWNGRADE
    # =====================================================

    op.drop_constraint(None, "users", type_="foreignkey")
    op.drop_constraint(None, "requirements", type_="foreignkey")

    op.add_column(
        "job_applications",
        sa.Column("created_by", sa.VARCHAR(), nullable=True),
    )

    op.create_index(
        "uq_job_applications_unique",
        "job_applications",
        ["candidate_id", "job_id"],
        unique=True,
    )

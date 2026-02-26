"""candidate_submission_and_interview_fix

Revision ID: 75205bdf8117
Revises: 53594382bc24
Create Date: 2026-01-22 11:44:07.050037

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '75205bdf8117'
down_revision: Union[str, Sequence[str], None] = '53594382bc24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1️⃣ Create candidate_submissions table
    op.create_table(
        "candidate_submissions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("candidate_id", sa.String(), nullable=False),
        sa.Column("job_id", sa.String(), nullable=False),
        sa.Column("recruiter_id", sa.String(), nullable=False),
        sa.Column("match_score", sa.Float(), nullable=False),
        sa.Column("match_details", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("shortlisted_at", sa.DateTime(), nullable=True),
        sa.Column("decision_at", sa.DateTime(), nullable=True),

        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),

        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "candidate_id",
            "job_id",
            name="uq_candidate_submission"
        )
    )

    # 2️⃣ Add submission_id to interviews
    op.add_column(
        "interviews",
        sa.Column("submission_id", sa.String(), nullable=False)
    )

    op.create_foreign_key(
        "fk_interviews_submission",
        "interviews",
        "candidate_submissions",
        ["submission_id"],
        ["id"]
    )

    # 3️⃣ Remove old direct links
    op.drop_column("interviews", "candidate_id")
    op.drop_column("interviews", "job_id")

def downgrade() -> None:
    # 1️⃣ Restore candidate_id & job_id in interviews
    op.add_column(
        "interviews",
        sa.Column("candidate_id", sa.String(), nullable=True)
    )
    op.add_column(
        "interviews",
        sa.Column("job_id", sa.String(), nullable=True)
    )

    # 2️⃣ Drop FK and submission_id
    op.drop_constraint(
        "fk_interviews_submission",
        "interviews",
        type_="foreignkey"
    )
    op.drop_column("interviews", "submission_id")

    # 3️⃣ Drop candidate_submissions table
    op.drop_table("candidate_submissions")

"""Add candidate bulk upload fields and logs

Revision ID: 20260203_bulk_upload_fields
Revises:
Create Date: 2026-02-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "20260203_bulk_upload_fields"
down_revision = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    def column_exists(table, column):
        sql = """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :table AND column_name = :column
        """
        return bool(conn.execute(text(sql), {"table": table, "column": column}).fetchone())

    columns = [
        ("alternate_phone", sa.String(), True),
        ("gender", sa.String(), True),
        ("marital_status", sa.String(), True),
        ("state", sa.String(), True),
        ("country", sa.String(), True),
        ("current_job_title", sa.String(), True),
        ("relevant_experience_years", sa.Float(), True),
        ("qualification", sa.String(), True),
        ("university", sa.String(), True),
        ("graduation_year", sa.Integer(), True),
        ("certifications_text", sa.Text(), True),
        ("notice_period_days", sa.Integer(), True),
        ("primary_skill", sa.String(), True),
        ("secondary_skill", sa.String(), True),
        ("current_ctc", sa.Float(), True),
        ("willing_to_relocate", sa.Boolean(), True),
        ("preferred_employment_type", sa.String(), True),
        ("availability_to_join", sa.Date(), True),
        ("last_working_day", sa.Date(), True),
    ]

    for name, col_type, nullable in columns:
        if not column_exists("candidates", name):
            op.add_column("candidates", sa.Column(name, col_type, nullable=nullable))

    if not conn.dialect.has_table(conn, "candidate_bulk_upload_logs"):
        op.create_table(
            "candidate_bulk_upload_logs",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("uploaded_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("filename", sa.String(), nullable=True),
            sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("success_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("error_csv_path", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )


def downgrade():
    op.drop_table("candidate_bulk_upload_logs")
    op.drop_column("candidates", "last_working_day")
    op.drop_column("candidates", "availability_to_join")
    op.drop_column("candidates", "preferred_employment_type")
    op.drop_column("candidates", "willing_to_relocate")
    op.drop_column("candidates", "current_ctc")
    op.drop_column("candidates", "secondary_skill")
    op.drop_column("candidates", "primary_skill")
    op.drop_column("candidates", "notice_period_days")
    op.drop_column("candidates", "certifications_text")
    op.drop_column("candidates", "graduation_year")
    op.drop_column("candidates", "university")
    op.drop_column("candidates", "qualification")
    op.drop_column("candidates", "relevant_experience_years")
    op.drop_column("candidates", "current_job_title")
    op.drop_column("candidates", "country")
    op.drop_column("candidates", "state")
    op.drop_column("candidates", "marital_status")
    op.drop_column("candidates", "gender")
    op.drop_column("candidates", "alternate_phone")

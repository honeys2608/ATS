"""Add SavedSearch, Folder, and CandidateInvite tables

Revision ID: 001_resdex_tables
Revises: 
Create Date: 2026-02-02 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '001_resdex_tables'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    def table_exists(table_name):
        sql = """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = :table
        """
        return bool(conn.execute(text(sql), {"table": table_name}).fetchone())

    # Create SavedSearch table
    if not table_exists("saved_searches"):
        op.create_table(
            "saved_searches",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("folder_id", sa.String(), nullable=True),
            sa.Column("query", sa.String(), nullable=False),
            sa.Column("logic", sa.String(), server_default="OR"),
            sa.Column("min_exp", sa.Float(), nullable=True),
            sa.Column("max_exp", sa.Float(), nullable=True),
            sa.Column("location", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.Column("last_used_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    # Create Folder table
    if not table_exists("folders"):
        op.create_table(
            "folders",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    if table_exists("saved_searches") and table_exists("folders"):
        # Add folder_id FK to saved_searches if missing
        op.create_foreign_key(
            "fk_saved_searches_folder",
            "saved_searches",
            "folders",
            ["folder_id"],
            ["id"],
        )

    # Create CandidateInvite table
    if not table_exists("candidate_invites"):
        op.create_table(
            "candidate_invites",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("candidate_id", sa.String(), nullable=False),
            sa.Column("recruiter_id", sa.String(), nullable=False),
            sa.Column("job_id", sa.String(), nullable=True),
            sa.Column("status", sa.String(), server_default="sent"),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("opened_at", sa.DateTime(), nullable=True),
            sa.Column("responded_at", sa.DateTime(), nullable=True),
            sa.Column("response", sa.String(), nullable=True),
            sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
            sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade():
    op.drop_table('candidate_invites')
    op.drop_constraint('fk_saved_searches_folder', 'saved_searches', type_='foreignkey')
    op.drop_table('folders')
    op.drop_table('saved_searches')

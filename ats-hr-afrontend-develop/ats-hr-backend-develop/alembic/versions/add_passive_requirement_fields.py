"""
Add passive requirement tracking fields

Revision ID: add_passive_requirement_fields
Revises: add_submitted_status
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision = 'add_passive_requirement_fields'
down_revision = 'add_submitted_status'  # Previous migration
branch_labels = None
depends_on = None


def upgrade():
    # Add activity tracking fields to requirements table
    op.add_column('requirements', sa.Column('last_activity_at', sa.DateTime(), nullable=True))
    op.add_column('requirements', sa.Column('activity_status', sa.String(), nullable=True))
    op.add_column('requirements', sa.Column('passive_notification_sent', sa.Boolean(), nullable=True))
    op.add_column('requirements', sa.Column('last_passive_alert_at', sa.DateTime(), nullable=True))

    # Set default values for existing records
    op.execute("UPDATE requirements SET last_activity_at = created_at WHERE last_activity_at IS NULL")
    op.execute("UPDATE requirements SET activity_status = 'active' WHERE activity_status IS NULL")
    op.execute("UPDATE requirements SET passive_notification_sent = false WHERE passive_notification_sent IS NULL")

    # Make the new columns non-nullable after setting defaults
    op.alter_column('requirements', 'activity_status', nullable=False)
    op.alter_column('requirements', 'passive_notification_sent', nullable=False)

    # Create recruiter_activities table if missing (pre-existing deployments may already have it)
    conn = op.get_bind()
    if not conn.dialect.has_table(conn, "recruiter_activities"):
        op.create_table(
            "recruiter_activities",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("recruiter_id", sa.String(), nullable=False),
            sa.Column("requirement_id", sa.String(), nullable=False),
            sa.Column("activity_type", sa.String(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column(
                "activity_metadata",
                postgresql.JSON(astext_type=sa.Text()),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["requirement_id"], ["requirements.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_recruiter_activities_recruiter_id ON recruiter_activities (recruiter_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_recruiter_activities_requirement_id ON recruiter_activities (requirement_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_recruiter_activities_activity_type ON recruiter_activities (activity_type)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_recruiter_activities_created_at ON recruiter_activities (created_at)"
        )

    # Create system_notifications table if missing
    if not conn.dialect.has_table(conn, "system_notifications"):
        op.create_table(
            "system_notifications",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("notification_type", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("requirement_id", sa.String(), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=True),
            sa.Column("read_at", sa.DateTime(), nullable=True),
            sa.Column("priority", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["requirement_id"], ["requirements.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_system_notifications_user_id ON system_notifications (user_id)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_system_notifications_is_read ON system_notifications (is_read)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_system_notifications_notification_type ON system_notifications (notification_type)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_system_notifications_priority ON system_notifications (priority)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_system_notifications_created_at ON system_notifications (created_at)"
        )


def downgrade():
    # Drop system_notifications table
    op.drop_index('ix_system_notifications_created_at')
    op.drop_index('ix_system_notifications_priority')
    op.drop_index('ix_system_notifications_notification_type')
    op.drop_index('ix_system_notifications_is_read')
    op.drop_index('ix_system_notifications_user_id')
    op.drop_table('system_notifications')

    # Drop recruiter_activities table
    op.drop_index('ix_recruiter_activities_created_at')
    op.drop_index('ix_recruiter_activities_activity_type')
    op.drop_index('ix_recruiter_activities_requirement_id')
    op.drop_index('ix_recruiter_activities_recruiter_id')
    op.drop_table('recruiter_activities')

    # Remove columns from requirements table
    op.drop_column('requirements', 'last_passive_alert_at')
    op.drop_column('requirements', 'passive_notification_sent')
    op.drop_column('requirements', 'activity_status')
    op.drop_column('requirements', 'last_activity_at')

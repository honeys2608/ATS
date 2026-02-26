"""
Alembic migration for user_preferences, password_reset_logs, account_activity_logs tables
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = 'user_profile_settings_module'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # user_preferences table
    op.create_table(
        'user_preferences',
        sa.Column('id', sa.String, primary_key=True, default=lambda: str(uuid.uuid4())),
        sa.Column('user_id', sa.String, sa.ForeignKey('users.id'), nullable=False, unique=True),
        sa.Column('email_notifications', sa.Boolean, default=True),
        sa.Column('sms_alerts', sa.Boolean, default=False),
        sa.Column('report_emails', sa.Boolean, default=True),
        sa.Column('interview_reminders', sa.Boolean, default=True),
        sa.Column('two_factor_enabled', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # password_reset_logs table
    op.create_table(
        'password_reset_logs',
        sa.Column('id', sa.String, primary_key=True, default=lambda: str(uuid.uuid4())),
        sa.Column('user_id', sa.String, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reset_count', sa.Integer, default=0),
        sa.Column('last_reset_date', sa.DateTime),
        sa.Column('is_locked', sa.Boolean, default=False),
        sa.Column('request_reason', sa.String, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # account_activity_logs table
    op.create_table(
        'account_activity_logs',
        sa.Column('id', sa.String, primary_key=True, default=lambda: str(uuid.uuid4())),
        sa.Column('user_id', sa.String, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('action_type', sa.String, nullable=False),
        sa.Column('ip_address', sa.String, nullable=True),
        sa.Column('device_info', sa.String, nullable=True),
        sa.Column('timestamp', sa.DateTime, server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table('account_activity_logs')
    op.drop_table('password_reset_logs')
    op.drop_table('user_preferences')

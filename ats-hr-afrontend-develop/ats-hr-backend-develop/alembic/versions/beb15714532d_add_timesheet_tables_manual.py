"""add timesheet tables (manual)

Revision ID: beb15714532d
Revises: 172fea573e4d
Create Date: 2026-01-13 16:01:45.350044
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'beb15714532d'
down_revision: Union[str, Sequence[str], None] = '172fea573e4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =====================================================
    # TIMESHEETS TABLE (NO ENUM)
    # =====================================================
    op.create_table(
        'timesheets',
        sa.Column('id', sa.String(), primary_key=True),

        sa.Column(
            'deployment_id',
            sa.String(),
            sa.ForeignKey('consultant_deployments.id'),
            nullable=False
        ),

        sa.Column(
            'consultant_id',
            sa.String(),
            sa.ForeignKey('consultants.id'),
            nullable=False
        ),

        sa.Column(
            'client_id',
            sa.String(),
            sa.ForeignKey('users.id'),
            nullable=False
        ),

        sa.Column('period_type', sa.String(), nullable=False),  # weekly / monthly
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),

        sa.Column('total_hours', sa.Float(), server_default='0'),

        # ✅ STRING STATUS (SAFE)
        sa.Column(
            'status',
            sa.String(),
            nullable=False,
            server_default='draft'
        ),

        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('am_approved_at', sa.DateTime(), nullable=True),
        sa.Column('client_approved_at', sa.DateTime(), nullable=True),
        sa.Column('locked_at', sa.DateTime(), nullable=True),

        sa.Column('rejection_reason', sa.Text(), nullable=True),

        sa.Column(
            'created_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            nullable=False
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            nullable=False
        ),
    )

    # =====================================================
    # TIMESHEET ENTRIES TABLE
    # =====================================================
    op.create_table(
        'timesheet_entries',
        sa.Column('id', sa.String(), primary_key=True),

        sa.Column(
            'timesheet_id',
            sa.String(),
            sa.ForeignKey('timesheets.id'),
            nullable=False
        ),

        sa.Column('work_date', sa.Date(), nullable=False),
        sa.Column('hours', sa.Float(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),

        sa.Column(
            'created_at',
            sa.DateTime(),
            server_default=sa.text('now()'),
            nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_table('timesheet_entries')
    op.drop_table('timesheets')

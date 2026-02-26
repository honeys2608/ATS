"""add consultant deployment

Revision ID: 2f6959b38037
Revises: de3c5b1d6f37
Create Date: 2025-12-16 18:09:32.253284
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2f6959b38037'
down_revision: Union[str, Sequence[str], None] = 'de3c5b1d6f37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'consultant_deployments',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('consultant_id', sa.String(), nullable=False),

        sa.Column('client_name', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=True),

        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=True),

        sa.Column('billing_type', sa.String(), nullable=False),  # monthly | hourly
        sa.Column('billing_rate', sa.Float(), nullable=False),
        sa.Column('payout_rate', sa.Float(), nullable=True),

        sa.Column('status', sa.String(), default='active'),
        sa.Column('created_at', sa.DateTime()),

        sa.ForeignKeyConstraint(
            ['consultant_id'],
            ['consultants.id'],
            ondelete='CASCADE'
        )
    )


def downgrade() -> None:
    op.drop_table('consultant_deployments')

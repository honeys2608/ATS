"""add submission_id to interviews

Revision ID: add_submission_id_interviews
Revises: a8942d5260af
Create Date: 2026-01-26 16:27:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_submission_id_interviews'
down_revision: Union[str, Sequence[str], None] = 'a8942d5260af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add submission_id column."""
    # Add submission_id column as nullable first (for existing rows)
    op.add_column('interviews', sa.Column('submission_id', sa.String(), nullable=True))
    
    # Create foreign key constraint
    op.create_foreign_key(
        'fk_interviews_submission_id',
        'interviews',
        'candidate_submissions',
        ['submission_id'],
        ['id']
    )


def downgrade() -> None:
    """Downgrade schema - remove submission_id column."""
    op.drop_constraint('fk_interviews_submission_id', 'interviews', type_='foreignkey')
    op.drop_column('interviews', 'submission_id')

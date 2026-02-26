"""add unique constraint on job applications

Revision ID: 2be8618c6bd4
Revises: beb15714532d
Create Date: 2026-01-16 17:49:37.972263

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2be8618c6bd4'
down_revision: Union[str, Sequence[str], None] = 'beb15714532d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        'uq_job_application_job_candidate',
        'job_applications',
        ['job_id', 'candidate_id']
    )


def downgrade() -> None:
    op.drop_constraint(
        'uq_job_application_job_candidate',
        'job_applications',
        type_='unique'
    )

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c5b67ab26c21'
down_revision: Union[str, Sequence[str], None] = 'a59f232e7197'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'jobs',
        sa.Column('account_manager_id', sa.String(), nullable=True)
    )

    op.create_foreign_key(
        'fk_jobs_account_manager',
        'jobs',
        'users',
        ['account_manager_id'],
        ['id']
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_jobs_account_manager',
        'jobs',
        type_='foreignkey'
    )

    op.drop_column('jobs', 'account_manager_id')

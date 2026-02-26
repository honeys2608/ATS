from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '6e803c9319b0'
down_revision: Union[str, Sequence[str], None] = '08791fa1a618'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "job_applications",
        sa.Column(
            "ready_for_assignment",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false()
        )
    )


def downgrade() -> None:
    op.drop_column("job_applications", "ready_for_assignment")

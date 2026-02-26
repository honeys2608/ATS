"""add name email phone to employees

Revision ID: d87c047b6e36
Revises: 375a956cb053
Create Date: 2026-01-05 18:03:45.669712

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd87c047b6e36'
down_revision: Union[str, Sequence[str], None] = '375a956cb053'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


"""add name email phone to employees

Revision ID: d87c047b6e36
Revises: 375a956cb053
Create Date: 2026-01-05 18:03:45.669712

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd87c047b6e36'
down_revision: Union[str, Sequence[str], None] = '375a956cb053'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("employees", sa.Column("full_name", sa.String(), nullable=True))
    op.add_column("employees", sa.Column("email", sa.String(), nullable=True))
    op.add_column("employees", sa.Column("phone", sa.String(), nullable=True))



def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("employees", "phone")
    op.drop_column("employees", "email")
    op.drop_column("employees", "full_name")

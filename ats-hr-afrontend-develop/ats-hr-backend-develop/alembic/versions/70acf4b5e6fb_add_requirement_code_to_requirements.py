"""Add requirement_code to requirements

Revision ID: 70acf4b5e6fb
Revises: add_client_company_contacts
Create Date: 2025-12-30 14:06:20.931388

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '70acf4b5e6fb'
down_revision: Union[str, Sequence[str], None] = 'add_client_company_contacts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new column
    op.add_column(
        "requirements",
        sa.Column("requirement_code", sa.String(), nullable=True)
    )

    # Make it unique
    op.create_unique_constraint(
        "uq_requirements_requirement_code",
        "requirements",
        ["requirement_code"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_requirements_requirement_code",
        "requirements",
        type_="unique"
    )

    op.drop_column("requirements", "requirement_code")

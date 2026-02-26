"""fix consultant enum

Revision ID: de3c5b1d6f37
Revises: 860b54eab7e0
Create Date: 2025-12-16 17:47:10.273573
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'de3c5b1d6f37'
down_revision: Union[str, Sequence[str], None] = '860b54eab7e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -------------------------------------------------
    # 1️⃣ Ensure candidate classification is NOT NULL
    # -------------------------------------------------
    op.alter_column(
        'candidates',
        'classification',
        existing_type=postgresql.ENUM(
            'unclassified',
            'payroll',
            'sourcing',
            name='candidateclassification'
        ),
        nullable=False,
        server_default=sa.text("'unclassified'")
    )

    # -------------------------------------------------
    # 2️⃣ Create consultant_type ENUM explicitly
    # -------------------------------------------------
    consultant_type_enum = postgresql.ENUM(
        'sourcing',
        'payroll',
        name='consultant_type'
    )
    consultant_type_enum.create(op.get_bind(), checkfirst=True)

    # -------------------------------------------------
    # 3️⃣ Add type column (TEMP nullable)
    # -------------------------------------------------
    op.add_column(
        'consultants',
        sa.Column(
            'type',
            consultant_type_enum,
            nullable=True
        )
    )

    # -------------------------------------------------
    # 4️⃣ Backfill existing rows (safe default)
    # -------------------------------------------------
    op.execute(
        "UPDATE consultants SET type = 'sourcing' WHERE type IS NULL"
    )

    # -------------------------------------------------
    # 5️⃣ Make type NOT NULL
    # -------------------------------------------------
    op.alter_column(
        'consultants',
        'type',
        nullable=False
    )

    # -------------------------------------------------
    # 6️⃣ Drop unique constraint (if required)
    # -------------------------------------------------
    op.drop_constraint(
        op.f('consultants_candidate_id_key'),
        'consultants',
        type_='unique'
    )


def downgrade() -> None:
    # -------------------------------------------------
    # Recreate unique constraint
    # -------------------------------------------------
    op.create_unique_constraint(
        op.f('consultants_candidate_id_key'),
        'consultants',
        ['candidate_id']
    )

    # -------------------------------------------------
    # Drop column
    # -------------------------------------------------
    op.drop_column('consultants', 'type')

    # -------------------------------------------------
    # Drop enum
    # -------------------------------------------------
    consultant_type_enum = postgresql.ENUM(
        'sourcing',
        'payroll',
        name='consultant_type'
    )
    consultant_type_enum.drop(op.get_bind(), checkfirst=True)

    # -------------------------------------------------
    # Make candidate classification nullable again
    # -------------------------------------------------
    op.alter_column(
        'candidates',
        'classification',
        existing_type=postgresql.ENUM(
            'unclassified',
            'payroll',
            'sourcing',
            name='candidateclassification'
        ),
        nullable=True
    )

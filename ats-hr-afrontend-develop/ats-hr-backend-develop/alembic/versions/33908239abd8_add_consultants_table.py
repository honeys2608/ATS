"""add consultants table

Revision ID: 33908239abd8
Revises: cd211093e375
Create Date: 2025-12-16 15:12:37.587306

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33908239abd8'
down_revision: Union[str, Sequence[str], None] = 'cd211093e375'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # 1️⃣ Ensure enum exists
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'candidateclassification'
        ) THEN
            CREATE TYPE candidateclassification AS ENUM (
                'unclassified',
                'payroll',
                'sourcing'
            );
        END IF;
    END$$;
    """)

    # 2️⃣ Remove DEFAULT first (IMPORTANT)
    op.execute("""
    ALTER TABLE candidates
    ALTER COLUMN classification DROP DEFAULT;
    """)

    # 3️⃣ Convert VARCHAR → ENUM safely
    op.execute("""
    ALTER TABLE candidates
    ALTER COLUMN classification
    TYPE candidateclassification
    USING classification::candidateclassification;
    """)

    # 4️⃣ Add DEFAULT back
    op.execute("""
    ALTER TABLE candidates
    ALTER COLUMN classification
    SET DEFAULT 'unclassified';
    """)

 # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""

    op.execute("""
    ALTER TABLE candidates
    ALTER COLUMN classification DROP DEFAULT;
    """)

    op.execute("""
    ALTER TABLE candidates
    ALTER COLUMN classification
    TYPE VARCHAR(50);
    """)

    op.execute("""
    ALTER TABLE candidates
    ALTER COLUMN classification
    SET DEFAULT 'unclassified';
    """)

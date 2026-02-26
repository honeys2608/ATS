"""fix interview meeting link and schedule fields

Revision ID: 5e8a1c5c4346
Revises: 42990f0d5ee2
Create Date: 2026-01-29
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "5e8a1c5c4346"
down_revision = "42990f0d5ee2"
branch_labels = None
depends_on = None

def upgrade():
    # Add meeting_link only if missing
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name='interviews'
            AND column_name='meeting_link'
        ) THEN
            ALTER TABLE interviews ADD COLUMN meeting_link VARCHAR;
        END IF;
    END$$;
    """)

    # Add scheduled_at only if missing
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name='interviews'
            AND column_name='scheduled_at'
        ) THEN
            ALTER TABLE interviews ADD COLUMN scheduled_at TIMESTAMP;
        END IF;
    END$$;
    """)

    # Add mode only if missing
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name='interviews'
            AND column_name='mode'
        ) THEN
            ALTER TABLE interviews ADD COLUMN mode VARCHAR;
        END IF;
    END$$;
    """)

    # Add status only if missing
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name='interviews'
            AND column_name='status'
        ) THEN
            ALTER TABLE interviews ADD COLUMN status VARCHAR;
        END IF;
    END$$;
    """)


def downgrade():
    pass

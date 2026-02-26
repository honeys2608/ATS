from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'df3094f030e0'
down_revision = 'b07026265e36'   # keep existing if different
branch_labels = None
depends_on = None

def upgrade():
    # Convert existing skills string → JSON array safely
    op.execute("""
        ALTER TABLE candidates
        ALTER COLUMN skills TYPE JSON
        USING CASE
            WHEN skills IS NULL OR skills = '' THEN '[]'::json
            WHEN skills LIKE '[%' THEN skills::json
            ELSE ('["' || replace(skills, ',', '","') || '"]')::json
        END;
    """)
    print("Skills column successfully converted to JSON")


def downgrade():
    op.execute("""
        ALTER TABLE candidates
        ALTER COLUMN skills TYPE VARCHAR;
    """)

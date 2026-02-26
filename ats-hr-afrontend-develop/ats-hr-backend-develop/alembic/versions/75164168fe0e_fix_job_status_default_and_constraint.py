from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "75164168fe0e"
down_revision = "6a83edeb71e0"
branch_labels = None
depends_on = None


def upgrade():
    # 🔥 SAFETY: drop constraint if already exists
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'job_status_check'
        ) THEN
            ALTER TABLE jobs DROP CONSTRAINT job_status_check;
        END IF;
    END $$;
    """)

    # 1️⃣ Existing data ko lowercase karo
    op.execute("UPDATE jobs SET status = LOWER(status);")

    # 2️⃣ Default value change karo
    op.alter_column(
        "jobs",
        "status",
        existing_type=sa.String(),
        server_default="active",
        nullable=False,
    )

    # 3️⃣ Status constraint add karo
    op.create_check_constraint(
        "job_status_check",
        "jobs",
        "status IN ('active', 'closed', 'draft', 'on_hold')"
    )


def downgrade():
    # Constraint hatao
    op.drop_constraint(
        "job_status_check",
        "jobs",
        type_="check"
    )

    # Default hata do
    op.alter_column(
        "jobs",
        "status",
        existing_type=sa.String(),
        server_default=None,
        nullable=True,
    )

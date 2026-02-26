from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "add_client_company_contacts"
down_revision = "fca6832d99de"   # 🔥 YOUR LAST HEAD
branch_labels = None
depends_on = None


def upgrade():
    # 1️⃣ add company_name column in users table
    op.add_column(
        "users",
        sa.Column("company_name", sa.String(), nullable=True)
    )

    # 2️⃣ create client_contacts table
    op.create_table(
        "client_contacts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("client_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), default=datetime.utcnow)
    )


def downgrade():
    op.drop_table("client_contacts")
    op.drop_column("users", "company_name")

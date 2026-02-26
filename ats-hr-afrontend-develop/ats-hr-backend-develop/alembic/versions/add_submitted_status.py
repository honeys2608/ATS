"""Add candidate status enum and submitted stage

Revision ID: add_submitted_status
Revises: 
Create Date: 2026-02-02 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import Enum

# revision identifiers, used by Alembic.
revision = 'add_submitted_status'
down_revision = None
depends_on = None

# Define the enum values
candidate_status_enum = Enum(
    'applied', 'sourced', 'new', 'screening', 'screened', 'submitted',
    'interview_scheduled', 'interview_completed', 'interview', 
    'offer_extended', 'offer_accepted', 'offer', 'hired', 'joined',
    'rejected', 'active', 'shortlisted', 'converted',
    'verified', 'merged', 'draft',
    name='candidatestatus'
)

def upgrade() -> None:
    """Add SUBMITTED status to candidate status enum"""
    
    # Create the enum type
    candidate_status_enum.create(op.get_bind())
    
    # Update existing status column to use enum (PostgreSQL)
    op.execute("ALTER TABLE candidates ALTER COLUMN status TYPE candidatestatus USING status::candidatestatus")
    
    # Update default value
    op.alter_column('candidates', 'status', server_default='applied')
    
def downgrade() -> None:
    """Remove SUBMITTED status enum changes"""
    
    # Revert to string type
    op.execute("ALTER TABLE candidates ALTER COLUMN status TYPE VARCHAR")
    
    # Drop the enum type
    op.execute("DROP TYPE IF EXISTS candidatestatus")
    

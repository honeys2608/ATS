"""add_last_activity_columns

Revision ID: dcac02e70efb
Revises: add_activity_tracking_v2
Create Date: 2026-02-09 22:03:57.550926

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dcac02e70efb'
down_revision: Union[str, Sequence[str], None] = 'add_activity_tracking_v2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add last activity columns to jobs, candidates, and job_applications tables."""
    
    # Add last_activity_at and last_activity_type columns to jobs table
    op.add_column('jobs', sa.Column('last_activity_at', sa.DateTime, nullable=True))
    op.add_column('jobs', sa.Column('last_activity_type', sa.String(100), nullable=True))
    
    # Add last_activity_at and last_activity_type columns to candidates table  
    op.add_column('candidates', sa.Column('last_activity_at', sa.DateTime, nullable=True))
    op.add_column('candidates', sa.Column('last_activity_type', sa.String(100), nullable=True))
    
    # Add last_activity_at and last_activity_type columns to job_applications table
    op.add_column('job_applications', sa.Column('last_activity_at', sa.DateTime, nullable=True))
    op.add_column('job_applications', sa.Column('last_activity_type', sa.String(100), nullable=True))
    
    # Create indexes for better performance
    op.create_index('idx_jobs_last_activity_at', 'jobs', ['last_activity_at'])
    op.create_index('idx_candidates_last_activity_at', 'candidates', ['last_activity_at'])
    op.create_index('idx_job_applications_last_activity_at', 'job_applications', ['last_activity_at'])


def downgrade() -> None:
    """Remove last activity columns from jobs, candidates, and job_applications tables."""
    
    # Drop indexes
    op.drop_index('idx_job_applications_last_activity_at', 'job_applications')
    op.drop_index('idx_candidates_last_activity_at', 'candidates') 
    op.drop_index('idx_jobs_last_activity_at', 'jobs')
    
    # Drop columns
    op.drop_column('job_applications', 'last_activity_type')
    op.drop_column('job_applications', 'last_activity_at')
    op.drop_column('candidates', 'last_activity_type')
    op.drop_column('candidates', 'last_activity_at')
    op.drop_column('jobs', 'last_activity_type')
    op.drop_column('jobs', 'last_activity_at')

"""add activity tracking system

Revision ID: add_activity_tracking_v2
Revises: 75205bdf8117
Create Date: 2026-02-09 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'add_activity_tracking_v2'
down_revision: Union[str, Sequence[str], None] = '75205bdf8117'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    
    # Create the activities table
    op.create_table(
        'activities',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('entity_type', sa.String(50), nullable=False),  # 'job', 'candidate', 'application'
        sa.Column('entity_id', sa.String(), nullable=False),
        sa.Column('activity_type', sa.String(100), nullable=False),  # 'Job Created', 'Candidate Applied', etc.
        sa.Column('description', sa.Text(), nullable=True),  # Human-readable description
        sa.Column('actor_id', sa.String(), nullable=True),  # User who performed action
        sa.Column('actor_role', sa.String(50), nullable=True),  # admin, recruiter, candidate
        sa.Column('activity_metadata', sa.JSON(), nullable=True),  # Additional context
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    
    # Create indexes for performance
    op.create_index('ix_activities_entity_type_id', 'activities', ['entity_type', 'entity_id'])
    op.create_index('ix_activities_created_at', 'activities', ['created_at'])
    op.create_index('ix_activities_actor', 'activities', ['actor_id'])
    
    # Add foreign key constraints
    op.create_foreign_key(
        'fk_activities_actor',
        'activities', 'users',
        ['actor_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Add last_activity fields to existing entities
    
    # Jobs table
    op.add_column('jobs', sa.Column('last_activity_at', sa.DateTime(), nullable=True))
    op.add_column('jobs', sa.Column('last_activity_type', sa.String(100), nullable=True))
    op.create_index('ix_jobs_last_activity_at', 'jobs', ['last_activity_at'])
    
    # Candidates table
    op.add_column('candidates', sa.Column('last_activity_at', sa.DateTime(), nullable=True))
    op.add_column('candidates', sa.Column('last_activity_type', sa.String(100), nullable=True))
    op.create_index('ix_candidates_last_activity_at', 'candidates', ['last_activity_at'])
    
    # Job Applications table
    op.add_column('job_applications', sa.Column('last_activity_at', sa.DateTime(), nullable=True))
    op.add_column('job_applications', sa.Column('last_activity_type', sa.String(100), nullable=True))
    op.create_index('ix_job_applications_last_activity_at', 'job_applications', ['last_activity_at'])


def downgrade() -> None:
    """Downgrade schema."""
    
    # Remove indexes
    op.drop_index('ix_job_applications_last_activity_at', 'job_applications')
    op.drop_index('ix_candidates_last_activity_at', 'candidates')
    op.drop_index('ix_jobs_last_activity_at', 'jobs')
    
    # Remove columns
    op.drop_column('job_applications', 'last_activity_type')
    op.drop_column('job_applications', 'last_activity_at')
    op.drop_column('candidates', 'last_activity_type')
    op.drop_column('candidates', 'last_activity_at')
    op.drop_column('jobs', 'last_activity_type')
    op.drop_column('jobs', 'last_activity_at')
    
    # Drop activities table
    op.drop_index('ix_activities_actor', 'activities')
    op.drop_index('ix_activities_created_at', 'activities')
    op.drop_index('ix_activities_entity_type_id', 'activities')
    op.drop_constraint('fk_activities_actor', 'activities', type_='foreignkey')
    op.drop_table('activities')
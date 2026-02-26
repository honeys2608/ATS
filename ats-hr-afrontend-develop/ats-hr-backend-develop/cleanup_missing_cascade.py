#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Candidate, CandidateSubmission
import os

# Database setup
database_url = os.getenv("DATABASE_URL", "postgresql://postgres:honey%402620@localhost:5432/ats-hr-backend")
print(f"DATABASE_URL from ENV: {database_url}")
engine = create_engine(database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def cleanup_missing_candidates():
    db = SessionLocal()
    try:
        # First, find all the candidates to delete
        candidates_to_delete = db.query(Candidate).filter(
            (Candidate.full_name.like('Missing%')) | 
            (Candidate.email.like('missing-%'))
        ).all()
        
        print(f"Found {len(candidates_to_delete)} candidates to delete:")
        for i, candidate in enumerate(candidates_to_delete, 1):
            print(f"{i}. {candidate.full_name} - {candidate.email}")
        
        if not candidates_to_delete:
            print("No candidates with 'Missing' data found.")
            return
        
        # Collect candidate IDs for deletion
        candidate_ids = [c.id for c in candidates_to_delete]
        
        # First, delete all candidate submissions for these candidates
        submissions_deleted = db.query(CandidateSubmission).filter(
            CandidateSubmission.candidate_id.in_(candidate_ids)
        ).delete(synchronize_session=False)
        
        print(f"\nDeleted {submissions_deleted} candidate submissions")
        
        # Now delete the candidates
        candidates_deleted = db.query(Candidate).filter(
            Candidate.id.in_(candidate_ids)
        ).delete(synchronize_session=False)
        
        print(f"Deleted {candidates_deleted} candidates")
        
        # Commit the transaction
        db.commit()
        print("\nAll 'Missing' candidates and their related data have been successfully deleted!")
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_missing_candidates()
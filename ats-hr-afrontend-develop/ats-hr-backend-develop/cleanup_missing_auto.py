#!/usr/bin/env python3
from app.db import SessionLocal
from app.models import Candidate

def cleanup_missing_candidates():
    db = SessionLocal()
    try:
        # Find candidates with "Missing" in name or "missing-" in email
        candidates_to_delete = db.query(Candidate).filter(
            (Candidate.full_name.like('%Missing%')) |
            (Candidate.email.like('missing-%'))
        ).all()
        
        print(f"Found {len(candidates_to_delete)} candidates to delete:")
        
        # Show what will be deleted
        for i, c in enumerate(candidates_to_delete):
            print(f"{i+1}. {c.full_name} - {c.email}")
        
        if len(candidates_to_delete) > 0:
            # Delete the candidates
            for candidate in candidates_to_delete:
                db.delete(candidate)
            
            db.commit()
            print(f"\nSuccessfully deleted {len(candidates_to_delete)} candidates with 'Missing' data")
            
            # Show remaining count
            remaining = db.query(Candidate).count()
            print(f"Remaining candidates: {remaining}")
        else:
            print("No candidates found to delete")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_missing_candidates()
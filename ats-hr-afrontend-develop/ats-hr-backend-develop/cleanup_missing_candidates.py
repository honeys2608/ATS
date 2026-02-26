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
        for i, c in enumerate(candidates_to_delete[:10]):  # Show first 10
            print(f"{i+1}. {c.full_name} - {c.email}")
        
        if len(candidates_to_delete) > 10:
            print(f"... and {len(candidates_to_delete) - 10} more")
        
        # Confirm deletion
        print(f"\nThis will permanently delete {len(candidates_to_delete)} candidates.")
        confirm = input("Type 'DELETE' to confirm: ")
        
        if confirm == 'DELETE':
            # Delete the candidates
            for candidate in candidates_to_delete:
                db.delete(candidate)
            
            db.commit()
            print(f"Successfully deleted {len(candidates_to_delete)} candidates with 'Missing' data")
            
            # Show remaining count
            remaining = db.query(Candidate).count()
            print(f"Remaining candidates: {remaining}")
            
        else:
            print("Deletion cancelled")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_missing_candidates()
#!/usr/bin/env python3
from app.db import SessionLocal
from app.models import Candidate

def check_filtered_candidates():
    db = SessionLocal()
    try:
        # Check what the current status filter returns
        ALLOWED_INTAKE_STATUSES = ["new", "screening", "screened", "verified"]
        
        print("Checking status filter...")
        total_candidates = db.query(Candidate).count()
        print(f"Total candidates: {total_candidates}")
        
        # Check by status
        for status in ["new", "screening", "screened", "verified", "active", "converted"]:
            count = db.query(Candidate).filter(Candidate.status == status).count()
            print(f"Status '{status}': {count} candidates")
        
        print("\nFiltered candidates (allowed statuses):")
        filtered = db.query(Candidate).filter(
            Candidate.status.in_(ALLOWED_INTAKE_STATUSES)
        ).all()
        print(f"Returned by filter: {len(filtered)}")
        
        print("\nFirst 3 filtered candidates:")
        for i, c in enumerate(filtered[:3]):
            print(f"{i+1}. ID: {str(c.id)[:8]}...")
            print(f"   Full Name: '{c.full_name}'")
            print(f"   Email: '{c.email}'")
            print(f"   Phone: '{c.phone}'")
            print(f"   Status: {c.status}")
            print("   ---")
            
        # Check merged candidates (should be filtered out)
        merged_count = db.query(Candidate).filter(Candidate.merged_into_id.isnot(None)).count()
        print(f"\nMerged candidates (filtered out): {merged_count}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_filtered_candidates()
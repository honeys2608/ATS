#!/usr/bin/env python3
from app.db import SessionLocal
from app.models import Candidate
from datetime import datetime

def create_test_candidates():
    db = SessionLocal()
    try:
        # Check existing candidates
        existing_count = db.query(Candidate).count()
        print(f"Existing candidates: {existing_count}")
        
        if existing_count == 0:
            # Create test candidates
            test_candidates = [
                {
                    'full_name': 'John Doe',
                    'email': 'john.doe@example.com',
                    'phone': '+1-555-1234',
                    'status': 'new',
                    'source': 'manual'
                },
                {
                    'full_name': 'Jane Smith',
                    'email': 'jane.smith@example.com',
                    'phone': '+1-555-5678',
                    'status': 'screening',
                    'source': 'LinkedIn'
                },
                {
                    'full_name': 'Bob Johnson',
                    'email': 'bob.johnson@example.com',
                    'phone': '+1-555-9012',
                    'status': 'screened',
                    'source': 'Indeed'
                }
            ]
            
            for cand_data in test_candidates:
                candidate = Candidate(**cand_data, created_at=datetime.utcnow())
                db.add(candidate)
                
            db.commit()
            print(f"Created {len(test_candidates)} test candidates")
        
        # List all candidates
        all_candidates = db.query(Candidate).all()
        print("\nAll candidates in database:")
        for c in all_candidates:
            print(f"- {c.full_name} ({c.email}) - Status: {c.status}")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_candidates()
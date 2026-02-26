#!/usr/bin/env python3

"""
Script to add sample activity data to existing candidates for testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import get_db
from app.models import Candidate, User
from app.services.activity_service import ActivityService
from datetime import datetime, timedelta
import random

def add_sample_candidate_activities():
    """Add sample activity data to existing candidates"""
    
    db = next(get_db())
    activity_service = ActivityService(db)
    
    try:
        # Get some existing candidates
        candidates = db.query(Candidate).filter(
            Candidate.is_active == True,
            Candidate.merged_into_id.is_(None)
        ).limit(15).all()
        print(f"Found {len(candidates)} active candidates")
        
        # Get some existing users to act as creators
        users = db.query(User).limit(5).all()
        print(f"Found {len(users)} users")
        
        activities_added = 0
        
        for candidate in candidates:
            # Skip if candidate already has activity
            if candidate.last_activity_at:
                print(f"Candidate {candidate.public_id} already has activity: {candidate.last_activity_type}")
                continue
                
            # Create random activity data
            user = random.choice(users)
            
            # Random activity time between 1 hour ago and 20 days ago
            hours_ago = random.randint(1, 480)  # 1 hour to 20 days
            activity_time = datetime.utcnow() - timedelta(hours=hours_ago)
            
            # Track candidate creation activity
            activity_service.track_candidate_created(
                candidate_id=candidate.id,
                creator_id=user.id,
                creator_role=user.role or "recruiter"
            )
            
            # Update the activity timestamp to our random time for variety
            db.query(Candidate).filter(Candidate.id == candidate.id).update({
                "last_activity_at": activity_time
            })
            
            activities_added += 1
            print(f"✅ Added activity to candidate {candidate.public_id}: {candidate.full_name}")
        
        db.commit()
        print(f"\n🎉 Successfully added {activities_added} candidate activities!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    
    finally:
        db.close()

if __name__ == "__main__":
    add_sample_candidate_activities()
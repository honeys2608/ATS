#!/usr/bin/env python3

"""
Script to add sample activity data to existing jobs for testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import get_db
from app.models import Job, User
from app.services.activity_service import ActivityService
from datetime import datetime, timedelta
import random

def add_sample_activities():
    """Add sample activity data to existing jobs"""
    
    db = next(get_db())
    activity_service = ActivityService(db)
    
    try:
        # Get some existing jobs
        jobs = db.query(Job).filter(Job.status == "active").limit(10).all()
        print(f"Found {len(jobs)} active jobs")
        
        # Get some existing users to act as creators
        users = db.query(User).limit(5).all()
        print(f"Found {len(users)} users")
        
        if not users:
            print("No users found - creating a test user")
            test_user = User(
                id="test-admin-user",
                username="testadmin",
                email="admin@test.com",
                role="admin",
                password="hashed_password"
            )
            db.add(test_user)
            db.commit()
            users = [test_user]
        
        activities_added = 0
        
        for job in jobs:
            # Skip if job already has activity
            if job.last_activity_at:
                print(f"Job {job.job_id} already has activity: {job.last_activity_type}")
                continue
                
            # Create random activity data
            user = random.choice(users)
            
            # Random activity time between 1 hour ago and 30 days ago
            hours_ago = random.randint(1, 720)  # 1 hour to 30 days
            activity_time = datetime.utcnow() - timedelta(hours=hours_ago)
            
            # Track job creation activity
            activity_service.track_job_created(
                job_id=job.id,
                creator_id=user.id,
                creator_role=user.role or "admin"
            )
            
            # Update the activity timestamp to our random time for variety
            db.query(Job).filter(Job.id == job.id).update({
                "last_activity_at": activity_time
            })
            
            activities_added += 1
            print(f"✅ Added activity to job {job.job_id}: {job.title}")
        
        db.commit()
        print(f"\n🎉 Successfully added {activities_added} job activities!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    
    finally:
        db.close()

if __name__ == "__main__":
    add_sample_activities()
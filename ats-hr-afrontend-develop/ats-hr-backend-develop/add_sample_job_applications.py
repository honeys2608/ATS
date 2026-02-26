#!/usr/bin/env python3

"""
Script to add sample job applications for testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import get_db
from app.models import Job, Candidate, JobApplication
from datetime import datetime, timedelta
import random
import uuid

def add_sample_job_applications():
    """Add sample job applications to link candidates with jobs"""
    
    db = next(get_db())
    
    try:
        # Get existing jobs and candidates
        jobs = db.query(Job).filter(Job.status == "active").limit(10).all()
        candidates = db.query(Candidate).filter(
            Candidate.is_active == True,
            Candidate.merged_into_id.is_(None)
        ).limit(20).all()
        
        print(f"Found {len(jobs)} jobs and {len(candidates)} candidates")
        
        if not jobs or not candidates:
            print("No jobs or candidates found")
            return
        
        applications_added = 0
        
        # Create 1-3 applications per job
        for job in jobs:
            # Check if job already has applications
            existing_apps = db.query(JobApplication).filter(JobApplication.job_id == job.id).count()
            if existing_apps > 0:
                print(f"Job {job.job_id} already has {existing_apps} applications")
                continue
                
            # Create 1-3 random applications for this job
            num_applications = random.randint(1, 3)
            selected_candidates = random.sample(candidates, min(num_applications, len(candidates)))
            
            for candidate in selected_candidates:
                # Create job application
                app_id = str(uuid.uuid4())
                application = JobApplication(
                    id=app_id,
                    job_id=job.id,
                    candidate_id=candidate.id,
                    full_name=candidate.full_name,
                    email=candidate.email,
                    phone=candidate.phone,
                    status="applied",
                    applied_at=datetime.utcnow() - timedelta(days=random.randint(1, 30))
                )
                
                db.add(application)
                applications_added += 1
                print(f"✅ Added application: {candidate.full_name} -> {job.title} ({job.job_id})")
        
        db.commit()
        print(f"\n🎉 Successfully added {applications_added} job applications!")
        
        # Show summary
        print(f"\n📊 Summary:")
        for job in jobs:
            app_count = db.query(JobApplication).filter(JobApplication.job_id == job.id).count()
            print(f"  {job.job_id} ({job.title}): {app_count} applications")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    
    finally:
        db.close()

if __name__ == "__main__":
    add_sample_job_applications()
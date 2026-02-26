# app/services/activity_service.py

from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.models import Activity, ActivityType, Job, Candidate, JobApplication, User
from app.db import get_db


class ActivityService:
    """
    Service for tracking meaningful activities across the ATS system.
    Provides 'Last Activity' indicators for Jobs, Candidates, and Applications.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def track_activity(
        self,
        entity_type: str,
        entity_id: str,
        activity_type: str,
        actor_id: Optional[str] = None,
        actor_role: Optional[str] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Activity:
        """
        Record a new activity and update the entity's last_activity fields.
        
        Args:
            entity_type: 'job', 'candidate', or 'application'
            entity_id: UUID of the entity
            activity_type: Type of activity (use ActivityType constants)
            actor_id: User ID who performed the action
            actor_role: Role of the actor (admin, recruiter, candidate, system)
            description: Human-readable description
            metadata: Additional context data
        
        Returns:
            Created Activity instance
        """
        
        # Create activity record
        activity = Activity(
            entity_type=entity_type,
            entity_id=entity_id,
            activity_type=activity_type,
            description=description or activity_type,
            actor_id=actor_id,
            actor_role=actor_role,
            activity_metadata=metadata,
            created_at=datetime.utcnow()
        )
        
        self.db.add(activity)
        
        # Update entity's last_activity fields
        self._update_entity_last_activity(
            entity_type, entity_id, activity_type, activity.created_at
        )
        
        # Commit both changes
        self.db.commit()
        self.db.refresh(activity)
        
        return activity
    
    def _update_entity_last_activity(
        self,
        entity_type: str,
        entity_id: str,
        activity_type: str,
        timestamp: datetime
    ):
        """Update the last_activity fields on the target entity."""
        
        if entity_type == "job":
            self.db.query(Job).filter(Job.id == entity_id).update({
                "last_activity_at": timestamp,
                "last_activity_type": activity_type
            })
        elif entity_type == "candidate":
            self.db.query(Candidate).filter(Candidate.id == entity_id).update({
                "last_activity_at": timestamp,
                "last_activity_type": activity_type
            })
        elif entity_type == "application":
            self.db.query(JobApplication).filter(JobApplication.id == entity_id).update({
                "last_activity_at": timestamp,
                "last_activity_type": activity_type
            })
    
    def get_entity_activities(
        self,
        entity_type: str,
        entity_id: str,
        limit: int = 20
    ) -> List[Activity]:
        """Get recent activities for a specific entity."""
        
        return (
            self.db.query(Activity)
            .filter(
                Activity.entity_type == entity_type,
                Activity.entity_id == entity_id
            )
            .order_by(Activity.created_at.desc())
            .limit(limit)
            .all()
        )
    
    def get_stale_entities(
        self,
        entity_type: str,
        days_threshold: int = 14
    ) -> List[Dict[str, Any]]:
        """
        Get entities with no activity within the specified threshold.
        Useful for identifying stalled jobs/candidates.
        """
        
        cutoff_date = datetime.utcnow() - timedelta(days=days_threshold)
        
        if entity_type == "job":
            model = Job
        elif entity_type == "candidate":
            model = Candidate
        elif entity_type == "application":
            model = JobApplication
        else:
            return []
        
        stale_entities = (
            self.db.query(model)
            .filter(
                (model.last_activity_at.is_(None)) |
                (model.last_activity_at < cutoff_date)
            )
            .all()
        )
        
        return [
            {
                "id": entity.id,
                "last_activity_at": entity.last_activity_at,
                "last_activity_type": entity.last_activity_type,
                "days_since_activity": (
                    (datetime.utcnow() - entity.last_activity_at).days
                    if entity.last_activity_at else None
                )
            }
            for entity in stale_entities
        ]
    
    # ============================================================
    # CONVENIENCE METHODS FOR COMMON ACTIVITIES
    # ============================================================
    
    def track_job_created(self, job_id: str, creator_id: str, creator_role: str = "admin"):
        """Track job creation activity."""
        return self.track_activity(
            entity_type="job",
            entity_id=job_id,
            activity_type=ActivityType.JOB_CREATED,
            actor_id=creator_id,
            actor_role=creator_role,
            description="Job created"
        )
    
    def track_job_updated(self, job_id: str, updater_id: str, updater_role: str = "admin", changes: Optional[Dict] = None):
        """Track job update activity."""
        return self.track_activity(
            entity_type="job",
            entity_id=job_id,
            activity_type=ActivityType.JOB_UPDATED,
            actor_id=updater_id,
            actor_role=updater_role,
            description="Job details updated",
            metadata={"changes": changes} if changes else None
        )
    
    def track_candidate_applied(self, candidate_id: str, job_id: str, application_id: str):
        """Track candidate application to a job."""
        # Track activity on candidate
        self.track_activity(
            entity_type="candidate",
            entity_id=candidate_id,
            activity_type=ActivityType.CANDIDATE_APPLIED,
            actor_id=candidate_id,
            actor_role="candidate",
            description="Applied to job",
            metadata={"job_id": job_id, "application_id": application_id}
        )
        
        # Track activity on job
        return self.track_activity(
            entity_type="job",
            entity_id=job_id,
            activity_type=ActivityType.CANDIDATE_APPLIED,
            actor_id=candidate_id,
            actor_role="candidate",
            description="New candidate application",
            metadata={"candidate_id": candidate_id, "application_id": application_id}
        )
    
    def track_candidate_created(self, candidate_id: str, creator_id: str, creator_role: str = "recruiter"):
        """Track recruiter adding a new candidate."""
        return self.track_activity(
            entity_type="candidate",
            entity_id=candidate_id,
            activity_type=ActivityType.CANDIDATE_CREATED,
            actor_id=creator_id,
            actor_role=creator_role,
            description="Candidate added to system"
        )
    
    def track_application_status_changed(
        self, 
        application_id: str, 
        old_status: str, 
        new_status: str, 
        actor_id: str, 
        actor_role: str = "recruiter"
    ):
        """Track application status changes."""
        return self.track_activity(
            entity_type="application",
            entity_id=application_id,
            activity_type=ActivityType.APPLICATION_STATUS_CHANGED,
            actor_id=actor_id,
            actor_role=actor_role,
            description=f"Status changed from {old_status} to {new_status}",
            metadata={"old_status": old_status, "new_status": new_status}
        )
    
    def track_interview_scheduled(
        self, 
        application_id: str, 
        interview_date: datetime, 
        interviewer_id: str, 
        interviewer_role: str = "recruiter"
    ):
        """Track interview scheduling."""
        return self.track_activity(
            entity_type="application",
            entity_id=application_id,
            activity_type=ActivityType.INTERVIEW_SCHEDULED,
            actor_id=interviewer_id,
            actor_role=interviewer_role,
            description=f"Interview scheduled for {interview_date.strftime('%B %d, %Y')}",
            metadata={"interview_date": interview_date.isoformat()}
        )
    
    def track_resume_uploaded(self, candidate_id: str, uploader_id: str, uploader_role: str = "candidate"):
        """Track resume upload/update."""
        return self.track_activity(
            entity_type="candidate",
            entity_id=candidate_id,
            activity_type=ActivityType.CANDIDATE_RESUME_UPLOADED,
            actor_id=uploader_id,
            actor_role=uploader_role,
            description="Resume uploaded/updated"
        )


def get_activity_service(db: Session = None) -> ActivityService:
    """Factory function to get ActivityService instance."""
    if db is None:
        db = next(get_db())
    return ActivityService(db)


def format_relative_time(timestamp: datetime) -> str:
    """
    Format a timestamp as relative time (e.g., '2 hours ago', 'Yesterday').
    Used for displaying last activity in a human-readable format.
    """
    if not timestamp:
        return "No activity yet"
    
    now = datetime.utcnow()
    diff = now - timestamp
    
    if diff.days == 0:
        # Today
        if diff.seconds < 60:
            return "Just now"
        elif diff.seconds < 3600:
            minutes = diff.seconds // 60
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        else:
            hours = diff.seconds // 3600
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
    elif diff.days == 1:
        return "Yesterday"
    elif diff.days < 7:
        return f"{diff.days} days ago"
    elif diff.days < 30:
        weeks = diff.days // 7
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"
    else:
        months = diff.days // 30
        if months < 12:
            return f"{months} month{'s' if months != 1 else ''} ago"
        else:
            years = diff.days // 365
            return f"{years} year{'s' if years != 1 else ''} ago"


def format_activity_description(activity_type: str, metadata: Optional[Dict] = None) -> str:
    """
    Generate human-readable activity descriptions.
    """
    descriptions = {
        ActivityType.JOB_CREATED: "Job created",
        ActivityType.JOB_UPDATED: "Job updated",
        ActivityType.JOB_PUBLISHED: "Job published",
        ActivityType.JOB_UNPUBLISHED: "Job unpublished",
        ActivityType.CANDIDATE_APPLIED: "Candidate applied",
        ActivityType.CANDIDATE_CREATED: "Candidate added",
        ActivityType.CANDIDATE_RESUME_UPLOADED: "Resume uploaded",
        ActivityType.APPLICATION_STATUS_CHANGED: "Status changed",
        ActivityType.INTERVIEW_SCHEDULED: "Interview scheduled",
        ActivityType.INTERVIEW_FEEDBACK_SUBMITTED: "Interview feedback submitted",
        ActivityType.OFFER_SENT: "Offer sent",
        # Add more as needed
    }
    
    base_description = descriptions.get(activity_type, activity_type)
    
    # Add metadata context if available
    if metadata:
        if activity_type == ActivityType.APPLICATION_STATUS_CHANGED:
            new_status = metadata.get("new_status", "")
            if new_status:
                base_description = f"Status changed to {new_status}"
    
    return base_description
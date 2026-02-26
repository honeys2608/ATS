"""
Passive Requirement Monitoring Service

This service runs as a background job to detect requirements that have been inactive
for 48 hours and creates notifications for recruiters.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.db import SessionLocal
from app.models import Requirement, SystemNotification, RecruiterActivity, User, generate_uuid

import logging

logger = logging.getLogger(__name__)


class PassiveRequirementMonitor:
    """
    Monitors requirements for inactivity and creates notifications
    """
    
    INACTIVITY_THRESHOLD_HOURS = 48
    
    def __init__(self, db_session: Session = None):
        self.db = db_session or SessionLocal()
    
    def scan_for_passive_requirements(self):
        """
        Main method to scan all requirements and detect passive ones.
        Creates notifications for newly detected passive requirements.
        """
        try:
            logger.info("Starting passive requirement scan...")
            
            # Calculate the 48-hour cutoff timestamp
            cutoff_time = datetime.utcnow() - timedelta(hours=self.INACTIVITY_THRESHOLD_HOURS)
            
            # Find requirements that are currently active but haven't had activity in 48 hours
            inactive_requirements = self.db.query(Requirement).filter(
                and_(
                    Requirement.activity_status == "active",
                    Requirement.last_activity_at < cutoff_time,
                    Requirement.status.in_(["active", "in_progress", "open"])  # Only track active requirements
                )
            ).all()
            
            notifications_created = 0
            
            for requirement in inactive_requirements:
                # Mark as passive
                requirement.activity_status = "passive"
                requirement.last_passive_alert_at = datetime.utcnow()
                
                # Create notification for assigned recruiters
                assigned_recruiters = self._get_assigned_recruiters(requirement.id)
                
                for recruiter in assigned_recruiters:
                    self._create_passive_notification(recruiter, requirement)
                    notifications_created += 1
                
                logger.info(f"Marked requirement {requirement.requirement_code} as passive")
            
            # Commit all changes
            self.db.commit()
            
            logger.info(f"Passive requirement scan completed. {len(inactive_requirements)} requirements marked passive, {notifications_created} notifications created.")
            
            return {
                "passive_requirements": len(inactive_requirements),
                "notifications_created": notifications_created,
                "scan_time": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error during passive requirement scan: {str(e)}")
            self.db.rollback()
            raise
    
    def _get_assigned_recruiters(self, requirement_id: str) -> list:
        """
        Get all recruiters who have been assigned to or worked on a specific requirement
        """
        # For now, we'll find recruiters who have had recent activity on this requirement
        # In a production system, you might have explicit assignment tables
        recent_activities = self.db.query(RecruiterActivity.recruiter_id).filter(
            RecruiterActivity.requirement_id == requirement_id
        ).distinct().all()
        
        recruiter_ids = [activity[0] for activity in recent_activities]
        
        if not recruiter_ids:
            # If no specific recruiters found, this might be a fallback to account manager
            # For now, return empty list (could be enhanced based on business rules)
            return []
        
        return self.db.query(User).filter(
            and_(
                User.id.in_(recruiter_ids),
                User.role == "recruiter"
            )
        ).all()
    
    def _create_passive_notification(self, recruiter: User, requirement: Requirement):
        """
        Create a passive requirement notification for a specific recruiter
        """
        # Check if we already sent a notification recently (avoid spam)
        existing_notification = self.db.query(SystemNotification).filter(
            and_(
                SystemNotification.user_id == recruiter.id,
                SystemNotification.requirement_id == requirement.id,
                SystemNotification.notification_type == "passive_requirement",
                SystemNotification.created_at > datetime.utcnow() - timedelta(hours=24)
            )
        ).first()
        
        if existing_notification:
            logger.info(f"Skipping notification for {recruiter.username} - recent notification exists")
            return
        
        notification = SystemNotification(
            id=generate_uuid(),
            user_id=recruiter.id,
            notification_type="passive_requirement",
            title="⚠️ Passive Requirement Alert",
            message=f"Requirement {requirement.requirement_code} ({requirement.title}) has been inactive for 48 hours and needs attention.",
            requirement_id=requirement.id,
            priority="high",
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=7)  # Notification expires in 7 days
        )
        
        self.db.add(notification)
        logger.info(f"Created passive notification for recruiter {recruiter.username}")
    
    def reactivate_requirement(self, requirement_id: str, recruiter_id: str, activity_description: str = ""):
        """
        Reactivate a passive requirement when recruiter takes action
        """
        try:
            requirement = self.db.query(Requirement).filter(Requirement.id == requirement_id).first()
            
            if requirement and requirement.activity_status == "passive":
                # Reactivate the requirement
                requirement.activity_status = "active"
                requirement.last_activity_at = datetime.utcnow()
                requirement.passive_notification_sent = False
                
                # Log the reactivation activity
                activity = RecruiterActivity(
                    id=generate_uuid(),
                    recruiter_id=recruiter_id,
                    requirement_id=requirement_id,
                    activity_type="reactivation",
                    description=activity_description or "Requirement reactivated",
                    created_at=datetime.utcnow()
                )
                self.db.add(activity)
                
                # Mark related passive notifications as read
                passive_notifications = self.db.query(SystemNotification).filter(
                    and_(
                        SystemNotification.requirement_id == requirement_id,
                        SystemNotification.notification_type == "passive_requirement",
                        SystemNotification.is_read == False
                    )
                ).all()
                
                for notification in passive_notifications:
                    notification.is_read = True
                    notification.read_at = datetime.utcnow()
                
                self.db.commit()
                logger.info(f"Reactivated requirement {requirement.requirement_code}")
                
                return True
                
        except Exception as e:
            logger.error(f"Error reactivating requirement {requirement_id}: {str(e)}")
            self.db.rollback()
            raise
        
        return False
    
    def log_recruiter_activity(self, recruiter_id: str, requirement_id: str, activity_type: str, description: str = "", activity_metadata: dict = None):
        """
        Log recruiter activity and update requirement's last activity timestamp
        """
        try:
            # Create activity log
            activity = RecruiterActivity(
                id=generate_uuid(),
                recruiter_id=recruiter_id,
                requirement_id=requirement_id,
                activity_type=activity_type,
                description=description,
                activity_metadata=activity_metadata,
                created_at=datetime.utcnow()
            )
            self.db.add(activity)
            
            # Update requirement's last activity
            requirement = self.db.query(Requirement).filter(Requirement.id == requirement_id).first()
            if requirement:
                requirement.last_activity_at = datetime.utcnow()
                
                # If it was passive, reactivate it
                if requirement.activity_status == "passive":
                    self.reactivate_requirement(requirement_id, recruiter_id, f"Activity: {activity_type}")
            
            self.db.commit()
            logger.info(f"Logged activity {activity_type} for requirement {requirement_id}")
            
        except Exception as e:
            logger.error(f"Error logging recruiter activity: {str(e)}")
            self.db.rollback()
            raise


# Background job function that can be called by a scheduler (e.g., APScheduler, Celery)
def run_passive_requirement_scan():
    """
    Entry point for background job scheduler
    """
    monitor = PassiveRequirementMonitor()
    return monitor.scan_for_passive_requirements()


# Utility function to start the monitoring in a production environment
def setup_background_scheduler():
    """
    Setup APScheduler for running passive requirement scans
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        
        scheduler = BackgroundScheduler()
        
        # Run every hour
        scheduler.add_job(
            func=run_passive_requirement_scan,
            trigger=IntervalTrigger(hours=1),
            id='passive_requirement_scan',
            name='Scan for passive requirements',
            replace_existing=True
        )
        
        scheduler.start()
        logger.info("Background scheduler started for passive requirement monitoring")
        
        return scheduler
        
    except ImportError:
        logger.warning("APScheduler not available. Install with: pip install apscheduler")
        return None
    except Exception as e:
        logger.error(f"Failed to setup background scheduler: {str(e)}")
        return None
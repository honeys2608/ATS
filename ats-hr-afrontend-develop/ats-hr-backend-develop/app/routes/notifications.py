"""
Notification API Routes

Provides endpoints for managing passive requirement notifications and alarm system.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func

from app.db import get_db
from app.auth import get_current_user
from app.models import (
    SystemNotification,
    Requirement,
    RecruiterActivity,
    User,
    Candidate,
)
from app.passive_requirement_monitor import PassiveRequirementMonitor

router = APIRouter(prefix="/api", tags=["notifications"])


def get_user_id(current_user):
    """
    Support both dict-based and object-based current_user payloads.
    """
    if isinstance(current_user, dict):
        return current_user.get("id") or current_user.get("user_id") or current_user.get("sub")
    return getattr(current_user, "id", None)


# ============================================================
# NOTIFICATION ENDPOINTS
# ============================================================

@router.get("/notifications")
async def get_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    notification_type: Optional[str] = Query(None)
):
    """
    Get notifications for the current user with filtering and pagination.
    """
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user context")

        query = db.query(SystemNotification).filter(
            SystemNotification.user_id == user_id
        )
        
        # Filter by read status
        if unread_only:
            query = query.filter(SystemNotification.is_read == False)
        
        # Filter by notification type
        if notification_type:
            query = query.filter(SystemNotification.notification_type == notification_type)
        
        # Filter out expired notifications
        query = query.filter(
            or_(
                SystemNotification.expires_at.is_(None),
                SystemNotification.expires_at > datetime.utcnow()
            )
        )
        
        # Order by priority and creation time
        query = query.order_by(
            desc(SystemNotification.priority == "urgent"),
            desc(SystemNotification.priority == "high"),
            desc(SystemNotification.created_at)
        )
        
        # Get total count for pagination
        total_count = query.count()
        
        # Apply pagination
        notifications = query.offset(offset).limit(limit).all()

        candidate_notification_types = {
            "interview_scheduling_ready",
            "interview_scheduled",
        }
        candidate_ids = {
            str(notification.reference_id)
            for notification in notifications
            if notification.notification_type in candidate_notification_types
            and notification.reference_id
        }
        requirement_ids = {
            str(notification.requirement_id)
            for notification in notifications
            if notification.requirement_id
        }

        candidate_lookup: Dict[str, Candidate] = {}
        requirement_lookup: Dict[str, Requirement] = {}

        if candidate_ids:
            candidate_rows = (
                db.query(Candidate)
                .filter(Candidate.id.in_(candidate_ids))
                .all()
            )
            candidate_lookup = {str(candidate.id): candidate for candidate in candidate_rows}

        if requirement_ids:
            requirement_rows = (
                db.query(Requirement)
                .filter(Requirement.id.in_(requirement_ids))
                .all()
            )
            requirement_lookup = {
                str(requirement.id): requirement for requirement in requirement_rows
            }
        
        # Format response
        notification_list = []
        for notification in notifications:
            notification_data = {
                "id": notification.id,
                "type": notification.notification_type,
                "title": notification.title,
                "message": notification.message,
                "priority": notification.priority,
                "is_read": notification.is_read,
                "created_at": notification.created_at.isoformat(),
                "read_at": notification.read_at.isoformat() if notification.read_at else None,
                "expires_at": notification.expires_at.isoformat() if notification.expires_at else None,
                "reference_id": notification.reference_id,
                "requirement_id": notification.requirement_id,
            }

            linked_requirement = None
            if notification.requirement_id:
                linked_requirement = requirement_lookup.get(str(notification.requirement_id))
                if not linked_requirement:
                    linked_requirement = notification.requirement

            # Add requirement info when available
            if linked_requirement:
                notification_data["requirement"] = {
                    "id": linked_requirement.id,
                    "code": linked_requirement.requirement_code,
                    "title": linked_requirement.title,
                    "status": linked_requirement.status,
                    "activity_status": linked_requirement.activity_status,
                    "job_id": linked_requirement.job_id,
                    "last_activity_at": (
                        linked_requirement.last_activity_at.isoformat()
                        if linked_requirement.last_activity_at
                        else None
                    ),
                }

            if (
                notification.notification_type in candidate_notification_types
                and notification.reference_id
            ):
                candidate = candidate_lookup.get(str(notification.reference_id))
                if candidate:
                    notification_data["candidate"] = {
                        "id": candidate.id,
                        "public_id": candidate.public_id,
                        "full_name": candidate.full_name,
                        "email": candidate.email,
                    }

                job_id = (
                    linked_requirement.job_id
                    if linked_requirement and linked_requirement.job_id
                    else None
                )
                if notification.notification_type == "interview_scheduling_ready":
                    notification_data["action"] = {
                        "type": "schedule_interview",
                        "candidate_id": notification.reference_id,
                        "requirement_id": notification.requirement_id,
                        "job_id": job_id,
                    }
                elif notification.notification_type == "interview_scheduled":
                    notification_data["action"] = {
                        "type": "view_interview_calendar",
                        "candidate_id": notification.reference_id,
                        "requirement_id": notification.requirement_id,
                        "job_id": job_id,
                    }
            
            notification_list.append(notification_data)
        
        return {
            "notifications": notification_list,
            "pagination": {
                "total": total_count,
                "offset": offset,
                "limit": limit,
                "has_more": total_count > offset + limit
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch notifications: {str(e)}")


@router.post("/notifications/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark a specific notification as read.
    """
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user context")

        notification = db.query(SystemNotification).filter(
            and_(
                SystemNotification.id == notification_id,
                SystemNotification.user_id == user_id
            )
        ).first()
        
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            db.commit()
        
        return {"message": "Notification marked as read", "notification_id": notification_id}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to mark notification as read: {str(e)}")


@router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    notification_type: Optional[str] = Query(None)
):
    """
    Mark all notifications (or all of a specific type) as read for the current user.
    """
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user context")

        query = db.query(SystemNotification).filter(
            and_(
                SystemNotification.user_id == user_id,
                SystemNotification.is_read == False
            )
        )
        
        if notification_type:
            query = query.filter(SystemNotification.notification_type == notification_type)
        
        unread_notifications = query.all()
        marked_count = 0
        
        for notification in unread_notifications:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            marked_count += 1
        
        db.commit()
        
        return {
            "message": f"Marked {marked_count} notifications as read",
            "marked_count": marked_count
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to mark notifications as read: {str(e)}")


@router.get("/notifications/summary")
async def get_notification_summary(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get notification summary including unread counts by type.
    """
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user context")

        # Get unread notification counts by type
        unread_counts = db.query(
            SystemNotification.notification_type,
            func.count(SystemNotification.id).label('count')
        ).filter(
            and_(
                SystemNotification.user_id == user_id,
                SystemNotification.is_read == False,
                or_(
                    SystemNotification.expires_at.is_(None),
                    SystemNotification.expires_at > datetime.utcnow()
                )
            )
        ).group_by(SystemNotification.notification_type).all()
        
        # Format the counts
        type_counts = {item.notification_type: item.count for item in unread_counts}
        total_unread = sum(type_counts.values())
        
        return {
            "total_unread": total_unread,
            "unread_by_type": type_counts,
            "has_urgent": db.query(SystemNotification).filter(
                and_(
                    SystemNotification.user_id == user_id,
                    SystemNotification.is_read == False,
                    SystemNotification.priority == "urgent"
                )
            ).first() is not None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get notification summary: {str(e)}")


# ============================================================
# REQUIREMENT ACTIVITY ENDPOINTS
# ============================================================

@router.post("/requirements/{requirement_id}/activity")
async def log_requirement_activity(
    requirement_id: str,
    activity_data: Dict[str, Any],
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Log activity on a requirement. This helps track engagement and prevent passive status.
    
    Expected payload:
    {
        "activity_type": "view|submit_candidate|comment|edit|etc",
        "description": "Optional description",
        "metadata": {} // Optional additional data
    }
    """
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user context")

        # Validate the requirement exists and user has access
        requirement = db.query(Requirement).filter(Requirement.id == requirement_id).first()
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
        
        # Initialize the monitor
        monitor = PassiveRequirementMonitor(db)
        
        # Log the activity
        monitor.log_recruiter_activity(
            recruiter_id=user_id,
            requirement_id=requirement_id,
            activity_type=activity_data.get("activity_type", "general"),
            description=activity_data.get("description", ""),
            activity_metadata=activity_data.get("metadata", {})
        )
        
        return {
            "message": "Activity logged successfully",
            "requirement_id": requirement_id,
            "activity_type": activity_data.get("activity_type"),
            "last_activity_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to log activity: {str(e)}")


@router.get("/recruiter/requirements/summary")
async def get_recruiter_requirements_summary(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get summary of active and passive requirements assigned to the current recruiter.
    """
    try:
        user_id = get_user_id(current_user)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid user context")

        # Get requirements where this recruiter has recent activity
        recent_activities = db.query(RecruiterActivity.requirement_id).filter(
            RecruiterActivity.recruiter_id == user_id
        ).distinct().subquery()
        
        # Count active and passive requirements
        active_count = db.query(Requirement).filter(
            and_(
                Requirement.id.in_(recent_activities),
                Requirement.activity_status == "active",
                Requirement.status.in_(["active", "in_progress", "open"])
            )
        ).count()
        
        passive_count = db.query(Requirement).filter(
            and_(
                Requirement.id.in_(recent_activities),
                Requirement.activity_status == "passive",
                Requirement.status.in_(["active", "in_progress", "open"])
            )
        ).count()
        
        # Get recent passive requirements with details
        passive_requirements = db.query(Requirement).filter(
            and_(
                Requirement.id.in_(recent_activities),
                Requirement.activity_status == "passive",
                Requirement.status.in_(["active", "in_progress", "open"])
            )
        ).order_by(desc(Requirement.last_passive_alert_at)).limit(10).all()
        
        passive_details = []
        for req in passive_requirements:
            hours_inactive = int((datetime.utcnow() - req.last_activity_at).total_seconds() / 3600)
            passive_details.append({
                "id": req.id,
                "code": req.requirement_code,
                "title": req.title,
                "last_activity_at": req.last_activity_at.isoformat(),
                "hours_inactive": hours_inactive,
                "status": req.status
            })
        
        return {
            "active_requirements": active_count,
            "passive_requirements": passive_count,
            "total_requirements": active_count + passive_count,
            "passive_details": passive_details
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get requirements summary: {str(e)}")


# ============================================================
# ADMIN ENDPOINTS (for testing and maintenance)
# ============================================================

@router.post("/admin/run-passive-scan")
async def trigger_passive_scan(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger a passive requirement scan (admin only).
    """
    # Note: In production, add admin role check here
    try:
        monitor = PassiveRequirementMonitor(db)
        result = monitor.scan_for_passive_requirements()
        
        return {
            "message": "Passive requirement scan completed",
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run passive scan: {str(e)}")

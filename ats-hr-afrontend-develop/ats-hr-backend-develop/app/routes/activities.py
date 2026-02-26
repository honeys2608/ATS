# app/routes/activities.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from app.services.activity_service import ActivityService, format_relative_time, format_activity_description

router = APIRouter(
    prefix="/v1/activities",
    tags=["Activities"]
)


@router.post("", response_model=schemas.ActivityResponse)
def create_activity(
    activity: schemas.ActivityCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create a new activity record."""
    
    activity_service = ActivityService(db)
    
    new_activity = activity_service.track_activity(
        entity_type=activity.entity_type,
        entity_id=activity.entity_id,
        activity_type=activity.activity_type,
        actor_id=current_user["id"],
        actor_role=current_user["role"],
        description=activity.description,
        metadata=activity.metadata
    )
    
    # Format response
    response = schemas.ActivityResponse.from_orm(new_activity)
    response.relative_time = format_relative_time(new_activity.created_at)
    response.actor_name = current_user.get("full_name", current_user.get("username"))
    
    return response


@router.get("/{entity_type}/{entity_id}", response_model=schemas.EntityActivitySummary)
def get_entity_activities(
    entity_type: str,
    entity_id: str,
    limit: int = Query(default=20, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get activities for a specific entity (job, candidate, or application)."""
    
    if entity_type not in ["job", "candidate", "application"]:
        raise HTTPException(status_code=400, detail="Invalid entity_type")
    
    activity_service = ActivityService(db)
    activities = activity_service.get_entity_activities(entity_type, entity_id, limit)
    
    # Get total count
    total_activities = (
        db.query(models.Activity)
        .filter(
            models.Activity.entity_type == entity_type,
            models.Activity.entity_id == entity_id
        )
        .count()
    )
    
    # Format activities with relative time
    formatted_activities = []
    for activity in activities:
        activity_response = schemas.ActivityResponse.from_orm(activity)
        activity_response.relative_time = format_relative_time(activity.created_at)
        
        # Get actor name if available
        if activity.actor:
            activity_response.actor_name = activity.actor.full_name or activity.actor.username
        
        formatted_activities.append(activity_response)
    
    return schemas.EntityActivitySummary(
        entity_type=entity_type,
        entity_id=entity_id,
        total_activities=total_activities,
        last_activity=formatted_activities[0] if formatted_activities else None,
        recent_activities=formatted_activities
    )


@router.get("/stale/{entity_type}", response_model=List[schemas.StaleEntityResponse])
def get_stale_entities(
    entity_type: str,
    days: int = Query(default=14, ge=1, le=365),
    limit: int = Query(default=50, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get entities with no activity within the specified number of days."""
    
    if entity_type not in ["job", "candidate", "application"]:
        raise HTTPException(status_code=400, detail="Invalid entity_type")
    
    activity_service = ActivityService(db)
    stale_entities = activity_service.get_stale_entities(entity_type, days)
    
    # Limit results
    stale_entities = stale_entities[:limit]
    
    # Enrich with entity details
    enriched_entities = []
    for entity_data in stale_entities:
        response = schemas.StaleEntityResponse(
            entity_type=entity_type,
            **entity_data
        )
        
        # Add entity-specific details
        if entity_type == "job":
            job = db.query(models.Job).filter(models.Job.id == entity_data["id"]).first()
            if job:
                response.title = job.title
                response.status = job.status
        elif entity_type == "candidate":
            candidate = db.query(models.Candidate).filter(models.Candidate.id == entity_data["id"]).first()
            if candidate:
                response.name = candidate.full_name
                response.status = candidate.status.value if candidate.status else None
        
        enriched_entities.append(response)
    
    return enriched_entities


@router.get("/dashboard/summary")
def get_activity_dashboard_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get activity summary for dashboard."""
    
    activity_service = ActivityService(db)
    
    # Get recent activity counts by type
    recent_activities = (
        db.query(models.Activity)
        .filter(models.Activity.created_at >= models.Activity.created_at - 7)  # Last 7 days
        .all()
    )
    
    activity_counts = {
        "total_activities_week": len(recent_activities),
        "jobs_created_week": len([a for a in recent_activities if a.activity_type == "Job Created"]),
        "candidates_added_week": len([a for a in recent_activities if a.activity_type == "Candidate Added"]),
        "applications_week": len([a for a in recent_activities if a.activity_type == "Candidate Applied"]),
    }
    
    # Get stale entity counts
    stale_jobs = len(activity_service.get_stale_entities("job", 14))
    stale_candidates = len(activity_service.get_stale_entities("candidate", 30))
    
    return {
        "activity_summary": activity_counts,
        "stale_entities": {
            "stale_jobs_14_days": stale_jobs,
            "stale_candidates_30_days": stale_candidates,
        },
        "generated_at": models.datetime.utcnow()
    }
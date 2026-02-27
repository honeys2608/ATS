# app/routes/candidate_workflow.py
"""
Candidate Recruitment Workflow API
Handles status transitions, activity tracking, and workflow automation
"""

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, cast, String, text
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from app.db import get_db, ensure_job_application_interview_ready_columns
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from app.utils.activity import log_activity as write_activity_log

router = APIRouter(prefix="/workflow", tags=["Candidate Workflow"])

INTERVIEW_READY_DEFAULT_NOTE = (
    "Client shortlisted candidate. AM marked Interview Scheduling Ready. "
    "Recruiter can proceed with scheduling."
)

# ============================================================
# CONSTANTS
# ============================================================

# Final statuses - profile is LOCKED
FINAL_STATUSES = {
    "rejected_by_recruiter",
    "am_rejected", 
    "client_rejected",
    "hired",
    "offer_declined",
    "rejected",
    "joined"
}
LOCK_RELEASE_STATUSES = {
    "withdrawn",
    "rejected",
    "rejected_by_recruiter",
    "am_rejected",
    "client_rejected",
    "hired",
    "joined",
    "offer_declined",
}

# Valid status transitions
VALID_TRANSITIONS = {
    # From NEW
    "new": ["called", "hold_revisit", "rejected_by_recruiter", "sent_to_am"],
    "applied": ["new", "called", "hold_revisit", "rejected_by_recruiter", "sent_to_am"],
    "sourced": ["new", "called", "hold_revisit", "rejected_by_recruiter", "sent_to_am"],
    
    # From CALLED
    "called": ["feedback_added", "hold_revisit", "rejected_by_recruiter", "sent_to_am"],
    
    # From FEEDBACK_ADDED
    "feedback_added": ["hold_revisit", "rejected_by_recruiter", "sent_to_am"],
    
    # From HOLD_REVISIT
    "hold_revisit": ["called", "rejected_by_recruiter", "sent_to_am"],
    
    # From SENT_TO_AM
    "sent_to_am": ["am_viewed", "am_shortlisted", "am_rejected"],
    
    # From AM_VIEWED
    "am_viewed": ["am_shortlisted", "am_rejected", "sent_to_client"],
    
    # From AM_SHORTLISTED
    "am_shortlisted": ["sent_to_client", "am_rejected"],
    
    # From SENT_TO_CLIENT
    "sent_to_client": ["client_viewed", "client_shortlisted", "client_hold", "client_rejected"],
    
    # From CLIENT stages
    "client_viewed": ["client_shortlisted", "client_hold", "client_rejected"],
    "client_shortlisted": ["interview_scheduled", "client_hold", "client_rejected"],
    "client_hold": ["client_shortlisted", "client_rejected"],
    
    # From INTERVIEW stages
    "interview_scheduled": ["interview_completed"],
    "interview_completed": ["selected", "rejected", "interview_scheduled"],  # Can reschedule
    
    # From SELECTED
    "selected": ["negotiation", "offer_extended", "rejected"],
    
    # From NEGOTIATION
    "negotiation": ["offer_extended", "rejected"],
    
    # From OFFER stages
    "offer_extended": ["offer_accepted", "offer_declined"],
    "offer_accepted": ["hired"],
    
    # Final stages - no transitions allowed
    "hired": [],
    "joined": [],
    "rejected_by_recruiter": [],
    "am_rejected": [],
    "client_rejected": [],
    "offer_declined": [],
    "rejected": [],
}

# Status groups for filtering
STATUS_GROUPS = {
    "recruiter_new": ["new", "applied", "sourced"],
    "recruiter_called": ["called"],
    "recruiter_feedback": ["feedback_added"],
    "recruiter_hold": ["hold_revisit"],
    "recruiter_rejected": ["rejected_by_recruiter"],
    "recruiter_sent_to_am": ["sent_to_am"],
    "recruiter_interview": ["interview_scheduled", "interview_completed"],
    "recruiter_selected": ["selected", "negotiation"],
    "recruiter_hired": ["hired", "joined"],
    
    "am_inbox": ["sent_to_am"],
    "am_viewed": ["am_viewed"],
    "am_shortlisted": ["am_shortlisted"],
    "am_rejected": ["am_rejected"],
    "am_sent_to_client": ["sent_to_client"],
    
    "client_viewed": ["client_viewed"],
    "client_shortlisted": ["client_shortlisted"],
    "client_hold": ["client_hold"],
    "client_rejected": ["client_rejected"],
}


# ============================================================
# PYDANTIC MODELS
# ============================================================

class StatusUpdateRequest(BaseModel):
    new_status: str
    notes: Optional[str] = None
    job_id: Optional[str] = None  # For context


class BulkStatusUpdateRequest(BaseModel):
    candidate_ids: List[str]
    new_status: str
    notes: Optional[str] = None
    job_id: Optional[str] = None


class WorkflowActionPayload(BaseModel):
    job_id: Optional[str] = None
    notes: Optional[str] = None
    decision: Optional[str] = None
    rejection_type: Optional[str] = None
    reason: Optional[str] = None
    client_id: Optional[str] = None
    interview_date: Optional[str] = None


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def is_final_status(status: str) -> bool:
    """Check if status is final (locked)"""
    return status in FINAL_STATUSES


def can_transition(from_status: str, to_status: str) -> bool:
    """Check if transition is valid"""
    allowed = VALID_TRANSITIONS.get(from_status, [])
    return to_status in allowed


def log_activity(db: Session, candidate_id: str, action: str, user_id: str, 
                 old_status: str = None, new_status: str = None, notes: str = None):
    """Log activity to timeline"""
    try:
        timeline = models.CandidateTimeline(
            candidate_id=candidate_id,
            status=new_status or action,
            note=notes or f"Status changed from {old_status} to {new_status}",
            user_id=user_id
        )
        db.add(timeline)

        actor_user = db.query(models.User).filter(models.User.id == user_id).first()
        actor_role = actor_user.role if actor_user else "system"
        actor_name = actor_user.full_name if actor_user else "System"

        candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
        candidate_name = candidate.full_name if candidate else candidate_id

        latest_submission = (
            db.query(models.CandidateSubmission)
            .filter(models.CandidateSubmission.candidate_id == candidate_id)
            .order_by(models.CandidateSubmission.updated_at.desc())
            .first()
        )
        latest_application = (
            db.query(models.JobApplication)
            .filter(models.JobApplication.candidate_id == candidate_id)
            .order_by(models.JobApplication.applied_at.desc())
            .first()
        )

        normalized_new = normalize_status_value(new_status)
        visible_candidate_states = {
            "sent_to_client",
            "client_shortlisted",
            "interview_scheduled",
            "selected",
            "offer_extended",
            "hired",
            "rejected",
            "client_rejected",
        }
        is_visible_to_candidate = normalized_new in visible_candidate_states

        action_key = normalize_status_value(action)
        am_action_map = {
            "am_shortlisted": "am.shortlisted",
            "am_hold": "am.placed_on_hold",
            "rejected": "am.rejected",
            "sent_to_client": "am.sent_to_client",
            "client_shortlisted": "am.client_shortlisted",
            "client_hold": "am.client_hold",
            "client_rejected": "am.client_rejected",
            "client_viewed": "am.client_decision",
            "interview_scheduling_ready": "am.interview_scheduling_ready",
        }
        recruiter_action_map = {
            "sent_to_am": "recruiter.submitted_to_am",
            "feedback_added": "recruiter.feedback_added",
            "interview_scheduled": "recruiter.interview_scheduled",
            "interview_completed": "recruiter.interview_completed",
            "called": "recruiter.called",
            "hold": "recruiter.hold",
        }
        candidate_action_map = {
            "sent_to_client": "application.sent_to_client",
            "client_shortlisted": "application.shortlisted",
            "interview_scheduled": "interview.scheduled",
            "selected": "application.selected",
            "hired": "application.hired",
            "client_rejected": "application.client_rejected",
            "rejected": "application.client_rejected",
        }
        if actor_role in {"account_manager", "am"}:
            action_name = am_action_map.get(action_key) or am_action_map.get(normalized_new) or f"am.{action_key or normalized_new or 'status_updated'}"
        elif actor_role == "recruiter":
            action_name = recruiter_action_map.get(action_key) or recruiter_action_map.get(normalized_new) or f"recruiter.{action_key or normalized_new or 'status_updated'}"
        else:
            action_name = f"system.{action_key or normalized_new or 'status_updated'}"

        write_activity_log(
            db,
            action=action_name,
            resource_type="candidate",
            actor={
                "id": user_id,
                "full_name": actor_name,
                "role": actor_role,
            },
            resource_id=candidate_id,
            resource_name=candidate_name,
            target_user_id=candidate_id,
            job_id=(
                (latest_submission.job_id if latest_submission else None)
                or (latest_application.job_id if latest_application else None)
            ),
            recruiter_id=(
                (latest_submission.recruiter_id if latest_submission else None)
                or (latest_application.recruiter_id if latest_application else None)
            ),
            old_status=old_status,
            new_status=new_status,
            note=notes,
            is_visible_to_candidate=is_visible_to_candidate,
            metadata={
                "workflow_action": action,
                "candidate_action": candidate_action_map.get(normalized_new),
            },
        )
    except Exception as e:
        print(f"Failed to log activity: {e}")


def normalize_status_value(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def _is_recruiter(current_user: dict) -> bool:
    return normalize_status_value(current_user.get("role")) == "recruiter"


def _require_recruiter_job_lock(
    db: Session,
    *,
    current_user: dict,
    candidate_id: str,
    raw_job_id: Optional[str],
):
    if not _is_recruiter(current_user):
        return None

    resolved_job_id = resolve_job_reference(db, raw_job_id)
    if not resolved_job_id:
        raise HTTPException(
            status_code=400,
            detail="job_id is required for recruiter candidate status updates",
        )

    assigned = db.query(models.job_recruiters).filter(
        models.job_recruiters.c.job_id == resolved_job_id,
        models.job_recruiters.c.recruiter_id == current_user.get("id"),
    ).first()
    if not assigned:
        raise HTTPException(
            status_code=403,
            detail="You are not assigned to this job",
        )

    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.candidate_id == candidate_id,
        models.CandidateSubmission.job_id == resolved_job_id,
    ).first()
    if not submission:
        submission = models.CandidateSubmission(
            id=models.generate_uuid(),
            candidate_id=candidate_id,
            job_id=resolved_job_id,
            recruiter_id=current_user["id"],
            status="submitted",
            stage="recruiter_review",
            is_locked=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(submission)
        return resolved_job_id

    if (
        submission.recruiter_id
        and str(submission.recruiter_id) != str(current_user.get("id"))
        and submission.is_locked
        and normalize_status_value(submission.status) not in LOCK_RELEASE_STATUSES
    ):
        owner = db.query(models.User).filter(
            models.User.id == submission.recruiter_id
        ).first()
        owner_name = owner.full_name if owner and owner.full_name else (
            owner.username if owner else str(submission.recruiter_id)
        )
        job = db.query(models.Job).filter(models.Job.id == resolved_job_id).first()
        job_label = job.job_id if job and job.job_id else resolved_job_id
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"Candidate is in progress by recruiter {owner_name}",
                "lock_status_label": f"In Progress by Recruiter {owner_name}",
                "assignment_label": f"Assigned to Recruiter {owner_name} for Job ID {job_label}",
                "locked_by_recruiter_id": submission.recruiter_id,
                "job_id": job_label,
                "candidate_id": candidate_id,
            },
        )

    if submission.recruiter_id in (None, current_user.get("id")):
        submission.recruiter_id = current_user.get("id")
        submission.is_locked = True
        submission.updated_at = datetime.utcnow()

    return resolved_job_id


def resolve_job_reference(db: Session, raw_job_id: Optional[str]) -> Optional[str]:
    """
    Resolve a job context into jobs.id.
    Supports:
    - jobs.id
    - jobs.job_id (public code)
    - requirements.id / requirements.requirement_code (via requirements.job_id)
    """
    if not raw_job_id:
        return None

    raw_value = str(raw_job_id).strip()
    if not raw_value:
        return None

    # Direct job lookup (UUID or public job code)
    job = (
        db.query(models.Job.id)
        .filter(or_(models.Job.id == raw_value, models.Job.job_id == raw_value))
        .first()
    )
    if job and job.id:
        return job.id

    # Requirement lookup (legacy/frontend contexts may pass requirement id/code)
    requirement = (
        db.query(models.Requirement.job_id)
        .filter(
            or_(
                models.Requirement.id == raw_value,
                models.Requirement.requirement_code == raw_value,
            )
        )
        .first()
    )
    if requirement and requirement.job_id:
        return requirement.job_id

    existing_app = (
        db.query(models.JobApplication.id)
        .filter(models.JobApplication.job_id == raw_value)
        .first()
    )
    return raw_value if existing_app else None


def resolve_requirement_reference(db: Session, job_id: Optional[str]) -> Optional[str]:
    if not job_id:
        return None

    requirement = (
        db.query(models.Requirement.id)
        .filter(models.Requirement.job_id == job_id)
        .order_by(models.Requirement.created_at.desc())
        .first()
    )
    return requirement.id if requirement and requirement.id else None


def _as_iso(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    try:
        return value.isoformat()
    except Exception:
        return None


def _app_activity_time(app: models.JobApplication) -> datetime:
    timestamps = [
        value
        for value in (
            app.interview_scheduling_ready_at,
            app.decision_at,
            app.sent_to_client_at,
            app.sent_to_am_at,
            app.applied_at,
        )
        if isinstance(value, datetime)
    ]
    return max(timestamps) if timestamps else datetime.min


def _sorted_apps_latest_first(apps: List[models.JobApplication]) -> List[models.JobApplication]:
    return sorted(apps, key=_app_activity_time, reverse=True)


def _pick_primary_application(
    apps: List[models.JobApplication],
    candidate_status: str,
) -> Optional[models.JobApplication]:
    if not apps:
        return None

    candidate_status = normalize_status_value(candidate_status)
    sorted_apps = _sorted_apps_latest_first(apps)

    by_exact_status = next(
        (app for app in sorted_apps if normalize_status_value(app.status) == candidate_status),
        None,
    )
    if by_exact_status:
        return by_exact_status

    by_stage_priority = next(
        (
            app
            for app in sorted_apps
            if normalize_status_value(app.status)
            in {"client_shortlisted", "interview_scheduled", "interview_completed"}
        ),
        None,
    )
    if by_stage_priority:
        return by_stage_priority

    return sorted_apps[0]


def sync_job_application_status(
    db: Session,
    candidate: models.Candidate,
    new_status: str,
    user_id: str,
    raw_job_id: Optional[str] = None,
    allowed_from_statuses: Optional[List[str]] = None,
    notes: Optional[str] = None,
    client_decision: Optional[str] = None,
    create_if_missing: bool = False,
) -> dict:
    """
    Keep JobApplication.status aligned with workflow actions.
    Returns resolved job context + number of updated records.
    """
    ensure_job_application_interview_ready_columns()
    now = datetime.utcnow()
    resolved_job_id = resolve_job_reference(db, raw_job_id)

    query = db.query(models.JobApplication).filter(
        models.JobApplication.candidate_id == candidate.id
    )
    if resolved_job_id:
        query = query.filter(models.JobApplication.job_id == resolved_job_id)

    if allowed_from_statuses:
        allowed = [normalize_status_value(s) for s in allowed_from_statuses if s]
        if allowed:
            query = query.filter(
                func.lower(
                    cast(
                        func.coalesce(models.JobApplication.status, ""),
                        String,
                    )
                ).in_(allowed)
            )

    apps = query.all()

    # Legacy/backfilled records can carry unexpected intermediate values and miss
    # the strict allowed_from_statuses filter. If we already have a resolved job
    # scope, retry without the status gate so AM actions still sync that
    # submission record.
    if not apps and resolved_job_id and allowed_from_statuses:
        apps = (
            db.query(models.JobApplication)
            .filter(
                models.JobApplication.candidate_id == candidate.id,
                models.JobApplication.job_id == resolved_job_id,
            )
            .all()
        )

    # For recruiter -> AM handoff, ensure a job application exists for that requirement.
    if not apps and create_if_missing and resolved_job_id:
        app = db.query(models.JobApplication).filter(
            models.JobApplication.job_id == resolved_job_id,
            models.JobApplication.candidate_id == candidate.id,
        ).first()
        if not app:
            app = models.JobApplication(
                job_id=resolved_job_id,
                candidate_id=candidate.id,
                full_name=candidate.full_name,
                email=candidate.email,
                phone=candidate.phone,
                status=new_status,
                applied_at=now,
                recruiter_id=user_id,
            )
            db.add(app)
        apps = [app]

    for app in apps:
        app.status = new_status
        app.last_activity_at = now
        app.last_activity_type = f"workflow_{new_status}"

        if new_status == "sent_to_am" and not app.sent_to_am_at:
            app.sent_to_am_at = now
        if new_status == "sent_to_client":
            if not app.sent_to_client_at:
                app.sent_to_client_at = now
            app.decision_at = None
            app.client_decision = None
            app.interview_scheduling_ready = False
            app.interview_scheduling_note = None
            app.interview_scheduling_ready_at = None
            app.interview_scheduling_ready_by = None
        if client_decision:
            app.client_decision = client_decision
            app.decision_at = now
        elif new_status in {
            "client_viewed",
            "client_shortlisted",
            "client_hold",
            "client_rejected",
        }:
            decision_map = {
                "client_viewed": "viewed",
                "client_shortlisted": "shortlisted",
                "client_hold": "hold",
                "client_rejected": "rejected",
            }
            app.client_decision = decision_map.get(new_status)
            app.decision_at = now

        if new_status in {"client_viewed", "client_shortlisted", "client_hold", "client_rejected"}:
            app.interview_scheduling_ready = False
            app.interview_scheduling_note = None
            app.interview_scheduling_ready_at = None
            app.interview_scheduling_ready_by = None

        if new_status == "interview_scheduled":
            app.interview_scheduling_ready = False

    return {
        "job_id": resolved_job_id,
        "updated_count": len(apps),
        "notes": notes,
    }


# Some deployed databases still have legacy enum values.
# Fall back to nearest compatible status for candidate.status writes.
CANDIDATE_STATUS_FALLBACKS = {
    "am_viewed": "sent_to_am",
    "am_shortlisted": "sent_to_am",
    "sent_to_client": "sent_to_am",
    "client_viewed": "sent_to_client",
    "client_shortlisted": "sent_to_client",
    "client_hold": "hold_revisit",
    "client_rejected": "rejected",
    "interview_scheduled": "interview",
    "interview_completed": "interview",
}


def get_supported_candidate_statuses(db: Session) -> set:
    try:
        rows = db.execute(
            text(
                """
                SELECT e.enumlabel
                FROM pg_type t
                JOIN pg_enum e ON t.oid = e.enumtypid
                WHERE t.typname IN ('candidate_status', 'candidatestatus')
                """
            )
        ).fetchall()
        if rows:
            return {normalize_status_value(r[0]) for r in rows if r and r[0]}
    except Exception:
        pass

    try:
        return {
            normalize_status_value(v.value if hasattr(v, "value") else v)
            for v in models.CandidateStatus
        }
    except Exception:
        return set()


def apply_candidate_status(
    db: Session,
    candidate: models.Candidate,
    desired_status: str,
) -> str:
    current_status = normalize_status_value(
        candidate.status.value if hasattr(candidate.status, "value") else candidate.status
    )
    target_status = normalize_status_value(desired_status)
    supported = get_supported_candidate_statuses(db)

    if supported and target_status not in supported:
        fallback_status = normalize_status_value(
            CANDIDATE_STATUS_FALLBACKS.get(target_status)
        )
        if fallback_status and fallback_status in supported:
            target_status = fallback_status
        else:
            target_status = current_status

    candidate.status = target_status
    candidate.updated_at = datetime.utcnow()
    return target_status


# ============================================================
# STATUS UPDATE ENDPOINTS
# ============================================================

@router.put("/candidates/{candidate_id}/status")
def update_candidate_status(
    candidate_id: str,
    payload: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update candidate status with validation and activity logging
    - Validates transition is allowed
    - Blocks changes to final statuses
    - Logs all changes to timeline
    """
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    new_status = payload.new_status.lower()
    
    # Check if current status is final (locked)
    if is_final_status(old_status):
        raise HTTPException(
            400, 
            f"Cannot change status. Candidate is in final status: {old_status}"
        )

    resolved_job_id = _require_recruiter_job_lock(
        db,
        current_user=current_user,
        candidate_id=candidate_id,
        raw_job_id=payload.job_id,
    )
    
    # Validate transition (optional - can be bypassed for flexibility)
    # if not can_transition(old_status, new_status):
    #     raise HTTPException(
    #         400,
    #         f"Invalid transition from {old_status} to {new_status}"
    #     )
    
    # Update candidate status (with enum fallback for legacy DBs)
    persisted_status = apply_candidate_status(db, candidate, new_status)

    application_updated = False

    # If a job context is provided, keep that JobApplication in sync as well.
    if payload.job_id or resolved_job_id:
        job = db.query(models.Job).filter(
            or_(
                models.Job.id == (resolved_job_id or payload.job_id),
                models.Job.job_id == payload.job_id,
            )
        ).first()
        if job:
            resolved_job_id = job.id
            app = db.query(models.JobApplication).filter(
                models.JobApplication.job_id == job.id,
                models.JobApplication.candidate_id == candidate_id,
            ).first()

            now = datetime.utcnow()
            if not app:
                app = models.JobApplication(
                    job_id=job.id,
                    candidate_id=candidate_id,
                    full_name=candidate.full_name,
                    email=candidate.email,
                    phone=candidate.phone,
                    status=new_status,
                    applied_at=now,
                    recruiter_id=current_user["id"],
                )
                db.add(app)
            else:
                app.status = new_status

            if new_status == "sent_to_am" and not app.sent_to_am_at:
                app.sent_to_am_at = now
            if new_status == "sent_to_client" and not app.sent_to_client_at:
                app.sent_to_client_at = now
            if new_status in {"client_viewed", "client_shortlisted", "client_hold", "client_rejected"}:
                decision_map = {
                    "client_viewed": "viewed",
                    "client_shortlisted": "shortlisted",
                    "client_hold": "hold",
                    "client_rejected": "rejected",
                }
                app.client_decision = decision_map.get(new_status)

            application_updated = True
    
    # Log activity
    log_activity(
        db=db,
        candidate_id=candidate_id,
        action="STATUS_CHANGE",
        user_id=current_user["id"],
        old_status=old_status,
        new_status=new_status,
        notes=payload.notes
    )
    
    db.commit()
    db.refresh(candidate)
    
    return {
        "message": f"Status updated to {new_status}",
        "candidate_id": candidate_id,
        "old_status": old_status,
        "new_status": new_status,
        "candidate_status": persisted_status,
        "job_id": resolved_job_id,
        "application_updated": application_updated,
        "is_final": is_final_status(persisted_status),
        "updated_at": candidate.updated_at
    }


@router.post("/candidates/bulk-status")
def bulk_update_status(
    payload: BulkStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Bulk update multiple candidates to same status
    Useful for: Send to AM, Reject multiple, etc.
    """
    new_status = payload.new_status.lower()
    results = {"success": [], "failed": [], "skipped": []}
    
    for candidate_id in payload.candidate_ids:
        candidate = db.query(models.Candidate).filter(
            models.Candidate.id == candidate_id
        ).first()
        
        if not candidate:
            results["failed"].append({"id": candidate_id, "reason": "Not found"})
            continue
        
        old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
        
        # Skip if already in final status
        if is_final_status(old_status):
            results["skipped"].append({"id": candidate_id, "reason": f"Final status: {old_status}"})
            continue
        
        # Update
        try:
            _require_recruiter_job_lock(
                db,
                current_user=current_user,
                candidate_id=candidate_id,
                raw_job_id=payload.job_id,
            )
        except HTTPException as exc:
            results["failed"].append({"id": candidate_id, "reason": exc.detail})
            continue
        persisted_status = apply_candidate_status(db, candidate, new_status)
        
        log_activity(
            db=db,
            candidate_id=candidate_id,
            action="BULK_STATUS_CHANGE",
            user_id=current_user["id"],
            old_status=old_status,
            new_status=persisted_status,
            notes=payload.notes
        )
        
        results["success"].append({"id": candidate_id, "old_status": old_status})
    
    db.commit()
    
    return {
        "message": f"Updated {len(results['success'])} candidates",
        "new_status": new_status,
        "results": results
    }


# ============================================================
# QUICK ACTIONS (Auto Status Updates)
# ============================================================

@router.post("/candidates/{candidate_id}/call")
def mark_candidate_called(
    candidate_id: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Mark candidate as called - auto updates status to CALLED"""
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")
    
    candidate.status = "called"
    candidate.updated_at = datetime.utcnow()
    
    log_activity(db, candidate_id, "CALLED", current_user["id"], old_status, "called", notes)
    db.commit()
    
    return {"message": "Marked as called", "status": "called"}


@router.post("/candidates/{candidate_id}/add-feedback")
def add_call_feedback(
    candidate_id: str,
    feedback: str,
    rating: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Add call feedback - auto updates status to FEEDBACK_ADDED"""
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")
    
    candidate.status = "feedback_added"
    candidate.updated_at = datetime.utcnow()
    
    # Store feedback in internal notes
    existing_notes = candidate.internal_notes or ""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    new_note = f"\n[{timestamp}] Call Feedback (Rating: {rating}/5): {feedback}"
    candidate.internal_notes = existing_notes + new_note
    
    log_activity(db, candidate_id, "FEEDBACK_ADDED", current_user["id"], 
                 old_status, "feedback_added", feedback)
    db.commit()
    
    return {"message": "Feedback added", "status": "feedback_added"}


@router.post("/candidates/{candidate_id}/hold")
def put_candidate_on_hold(
    candidate_id: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Put candidate on hold for later"""
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")
    
    candidate.status = "hold_revisit"
    candidate.updated_at = datetime.utcnow()
    
    log_activity(db, candidate_id, "HOLD", current_user["id"], 
                 old_status, "hold_revisit", reason)
    db.commit()
    
    return {"message": "Put on hold", "status": "hold_revisit"}


@router.post("/candidates/{candidate_id}/reject")
def reject_candidate(
    candidate_id: str,
    reason: Optional[str] = Query(default=None),
    rejection_type: str = Query(default="recruiter"),  # recruiter, am, client
    job_id: Optional[str] = Query(default=None),
    payload: Optional[WorkflowActionPayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Reject candidate - FINAL status"""
    payload = payload or WorkflowActionPayload()
    effective_reason = payload.reason or payload.notes or reason
    effective_rejection_type = normalize_status_value(
        payload.rejection_type or rejection_type or "recruiter"
    )
    effective_job_id = payload.job_id or job_id

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Already final: {old_status}")
    
    # Determine rejection status based on who is rejecting
    status_map = {
        "recruiter": "rejected_by_recruiter",
        "am": "am_rejected",
        "client": "client_rejected"
    }
    new_status = status_map.get(effective_rejection_type, "rejected")
    
    apply_candidate_status(db, candidate, new_status)
    
    sync_result = sync_job_application_status(
        db=db,
        candidate=candidate,
        new_status=new_status,
        user_id=current_user["id"],
        raw_job_id=effective_job_id,
        notes=effective_reason,
        client_decision="rejected" if new_status == "client_rejected" else None,
    )
    
    log_activity(
        db,
        candidate_id,
        "REJECTED",
        current_user["id"],
        old_status,
        new_status,
        effective_reason,
    )
    db.commit()
    
    return {
        "message": "Candidate rejected",
        "status": new_status,
        "is_final": True,
        "job_id": sync_result.get("job_id"),
        "applications_updated": sync_result.get("updated_count", 0),
    }


@router.post("/candidates/{candidate_id}/send-to-am")
def send_candidate_to_am(
    candidate_id: str,
    job_id: Optional[str] = Query(default=None),
    notes: Optional[str] = Query(default=None),
    payload: Optional[WorkflowActionPayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Send candidate to Account Manager"""
    payload = payload or WorkflowActionPayload()
    effective_job_id = payload.job_id or job_id
    effective_notes = payload.notes or notes

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")
    
    apply_candidate_status(db, candidate, "sent_to_am")

    sync_result = sync_job_application_status(
        db=db,
        candidate=candidate,
        new_status="sent_to_am",
        user_id=current_user["id"],
        raw_job_id=effective_job_id,
        notes=effective_notes,
        create_if_missing=bool(effective_job_id),
    )
    
    log_activity(
        db,
        candidate_id,
        "SENT_TO_AM",
        current_user["id"],
        old_status,
        "sent_to_am",
        effective_notes,
    )
    db.commit()
    
    return {
        "message": "Sent to Account Manager",
        "status": "sent_to_am",
        "job_id": sync_result.get("job_id"),
        "applications_updated": sync_result.get("updated_count", 0),
    }


# ============================================================
# AM ACTIONS
# ============================================================

@router.post("/candidates/{candidate_id}/am-view")
def am_view_candidate(
    candidate_id: str,
    job_id: Optional[str] = Query(default=None),
    payload: Optional[WorkflowActionPayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """AM views candidate - auto update to AM_VIEWED"""
    payload = payload or WorkflowActionPayload()
    effective_job_id = payload.job_id or job_id
    effective_notes = payload.notes

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)

    sync_result = sync_job_application_status(
        db=db,
        candidate=candidate,
        new_status="am_viewed",
        user_id=current_user["id"],
        raw_job_id=effective_job_id,
        allowed_from_statuses=["sent_to_am"],
        notes=effective_notes,
    )

    # Update candidate status when current stage is inbox OR when at least one scoped application moved.
    if old_status == "sent_to_am" or sync_result.get("updated_count", 0) > 0:
        apply_candidate_status(db, candidate, "am_viewed")

        log_activity(
            db,
            candidate_id,
            "AM_VIEWED",
            current_user["id"],
            old_status,
            "am_viewed",
            effective_notes,
        )
        db.commit()
    
    current_status = candidate.status.value if hasattr(candidate.status, "value") else str(candidate.status)
    response_status = (
        "am_viewed"
        if old_status == "sent_to_am" or sync_result.get("updated_count", 0) > 0
        else current_status
    )
    return {
        "message": "AM viewed",
        "status": response_status,
        "job_id": sync_result.get("job_id"),
        "applications_updated": sync_result.get("updated_count", 0),
    }


@router.post("/candidates/{candidate_id}/am-shortlist")
def am_shortlist_candidate(
    candidate_id: str,
    notes: Optional[str] = Query(default=None),
    job_id: Optional[str] = Query(default=None),
    payload: Optional[WorkflowActionPayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """AM shortlists candidate"""
    payload = payload or WorkflowActionPayload()
    effective_notes = payload.notes or notes
    effective_job_id = payload.job_id or job_id

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")
    
    apply_candidate_status(db, candidate, "am_shortlisted")

    sync_result = sync_job_application_status(
        db=db,
        candidate=candidate,
        new_status="am_shortlisted",
        user_id=current_user["id"],
        raw_job_id=effective_job_id,
        allowed_from_statuses=["sent_to_am", "am_viewed"],
        notes=effective_notes,
    )

    log_activity(
        db,
        candidate_id,
        "AM_SHORTLISTED",
        current_user["id"],
        old_status,
        "am_shortlisted",
        effective_notes,
    )
    db.commit()
    
    return {
        "message": "AM shortlisted",
        "status": "am_shortlisted",
        "job_id": sync_result.get("job_id"),
        "applications_updated": sync_result.get("updated_count", 0),
    }


@router.post("/candidates/{candidate_id}/am-hold")
def am_hold_candidate(
    candidate_id: str,
    notes: Optional[str] = Query(default=None),
    job_id: Optional[str] = Query(default=None),
    payload: Optional[WorkflowActionPayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """AM puts candidate on hold/revisit"""
    payload = payload or WorkflowActionPayload()
    effective_notes = payload.notes or notes
    effective_job_id = payload.job_id or job_id

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()

    if not candidate:
        raise HTTPException(404, "Candidate not found")

    old_status = candidate.status.value if hasattr(candidate.status, "value") else str(candidate.status)

    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")

    apply_candidate_status(db, candidate, "hold_revisit")

    sync_result = sync_job_application_status(
        db=db,
        candidate=candidate,
        new_status="hold_revisit",
        user_id=current_user["id"],
        raw_job_id=effective_job_id,
        allowed_from_statuses=[
            "sent_to_am",
            "am_viewed",
            "am_shortlisted",
            "sent_to_client",
            "client_viewed",
            "client_shortlisted",
            "client_hold",
        ],
        notes=effective_notes,
    )

    log_activity(
        db,
        candidate_id,
        "AM_HOLD",
        current_user["id"],
        old_status,
        "hold_revisit",
        effective_notes,
    )
    db.commit()

    return {
        "message": "Candidate moved to hold/revisit",
        "status": "hold_revisit",
        "job_id": sync_result.get("job_id"),
        "applications_updated": sync_result.get("updated_count", 0),
    }


@router.post("/candidates/{candidate_id}/send-to-client")
def send_to_client(
    candidate_id: str,
    client_id: Optional[str] = Query(default=None),
    notes: Optional[str] = Query(default=None),
    job_id: Optional[str] = Query(default=None),
    payload: Optional[WorkflowActionPayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """AM sends candidate to client"""
    payload = payload or WorkflowActionPayload()
    effective_notes = payload.notes or notes
    effective_job_id = payload.job_id or job_id
    _ = payload.client_id or client_id  # kept for compatibility / future usage

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")
    
    apply_candidate_status(db, candidate, "sent_to_client")

    sync_result = sync_job_application_status(
        db=db,
        candidate=candidate,
        new_status="sent_to_client",
        user_id=current_user["id"],
        raw_job_id=effective_job_id,
        allowed_from_statuses=["sent_to_am", "am_viewed", "am_shortlisted"],
        notes=effective_notes,
    )

    log_activity(
        db,
        candidate_id,
        "SENT_TO_CLIENT",
        current_user["id"],
        old_status,
        "sent_to_client",
        effective_notes,
    )
    db.commit()
    
    return {
        "message": "Sent to client",
        "status": "sent_to_client",
        "job_id": sync_result.get("job_id"),
        "applications_updated": sync_result.get("updated_count", 0),
    }


@router.post("/candidates/{candidate_id}/client-decision")
def update_client_decision(
    candidate_id: str,
    decision: Optional[str] = Query(default=None),  # viewed, shortlisted, hold, rejected
    notes: Optional[str] = Query(default=None),
    job_id: Optional[str] = Query(default=None),
    payload: Optional[WorkflowActionPayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """AM updates client decision"""
    payload = payload or WorkflowActionPayload()
    effective_decision = normalize_status_value(payload.decision or decision)
    effective_notes = payload.notes or notes
    effective_job_id = payload.job_id or job_id

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")
    
    status_map = {
        "viewed": "client_viewed",
        "shortlisted": "client_shortlisted",
        "hold": "client_hold",
        "rejected": "client_rejected"
    }
    
    new_status = status_map.get(effective_decision)
    if not new_status:
        raise HTTPException(400, f"Invalid decision: {effective_decision or decision}")
    
    apply_candidate_status(db, candidate, new_status)

    sync_result = sync_job_application_status(
        db=db,
        candidate=candidate,
        new_status=new_status,
        user_id=current_user["id"],
        raw_job_id=effective_job_id,
        allowed_from_statuses=[
            "sent_to_am",
            "am_viewed",
            "am_shortlisted",
            "sent_to_client",
            "client_viewed",
            "client_hold",
            "client_shortlisted",
        ],
        notes=effective_notes,
        client_decision=effective_decision,
    )

    log_activity(
        db,
        candidate_id,
        f"CLIENT_{effective_decision.upper()}",
        current_user["id"],
        old_status,
        new_status,
        effective_notes,
    )
    db.commit()
    
    return {
        "message": f"Client decision: {effective_decision}",
        "status": new_status,
        "job_id": sync_result.get("job_id"),
        "applications_updated": sync_result.get("updated_count", 0),
    }


@router.post("/candidates/{candidate_id}/mark-interview-ready")
def mark_interview_scheduling_ready(
    candidate_id: str,
    notes: Optional[str] = Query(default=None),
    job_id: Optional[str] = Query(default=None),
    payload: Optional[WorkflowActionPayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    AM marks a client-shortlisted candidate as ready for recruiter interview scheduling.
    This does not change candidate status; it only unlocks recruiter scheduling action.
    """
    payload = payload or WorkflowActionPayload()
    effective_notes = (payload.notes or notes or "").strip()
    effective_job_id = payload.job_id or job_id

    ensure_job_application_interview_ready_columns()

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    if not candidate:
        raise HTTPException(404, "Candidate not found")

    old_status = candidate.status.value if hasattr(candidate.status, "value") else str(candidate.status)
    normalized_old_status = normalize_status_value(old_status)

    if is_final_status(normalized_old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")

    if normalized_old_status not in {"client_shortlisted", "sent_to_client"}:
        raise HTTPException(
            400,
            "Interview scheduling can be enabled only when candidate is Client Shortlisted.",
        )

    raw_role = current_user.get("role")
    if hasattr(raw_role, "value"):
        raw_role = raw_role.value
    role_text = normalize_status_value(raw_role)
    allowed_am_roles = ("account_manager", "am", "admin", "super_admin")
    if role_text and not any(token in role_text for token in allowed_am_roles):
        raise HTTPException(403, "Only Account Manager can mark interview scheduling ready.")

    resolved_job_id = resolve_job_reference(db, effective_job_id)
    app_query = db.query(models.JobApplication).filter(
        models.JobApplication.candidate_id == candidate.id
    )
    if resolved_job_id:
        app_query = app_query.filter(models.JobApplication.job_id == resolved_job_id)

    apps = _sorted_apps_latest_first(app_query.all())
    shortlisted_apps = [
        app for app in apps if normalize_status_value(app.status) == "client_shortlisted"
    ]
    if not shortlisted_apps:
        raise HTTPException(
            400,
            "No client-shortlisted submission found for interview scheduling handoff.",
        )

    target_app = shortlisted_apps[0]
    if not target_app.recruiter_id:
        raise HTTPException(
            400,
            "Recruiter is not assigned for this candidate submission.",
        )

    now = datetime.utcnow()
    ready_note = effective_notes or INTERVIEW_READY_DEFAULT_NOTE

    target_app.interview_scheduling_ready = True
    target_app.interview_scheduling_note = ready_note
    target_app.interview_scheduling_ready_at = now
    target_app.interview_scheduling_ready_by = current_user["id"]
    target_app.last_activity_at = now
    target_app.last_activity_type = "workflow_interview_scheduling_ready"

    requirement_id = resolve_requirement_reference(db, target_app.job_id)
    requirement = None
    if requirement_id:
        requirement = (
            db.query(models.Requirement)
            .filter(models.Requirement.id == requirement_id)
            .first()
        )

    candidate_name = (
        str(candidate.full_name or "").strip()
        or str(candidate.public_id or "").strip()
        or "Candidate"
    )
    requirement_title = (
        (requirement.title if requirement else None)
        or (target_app.job.title if target_app.job else None)
        or "selected requirement"
    )
    requirement_code = (
        str(requirement.requirement_code or "").strip()
        if requirement and requirement.requirement_code
        else ""
    )
    requirement_label = (
        f"{requirement_title} ({requirement_code})"
        if requirement_code
        else requirement_title
    )

    notification = models.SystemNotification(
        user_id=target_app.recruiter_id,
        notification_type="interview_scheduling_ready",
        title=f"Interview scheduling ready: {candidate_name}",
        message=(
            f"{candidate_name} is shortlisted for {requirement_label}. "
            f"You can now schedule the interview. AM note: {ready_note}"
        ),
        reference_id=candidate.id,
        requirement_id=requirement_id,
        priority="high",
        created_at=now,
    )
    db.add(notification)

    log_activity(
        db,
        candidate_id,
        "INTERVIEW_SCHEDULING_READY",
        current_user["id"],
        old_status,
        old_status,
        ready_note,
    )

    db.commit()

    return {
        "message": "Interview scheduling marked ready. Recruiter notified.",
        "status": normalized_old_status,
        "job_id": target_app.job_id,
        "interview_scheduling_ready": True,
        "interview_scheduling_note": ready_note,
        "recruiter_notification_sent": True,
        "assigned_recruiter_id": target_app.recruiter_id,
    }


# ============================================================
# INTERVIEW & FINAL STAGES
# ============================================================

@router.post("/candidates/{candidate_id}/schedule-interview")
def schedule_interview_status(
    candidate_id: str,
    interview_date: Optional[str] = Query(default=None),
    notes: Optional[str] = Query(default=None),
    job_id: Optional[str] = Query(default=None),
    payload: Optional[WorkflowActionPayload] = Body(default=None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Update status to interview scheduled"""
    payload = payload or WorkflowActionPayload()
    effective_interview_date = payload.interview_date or interview_date
    effective_notes = payload.notes or notes
    effective_job_id = payload.job_id or job_id
    ensure_job_application_interview_ready_columns()

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    normalized_old_status = normalize_status_value(old_status)
    
    if is_final_status(normalized_old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")

    if normalized_old_status not in {"client_shortlisted", "sent_to_client"}:
        raise HTTPException(
            400,
            "Schedule Interview can be triggered only after client shortlist.",
        )

    resolved_job_id = resolve_job_reference(db, effective_job_id)
    app_query = db.query(models.JobApplication).filter(
        models.JobApplication.candidate_id == candidate.id
    )
    if resolved_job_id:
        app_query = app_query.filter(models.JobApplication.job_id == resolved_job_id)

    scoped_apps = _sorted_apps_latest_first(app_query.all())
    shortlisted_apps = [
        app for app in scoped_apps if normalize_status_value(app.status) == "client_shortlisted"
    ]
    if not shortlisted_apps:
        raise HTTPException(
            400,
            "No client-shortlisted submission found for this candidate.",
        )

    ready_apps = [app for app in shortlisted_apps if bool(app.interview_scheduling_ready)]
    if not ready_apps:
        raise HTTPException(
            400,
            "Interview scheduling is not ready. Ask AM to mark Interview Scheduling Ready first.",
        )

    requester_id = str(current_user.get("id") or "").strip()
    if requester_id:
        assigned_ready_apps = [
            app
            for app in ready_apps
            if str(app.recruiter_id or "").strip() == requester_id
        ]
        if any(str(app.recruiter_id or "").strip() for app in ready_apps) and not assigned_ready_apps:
            raise HTTPException(
                403,
                "This candidate is assigned to a different recruiter.",
            )
        if assigned_ready_apps:
            ready_apps = assigned_ready_apps

    selected_app = _sorted_apps_latest_first(ready_apps)[0]
    selected_job_id = selected_app.job_id

    apply_candidate_status(db, candidate, "interview_scheduled")

    sync_result = sync_job_application_status(
        db=db,
        candidate=candidate,
        new_status="interview_scheduled",
        user_id=current_user["id"],
        raw_job_id=selected_job_id,
        allowed_from_statuses=[
            "sent_to_client",
            "client_viewed",
            "client_shortlisted",
            "client_hold",
            "am_shortlisted",
            "am_viewed",
            "sent_to_am",
        ],
        notes=effective_notes,
    )

    log_activity(
        db,
        candidate_id,
        "INTERVIEW_SCHEDULED",
        current_user["id"],
        old_status,
        "interview_scheduled",
        f"Interview: {effective_interview_date}. {effective_notes or selected_app.interview_scheduling_note or ''}".strip(),
    )

    # Consume pending AM handoff notifications once recruiter schedules interview.
    requester_id = str(current_user.get("id") or "").strip()
    if requester_id:
        (
            db.query(models.SystemNotification)
            .filter(
                models.SystemNotification.user_id == requester_id,
                models.SystemNotification.notification_type == "interview_scheduling_ready",
                models.SystemNotification.reference_id == candidate.id,
                models.SystemNotification.is_read == False,
            )
            .update(
                {
                    models.SystemNotification.is_read: True,
                    models.SystemNotification.read_at: datetime.utcnow(),
                },
                synchronize_session=False,
            )
        )

    db.commit()
    
    return {
        "message": "Candidate moved to recruiter interview queue",
        "status": "interview_scheduled",
        "job_id": sync_result.get("job_id"),
        "applications_updated": sync_result.get("updated_count", 0),
    }


@router.post("/candidates/{candidate_id}/complete-interview")
def complete_interview_status(
    candidate_id: str,
    outcome: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Mark interview as completed"""
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    candidate.status = "interview_completed"
    candidate.updated_at = datetime.utcnow()
    
    log_activity(db, candidate_id, "INTERVIEW_COMPLETED", current_user["id"], 
                 old_status, "interview_completed", f"Outcome: {outcome}. {notes}")
    db.commit()
    
    return {"message": "Interview completed", "status": "interview_completed"}


@router.post("/candidates/{candidate_id}/select")
def select_candidate(
    candidate_id: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Select candidate after interview"""
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Final status: {old_status}")
    
    candidate.status = "selected"
    candidate.updated_at = datetime.utcnow()
    
    log_activity(db, candidate_id, "SELECTED", current_user["id"], 
                 old_status, "selected", notes)
    db.commit()
    
    return {"message": "Candidate selected", "status": "selected"}


@router.post("/candidates/{candidate_id}/hire")
def hire_candidate(
    candidate_id: str,
    joining_date: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Hire candidate - FINAL status"""
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    old_status = candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)
    
    if is_final_status(old_status):
        raise HTTPException(400, f"Cannot update. Already final: {old_status}")
    
    candidate.status = "hired"
    candidate.updated_at = datetime.utcnow()
    
    log_activity(db, candidate_id, "HIRED", current_user["id"], 
                 old_status, "hired", f"Joining: {joining_date}. {notes}")
    db.commit()
    
    return {"message": "Candidate hired!", "status": "hired", "is_final": True}


# ============================================================
# GET CANDIDATES BY STATUS GROUP
# ============================================================

@router.get("/candidates")
def get_candidates_by_status(
    status_group: Optional[str] = None,
    status: Optional[str] = None,
    job_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get candidates filtered by status group or specific status
    Status groups: recruiter_new, recruiter_called, am_inbox, etc.
    """
    ensure_job_application_interview_ready_columns()
    query = db.query(models.Candidate)
    status_as_text = func.lower(cast(models.Candidate.status, String))
    current_user_id = str(current_user.get("id") or "").strip()
    current_role = normalize_status_value(current_user.get("role"))
    requested_job_id = resolve_job_reference(db, job_id) if job_id else None
    visible_app_rows: List[models.JobApplication] = []
    
    # Filter by status group
    if status_group and status_group in STATUS_GROUPS:
        statuses = [s.lower() for s in STATUS_GROUPS[status_group]]
        query = query.filter(status_as_text.in_(statuses))
    elif status:
        query = query.filter(status_as_text == status.lower())
    
    # Order by newest first (prefer updated_at, fallback to created_at)
    if hasattr(models.Candidate, "updated_at"):
        query = query.order_by(
            func.coalesce(models.Candidate.updated_at, models.Candidate.created_at).desc()
        )
    else:
        query = query.order_by(models.Candidate.created_at.desc())
    
    if current_role == "recruiter":
        assigned_job_ids = [
            row[0]
            for row in db.query(models.job_recruiters.c.job_id).filter(
                models.job_recruiters.c.recruiter_id == current_user_id
            ).all()
            if row and row[0]
        ]

        if requested_job_id:
            if requested_job_id not in assigned_job_ids:
                return {"total": 0, "candidates": []}
            assigned_job_ids = [requested_job_id]

        if not assigned_job_ids:
            return {"total": 0, "candidates": []}

        all_apps = (
            db.query(models.JobApplication)
            .filter(models.JobApplication.job_id.in_(assigned_job_ids))
            .all()
        )
        submission_rows = (
            db.query(models.CandidateSubmission)
            .filter(models.CandidateSubmission.job_id.in_(assigned_job_ids))
            .all()
        )
        submission_lookup = {
            (s.job_id, s.candidate_id): s
            for s in submission_rows
            if s and s.job_id and s.candidate_id
        }

        def _is_app_visible_to_current_recruiter(app: models.JobApplication) -> bool:
            owner_id = str(app.recruiter_id or "").strip()
            submission = submission_lookup.get((app.job_id, app.candidate_id))
            if (
                not owner_id
                and submission
                and submission.is_locked
                and normalize_status_value(submission.status) not in LOCK_RELEASE_STATUSES
            ):
                owner_id = str(submission.recruiter_id or "").strip()
            return not owner_id or owner_id == current_user_id

        visible_app_rows = [app for app in all_apps if _is_app_visible_to_current_recruiter(app)]
        visible_candidate_ids = list({app.candidate_id for app in visible_app_rows if app.candidate_id})
        if not visible_candidate_ids:
            return {"total": 0, "candidates": []}
        query = query.filter(models.Candidate.id.in_(visible_candidate_ids))

    total = query.count()
    candidates = query.offset(skip).limit(limit).all()

    candidate_ids = [c.id for c in candidates if c.id]
    apps_by_candidate: Dict[str, List[models.JobApplication]] = {}
    job_lookup: Dict[str, Dict[str, Any]] = {}
    recruiter_lookup: Dict[str, str] = {}

    if candidate_ids:
        if current_role == "recruiter":
            app_rows = [app for app in visible_app_rows if app.candidate_id in candidate_ids]
        else:
            app_rows = (
                db.query(models.JobApplication)
                .filter(models.JobApplication.candidate_id.in_(candidate_ids))
                .all()
            )

        if requested_job_id:
            app_rows = [app for app in app_rows if app.job_id == requested_job_id]

        for app in app_rows:
            apps_by_candidate.setdefault(app.candidate_id, []).append(app)

        job_ids = list({app.job_id for app in app_rows if app.job_id})
        recruiter_ids = list({app.recruiter_id for app in app_rows if app.recruiter_id})

        if job_ids:
            requirement_rows = (
                db.query(models.Requirement.id, models.Requirement.job_id)
                .filter(models.Requirement.job_id.in_(job_ids))
                .order_by(models.Requirement.created_at.desc())
                .all()
            )
            requirement_by_job = {}
            for requirement in requirement_rows:
                if not requirement.job_id:
                    continue
                if requirement.job_id not in requirement_by_job:
                    requirement_by_job[requirement.job_id] = requirement.id

            for row in (
                db.query(
                    models.Job.id,
                    models.Job.title,
                    models.Job.client_id,
                    models.Job.client_name,
                )
                .filter(models.Job.id.in_(job_ids))
                .all()
            ):
                job_lookup[row.id] = {
                    "title": row.title,
                    "client_id": row.client_id,
                    "client_name": row.client_name,
                    "requirement_id": requirement_by_job.get(row.id),
                }

        if recruiter_ids:
            for row in (
                db.query(models.User.id, models.User.full_name)
                .filter(models.User.id.in_(recruiter_ids))
                .all()
            ):
                recruiter_lookup[row.id] = row.full_name or "Recruiter"

    serialized_candidates = []
    for c in candidates:
        candidate_status = c.status.value if hasattr(c.status, "value") else str(c.status)
        primary_app = _pick_primary_application(
            apps_by_candidate.get(c.id, []),
            candidate_status,
        )
        effective_status = (
            primary_app.status
            if primary_app and normalize_status_value(primary_app.status)
            else candidate_status
        )
        job_context = (
            job_lookup.get(primary_app.job_id, {}) if primary_app and primary_app.job_id else {}
        )
        assigned_recruiter_id = primary_app.recruiter_id if primary_app else None
        assigned_recruiter_name = recruiter_lookup.get(assigned_recruiter_id)

        serialized_candidates.append(
            {
                "id": c.id,
                "candidate_id": c.id,
                "application_id": primary_app.id if primary_app else None,
                "public_id": c.public_id,
                "full_name": c.full_name,
                "email": c.email,
                "phone": c.phone,
                "status": effective_status,
                "is_final": is_final_status(normalize_status_value(effective_status)),
                "skills": c.skills or [],
                "experience_years": c.experience_years,
                "current_location": c.current_location,
                "current_employer": c.current_employer,
                "expected_ctc": c.expected_ctc,
                "notice_period": c.notice_period,
                "resume_url": c.resume_url,
                "job_id": primary_app.job_id if primary_app else None,
                "requirement_id": job_context.get("requirement_id"),
                "job_title": job_context.get("title"),
                "requirement_title": job_context.get("title"),
                "client_id": job_context.get("client_id"),
                "client_name": job_context.get("client_name"),
                "assigned_recruiter_id": assigned_recruiter_id,
                "assigned_recruiter_name": assigned_recruiter_name,
                "recruiter_id": assigned_recruiter_id,
                "recruiter_name": assigned_recruiter_name,
                "is_assigned_recruiter": bool(
                    assigned_recruiter_id
                    and current_user_id
                    and str(assigned_recruiter_id) == current_user_id
                ),
                "interview_scheduling_ready": bool(
                    primary_app and primary_app.interview_scheduling_ready
                ),
                "interview_scheduling_ready_at": _as_iso(
                    primary_app.interview_scheduling_ready_at if primary_app else None
                ),
                "interview_scheduling_note": (
                    primary_app.interview_scheduling_note if primary_app else None
                ),
                "created_at": str(c.created_at) if c.created_at else None,
                "updated_at": (
                    str(getattr(c, "updated_at", None))
                    if getattr(c, "updated_at", None)
                    else None
                ),
            }
        )
    
    return {
        "total": total,
        "candidates": serialized_candidates,
    }


@router.get("/candidates/{candidate_id}/timeline")
def get_candidate_timeline(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get full activity timeline for a candidate.

    Accepts candidate id, candidate public id, or job application id.
    """
    requested_id = str(candidate_id or "").strip()
    if not requested_id:
        raise HTTPException(400, "Candidate id is required")

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == requested_id
    ).first()

    # Support lookups by public id (ATS-C-xxxx) for UI compatibility.
    if not candidate:
        candidate = db.query(models.Candidate).filter(
            models.Candidate.public_id == requested_id
        ).first()

    # Support lookups by JobApplication id where UI may pass application id.
    if not candidate:
        app = db.query(models.JobApplication).filter(
            models.JobApplication.id == requested_id
        ).first()
        if app and app.candidate_id:
            candidate = db.query(models.Candidate).filter(
                models.Candidate.id == app.candidate_id
            ).first()

    if not candidate:
        raise HTTPException(404, "Candidate not found")

    resolved_candidate_id = candidate.id

    timeline = db.query(models.CandidateTimeline).filter(
        models.CandidateTimeline.candidate_id == resolved_candidate_id
    ).order_by(models.CandidateTimeline.created_at.desc()).all()
    
    # Build timeline items with user role info
    timeline_items = []
    for t in timeline:
        # Get user info if available
        user = None
        user_name = ""
        user_role = ""
        if t.user_id:
            user = db.query(models.User).filter(models.User.id == t.user_id).first()
            if user:
                user_name = user.full_name or user.email or ""
                # Get role from user
                if user.role:
                    role_str = user.role.value if hasattr(user.role, 'value') else str(user.role)
                    role_str = role_str.lower()
                    if 'account' in role_str or 'am' in role_str:
                        user_role = "Account Manager"
                    elif 'recruiter' in role_str:
                        user_role = "Recruiter"
                    elif 'admin' in role_str:
                        user_role = "Admin"
                    elif 'client' in role_str:
                        user_role = "Client"
                    else:
                        user_role = role_str.replace('_', ' ').title()
        
        timeline_items.append({
            "id": t.id,
            "status": t.status,
            "note": t.note,
            "user_id": t.user_id,
            "by": user_name,
            "role": user_role,
            "at": t.created_at.isoformat() if t.created_at else None,
            "created_at": t.created_at.isoformat() if t.created_at else None
        })
    
    return {
        "candidate_id": resolved_candidate_id,
        "current_status": candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status),
        "is_locked": is_final_status(candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status)),
        "timeline": timeline_items,
        "data": timeline_items  # Also include as 'data' for frontend compatibility
    }


@router.get("/status-counts")
def get_status_counts(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get count of candidates in each status"""
    counts = db.query(
        models.Candidate.status,
        func.count(models.Candidate.id)
    ).group_by(models.Candidate.status).all()
    
    result = {}
    for status, count in counts:
        status_str = status.value if hasattr(status, 'value') else str(status)
        result[status_str] = count
    
    # Also compute group counts
    group_counts = {}
    for group_name, statuses in STATUS_GROUPS.items():
        group_counts[group_name] = sum(result.get(s, 0) for s in statuses)
    
    return {
        "by_status": result,
        "by_group": group_counts
    }

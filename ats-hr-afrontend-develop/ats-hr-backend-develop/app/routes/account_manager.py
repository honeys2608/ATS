from fastapi import APIRouter, Depends, HTTPException, Form, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import inspect, text, or_, and_, func, cast, String, select
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

from app.db import get_db, ensure_requirement_columns
from app import models
from app.auth import get_current_user, verify_password, get_password_hash
from app.permissions import require_permission
import app.schemas as schemas
from app.schemas import AssignRecruiterRequest, DirectHireRequest, SendToClientRequest
from app.routes.jobs import generate_job_id
import secrets
from app.utils.email import send_email
from app.utils.activity import log_activity
from app.models import ConsultantType

router = APIRouter(
    prefix="/v1/am",
    tags=["Account Manager"]
)

dashboard_alias_router = APIRouter(
    prefix="/api/am/dashboard",
    tags=["Account Manager Dashboard"],
)

# ---------------------------------------------------------
# UTIL
# ---------------------------------------------------------
def get_user_id(user: dict):
    return (
        user.get("id")
        or user.get("user_id")
        or user.get("sub")
    )


def _job_scope_clause(am_id: str):
    # Backward compatibility: legacy job rows can have NULL account_manager_id.
    return or_(
        models.Job.account_manager_id == am_id,
        models.Job.account_manager_id.is_(None),
    )


def _requirement_scope_clause(am_id: str):
    # Backward compatibility: legacy requirement rows can have NULL account_manager_id.
    return or_(
        models.Requirement.account_manager_id == am_id,
        models.Requirement.account_manager_id.is_(None),
    )


DASHBOARD_FILTER_VALUES = {"today", "this_week", "this_month"}

ACTIVE_REQUIREMENT_STATUS_VALUES = {
    "active",
    "open",
    "new",
    "approved",
    "converted_to_job",
    "in_progress",
}
REQUIREMENT_CLOSED_STATUS_VALUES = {"closed", "filled", "completed", "cancelled", "canceled", "archived"}
REQUIREMENT_ON_HOLD_STATUS_VALUES = {"on_hold", "hold", "paused"}
REQUIREMENT_DRAFT_STATUS_VALUES = {"draft"}

INTERVIEW_PROGRESS_STATUS_VALUES = {
    "interview_scheduled",
    "interview_done",
    "interview_completed",
    "interview",
}
HIRED_STATUS_VALUES = {"hired"}
ACTIVE_CONSULTANT_STATUS_VALUES = {"active", "deployed"}
PENDING_TIMESHEET_STATUS_VALUES = {"pending", "submitted"}

CANDIDATE_PIPELINE_GROUPS = {
    "AM Review": {"sent_to_am", "am_shortlisted", "am_hold"},
    "Client Review": {"sent_to_client", "client_shortlisted", "client_hold"},
    "Interview Stage": {"interview_scheduled", "interview_done", "interview_completed", "no_show"},
    "Offer Stage": {"selected", "negotiation", "offer_extended", "offer_accepted", "offer_declined"},
    "Successful": {"hired", "joined"},
    "Rejected": {"am_rejected", "client_rejected", "rejected", "rejected_candidate", "rejected_by_recruiter"},
}

CANDIDATE_PIPELINE_STATUS_LABELS = {
    "sent_to_am": "Sent to AM",
    "am_shortlisted": "AM Shortlisted",
    "am_hold": "AM Hold",
    "sent_to_client": "Sent to Client",
    "client_shortlisted": "Client Shortlisted",
    "client_hold": "Client Hold",
    "interview_scheduled": "Interview Scheduled",
    "interview_done": "Interview Done",
    "interview_completed": "Interview Done",
    "no_show": "No Show",
    "selected": "Selected",
    "negotiation": "Negotiation",
    "offer_extended": "Offer Extended",
    "offer_accepted": "Offer Accepted",
    "offer_declined": "Offer Declined",
    "hired": "Hired",
    "joined": "Joined",
    "am_rejected": "AM Rejected",
    "client_rejected": "Client Rejected",
    "rejected": "Rejected",
    "rejected_candidate": "Rejected (Candidate)",
    "rejected_by_recruiter": "AM Rejected",
}

CANDIDATE_PIPELINE_GROUP_COLORS = {
    "AM Review": "#6C2BD9",
    "Client Review": "#3B82F6",
    "Interview Stage": "#F59E0B",
    "Offer Stage": "#8B5CF6",
    "Successful": "#10B981",
    "Rejected": "#EF4444",
}

CANDIDATE_PIPELINE_GROUP_ORDER = [
    "AM Review",
    "Client Review",
    "Interview Stage",
    "Offer Stage",
    "Successful",
    "Rejected",
]

_dashboard_indexes_ready = False


def _normalize_dashboard_filter(value: str) -> str:
    key = str(value or "").strip().lower()
    return key if key in DASHBOARD_FILTER_VALUES else "this_month"


def _normalize_status_value(value: Any) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace(" ", "_")
        .replace("-", "_")
    )


def _status_expression(column):
    return func.replace(
        func.replace(
            func.lower(func.trim(func.coalesce(cast(column, String), ""))),
            " ",
            "_",
        ),
        "-",
        "_",
    )


def _format_period_label(start_dt: datetime, end_dt: datetime) -> str:
    start_txt = start_dt.strftime("%b %d").replace(" 0", " ")
    end_txt = end_dt.strftime("%b %d, %Y").replace(" 0", " ")
    return f"{start_txt} - {end_txt}"


def _resolve_period_windows(filter_key: str, now: datetime = None) -> Tuple[datetime, datetime, datetime, datetime]:
    now = now or datetime.utcnow()
    if filter_key == "today":
        current_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif filter_key == "this_week":
        week_anchor = now.replace(hour=0, minute=0, second=0, microsecond=0)
        current_start = week_anchor - timedelta(days=week_anchor.weekday())
    else:
        current_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    duration = now - current_start
    if duration.total_seconds() <= 0:
        duration = timedelta(seconds=1)

    previous_end = current_start
    previous_start = current_start - duration
    return current_start, now, previous_start, previous_end


def _sparkline_windows(filter_key: str, now: datetime = None) -> List[Tuple[datetime, datetime]]:
    now = now or datetime.utcnow()
    if filter_key == "today":
        step = timedelta(hours=1)
    elif filter_key == "this_week":
        step = timedelta(days=1)
    else:
        step = timedelta(days=7)

    windows: List[Tuple[datetime, datetime]] = []
    for bucket_index in range(7):
        bucket_end = now - step * (6 - bucket_index)
        bucket_start = bucket_end - step
        windows.append((bucket_start, bucket_end))
    return windows


def _compute_change(current_value: int, previous_value: int) -> Tuple[float, str]:
    if previous_value == 0:
        pct = 0.0 if current_value == 0 else 100.0
    else:
        pct = ((current_value - previous_value) / abs(previous_value)) * 100.0

    if current_value > previous_value:
        trend = "up"
    elif current_value < previous_value:
        trend = "down"
    else:
        trend = "flat"
    return round(pct, 1), trend


def _pct(count: int, total: int) -> float:
    if not total:
        return 0.0
    return round((count / total) * 100.0, 1)


def _build_card(value: int, current_period_value: int, previous_period_value: int, sparkline: List[int]) -> Dict[str, Any]:
    change_pct, trend = _compute_change(current_period_value, previous_period_value)
    return {
        "value": int(value or 0),
        "change_pct": change_pct,
        "trend": trend,
        "sparkline": [int(point or 0) for point in sparkline],
    }


def _ensure_dashboard_indexes(db: Session) -> None:
    global _dashboard_indexes_ready
    if _dashboard_indexes_ready:
        return

    try:
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_requirements_status_created_at "
                "ON requirements(status, created_at)"
            )
        )
        db.execute(
            text(
                "CREATE INDEX IF NOT EXISTS idx_candidate_submissions_created_at "
                "ON candidate_submissions(created_at)"
            )
        )

        inspector = inspect(db.bind)
        candidate_columns = set()
        if "candidates" in inspector.get_table_names():
            candidate_columns = {
                col.get("name")
                for col in inspector.get_columns("candidates")
            }

        if "status_updated_at" in candidate_columns:
            db.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_candidates_status_updated_at "
                    "ON candidates(status_updated_at)"
                )
            )
        elif "updated_at" in candidate_columns:
            db.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_candidates_updated_at "
                    "ON candidates(updated_at)"
                )
            )

        db.commit()
        _dashboard_indexes_ready = True
    except Exception:
        db.rollback()

# ---------------------------------------------------------
# CHANGE PASSWORD (ACCOUNT MANAGER)
# ---------------------------------------------------------
@router.post("/change-password")
def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = (
        db.query(models.User)
        .filter(models.User.id == get_user_id(current_user))
        .first()
    )

    if not user:
        raise HTTPException(404, "User not found")

    if not verify_password(current_password, user.password):
        raise HTTPException(400, "Current password incorrect")

    if (
        len(new_password) < 8
        or not any(c.isupper() for c in new_password)
        or not any(c.isdigit() for c in new_password)
        or not any(c in "!@#$%^&*()_+-=" for c in new_password)
    ):
        raise HTTPException(
            400,
            "Password must be 8+ chars, 1 uppercase, 1 number, 1 special char",
        )

    user.password = get_password_hash(new_password)
    db.commit()

    return {"message": "Password changed successfully"}

# ---------------------------------------------------------
# APPROVE REQUIREMENT
# ---------------------------------------------------------
@router.put("/requirements/{req_id}/approve")
def approve_requirement(
    req_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    req = db.query(models.Requirement).filter(
        models.Requirement.id == req_id,
        models.Requirement.account_manager_id == get_user_id(current_user)
    ).first()

    if not req:
        raise HTTPException(404, "Requirement not found or not assigned to you")

    # 🔒 BLOCK RE-APPROVAL
    if req.status != "NEW":
        raise HTTPException(
            status_code=400,
            detail=f"Requirement already processed (current status: {req.status})"
        )

    req.status = "APPROVED"
    req.approved_at = datetime.utcnow()
    req.updated_at = datetime.utcnow()
    log_activity(
        db,
        action="am.requirement_approved",
        resource_type="requirement",
        actor=current_user,
        resource_id=req.id,
        resource_name=req.title,
        client_id=req.client_id,
        note="Requirement approved",
    )

    db.commit()

    return {
        "message": "Requirement approved",
        "status": req.status
    }

# ---------------------------------------------------------
# ACTIVATE REQUIREMENT → CREATE JOB
# ---------------------------------------------------------
@router.post("/requirements/{req_id}/activate")
def activate_requirement(
    req_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    req = db.query(models.Requirement).filter(
        models.Requirement.id == req_id,
        models.Requirement.account_manager_id == get_user_id(current_user)
    ).first()

    if not req:
        raise HTTPException(404, "Requirement not found or not assigned to you")

    # 🔒 MUST BE APPROVED FIRST
    if req.status != "APPROVED":
        raise HTTPException(
            status_code=400,
            detail="Requirement must be approved before activation"
        )

    # 🔒 PREVENT DUPLICATE JOB
    if req.job_id:
        raise HTTPException(
            status_code=400,
            detail="Job already exists for this requirement"
        )

    # ✅ SAFE TO CREATE JOB
    job = models.Job(
        client_id=req.client_id,
        job_id=generate_job_id(db),
        title=req.title,
        skills=req.skills_mandatory if isinstance(req.skills_mandatory, list) else [],
        location=(
            req.location_details.get("city")
            if isinstance(req.location_details, dict)
            else req.location_details
        ) or "Location not specified",
        status="active",
        account_manager_id=req.account_manager_id,  # ⭐⭐⭐ MAIN FIX
        created_at=datetime.utcnow()
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    req.job_id = job.id
    req.status = "CONVERTED_TO_JOB"
    req.activated_at = datetime.utcnow()
    req.updated_at = datetime.utcnow()
    log_activity(
        db,
        action="am.requirement_activated",
        resource_type="job",
        actor=current_user,
        resource_id=job.id,
        resource_name=job.title,
        job_id=job.id,
        client_id=job.client_id,
        metadata={"job_code": job.job_id, "requirement_id": req.id},
    )

    db.commit()

    return {
        "message": "Requirement converted to Job successfully",
        "job_uuid": job.id,
        "job_code": job.job_id,
        "job_title": job.title,
        "status": job.status
    }

# ---------------------------------------------------------
# ASSIGN RECRUITER
# ---------------------------------------------------------
@router.post("/assign-recruiter")
def assign_recruiter(
    payload: AssignRecruiterRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    job = db.query(models.Job).filter(
        models.Job.id == payload.job_id
    ).first()

    recruiter = db.query(models.User).filter(
        models.User.id == payload.recruiter_id
    ).first()

    if not job:
        raise HTTPException(404, "Job not found")

    if not recruiter:
        raise HTTPException(404, "Recruiter not found")

    db.execute(
        models.job_recruiters.insert().values(
            job_id=job.id,
            recruiter_id=recruiter.id,
            assigned_at=datetime.utcnow()
        )
    )
    log_activity(
        db,
        action="am.recruiter_assigned",
        resource_type="job",
        actor=current_user,
        resource_id=job.id,
        resource_name=job.title,
        job_id=job.id,
        client_id=job.client_id,
        recruiter_id=recruiter.id,
        metadata={"recruiter_name": recruiter.full_name},
    )

    db.commit()

    return {"message": "Recruiter assigned successfully"}

# ---------------------------------------------------------
# VIEW RECRUITER SUBMISSIONS
# ---------------------------------------------------------
@router.get("/recruiter-submissions")
def recruiter_submissions(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == job_id
    ).first()

    if requirement and requirement.job_id:
        job_id = requirement.job_id

    recruiter_rows = (
        db.query(
            models.User.id.label("recruiter_id"),
            models.User.full_name.label("recruiter_name"),
            models.job_recruiters.c.assigned_at
        )
        .join(
            models.job_recruiters,
            models.job_recruiters.c.recruiter_id == models.User.id
        )
        .filter(models.job_recruiters.c.job_id == job_id)
        .all()
    )

    recruiter_map = {
        r.recruiter_id: {
            "name": r.recruiter_name,
            "assigned_at": r.assigned_at
        }
        for r in recruiter_rows
    }

    applications = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.job_id == job_id)
        .all()
    )

    result = []

    if not applications:
        for info in recruiter_map.values():
            result.append({
                "application_id": None,
                "recruiter_name": info["name"],
                "recruiter_assigned_at": info["assigned_at"],
                "candidate_name": None,
                "email": None,
                "status": "NO_SUBMISSION",
                "submitted_at": None,
                "sent_to_client_at": None
            })
        return {"job_id": job_id, "submissions": result}

    for app in applications:
        recruiter_info = recruiter_map.get(app.recruiter_id)
        candidate = app.candidate
        candidate_name = (
            candidate.full_name if candidate and candidate.full_name else app.full_name
        )
        candidate_email = candidate.email if candidate and candidate.email else app.email

        result.append({
            "application_id": app.id,
            "candidate_name": candidate_name,
            "email": candidate_email,
            "status": app.status,
            "recruiter_name": recruiter_info["name"] if recruiter_info else "—",
            "recruiter_assigned_at": recruiter_info["assigned_at"] if recruiter_info else None,
            "submitted_at": app.applied_at,
            "sent_to_client_at": app.sent_to_client_at
        })

    return {"job_id": job_id, "submissions": result}

# ---------------------------------------------------------
# SEND CANDIDATES TO CLIENT
# ---------------------------------------------------------
@router.post("/send-to-client")
@require_permission("candidates", "update")
def send_to_client(
    payload: SendToClientRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    job = db.query(models.Job).filter(
        models.Job.id == payload.job_id
    ).first()

    if not job:
        raise HTTPException(404, "Job not found")

    applications = db.query(models.JobApplication).filter(
        models.JobApplication.id.in_(payload.application_ids)
    ).all()

    if not applications:
        raise HTTPException(400, "No valid applications found")

    for app in applications:
        old_status = app.status
        app.status = "sent_to_client"
        app.sent_to_client_at = datetime.utcnow()
        log_activity(
            db,
            action="am.sent_to_client",
            resource_type="submission",
            actor=current_user,
            resource_id=app.id,
            resource_name=(app.candidate.full_name if app.candidate else app.full_name),
            target_user_id=app.candidate_id,
            job_id=app.job_id,
            client_id=job.client_id,
            recruiter_id=app.recruiter_id,
            old_status=old_status,
            new_status="sent_to_client",
            metadata={"job_title": job.title, "client_name": job.client_name},
            is_visible_to_candidate=True,
        )

    db.commit()

    return {
        "message": "Profiles successfully sent to client",
        "job_id": payload.job_id,
        "total_sent": len(applications)
    }

# ---------------------------------------------------------
# VIEW CLIENT FEEDBACK
# ---------------------------------------------------------
@router.get("/client-feedback")
@require_permission("candidates", "view")
def client_feedback(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    apps = db.query(models.JobApplication).filter(
        models.JobApplication.job_id == job_id
    ).all()

    return {
        "job_id": job_id,
        "feedback": [
            {
                "application_id": a.id,
                "candidate": a.full_name,
                "status": a.status,
                "client_feedback": getattr(a, "client_feedback", None),
                "decision": getattr(a, "client_decision", None),
            }
            for a in apps
        ]
    }

# ---------------------------------------------------------
# LIST RECRUITERS
# ---------------------------------------------------------
@router.get("/recruiters")
def list_recruiters(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    users = db.query(models.User).filter(
        models.User.role == "recruiter"
    ).all()

    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email
        }
        for u in users
    ]

# ---------------------------------------------------------
# DASHBOARD STATS
# ---------------------------------------------------------
@router.get("/dashboard-stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    am_id = get_user_id(current_user)

    # 📌 Get all requirements assigned to this Account Manager
    req_ids = db.query(models.Requirement.id).filter(
        _requirement_scope_clause(am_id)
    ).subquery()

    # 📌 Get all jobs for these requirements
    job_ids = db.query(models.Job.id).filter(
        _job_scope_clause(am_id)
    ).subquery()

    # 📌 Count unique clients for this Account Manager
    clients = db.query(
        models.Requirement.client_id
    ).filter(
        _requirement_scope_clause(am_id)
    ).distinct().count()

    # 📌 Count active requirements
    active_requirements = db.query(models.Requirement.id).filter(
        _requirement_scope_clause(am_id),
        models.Requirement.status.in_(["new", "approved", "converted_to_job"])
    ).count()

    # 📌 Count recruiter submissions
    recruiter_submissions = db.query(models.JobApplication).filter(
        models.JobApplication.job_id.in_(job_ids),
        models.JobApplication.status == "applied"
    ).count()

    # 📌 Count sent to client
    sent_to_client = db.query(models.JobApplication).filter(
        models.JobApplication.job_id.in_(job_ids),
        models.JobApplication.status == "sent_to_client"
    ).count()

    # 📌 Count feedback pending
    feedback_pending = db.query(models.JobApplication).filter(
        models.JobApplication.job_id.in_(job_ids),
        models.JobApplication.status == "sent_to_client",
        models.JobApplication.client_decision == None
    ).count()

    # 📌 Count hired candidates
    hired_candidates = db.query(models.JobApplication).filter(
        models.JobApplication.job_id.in_(job_ids),
        models.JobApplication.status == "hired"
    ).count()

    # 📌 Count active consultants
    active_consultants = db.query(models.Consultant).filter(
        models.Consultant.status == "deployed"
    ).count()

    # 📌 Count pending timesheets
    pending_timesheets = db.query(models.Timesheet).filter(
        models.Timesheet.status == "submitted"
    ).count()

    interviews_in_progress = (
        db.query(models.Interview)
        .join(
            models.CandidateSubmission,
            models.CandidateSubmission.id == models.Interview.submission_id,
        )
        .filter(models.CandidateSubmission.job_id.in_(job_ids))
        .filter(models.Interview.status.in_(["scheduled", "in_progress"]))
        .count()
    )

    return {
        "clients": clients,
        "active_requirements": active_requirements,
        "recruiter_submissions": recruiter_submissions,
        "sent_to_client": sent_to_client,
        "interviews_in_progress": interviews_in_progress,
        "feedback_pending": feedback_pending,
        "hired_candidates": hired_candidates,
        "active_consultants": active_consultants,
        "pending_timesheets": pending_timesheets
    }


@router.get("/dashboard/kpi-cards")
def dashboard_kpi_cards(
    filter: str = Query("this_month"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    filter_key = _normalize_dashboard_filter(filter)
    _ensure_dashboard_indexes(db)

    am_id = get_user_id(current_user)
    current_start, current_end, previous_start, previous_end = _resolve_period_windows(filter_key)
    period_label = _format_period_label(current_start, current_end)

    job_ids_subquery = (
        db.query(models.Job.id)
        .filter(_job_scope_clause(am_id))
        .subquery()
    )
    job_ids_select = select(job_ids_subquery.c.id)
    candidate_ids_subquery = (
        db.query(models.JobApplication.candidate_id)
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(_job_scope_clause(am_id))
        .distinct()
        .subquery()
    )
    candidate_ids_select = select(candidate_ids_subquery.c.candidate_id)

    requirement_status_expr = _status_expression(models.Requirement.status)
    application_status_expr = _status_expression(models.JobApplication.status)
    candidate_status_expr = _status_expression(models.Candidate.status)
    consultant_status_expr = _status_expression(models.Consultant.status)
    timesheet_status_expr = _status_expression(models.Timesheet.status)

    candidate_status_ts = func.coalesce(models.Candidate.updated_at, models.Candidate.created_at)
    hired_ts = func.coalesce(
        models.JobApplication.decision_at,
        models.JobApplication.sent_to_client_at,
        models.JobApplication.shortlisted_at,
        models.JobApplication.applied_at,
    )

    def _count_clients_created(range_start: datetime, range_end: datetime) -> int:
        return int(
            db.query(func.count(models.Client.id))
            .filter(models.Client.created_at >= range_start)
            .filter(models.Client.created_at <= range_end)
            .scalar()
            or 0
        )

    def _count_total_clients() -> int:
        return int(db.query(func.count(models.Client.id)).scalar() or 0)

    def _count_total_clients_upto(end_at: datetime) -> int:
        return int(
            db.query(func.count(models.Client.id))
            .filter(models.Client.created_at <= end_at)
            .scalar()
            or 0
        )

    def _count_active_requirements(range_start: datetime = None, range_end: datetime = None) -> int:
        query = (
            db.query(func.count(models.Requirement.id))
            .filter(_requirement_scope_clause(am_id))
            .filter(requirement_status_expr.in_(ACTIVE_REQUIREMENT_STATUS_VALUES))
        )
        if range_start is not None and range_end is not None:
            query = query.filter(models.Requirement.created_at >= range_start).filter(
                models.Requirement.created_at <= range_end
            )
        return int(query.scalar() or 0)

    def _count_active_requirements_upto(end_at: datetime) -> int:
        return int(
            db.query(func.count(models.Requirement.id))
            .filter(_requirement_scope_clause(am_id))
            .filter(requirement_status_expr.in_(ACTIVE_REQUIREMENT_STATUS_VALUES))
            .filter(models.Requirement.created_at <= end_at)
            .scalar()
            or 0
        )

    def _count_recruiter_submissions(range_start: datetime, range_end: datetime) -> int:
        return int(
            db.query(func.count(models.CandidateSubmission.id))
            .filter(models.CandidateSubmission.job_id.in_(job_ids_select))
            .filter(models.CandidateSubmission.created_at >= range_start)
            .filter(models.CandidateSubmission.created_at <= range_end)
            .scalar()
            or 0
        )

    def _count_interviews_in_progress(range_start: datetime = None, range_end: datetime = None) -> int:
        query = (
            db.query(func.count(models.Candidate.id))
            .filter(models.Candidate.id.in_(candidate_ids_select))
            .filter(candidate_status_expr.in_(INTERVIEW_PROGRESS_STATUS_VALUES))
        )
        if range_start is not None and range_end is not None:
            query = query.filter(candidate_status_ts >= range_start).filter(candidate_status_ts <= range_end)
        return int(query.scalar() or 0)

    def _count_hired_candidates(range_start: datetime, range_end: datetime) -> int:
        return int(
            db.query(func.count(models.JobApplication.id))
            .filter(models.JobApplication.job_id.in_(job_ids_select))
            .filter(application_status_expr.in_(HIRED_STATUS_VALUES))
            .filter(hired_ts >= range_start)
            .filter(hired_ts <= range_end)
            .scalar()
            or 0
        )

    def _count_active_consultants(range_start: datetime = None, range_end: datetime = None) -> int:
        query = (
            db.query(func.count(models.Consultant.id))
            .filter(consultant_status_expr.in_(ACTIVE_CONSULTANT_STATUS_VALUES))
        )
        if range_start is not None and range_end is not None:
            query = query.filter(models.Consultant.created_at >= range_start).filter(
                models.Consultant.created_at <= range_end
            )
        return int(query.scalar() or 0)

    def _count_active_consultants_upto(end_at: datetime) -> int:
        return int(
            db.query(func.count(models.Consultant.id))
            .filter(consultant_status_expr.in_(ACTIVE_CONSULTANT_STATUS_VALUES))
            .filter(models.Consultant.created_at <= end_at)
            .scalar()
            or 0
        )

    def _count_pending_timesheets(range_start: datetime = None, range_end: datetime = None) -> int:
        query = (
            db.query(func.count(models.Timesheet.id))
            .filter(timesheet_status_expr.in_(PENDING_TIMESHEET_STATUS_VALUES))
        )
        if range_start is not None and range_end is not None:
            query = query.filter(models.Timesheet.created_at >= range_start).filter(
                models.Timesheet.created_at <= range_end
            )
        return int(query.scalar() or 0)

    def _count_pending_timesheets_upto(end_at: datetime) -> int:
        return int(
            db.query(func.count(models.Timesheet.id))
            .filter(timesheet_status_expr.in_(PENDING_TIMESHEET_STATUS_VALUES))
            .filter(models.Timesheet.created_at <= end_at)
            .scalar()
            or 0
        )

    spark_windows = _sparkline_windows(filter_key, current_end)

    total_clients_value = _count_total_clients()
    total_clients_period = _count_clients_created(current_start, current_end)
    total_clients_previous = _count_clients_created(previous_start, previous_end)
    total_clients_sparkline = [_count_total_clients_upto(end_at) for _, end_at in spark_windows]

    active_requirements_value = _count_active_requirements()
    active_requirements_period = _count_active_requirements(current_start, current_end)
    active_requirements_previous = _count_active_requirements(previous_start, previous_end)
    active_requirements_sparkline = [_count_active_requirements_upto(end_at) for _, end_at in spark_windows]

    recruiter_submissions_value = _count_recruiter_submissions(current_start, current_end)
    recruiter_submissions_previous = _count_recruiter_submissions(previous_start, previous_end)
    recruiter_submissions_sparkline = [
        _count_recruiter_submissions(start_at, end_at) for start_at, end_at in spark_windows
    ]

    interviews_value = _count_interviews_in_progress()
    interviews_period = _count_interviews_in_progress(current_start, current_end)
    interviews_previous = _count_interviews_in_progress(previous_start, previous_end)
    interviews_sparkline = [
        _count_interviews_in_progress(start_at, end_at) for start_at, end_at in spark_windows
    ]

    hired_value = _count_hired_candidates(current_start, current_end)
    hired_previous = _count_hired_candidates(previous_start, previous_end)
    hired_sparkline = [_count_hired_candidates(start_at, end_at) for start_at, end_at in spark_windows]

    active_consultants_value = _count_active_consultants()
    active_consultants_period = _count_active_consultants(current_start, current_end)
    active_consultants_previous = _count_active_consultants(previous_start, previous_end)
    active_consultants_sparkline = [
        _count_active_consultants_upto(end_at) for _, end_at in spark_windows
    ]

    pending_timesheets_value = _count_pending_timesheets()
    pending_timesheets_period = _count_pending_timesheets(current_start, current_end)
    pending_timesheets_previous = _count_pending_timesheets(previous_start, previous_end)
    pending_timesheets_sparkline = [
        _count_pending_timesheets_upto(end_at) for _, end_at in spark_windows
    ]

    return {
        "filter_applied": filter_key,
        "period_label": period_label,
        "cards": {
            "total_clients": _build_card(
                total_clients_value,
                total_clients_period,
                total_clients_previous,
                total_clients_sparkline,
            ),
            "active_requirements": _build_card(
                active_requirements_value,
                active_requirements_period,
                active_requirements_previous,
                active_requirements_sparkline,
            ),
            "recruiter_submissions": _build_card(
                recruiter_submissions_value,
                recruiter_submissions_value,
                recruiter_submissions_previous,
                recruiter_submissions_sparkline,
            ),
            "interviews_in_progress": _build_card(
                interviews_value,
                interviews_period,
                interviews_previous,
                interviews_sparkline,
            ),
            "hired_candidates": _build_card(
                hired_value,
                hired_value,
                hired_previous,
                hired_sparkline,
            ),
            "active_consultants": _build_card(
                active_consultants_value,
                active_consultants_period,
                active_consultants_previous,
                active_consultants_sparkline,
            ),
            "pending_timesheets": _build_card(
                pending_timesheets_value,
                pending_timesheets_period,
                pending_timesheets_previous,
                pending_timesheets_sparkline,
            ),
        },
    }


@router.get("/dashboard/requirements-donut")
def dashboard_requirements_donut(
    filter: str = Query("this_month"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    filter_key = _normalize_dashboard_filter(filter)
    _ensure_dashboard_indexes(db)

    am_id = get_user_id(current_user)
    current_start, current_end, _, _ = _resolve_period_windows(filter_key)
    req_status_expr = _status_expression(models.Requirement.status)

    rows = (
        db.query(req_status_expr.label("status"), func.count(models.Requirement.id).label("count"))
        .filter(_requirement_scope_clause(am_id))
        .filter(models.Requirement.created_at >= current_start)
        .filter(models.Requirement.created_at <= current_end)
        .group_by(req_status_expr)
        .all()
    )

    segment_counts = {
        "Active": 0,
        "Closed": 0,
        "On Hold": 0,
        "Draft": 0,
    }

    for row in rows:
        status_key = _normalize_status_value(row.status)
        count = int(row.count or 0)
        if status_key in REQUIREMENT_CLOSED_STATUS_VALUES:
            segment_counts["Closed"] += count
        elif status_key in REQUIREMENT_ON_HOLD_STATUS_VALUES:
            segment_counts["On Hold"] += count
        elif status_key in REQUIREMENT_DRAFT_STATUS_VALUES:
            segment_counts["Draft"] += count
        else:
            segment_counts["Active"] += count

    total = sum(segment_counts.values())
    all_time_total = int(
        db.query(func.count(models.Requirement.id))
        .filter(_requirement_scope_clause(am_id))
        .scalar()
        or 0
    )

    return {
        "filter_applied": filter_key,
        "period_label": _format_period_label(current_start, current_end),
        "segments": [
            {"status": "Active", "count": segment_counts["Active"], "pct": _pct(segment_counts["Active"], total)},
            {"status": "Closed", "count": segment_counts["Closed"], "pct": _pct(segment_counts["Closed"], total)},
            {"status": "On Hold", "count": segment_counts["On Hold"], "pct": _pct(segment_counts["On Hold"], total)},
            {"status": "Draft", "count": segment_counts["Draft"], "pct": _pct(segment_counts["Draft"], total)},
        ],
        "total": total,
        "all_time_total": all_time_total,
    }


@router.get("/dashboard/pipeline-pie")
def dashboard_pipeline_pie(
    filter: str = Query("this_month"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    filter_key = _normalize_dashboard_filter(filter)
    _ensure_dashboard_indexes(db)

    am_id = get_user_id(current_user)
    current_start, current_end, _, _ = _resolve_period_windows(filter_key)

    app_ts = func.coalesce(
        models.JobApplication.decision_at,
        models.JobApplication.sent_to_client_at,
        models.JobApplication.shortlisted_at,
        models.JobApplication.applied_at,
    )
    app_status_expr = _status_expression(models.JobApplication.status)
    app_rows = (
        db.query(
            models.JobApplication.candidate_id.label("candidate_id"),
            models.Candidate.full_name.label("full_name"),
            app_status_expr.label("status"),
            models.Job.title.label("job_title"),
            app_ts.label("activity_at"),
        )
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .outerjoin(models.Candidate, models.Candidate.id == models.JobApplication.candidate_id)
        .filter(_job_scope_clause(am_id))
        .filter(app_ts >= current_start)
        .filter(app_ts <= current_end)
        .all()
    )

    latest_app_by_candidate: Dict[str, Dict[str, Any]] = {}
    for row in app_rows:
        candidate_id = str(row.candidate_id or "")
        if not candidate_id:
            continue
        timestamp = row.activity_at or datetime.min
        existing = latest_app_by_candidate.get(candidate_id)
        if not existing or timestamp >= existing.get("timestamp", datetime.min):
            latest_app_by_candidate[candidate_id] = {
                "status": _normalize_status_value(row.status),
                "full_name": row.full_name,
                "job_title": row.job_title,
                "timestamp": timestamp,
            }

    group_data: Dict[str, Dict[str, Any]] = {
        group_name: {
            "count": 0,
            "breakdown": {},
            "candidates": [],
        }
        for group_name in CANDIDATE_PIPELINE_GROUP_ORDER
    }

    status_to_group = {}
    for group_name, statuses in CANDIDATE_PIPELINE_GROUPS.items():
        for status in statuses:
            status_to_group[status] = group_name

    for candidate_id, latest in latest_app_by_candidate.items():
        status_key = _normalize_status_value(latest.get("status"))
        group_name = status_to_group.get(status_key)
        if not group_name:
            continue

        display_name = latest.get("full_name") or "Unnamed Candidate"
        exact_status_label = CANDIDATE_PIPELINE_STATUS_LABELS.get(status_key, status_key.replace("_", " ").title())
        job_title = latest.get("job_title") or "Not specified"

        group_data[group_name]["count"] += 1
        group_data[group_name]["breakdown"][status_key] = (
            group_data[group_name]["breakdown"].get(status_key, 0) + 1
        )
        group_data[group_name]["candidates"].append(
            {
                "candidate_id": candidate_id,
                "name": display_name,
                "status": status_key,
                "status_label": exact_status_label,
                "job_applied_for": job_title,
            }
        )

    total_candidates = sum(group_data[group]["count"] for group in CANDIDATE_PIPELINE_GROUP_ORDER)
    groups_payload = []
    for group_name in CANDIDATE_PIPELINE_GROUP_ORDER:
        entry = group_data[group_name]
        breakdown = entry["breakdown"]
        sorted_breakdown = dict(
            sorted(
                breakdown.items(),
                key=lambda item: item[1],
                reverse=True,
            )
        )
        groups_payload.append(
            {
                "group": group_name,
                "count": entry["count"],
                "pct": _pct(entry["count"], total_candidates),
                "color": CANDIDATE_PIPELINE_GROUP_COLORS[group_name],
                "breakdown": sorted_breakdown,
                "candidates": entry["candidates"][:200],
            }
        )

    return {
        "filter_applied": filter_key,
        "period_label": _format_period_label(current_start, current_end),
        "total_candidates": total_candidates,
        "groups": groups_payload,
    }


@router.get("/dashboard/panels-summary")
def dashboard_panels_summary(
    filter: str = Query("this_month"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    filter_key = _normalize_dashboard_filter(filter)
    _ensure_dashboard_indexes(db)

    am_id = get_user_id(current_user)
    current_start, current_end, _, _ = _resolve_period_windows(filter_key)

    requirement_status_expr = _status_expression(models.Requirement.status)
    application_status_expr = _status_expression(models.JobApplication.status)
    consultant_status_expr = _status_expression(models.Consultant.status)
    app_ts = func.coalesce(
        models.JobApplication.decision_at,
        models.JobApplication.sent_to_client_at,
        models.JobApplication.shortlisted_at,
        models.JobApplication.applied_at,
    )

    active_requirement_rows = (
        db.query(models.Requirement.id, models.Requirement.job_id)
        .filter(_requirement_scope_clause(am_id))
        .filter(requirement_status_expr.in_(ACTIVE_REQUIREMENT_STATUS_VALUES))
        .filter(models.Requirement.created_at >= current_start)
        .filter(models.Requirement.created_at <= current_end)
        .all()
    )

    active_requirement_ids = [str(row.id) for row in active_requirement_rows if row.id]
    active_job_to_requirement = {
        str(row.job_id): str(row.id)
        for row in active_requirement_rows
        if row.job_id and row.id
    }
    active_job_ids = list(active_job_to_requirement.keys())

    with_submission_ids = set()
    submission_filters = []
    if active_requirement_ids:
        submission_filters.append(models.CandidateSubmission.requirement_id.in_(active_requirement_ids))
    if active_job_ids:
        submission_filters.append(models.CandidateSubmission.job_id.in_(active_job_ids))

    if submission_filters:
        submission_rows = (
            db.query(models.CandidateSubmission.requirement_id, models.CandidateSubmission.job_id)
            .filter(or_(*submission_filters))
            .all()
        )
        for row in submission_rows:
            req_id = str(row.requirement_id or "")
            if req_id and req_id in active_requirement_ids:
                with_submission_ids.add(req_id)
                continue
            mapped_req = active_job_to_requirement.get(str(row.job_id or ""))
            if mapped_req:
                with_submission_ids.add(mapped_req)

    am_shortlisted_count = int(
        db.query(func.count(models.JobApplication.id))
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(_job_scope_clause(am_id))
        .filter(app_ts >= current_start)
        .filter(app_ts <= current_end)
        .filter(application_status_expr.in_(["am_shortlisted"]))
        .scalar()
        or 0
    )
    client_shortlisted_count = int(
        db.query(func.count(models.JobApplication.id))
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(_job_scope_clause(am_id))
        .filter(app_ts >= current_start)
        .filter(app_ts <= current_end)
        .filter(application_status_expr.in_(["client_shortlisted"]))
        .scalar()
        or 0
    )

    available_consultants = int(
        db.query(func.count(models.Consultant.id))
        .filter(consultant_status_expr.in_(["available"]))
        .filter(models.Consultant.created_at >= current_start)
        .filter(models.Consultant.created_at <= current_end)
        .scalar()
        or 0
    )
    on_bench_consultants = int(
        db.query(func.count(models.Consultant.id))
        .filter(consultant_status_expr.in_(["on_bench", "bench"]))
        .filter(models.Consultant.created_at >= current_start)
        .filter(models.Consultant.created_at <= current_end)
        .scalar()
        or 0
    )
    active_consultants = int(
        db.query(func.count(models.Consultant.id))
        .filter(consultant_status_expr.in_(ACTIVE_CONSULTANT_STATUS_VALUES))
        .filter(models.Consultant.created_at >= current_start)
        .filter(models.Consultant.created_at <= current_end)
        .scalar()
        or 0
    )

    return {
        "filter_applied": filter_key,
        "period_label": _format_period_label(current_start, current_end),
        "active_requirements": {
            "total": len(active_requirement_ids),
            "with_submissions": len(with_submission_ids),
        },
        "pipeline_ready": {
            "total": am_shortlisted_count + client_shortlisted_count,
            "am_shortlisted": am_shortlisted_count,
            "client_shortlisted": client_shortlisted_count,
        },
        "consultant_pool": {
            "available": available_consultants,
            "on_bench": on_bench_consultants,
            "active": active_consultants,
        },
    }


@dashboard_alias_router.get("/kpi-cards")
def dashboard_kpi_cards_alias(
    filter: str = Query("this_month"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return dashboard_kpi_cards(filter=filter, db=db, current_user=current_user)


@dashboard_alias_router.get("/requirements-donut")
def dashboard_requirements_donut_alias(
    filter: str = Query("this_month"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return dashboard_requirements_donut(filter=filter, db=db, current_user=current_user)


@dashboard_alias_router.get("/pipeline-pie")
def dashboard_pipeline_pie_alias(
    filter: str = Query("this_month"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return dashboard_pipeline_pie(filter=filter, db=db, current_user=current_user)


@dashboard_alias_router.get("/panels-summary")
def dashboard_panels_summary_alias(
    filter: str = Query("this_month"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return dashboard_panels_summary(filter=filter, db=db, current_user=current_user)

# ---------------------------------------------------------
# GET ALL REQUIREMENTS (AM VIEW)
# ---------------------------------------------------------
@router.get("/requirements")
def get_all_requirements(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Keep this endpoint resilient on partially-migrated databases.
    ensure_requirement_columns()

    am_id = get_user_id(current_user)
    inspector = inspect(db.bind)
    available = {c["name"] for c in inspector.get_columns("requirements")}

    def _pick(primary: str, fallback: str = None):
        if primary in available:
            return primary
        if fallback and fallback in available:
            return fallback
        return None

    selected = {
        "id": _pick("id"),
        "requirement_code": _pick("requirement_code"),
        "title": _pick("title"),
        "status": _pick("status"),
        "client_id": _pick("client_id"),
        "client_name": _pick("client_name"),
        "job_id": _pick("job_id"),
        "created_at": _pick("created_at"),
        "approved_at": _pick("approved_at"),
        "activated_at": _pick("activated_at"),
        "skills_mandatory": _pick("skills_mandatory", "skills"),
        "skills_legacy": _pick("skills"),
        "location_details": _pick("location_details", "location"),
        "location_legacy": _pick("location"),
        "ctc_min": _pick("ctc_min"),
        "ctc_max": _pick("ctc_max"),
        "budget_legacy": _pick("budget"),
    }

    select_parts = [
        f"{column} AS {alias}"
        for alias, column in selected.items()
        if column
    ]

    if not select_parts:
        return {"requirements": []}

    order_by = "created_at DESC"
    if "created_at" not in available:
        order_by = "updated_at DESC" if "updated_at" in available else "id DESC"

    rows = db.execute(
        text(
            f"""
            SELECT {", ".join(select_parts)}
            FROM requirements
            WHERE account_manager_id = :am_id
            ORDER BY {order_by}
            """
        ),
        {"am_id": am_id},
    ).mappings().all()

    def _to_skills(row):
        skills = row.get("skills_mandatory")
        if isinstance(skills, list):
            return skills
        if isinstance(skills, str):
            return [s.strip() for s in skills.split(",") if s.strip()]
        legacy = row.get("skills_legacy")
        if isinstance(legacy, list):
            return legacy
        if isinstance(legacy, str):
            return [s.strip() for s in legacy.split(",") if s.strip()]
        return []

    def _to_location(row):
        details = row.get("location_details")
        if isinstance(details, dict):
            return details.get("city") or details.get("location") or details.get("state")
        if details:
            return details
        return row.get("location_legacy")

    def _to_budget(row):
        ctc_min = row.get("ctc_min")
        ctc_max = row.get("ctc_max")
        if ctc_min is not None and ctc_max is not None:
            return f"{ctc_min} - {ctc_max}"
        if ctc_min is not None:
            return str(ctc_min)
        if ctc_max is not None:
            return str(ctc_max)
        legacy = row.get("budget_legacy")
        if legacy is None:
            return None
        return str(legacy)

    return {
        "requirements": [
            {
                "requirement_code": row.get("requirement_code"),
                "id": row.get("id"),
                "title": row.get("title"),
                "skills": _to_skills(row),
                "location": _to_location(row),
                "budget": _to_budget(row),
                "status": row.get("status"),
                "client_id": row.get("client_id"),
                "client_name": row.get("client_name"),
                "job_id": row.get("job_id"),
                "created_at": row.get("created_at"),
                "approved_at": row.get("approved_at"),
                "activated_at": row.get("activated_at"),
            }
            for row in rows
        ]
    }
# ---------------------------------------------------------
# CONSULTANTS READY FOR ASSIGNMENT (AM VIEW)
@router.get("/ready-for-assignment")
def ready_for_assignment(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = []

    # =====================================================
    # 1️⃣ ALREADY CONSULTANTS (Admin / Converted)
    # =====================================================
    consultants = (
        db.query(models.Consultant)
        .outerjoin(models.Candidate, models.Candidate.id == models.Consultant.candidate_id)
        .filter(models.Consultant.status == "available")
        .order_by(models.Consultant.created_at.desc())
        .all()
    )

    for c in consultants:
        result.append({
            "consultant_id": c.id,
            "consultant_name": c.candidate.full_name if c.candidate else None,
            "candidate_name": c.candidate.full_name if c.candidate else None,
            "email": c.candidate.email if c.candidate else None,
            "client_id": c.client_id,
            "type": c.type.value if hasattr(c.type, "value") else c.type,
            "status": c.status,
            "created_at": c.created_at,
        })

    # =====================================================
    # 2️⃣ CLIENT CANDIDATES (HIRED, NOT YET CONSULTANT)
    # =====================================================
    hired_apps = (
        db.query(models.JobApplication)
        .filter(
            models.JobApplication.status == "HIRED",
            models.JobApplication.ready_for_assignment == True,
            models.JobApplication.candidate_id.notin_(
                db.query(models.Consultant.candidate_id)
            )
        )
        .order_by(models.JobApplication.applied_at.desc())
        .all()
    )

    for app in hired_apps:
        client_name = None

        if app.job and app.job.client_id:
            client_name = (
                db.query(models.User.full_name)
                .filter(models.User.id == app.job.client_id)
                .scalar()
            )

        job_title = app.job.title if app.job else None

        result.append({
            "application_id": app.id,
            "candidate_name": app.candidate.full_name if app.candidate else None,
            "email": app.candidate.email if app.candidate else None,
            "job_id": app.job_id,
            "job_title": job_title,
            "client_id": app.job.client_id if app.job else None,
            "client_name": client_name,
            "status": "HIRED",
            "sent_to_client_at": app.sent_to_client_at,
            "ready_for_assignment": app.ready_for_assignment,
            "client_decision": app.client_decision,
        })

    return result

@router.post("/assign-consultant")
def assign_consultant(
    payload: schemas.ConsultantDeploymentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    consultant = None
    app = None

    # =====================================================
    # CASE 1️⃣ : ALREADY CONSULTANT → ONLY ASSIGN
    # =====================================================
    if payload.consultantId:
        consultant = db.query(models.Consultant).filter(
            models.Consultant.id == payload.consultantId
        ).first()

        if not consultant:
            raise HTTPException(404, "Consultant not found")

    # =====================================================
    # CASE 2️⃣ : HIRED CANDIDATE → CONVERT + ASSIGN
    # =====================================================
    elif payload.applicationId:
        app = db.query(models.JobApplication).filter(
            models.JobApplication.id == payload.applicationId,
            models.JobApplication.status == "HIRED"
        ).first()

        if not app:
            raise HTTPException(404, "Hired application not found")

        # 🔁 Already converted earlier?
        consultant = db.query(models.Consultant).filter(
            models.Consultant.candidate_id == app.candidate_id
        ).first()

        if not consultant:
            candidate = app.candidate

            if not candidate:
                raise HTTPException(400, "Candidate not found")

            # ---------------------------------------------
            # 🔐 CREATE / FETCH USER
            # ---------------------------------------------
            user = db.query(models.User).filter(
                models.User.email == candidate.email
            ).first()

            temp_password = None

            if not user:
                temp_password = secrets.token_urlsafe(8)
                hashed_password = get_password_hash(temp_password)
                 # ✅ VS CODE CONSOLE LOG
                print("\n==============================")
                print("✅ NEW CONSULTANT USER CREATED")
                print("Email:", candidate.email)
                print("Password:", temp_password)
                print("==============================\n")

                user = models.User(
                    username=candidate.email.split("@")[0],
                    email=candidate.email,
                    password=hashed_password,
                    role="consultant",
                    full_name=candidate.full_name,
                    must_change_password=True,
                    linked_candidate_id=candidate.id
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                user.role = "consultant"
                user.must_change_password = True
                db.commit()

            # ---------------------------------------------
            # 👨‍💼 CREATE CONSULTANT
            # ---------------------------------------------
            consultant = models.Consultant(
                candidate_id=candidate.id,
                user_id=user.id,
                client_id=payload.clientId,
                consultant_code=f"CONS-{int(datetime.utcnow().timestamp())}",
                type=(
                    ConsultantType.payroll
                    if payload.billingType == "payroll"
                    else ConsultantType.sourcing
                ),
                status="available",
                payroll_ready=False,
                created_at=datetime.utcnow()
            )

            db.add(consultant)
            candidate.status = "converted"
            db.commit()
            db.refresh(consultant)

            # ---------------------------------------------
            # 📧 SEND LOGIN EMAIL (ONLY ON FIRST CREATE)
            # ---------------------------------------------
            if temp_password:
                try:
                    send_email(
                        to=candidate.email,
                        subject="Your Consultant Login Credentials",
                        body=f"""
Hi {candidate.full_name},

Your consultant account has been created.

Login Email: {candidate.email}
Temporary Password: {temp_password}

Please login and change your password.

Regards,
HR Team
"""
                    )
                except Exception as e:
                    print("Email failed:", e)

    else:
        raise HTTPException(
            400,
            "Either consultantId or applicationId is required"
        )

    # =====================================================
    # 🚀 ASSIGN DEPLOYMENT
    # =====================================================
    if consultant.status == "deployed":
        raise HTTPException(400, "Consultant already deployed")

    deployment = models.ConsultantDeployment(
        consultant_id=consultant.id,
        client_id=payload.clientId,
        client_name=payload.clientName,
        role=payload.role,
        start_date=payload.startDate,
        end_date=payload.endDate,
        billing_type=payload.billingType,
        billing_rate=payload.billingRate,
        payout_rate=payload.payoutRate,
        status="active",
        created_at=datetime.utcnow()
    )

    consultant.status = "deployed"

    db.add(deployment)

    if app:
        app.status = "DEPLOYED"

    db.commit()
    db.refresh(deployment)

    return {
        "message": "Consultant converted & assigned successfully"
        if payload.applicationId
        else "Consultant assigned successfully",
        "deployment_id": deployment.id,
        "consultant_id": consultant.id
    }


# ---------------------------------------------------------
# LIST ALL CONSULTANTS (AM VIEW)
# ---------------------------------------------------------
@router.get("/consultants")
def list_consultants_for_am(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    am_id = get_user_id(current_user)

    consultants = (
        db.query(models.Consultant)
        .join(models.Candidate, models.Candidate.id == models.Consultant.candidate_id)
        .outerjoin(
            models.ConsultantDeployment,
            models.ConsultantDeployment.consultant_id == models.Consultant.id
        )
        .order_by(models.Consultant.created_at.desc())
        .all()
    )

    return [
        {
            "consultant_id": c.id,
            "candidate_id": c.candidate_id,
            "name": c.candidate.full_name if c.candidate else None,
            "email": c.candidate.email if c.candidate else None,
            "type": c.type.value if hasattr(c.type, "value") else c.type,
            "status": c.status,
            "is_deployed": c.status == "deployed",
            "created_at": c.created_at
        }
        for c in consultants
    ]


# ---------------------------------------------------------
# INTERVIEW LOGS (AM READ-ONLY VIEW)
# ---------------------------------------------------------
@router.get("/interview-logs")
def get_interview_logs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Account Manager can view interview logs for all candidates
    submitted for their managed requirements - READ ONLY
    """
    am_id = get_user_id(current_user)

    # Legacy datasets may have NULL jobs.account_manager_id.
    # Mirror the submissions view behavior so AM still sees interview activity.
    managed_job_ids_query = db.query(models.Job.id).filter(
        or_(
            models.Job.account_manager_id == am_id,
            models.Job.account_manager_id.is_(None),
        )
    ).subquery()

    # Get interviews for candidates submitted to these jobs
    interviews = (
        db.query(models.Interview)
        .options(
            joinedload(models.Interview.submission).joinedload(models.CandidateSubmission.candidate),
            joinedload(models.Interview.submission).joinedload(models.CandidateSubmission.job),
            joinedload(models.Interview.submission).joinedload(models.CandidateSubmission.recruiter),
        )
        .join(models.CandidateSubmission, models.CandidateSubmission.id == models.Interview.submission_id)
        .join(models.Job, models.Job.id == models.CandidateSubmission.job_id)
        .filter(models.Job.id.in_(managed_job_ids_query))
        .order_by(models.Interview.created_at.desc())
        .all()
    )

    candidate_ids = set()
    scoped_job_ids = set()
    for interview in interviews:
        submission = interview.submission
        if not submission:
            continue
        if submission.candidate_id:
            candidate_ids.add(submission.candidate_id)
        if submission.job_id:
            scoped_job_ids.add(submission.job_id)

    app_lookup = {}
    if candidate_ids and scoped_job_ids:
        job_apps = (
            db.query(models.JobApplication)
            .filter(
                models.JobApplication.candidate_id.in_(candidate_ids),
                models.JobApplication.job_id.in_(scoped_job_ids),
            )
            .all()
        )
        for app in job_apps:
            app_lookup[(app.candidate_id, app.job_id)] = app

    result = []
    for interview in interviews:
        submission = interview.submission
        candidate = submission.candidate if submission else None
        job = submission.job if submission else None
        recruiter = submission.recruiter if submission else None

        app = None
        if submission and submission.candidate_id and submission.job_id:
            app = app_lookup.get((submission.candidate_id, submission.job_id))

        result.append({
            "interview_id": interview.id,
            "candidate_id": submission.candidate_id if submission else None,
            "job_id": submission.job_id if submission else None,
            "candidate_name": candidate.full_name if candidate else None,
            "job_title": job.title if job else None,
            "recruiter_id": submission.recruiter_id if submission else None,
            "recruiter_name": recruiter.full_name if recruiter else None,
            "recruiter_email": recruiter.email if recruiter else None,
            "interview_mode": interview.mode,
            "scheduled_at": interview.scheduled_at,
            "started_at": interview.started_at,
            "completed_at": interview.completed_at,
            "status": interview.status,
            "meeting_link": interview.meeting_link,
            "location": interview.location,
            "duration_seconds": interview.duration_seconds,
            "overall_score": interview.overall_ai_score,
            "notes": interview.notes,
            "client_decision": app.client_decision if app else None,
            "application_status": app.status if app else None,
            "created_at": interview.created_at,
        })

    return {"interview_logs": result}


# ---------------------------------------------------------
# RECRUITER SUBMISSIONS WITH DETAILS
# ---------------------------------------------------------
@router.get("/submissions")
def get_submissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get all submissions made by recruiters for AM's managed requirements
    """
    am_id = get_user_id(current_user)

    # Legacy data often has NULL jobs.account_manager_id.
    # Include those records so AM can still review submissions.
    apps = (
        db.query(models.JobApplication)
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(
            or_(
                models.Job.account_manager_id == am_id,
                models.Job.account_manager_id.is_(None),
            )
        )
        .order_by(models.JobApplication.applied_at.desc())
        .all()
    )

    normalized = False
    for app in apps:
        # Backward compatibility: older records use `submitted` for recruiter->AM handoff.
        if str(app.status or "").lower() == "submitted":
            app.status = "sent_to_am"
            if not app.sent_to_am_at:
                app.sent_to_am_at = app.applied_at or datetime.utcnow()
            normalized = True

    if normalized:
        db.commit()

    # Build recruiter lookup
    recruiter_ids = list(set(a.recruiter_id for a in apps if a.recruiter_id))
    recruiters = {}
    if recruiter_ids:
        recruiter_rows = db.query(models.User.id, models.User.full_name).filter(
            models.User.id.in_(recruiter_ids)
        ).all()
        recruiters = {r.id: r.full_name for r in recruiter_rows}

    # Build client lookup
    client_ids = list(set(a.job.client_id for a in apps if a.job and a.job.client_id))
    clients = {}
    if client_ids:
        client_rows = db.query(models.User.id, models.User.full_name).filter(
            models.User.id.in_(client_ids)
        ).all()
        clients = {c.id: c.full_name for c in client_rows}

    return {
        "submissions": [
            {
                "application_id": a.id,
                "candidate_id": a.candidate_id,
                "candidate_name": (
                    a.candidate.full_name if a.candidate and a.candidate.full_name else a.full_name
                ),
                "email": a.candidate.email if a.candidate and a.candidate.email else a.email,
                "phone": a.candidate.phone if a.candidate and a.candidate.phone else a.phone,
                "job_id": a.job_id,
                "job_title": a.job.title if a.job else None,
                "requirement_id": a.job.requirement_id if a.job and hasattr(a.job, 'requirement_id') else None,
                "requirement_title": a.job.title if a.job else None,
                "client_id": a.job.client_id if a.job else None,
                "client_name": clients.get(a.job.client_id) if a.job and a.job.client_id else None,
                "status": a.status,
                "submitted_by": a.recruiter_id,
                "recruiter_name": recruiters.get(a.recruiter_id, "Unknown"),
                "submitted_by_name": recruiters.get(a.recruiter_id, "Unknown"),
                "assigned_recruiter_id": a.recruiter_id,
                "assigned_recruiter_name": recruiters.get(a.recruiter_id, "Unknown"),
                "submitted_at": a.applied_at,
                "sent_to_client_at": a.sent_to_client_at,
                "client_decision": a.client_decision,
                "client_feedback": a.client_feedback,
                "interview_scheduling_ready": bool(a.interview_scheduling_ready),
                "interview_scheduling_note": a.interview_scheduling_note,
                "interview_scheduling_ready_at": a.interview_scheduling_ready_at.isoformat() if a.interview_scheduling_ready_at else None,
                "match_score": a.screening_score,
                "skills": a.skills,
                "experience_years": a.candidate.experience_years if a.candidate else a.experience_years,
                "current_location": a.candidate.current_location if a.candidate else None,
                "current_employer": a.candidate.current_employer if a.candidate else None,
                "expected_ctc": a.candidate.expected_ctc if a.candidate else None,
            }
            for a in apps
        ]
    }


@router.get("/clients")
def get_am_clients(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Client list for AM filters.
    Includes:
    1) Real client records from clients table
    2) Legacy job-linked client records (fallback)
    """
    legacy_defaults = [
        "CookieMan",
        "ITC Infotech",
        "ITC Ltd",
        "TCL",
        "TCTSL",
    ]

    existing_client_names = {
        (str(row[0]).strip().lower())
        for row in db.query(models.Client.client_name).all()
        if row and row[0]
    }
    to_create = []
    for legacy_name in legacy_defaults:
        if legacy_name.lower() not in existing_client_names:
            to_create.append(models.Client(client_name=legacy_name))

    if to_create:
        db.add_all(to_create)
        db.commit()

    # 1) Primary source: actual clients table
    client_rows = db.query(models.Client.id, models.Client.client_name).all()

    # 2) Backward compatibility: client values inferred from jobs
    job_rows = (
        db.query(models.Job.client_id, models.Job.client_name)
        .filter(
            or_(
                models.Job.client_id.isnot(None),
                models.Job.client_name.isnot(None),
            )
        )
        .all()
    )

    client_map = {}
    for client_id, client_name in list(client_rows) + list(job_rows):
        key = (str(client_id or "").strip() or str(client_name or "").strip()).lower()
        if not key:
            continue
        if key not in client_map:
            resolved_name = str(client_name or "").strip() or str(client_id or "").strip()
            client_map[key] = {
                "id": str(client_id or "").strip() or key,
                "name": resolved_name,
                "client_name": resolved_name,
            }

    return {"clients": list(client_map.values())}


# ---------------------------------------------------------
# MARK CANDIDATE AS HIRED
# ---------------------------------------------------------
@router.post("/applications/{app_id}/mark-hired")
def mark_candidate_hired(
    app_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Account Manager marks a candidate as hired
    This triggers consultant conversion
    """
    app = db.query(models.JobApplication).filter(
        models.JobApplication.id == app_id
    ).first()

    if not app:
        raise HTTPException(404, "Application not found")

    if app.status == "hired":
        raise HTTPException(400, "Candidate already marked as hired")

    old_status = app.status
    app.status = "hired"
    app.decision_at = datetime.utcnow()
    app.client_decision = "hired"
    log_activity(
        db,
        action="application.hired",
        resource_type="submission",
        actor=current_user,
        resource_id=app.id,
        resource_name=(app.candidate.full_name if app.candidate else app.full_name),
        target_user_id=app.candidate_id,
        job_id=app.job_id,
        recruiter_id=app.recruiter_id,
        old_status=old_status,
        new_status="hired",
        is_visible_to_candidate=True,
    )

    db.commit()

    return {
        "message": "Candidate marked as hired",
        "application_id": app.id,
        "status": app.status
    }


# ---------------------------------------------------------
# MARK CANDIDATE AS REJECTED
# ---------------------------------------------------------
@router.post("/applications/{app_id}/mark-rejected")
def mark_candidate_rejected(
    app_id: str,
    feedback: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Account Manager rejects a candidate
    """
    app = db.query(models.JobApplication).filter(
        models.JobApplication.id == app_id
    ).first()

    if not app:
        raise HTTPException(404, "Application not found")

    if app.status == "rejected":
        raise HTTPException(400, "Candidate already marked as rejected")

    old_status = app.status
    app.status = "rejected"
    app.decision_at = datetime.utcnow()
    app.client_decision = "rejected"
    if feedback:
        app.client_feedback = feedback
    log_activity(
        db,
        action="application.client_rejected",
        resource_type="submission",
        actor=current_user,
        resource_id=app.id,
        resource_name=(app.candidate.full_name if app.candidate else app.full_name),
        target_user_id=app.candidate_id,
        job_id=app.job_id,
        recruiter_id=app.recruiter_id,
        old_status=old_status,
        new_status="rejected",
        note=feedback,
        metadata={
            "candidate_message": "We have moved forward with other candidates for this role.",
        },
        is_visible_to_candidate=True,
    )

    db.commit()

    return {
        "message": "Candidate marked as rejected",
        "application_id": app.id,
        "status": app.status
    }



@router.post("/applications/{app_id}/direct-hire")
@require_permission("candidates", "update")
def record_direct_hire(
    app_id: str,
    payload: DirectHireRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    app = db.query(models.JobApplication).filter(
        models.JobApplication.id == app_id
    ).first()

    if not app:
        raise HTTPException(404, "Application not found")

    if app.status.lower() != "hired" or not app.ready_for_assignment:
        raise HTTPException(
            400,
            "Candidate must be marked as hired and pending assignment before closing as direct hire",
        )

    app.status = "DIRECT_HIRE"
    app.ready_for_assignment = False
    app.decision_at = datetime.utcnow()

    if payload.note:
        app.client_feedback = payload.note
    log_activity(
        db,
        action="am.direct_hire",
        resource_type="submission",
        actor=current_user,
        resource_id=app.id,
        resource_name=(app.candidate.full_name if app.candidate else app.full_name),
        target_user_id=app.candidate_id,
        job_id=app.job_id,
        recruiter_id=app.recruiter_id,
        old_status="hired",
        new_status="direct_hire",
        note=payload.note,
        is_visible_to_candidate=False,
    )

    db.commit()

    return {
        "message": "Direct hire recorded",
        "application_id": app.id,
        "status": app.status
    }

# ---------------------------------------------------------
# APPROVE TIMESHEET
# ---------------------------------------------------------
@router.post("/timesheets/{ts_id}/approve")
def approve_timesheet(
    ts_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Account Manager approves a submitted timesheet
    """
    ts = db.query(models.Timesheet).filter(
        models.Timesheet.id == ts_id
    ).first()

    if not ts:
        raise HTTPException(404, "Timesheet not found")

    if ts.status.value != "submitted":
        raise HTTPException(400, f"Timesheet status is {ts.status}, cannot approve")

    ts.status = models.TimesheetStatus.am_approved
    ts.am_approved_at = datetime.utcnow()
    log_activity(
        db,
        action="am.timesheet_approved",
        resource_type="timesheet",
        actor=current_user,
        resource_id=ts.id,
        resource_name=str(ts.consultant_id),
        target_user_id=str(ts.consultant_id),
        old_status="submitted",
        new_status="am_approved",
    )

    db.commit()

    return {
        "message": "Timesheet approved by Account Manager",
        "timesheet_id": ts.id,
        "status": ts.status.value
    }


# ---------------------------------------------------------
# REJECT TIMESHEET
# ---------------------------------------------------------
@router.post("/timesheets/{ts_id}/reject")
def reject_timesheet(
    ts_id: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Account Manager rejects a submitted timesheet
    """
    ts = db.query(models.Timesheet).filter(
        models.Timesheet.id == ts_id
    ).first()

    if not ts:
        raise HTTPException(404, "Timesheet not found")

    if ts.status.value != "submitted":
        raise HTTPException(400, f"Timesheet status is {ts.status}, cannot reject")

    ts.status = models.TimesheetStatus.rejected
    ts.rejection_reason = reason
    log_activity(
        db,
        action="am.timesheet_rejected",
        resource_type="timesheet",
        actor=current_user,
        resource_id=ts.id,
        resource_name=str(ts.consultant_id),
        target_user_id=str(ts.consultant_id),
        old_status="submitted",
        new_status="rejected",
        note=reason,
    )

    db.commit()

    return {
        "message": "Timesheet rejected by Account Manager",
        "timesheet_id": ts.id,
        "status": ts.status.value,
        "rejection_reason": reason
    }


# ---------------------------------------------------------
# VIEW ALL TIMESHEETS PENDING APPROVAL
# ---------------------------------------------------------
@router.get("/pending-timesheets")
def get_pending_timesheets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get all timesheets pending Account Manager approval
    """
    timesheets = (
        db.query(models.Timesheet)
        .filter(models.Timesheet.status == models.TimesheetStatus.submitted)
        .order_by(models.Timesheet.submitted_at.desc())
        .all()
    )

    result = []
    for ts in timesheets:
        consultant_name = None
        if ts.consultant:
            consultant_name = ts.consultant.candidate.full_name if ts.consultant.candidate else None

        result.append({
            "timesheet_id": ts.id,
            "consultant_id": ts.consultant_id,
            "consultant_name": consultant_name,
            "period_type": ts.period_type,
            "period_start": ts.period_start,
            "period_end": ts.period_end,
            "total_hours": ts.total_hours,
            "submitted_at": ts.submitted_at,
        })

    return {"pending_timesheets": result}

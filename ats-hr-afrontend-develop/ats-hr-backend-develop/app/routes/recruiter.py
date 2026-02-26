from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import String, cast, func, or_
from datetime import datetime
from typing import Optional
import re

from app.db import get_db
from app import models
from app.auth import get_current_user
from sqlalchemy.orm import joinedload
from pydantic import BaseModel, EmailStr, validator
from sqlalchemy.exc import IntegrityError

from app.schemas import JobSubmissionCreate

from fastapi import UploadFile, File, Form
import secrets
import shutil
import os
from app.models import UserPreferences, PasswordResetLog, AccountActivityLog
from app.auth import verify_password, get_password_hash, create_access_token
from datetime import timedelta
from fastapi import Request

# ============================================================
# SCHEMA FOR VALIDATION
# ============================================================
class RecruiterProfileUpdate(BaseModel):
    full_name: str = None
    phone: str = None
    
    @validator('full_name')
    def validate_full_name(cls, v):
        if v and len(v) < 2:
            raise ValueError('Full name must be at least 2 characters')
        if v and len(v) > 100:
            raise ValueError('Full name cannot exceed 100 characters')
        if v and not v[0].isupper():
            raise ValueError('Full name must start with capital letter')
        return v
    
    @validator('phone')
    def validate_phone(cls, v):
        if not v:
            return v
        # 10 digits format
        phone_digits = ''.join(filter(str.isdigit, v))
        if len(phone_digits) != 10:
            raise ValueError('Phone must be exactly 10 digits')
        return v


# ============================================================
# CALL FEEDBACK SCHEMAS
# ============================================================
class CallFeedbackCreate(BaseModel):
    candidate_id: str
    job_id: str = None  # Job UUID or public job_id (ATS-J-XXXX)
    call_type: str  # Initial Screening, HR Round, Technical Discussion, Follow-up
    call_date: datetime
    call_duration: int = None  # minutes
    call_mode: str  # Phone, Google Meet, Zoom, WhatsApp
    ratings: dict  # { "communication": 4, "technical_fit": 3, ... }
    salary_alignment: str  # Yes, No, Negotiable
    strengths: str = None
    concerns: str = None
    additional_notes: str = None
    candidate_intent: str = None  # Actively looking, Passive, Offer in hand, Just exploring
    decision: str  # Send to AM, Hold / Revisit Later, Reject, Needs Another Call
    rejection_reason: str = None  # Skill mismatch, Salary mismatch, Experience mismatch, Not interested, No show
    next_actions: list = None  # ["Schedule technical interview", ...]
    is_draft: bool = True


class CallFeedbackUpdate(BaseModel):
    job_id: str = None
    call_type: str = None
    call_date: datetime = None
    call_duration: int = None
    call_mode: str = None
    ratings: dict = None
    salary_alignment: str = None
    strengths: str = None
    concerns: str = None
    additional_notes: str = None
    candidate_intent: str = None
    decision: str = None
    rejection_reason: str = None
    next_actions: list = None
    is_draft: bool = None


class CallFeedbackResponse(BaseModel):
    id: str
    candidate_id: str
    recruiter_id: str
    call_type: str
    call_date: datetime
    call_duration: int
    call_mode: str
    ratings: dict
    salary_alignment: str
    strengths: str
    concerns: str
    additional_notes: str
    candidate_intent: str
    decision: str
    rejection_reason: str
    next_actions: list
    is_draft: bool
    created_at: datetime
    updated_at: datetime


router = APIRouter(
    prefix="/v1/recruiter",
    tags=["Recruiter"]
)

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


def _normalize(value):
    return str(value or "").strip().lower()


def _is_recruiter_user(current_user) -> bool:
    return _normalize(current_user.get("role")) == "recruiter"


def _is_admin_user(current_user) -> bool:
    return _normalize(current_user.get("role")) in {"admin", "super_admin"}


def _is_recruiter_assigned_to_job(db: Session, recruiter_id: str, job_id: str) -> bool:
    return db.query(models.job_recruiters).filter(
        models.job_recruiters.c.job_id == job_id,
        models.job_recruiters.c.recruiter_id == recruiter_id,
    ).first() is not None


def _ensure_recruiter_has_job_access(db: Session, current_user: dict, job: models.Job):
    if not job:
        raise HTTPException(404, "Job not found")
    if not _is_recruiter_user(current_user):
        return
    recruiter_id = current_user.get("id")
    if not _is_recruiter_assigned_to_job(db, recruiter_id, job.id):
        raise HTTPException(
            status_code=403,
            detail=f"You are not assigned to job {job.job_id or job.id}",
        )


def _get_user_display_name(db: Session, user_id: str) -> str:
    if not user_id:
        return ""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return user_id
    return user.full_name or user.username or user.email or user.id


def _submission_is_released(submission: models.CandidateSubmission) -> bool:
    return _normalize(submission.status) in LOCK_RELEASE_STATUSES


def _assert_candidate_lock_owner(
    db: Session,
    *,
    candidate_id: str,
    job: models.Job,
    recruiter_id: str,
    action: str,
    lock_if_available: bool = True,
) -> models.CandidateSubmission:
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.candidate_id == candidate_id,
        models.CandidateSubmission.job_id == job.id,
    ).first()

    if submission:
        if submission.recruiter_id and submission.recruiter_id != recruiter_id:
            if submission.is_locked and not _submission_is_released(submission):
                owner_name = _get_user_display_name(db, submission.recruiter_id)
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": f"Candidate is in progress by recruiter {owner_name}",
                        "lock_status_label": f"In Progress by Recruiter {owner_name}",
                        "assignment_label": f"Assigned to Recruiter {owner_name} for Job ID {job.job_id or job.id}",
                        "locked_by_recruiter_id": submission.recruiter_id,
                        "job_id": job.job_id or job.id,
                        "candidate_id": candidate_id,
                    },
                )
        if submission.recruiter_id in (None, recruiter_id) and lock_if_available:
            submission.recruiter_id = recruiter_id
            submission.is_locked = True
            submission.stage = submission.stage or "recruiter_review"
            submission.updated_at = datetime.utcnow()
        return submission

    if not lock_if_available:
        raise HTTPException(
            status_code=404,
            detail="Candidate lock context not found for this job",
        )

    submission = models.CandidateSubmission(
        id=models.generate_uuid(),
        candidate_id=candidate_id,
        job_id=job.id,
        recruiter_id=recruiter_id,
        status="submitted",
        stage="recruiter_review",
        is_locked=True,
        source=action,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(submission)
    return submission


def _log_candidate_audit(
    db: Session,
    *,
    actor_id: str,
    action: str,
    candidate_id: str,
    old_state: str,
    new_state: str,
    details: dict = None,
):
    db.add(
        models.AuditLog(
            user_id=actor_id,
            action=action,
            entity_type="candidate",
            entity_id=candidate_id,
            old_state=old_state,
            new_state=new_state,
            details=details or {},
            timestamp=datetime.utcnow(),
        )
    )


def _candidate_matches_job(candidate: models.Candidate, job: models.Job):
    job_skills = {
        str(s).strip().lower()
        for s in (job.skills or [])
        if str(s).strip()
    }
    candidate_skills = {
        str(s).strip().lower()
        for s in (candidate.skills or [])
        if str(s).strip()
    }

    if job_skills and not job_skills.intersection(candidate_skills):
        return False, "Candidate skills do not match job requirements"

    exp = candidate.experience_years or 0
    if job.min_experience is not None and exp < job.min_experience:
        return False, "Candidate experience is below minimum requirement"
    if job.max_experience is not None and exp > job.max_experience:
        return False, "Candidate experience exceeds maximum requirement"
    return True, None


def _build_candidate_public_id_allocator(db: Session):
    base_id = models.generate_candidate_public_id_from_org(db)
    match = re.match(r"^(?P<prefix>[A-Z]{3}-C-)(?P<num>\d+)$", base_id or "")
    if match:
        prefix = match.group("prefix")
        next_num = int(match.group("num"))
    else:
        prefix = "ATS-C-"
        next_num = 1

    reserved = set()

    def allocate() -> str:
        nonlocal next_num
        while True:
            candidate_id = f"{prefix}{str(next_num).zfill(4)}"
            next_num += 1
            if candidate_id in reserved:
                continue
            exists = (
                db.query(models.Candidate.id)
                .filter(models.Candidate.public_id == candidate_id)
                .first()
            )
            if exists:
                continue
            reserved.add(candidate_id)
            return candidate_id

    return allocate


def _resolve_client_name_map(db: Session, client_ids):
    normalized_ids = [
        str(client_id).strip()
        for client_id in (client_ids or [])
        if str(client_id).strip()
    ]
    if not normalized_ids:
        return {}

    client_rows = (
        db.query(models.Client.id, models.Client.client_name)
        .filter(models.Client.id.in_(normalized_ids))
        .all()
    )
    resolved = {
        str(row.id): str(row.client_name).strip()
        for row in client_rows
        if row.id and row.client_name and str(row.client_name).strip()
    }

    unresolved_ids = [client_id for client_id in normalized_ids if client_id not in resolved]
    if unresolved_ids:
        user_rows = (
            db.query(models.User.id, models.User.full_name)
            .filter(models.User.id.in_(unresolved_ids))
            .all()
        )
        for row in user_rows:
            if row.id and row.full_name and str(row.full_name).strip():
                resolved[str(row.id)] = str(row.full_name).strip()

    return resolved


# ------------------------------------------------------------------
# GET RECRUITER'S ASSIGNED JOBS
# ------------------------------------------------------------------
@router.get("/assigned-jobs")
def get_recruiter_assigned_jobs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get all jobs assigned to the logged-in recruiter.
    Jobs are assigned through the job.recruiters relationship.
    """
    try:
        recruiter_id = current_user.get("id")
        
        # Query jobs where current recruiter is assigned
        # Don't filter by is_active since it may be NULL
        jobs = db.query(models.Job).join(
            models.job_recruiters,
            models.Job.id == models.job_recruiters.c.job_id
        ).filter(
            models.job_recruiters.c.recruiter_id == recruiter_id,
            models.Job.status.in_(["active", "open", "in_progress"])
        ).order_by(models.Job.created_at.desc()).all()

        client_name_map = _resolve_client_name_map(
            db,
            [job.client_id for job in jobs if job.client_id],
        )
        
        return {
            "total": len(jobs),
            "jobs": [
                {
                    "id": j.id,
                    "job_id": j.job_id,
                    "serial_number": j.serial_number,
                    "title": j.title,
                    "location": j.location,
                    "department": j.department,
                    "status": j.status,
                    "mode": j.mode,
                    "skills": j.skills or [],
                    "min_experience": j.min_experience,
                    "max_experience": j.max_experience,
                    "description": j.description,
                    "jd_text": j.jd_text,
                    "client_id": j.client_id,
                    "client_name": (
                        str(j.client_name).strip()
                        if j.client_name and str(j.client_name).strip()
                        else client_name_map.get(str(j.client_id))
                    ),
                    "client_ta": j.client_ta,
                    "no_of_positions": getattr(j, 'no_of_positions', 1),
                    "budget": getattr(j, 'budget', None),
                    "work_timings": getattr(j, 'work_timings', None),
                    "joining_preference": getattr(j, 'joining_preference', None),
                    "duration": j.duration,
                    "created_at": str(j.created_at) if j.created_at else None,
                    "date_created": str(j.date_created) if j.date_created else None,
                    "candidates_count": len(j.applications) if j.applications else 0
                }
                for j in jobs
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching assigned jobs: {str(e)}")


# ------------------------------------------------------------------
# 0️⃣ GET RECRUITER PROFILE
# ------------------------------------------------------------------
@router.get("/profile")
def get_recruiter_profile(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get recruiter's own profile information"""
    recruiter_id = current_user["id"]
    
    user = db.query(models.User).filter(
        models.User.id == recruiter_id
    ).first()
    
    if not user:
        raise HTTPException(404, "Recruiter not found")
    
    # Get count of assigned jobs
    assigned_jobs_count = db.query(models.job_recruiters).filter(
        models.job_recruiters.c.recruiter_id == recruiter_id
    ).count()
    
    # Get count of active applications
    active_apps_count = db.query(models.JobApplication).join(
        models.Job
    ).filter(
        models.job_recruiters.c.recruiter_id == recruiter_id,
        models.JobApplication.status.in_(['new', 'reviewed'])
    ).count()
    
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name or "",
        "email": user.email,
        "phone": user.phone if hasattr(user, 'phone') else None,
        "role": user.role,
        "company_name": user.company_name,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "assigned_jobs_count": assigned_jobs_count,
        "active_applications_count": active_apps_count
    }


# ------------------------------------------------------------------
# 1️⃣ UPDATE RECRUITER PROFILE
# ------------------------------------------------------------------
@router.put("/profile")
def update_recruiter_profile(
    profile_data: RecruiterProfileUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Update recruiter's profile information"""
    recruiter_id = current_user["id"]
    
    user = db.query(models.User).filter(
        models.User.id == recruiter_id
    ).first()
    
    if not user:
        raise HTTPException(404, "Recruiter not found")
    
    # Update only provided fields
    if profile_data.full_name is not None:
        user.full_name = profile_data.full_name
    
    if profile_data.phone is not None:
        if hasattr(user, 'phone'):
            user.phone = profile_data.phone
        else:
            raise HTTPException(400, "Phone field not supported for this user")

    # Profile photo upload handled separately
    
    try:
        db.commit()
        db.refresh(user)
        return {
            "message": "Profile updated successfully",
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone if hasattr(user, 'phone') else None,
            "updated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(400, f"Update failed: {str(e)}")


# ---------------- PROFILE PHOTO UPLOAD ----------------
@router.post("/profile/photo")
def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    user = db.query(models.User).filter(models.User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    ext = os.path.splitext(file.filename)[-1]
    filename = f"profile_{user.id}{ext}"
    upload_dir = "uploads/profile_photos"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    user.photo_url = f"/uploads/profile_photos/{filename}"
    db.commit()
    db.refresh(user)
    return {"message": "Profile photo updated", "photo_url": user.photo_url}


# ---------------- EMAIL CHANGE WITH OTP ----------------
@router.post("/profile/email-change-request")
def request_email_change(
    new_email: str = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    user = db.query(models.User).filter(models.User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    if db.query(models.User).filter(models.User.email == new_email).first():
        raise HTTPException(400, "Email already in use")
    otp = secrets.randbelow(1000000)
    otp = f"{otp:06d}"
    user.otp_code = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=5)
    db.commit()
    # Send OTP to both old and new email
    app_utils_utils.send_otp_email(user.email, otp, "Email Change Verification")
    app_utils_utils.send_otp_email(new_email, otp, "Email Change Verification")
    return {"message": "OTP sent to both emails"}

@router.post("/profile/email-change-verify")
def verify_email_change(
    new_email: str = Form(...),
    otp: str = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    user = db.query(models.User).filter(models.User.id == current_user["id"]).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.otp_code != otp or not user.otp_expiry or user.otp_expiry < datetime.utcnow():
        raise HTTPException(400, "Invalid or expired OTP")
    user.email = new_email
    user.otp_code = None
    user.otp_expiry = None
    db.commit()
    db.refresh(user)
    return {"message": "Email updated successfully", "email": user.email}


# ---------------- CHANGE PASSWORD ----------------
@router.post("/change-password")
def change_password(
    request: Request,
    current_password: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    user = db.query(models.User).filter(
        models.User.id == current_user["id"]
    ).first()

    if not user:
        raise HTTPException(404, "User not found")

    if not verify_password(current_password, user.password):
        raise HTTPException(400, "Current password incorrect")

    # Password validation
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

    # Update password
    user.password = get_password_hash(new_password)
    db.commit()

    # Get client info (NO UTILS)
    client_ip = request.client.host if request.client else "0.0.0.0"
    user_agent = request.headers.get("user-agent", "Unknown")

    # Log activity
    db.add(
        AccountActivityLog(
            user_id=user.id,
            action_type="password_change",
            ip_address=client_ip,
            device_info=user_agent,
        )
    )
    db.commit()

    return {"message": "Password changed successfully"}


# ---------------- RESET PASSWORD (FORGOT FLOW) ----------------
@router.post("/reset-password-request")
def reset_password_request(
    email: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, "User not found")
    log = db.query(PasswordResetLog).filter(PasswordResetLog.user_id == user.id).first()
    now = datetime.utcnow()
    if log and log.last_reset_date and (now - log.last_reset_date).days < 30 and log.reset_count >= 2:
        log.is_locked = True
        db.commit()
        return {"status": "blocked", "message": "Account Manager approval required"}
    otp = secrets.randbelow(1000000)
    otp = f"{otp:06d}"
    user.otp_code = otp
    user.otp_expiry = now + timedelta(minutes=5)
    db.commit()
    app_utils_utils.send_otp_email(user.email, otp, "Password Reset OTP")
    return {"message": "OTP sent to email"}
@router.post("/reset-password-verify")
def reset_password_verify(
    request: Request,
    email: str = Form(...),
    otp: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(
        models.User.email == email
    ).first()

    if not user:
        raise HTTPException(404, "User not found")

    if (
        user.otp_code != otp
        or not user.otp_expiry
        or user.otp_expiry < datetime.utcnow()
    ):
        raise HTTPException(400, "Invalid or expired OTP")

    # Password validation
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

    # Update password
    user.password = get_password_hash(new_password)
    user.otp_code = None
    user.otp_expiry = None

    # Reset log logic
    log = db.query(PasswordResetLog).filter(
        PasswordResetLog.user_id == user.id
    ).first()

    now = datetime.utcnow()

    if not log:
        log = PasswordResetLog(
            user_id=user.id,
            reset_count=1,
            last_reset_date=now,
            is_locked=False,
        )
        db.add(log)
    else:
        if log.last_reset_date and (now - log.last_reset_date).days < 30:
            log.reset_count += 1
        else:
            log.reset_count = 1

        log.last_reset_date = now
        log.is_locked = False

    db.commit()

    # Get client info (NO UTILS)
    client_ip = request.client.host if request.client else "0.0.0.0"
    user_agent = request.headers.get("user-agent", "Unknown")

    # Log activity
    db.add(
        AccountActivityLog(
            user_id=user.id,
            action_type="password_reset",
            ip_address=client_ip,
            device_info=user_agent,
        )
    )
    db.commit()

    return {"message": "Password reset successfully"}


# ---------------- PRODUCT SETTINGS (USER PREFERENCES) ----------------
@router.get("/preferences")
def get_user_preferences(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user["id"]).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user["id"])
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return {
        "email_notifications": prefs.email_notifications,
        "sms_alerts": prefs.sms_alerts,
        "report_emails": prefs.report_emails,
        "interview_reminders": prefs.interview_reminders,
        "two_factor_enabled": prefs.two_factor_enabled
    }

@router.put("/preferences")
def update_user_preferences(
    email_notifications: bool = Form(...),
    sms_alerts: bool = Form(...),
    report_emails: bool = Form(...),
    interview_reminders: bool = Form(...),
    two_factor_enabled: bool = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user["id"]).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user["id"])
        db.add(prefs)
    prefs.email_notifications = email_notifications
    prefs.sms_alerts = sms_alerts
    prefs.report_emails = report_emails
    prefs.interview_reminders = interview_reminders
    prefs.two_factor_enabled = two_factor_enabled
    db.commit()
    db.refresh(prefs)
    return {"message": "Preferences updated"}


# ---------------- ACCOUNT ACTIVITY LOGS ----------------
@router.get("/activity-logs")
def get_account_activity_logs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    logs = db.query(AccountActivityLog).filter(AccountActivityLog.user_id == current_user["id"]).order_by(AccountActivityLog.timestamp.desc()).limit(100).all()
    return [
        {
            "action_type": log.action_type,
            "ip_address": log.ip_address,
            "device_info": log.device_info,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None
        }
        for log in logs
    ]


@router.get("/workflow-logs")
def get_recruiter_workflow_logs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    limit: int = Query(100, ge=1, le=500),
    recruiter_id: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
    candidate_id: Optional[str] = Query(default=None),
    job_id: Optional[str] = Query(default=None),
):
    """
    Admin view of recruiter workflow audit logs.
    Includes recruiter actions from both legacy recruiter workflows and the
    current recruiter lock-scoped workflow.
    """
    if not _is_admin_user(current_user):
        raise HTTPException(403, "Only admin users can view recruiter workflow logs")

    recruiter_actions = {
        "CANDIDATE_SELECTED_FOR_REQUIREMENT",
        "CANDIDATE_CREATED",
        "RESUME_PARSED",
        "SCREENING_DETAILS_ADDED",
        "CANDIDATE_SHORTLISTED",
        "CANDIDATE_REJECTED",
        "CANDIDATE_CONVERTED",
        "CONSULTANT_CREATED",
        "CONSULTANT_SUBMITTED",
        "SUBMISSION_CREATED",
        "INTERVIEW_SCHEDULED",
        "INTERVIEW_OUTCOME_RECORDED",
        "CLIENT_FEEDBACK_SUBMITTED",
        "JOINING_CONFIRMED",
        "RECRUITER_SUBMITTED_TO_AM",
        "RECRUITER_SHORTLISTED",
        "RECRUITER_SENT_TO_AM",
        "RECRUITER_FEEDBACK_CREATED",
        "RECRUITER_FEEDBACK_UPDATED",
        "RECRUITER_FEEDBACK_DELETED",
    }

    query = (
        db.query(
            models.AuditLog,
            models.User.full_name.label("recruiter_name"),
            models.User.email.label("recruiter_email"),
        )
        .join(models.User, models.User.id == models.AuditLog.user_id)
        .filter(func.lower(cast(models.User.role, String)) == "recruiter")
        .filter(
            or_(
                models.AuditLog.action.like("RECRUITER_%"),
                models.AuditLog.action.in_(recruiter_actions),
            )
        )
    )

    if recruiter_id:
        query = query.filter(models.AuditLog.user_id == recruiter_id)
    if action:
        query = query.filter(models.AuditLog.action == action)

    raw_rows = (
        query.order_by(models.AuditLog.timestamp.desc())
        .limit(max(limit * 4, 400))
        .all()
    )

    parsed_rows = []
    normalized_candidate_filter = str(candidate_id or "").strip()
    normalized_job_filter = str(job_id or "").strip()

    for row in raw_rows:
        log = row.AuditLog
        details = log.details if isinstance(log.details, dict) else {}
        detail_candidate_id = str(
            details.get("candidate_id")
            or details.get("candidate_public_id")
            or details.get("public_id")
            or ""
        ).strip()
        detail_job_id = str(
            details.get("job_id")
            or details.get("job_uuid")
            or details.get("job_public_id")
            or details.get("requirement_id")
            or ""
        ).strip()
        entity_candidate_id = (
            str(log.entity_id).strip()
            if str(log.entity_type or "").strip().lower() == "candidate"
            else ""
        )

        effective_candidate_id = detail_candidate_id or entity_candidate_id

        if normalized_candidate_filter and normalized_candidate_filter not in {
            effective_candidate_id,
            detail_candidate_id,
            entity_candidate_id,
        }:
            continue

        if normalized_job_filter and normalized_job_filter != detail_job_id:
            continue

        parsed_rows.append(
            {
                "row": row,
                "log": log,
                "details": details,
                "candidate_id": effective_candidate_id or None,
                "job_id": detail_job_id or None,
            }
        )

    candidate_refs = {
        entry["candidate_id"]
        for entry in parsed_rows
        if entry.get("candidate_id")
    }
    job_refs = {
        entry["job_id"]
        for entry in parsed_rows
        if entry.get("job_id")
    }

    candidate_map = {}
    if candidate_refs:
        candidate_rows = db.query(models.Candidate).filter(
            or_(
                models.Candidate.id.in_(list(candidate_refs)),
                models.Candidate.public_id.in_(list(candidate_refs)),
            )
        ).all()
        for candidate in candidate_rows:
            if candidate.id:
                candidate_map[str(candidate.id)] = candidate
            if getattr(candidate, "public_id", None):
                candidate_map[str(candidate.public_id)] = candidate

    job_map = {}
    if job_refs:
        job_rows = db.query(models.Job).filter(
            or_(
                models.Job.id.in_(list(job_refs)),
                models.Job.job_id.in_(list(job_refs)),
            )
        ).all()
        for job in job_rows:
            if job.id:
                job_map[str(job.id)] = job
            if getattr(job, "job_id", None):
                job_map[str(job.job_id)] = job

    results = []
    for entry in parsed_rows:
        row = entry["row"]
        log = entry["log"]
        details = entry["details"]
        effective_candidate_id = entry["candidate_id"]
        detail_job_id = entry["job_id"]

        candidate = candidate_map.get(str(effective_candidate_id)) if effective_candidate_id else None
        job = job_map.get(str(detail_job_id)) if detail_job_id else None

        candidate_name = (
            details.get("candidate_name")
            or (candidate.full_name if candidate else None)
            or effective_candidate_id
        )
        job_label = (
            details.get("job_title")
            or details.get("requirement_title")
            or (job.title if job else None)
            or detail_job_id
        )

        results.append(
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "old_state": log.old_state,
                "new_state": log.new_state,
                "recruiter_id": log.user_id,
                "recruiter_name": row.recruiter_name or "Recruiter",
                "recruiter_email": row.recruiter_email,
                "candidate_id": effective_candidate_id or None,
                "candidate_name": candidate_name,
                "job_id": detail_job_id or None,
                "job_label": job_label,
                "details": details,
            }
        )

        if len(results) >= limit:
            break

    return {
        "total": len(results),
        "logs": results,
    }



@router.get("/assigned-jobs")
def get_assigned_jobs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    recruiter_id = current_user["id"]

    jobs = (
        db.query(models.Job)
        .options(joinedload(models.Job.account_manager))
        .join(models.job_recruiters)
        .filter(models.job_recruiters.c.recruiter_id == recruiter_id)
        .order_by(models.Job.created_at.desc())
        .all()
    )

    client_name_map = _resolve_client_name_map(
        db,
        [job.client_id for job in jobs if job.client_id],
    )

    result = []

    for j in jobs:
        result.append({
            "id": j.id,
            "job_id": j.job_id,
            "title": j.title,
            "location": j.location,
            "department": j.department,
            "status": j.status,
            "min_experience": j.min_experience,
            "max_experience": j.max_experience,
            "skills": j.skills if isinstance(j.skills, list) else [],
            "created_at": j.created_at,
            "client_id": j.client_id,
            "client_name": (
                str(j.client_name).strip()
                if j.client_name and str(j.client_name).strip()
                else client_name_map.get(str(j.client_id))
            ),
            "account_manager": {
                "id": j.account_manager.id if j.account_manager else None,
                "name": j.account_manager.full_name if j.account_manager else "--",
                "email": j.account_manager.email if j.account_manager else None,
            }
        })

    return {
        "total": len(result),
        "jobs": result
    }
# ------------------------------------------------------------------
# 2️⃣ GET SUBMISSIONS FOR A JOB (Recruiter View)
# ------------------------------------------------------------------
@router.get("/jobs/{job_id}/submissions")
def get_job_submissions(
    job_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    job = db.query(models.Job).filter(
        (models.Job.id == job_id) |
        (models.Job.job_id == job_id)
    ).first()

    if not job:
        return {"candidates": []}
    _ensure_recruiter_has_job_access(db, current_user, job)

    applications = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.job_id == job.id)
        .all()
    )
    submission_locks = {
        s.candidate_id: s
        for s in db.query(models.CandidateSubmission).filter(
            models.CandidateSubmission.job_id == job.id
        ).all()
    }

    result = []
    normalized = False
    current_recruiter_id = str(current_user.get("id") or "").strip()
    public_id_pattern = re.compile(r"^[A-Z]{3}-C-\d{4}$")
    allocate_public_id = _build_candidate_public_id_allocator(db)

    # ✅ THIS LOOP MUST BE INSIDE THE FUNCTION
    for app in applications:
        if app.status == "submitted":
            app.status = "sent_to_am"
            if not app.sent_to_am_at:
                app.sent_to_am_at = app.applied_at or datetime.utcnow()
            normalized = True

        candidate = app.candidate
        if candidate and (
            not candidate.public_id or not public_id_pattern.match(candidate.public_id)
        ):
            candidate.public_id = allocate_public_id()
            normalized = True
        full_name = (
            candidate.full_name if candidate and candidate.full_name else app.full_name
        )
        email = candidate.email if candidate and candidate.email else app.email
        phone = candidate.phone if candidate and candidate.phone else app.phone
        lock_info = submission_locks.get(app.candidate_id)
        lock_owner_id = lock_info.recruiter_id if lock_info else app.recruiter_id
        effective_owner_id = str(app.recruiter_id or "").strip()
        if (
            not effective_owner_id
            and lock_info
            and lock_info.is_locked
            and not _submission_is_released(lock_info)
        ):
            effective_owner_id = str(lock_info.recruiter_id or "").strip()
        if effective_owner_id and effective_owner_id != current_recruiter_id:
            continue
        lock_owner_name = _get_user_display_name(db, lock_owner_id) if lock_owner_id else None
        locked_for_me = bool(
            lock_info
            and lock_info.is_locked
            and lock_owner_id
            and str(lock_owner_id) != current_recruiter_id
            and not _submission_is_released(lock_info)
        )
        lock_status_label = (
            f"In Progress by Recruiter {lock_owner_name}"
            if lock_owner_name and lock_info and lock_info.is_locked and not _submission_is_released(lock_info)
            else None
        )
        assignment_label = (
            f"Assigned to Recruiter {lock_owner_name} for Job ID {job.job_id or job.id}"
            if lock_owner_name and lock_info and lock_info.is_locked and not _submission_is_released(lock_info)
            else None
        )

        result.append(
            {
                "application_id": app.id,
                "full_name": full_name,
                "public_id": candidate.public_id if candidate else None,
                "candidate_id": app.candidate_id,
                "email": email,
                "phone": phone,
                "status": app.status,
                "sent_to_am_at": app.sent_to_am_at,
                "sent_to_client_at": app.sent_to_client_at,
                "job_id": app.job_id,
                "job_title": job.title if job else None,
                "recruiter_id": app.recruiter_id,
                "assigned_recruiter_id": app.recruiter_id,
                "is_assigned_recruiter": bool(
                    app.recruiter_id and str(app.recruiter_id) == current_recruiter_id
                ),
                "locked_by_recruiter_id": lock_owner_id,
                "locked_by_recruiter_name": lock_owner_name,
                "is_locked_for_current_recruiter": locked_for_me,
                "is_locked": bool(lock_info.is_locked) if lock_info else False,
                "lock_status_label": lock_status_label,
                "assignment_label": assignment_label,
                "interview_scheduling_ready": bool(app.interview_scheduling_ready),
                "interview_scheduling_note": app.interview_scheduling_note,
                "interview_scheduling_ready_at": app.interview_scheduling_ready_at.isoformat() if app.interview_scheduling_ready_at else None,
            }
        )

    if normalized:
        db.commit()

    return {
        "candidates": result
    }



# ------------------------------------------------------------------
# 3️⃣ SUBMIT CANDIDATE TO JOB
# ------------------------------------------------------------------
@router.post("/jobs/{job_id}/submit")
def submit_candidate(
    job_id: str,
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    job = db.query(models.Job).filter(
    (models.Job.id == job_id) |
    (models.Job.job_id == job_id)
).first()
    _ensure_recruiter_has_job_access(db, current_user, job)

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    matches, reason = _candidate_matches_job(candidate, job)
    if not matches:
        raise HTTPException(400, reason)

    _assert_candidate_lock_owner(
        db,
        candidate_id=candidate_id,
        job=job,
        recruiter_id=current_user["id"],
        action="submit_to_job",
    )

    # Prevent duplicate submission
    existing = db.query(models.JobApplication).filter(
        models.JobApplication.job_id == job.id,   # ✅ correct
        models.JobApplication.candidate_id == candidate_id
    ).first()

    if existing:
        raise HTTPException(400, "Candidate already submitted for this job")

    app = models.JobApplication(
        job_id=job.id,
        candidate_id=candidate_id,
        full_name=candidate.full_name,
        phone=candidate.phone,
        email=candidate.email,
        status="sent_to_am",
        applied_at=datetime.utcnow(),
        sent_to_am_at=datetime.utcnow(),
        recruiter_id=current_user["id"],   # ⭐⭐ ADD THIS (MOST IMPORTANT)
    )

    db.add(app)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Candidate already submitted for this job")
    db.refresh(app)
    _log_candidate_audit(
        db,
        actor_id=current_user["id"],
        action="RECRUITER_SUBMITTED_TO_AM",
        candidate_id=candidate_id,
        old_state="open",
        new_state="sent_to_am",
        details={"job_id": job.job_id or job.id},
    )
    db.commit()

    return {
        "message": "Candidate submitted successfully",
        "application_id": app.id
    }


# ------------------------------------------------------------------
# 4️⃣ SHORTLIST CANDIDATE FOR ACCOUNT MANAGER REVIEW
# ------------------------------------------------------------------
@router.post("/applications/{application_id}/shortlist")
def shortlist_candidate_for_am(
    application_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    app = db.query(models.JobApplication).filter(
        models.JobApplication.id == application_id
    ).first()

    if not app:
        raise HTTPException(404, "Application not found")
    job = db.query(models.Job).filter(models.Job.id == app.job_id).first()
    _ensure_recruiter_has_job_access(db, current_user, job)
    _assert_candidate_lock_owner(
        db,
        candidate_id=app.candidate_id,
        job=job,
        recruiter_id=current_user["id"],
        action="shortlist_for_am",
    )
    if app.recruiter_id and str(app.recruiter_id) != str(current_user["id"]):
        raise HTTPException(409, "Only the assigned recruiter can shortlist this candidate")
    app.recruiter_id = current_user["id"]

    app.status = "interview"

    app.shortlisted_at = datetime.utcnow()

    db.commit()
    db.refresh(app)
    _log_candidate_audit(
        db,
        actor_id=current_user["id"],
        action="RECRUITER_SHORTLISTED",
        candidate_id=app.candidate_id,
        old_state="submitted",
        new_state=app.status,
        details={"job_id": job.job_id or job.id, "application_id": app.id},
    )
    db.commit()

    return {
        "message": "Candidate shortlisted for Account Manager review",
        "application_id": app.id,
        "status": app.status
    }


# ------------------------------------------------------------------
# 1.5️⃣  GET SINGLE JOB DETAILS (Recruiter View)
# ------------------------------------------------------------------
@router.get("/jobs/{job_id}")
def get_job_detail(
    job_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    job = (
    db.query(models.Job)
    .options(joinedload(models.Job.account_manager))
    .filter(models.Job.id == job_id)
    .first()
)


    if not job:
        raise HTTPException(404, "Job not found")
    _ensure_recruiter_has_job_access(db, current_user, job)

    return {
        "id": job.id,
        "job_id": job.job_id,
        "title": job.title,
        "location": job.location,
        "department": job.department,
        "status": job.status,
        "requirement_id": job.requirement.id if job.requirement else None,
        "experience": f"{job.min_experience} - {job.max_experience} yrs" if job.min_experience else None,
        "skills": job.skills if isinstance(job.skills, list) else [job.skills] if job.skills else [],
        "created_at": job.created_at,
        "account_manager": {
            "id": job.account_manager.id if job.account_manager else None,
            "name": job.account_manager.full_name if job.account_manager else "—",
            "email": job.account_manager.email if job.account_manager else None,
        }
    }


@router.get("/dashboard")
def recruiter_dashboard(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    recruiter_id = current_user["id"]

    # Assigned Jobs
    assigned_jobs = (
        db.query(models.Job)
        .join(models.job_recruiters)
        .filter(models.job_recruiters.c.recruiter_id == recruiter_id)
        .count()
    )

    # Total Candidates recruiter ne submit kiye
    total_candidates = (
    db.query(models.JobApplication)
    .filter(models.JobApplication.created_by == recruiter_id)
    .count()
)



    # 👇 Yahi change hai — shortlisted nahi, interview count
    interviews = (
        db.query(models.JobApplication)
        .filter(
            models.JobApplication.created_by == recruiter_id,
            models.JobApplication.status == "interview"
        )
        .count()
    )

    # Active Pipelines (jobs jisme candidates hain)
    active_pipelines = (
        db.query(models.JobApplication.job_id)
        .filter(models.JobApplication.created_by == recruiter_id)
        .distinct()
        .count()
    )

    return {
        "assigned_jobs": assigned_jobs,
        "total_candidates": total_candidates,
        "interviews": interviews,
        "active_pipelines": active_pipelines
    }


# ------------------------------------------------------------------
# 5️⃣ SEND CANDIDATE TO ACCOUNT MANAGER
# ------------------------------------------------------------------
@router.post("/applications/{application_id}/send-to-am")
def send_candidate_to_am(
    application_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    app = db.query(models.JobApplication).filter(
        models.JobApplication.id == application_id
    ).first()

    if not app:
        raise HTTPException(404, "Application not found")
    job = db.query(models.Job).filter(models.Job.id == app.job_id).first()
    _ensure_recruiter_has_job_access(db, current_user, job)
    _assert_candidate_lock_owner(
        db,
        candidate_id=app.candidate_id,
        job=job,
        recruiter_id=current_user["id"],
        action="send_to_am",
    )
    if app.recruiter_id and str(app.recruiter_id) != str(current_user["id"]):
        raise HTTPException(409, "Only the assigned recruiter can send this candidate to AM")
    app.recruiter_id = current_user["id"]

    app.status = "sent_to_am"

    if not app.sent_to_am_at:
        app.sent_to_am_at = datetime.utcnow()



    db.commit()
    db.refresh(app)
    _log_candidate_audit(
        db,
        actor_id=current_user["id"],
        action="RECRUITER_SENT_TO_AM",
        candidate_id=app.candidate_id,
        old_state="in_review",
        new_state=app.status,
        details={"job_id": job.job_id or job.id, "application_id": app.id},
    )
    db.commit()

    return {
        "message": "Candidate sent to AM",
        "status": app.status
    }

@router.post("/jobs/{job_id}/submissions")
def submit_candidate_directly_to_am(
    job_id: str,
    payload: JobSubmissionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 1. Resolve job (UUID or public job_id)
    job = db.query(models.Job).filter(
        (models.Job.id == job_id) |
        (models.Job.job_id == job_id)
    ).first()
    _ensure_recruiter_has_job_access(db, current_user, job)

    # 2. Candidate
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == payload.candidate_id
    ).first()

    if not candidate:
        raise HTTPException(404, "Candidate not found")
    matches, reason = _candidate_matches_job(candidate, job)
    if not matches:
        raise HTTPException(400, reason)

    _assert_candidate_lock_owner(
        db,
        candidate_id=candidate.id,
        job=job,
        recruiter_id=current_user["id"],
        action="submit_direct_to_am",
    )

    # 3. Prevent duplicate
    existing = db.query(models.JobApplication).filter(
        models.JobApplication.job_id == job.id,
        models.JobApplication.candidate_id == candidate.id
    ).first()

    if existing:
        raise HTTPException(400, "Candidate already submitted")

    # 4. Create JobApplication → DIRECTLY sent to AM
    app = models.JobApplication(
        job_id=job.id,
        candidate_id=candidate.id,
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        status="sent_to_am",
        sent_to_am_at=datetime.utcnow(),
        recruiter_id=current_user["id"],
        applied_at=datetime.utcnow()
    )

    db.add(app)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Candidate already submitted")
    db.refresh(app)
    _log_candidate_audit(
        db,
        actor_id=current_user["id"],
        action="RECRUITER_SUBMITTED_TO_AM",
        candidate_id=candidate.id,
        old_state="open",
        new_state="sent_to_am",
        details={"job_id": job.job_id or job.id},
    )
    db.commit()

    return {
        "message": "Candidate sent to Account Manager",
        "application_id": app.id,
        "status": app.status
    }


# ============================================================
# CALL FEEDBACK ENDPOINTS
# ============================================================

CALL_FEEDBACK_DECISION_STATUS_MAP = {
    "Send to AM": "sent_to_am",
    "Hold / Revisit Later": "hold_revisit",
    "Reject": "rejected_by_recruiter",
    "Needs Another Call": "called",
}


def _resolve_feedback_job(db: Session, job_ref: str):
    """Resolve job using UUID or public job_id."""
    if not job_ref:
        return None
    return db.query(models.Job).filter(
        (models.Job.id == job_ref) | (models.Job.job_id == job_ref)
    ).first()


def _build_feedback_audit_details(selected_job: models.Job, payload_job_id: str, feedback_id: str):
    resolved_job_ref = None
    if selected_job:
        resolved_job_ref = selected_job.job_id or selected_job.id
    elif payload_job_id:
        resolved_job_ref = payload_job_id

    return {
        "job_id": resolved_job_ref,
        "job_uuid": (selected_job.id if selected_job else None),
        "job_title": (selected_job.title if selected_job else None),
        "feedback_id": feedback_id,
    }


def _sync_job_application_from_feedback(
    db: Session,
    candidate: models.Candidate,
    recruiter_id: str,
    status: str,
    job: models.Job = None,
):
    """Keep JobApplication status in sync with feedback decision for the selected job."""
    if not job:
        return None

    app = db.query(models.JobApplication).filter(
        models.JobApplication.job_id == job.id,
        models.JobApplication.candidate_id == candidate.id,
    ).first()

    now = datetime.utcnow()

    if not app:
        app = models.JobApplication(
            job_id=job.id,
            candidate_id=candidate.id,
            full_name=candidate.full_name,
            email=candidate.email,
            phone=candidate.phone,
            status=status,
            recruiter_id=recruiter_id,
            applied_at=now,
            sent_to_am_at=now if status == "sent_to_am" else None,
        )
        db.add(app)
    else:
        if app.recruiter_id and str(app.recruiter_id) != str(recruiter_id):
            raise HTTPException(
                status_code=409,
                detail="Candidate is assigned to another recruiter for this job",
            )
        app.full_name = candidate.full_name or app.full_name
        app.email = candidate.email or app.email
        app.phone = candidate.phone or app.phone
        app.status = status
        if recruiter_id:
            app.recruiter_id = recruiter_id
        if not app.applied_at:
            app.applied_at = now
        if status == "sent_to_am" and not app.sent_to_am_at:
            app.sent_to_am_at = now

    return app


def _log_feedback_timeline(
    db: Session,
    candidate_id: str,
    user_id: str,
    status: str,
    decision: str,
    job: models.Job = None,
):
    """Record feedback decision in candidate timeline for status traceability."""
    note = f"Call feedback decision: {decision}"
    if job:
        job_label = job.title or job.job_id or job.id
        note = f"{note} for {job_label}"

    timeline = models.CandidateTimeline(
        candidate_id=candidate_id,
        status=status,
        note=note,
        user_id=user_id,
    )
    db.add(timeline)


def _apply_feedback_decision(
    db: Session,
    candidate: models.Candidate,
    decision: str,
    recruiter_id: str,
    actor_id: str,
    job: models.Job = None,
):
    """Apply candidate + submission status updates from feedback decision."""
    new_status = CALL_FEEDBACK_DECISION_STATUS_MAP.get(decision)
    if not new_status:
        return None, None

    candidate.status = new_status
    candidate.updated_at = datetime.utcnow()

    app = _sync_job_application_from_feedback(
        db=db,
        candidate=candidate,
        recruiter_id=recruiter_id,
        status=new_status,
        job=job,
    )
    _log_feedback_timeline(
        db=db,
        candidate_id=candidate.id,
        user_id=actor_id,
        status=new_status,
        decision=decision,
        job=job,
    )
    return new_status, app

# ------------------------------------------------------------------
# ✏️ CREATE CALL FEEDBACK
# ------------------------------------------------------------------
@router.post("/call-feedback")
def create_call_feedback(
    payload: CallFeedbackCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create a new call feedback entry for a candidate"""
    
    # Validate candidate exists
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == payload.candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    # Validate decision - Updated options for recruiter
    valid_decisions = list(CALL_FEEDBACK_DECISION_STATUS_MAP.keys())
    if payload.decision not in valid_decisions:
        raise HTTPException(400, f"Invalid decision. Must be one of: {valid_decisions}")
    
    # If decision is Reject, rejection_reason is required
    if payload.decision == "Reject" and not payload.rejection_reason:
        raise HTTPException(400, "Rejection reason is required when decision is 'Reject'")
    
    # Validate ratings
    required_ratings = ["communication", "technical_fit", "experience_relevance", "culture_fit"]
    if not all(rating in payload.ratings for rating in required_ratings):
        raise HTTPException(400, f"All ratings required: {required_ratings}")

    selected_job = None
    if payload.job_id:
        selected_job = _resolve_feedback_job(db, payload.job_id)
        if not selected_job:
            raise HTTPException(400, "Selected job/requirement was not found")
    else:
        raise HTTPException(400, "job_id is required for recruiter feedback actions")

    if selected_job:
        _ensure_recruiter_has_job_access(db, current_user, selected_job)
        _assert_candidate_lock_owner(
            db,
            candidate_id=payload.candidate_id,
            job=selected_job,
            recruiter_id=current_user["id"],
            action="call_feedback",
        )
    
    # Create feedback entry
    feedback = models.CallFeedback(
        candidate_id=payload.candidate_id,
        recruiter_id=current_user["id"],
        call_type=payload.call_type,
        call_date=payload.call_date,
        call_duration=payload.call_duration,
        call_mode=payload.call_mode,
        ratings=payload.ratings,
        salary_alignment=payload.salary_alignment,
        strengths=payload.strengths,
        concerns=payload.concerns,
        additional_notes=payload.additional_notes,
        candidate_intent=payload.candidate_intent,
        decision=payload.decision,
        rejection_reason=payload.rejection_reason,
        next_actions=payload.next_actions,
        is_draft=payload.is_draft
    )
    
    db.add(feedback)
    
    # Update candidate status + linked submission status (only if not a draft)
    updated_status = None
    linked_application_id = None
    if not payload.is_draft:
        updated_status, linked_application = _apply_feedback_decision(
            db=db,
            candidate=candidate,
            decision=payload.decision,
            recruiter_id=current_user["id"],
            actor_id=current_user["id"],
            job=selected_job,
        )
        linked_application_id = linked_application.id if linked_application else None
    
    db.commit()
    db.refresh(feedback)
    _log_candidate_audit(
        db,
        actor_id=current_user["id"],
        action="RECRUITER_FEEDBACK_CREATED",
        candidate_id=feedback.candidate_id,
        old_state="feedback_pending",
        new_state=feedback.decision or "feedback_added",
        details=_build_feedback_audit_details(
            selected_job=selected_job,
            payload_job_id=payload.job_id,
            feedback_id=feedback.id,
        ),
    )
    db.commit()
    
    return {
        "id": feedback.id,
        "candidate_id": feedback.candidate_id,
        "recruiter_id": feedback.recruiter_id,
        "call_type": feedback.call_type,
        "call_date": feedback.call_date,
        "call_duration": feedback.call_duration,
        "call_mode": feedback.call_mode,
        "ratings": feedback.ratings,
        "salary_alignment": feedback.salary_alignment,
        "strengths": feedback.strengths,
        "concerns": feedback.concerns,
        "additional_notes": feedback.additional_notes,
        "candidate_intent": feedback.candidate_intent,
        "decision": feedback.decision,
        "rejection_reason": feedback.rejection_reason,
        "next_actions": feedback.next_actions,
        "job_id": selected_job.id if selected_job else payload.job_id,
        "candidate_status": updated_status,
        "application_id": linked_application_id,
        "is_draft": feedback.is_draft,
        "created_at": feedback.created_at,
        "updated_at": feedback.updated_at,
        "message": "Call feedback created successfully"
    }


# ------------------------------------------------------------------
# 📋 GET ALL CALL FEEDBACK FOR A CANDIDATE
# ------------------------------------------------------------------
@router.get("/candidates/{candidate_id}/call-feedback")
def get_candidate_call_feedback(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get all call feedback entries for a candidate"""
    
    # Validate candidate exists
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    feedbacks = db.query(models.CallFeedback).filter(
        models.CallFeedback.candidate_id == candidate_id
    ).order_by(models.CallFeedback.created_at.desc()).all()
    
    return {
        "candidate_id": candidate_id,
        "feedbacks": [
            {
                "id": fb.id,
                "candidate_id": fb.candidate_id,
                "recruiter_id": fb.recruiter_id,
                "call_type": fb.call_type,
                "call_date": fb.call_date,
                "call_duration": fb.call_duration,
                "call_mode": fb.call_mode,
                "ratings": fb.ratings,
                "salary_alignment": fb.salary_alignment,
                "strengths": fb.strengths,
                "concerns": fb.concerns,
                "additional_notes": fb.additional_notes,
                "candidate_intent": fb.candidate_intent,
                "decision": fb.decision,
                "rejection_reason": fb.rejection_reason,
                "next_actions": fb.next_actions,
                "is_draft": fb.is_draft,
                "created_at": fb.created_at,
                "updated_at": fb.updated_at,
            }
            for fb in feedbacks
        ]
    }


# ------------------------------------------------------------------
# 📖 GET SINGLE CALL FEEDBACK
# ------------------------------------------------------------------
@router.get("/call-feedback/{feedback_id}")
def get_call_feedback(
    feedback_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get a specific call feedback entry"""
    
    feedback = db.query(models.CallFeedback).filter(
        models.CallFeedback.id == feedback_id
    ).first()
    
    if not feedback:
        raise HTTPException(404, "Call feedback not found")
    
    return {
        "id": feedback.id,
        "candidate_id": feedback.candidate_id,
        "recruiter_id": feedback.recruiter_id,
        "call_type": feedback.call_type,
        "call_date": feedback.call_date,
        "call_duration": feedback.call_duration,
        "call_mode": feedback.call_mode,
        "ratings": feedback.ratings,
        "salary_alignment": feedback.salary_alignment,
        "strengths": feedback.strengths,
        "concerns": feedback.concerns,
        "additional_notes": feedback.additional_notes,
        "candidate_intent": feedback.candidate_intent,
        "decision": feedback.decision,
        "rejection_reason": feedback.rejection_reason,
        "next_actions": feedback.next_actions,
        "is_draft": feedback.is_draft,
        "created_at": feedback.created_at,
        "updated_at": feedback.updated_at,
    }


# ------------------------------------------------------------------
# ✏️ UPDATE CALL FEEDBACK
# ------------------------------------------------------------------
@router.put("/call-feedback/{feedback_id}")
def update_call_feedback(
    feedback_id: str,
    payload: CallFeedbackUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Update an existing call feedback entry"""
    
    feedback = db.query(models.CallFeedback).filter(
        models.CallFeedback.id == feedback_id
    ).first()
    
    if not feedback:
        raise HTTPException(404, "Call feedback not found")
    if str(feedback.recruiter_id) != str(current_user.get("id")):
        raise HTTPException(403, "Only the owner recruiter can edit this feedback")

    previous_decision = feedback.decision
    previous_is_draft = feedback.is_draft
    
    # Validate decision if provided
    if payload.decision:
        valid_decisions = list(CALL_FEEDBACK_DECISION_STATUS_MAP.keys())
        if payload.decision not in valid_decisions:
            raise HTTPException(400, f"Invalid decision. Must be one of: {valid_decisions}")

        # If decision is Reject, rejection_reason is required
        if payload.decision == "Reject" and not payload.rejection_reason:
            raise HTTPException(400, "Rejection reason is required when decision is 'Reject'")

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == feedback.candidate_id
    ).first()
    if not candidate:
        raise HTTPException(404, "Candidate not found for this feedback")

    selected_job = None
    if payload.job_id:
        selected_job = _resolve_feedback_job(db, payload.job_id)
        if not selected_job:
            raise HTTPException(400, "Selected job/requirement was not found")
    else:
        latest_app = db.query(models.JobApplication).filter(
            models.JobApplication.candidate_id == feedback.candidate_id,
            models.JobApplication.recruiter_id == feedback.recruiter_id,
        ).order_by(models.JobApplication.applied_at.desc()).first()
        if latest_app and latest_app.job_id:
            selected_job = db.query(models.Job).filter(
                models.Job.id == latest_app.job_id
            ).first()

    if selected_job:
        _ensure_recruiter_has_job_access(db, current_user, selected_job)
        _assert_candidate_lock_owner(
            db,
            candidate_id=feedback.candidate_id,
            job=selected_job,
            recruiter_id=current_user["id"],
            action="update_call_feedback",
        )
    
    # Update fields
    if payload.call_type:
        feedback.call_type = payload.call_type
    if payload.call_date:
        feedback.call_date = payload.call_date
    if payload.call_duration is not None:
        feedback.call_duration = payload.call_duration
    if payload.call_mode:
        feedback.call_mode = payload.call_mode
    if payload.ratings:
        feedback.ratings = payload.ratings
    if payload.salary_alignment:
        feedback.salary_alignment = payload.salary_alignment
    if payload.strengths is not None:
        feedback.strengths = payload.strengths
    if payload.concerns is not None:
        feedback.concerns = payload.concerns
    if payload.additional_notes is not None:
        feedback.additional_notes = payload.additional_notes
    if payload.candidate_intent is not None:
        feedback.candidate_intent = payload.candidate_intent
    if payload.decision:
        feedback.decision = payload.decision
    if payload.rejection_reason is not None:
        feedback.rejection_reason = payload.rejection_reason
    if payload.next_actions is not None:
        feedback.next_actions = payload.next_actions
    if payload.is_draft is not None:
        feedback.is_draft = payload.is_draft

    final_decision = payload.decision if payload.decision is not None else feedback.decision
    final_is_draft = payload.is_draft if payload.is_draft is not None else feedback.is_draft

    should_apply_status_update = (not final_is_draft) and (
        (previous_is_draft and not final_is_draft) or
        (payload.decision is not None and payload.decision != previous_decision)
    )

    if should_apply_status_update and final_decision == "Send to AM" and not selected_job:
        raise HTTPException(400, "Job selection is required when decision is 'Send to AM'")

    updated_status = None
    linked_application_id = None
    if should_apply_status_update:
        updated_status, linked_application = _apply_feedback_decision(
            db=db,
            candidate=candidate,
            decision=final_decision,
            recruiter_id=feedback.recruiter_id or current_user["id"],
            actor_id=current_user["id"],
            job=selected_job,
        )
        linked_application_id = linked_application.id if linked_application else None

    feedback.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(feedback)
    _log_candidate_audit(
        db,
        actor_id=current_user["id"],
        action="RECRUITER_FEEDBACK_UPDATED",
        candidate_id=feedback.candidate_id,
        old_state=previous_decision or "unknown",
        new_state=feedback.decision or "updated",
        details=_build_feedback_audit_details(
            selected_job=selected_job,
            payload_job_id=payload.job_id,
            feedback_id=feedback.id,
        ),
    )
    db.commit()
    
    return {
        "id": feedback.id,
        "candidate_id": feedback.candidate_id,
        "recruiter_id": feedback.recruiter_id,
        "call_type": feedback.call_type,
        "call_date": feedback.call_date,
        "call_duration": feedback.call_duration,
        "call_mode": feedback.call_mode,
        "ratings": feedback.ratings,
        "salary_alignment": feedback.salary_alignment,
        "strengths": feedback.strengths,
        "concerns": feedback.concerns,
        "additional_notes": feedback.additional_notes,
        "candidate_intent": feedback.candidate_intent,
        "decision": feedback.decision,
        "rejection_reason": feedback.rejection_reason,
        "next_actions": feedback.next_actions,
        "job_id": selected_job.id if selected_job else payload.job_id,
        "candidate_status": updated_status,
        "application_id": linked_application_id,
        "is_draft": feedback.is_draft,
        "created_at": feedback.created_at,
        "updated_at": feedback.updated_at,
        "message": "Call feedback updated successfully"
    }


# ------------------------------------------------------------------
# 🗑️ DELETE CALL FEEDBACK
# ------------------------------------------------------------------
@router.delete("/call-feedback/{feedback_id}")
def delete_call_feedback(
    feedback_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Delete a call feedback entry"""
    
    feedback = db.query(models.CallFeedback).filter(
        models.CallFeedback.id == feedback_id
    ).first()
    
    if not feedback:
        raise HTTPException(404, "Call feedback not found")
    if str(feedback.recruiter_id) != str(current_user.get("id")):
        raise HTTPException(403, "Only the owner recruiter can delete this feedback")
    
    candidate_id = feedback.candidate_id
    db.delete(feedback)
    db.commit()
    _log_candidate_audit(
        db,
        actor_id=current_user["id"],
        action="RECRUITER_FEEDBACK_DELETED",
        candidate_id=candidate_id,
        old_state="feedback_exists",
        new_state="feedback_deleted",
        details={"feedback_id": feedback_id},
    )
    db.commit()
    
    return {"message": "Call feedback deleted successfully"}


# app/routes/candidate_portal.py

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone, timedelta
from typing import List  
import uuid
import os

from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from app.ai_core import parse_resume, generate_candidate_embedding
from app.resume_parser.text_extractor import extract_text_from_file, clean_extracted_text
from app.models import Notification
from app.schemas import NotificationResponse
from app.services.activity_service import ActivityService
from app.validators import (
    validate_location,
    validate_pincode,
    validate_skills,
)
import re

router = APIRouter(prefix="/v1/candidate", tags=["Candidate Portal"])

UPLOAD_DIR = "uploads/resumes"
PHOTO_UPLOAD_DIR = "uploads/candidates/photos"
def as_upload_url(path: str) -> str:
    return "/" + str(path or "").replace("\\", "/").lstrip("/")

def is_valid_indian_phone(phone: str) -> bool:
    if not phone:
        return False
    phone = phone.replace(" ", "")
    return bool(re.match(r"^(\+91)?[6-9]\d{9}$", phone))

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PHOTO_UPLOAD_DIR, exist_ok=True)


def calculate_profile_completion(cand: models.Candidate) -> int:
    print("🔥 FRACTIONAL PROFILE COMPLETION LOGIC ACTIVE 🔥")

    def filled(v):
        if isinstance(v, list):
            return len(v) > 0
        return v is not None and str(v).strip() != ""

    # -------- BASIC (25) --------
    basic_fields = [
        cand.full_name,
        cand.email,
        cand.phone,
        cand.current_location,
        cand.city,
        cand.pincode,
    ]
    basic_score = (sum(filled(f) for f in basic_fields) / 6) * 25

    # -------- PROFESSIONAL (25) --------
    professional_fields = [
        cand.skills,
        cand.education,
        cand.experience,
        cand.current_employer,
    ]
    professional_score = (sum(filled(f) for f in professional_fields) / 4) * 25

    # -------- OTHER DETAILS (25) --------
    other_fields = [
        cand.linkedin_url,
        cand.github_url,
        cand.portfolio_url,
        cand.languages_known,
    ]
    other_score = (sum(filled(f) for f in other_fields) / 4) * 25

    # -------- RESUME (25) --------
    resume_score = 25 if filled(cand.resume_url) else 0

    total = basic_score + professional_score + other_score + resume_score
    return round(total)


def create_notification(db, candidate_id, title, message=None, type="info"):
    from app.models import Notification

    notification = Notification(
        candidate_id=candidate_id,
        title=title,
        message=message,
        type=type
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification



# -----------------------------------------------------------
# UPLOAD RESUME + PARSE (NO DB UPDATE, NO PROFILE COMPLETE)
# -----------------------------------------------------------
@router.post("/resume/parse")
def parse_resume_only(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated as candidate")

    cand = db.query(models.Candidate).filter(
        models.Candidate.id == current["id"]
    ).first()

    if not cand:
        raise HTTPException(404, "Candidate not found")

    filename = f"{cand.id}_{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    public_resume_url = as_upload_url(filepath)

    file_bytes = file.file.read()
    with open(filepath, "wb") as f:
        f.write(file_bytes)

    # ---- TEXT EXTRACTION ----
    text = ""
    try:
        ext = os.path.splitext(file.filename or "")[1].lower()
        text = extract_text_from_file(filepath, ext)
    except Exception:
        text = ""
    if not text:
        try:
            text = file_bytes.decode("utf-8", "ignore")
        except Exception:
            text = file_bytes.decode("latin-1", "ignore")
    text = clean_extracted_text(text)

    parsed = parse_resume(text) or {}

    return {
        "message": "Resume parsed successfully",
        "resume_url": public_resume_url,
        "parsed": {
            "full_name": parsed.get("full_name"),
            "email": parsed.get("email"),
            "phone": parsed.get("phone"),
            "skills": parsed.get("skills", []),
            "education": parsed.get("education"),
            "experience_years": parsed.get("experience_years"),
            "current_location": parsed.get("current_location"),
            "linkedin_url": parsed.get("linkedin_url"),
            "github_url": parsed.get("github_url"),
            "portfolio_url": parsed.get("portfolio_url"),
        }
    }


# -----------------------------------------------------------
# GET CURRENT CANDIDATE PROFILE (RETURN public_id)
# -----------------------------------------------------------
@router.get("/me")
def get_my_profile(
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated as candidate")

    cand = db.query(models.Candidate).filter(
        models.Candidate.id == current["id"]
    ).first()

    if not cand:
        raise HTTPException(404, "Candidate not found")

    # Always compute to keep a single source of truth
    completion = calculate_profile_completion(cand)
    if cand.profile_completion != completion:
        cand.profile_completion = completion
        cand.profile_completed = completion >= 70
        db.commit()
        db.refresh(cand)

    data = schemas.CandidateResponse.model_validate(cand).model_dump()
    data["profile_strength_percentage"] = completion

    return {
        "message": "success",
        "data": data,
        "candidate_public_id": cand.public_id,
    }


  

# -----------------------------------------------------------
# UPDATE PROFILE (returns candidate_public_id)
# -----------------------------------------------------------
@router.put("/me")
def update_my_profile(
    payload: schemas.CandidateSelfProfileUpdate,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated as candidate")

    cand = db.query(models.Candidate).filter(
        models.Candidate.id == current["id"]
    ).first()

    if not cand:
        raise HTTPException(404, "Candidate not found")

    # ----------------------------
    # UPDATE FIELDS
    # ----------------------------
    data = payload.model_dump(exclude_unset=True)


    # ✅ LOCATION VALIDATION
    if "currentLocation" in data and data["currentLocation"]:
        is_valid, error = validate_location(data["currentLocation"], "Current Location")
        if not is_valid:
            raise HTTPException(status_code=400, detail=error)

    # ✅ CITY VALIDATION
    if "city" in data and data["city"]:
        is_valid, error = validate_location(data["city"], "City")
        if not is_valid:
            raise HTTPException(status_code=400, detail=error)

    # ✅ PINCODE VALIDATION
    if "pincode" in data and data["pincode"]:
        is_valid, error = validate_pincode(data["pincode"])
        if not is_valid:
            raise HTTPException(status_code=400, detail=error)

    # ✅ SKILLS VALIDATION
    # ✅ SKILLS VALIDATION (STRICT)
    if "skills" in data:
        if not isinstance(data["skills"], list):
            raise HTTPException(
                status_code=400,
                detail="Skills must be a list of strings"
            )
        is_valid, error = validate_skills(data["skills"])
        if not is_valid:
            raise HTTPException(status_code=400, detail=error)


    field_map = {
        # Basic fields - both camelCase and snake_case mappings
        "fullName": "full_name",
        "full_name": "full_name",
        "email": "email",
        "phone": "phone",
        "alternate_phone": "alternate_phone",
        "alternate_email": "alternate_email",
        "emergency_contact": "emergency_contact",
        "gender": "gender",
        "nationality": "nationality",
        "dob": "dob",
        "dateOfBirth": "dob",
        "currentLocation": "current_location",
        "current_location": "current_location",
        "city": "city",
        "pincode": "pincode",
        "currentAddress": "current_address",
        "current_address": "current_address",
        "permanentAddress": "permanent_address",
        "permanent_address": "permanent_address",
        "resumeUrl": "resume_url",
        "resume_url": "resume_url",

        # Professional fields
        "skills": "skills",
        "education": "education",
        "experience": "experience",
        "experience_years": "experience",
        "current_role": "current_role",
        "professional_headline": "professional_headline",
        "employment_status": "employment_status",
        "career_summary": "career_summary",
        "currentEmployer": "current_employer",
        "current_employer": "current_employer",
        "previousEmployers": "previous_employers",
        "previous_employers": "previous_employers",
        "noticePeriod": "notice_period",
        "notice_period": "notice_period",

        # Salary & compensation
        "current_ctc": "current_ctc",
        "expected_salary": "expected_salary",
        "expectedCtc": "expected_ctc",
        "minimum_ctc": "minimum_ctc",
        "salary_negotiable": "salary_negotiable",

        # Preferences
        "preferredLocation": "preferred_location",
        "preferred_location": "preferred_location",
        "ready_to_relocate": "ready_to_relocate",
        "preferred_work_mode": "preferred_work_mode",
        "availability_status": "availability_status",
        "travel_availability": "travel_availability",
        "work_authorization": "work_authorization",
        "requires_sponsorship": "requires_sponsorship",
        "available_from": "available_from",
        "time_zone": "time_zone",

        # Links & social
        "languagesKnown": "languages_known",
        "languages_known": "languages_known",
        "linkedinUrl": "linkedin_url",
        "linkedin_url": "linkedin_url",
        "githubUrl": "github_url",
        "github_url": "github_url",
        "portfolioUrl": "portfolio_url",
        "portfolio_url": "portfolio_url",

        # Education History, Projects, References
        "education_history": "education_history",
        "educationHistory": "education_history",
        "projects": "projects",
        "references": "references",
    }

    for key, value in data.items():
        mapped_key = field_map.get(key, key)
        if hasattr(cand, mapped_key):
            setattr(cand, mapped_key, value)

    # ----------------------------
    # ✅ UPDATE WORK HISTORY
    # ----------------------------
    if "work_history" in data and data["work_history"] is not None:
        # Store as JSON or handle work history model if exists
        if hasattr(cand, 'work_history'):
            cand.work_history = data["work_history"]

    # ----------------------------
    # ✅ UPDATE CERTIFICATIONS
    # ----------------------------
    if "certifications" in data and data["certifications"] is not None:
        # Delete existing certifications
        db.query(models.Certification).filter(
            models.Certification.candidate_id == cand.id
        ).delete()
        
        # Add new certifications
        for cert_data in data["certifications"]:
            cert = models.Certification(
                candidate_id=cand.id,
                name=cert_data.get("name"),
                organization=cert_data.get("organization"),
                issue_date=cert_data.get("issue_date"),
                expiry_date=cert_data.get("expiry_date"),
                credential_id=cert_data.get("credential_id"),
                credential_url=cert_data.get("credential_url"),
            )
            db.add(cert)

    # ----------------------------
    # ✅ CALCULATE PROFILE COMPLETION (CORRECT PLACE)
    # ----------------------------
    completion = calculate_profile_completion(cand)
    cand.profile_completion = completion
    cand.profile_completed = completion >= 70
    
    db.commit()
    db.refresh(cand)

    data = schemas.CandidateResponse.model_validate(cand).model_dump()
    data["profile_strength_percentage"] = completion

    return {
        "message": "Profile updated",
        "profile_completion": completion,
        "profile_completed": cand.profile_completed,
        "data": data,
    }



# -----------------------------------------------------------
# UPLOAD RESUME + PARSE + VERSIONING
# -----------------------------------------------------------
# -----------------------------------------------------------
# UPLOAD RESUME (REPLACE / VERSION ONLY – NO PROFILE COMPLETE)
# -----------------------------------------------------------
@router.post("/resume")
def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated as candidate")

    cand = db.query(models.Candidate).filter(
        models.Candidate.id == current["id"]
    ).first()

    if not cand:
        raise HTTPException(404, "Candidate not found")

    version_id = str(uuid.uuid4())
    filename = f"{cand.id}_{version_id}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    public_resume_url = as_upload_url(filepath)

    file_bytes = file.file.read()
    with open(filepath, "wb") as f:
        f.write(file_bytes)

    text = ""
    try:
        ext = os.path.splitext(file.filename or "")[1].lower()
        text = extract_text_from_file(filepath, ext)
    except Exception:
        text = ""
    if not text:
        try:
            text = file_bytes.decode("utf-8", "ignore")
        except Exception:
            text = file_bytes.decode("latin-1", "ignore")
    text = clean_extracted_text(text)

    parsed = parse_resume(text) or {}

    # ---- VERSIONING ONLY ----
    history = cand.resume_versions or []
    history.append({
        "version_id": version_id,
        "url": public_resume_url,
        "uploaded_at": datetime.utcnow().isoformat(),
    })

    cand.resume_versions = history
    cand.resume_url = public_resume_url
    cand.parsed_resume = parsed
    cand.last_resume_update = datetime.utcnow()

    completion = calculate_profile_completion(cand)
    cand.profile_completion = completion
    cand.profile_completed = completion >= 70

    db.commit()
    db.refresh(cand)

    return {
        "message": "Resume uploaded",
        "resume_url": public_resume_url,
        "candidate_public_id": cand.public_id,
        "profile_strength_percentage": completion,
    }


# -----------------------------------------------------------
# APPLY TO JOB (returns candidate_public_id)
# -----------------------------------------------------------
@router.post("/me/apply")
def apply_job_frontend(
    data: schemas.CandidateApplyRequest,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):

    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated as candidate")

    cand = db.query(models.Candidate).filter(
        models.Candidate.id == current["id"]
    ).first()

    if not cand:
        raise HTTPException(404, "Candidate not found")

# ✅ PHONE NUMBER VALIDATION (MANDATORY)
    if not cand.phone or not is_valid_indian_phone(cand.phone):
        raise HTTPException(
            status_code=400,
            detail="Please update a valid Indian phone number in your profile before applying"
        )

    job = db.query(models.Job).filter(models.Job.id == data.job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    exists = db.query(models.JobApplication).filter(
        models.JobApplication.candidate_id == cand.id,
        models.JobApplication.job_id == job.id,
    ).first()

    if exists:
        raise HTTPException(409, "Already applied to this job")


    app_id = str(uuid.uuid4())

    application = models.JobApplication(
        id=app_id,
        job_id=job.id,
        candidate_id=cand.id,
        full_name=cand.full_name,
        email=cand.email,
        phone=cand.phone,
        resume_url=cand.resume_url,
        parsed_resume=cand.parsed_resume,
        status="applied",
        applied_at=datetime.utcnow(),
        cover_letter_url=data.cover_letter,
        linkedin_url=data.linkedin_url,
        portfolio_url=data.portfolio_url,

    )

    db.add(application)
    db.commit()
    db.refresh(application)

    # Track candidate application activity
    activity_service = ActivityService(db)
    activity_service.track_candidate_applied(
        candidate_id=cand.id,
        job_id=job.id,
        application_id=application.id
    )

    create_notification(
    db,
    candidate_id=cand.id,
    title="Job Applied Successfully",
    message=f"You applied for {job.title}",
    type="application_submitted"
)



    return {
        "message": "Application submitted",
        "application_id": app_id,
        "candidate_public_id": cand.public_id
    }


# -----------------------------------------------------------
# BACKWARD COMPAT (/apply → /me/apply)
# -----------------------------------------------------------
@router.post("/apply")
def apply_job_alias(
    data: schemas.CandidateApplyRequest,
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    return apply_job_frontend(data, db, current)


# -----------------------------------------------------------
# LIST MY APPLICATIONS
# -----------------------------------------------------------
@router.get("/me/applications")
def list_my_applications(
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated as candidate")

    cand = db.query(models.Candidate).filter(
        models.Candidate.id == current["id"]
    ).first()

    if not cand:
        raise HTTPException(404, "Candidate not found")

    apps = (
        db.query(models.JobApplication)
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(models.JobApplication.candidate_id == cand.id)
        .order_by(models.JobApplication.applied_at.desc())
        .all()
    )

    applications = []
    for app in apps:
        applications.append({
            "application_id": app.id,
            "job_id": app.job.job_id if app.job else None,   # ✅ FIX HERE
            "job_title": app.job.title if app.job else None,
            "company_name": app.job.company_name if app.job else None,
            "status": app.status,
            "applied_at": app.applied_at,
            "resume_url": app.resume_url,
            "linkedin_url": app.linkedin_url,
            "portfolio_url": app.portfolio_url,
            "screening_score": getattr(app, "screening_score", None),

        })

    return {
        "message": "success",
        "candidate_public_id": cand.public_id,
        "applications": applications
    }

@router.get("/me/notifications")
def get_my_notifications(
    db: Session = Depends(get_db),
    current = Depends(get_current_user)
):
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated")

    candidate = (
        db.query(models.Candidate)
        .filter(models.Candidate.id == current["id"])
        .first()
    )

    if not candidate:
        return []

    notifications = (
        db.query(Notification)
        .filter(Notification.candidate_id == candidate.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "read": n.read,
            "created_at": n.created_at
        }
        for n in notifications
    ]



@router.put("/me/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current=Depends(get_current_user)
):
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated")

    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.candidate_id == current["id"]
        )
        .first()
    )

    if not notification:
        raise HTTPException(404, "Notification not found")

    notification.read = True
    db.commit()
    return {"message": "Notification marked as read"}


# -----------------------------------------------------------
# MY INTERVIEWS (Candidate Portal)
# -----------------------------------------------------------
@router.get("/my-interviews")
def get_my_interviews(
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated as candidate")

    cand = (
        db.query(models.Candidate)
        .filter(models.Candidate.id == current["id"])
        .first()
    )

    if not cand:
        raise HTTPException(404, "Candidate not found")

    interviews = (
        db.query(models.Interview)
        .join(
            models.CandidateSubmission,
            models.Interview.submission_id == models.CandidateSubmission.id,
        )
        .options(
            joinedload(models.Interview.submission).joinedload(models.CandidateSubmission.job),
            joinedload(models.Interview.submission).joinedload(models.CandidateSubmission.recruiter),
        )
        .filter(models.CandidateSubmission.candidate_id == cand.id)
        .order_by(models.Interview.scheduled_at.desc())
        .all()
    )

    results = []
    for iv in interviews:
        submission = iv.submission
        job = submission.job if submission else None
        recruiter = submission.recruiter if submission else None
        duration_seconds = iv.duration_seconds if iv.duration_seconds else 3600

        results.append(
            {
                "id": iv.id,
                "interview_id": iv.id,
                "job_title": job.title if job else None,
                "company": job.company_name if job else None,
                "type": iv.mode,
                "scheduled_at": iv.scheduled_at,
                "duration": int(duration_seconds / 60),
                "duration_seconds": duration_seconds,
                "status": iv.status,
                "join_link": iv.meeting_link,
                "location": iv.location,
                "instructions": iv.notes,
                "job_description": job.description if job else None,
                "recruiter_name": recruiter.full_name if recruiter and recruiter.full_name else (recruiter.email if recruiter else None),
            }
        )

    return {"interviews": results}


# -----------------------------------------------------------
# DASHBOARD SUMMARY (Candidate Portal)
# -----------------------------------------------------------
@router.get("/dashboard-summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated as candidate")

    cand = (
        db.query(models.Candidate)
        .filter(models.Candidate.id == current["id"])
        .first()
    )

    if not cand:
        raise HTTPException(404, "Candidate not found")

    profile_completion = calculate_profile_completion(cand)

    total_applications = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.candidate_id == cand.id)
        .count()
    )

    new_jobs = (
        db.query(models.Job)
        .filter(models.Job.is_active == True)
        .filter(models.Job.status == "active")
        .count()
    )

    interviews = (
        db.query(models.Interview)
        .join(
            models.CandidateSubmission,
            models.Interview.submission_id == models.CandidateSubmission.id,
        )
        .filter(models.CandidateSubmission.candidate_id == cand.id)
        .order_by(models.Interview.scheduled_at.asc())
        .all()
    )

    now = datetime.now(timezone.utc)
    next_interview_date = None
    next_interview_status = "No Interview Scheduled"

    def _normalize_time(value: datetime | None):
        if not value:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    in_progress = None
    upcoming = None
    completed = None

    for iv in interviews:
        scheduled_at = _normalize_time(iv.scheduled_at)
        duration_seconds = iv.duration_seconds if iv.duration_seconds else 3600
        if scheduled_at:
            end_time = scheduled_at + timedelta(seconds=duration_seconds)
            if scheduled_at <= now <= end_time:
                in_progress = iv
            elif now < scheduled_at:
                if not upcoming or scheduled_at < _normalize_time(upcoming.scheduled_at):
                    upcoming = iv
            elif iv.status in {"completed", "selected", "rejected"}:
                completed = iv
        elif iv.status in {"completed", "selected", "rejected"}:
            completed = iv

    if in_progress:
        next_interview_status = "Interview In Progress"
        next_interview_date = in_progress.scheduled_at
    elif upcoming:
        next_interview_status = "Upcoming Interview"
        next_interview_date = upcoming.scheduled_at
    elif completed:
        next_interview_status = "Interview Completed"
        next_interview_date = completed.scheduled_at

    return {
        "profile_completion": profile_completion,
        "total_applications": total_applications,
        "new_jobs": new_jobs,
        "next_interview_date": next_interview_date,
        "next_interview_status": next_interview_status,
    }


# ============================================================
# UPLOAD PROFILE PHOTO
# ============================================================
@router.post("/me/photo")
def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current=Depends(get_current_user),
):
    """Upload candidate profile photo"""
    if not current or current.get("type") != "candidate":
        raise HTTPException(401, "Not authenticated as candidate")

    cand = db.query(models.Candidate).filter(
        models.Candidate.id == current["id"]
    ).first()

    if not cand:
        raise HTTPException(404, "Candidate not found")

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/jpg"}
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Only JPEG and PNG images are allowed")

    # Validate file size (max 5MB)
    file_content = file.file.read()
    if len(file_content) > 5 * 1024 * 1024:
        raise HTTPException(400, "File size must be less than 5MB")

    try:
        # Generate unique filename
        filename = f"{cand.id}_{uuid.uuid4()}.{file.filename.split('.')[-1]}"
        filepath = os.path.join(PHOTO_UPLOAD_DIR, filename)
        public_photo_url = as_upload_url(filepath)

        # Save file
        with open(filepath, "wb") as f:
            f.write(file_content)

        # Update candidate photo URL
        cand.photo_url = public_photo_url
        db.commit()

        return {
            "message": "Photo uploaded successfully",
            "photo_url": public_photo_url
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to upload photo: {str(e)}")

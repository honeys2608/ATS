# app/routes/jobs.py

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import re
from uuid import uuid4
import math
from sqlalchemy import or_, cast, String

from app.db import get_db
from app import models, schemas
from app.ai_core import generate_job_embedding
from app.auth import get_current_user
from app.services.activity_service import ActivityService
from sqlalchemy.exc import IntegrityError

router = APIRouter(
    prefix="/v1/jobs",
    tags=["Jobs"]
)


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


class ApplicationStatusUpdate(BaseModel):
    status: str


# ============================================================
# 📌 UTILITIES
# ============================================================
def get_org_code(db: Session):
    setting = (
        db.query(models.SystemSettings)
        .filter(
            models.SystemSettings.module_name == "organization",
            models.SystemSettings.setting_key == "organization_code"
        )
        .first()
    )
    if not setting or "code" not in setting.setting_value:
        return "ORG"
    return setting.setting_value["code"]


def generate_job_id(db: Session):
    org = get_org_code(db)
    last_job = (
        db.query(models.Job.job_id)
        .filter(models.Job.job_id.like(f"{org}-J-%"))
        .order_by(models.Job.job_id.desc())
        .first()
    )

    if last_job and last_job[0]:
        try:
            last_num = int(last_job[0].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1

    return f"{org}-J-{next_num:04d}"


# ============================================================
# 📌 JOB CREATE
# ============================================================
@router.post("", response_model=schemas.JobResponse, status_code=201)
def create_job(
    job_data: schemas.JobCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    job_id = generate_job_id(db)
    embedding = generate_job_embedding(job_data.dict())

    job = models.Job(
        job_id=job_id,
        title=job_data.title,
        description=job_data.description,
        skills=job_data.skills,
        min_experience=job_data.min_experience,
        max_experience=job_data.max_experience,
        location=job_data.location,
        department=job_data.department,
        company_name=job_data.company_name,
         # 🔥 NEW META FIELDS
        job_type=job_data.job_type,
        salary_range=job_data.salary_range,
        apply_by=job_data.apply_by,
        sla_days=job_data.sla_days,
        status="active",


        is_active=True,
        embedding_vector=embedding,
        created_by=user["id"],
        client_id=job_data.client_id
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    # Track job creation activity
    activity_service = ActivityService(db)
    activity_service.track_job_created(
        job_id=job.id,
        creator_id=user["id"],
        creator_role=user.get("role", "admin")
    )

    return job


# ============================================================
# 📌 LIST JOBS
@router.get("", response_model=schemas.JobListResponse)
def list_jobs(
    assigned_to: Optional[str] = None,
    public: bool = False,
    limit: int = Query(100, ge=1, le=200),
    page: Optional[int] = Query(None, ge=1),
    status: Optional[str] = None,
    q: Optional[str] = None,
    skill: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    from app.services.activity_service import format_relative_time

    query = db.query(models.Job)
    normalized_status = (status or "").strip().lower()

    if public:
        query = query.filter(models.Job.status == "active")
        query = query.filter(models.Job.is_active == True)
    else:
        if normalized_status and normalized_status != "all":
            query = query.filter(models.Job.status == normalized_status)
            if normalized_status != "closed":
                query = query.filter(models.Job.is_active == True)
        else:
            query = query.filter(models.Job.status == "active")
            query = query.filter(models.Job.is_active == True)

    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Job.title.ilike(pattern),
                models.Job.description.ilike(pattern),
                models.Job.department.ilike(pattern),
                models.Job.location.ilike(pattern),
            )
        )

    if skill:
        skill_pattern = f"%{skill.strip()}%"
        query = query.filter(cast(models.Job.skills, String).ilike(skill_pattern))

    total_records = 0

    if public:
        if page is None:
            jobs = query.order_by(models.Job.created_at.desc()).limit(limit).all()
            total_records = len(jobs)
        else:
            total_records = query.count()
            jobs = (
                query.order_by(models.Job.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
        print(f"DEBUG: Found {len(jobs)} active jobs for public listing")
    elif assigned_to == "me":
        all_jobs = query.order_by(models.Job.created_at.desc()).all()
        assigned_jobs = [
            j for j in all_jobs
            if any(r.id == current_user["id"] for r in j.recruiters)
        ]
        total_records = len(assigned_jobs)
        if page is None:
            jobs = assigned_jobs[:limit]
        else:
            start = (page - 1) * limit
            jobs = assigned_jobs[start:start + limit]
        print(f"DEBUG: Found {len(assigned_jobs)} jobs assigned to current user")
    else:
        if page is None:
            jobs = query.order_by(models.Job.created_at.desc()).limit(limit).all()
            total_records = len(jobs)
        else:
            total_records = query.count()
            jobs = (
                query.order_by(models.Job.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
        print(f"DEBUG: Found {len(jobs)} total jobs")

    enriched_jobs = []
    for job in jobs:
        job_data = schemas.JobListItem.model_validate(job)
        if job.last_activity_at:
            job_data.last_activity_relative = format_relative_time(job.last_activity_at)
        else:
            job_data.last_activity_relative = None
        enriched_jobs.append(job_data)

    if page is None:
        return {
            "total": len(enriched_jobs),
            "jobs": enriched_jobs
        }

    total_pages = max(1, math.ceil(total_records / limit)) if total_records else 1
    return {
        "data": enriched_jobs,
        "jobs": enriched_jobs,
        "currentPage": page,
        "totalPages": total_pages,
        "totalRecords": total_records,
        "total": total_records,
        "limit": limit,
    }

# ============================================================
# 📌 ALL JOB SUBMISSIONS
# ============================================================
@router.get("/submissions")
def get_all_job_submissions(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    applications = db.query(models.JobApplication).all()

    return {
        "candidates": [
            {
                "application_id": a.id,
                "job_id": a.job.job_id if a.job else None,
                "candidate_id": a.candidate.id if a.candidate else None,
                "public_id": a.candidate.public_id if a.candidate else None,
                "full_name": a.candidate.full_name if a.candidate else None,
                "email": a.candidate.email if a.candidate else None,
                "phone": a.candidate.phone if a.candidate else None,
                "status": a.status,
            }
            for a in applications
        ]
    }


# ============================================================
# 📌 BASIC CANDIDATE INFO
# ============================================================
@router.get("/candidate/{candidate_id}")
def get_candidate_basic(
    candidate_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    candidate = (
        db.query(models.Candidate)
        .filter(
            (models.Candidate.id == candidate_id) |
            (models.Candidate.public_id == candidate_id)
        )
        .first()
    )

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    return {
        "candidate_id": candidate.id,
        "public_id": candidate.public_id,
        "full_name": candidate.full_name,
        "email": candidate.email,
        "phone": candidate.phone,
    }


# ============================================================
# 📌 CREATE JOB SUBMISSION
from sqlalchemy.exc import IntegrityError

@router.post("/{job_id}/submissions")
def create_job_submission(
    job_id: str,
    payload: schemas.CandidateApplyRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    candidate_id = payload.candidate_id
    if not candidate_id:
        raise HTTPException(status_code=400, detail="candidate_id is required")

    # 🔎 Find job
    job = db.query(models.Job).filter(
        (models.Job.job_id == job_id) | (models.Job.id == job_id)
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 🔎 Find candidate
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 🚫 Duplicate check (API level)
    exists = db.query(models.JobApplication).filter(
        models.JobApplication.job_id == job.id,
        models.JobApplication.candidate_id == candidate.id
    ).first()

    if exists:
        raise HTTPException(
            status_code=409,
            detail="You have already applied to this job"
        )

    # ✅ Create application
    application = models.JobApplication(
        id=str(uuid4()),
        job_id=job.id,
        candidate_id=candidate.id,

        # snapshot fields
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,

        status="sent_to_am",
        applied_at=datetime.utcnow(),
        sent_to_am_at=datetime.utcnow(),
        recruiter_id=user["id"],
    )

    # 🛡️ DB-level safety (race condition)
    try:
        db.add(application)
        db.commit()
        db.refresh(application)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="You have already applied to this job"
        )

    return {
        "message": "Candidate submitted successfully",
        "application_id": application.id
    }

# ============================================================
# 📌 GET JOB CANDIDATES
# ============================================================
@router.get("/{job_id}/candidates")
def get_job_candidates(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    applications = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.job_id == job_id)
        .all()
    )

    return {
        "job_id": job_id,
        "total_candidates": len(applications),
        "candidates": [
            {
                "application_id": app.id,
                "candidate_id": app.candidate.id,
                "public_id": app.candidate.public_id,
                "full_name": app.candidate.full_name,
                "email": app.candidate.email,
                "phone": app.candidate.phone,
                "status": app.status,
                "applied_at": app.applied_at,
            }
            for app in applications
        ]
    }


# ============================================================
# 📌 JOB JD UPLOAD
# ============================================================
@router.post("/{job_id}/jd")
def upload_job_jd(
    job_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    job = (
        db.query(models.Job)
        .filter(
            (models.Job.job_id == job_id) |
            (models.Job.id == job_id)
        )
        .first()
    )

    if not job:
        raise HTTPException(404, "Job not found")

    filename = f"{job_id}_{file.filename}"
    path = f"./uploads/{filename}"

    with open(path, "wb") as f:
        f.write(file.file.read())

    job.jd_url = f"/uploads/{filename}"
    db.commit()

    return {"job_id": job_id, "jd_url": job.jd_url}


# ============================================================
# 📌 JOB MATCHING
# ============================================================
@router.post("/{job_id}/match")
def match_candidates_to_job(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    job = db.query(models.Job).filter(
        (models.Job.job_id == job_id) | (models.Job.id == job_id)
    ).first()

    if not job:
        raise HTTPException(404, "Job not found")

    applications = db.query(models.JobApplication).filter(
        models.JobApplication.job_id == job.id
    ).all()

    matches = []

    for app in applications:
        candidate = app.candidate
        if not candidate:
            continue

        score = getattr(candidate, "fit_score", 0)

        matches.append({
            "candidate_id": candidate.id,
            "public_id": candidate.public_id,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "fit_score": score,
            "status": app.status
        })

    matches = sorted(matches, key=lambda x: x["fit_score"], reverse=True)

    return {
        "job_id": job_id,
        "total_matched": len(matches),
        "matches": matches
    }


# ============================================================
# 📌 UPDATE APPLICATION STATUS
# ============================================================
@router.put("/job-applications/{application_id}/status")
def update_application_status(
    application_id: str,
    payload: ApplicationStatusUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    application = db.query(models.JobApplication).filter(
        models.JobApplication.id == application_id
    ).first()

    if not application:
        raise HTTPException(404, "Application not found")

    application.status = payload.status
    application.updated_at = datetime.utcnow()

    # ✅ DO NOT TOUCH sent_to_client_at AGAIN
    # It is recruiter → AM timestamp and must stay constant

    db.commit()

    return {
        "application_id": application.id,
        "status": application.status
    }


# ============================================================
# 📌 GET JOB SUBMISSIONS  (Recruiter Page)
# ============================================================



# ============================================================
# 📌 GET JOB SUBMISSIONS  (Recruiter Page)
# ============================================================
@router.get("/{job_id}/submissions")
def get_job_submissions(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    # Resolve job_id -> internal DB UUID
    job = db.query(models.Job).filter(
        (models.Job.job_id == job_id) | (models.Job.id == job_id)
    ).first()

    if not job:
        raise HTTPException(404, "Job not found")

    applications = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.job_id == job.id)
        .all()
    )

    candidates = []
    normalized = False
    public_id_pattern = re.compile(r"^[A-Z]{3}-C-\d{4}$")
    allocate_public_id = _build_candidate_public_id_allocator(db)
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
        candidates.append(
            {
                "application_id": app.id,
                "candidate_id": candidate.id if candidate else app.candidate_id,
                "public_id": candidate.public_id if candidate else None,
                "full_name": (
                    candidate.full_name if candidate and candidate.full_name else app.full_name
                ),
                "email": candidate.email if candidate and candidate.email else app.email,
                "phone": candidate.phone if candidate and candidate.phone else app.phone,
                "status": app.status,
                "applied_at": app.applied_at,
                "sent_to_am_at": app.sent_to_am_at,
                "sent_to_client_at": app.sent_to_client_at,  # ⭐⭐ THIS
            }
        )

    if normalized:
        db.commit()

    return {
        "job_id": job_id,
        "total_candidates": len(applications),
        "candidates": candidates
    }




@router.post("/{job_id}/close")
def close_job(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    job = db.query(models.Job).filter(
        (models.Job.job_id == job_id) |
        (models.Job.id == job_id)
    ).first()

    if not job:
        raise HTTPException(404, "Job not found")

    job.status = "closed"

    job.is_active = False
    job.updated_at = datetime.utcnow()

    db.commit()

    return {"message": "Job closed successfully"}



@router.put("/{job_id}", response_model=schemas.JobResponse)
def update_job(
    job_id: str,
    payload: schemas.JobUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    job = db.query(models.Job).filter(
        (models.Job.id == job_id) |
        (models.Job.job_id == job_id)
    ).first()

    if not job:
        raise HTTPException(404, "Job not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(job, field, value)

    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)

    return job


# ============================================================
# 📌 SINGLE JOB
@router.get("/{job_id}", response_model=schemas.JobResponse)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    job = (
        db.query(models.Job)
        .filter(
            (models.Job.job_id == job_id) |
            (models.Job.id == job_id)
        )
        .first()
    )

    if not job:
        raise HTTPException(404, "Job not found")

    if isinstance(job.skills, str):
        job.skills = [s.strip() for s in job.skills.split(",")] if job.skills else []

    return job   # 🔥 LET PYDANTIC HANDLE account_manager


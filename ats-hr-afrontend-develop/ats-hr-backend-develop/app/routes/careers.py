from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from typing import List, Optional

from app.db import get_db
from app import models
from app.auth import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/public/careers", tags=["Public Career Portal"])

# Token is optional here (public page)
candidate_security = HTTPBearer(auto_error=False)


# ----------------------------------------------------
# Extract Candidate ID If Token Exists (Optional)
# ----------------------------------------------------
def get_candidate_optional_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(candidate_security),
):
    if not credentials:
        return None

    token = credentials.credentials
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return data.get("candidate_id")
    except Exception:
        return None


# ----------------------------------------------------
# PUBLIC LIST — Minimal Job View
# ----------------------------------------------------
@router.get("/jobs", response_model=List[dict])
def list_public_jobs(db: Session = Depends(get_db)):
    jobs = (
        db.query(models.Job)
        .filter(
    models.Job.status == "active",
    models.Job.is_active == True
)


        .order_by(models.Job.created_at.desc())
        .all()
    )

    return [
        {
            "id": job.id,
            "title": job.title,
            "company_name": job.company_name,
            "location": job.location,
            "department": job.department,
            "posted_date": job.created_at.isoformat() if job.created_at else None,
        }
        for job in jobs
    ]


# ----------------------------------------------------
# PUBLIC JOB DETAIL WITH PROFILE CHECK
# Matches logic expected in CareersPublic.jsx
# ----------------------------------------------------
@router.get("/jobs/{job_id}", response_model=dict)
def get_public_job(
    job_id: str,
    cid: Optional[str] = Depends(get_candidate_optional_token),
    db: Session = Depends(get_db),
):
    # 1) Fetch job
    job = (
        db.query(models.Job)
        .filter(
    models.Job.id == job_id,
    models.Job.status == "active",
    models.Job.is_active == True,
)

        .first()
    )

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 2) If user not logged in → always locked with next_action = register
    if cid is None:
        return {
            "id": job.id,
            "title": job.title,
            "company_name": job.company_name,
            "location": job.location,
            "department": job.department,
            "description": "Please register/login to view full description.",
            "posted_date": job.created_at.isoformat() if job.created_at else None,
            "next_action": "register",
        }

    # 3) User logged in → check candidate + resume
    candidate = db.query(models.Candidate).filter(models.Candidate.id == cid).first()
    profile_completed = bool(candidate and candidate.resume_url)

    if not profile_completed:
        return {
            "id": job.id,
            "title": job.title,
            "company_name": job.company_name,
            "location": job.location,
            "department": job.department,
            "description": "Upload your resume to unlock full details.",
            "posted_date": job.created_at.isoformat() if job.created_at else None,
            "next_action": "upload_resume",
        }

    # 4) Profile complete → show full description and allow apply
    return {
        "id": job.id,
        "title": job.title,
        "company_name": job.company_name,
        "location": job.location,
        "department": job.department,
        "description": job.description,
        "skills": job.skills,
        "min_experience": job.min_experience,
        "max_experience": job.max_experience,
        "posted_date": job.created_at.isoformat() if job.created_at else None,
        "next_action": "apply",
    }


# ----------------------------------------------------
# PUBLIC APPLY — Just block & tell them to login
# (Real apply handled at /v1/candidate/apply)
# ----------------------------------------------------
@router.post("/jobs/{job_id}/apply")
def public_apply_block(job_id: str):
    raise HTTPException(
        status_code=401,
        detail="Please login or register to apply for this job.",
    )

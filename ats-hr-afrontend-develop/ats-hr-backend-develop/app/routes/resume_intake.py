"""
Resume & Candidate Intake Routes
Handle resume parsing and candidate creation from resume data
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from datetime import datetime
import secrets
from pydantic import BaseModel
import re
import os
import json
import asyncio
import tempfile

from app.db import get_db
from app.auth import get_current_user, get_password_hash
from app.resume_parser_service import parse_resume
from app.resume_parser import parse_resume_structured
import app.models as models
from app.resume_parser_pipeline import run_resume_pipeline, run_resume_pipeline_task
from app.task_queue import task_queue, get_task_status

router = APIRouter(prefix="/v1", tags=["Resume & Candidates"])


# ============================================================
# SCHEMAS
# ============================================================
class ParsedResumeData(BaseModel):
    full_name: str
    email: str
    phone: str
    skills: list
    experience_years: int
    education: str
    location: str
    resume_text: str
    confidence_score: float


class CreateCandidateFromResumeRequest(BaseModel):
    job_id: str
    full_name: str
    email: str
    phone: str
    skills: list = []
    experience_years: int = 0
    education: str = ""
    location: str = ""
    resume_url: str = ""


class FieldWithConfidence(BaseModel):
    value: object | None
    confidence: float


class ParsedResumeATS(BaseModel):
    full_name: FieldWithConfidence
    email: FieldWithConfidence
    phone: FieldWithConfidence
    location: FieldWithConfidence
    industry: FieldWithConfidence
    total_experience_years: FieldWithConfidence
    skills: FieldWithConfidence  # value: {"technical": [], "tools": [], "domain": []}
    experience: FieldWithConfidence
    education: FieldWithConfidence
    projects: FieldWithConfidence
    certifications: FieldWithConfidence


class ResumePipelineRequest(BaseModel):
    job_description: str = ""
    required_skills: list[str] = []
    min_experience_years: float = 0
    required_education: str = ""


def _parse_job_payload(job_payload: str | None) -> dict:
    if not job_payload:
        return {}
    try:
        data = json.loads(job_payload)
        return data if isinstance(data, dict) else {}
    except Exception:
        raise HTTPException(status_code=400, detail="job_payload must be valid JSON object")


# ============================================================
# 📌 PARSE RESUME ENDPOINT
# ============================================================
@router.post("/resumes/parse", response_model=ParsedResumeData)
async def parse_resume_endpoint(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Parse resume file and extract structured data.
    
    Supported formats: PDF, DOCX
    Returns: Parsed candidate data (name, email, phone, skills, experience, etc.)
    """
    
    # Validate file type
    allowed_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")
    
    try:
        parsed = parse_resume(file)
        return parsed
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse resume: {str(e)}")


# ============================================================
# 📌 PARSE RESUME (STRICT ATS SCHEMA FOR UI AUTOFILL)
# ============================================================
@router.post("/parse-resume", response_model=ParsedResumeATS)
async def parse_resume_strict(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    allowed_types = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    content = await file.read()
    import tempfile, os
    suffix = os.path.splitext(file.filename or "")[1] or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        path = tmp.name
    try:
        return parse_resume_structured(path)
    finally:
        if os.path.exists(path):
            os.remove(path)


# ============================================================
# 📌 CREATE CANDIDATE FROM RESUME
# ============================================================
@router.post("/candidates/from-resume")
def create_candidate_from_resume(
    data: CreateCandidateFromResumeRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a candidate from parsed resume data and link to job.
    
    Steps:
    1. Check if candidate exists (by email)
    2. Create/update candidate with parsed data
    3. Ensure candidate login exists (dev prints temp password)
    4. Create CandidateSubmission with status=submitted + source=recruiter
    5. Return created candidate + submission
    """
    
    recruiter_id = current_user["id"]
    public_id_pattern = re.compile(r"^[A-Z]{3}-C-\d{4}$")
    
    # Validate job exists
    # ✅ Accept both job_id (custom code like "ATS-J-0009") AND job.id (UUID)
    job = db.query(models.Job).filter(
        (models.Job.id == data.job_id) | (models.Job.job_id == data.job_id)
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check if candidate exists by email
    existing_candidate = db.query(models.Candidate).filter(
        models.Candidate.email == data.email
    ).first()
    
    if existing_candidate:
        # Update existing candidate
        candidate = existing_candidate
        candidate.full_name = data.full_name or candidate.full_name
        candidate.phone = data.phone or candidate.phone
        candidate.skills = data.skills or candidate.skills
        candidate.experience_years = (
            data.experience_years
            if data.experience_years is not None
            else candidate.experience_years
        )
        candidate.current_location = data.location or candidate.current_location
        candidate.education = data.education or candidate.education
        candidate.resume_url = data.resume_url or candidate.resume_url
        if not candidate.source:
            candidate.source = "recruiter"
        if candidate.status != "verified":
            candidate.status = "verified"
        if not candidate.public_id or not public_id_pattern.match(candidate.public_id):
            candidate.public_id = models.generate_candidate_public_id_from_org(db)
    else:
        # Create new candidate
        candidate = models.Candidate(
            id=models.generate_uuid(),
            public_id=models.generate_candidate_public_id_from_org(db),
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
            skills=data.skills,
            experience_years=data.experience_years,
            current_location=data.location,
            education=data.education,
            resume_url=data.resume_url,
            source="recruiter",
            status="verified",
            created_at=datetime.utcnow()
        )
        db.add(candidate)
    
    db.commit()
    db.refresh(candidate)

    # Ensure candidate login exists
    user = db.query(models.User).filter(
        models.User.email == candidate.email
    ).first()

    if not user:
        temp_password = secrets.token_urlsafe(8)
        hashed_password = get_password_hash(temp_password)
        user = models.User(
            username=candidate.email.split("@")[0],
            email=candidate.email,
            password=hashed_password,
            role="candidate",
            full_name=candidate.full_name,
            must_change_password=True,
            linked_candidate_id=candidate.id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        # Dev-only: print credentials
        print("\n==============================")
        print("✅ NEW CANDIDATE USER CREATED")
        print("Email:", candidate.email)
        print("Password:", temp_password)
        print("==============================\n")
    else:
        if user.role == "candidate" and not user.linked_candidate_id:
            user.linked_candidate_id = candidate.id
            if not user.full_name:
                user.full_name = candidate.full_name
            db.commit()
    
    # Create submission record for this job
    existing_submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.candidate_id == candidate.id,
        models.CandidateSubmission.job_id == job.id
    ).first()
    
    if not existing_submission:
        submission = models.CandidateSubmission(
            id=models.generate_uuid(),
            candidate_id=candidate.id,
            job_id=job.id,
            recruiter_id=recruiter_id,
            status="submitted",
            source="recruiter",
            match_score=0,
            submitted_at=datetime.utcnow()
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
    else:
        submission = existing_submission
    
    # ? Create JobApplication so it appears in View Submissions
    existing_app = db.query(models.JobApplication).filter(
        models.JobApplication.job_id == job.id,
        models.JobApplication.candidate_id == candidate.id
    ).first()

    if not existing_app:
        app = models.JobApplication(
            job_id=job.id,
            candidate_id=candidate.id,
            full_name=candidate.full_name,
            email=candidate.email,
            phone=candidate.phone,
            status="sent_to_am",
            applied_at=datetime.utcnow(),
            sent_to_am_at=datetime.utcnow(),
            recruiter_id=recruiter_id,
        )
        db.add(app)
        db.commit()

    return {
        "message": "Candidate created and linked to job successfully",
        "candidate": {
            "id": candidate.id,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "skills": candidate.skills,
            "experience_years": candidate.experience_years,
            "location": candidate.current_location,
            "resume_url": candidate.resume_url
        },
        "submission": {
            "id": submission.id,
            "status": submission.status,
            "submitted_at": submission.submitted_at
        }
    }


# ============================================================
# 📌 GET CANDIDATE BY ID (for profile view)
# ============================================================
@router.get("/candidates/{candidate_id}")
def get_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get full candidate details."""
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return {
        "id": candidate.id,
        "full_name": candidate.full_name,
        "email": candidate.email,
        "phone": candidate.phone,
        "skills": candidate.skills,
        "experience_years": candidate.experience_years,
        "location": candidate.current_location,
        "education": candidate.education,
        "resume_url": candidate.resume_url,
        "status": candidate.status,
        "created_at": candidate.created_at
    }


# ============================================================
# PHASE 3 - PIPELINE + MATCH SCORING
# ============================================================
@router.post("/resume/pipeline/score")
async def resume_pipeline_score(
    file: UploadFile = File(...),
    job_payload: str | None = Form(default=None),
    current_user: dict = Depends(get_current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    suffix = os.path.splitext(file.filename or "")[1] or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        path = tmp.name

    try:
        payload = _parse_job_payload(job_payload)
        return run_resume_pipeline(path, payload)
    finally:
        if os.path.exists(path):
            os.remove(path)


@router.post("/resume/pipeline/async")
async def resume_pipeline_async(
    file: UploadFile = File(...),
    job_payload: str | None = Form(default=None),
    current_user: dict = Depends(get_current_user),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    suffix = os.path.splitext(file.filename or "")[1] or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        path = tmp.name

    payload = _parse_job_payload(job_payload)
    task_id = task_queue.create_task(
        "resume_pipeline",
        metadata={
            "file_name": file.filename,
            "requested_by": current_user.get("id"),
            "has_job_payload": bool(payload),
        },
    )
    asyncio.create_task(run_resume_pipeline_task(task_id=task_id, file_path=path, job_payload=payload))

    return {
        "status": "pending",
        "task_id": task_id,
        "message": "Resume pipeline started",
    }


@router.get("/resume/pipeline/status/{task_id}")
def resume_pipeline_status(
    task_id: str,
    current_user: dict = Depends(get_current_user),
):
    status = get_task_status(task_id)
    if status.get("error"):
        raise HTTPException(status_code=404, detail=status["error"])
    return status

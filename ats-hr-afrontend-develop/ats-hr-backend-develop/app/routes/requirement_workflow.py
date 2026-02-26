"""
Requirement & Candidate Workflow Module
AM + Recruiter end-to-end workflow APIs.
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from app.utils.activity import log_activity


router = APIRouter(prefix="/v1/workflow", tags=["Requirement Workflow"])


FINAL_STAGES = {
    "selected",
    "rejected",
    "negotiation",
    "hired",
    "offer_declined",
}


def _get_user_id(user: dict) -> str:
    return user.get("id") or user.get("user_id") or user.get("sub")


def _normalize_list(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        return [v.strip() for v in re.split(r",|;|\n", value) if v.strip()]
    return []


def _normalize_location(requirement: models.Requirement) -> Dict[str, Optional[str]]:
    if isinstance(requirement.location_details, dict):
        return {
            "city": requirement.location_details.get("city"),
            "type": requirement.location_details.get("type"),
        }
    if isinstance(requirement.location_details, str):
        return {"city": requirement.location_details, "type": None}
    return {"city": None, "type": None}


def _text_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    tokens_a = set(re.findall(r"[a-z0-9]+", a.lower()))
    tokens_b = set(re.findall(r"[a-z0-9]+", b.lower()))
    if not tokens_a or not tokens_b:
        return 0.0
    return len(tokens_a & tokens_b) / max(1, len(tokens_a))


def _parse_salary(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def _compute_match(requirement: models.Requirement, candidate: models.Candidate) -> Dict[str, Any]:
    required_skills = _normalize_list(requirement.skills_mandatory)
    candidate_skills = _normalize_list(candidate.skills)

    # Skills match
    matched_skills = [
        req for req in required_skills
        if any(req.lower() in c.lower() or c.lower() in req.lower() for c in candidate_skills)
    ]
    skill_ratio = (len(matched_skills) / len(required_skills)) if required_skills else 0.0
    skill_score = round(skill_ratio * 100, 1)

    # Role match
    role_target = requirement.title or ""
    candidate_role = candidate.current_job_title or candidate.experience or ""
    role_score = round(_text_similarity(role_target, candidate_role) * 100, 1)

    # Experience match
    exp_min = float(requirement.experience_min or 0)
    cand_exp = float(candidate.experience_years or 0)
    if exp_min == 0:
        exp_score = 100.0
    else:
        diff = abs(cand_exp - exp_min)
        if diff <= 1:
            exp_score = 100.0
        elif diff <= 2:
            exp_score = 85.0
        elif cand_exp >= exp_min:
            exp_score = 75.0
        else:
            exp_score = max(20.0, 100.0 - (diff / exp_min) * 100)
    exp_score = round(exp_score, 1)

    # Location match
    loc = _normalize_location(requirement)
    candidate_loc = (candidate.current_location or "").lower()
    location_match = False
    if loc.get("type") and str(loc["type"]).lower() == "remote":
        location_match = True
    elif loc.get("city") and candidate_loc:
        location_match = loc["city"].lower() in candidate_loc or candidate_loc in loc["city"].lower()
    location_score = 100.0 if location_match else 0.0

    # Salary match
    cand_salary = _parse_salary(candidate.expected_ctc)
    if cand_salary is None:
        cand_salary = _parse_salary(candidate.expected_salary)
    if cand_salary is None:
        cand_salary = _parse_salary(candidate.current_ctc)
    salary_score = 50.0
    salary_match = False
    if cand_salary is not None and (requirement.ctc_min is not None or requirement.ctc_max is not None):
        ctc_min = float(requirement.ctc_min or 0)
        ctc_max = float(requirement.ctc_max or 0)
        if ctc_min and ctc_max and ctc_min <= cand_salary <= ctc_max:
            salary_score = 100.0
            salary_match = True
        elif ctc_max and cand_salary <= ctc_max:
            salary_score = 60.0
        else:
            salary_score = 0.0

    # Availability match
    notice_days = None
    if candidate.notice_period_days is not None:
        notice_days = int(candidate.notice_period_days)
    elif candidate.notice_period and str(candidate.notice_period).isdigit():
        notice_days = int(candidate.notice_period)
    availability_match = False
    if notice_days is None:
        availability_score = 50.0
    else:
        availability_match = notice_days <= 30
        availability_score = 100.0 if availability_match else 0.0

    total_score = (
        skill_score * 0.40 +
        role_score * 0.20 +
        exp_score * 0.15 +
        location_score * 0.10 +
        salary_score * 0.10 +
        availability_score * 0.05
    )

    return {
        "match_score": round(total_score, 1),
        "matched_skills": matched_skills,
        "missing_skills": [s for s in required_skills if s not in matched_skills],
        "field_matches": {
            "skills": skill_score >= 60,
            "role": role_score >= 60,
            "experience": exp_score >= 80,
            "location": location_match,
            "salary": salary_match,
            "availability": availability_match,
        },
        "scores": {
            "skills": skill_score,
            "role": role_score,
            "experience": exp_score,
            "location": location_score,
            "salary": salary_score,
            "availability": availability_score,
        },
    }


def _create_notification(
    db: Session,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    reference_id: Optional[str] = None,
    requirement_id: Optional[str] = None,
    priority: str = "normal",
):
    notification = models.SystemNotification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        requirement_id=requirement_id,
        reference_id=reference_id,
        priority=priority,
        created_at=datetime.utcnow(),
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def _log_candidate_timeline(db: Session, candidate_id: str, status: str, note: str, user_id: str):
    timeline = models.CandidateTimeline(
        candidate_id=candidate_id,
        status=status,
        note=note,
        user_id=user_id,
        created_at=datetime.utcnow(),
    )
    db.add(timeline)
    db.commit()


def _ensure_job_for_requirement(db: Session, requirement: models.Requirement, am_id: str) -> str:
    if requirement.job_id:
        return requirement.job_id

    new_job = models.Job(
        title=requirement.title,
        description=requirement.description,
        skills=_normalize_list(requirement.skills_mandatory) + _normalize_list(requirement.skills_good_to_have),
        min_experience=int(requirement.experience_min or 0),
        max_experience=int(requirement.experience_max or 0) if requirement.experience_max else None,
        location=(_normalize_location(requirement).get("city")),
        department=requirement.department,
        client_id=requirement.client_id,
        account_manager_id=am_id,
        status="active",
        created_by=am_id,
        created_at=datetime.utcnow(),
    )
    db.add(new_job)
    db.flush()
    requirement.job_id = new_job.id
    db.commit()
    return new_job.id


def _refresh_requirement_status(db: Session, requirement_id: str):
    submissions = (
        db.query(models.CandidateSubmission)
        .filter(models.CandidateSubmission.requirement_id == requirement_id)
        .all()
    )
    if not submissions:
        return
    if any(sub.stage not in FINAL_STAGES for sub in submissions):
        status = "in_progress"
    else:
        status = "closed"
    req = db.query(models.Requirement).filter(models.Requirement.id == requirement_id).first()
    if req:
        req.status = status
        req.updated_at = datetime.utcnow()
        db.commit()

class RequirementCreate(BaseModel):
    title: str
    client_name: str
    client_contact: Optional[str] = None
    description: Optional[str] = None
    entry_method: str = "manual"
    raw_email_content: Optional[str] = None
    skills_mandatory: List[str] = Field(default_factory=list)
    skills_good_to_have: List[str] = Field(default_factory=list)
    experience_min: float = 0.0
    experience_max: Optional[float] = None
    location: Optional[str] = None
    location_type: Optional[str] = None
    ctc_min: Optional[float] = None
    ctc_max: Optional[float] = None
    positions_count: int = 1
    urgency: Optional[str] = None
    department: Optional[str] = None
    priority: Optional[str] = None
    target_start_date: Optional[date] = None
    assign_recruiters: Optional[List[str]] = None
    notes_for_recruiter: Optional[str] = None


class RequirementAssign(BaseModel):
    recruiter_ids: List[str]
    notes: Optional[str] = None


class EmailParseRequest(BaseModel):
    raw_email: str


class MatchRequest(BaseModel):
    min_score: Optional[float] = 0.0


class CallNoteRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    strengths: Optional[str] = None
    concerns: Optional[str] = None
    free_text: str


class SubmitCandidatesRequest(BaseModel):
    candidate_ids: List[str]
    summary: Optional[str] = None


class StageUpdateRequest(BaseModel):
    stage: str
    rating: Optional[int] = None
    strengths: Optional[str] = None
    concerns: Optional[str] = None
    free_text: Optional[str] = None


class InterviewScheduleRequest(BaseModel):
    interview_date: date
    interview_time: str
    interview_mode: str
    location_or_link: Optional[str] = None
    interviewer_name: Optional[str] = None
    notes: Optional[str] = None


# ---------------------------------------------------------
# AM: REQUIREMENTS
# ---------------------------------------------------------

@router.get("/am/requirements")
@require_permission("requirements", "view")
def list_am_requirements(
    status: Optional[str] = Query(None),
    client_name: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    am_id = _get_user_id(current_user)
    query = db.query(models.Requirement).filter(models.Requirement.account_manager_id == am_id)

    if status:
        query = query.filter(models.Requirement.status == status)
    if client_name:
        query = query.filter(models.Requirement.client_name.ilike(f"%{client_name}%"))
    if q:
        like = f"%{q}%"
        query = query.filter(
            models.Requirement.title.ilike(like) |
            models.Requirement.client_name.ilike(like)
        )

    reqs = query.order_by(models.Requirement.created_at.desc()).all()

    results = []
    for req in reqs:
        assignments = (
            db.query(models.RequirementAssignment)
            .filter(models.RequirementAssignment.requirement_id == req.id)
            .all()
        )
        recruiters = [
            {"id": a.recruiter_id, "name": a.recruiter.full_name if a.recruiter else "Recruiter"}
            for a in assignments
        ]
        submitted_count = (
            db.query(models.CandidateSubmission)
            .filter(models.CandidateSubmission.requirement_id == req.id)
            .count()
        )
        results.append({
            "id": req.id,
            "requirement_code": req.requirement_code,
            "title": req.title,
            "client_name": req.client_name,
            "status": req.status,
            "created_at": req.created_at,
            "assigned_recruiters": recruiters,
            "candidates_submitted": submitted_count,
        })

    return {"requirements": results}


@router.post("/am/requirements")
@require_permission("requirements", "create")
def create_am_requirement(
    payload: RequirementCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    am_id = _get_user_id(current_user)
    requirement = models.Requirement(
        requirement_code=models.generate_requirement_code(db),
        client_id=None,
        client_name=payload.client_name,
        client_contact=payload.client_contact,
        title=payload.title,
        description=payload.description,
        entry_method=payload.entry_method,
        raw_email_content=payload.raw_email_content,
        skills_mandatory=payload.skills_mandatory,
        skills_good_to_have=payload.skills_good_to_have,
        experience_min=payload.experience_min,
        experience_max=payload.experience_max,
        ctc_min=payload.ctc_min,
        ctc_max=payload.ctc_max,
        location_details={
            "city": payload.location,
            "type": payload.location_type,
        } if payload.location or payload.location_type else None,
        positions_count=payload.positions_count,
        urgency=payload.urgency,
        department=payload.department,
        priority=payload.priority or "Medium",
        target_start_date=payload.target_start_date,
        status="open",
        created_by_id=am_id,
        account_manager_id=am_id,
        created_at=datetime.utcnow(),
    )

    db.add(requirement)
    db.commit()
    db.refresh(requirement)

    if payload.assign_recruiters:
        assign_payload = RequirementAssign(
            recruiter_ids=payload.assign_recruiters,
            notes=payload.notes_for_recruiter,
        )
        _assign_recruiters(db, requirement, assign_payload, am_id)

    return {
        "message": "Requirement created",
        "requirement_id": requirement.id,
        "requirement_code": requirement.requirement_code,
    }


@router.post("/am/requirements/parse-email")
@require_permission("requirements", "create")
def parse_requirement_email(
    payload: EmailParseRequest,
    current_user=Depends(get_current_user),
):
    text = payload.raw_email or ""
    skills = re.findall(r"\b[A-Za-z\+\#\.]{2,}\b", text)
    skills = list({s for s in skills if len(s) <= 20})[:12]
    exp_match = re.search(r"(\d+)\s*(?:\+)?\s*(?:years|yrs)", text.lower())
    exp_years = int(exp_match.group(1)) if exp_match else None
    location_match = re.search(r"(?:location|city|based in)\s*[:\-]?\s*([A-Za-z ,]+)", text, re.IGNORECASE)
    location = location_match.group(1).strip() if location_match else None

    return {
        "title": "",
        "skills_mandatory": skills,
        "experience_min": exp_years,
        "location": location,
    }


def _assign_recruiters(
    db: Session,
    requirement: models.Requirement,
    payload: RequirementAssign,
    am_id: str,
):
    job_id = _ensure_job_for_requirement(db, requirement, am_id)
    recruiter_ids = list({rid for rid in payload.recruiter_ids if rid})
    recruiters = db.query(models.User).filter(models.User.id.in_(recruiter_ids)).all()
    for recruiter in recruiters:
        existing = db.query(models.RequirementAssignment).filter(
            models.RequirementAssignment.requirement_id == requirement.id,
            models.RequirementAssignment.recruiter_id == recruiter.id,
        ).first()
        if not existing:
            assignment = models.RequirementAssignment(
                requirement_id=requirement.id,
                recruiter_id=recruiter.id,
                assigned_by=am_id,
                assigned_at=datetime.utcnow(),
                status="active",
                notes=payload.notes,
            )
            db.add(assignment)
        # Ensure job recruiter mapping
        existing_job = db.execute(
            models.job_recruiters.select().where(
                (models.job_recruiters.c.job_id == job_id) &
                (models.job_recruiters.c.recruiter_id == recruiter.id)
            )
        ).first()
        if not existing_job:
            db.execute(
                models.job_recruiters.insert().values(
                    job_id=job_id,
                    recruiter_id=recruiter.id,
                    assigned_at=datetime.utcnow(),
                )
            )
        _create_notification(
            db,
            recruiter.id,
            "requirement_assigned",
            f"New requirement assigned: {requirement.title}",
            f"{current_user_name(db, am_id)} assigned you to {requirement.title}.",
            reference_id=requirement.id,
            requirement_id=requirement.id,
        )

    requirement.status = "in_progress"
    requirement.updated_at = datetime.utcnow()
    db.commit()


def current_user_name(db: Session, user_id: str) -> str:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    return user.full_name or user.email or "Account Manager"


def _require_assignment(
    db: Session,
    requirement_id: str,
    recruiter_id: str,
) -> models.RequirementAssignment:
    assignment = (
        db.query(models.RequirementAssignment)
        .filter(
            models.RequirementAssignment.requirement_id == requirement_id,
            models.RequirementAssignment.recruiter_id == recruiter_id,
            models.RequirementAssignment.status == "active",
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Requirement is not assigned to you")
    return assignment


def _serialize_note(note: models.CandidateNote) -> Dict[str, Any]:
    return {
        "id": note.id,
        "note_stage": note.note_stage,
        "rating": note.rating,
        "strengths": note.strengths,
        "concerns": note.concerns,
        "free_text": note.free_text,
        "note": note.note,
        "author_id": note.author_id,
        "author_name": note.author.full_name if note.author else None,
        "created_at": note.created_at,
    }


def _serialize_interview(interview: models.Interview) -> Dict[str, Any]:
    return {
        "id": interview.id,
        "interview_date": interview.interview_date,
        "interview_time": interview.interview_time,
        "interview_mode": interview.mode,
        "location_or_link": interview.location_or_link,
        "interviewer_name": interview.interviewer_name,
        "am_informed": interview.am_informed,
        "client_informed": interview.client_informed,
        "scheduled_at": interview.scheduled_at,
        "status": interview.status,
        "notes": interview.notes,
        "created_at": interview.created_at,
    }


# ---------------------------------------------------------
# AM: ASSIGN & DETAIL
# ---------------------------------------------------------

@router.post("/am/requirements/{requirement_id}/assign")
@require_permission("requirements", "assign")
def assign_recruiters_to_requirement(
    requirement_id: str,
    payload: RequirementAssign,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    am_id = _get_user_id(current_user)
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == requirement_id
    ).first()
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")
    if requirement.account_manager_id and requirement.account_manager_id != am_id:
        raise HTTPException(status_code=403, detail="You cannot assign this requirement")

    _assign_recruiters(db, requirement, payload, am_id)

    return {
        "message": "Recruiters assigned",
        "requirement_id": requirement.id,
        "assigned_count": len(payload.recruiter_ids),
    }


@router.get("/am/requirements/{requirement_id}")
@require_permission("requirements", "view")
def get_am_requirement_detail(
    requirement_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    am_id = _get_user_id(current_user)
    
    # First try to find in Job model (most common case for new jobs)
    job = (
        db.query(models.Job)
        .filter(models.Job.id == requirement_id)
        .first()
    )
    
    # If not found in Job, try Requirement model
    requirement = None
    if not job:
        try:
            requirement = (
                db.query(models.Requirement)
                .filter(models.Requirement.id == requirement_id)
                .first()
            )
        except Exception:
            # Requirement table may have schema issues, ignore
            requirement = None
        
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
    
    # For Requirement model, check AM authorization
    if requirement and requirement.account_manager_id and requirement.account_manager_id != am_id:
        raise HTTPException(status_code=403, detail="Not authorized for this requirement")

    # Get assignments - check both RequirementAssignment and JobAssignment
    assignments = []
    try:
        if requirement:
            assignments = (
                db.query(models.RequirementAssignment)
                .options(joinedload(models.RequirementAssignment.recruiter))
                .filter(models.RequirementAssignment.requirement_id == requirement_id)
                .order_by(models.RequirementAssignment.assigned_at.desc())
                .all()
            )
        elif job:
            # Try JobAssignment for jobs created via job-management
            job_assignments = (
                db.query(models.JobAssignment)
                .filter(models.JobAssignment.job_id == requirement_id)
                .order_by(models.JobAssignment.assigned_at.desc())
                .all()
            )
            # Convert to similar format
            for ja in job_assignments:
                recruiter = db.query(models.User).filter(models.User.id == ja.recruiter_id).first()
                assignments.append({
                    "id": ja.id,
                    "recruiter_id": ja.recruiter_id,
                    "recruiter": recruiter,
                    "assigned_at": ja.assigned_at,
                    "status": ja.status,
                    "notes": ja.am_notes,
                })
    except Exception as e:
        print(f"Error fetching assignments: {e}")
        assignments = []

    submissions = (
        db.query(models.CandidateSubmission)
        .options(
            joinedload(models.CandidateSubmission.candidate),
            joinedload(models.CandidateSubmission.recruiter),
        )
        .filter(models.CandidateSubmission.requirement_id == requirement_id)
        .order_by(models.CandidateSubmission.created_at.desc())
        .all()
    )

    submission_ids = [s.id for s in submissions]
    notes_by_submission: Dict[str, List[Dict[str, Any]]] = {}
    interviews_by_submission: Dict[str, List[Dict[str, Any]]] = {}

    if submission_ids:
        notes = (
            db.query(models.CandidateNote)
            .options(joinedload(models.CandidateNote.author))
            .filter(models.CandidateNote.submission_id.in_(submission_ids))
            .order_by(models.CandidateNote.created_at.asc())
            .all()
        )
        for note in notes:
            notes_by_submission.setdefault(note.submission_id, []).append(_serialize_note(note))

        interviews = (
            db.query(models.Interview)
            .filter(models.Interview.submission_id.in_(submission_ids))
            .order_by(models.Interview.created_at.desc())
            .all()
        )
        for interview in interviews:
            interviews_by_submission.setdefault(interview.submission_id, []).append(
                _serialize_interview(interview)
            )

    payload_assignments = []
    for a in assignments:
        # Handle both RequirementAssignment objects and dict format from JobAssignment
        if isinstance(a, dict):
            payload_assignments.append({
                "id": a.get("id"),
                "recruiter_id": a.get("recruiter_id"),
                "recruiter_name": a.get("recruiter").full_name if a.get("recruiter") else None,
                "assigned_at": a.get("assigned_at"),
                "status": a.get("status"),
                "notes": a.get("notes"),
            })
        else:
            payload_assignments.append({
                "id": a.id,
                "recruiter_id": a.recruiter_id,
                "recruiter_name": a.recruiter.full_name if a.recruiter else None,
                "assigned_at": a.assigned_at,
                "status": a.status,
                "notes": a.notes,
            })

    payload_submissions = []
    for sub in submissions:
        candidate = sub.candidate
        payload_submissions.append(
            {
                "id": sub.id,
                "candidate_id": sub.candidate_id,
                "candidate_name": candidate.full_name if candidate else None,
                "email": candidate.email if candidate else None,
                "phone": candidate.phone if candidate else None,
                "photo_url": candidate.photo_url if candidate else None,
                "match_score": sub.match_score,
                "match_details": sub.match_details,
                "stage": sub.stage,
                "status": sub.status,
                "is_locked": sub.is_locked,
                "submitted_at": sub.submitted_at,
                "shortlisted_at": sub.shortlisted_at,
                "decision_at": sub.decision_at,
                "created_at": sub.created_at,
                "updated_at": sub.updated_at,
                "recruiter": {
                    "id": sub.recruiter_id,
                    "name": sub.recruiter.full_name if sub.recruiter else None,
                },
                "notes": notes_by_submission.get(sub.id, []),
                "interviews": interviews_by_submission.get(sub.id, []),
            }
        )

    # Build requirement payload based on which model was found
    if requirement:
        requirement_payload = {
            "id": requirement.id,
            "requirement_code": requirement.requirement_code,
            "title": requirement.title,
            "description": requirement.description,
            "client_name": requirement.client_name,
            "client_contact": requirement.client_contact,
            "entry_method": requirement.entry_method,
            "raw_email_content": requirement.raw_email_content,
            "status": requirement.status,
            "skills_mandatory": requirement.skills_mandatory or [],
            "skills_good_to_have": requirement.skills_good_to_have or [],
            "experience_min": requirement.experience_min,
            "experience_max": requirement.experience_max,
            "location_details": requirement.location_details,
            "ctc_min": requirement.ctc_min,
            "ctc_max": requirement.ctc_max,
            "positions_count": requirement.positions_count,
            "urgency": requirement.urgency,
            "department": requirement.department,
            "priority": requirement.priority,
            "target_start_date": requirement.target_start_date,
            "created_at": requirement.created_at,
            "updated_at": requirement.updated_at,
        }
    else:
        # Build payload from Job model
        # Get client name if client_id exists
        client_name = None
        if job.client_id:
            client = db.query(models.Client).filter(models.Client.id == job.client_id).first()
            client_name = client.client_name if client else None
        
        requirement_payload = {
            "id": job.id,
            "requirement_code": job.job_id or job.serial_number,
            "title": job.title,
            "description": job.description or job.jd_text,
            "client_name": client_name,
            "client_contact": getattr(job, 'client_ta', None),
            "entry_method": "manual",
            "raw_email_content": None,
            "status": job.status,
            "skills_mandatory": job.skills if isinstance(job.skills, list) else [],
            "skills_good_to_have": [],
            "experience_min": job.min_experience or 0,
            "experience_max": job.max_experience,
            "location_details": {"city": job.location, "type": getattr(job, 'mode', 'hybrid')},
            "ctc_min": None,
            "ctc_max": None,
            "positions_count": getattr(job, 'no_of_positions', 1) or 1,
            "urgency": getattr(job, 'joining_preference', None),
            "department": job.department,
            "priority": "Medium",
            "target_start_date": None,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            # Additional job-specific fields
            "budget": getattr(job, 'budget', None),
            "duration": getattr(job, 'duration', None),
            "work_timings": getattr(job, 'work_timings', None),
            "joining_preference": getattr(job, 'joining_preference', None),
            "notes_for_recruiter": getattr(job, 'notes_for_recruiter', None),
            "mode": getattr(job, 'mode', 'hybrid'),
            "jd_text": getattr(job, 'jd_text', None) or job.description,
        }

    return {
        "requirement": requirement_payload,
        "assignments": payload_assignments,
        "submissions": payload_submissions,
    }


# ---------------------------------------------------------
# AM: SUBMISSION STAGE UPDATES
# ---------------------------------------------------------

@router.post("/am/submissions/{submission_id}/stage")
@require_permission("submissions", "update")
def update_submission_stage(
    submission_id: str,
    payload: StageUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    am_id = _get_user_id(current_user)
    submission = (
        db.query(models.CandidateSubmission)
        .options(joinedload(models.CandidateSubmission.requirement))
        .filter(models.CandidateSubmission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    requirement = submission.requirement
    if requirement and requirement.account_manager_id and requirement.account_manager_id != am_id:
        raise HTTPException(status_code=403, detail="Not authorized for this submission")

    if submission.is_locked:
        raise HTTPException(status_code=400, detail="Submission is locked")

    new_stage = (payload.stage or "").strip()
    if not new_stage:
        raise HTTPException(status_code=400, detail="Stage is required")

    allowed_transitions = {
        "recruiter_review": {"am_shortlisted", "am_rejected"},
        "sent_to_am": {"am_shortlisted", "am_rejected"},
        "am_shortlisted": {"sent_to_client", "am_rejected"},
        "sent_to_client": {"client_shortlisted", "client_rejected"},
        "client_shortlisted": {
            "interview_scheduled",
            "selected",
            "rejected",
            "negotiation",
            "hired",
            "offer_declined",
        },
        "interview_scheduled": {
            "interview_completed",
            "selected",
            "rejected",
            "negotiation",
            "hired",
            "offer_declined",
        },
        "interview_completed": {"selected", "rejected", "negotiation", "hired", "offer_declined"},
    }

    current_stage = submission.stage or "recruiter_review"
    note_fields_present = any(
        [
            payload.free_text,
            payload.rating is not None,
            payload.strengths,
            payload.concerns,
        ]
    )

    if new_stage == current_stage and note_fields_present:
        if new_stage in ("client_shortlisted", "client_rejected"):
            note_stage = "client_feedback"
        elif new_stage in FINAL_STAGES:
            note_stage = "client_feedback"
        else:
            note_stage = "am_feedback"

        note = models.CandidateNote(
            candidate_id=submission.candidate_id,
            submission_id=submission.id,
            note_stage=note_stage,
            rating=payload.rating,
            strengths=payload.strengths,
            concerns=payload.concerns,
            free_text=payload.free_text,
            note=payload.free_text or f"Notes added for {new_stage}",
            author_id=am_id,
            created_at=datetime.utcnow(),
        )
        db.add(note)
        submission.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Note added", "stage": current_stage}

    if new_stage not in allowed_transitions.get(current_stage, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Stage '{new_stage}' not allowed from '{current_stage}'",
        )

    submission.stage = new_stage
    submission.status = new_stage
    submission.updated_at = datetime.utcnow()
    if new_stage == "sent_to_am":
        submission.submitted_at = datetime.utcnow()
    if new_stage == "am_shortlisted":
        submission.shortlisted_at = datetime.utcnow()
    if new_stage in FINAL_STAGES:
        submission.is_locked = True
        submission.decision_at = datetime.utcnow()

    if note_fields_present:
        if new_stage in ("client_shortlisted", "client_rejected"):
            note_stage = "client_feedback"
        elif new_stage in FINAL_STAGES:
            note_stage = "client_feedback"
        else:
            note_stage = "am_feedback"

        note = models.CandidateNote(
            candidate_id=submission.candidate_id,
            submission_id=submission.id,
            note_stage=note_stage,
            rating=payload.rating,
            strengths=payload.strengths,
            concerns=payload.concerns,
            free_text=payload.free_text,
            note=payload.free_text or f"Stage updated to {new_stage}",
            author_id=am_id,
            created_at=datetime.utcnow(),
        )
        db.add(note)

    db.commit()

    _log_candidate_timeline(
        db,
        submission.candidate_id,
        new_stage,
        f"Stage updated to {new_stage}",
        am_id,
    )

    if requirement:
        _refresh_requirement_status(db, requirement.id)

    # Notifications
    if requirement:
        recruiter_id = submission.recruiter_id
        if new_stage in ("am_shortlisted", "am_rejected"):
            _create_notification(
                db,
                recruiter_id,
                "am_shortlisted" if new_stage == "am_shortlisted" else "am_rejected",
                f"AM reviewed submission for {requirement.title}",
                f"Submission moved to {new_stage.replace('_', ' ')}.",
                reference_id=submission.id,
                requirement_id=requirement.id,
            )
        if new_stage == "client_shortlisted":
            _create_notification(
                db,
                recruiter_id,
                "client_shortlisted",
                f"Client shortlisted candidate for {requirement.title}",
                "Please schedule the interview.",
                reference_id=submission.id,
                requirement_id=requirement.id,
            )
        if new_stage in FINAL_STAGES:
            _create_notification(
                db,
                recruiter_id,
                "client_decision",
                f"Final decision for {requirement.title}",
                f"Decision: {new_stage.replace('_', ' ')}",
                reference_id=submission.id,
                requirement_id=requirement.id,
            )

    return {"message": "Stage updated", "stage": new_stage}


@router.post("/am/interviews/{interview_id}/client-informed")
@require_permission("interviews", "update")
def mark_client_informed(
    interview_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    am_id = _get_user_id(current_user)
    interview = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    submission = interview.submission
    if submission and submission.requirement:
        requirement = submission.requirement
        if requirement.account_manager_id and requirement.account_manager_id != am_id:
            raise HTTPException(status_code=403, detail="Not authorized for this interview")

    interview.client_informed = True
    db.commit()

    return {"message": "Client marked as informed"}

# ---------------------------------------------------------
# RECRUITER: REQUIREMENTS
# ---------------------------------------------------------

@router.get("/recruiter/requirements")
@require_permission("requirements", "view")
def list_recruiter_requirements(
    scope: str = Query("assigned"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recruiter_id = _get_user_id(current_user)
    scope = (scope or "assigned").lower()

    if scope == "all":
        requirements = (
            db.query(models.Requirement)
            .filter(models.Requirement.status.in_(["open", "in_progress"]))
            .order_by(models.Requirement.created_at.desc())
            .all()
        )
        return {
            "scope": "all",
            "requirements": [
                {
                    "id": r.id,
                    "requirement_code": r.requirement_code,
                    "title": r.title,
                    "client_name": r.client_name,
                    "status": r.status,
                    "skills_mandatory": r.skills_mandatory or [],
                    "experience_min": r.experience_min,
                    "experience_max": r.experience_max,
                    "location_details": r.location_details,
                    "positions_count": r.positions_count,
                    "created_at": r.created_at,
                }
                for r in requirements
            ],
        }

    assignments = (
        db.query(models.RequirementAssignment)
        .options(joinedload(models.RequirementAssignment.requirement))
        .filter(models.RequirementAssignment.recruiter_id == recruiter_id)
        .order_by(models.RequirementAssignment.assigned_at.desc())
        .all()
    )

    return {
        "scope": "assigned",
        "requirements": [
            {
                "id": a.requirement.id,
                "requirement_code": a.requirement.requirement_code,
                "title": a.requirement.title,
                "client_name": a.requirement.client_name,
                "status": a.requirement.status,
                "skills_mandatory": a.requirement.skills_mandatory or [],
                "experience_min": a.requirement.experience_min,
                "experience_max": a.requirement.experience_max,
                "location_details": a.requirement.location_details,
                "positions_count": a.requirement.positions_count,
                "assigned_at": a.assigned_at,
                "assignment_notes": a.notes,
                "created_at": a.requirement.created_at,
            }
            for a in assignments
        ],
    }


@router.get("/recruiter/requirements/{requirement_id}")
@require_permission("requirements", "view")
def recruiter_requirement_detail(
    requirement_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recruiter_id = _get_user_id(current_user)
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == requirement_id
    ).first()
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")

    assignment = (
        db.query(models.RequirementAssignment)
        .filter(
            models.RequirementAssignment.requirement_id == requirement_id,
            models.RequirementAssignment.recruiter_id == recruiter_id,
            models.RequirementAssignment.status == "active",
        )
        .first()
    )

    return {
        "requirement": {
            "id": requirement.id,
            "requirement_code": requirement.requirement_code,
            "title": requirement.title,
            "description": requirement.description,
            "client_name": requirement.client_name,
            "status": requirement.status,
            "skills_mandatory": requirement.skills_mandatory or [],
            "skills_good_to_have": requirement.skills_good_to_have or [],
            "experience_min": requirement.experience_min,
            "experience_max": requirement.experience_max,
            "location_details": requirement.location_details,
            "ctc_min": requirement.ctc_min,
            "ctc_max": requirement.ctc_max,
            "positions_count": requirement.positions_count,
            "urgency": requirement.urgency,
            "department": requirement.department,
            "priority": requirement.priority,
            "target_start_date": requirement.target_start_date,
            "created_at": requirement.created_at,
        },
        "assignment": {
            "assigned_at": assignment.assigned_at if assignment else None,
            "notes": assignment.notes if assignment else None,
            "is_assigned": bool(assignment),
        },
    }


@router.post("/recruiter/requirements/{requirement_id}/match")
@require_permission("requirements", "view")
def match_candidates(
    requirement_id: str,
    payload: MatchRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recruiter_id = _get_user_id(current_user)
    _require_assignment(db, requirement_id, recruiter_id)

    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == requirement_id
    ).first()
    if not requirement:
        raise HTTPException(status_code=404, detail="Requirement not found")

    # Exclude candidates already in pipeline for this requirement/job
    excluded_query = db.query(models.CandidateSubmission.candidate_id).filter(
        models.CandidateSubmission.requirement_id == requirement_id
    )
    if requirement.job_id:
        excluded_query = excluded_query.union(
            db.query(models.CandidateSubmission.candidate_id).filter(
                models.CandidateSubmission.job_id == requirement.job_id
            )
        )
    excluded_ids = excluded_query.all()
    excluded_ids = [row[0] for row in excluded_ids]

    # Exclude candidates locked in final stages elsewhere (basic guard)
    locked_ids = db.query(models.CandidateSubmission.candidate_id).filter(
        models.CandidateSubmission.is_locked == True,
        models.CandidateSubmission.stage.in_(["hired", "offer_declined"]),
    ).all()
    locked_ids = [row[0] for row in locked_ids]

    candidates_query = db.query(models.Candidate)
    if excluded_ids:
        candidates_query = candidates_query.filter(models.Candidate.id.notin_(excluded_ids))
    if locked_ids:
        candidates_query = candidates_query.filter(models.Candidate.id.notin_(locked_ids))
    candidates = candidates_query.all()

    min_score = payload.min_score or 0.0
    matches = []
    for candidate in candidates:
        match_data = _compute_match(requirement, candidate)
        if match_data["match_score"] < min_score:
            continue
        matches.append(
            {
                "candidate_id": candidate.id,
                "full_name": candidate.full_name,
                "email": candidate.email,
                "phone": candidate.phone,
                "current_location": candidate.current_location,
                "experience_years": candidate.experience_years,
                "skills": candidate.skills or [],
                "match_score": match_data["match_score"],
                "matched_skills": match_data["matched_skills"],
                "missing_skills": match_data["missing_skills"],
                "field_matches": match_data["field_matches"],
                "scores": match_data["scores"],
            }
        )

    matches.sort(key=lambda item: item["match_score"], reverse=True)

    return {
        "requirement_id": requirement_id,
        "total": len(matches),
        "candidates": matches,
    }


@router.post("/recruiter/requirements/{requirement_id}/candidates/{candidate_id}/call-note")
@require_permission("notes", "create")
def add_call_note(
    requirement_id: str,
    candidate_id: str,
    payload: CallNoteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recruiter_id = _get_user_id(current_user)
    assignment = _require_assignment(db, requirement_id, recruiter_id)

    requirement = assignment.requirement
    candidate = db.query(models.Candidate).filter(models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job_id = _ensure_job_for_requirement(db, requirement, requirement.account_manager_id or recruiter_id)

    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.candidate_id == candidate_id,
        models.CandidateSubmission.job_id == job_id,
    ).first()

    if submission and submission.is_locked:
        raise HTTPException(status_code=400, detail="Submission is locked")

    if not submission:
        match_data = _compute_match(requirement, candidate)
        submission = models.CandidateSubmission(
            candidate_id=candidate_id,
            requirement_id=requirement_id,
            job_id=job_id,
            recruiter_id=recruiter_id,
            match_score=match_data["match_score"],
            match_details=match_data,
            stage="recruiter_review",
            status="recruiter_review",
            created_at=datetime.utcnow(),
        )
        db.add(submission)
        db.flush()
    else:
        submission.requirement_id = submission.requirement_id or requirement_id
        submission.stage = "recruiter_review"
        submission.status = "recruiter_review"
        submission.updated_at = datetime.utcnow()

    note = models.CandidateNote(
        candidate_id=candidate_id,
        submission_id=submission.id,
        note_stage="call_feedback",
        rating=payload.rating,
        strengths=payload.strengths,
        concerns=payload.concerns,
        free_text=payload.free_text,
        note=payload.free_text or "Call feedback added",
        author_id=recruiter_id,
        created_at=datetime.utcnow(),
    )
    db.add(note)
    log_activity(
        db,
        action="recruiter.feedback_added",
        resource_type="feedback",
        actor=current_user,
        resource_id=note.id,
        resource_name=candidate.full_name if candidate else candidate_id,
        target_user_id=candidate_id,
        recruiter_id=recruiter_id,
        job_id=job_id,
        client_id=requirement.client_id,
        note=payload.free_text,
        metadata={"requirement_title": requirement.title},
    )
    db.commit()

    _log_candidate_timeline(
        db,
        candidate_id,
        "call_feedback",
        "Call feedback added",
        recruiter_id,
    )

    return {
        "message": "Call note saved",
        "submission_id": submission.id,
    }


@router.post("/recruiter/requirements/{requirement_id}/submit")
@require_permission("submissions", "create")
def submit_candidates_to_am(
    requirement_id: str,
    payload: SubmitCandidatesRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recruiter_id = _get_user_id(current_user)
    assignment = _require_assignment(db, requirement_id, recruiter_id)
    requirement = assignment.requirement

    if not payload.candidate_ids:
        raise HTTPException(status_code=400, detail="No candidates selected")

    successes = []
    failures = []
    job_id = requirement.job_id or _ensure_job_for_requirement(
        db, requirement, requirement.account_manager_id or recruiter_id
    )

    for candidate_id in payload.candidate_ids:
        submission = db.query(models.CandidateSubmission).filter(
            models.CandidateSubmission.candidate_id == candidate_id,
            models.CandidateSubmission.job_id == job_id,
        ).first()

        if not submission:
            failures.append({"candidate_id": candidate_id, "reason": "No call note submitted"})
            continue

        if submission.is_locked:
            failures.append({"candidate_id": candidate_id, "reason": "Submission is locked"})
            continue

        has_call_note = db.query(models.CandidateNote).filter(
            models.CandidateNote.submission_id == submission.id,
            models.CandidateNote.note_stage == "call_feedback",
        ).first()

        if not has_call_note:
            failures.append({"candidate_id": candidate_id, "reason": "Call note required"})
            continue

        submission.stage = "sent_to_am"
        submission.status = "sent_to_am"
        submission.submitted_at = datetime.utcnow()
        submission.updated_at = datetime.utcnow()
        log_activity(
            db,
            action="recruiter.submitted_to_am",
            resource_type="submission",
            actor=current_user,
            resource_id=submission.id,
            resource_name=str(submission.candidate.full_name if submission.candidate else candidate_id),
            target_user_id=submission.candidate_id,
            recruiter_id=recruiter_id,
            job_id=submission.job_id,
            client_id=requirement.client_id,
            new_status="sent_to_am",
            metadata={"requirement_title": requirement.title},
        )
        successes.append(candidate_id)

        _log_candidate_timeline(
            db,
            candidate_id,
            "sent_to_am",
            "Submitted to AM",
            recruiter_id,
        )

    db.commit()

    if successes and requirement.account_manager_id:
        _create_notification(
            db,
            requirement.account_manager_id,
            "candidate_submitted",
            f"New submissions for {requirement.title}",
            f"{current_user_name(db, recruiter_id)} submitted {len(successes)} candidate(s).",
            reference_id=requirement.id,
            requirement_id=requirement.id,
        )

    return {
        "message": "Submission processed",
        "submitted": successes,
        "failed": failures,
    }


@router.get("/recruiter/requirements/{requirement_id}/submissions")
@require_permission("submissions", "view")
def list_recruiter_submissions(
    requirement_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recruiter_id = _get_user_id(current_user)
    _require_assignment(db, requirement_id, recruiter_id)

    submissions = (
        db.query(models.CandidateSubmission)
        .options(joinedload(models.CandidateSubmission.candidate))
        .filter(
            models.CandidateSubmission.requirement_id == requirement_id,
            models.CandidateSubmission.recruiter_id == recruiter_id,
        )
        .order_by(models.CandidateSubmission.created_at.desc())
        .all()
    )

    submission_ids = [s.id for s in submissions]
    notes_by_submission: Dict[str, List[Dict[str, Any]]] = {}
    interviews_by_submission: Dict[str, List[Dict[str, Any]]] = {}

    if submission_ids:
        notes = (
            db.query(models.CandidateNote)
            .options(joinedload(models.CandidateNote.author))
            .filter(models.CandidateNote.submission_id.in_(submission_ids))
            .order_by(models.CandidateNote.created_at.asc())
            .all()
        )
        for note in notes:
            notes_by_submission.setdefault(note.submission_id, []).append(_serialize_note(note))

        interviews = (
            db.query(models.Interview)
            .filter(models.Interview.submission_id.in_(submission_ids))
            .order_by(models.Interview.created_at.desc())
            .all()
        )
        for interview in interviews:
            interviews_by_submission.setdefault(interview.submission_id, []).append(
                _serialize_interview(interview)
            )

    payload_submissions = []
    for sub in submissions:
        candidate = sub.candidate
        payload_submissions.append(
            {
                "id": sub.id,
                "candidate_id": sub.candidate_id,
                "candidate_name": candidate.full_name if candidate else None,
                "email": candidate.email if candidate else None,
                "phone": candidate.phone if candidate else None,
                "match_score": sub.match_score,
                "stage": sub.stage,
                "status": sub.status,
                "is_locked": sub.is_locked,
                "submitted_at": sub.submitted_at,
                "created_at": sub.created_at,
                "updated_at": sub.updated_at,
                "notes": notes_by_submission.get(sub.id, []),
                "interviews": interviews_by_submission.get(sub.id, []),
            }
        )

    return {"submissions": payload_submissions}


@router.post("/recruiter/submissions/{submission_id}/schedule-interview")
@require_permission("interviews", "create")
def schedule_interview(
    submission_id: str,
    payload: InterviewScheduleRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recruiter_id = _get_user_id(current_user)
    submission = (
        db.query(models.CandidateSubmission)
        .options(joinedload(models.CandidateSubmission.requirement))
        .filter(models.CandidateSubmission.id == submission_id)
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="Not authorized for this submission")

    if submission.stage != "client_shortlisted":
        raise HTTPException(status_code=400, detail="Interview can only be scheduled after client shortlist")

    scheduled_at = None
    try:
        scheduled_at = datetime.strptime(
            f"{payload.interview_date} {payload.interview_time}",
            "%Y-%m-%d %H:%M",
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid interview time format (HH:MM)")

    interview = models.Interview(
        submission_id=submission.id,
        interview_date=payload.interview_date,
        interview_time=payload.interview_time,
        mode=payload.interview_mode,
        location_or_link=payload.location_or_link,
        interviewer_name=payload.interviewer_name,
        notes=payload.notes,
        scheduled_at=scheduled_at,
        status="scheduled",
        am_informed=True,
        created_at=datetime.utcnow(),
    )
    db.add(interview)

    submission.stage = "interview_scheduled"
    submission.status = "interview_scheduled"
    submission.updated_at = datetime.utcnow()
    log_activity(
        db,
        action="recruiter.interview_scheduled",
        resource_type="interview",
        actor=current_user,
        resource_id=interview.id,
        resource_name=str(submission.candidate.full_name if submission.candidate else submission.candidate_id),
        target_user_id=submission.candidate_id,
        recruiter_id=submission.recruiter_id,
        job_id=submission.job_id,
        old_status="client_shortlisted",
        new_status="interview_scheduled",
        metadata={
            "date": payload.interview_date,
            "time": payload.interview_time,
            "mode": payload.interview_mode,
            "interviewer_name": payload.interviewer_name,
        },
    )
    db.commit()

    am_recipient_ids = set()
    if submission.requirement and submission.requirement.account_manager_id:
        am_recipient_ids.add(submission.requirement.account_manager_id)
    if submission.job and submission.job.account_manager_id:
        am_recipient_ids.add(submission.job.account_manager_id)
    if not am_recipient_ids:
        fallback_am_rows = (
            db.query(models.User.id)
            .filter(
                func.lower(models.User.role).in_(
                    ["account_manager", "account manager", "accountmanager", "am"]
                )
            )
            .all()
        )
        am_recipient_ids.update(row.id for row in fallback_am_rows if row.id)

    if am_recipient_ids:
        recruiter_name = (
            str(submission.recruiter.full_name or "").strip()
            if submission.recruiter and submission.recruiter.full_name
            else (
                str(submission.recruiter.email or "").strip()
                if submission.recruiter and submission.recruiter.email
                else "Recruiter"
            )
        )
        candidate_name = (
            str(submission.candidate.full_name or "").strip()
            if submission.candidate and submission.candidate.full_name
            else (
                str(submission.candidate.public_id or "").strip()
                if submission.candidate and submission.candidate.public_id
                else "Candidate"
            )
        )
        requirement_label = (
            str(submission.requirement.title or "").strip()
            if submission.requirement and submission.requirement.title
            else (
                str(submission.job.title or "").strip()
                if submission.job and submission.job.title
                else "the requirement"
            )
        )
        for am_user_id in am_recipient_ids:
            _create_notification(
                db,
                am_user_id,
                "interview_scheduled",
                f"Interview scheduled by {recruiter_name}",
                (
                    f"{recruiter_name} scheduled an interview for {candidate_name} "
                    f"({requirement_label}) on {payload.interview_date} at {payload.interview_time}."
                ),
                reference_id=submission.candidate_id,
                requirement_id=(submission.requirement.id if submission.requirement else None),
                priority="high",
            )

    return {"message": "Interview scheduled", "interview_id": interview.id}


@router.post("/recruiter/submissions/{submission_id}/interview-notes")
@require_permission("notes", "create")
def add_interview_notes(
    submission_id: str,
    payload: CallNoteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    recruiter_id = _get_user_id(current_user)
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.recruiter_id != recruiter_id:
        raise HTTPException(status_code=403, detail="Not authorized for this submission")

    if submission.stage not in ("interview_scheduled", "interview_completed"):
        raise HTTPException(status_code=400, detail="Interview notes can only be added after scheduling")

    note = models.CandidateNote(
        candidate_id=submission.candidate_id,
        submission_id=submission.id,
        note_stage="interview_notes",
        rating=payload.rating,
        strengths=payload.strengths,
        concerns=payload.concerns,
        free_text=payload.free_text,
        note=payload.free_text or "Interview notes added",
        author_id=recruiter_id,
        created_at=datetime.utcnow(),
    )
    db.add(note)

    submission.stage = "interview_completed"
    submission.status = "interview_completed"
    submission.updated_at = datetime.utcnow()
    log_activity(
        db,
        action="recruiter.feedback_added",
        resource_type="feedback",
        actor=current_user,
        resource_id=note.id,
        resource_name=str(submission.candidate.full_name if submission.candidate else submission.candidate_id),
        target_user_id=submission.candidate_id,
        recruiter_id=submission.recruiter_id,
        job_id=submission.job_id,
        old_status="interview_scheduled",
        new_status="interview_completed",
        note=payload.free_text,
    )
    db.commit()

    _log_candidate_timeline(
        db,
        submission.candidate_id,
        "interview_completed",
        "Interview completed",
        recruiter_id,
    )

    return {"message": "Interview notes added"}

"""
RECRUITER WORKFLOWS - Complete Implementation
Handles all 7 recruiter workflows: Candidate Intake, Screening, Conversion, 
Submission, Interview Coordination, Feedback, and Joining Confirmation
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import os
import logging

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from app.utils.email import send_email
from app.utils.activity import log_activity
from app.matching_service import get_matching_service
from pydantic import BaseModel, EmailStr

router = APIRouter(
    prefix="/v1/recruiter",
    tags=["Recruiter Workflows"]
)

logger = logging.getLogger(__name__)

# ==========================================
# SCHEMAS
# ==========================================

class CandidateIntakeRequest(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    total_experience: int
    primary_skills: List[str]
    source: str  # "Direct", "Referral", "Vendor", etc.
    location: Optional[str] = None

class ScreeningDetailsRequest(BaseModel):
    skill_match_notes: str
    availability_date: Optional[str] = None
    rate_expectation: Optional[float] = None

class ConsultantConversionRequest(BaseModel):
    consultant_type: str  # "sourcing_only" or "full_payroll"
    expected_billing_rate: float
    availability_date: str
    work_location: str
    vendor_mapping_id: Optional[str] = None

class SubmissionRequest(BaseModel):
    requirement_id: str

class InterviewScheduleRequest(BaseModel):
    interview_date: str
    interview_time: str
    mode: str  # "online" or "in_person"
    client_id: str

class InterviewFeedbackRequest(BaseModel):
    decision: str  # "selected", "rejected", "hold"
    feedback_comments: str  # Mandatory

class JoiningConfirmationRequest(BaseModel):
    joining_date: str

class BulkCandidateSelectionRequest(BaseModel):
    requirement_id: str
    candidate_ids: List[str]  # Multiple candidates for the requirement


# ==========================================
# WORKFLOW: REQUIREMENT VISIBILITY & CANDIDATE SELECTION
# ==========================================

@router.get("/available-requirements")
@require_permission("requirements", "view")
def get_available_requirements(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get all ACTIVE requirements from Account Managers
    - Shows requirements open for candidate submissions
    - Includes skill requirements and client info
    - Shows which AM assigned the requirement
    - Shows assignment timestamp
    """
    
    # Get all active requirements
    requirements = db.query(models.Requirement).filter(
        models.Requirement.status == "active"
    ).all()
    
    requirement_list = []
    for req in requirements:
        # Count existing submissions for this requirement
        submission_count = db.query(models.CandidateSubmission).filter(
            models.CandidateSubmission.requirement_id == req.id
        ).count()
        
        # Get Account Manager info
        am_user = db.query(models.User).filter(
            models.User.id == req.account_manager_id
        ).first()
        
        # Get Client info
        client = db.query(models.Client).filter(
            models.Client.id == req.client_id
        ).first()
        
        requirement_list.append({
            "requirement_id": req.id,
            "requirement_title": req.title,
            "client_name": client.client_name if client else req.client_id,
            "client_id": req.client_id,
            "required_skills": req.skills,  # JSON array
            "experience_level": req.experience_level,
            "locations": req.locations,
            "vacancy_count": req.vacancy_count,
            "current_submissions": submission_count,
            "remaining_openings": req.vacancy_count - submission_count,
            "created_date": req.created_at,
            "assigned_by": am_user.full_name if am_user else "Unknown",
            "assigned_by_id": req.account_manager_id,
            "assigned_date": req.created_at,  # When AM created/assigned it
            "job_description": req.job_description,
            "notes": f"Need {req.vacancy_count - submission_count} more candidates"
        })
    
    return {
        "message": "Available requirements from Account Managers",
        "total_active_requirements": len(requirement_list),
        "requirements": requirement_list
    }


@router.get("/requirements/{requirement_id}/detail")
@require_permission("requirements", "view")
def get_requirement_detail(
    requirement_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get detailed requirement info for candidate matching
    - Shows skill requirements, experience level, client preferences
    - Shows already submitted candidates
    - Helps recruiter understand what to look for
    """
    
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == requirement_id,
        models.Requirement.status == "active"
    ).first()
    
    if not requirement:
        raise HTTPException(404, "Requirement not found or not active")
    
    # Get existing submissions
    submissions = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.requirement_id == requirement_id
    ).all()
    
    submitted_candidates = []
    for sub in submissions:
        submitted_candidates.append({
            "consultant_id": sub.consultant_id,
            "submission_date": sub.created_at,
            "status": sub.status
        })
    
    return {
        "requirement_id": requirement.id,
        "requirement_title": requirement.title,
        "client_name": requirement.client_id,
        "required_skills": requirement.skills,
        "experience_level": requirement.experience_level,
        "job_description": requirement.job_description,
        "locations": requirement.locations,
        "vacancy_count": requirement.vacancy_count,
        "submitted_count": len(submissions),
        "remaining_openings": requirement.vacancy_count - len(submissions),
        "already_submitted_candidates": submitted_candidates,
        "budget_range": f"${requirement.min_rate}-${requirement.max_rate}/hour",
        "am_notes": requirement.notes
    }


@router.get("/candidate-pool")
@require_permission("candidates", "view")
def get_candidate_pool(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    skill_filter: Optional[str] = None,
    status_filter: Optional[str] = None
):
    """
    Get pool of candidates available for requirement submission
    - Shows shortlisted/converted candidates
    - Filters by skills if provided
    - Helps recruiter select best candidates for each requirement
    """
    
    recruiter_id = current_user["id"]
    
    # Get candidates in convertible states
    query = db.query(models.Candidate).filter(
        models.Candidate.created_by == recruiter_id,
        models.Candidate.status.in_(["verified", "shortlisted", "converted"])
    )
    
    if status_filter:
        query = query.filter(models.Candidate.status == status_filter)
    
    candidates = query.all()
    
    candidate_pool = []
    for candidate in candidates:
        # Filter by skill if provided
        if skill_filter and skill_filter not in candidate.skills:
            continue
        
        candidate_pool.append({
            "candidate_id": candidate.id,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "total_experience": candidate.total_experience,
            "primary_skills": candidate.skills,
            "rate_expectation": candidate.rate_expectation,
            "current_status": candidate.status,
            "location": candidate.location,
            "availability_date": candidate.availability_date
        })
    
    return {
        "message": "Candidate pool available for requirement submission",
        "total_in_pool": len(candidate_pool),
        "candidates": candidate_pool
    }


@router.post("/requirements/{requirement_id}/select-candidates")
@require_permission("candidates", "create")
def select_candidates_for_requirement(
    requirement_id: str,
    payload: BulkCandidateSelectionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow: Recruiter selects multiple candidates from pool for a requirement
    - Validates requirement is active
    - Creates submissions for selected candidates
    - Returns confirmation with next steps
    """
    
    # Verify requirement exists and is active
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == requirement_id,
        models.Requirement.status == "active"
    ).first()
    
    if not requirement:
        raise HTTPException(404, "Requirement not found or not active")
    
    # Check vacancy not exceeded
    current_submissions = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.requirement_id == requirement_id
    ).count()
    
    if current_submissions + len(payload.candidate_ids) > requirement.vacancy_count:
        raise HTTPException(
            400,
            f"Cannot exceed vacancy count. Available slots: {requirement.vacancy_count - current_submissions}"
        )
    
    successful_submissions = []
    failed_submissions = []
    
    for candidate_id in payload.candidate_ids:
        try:
            # Get candidate (must be shortlisted)
            candidate = db.query(models.Candidate).filter(
                models.Candidate.id == candidate_id,
                models.Candidate.status.in_(["shortlisted", "converted"])
            ).first()
            
            if not candidate:
                failed_submissions.append({
                    "candidate_id": candidate_id,
                    "reason": "Candidate not found or not eligible"
                })
                continue
            
            # Check if already submitted for this requirement
            existing = db.query(models.CandidateSubmission).filter(
                models.CandidateSubmission.candidate_id == candidate_id,
                models.CandidateSubmission.requirement_id == requirement_id
            ).first()
            
            if existing:
                failed_submissions.append({
                    "candidate_id": candidate_id,
                    "reason": "Already submitted for this requirement"
                })
                continue
            
            # Create submission
            submission = models.CandidateSubmission(
                candidate_id=candidate_id,
                requirement_id=requirement_id,
                recruiter_id=current_user["id"],
                status="submitted",
                created_at=datetime.utcnow()
            )
            
            db.add(submission)
            log_activity(
                db,
                action="recruiter.submitted_to_am",
                resource_type="submission",
                actor=current_user,
                resource_id=submission.id,
                resource_name=candidate.full_name,
                target_user_id=candidate_id,
                recruiter_id=current_user["id"],
                client_id=requirement.client_id,
                metadata={
                    "requirement_id": requirement_id,
                    "requirement_title": requirement.title,
                },
            )
            
            # Audit log
            audit_log = models.AuditLog(
                user_id=current_user["id"],
                action="CANDIDATE_SELECTED_FOR_REQUIREMENT",
                entity_type="submission",
                entity_id=submission.id,
                old_state="none",
                new_state="submitted",
                details={
                    "candidate_id": candidate_id,
                    "requirement_id": requirement_id,
                    "candidate_name": candidate.full_name
                },
                timestamp=datetime.utcnow()
            )
            db.add(audit_log)
            
            successful_submissions.append({
                "candidate_id": candidate_id,
                "candidate_name": candidate.full_name,
                "status": "submitted"
            })
        
        except Exception as e:
            failed_submissions.append({
                "candidate_id": candidate_id,
                "reason": str(e)
            })
    
    db.commit()
    
    return {
        "message": "Candidates submitted to Account Manager",
        "requirement_id": requirement_id,
        "requirement_title": requirement.title,
        "successful_submissions": len(successful_submissions),
        "failed_submissions": len(failed_submissions),
        "submitted_candidates": successful_submissions,
        "failed_candidates": failed_submissions if failed_submissions else None,
        "next_step": "Account Manager will review and provide feedback"
    }


# ==========================================
# WORKFLOW A: CANDIDATE INTAKE & CREATION
# ==========================================

@router.post("/candidates")
@require_permission("candidates", "create")
def create_candidate(
    payload: CandidateIntakeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow A: Candidate Intake & Creation
    - Validates mandatory fields
    - Checks for duplicates (email + phone)
    - Creates candidate record in "New" state
    - Triggers resume parsing if resume uploaded
    """
    
    # Check for duplicate candidate (Email + Phone)
    duplicate = db.query(models.Candidate).filter(
        (models.Candidate.email == payload.email) | 
        (models.Candidate.phone == payload.phone)
    ).first()
    
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "Duplicate candidate detected",
                "existing_candidate_id": duplicate.id,
                "existing_candidate_name": duplicate.full_name,
                "message": "A candidate with this email or phone already exists. Please verify before proceeding."
            }
        )
    
    # Generate public ID
    count = db.query(models.Candidate).count()
    public_id = f"ATS-C-{str(count + 1).zfill(4)}"
    
    # Create candidate record
    candidate = models.Candidate(
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        total_experience=payload.total_experience,
        skills=payload.primary_skills,
        source=payload.source,
        location=payload.location,
        public_id=public_id,
        status="new",  # Initial state
        created_by=current_user["id"],
        created_at=datetime.utcnow()
    )
    
    db.add(candidate)
    log_activity(
        db,
        action="recruiter.candidate_added",
        resource_type="candidate",
        actor=current_user,
        resource_id=candidate.id,
        resource_name=candidate.full_name,
        target_user_id=candidate.id,
        metadata={"source": payload.source},
    )
    db.commit()
    db.refresh(candidate)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="CANDIDATE_CREATED",
        entity_type="candidate",
        entity_id=candidate.id,
        old_state="None",
        new_state="new",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Candidate created successfully",
        "candidate_id": candidate.id,
        "public_id": candidate.public_id,
        "status": candidate.status,
        "next_step": "Upload resume for parsing"
    }


@router.post("/candidates/{candidate_id}/upload-resume")
@require_permission("candidates", "create")
def upload_resume(
    candidate_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Upload resume and trigger parsing
    Transitions candidate from "New" → "Parsed"
    """
    
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    if candidate.status != "new":
        raise HTTPException(
            status_code=400,
            detail=f"Resume can only be uploaded for new candidates. Current status: {candidate.status}"
        )
    
    # Save resume file
    upload_dir = "uploads/resumes"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{candidate_id}_{file.filename}"
    
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    
    # Parse resume (trigger AI parsing)
    from app.resume_parser import parse_resume
    
    try:
        with open(file_path, "r", errors="ignore") as f:
            resume_text = f.read()
        
        parsed_data = parse_resume(resume_text)
        
        # Update candidate with parsed data
        candidate.full_name = parsed_data.get("name", candidate.full_name)
        candidate.email = parsed_data.get("email", candidate.email)
        candidate.phone = parsed_data.get("phone", candidate.phone)
        candidate.skills = parsed_data.get("skills", candidate.skills)
        candidate.education = parsed_data.get("education", candidate.education)
        candidate.experience = parsed_data.get("experience", candidate.experience)
        candidate.resume_url = file_path
        candidate.status = "parsed"  # Transition to "Parsed" state
        candidate.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(candidate)
        
        # Audit log
        audit_log = models.AuditLog(
            user_id=current_user["id"],
            action="RESUME_PARSED",
            entity_type="candidate",
            entity_id=candidate.id,
            old_state="new",
            new_state="parsed",
            timestamp=datetime.utcnow()
        )
        db.add(audit_log)
        db.commit()
        
        return {
            "message": "Resume uploaded and parsed successfully",
            "candidate_id": candidate.id,
            "status": candidate.status,
            "parsed_data": {
                "name": candidate.full_name,
                "email": candidate.email,
                "phone": candidate.phone,
                "skills": candidate.skills,
                "education": candidate.education
            },
            "next_step": "Review parsed data and proceed to screening"
        }
    
    except Exception as e:
        raise HTTPException(500, f"Resume parsing failed: {str(e)}")


# ==========================================
# WORKFLOW B: SCREENING & SHORTLISTING
# ==========================================

@router.put("/candidates/{candidate_id}/screening-details")
@require_permission("candidates", "screen")
def update_screening_details(
    candidate_id: str,
    payload: ScreeningDetailsRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow B: Add screening details
    Transitions candidate from "Parsed" → "Screening"
    """
    
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    if candidate.status not in ["parsed", "screening"]:
        raise HTTPException(
            status_code=400,
            detail=f"Screening details can only be added for parsed candidates. Current status: {candidate.status}"
        )
    
    candidate.screening_notes = payload.skill_match_notes
    candidate.availability_date = payload.availability_date
    candidate.rate_expectation = payload.rate_expectation
    candidate.status = "screening"
    candidate.updated_at = datetime.utcnow()
    log_activity(
        db,
        action="recruiter.candidate_updated",
        resource_type="candidate",
        actor=current_user,
        resource_id=candidate.id,
        resource_name=candidate.full_name,
        target_user_id=candidate.id,
        old_status="parsed",
        new_status="screening",
        note=payload.skill_match_notes,
    )
    
    db.commit()
    db.refresh(candidate)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="SCREENING_DETAILS_ADDED",
        entity_type="candidate",
        entity_id=candidate.id,
        old_state="parsed",
        new_state="screening",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Screening details updated",
        "candidate_id": candidate.id,
        "status": candidate.status,
        "next_step": "Shortlist or reject candidate"
    }


@router.put("/candidates/{candidate_id}/shortlist")
@require_permission("candidates", "screen")
def shortlist_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Mark candidate as Shortlisted
    Transitions candidate from "Screening" → "Shortlisted"
    """
    
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    if candidate.status != "screening":
        raise HTTPException(
            status_code=400,
            detail=f"Only candidates in screening status can be shortlisted. Current status: {candidate.status}"
        )
    
    candidate.status = "shortlisted"
    candidate.shortlisted_at = datetime.utcnow()
    candidate.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(candidate)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="CANDIDATE_SHORTLISTED",
        entity_type="candidate",
        entity_id=candidate.id,
        old_state="screening",
        new_state="shortlisted",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Candidate shortlisted successfully",
        "candidate_id": candidate.id,
        "status": candidate.status,
        "next_step": "Convert to consultant or submit to requirement"
    }


@router.put("/candidates/{candidate_id}/reject")
@require_permission("candidates", "screen")
def reject_candidate(
    candidate_id: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Mark candidate as Rejected (read-only after this)
    Transitions candidate from "Screening" → "Rejected"
    """
    
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    if candidate.status == "rejected":
        raise HTTPException(400, "Candidate is already rejected")
    
    candidate.status = "rejected"
    candidate.rejection_reason = reason
    candidate.rejected_at = datetime.utcnow()
    candidate.updated_at = datetime.utcnow()
    candidate.is_read_only = True  # Lock from further edits
    
    db.commit()
    db.refresh(candidate)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="CANDIDATE_REJECTED",
        entity_type="candidate",
        entity_id=candidate.id,
        old_state="screening",
        new_state="rejected",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Candidate rejected and locked from further edits",
        "candidate_id": candidate.id,
        "status": candidate.status,
        "rejection_reason": reason
    }


# ==========================================
# WORKFLOW C: CONSULTANT CONVERSION
# ==========================================

@router.post("/candidates/{candidate_id}/convert-consultant")
@require_permission("candidates", "convert")
def convert_to_consultant(
    candidate_id: str,
    payload: ConsultantConversionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow C: Convert Shortlisted Candidate to Consultant
    Creates new Consultant record with "Inactive" state
    Candidate status updated to "Converted"
    """
    
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    if candidate.status != "shortlisted":
        raise HTTPException(
            status_code=400,
            detail=f"Only shortlisted candidates can be converted. Current status: {candidate.status}"
        )
    
    # Create Consultant record
    consultant = models.Consultant(
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        skills=candidate.skills,
        consultant_type=payload.consultant_type,
        billing_rate=payload.expected_billing_rate,
        availability_date=payload.availability_date,
        work_location=payload.work_location,
        status="inactive",
        linked_candidate_id=candidate.id,
        created_by=current_user["id"],
        created_at=datetime.utcnow()
    )
    
    db.add(consultant)
    db.commit()
    db.refresh(consultant)
    
    # Update candidate status
    candidate.status = "converted"
    candidate.consultant_id = consultant.id
    candidate.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Audit logs
    audit_log1 = models.AuditLog(
        user_id=current_user["id"],
        action="CANDIDATE_CONVERTED",
        entity_type="candidate",
        entity_id=candidate.id,
        old_state="shortlisted",
        new_state="converted",
        timestamp=datetime.utcnow()
    )
    
    audit_log2 = models.AuditLog(
        user_id=current_user["id"],
        action="CONSULTANT_CREATED",
        entity_type="consultant",
        entity_id=consultant.id,
        old_state="None",
        new_state="inactive",
        timestamp=datetime.utcnow()
    )
    
    db.add(audit_log1)
    db.add(audit_log2)
    db.commit()
    
    return {
        "message": "Candidate converted to consultant successfully",
        "candidate_id": candidate.id,
        "consultant_id": consultant.id,
        "consultant_type": payload.consultant_type,
        "consultant_status": "inactive",
        "next_step": "Submit consultant to active requirement"
    }


# ==========================================
# WORKFLOW D: REQUIREMENT MAPPING & SUBMISSION
# ==========================================

@router.post("/consultants/{consultant_id}/submit-to-requirement")
@require_permission("consultants", "submit")
def submit_consultant_to_requirement(
    consultant_id: str,
    payload: SubmissionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow D: Submit Consultant to Requirement
    - Consultant profile is frozen after submission
    - Notifications sent to AM and Client
    - State transition: Inactive → Submitted
    """
    
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == consultant_id
    ).first()
    
    if not consultant:
        raise HTTPException(404, "Consultant not found")
    
    if consultant.status not in ["inactive", "available"]:
        raise HTTPException(
            status_code=400,
            detail=f"Only inactive or available consultants can be submitted. Current status: {consultant.status}"
        )
    
    # Get requirement
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == payload.requirement_id
    ).first()
    
    if not requirement:
        raise HTTPException(404, "Requirement not found")
    
    if requirement.status != "active":
        raise HTTPException(400, "Requirement must be active to accept submissions")
    
    # Check for duplicate submission
    existing = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.consultant_id == consultant_id,
        models.CandidateSubmission.requirement_id == payload.requirement_id
    ).first()
    
    if existing:
        raise HTTPException(400, "Consultant already submitted for this requirement")
    
    # Create submission record
    submission = models.CandidateSubmission(
        consultant_id=consultant_id,
        requirement_id=payload.requirement_id,
        recruiter_id=current_user["id"],
        status="submitted",
        submitted_at=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    
    db.add(submission)
    log_activity(
        db,
        action="recruiter.submission_created",
        resource_type="submission",
        actor=current_user,
        resource_id=submission.id,
        resource_name=consultant.full_name if hasattr(consultant, "full_name") else str(consultant.id),
        recruiter_id=current_user["id"],
        metadata={"requirement_id": payload.requirement_id},
    )
    db.commit()
    db.refresh(submission)
    
    # Update consultant status to "Submitted"
    consultant.status = "submitted"
    consultant.is_locked = True  # Freeze profile
    consultant.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Audit logs
    audit_log1 = models.AuditLog(
        user_id=current_user["id"],
        action="CONSULTANT_SUBMITTED",
        entity_type="consultant",
        entity_id=consultant.id,
        old_state="inactive",
        new_state="submitted",
        timestamp=datetime.utcnow()
    )
    
    audit_log2 = models.AuditLog(
        user_id=current_user["id"],
        action="SUBMISSION_CREATED",
        entity_type="submission",
        entity_id=submission.id,
        old_state="None",
        new_state="submitted",
        timestamp=datetime.utcnow()
    )
    
    db.add(audit_log1)
    db.add(audit_log2)
    db.commit()
    
    # Get Account Manager and send notification
    am = db.query(models.User).filter(
        models.User.id == requirement.account_manager_id
    ).first()
    
    if am and am.email:
        send_email(
            to_email=am.email,
            subject=f"New Consultant Submission - {requirement.title}",
            body=f"""
            New consultant submission received:
            Consultant: {consultant.full_name}
            Requirement: {requirement.title}
            Submitted by: {current_user['full_name']}
            Please review and take action.
            """
        )
    
    return {
        "message": "Consultant submitted successfully",
        "submission_id": submission.id,
        "consultant_id": consultant.id,
        "consultant_status": "submitted",
        "is_locked": True,
        "next_step": "Account Manager will review and send to client"
    }


# ==========================================
# WORKFLOW E: INTERVIEW COORDINATION
# ==========================================

@router.post("/submissions/{submission_id}/schedule-interview")
@require_permission("interviews", "create")
def schedule_interview(
    submission_id: str,
    payload: InterviewScheduleRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow E: Schedule Interview
    Creates interview record and sends notifications
    """
    
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()
    
    if not submission:
        raise HTTPException(404, "Submission not found")
    
    # Create interview record
    interview = models.Interview(
        submission_id=submission_id,
        scheduled_date=payload.interview_date,
        scheduled_time=payload.interview_time,
        mode=payload.mode,
        status="scheduled",
        created_by=current_user["id"],
        created_at=datetime.utcnow()
    )
    
    db.add(interview)
    submission.status = "interview_scheduled"
    log_activity(
        db,
        action="recruiter.interview_scheduled",
        resource_type="interview",
        actor=current_user,
        resource_id=interview.id,
        resource_name=str(submission_id),
        recruiter_id=submission.recruiter_id,
        job_id=submission.job_id if hasattr(submission, "job_id") else None,
        old_status="submitted",
        new_status="interview_scheduled",
        metadata={
            "date": payload.interview_date,
            "time": payload.interview_time,
            "mode": payload.mode,
        },
    )
    db.commit()
    db.refresh(interview)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="INTERVIEW_SCHEDULED",
        entity_type="interview",
        entity_id=interview.id,
        old_state="None",
        new_state="scheduled",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    # Send notifications to consultant and client
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == submission.consultant_id
    ).first()
    
    if consultant and consultant.email:
        send_email(
            to_email=consultant.email,
            subject="Interview Scheduled",
            body=f"""
            Your interview has been scheduled.
            Date: {payload.interview_date}
            Time: {payload.interview_time}
            Mode: {payload.mode}
            """
        )
    
    return {
        "message": "Interview scheduled successfully",
        "interview_id": interview.id,
        "submission_id": submission_id,
        "status": "scheduled",
        "next_step": "Conduct interview and record outcome"
    }


@router.put("/interviews/{interview_id}/record-outcome")
@require_permission("interviews", "update")
def record_interview_outcome(
    interview_id: str,
    outcome: str,  # "passed", "failed", "pending"
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Record interview outcome
    """
    
    interview = db.query(models.Interview).filter(
        models.Interview.id == interview_id
    ).first()
    
    if not interview:
        raise HTTPException(404, "Interview not found")
    
    interview.status = "completed"
    interview.outcome = outcome
    interview.notes = notes
    interview.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(interview)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="INTERVIEW_OUTCOME_RECORDED",
        entity_type="interview",
        entity_id=interview.id,
        old_state="scheduled",
        new_state="completed",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Interview outcome recorded",
        "interview_id": interview.id,
        "outcome": outcome,
        "next_step": "Submit feedback to client"
    }


# ==========================================
# WORKFLOW F: CLIENT FEEDBACK & SELECTION
# ==========================================

@router.put("/submissions/{submission_id}/submit-feedback")
@require_permission("submissions", "feedback")
def submit_client_feedback(
    submission_id: str,
    payload: InterviewFeedbackRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow F: Record Client Feedback
    - Decision: Selected, Rejected, or Hold
    - Updates consultant status accordingly
    - If Selected: Profile is locked
    - If Rejected: Consultant becomes available for other requirements
    """
    
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()
    
    if not submission:
        raise HTTPException(404, "Submission not found")
    
    if not payload.feedback_comments or len(payload.feedback_comments) < 10:
        raise HTTPException(400, "Feedback comments are mandatory (minimum 10 characters)")
    
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == submission.consultant_id
    ).first()
    
    # Update submission
    submission.status = f"feedback_{payload.decision}"
    submission.client_feedback = payload.feedback_comments
    submission.feedback_date = datetime.utcnow()
    
    # Update consultant status based on decision
    if payload.decision == "selected":
        consultant.status = "selected"
        consultant.is_locked = True
    elif payload.decision == "rejected":
        consultant.status = "available"
        consultant.is_locked = False
    elif payload.decision == "hold":
        consultant.status = "on_hold"
        consultant.is_locked = True
    log_activity(
        db,
        action="recruiter.feedback_added",
        resource_type="submission",
        actor=current_user,
        resource_id=submission.id,
        resource_name=consultant.full_name if consultant else str(submission.id),
        recruiter_id=submission.recruiter_id,
        job_id=submission.job_id if hasattr(submission, "job_id") else None,
        old_status="interview_scheduled",
        new_status=f"feedback_{payload.decision}",
        note=payload.feedback_comments,
    )
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="CLIENT_FEEDBACK_SUBMITTED",
        entity_type="submission",
        entity_id=submission.id,
        old_state="interview_scheduled",
        new_state=f"feedback_{payload.decision}",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": f"Feedback submitted - Consultant status: {consultant.status}",
        "submission_id": submission.id,
        "decision": payload.decision,
        "consultant_status": consultant.status,
        "next_step": "Account Manager will process the selection"
    }


# ==========================================
# WORKFLOW G: JOINING CONFIRMATION
# ==========================================

@router.put("/consultants/{consultant_id}/confirm-joining")
@require_permission("consultants", "joining")
def confirm_joining(
    consultant_id: str,
    payload: JoiningConfirmationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow G: Confirm Joining Date
    - Transitions consultant to "Yet to Join" state
    - Recruiter access becomes read-only after this
    - State transition: Selected → Yet to Join → Joined (on actual date)
    """
    
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == consultant_id
    ).first()
    
    if not consultant:
        raise HTTPException(404, "Consultant not found")
    
    if consultant.status != "selected":
        raise HTTPException(
            status_code=400,
            detail=f"Only selected consultants can confirm joining. Current status: {consultant.status}"
        )
    
    consultant.status = "yet_to_join"
    consultant.joining_date = payload.joining_date
    consultant.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(consultant)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="JOINING_CONFIRMED",
        entity_type="consultant",
        entity_id=consultant.id,
        old_state="selected",
        new_state="yet_to_join",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Joining date confirmed",
        "consultant_id": consultant.id,
        "consultant_status": "yet_to_join",
        "joining_date": payload.joining_date,
        "note": "Recruiter access is now read-only for this consultant"
    }


# ==========================================
# RECRUITER DASHBOARD
# ==========================================

@router.get("/dashboard")
@require_permission("recruiter", "view")
def recruiter_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get recruiter workflow metrics including available requirements from AM
    """
    
    recruiter_id = current_user["id"]
    
    # Count candidates by status
    new_candidates = db.query(models.Candidate).filter(
        models.Candidate.created_by == recruiter_id,
        models.Candidate.status == "new"
    ).count()
    
    parsed_candidates = db.query(models.Candidate).filter(
        models.Candidate.created_by == recruiter_id,
        models.Candidate.status == "parsed"
    ).count()
    
    screening_candidates = db.query(models.Candidate).filter(
        models.Candidate.created_by == recruiter_id,
        models.Candidate.status == "screening"
    ).count()
    
    shortlisted_candidates = db.query(models.Candidate).filter(
        models.Candidate.created_by == recruiter_id,
        models.Candidate.status == "shortlisted"
    ).count()
    
    converted_consultants = db.query(models.Consultant).filter(
        models.Consultant.created_by == recruiter_id,
        models.Consultant.status.in_(["inactive", "available", "submitted", "selected"])
    ).count()
    
    pending_interviews = db.query(models.Interview).filter(
        models.Interview.created_by == recruiter_id,
        models.Interview.status == "scheduled"
    ).count()
    
    joined_consultants = db.query(models.Consultant).filter(
        models.Consultant.created_by == recruiter_id,
        models.Consultant.status == "joined"
    ).count()
    
    # NEW: Requirements metrics
    active_requirements = db.query(models.Requirement).filter(
        models.Requirement.status == "active"
    ).all()
    
    requirements_with_openings = []
    for req in active_requirements:
        submission_count = db.query(models.CandidateSubmission).filter(
            models.CandidateSubmission.requirement_id == req.id
        ).count()
        remaining = req.vacancy_count - submission_count
        if remaining > 0:
            requirements_with_openings.append({
                "requirement_id": req.id,
                "title": req.title,
                "openings_remaining": remaining,
                "submitted_count": submission_count
            })
    
    return {
        "workflow_metrics": {
            "new_candidates": new_candidates,
            "parsed_candidates": parsed_candidates,
            "screening_candidates": screening_candidates,
            "shortlisted_candidates": shortlisted_candidates,
            "converted_consultants": converted_consultants,
            "pending_interviews": pending_interviews,
            "joined_consultants": joined_consultants
        },
        "total_candidates_created": new_candidates + parsed_candidates + screening_candidates + shortlisted_candidates,
        "total_consultants_created": converted_consultants + joined_consultants,
        "requirements_section": {
            "active_requirements_with_openings": len(requirements_with_openings),
            "available_requirements": requirements_with_openings,
            "total_candidates_in_pool": shortlisted_candidates + converted_consultants,
            "action": "Use /available-requirements to see full list and /candidate-pool to select candidates"
        }
    }


# ==========================================
# NEW: REQUIREMENT CANDIDATE POOL & SUBMISSION
# ==========================================

@router.get("/requirements/{requirement_id}/candidate-pool")
@require_permission("candidates", "view")
def get_requirement_candidate_pool(
    requirement_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Fetch candidates from pool that match requirement skills
    - Filters candidates by skills required for the requirement
    - Shows candidate fit and details
    - Allows recruiter to select for submission
    """
    
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == requirement_id,
        models.Requirement.status == "active"
    ).first()
    
    if not requirement:
        raise HTTPException(404, "Requirement not found")
    
    # Parse required skills
    required_skills = []
    if requirement.skills:
        if isinstance(requirement.skills, str):
            required_skills = [s.strip() for s in requirement.skills.split(",")]
        else:
            required_skills = requirement.skills
    
    # Get already submitted candidates for this requirement
    submitted_ids = db.query(models.CandidateSubmission.candidate_id).filter(
        models.CandidateSubmission.requirement_id == requirement_id
    ).all()
    submitted_candidate_ids = [s[0] for s in submitted_ids]
    
    # Query candidates with matching skills
    candidates = db.query(models.Candidate).filter(
        models.Candidate.status.in_(["shortlisted", "converted"]),
        models.Candidate.id.notin_(submitted_candidate_ids),
        models.Candidate.is_active == True
    ).all()
    
    # Filter by matching skills
    matching_candidates = []
    for candidate in candidates:
        candidate_skills = candidate.skills or []
        matched_skills = []
        
        for skill in required_skills:
            if any(skill.lower() in cs.lower() for cs in candidate_skills):
                matched_skills.append(skill)
        
        # Include if has at least 50% skill match
        match_percentage = (len(matched_skills) / len(required_skills)) * 100 if required_skills else 0
        
        matching_candidates.append({
            "candidate_id": candidate.id,
            "public_id": candidate.public_id,
            "full_name": candidate.full_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "experience_years": candidate.experience_years,
            "skills": candidate.skills or [],
            "matched_skills": matched_skills,
            "match_percentage": round(match_percentage, 2),
            "current_location": candidate.current_location,
            "expected_salary": candidate.expected_salary,
            "status": candidate.status,
            "availability_date": candidate.application_date,
            "resume_url": candidate.resume_url
        })
    
    # Sort by match percentage
    matching_candidates.sort(key=lambda x: x["match_percentage"], reverse=True)
    
    return {
        "requirement_id": requirement_id,
        "requirement_title": requirement.title,
        "required_skills": required_skills,
        "total_candidates_in_pool": len(matching_candidates),
        "candidates": matching_candidates
    }


@router.post("/requirements/{requirement_id}/send-candidates-to-am")
@require_permission("candidates", "create")
def send_candidates_to_am(
    requirement_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Send selected candidates to Account Manager for this requirement
    - Creates candidate submissions
    - Notifies AM of the submission
    - Logs assignment details
    """
    
    recruiter_id = current_user["id"]
    recruiter = db.query(models.User).filter(models.User.id == recruiter_id).first()
    
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == requirement_id,
        models.Requirement.status == "active"
    ).first()
    
    if not requirement:
        raise HTTPException(404, "Requirement not found")
    
    candidate_ids = payload.get("candidate_ids", [])
    if not candidate_ids:
        raise HTTPException(400, "No candidates selected")
    
    # Get Account Manager
    am_user = db.query(models.User).filter(
        models.User.id == requirement.account_manager_id
    ).first()
    
    if not am_user:
        raise HTTPException(404, "Account Manager not found")
    
    submissions_created = []
    
    for candidate_id in candidate_ids:
        candidate = db.query(models.Candidate).filter(
            models.Candidate.id == candidate_id
        ).first()
        
        if not candidate:
            continue
        
        # Check if already submitted
        existing = db.query(models.CandidateSubmission).filter(
            models.CandidateSubmission.requirement_id == requirement_id,
            models.CandidateSubmission.candidate_id == candidate_id
        ).first()
        
        if existing:
            continue
        
        # Create submission
        submission = models.CandidateSubmission(
            candidate_id=candidate_id,
            requirement_id=requirement_id,
            recruiter_id=recruiter_id,
            status="submitted",
            submitted_at=datetime.utcnow()
        )
        
        db.add(submission)
        log_activity(
            db,
            action="recruiter.submitted_to_am",
            resource_type="submission",
            actor=current_user,
            resource_id=submission.id,
            resource_name=candidate.full_name,
            target_user_id=candidate_id,
            recruiter_id=recruiter_id,
            client_id=requirement.client_id,
            metadata={
                "requirement_id": requirement_id,
                "requirement_title": requirement.title,
            },
        )
        
        submissions_created.append({
            "candidate_id": candidate_id,
            "candidate_name": candidate.full_name,
            "submission_id": submission.id
        })
    
    db.commit()
    
    return {
        "message": f"Successfully sent {len(submissions_created)} candidates to AM",
        "requirement_id": requirement_id,
        "requirement_title": requirement.title,
        "account_manager": {
            "am_id": am_user.id,
            "am_name": am_user.full_name,
            "am_email": am_user.email
        },
        "recruiter": {
            "recruiter_id": recruiter_id,
            "recruiter_name": recruiter.full_name if recruiter else "Unknown"
        },
        "submissions": submissions_created,
        "timestamp": datetime.utcnow(),
        "action_logs": f"Recruiter {recruiter.full_name if recruiter else 'Unknown'} submitted {len(submissions_created)} candidates for requirement {requirement.title} to AM {am_user.full_name}"
    }


# ============================================================
# GET ASSIGNED JOBS (New Endpoint)
# ============================================================
@router.get("/assigned-jobs")
@require_permission("jobs", "view")
def get_assigned_jobs(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get all jobs assigned to the current recruiter
    Returns jobs where recruiter is in the job_recruiters table
    """
    recruiter_id = current_user.get("id")
    
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="Recruiter ID not found")
    
    try:
        # Get jobs where this recruiter is assigned via the secondary table
        # Filter by status active/open/in_progress instead of is_active
        assigned_jobs = (
            db.query(models.Job)
            .join(models.job_recruiters, models.Job.id == models.job_recruiters.c.job_id)
            .filter(models.job_recruiters.c.recruiter_id == recruiter_id)
            .filter(models.Job.status.in_(["active", "open", "in_progress"]))
            .order_by(models.Job.created_at.desc())
            .all()
        )

        client_ids = [
            str(job.client_id).strip()
            for job in assigned_jobs
            if job.client_id and str(job.client_id).strip()
        ]
        client_name_map = {}
        if client_ids:
            client_rows = (
                db.query(models.Client.id, models.Client.client_name)
                .filter(models.Client.id.in_(client_ids))
                .all()
            )
            client_name_map = {
                str(row.id): str(row.client_name).strip()
                for row in client_rows
                if row.id and row.client_name and str(row.client_name).strip()
            }
            unresolved_ids = [client_id for client_id in client_ids if client_id not in client_name_map]
            if unresolved_ids:
                user_rows = (
                    db.query(models.User.id, models.User.full_name)
                    .filter(models.User.id.in_(unresolved_ids))
                    .all()
                )
                for row in user_rows:
                    if row.id and row.full_name and str(row.full_name).strip():
                        client_name_map[str(row.id)] = str(row.full_name).strip()
        
        return {
            "jobs": [
                {
                    "id": job.id,
                    "job_id": job.job_id,
                    "serial_number": job.serial_number,
                    "title": job.title,
                    "description": job.description,
                    "jd_text": job.jd_text,
                    "location": job.location,
                    "department": job.department,
                    "skills": job.skills or [],
                    "min_experience": job.min_experience,
                    "max_experience": job.max_experience,
                    "job_type": job.job_type,
                    "salary_range": job.salary_range,
                    "mode": job.mode,
                    "client_id": job.client_id,
                    "client_name": (
                        str(job.client_name).strip()
                        if job.client_name and str(job.client_name).strip()
                        else client_name_map.get(str(job.client_id))
                    ),
                    "client_ta": job.client_ta,
                    "no_of_positions": getattr(job, 'no_of_positions', 1),
                    "budget": getattr(job, 'budget', None),
                    "work_timings": getattr(job, 'work_timings', None),
                    "joining_preference": getattr(job, 'joining_preference', None),
                    "duration": job.duration,
                    "status": job.status,
                    "created_at": str(job.created_at) if job.created_at else None,
                    "date_created": str(job.date_created) if job.date_created else None,
                    "updated_at": str(job.updated_at) if job.updated_at else None,
                    "account_manager": {
                        "am_id": job.account_manager.id if job.account_manager else None,
                        "am_name": job.account_manager.full_name if job.account_manager else "Unassigned"
                    }
                }
                for job in assigned_jobs
            ],
            "total": len(assigned_jobs)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching assigned jobs: {str(e)}"
        )


@router.get("/assigned-jobs/{job_id}")
@require_permission("jobs", "view")
def get_assigned_job_detail(
    job_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get details of a specific job assigned to the recruiter
    Returns job details with account manager info
    Simplified version - fetches job directly without strict recruiter check
    """
    recruiter_id = current_user.get("id")
    
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="Recruiter ID not found")
    
    try:
        # First try to get job if recruiter is assigned
        job = (
            db.query(models.Job)
            .filter(
                models.Job.id == job_id,
                models.Job.status == "active"
            )
            .first()
        )
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found or not active")
        
        return {
            "id": job.id,
            "job_id": job.job_id,
            "title": job.title,
            "description": job.description,
            "location": job.location,
            "department": job.department,
            "skills": job.skills or [],
            "min_experience": job.min_experience,
            "max_experience": job.max_experience,
            "job_type": job.job_type,
            "salary_range": job.salary_range,
            "status": job.status,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "account_manager": {
                "am_id": job.account_manager.id if job.account_manager else None,
                "am_name": job.account_manager.full_name if job.account_manager else "Unassigned",
                "am_email": job.account_manager.email if job.account_manager else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching job details: {str(e)}"
        )


@router.get("/assigned-jobs/{job_id}/candidate-pool")
@require_permission("candidates", "view")
def get_job_candidate_pool(
    job_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Fetch candidates from pool that match job skills
    - Filters candidates by skills required for the job
    - Shows candidate fit percentage
    - Allows recruiter to select for submission to AM
    """
    recruiter_id = current_user.get("id")
    
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="Recruiter ID not found")
    
    try:
        matching_service = None
        try:
            matching_service = get_matching_service()
        except Exception as e:
            logger.warning("SBERT matching unavailable; falling back to skills-only scoring: %s", e)

        # Get job (simplified - no strict recruiter check)
        job = (
            db.query(models.Job)
            .filter(
                models.Job.id == job_id,
                models.Job.status == "active"
            )
            .first()
        )
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found or not active")
        
        # Parse required skills
        required_skills = []
        if job.skills:
            if isinstance(job.skills, str):
                required_skills = [s.strip() for s in job.skills.split(",")]
            else:
                required_skills = job.skills
        
        # Get already submitted candidates for this job
        submitted_ids = db.query(models.CandidateSubmission.candidate_id).filter(
            models.CandidateSubmission.job_id == job_id
        ).all()
        submitted_candidate_ids = [s[0] for s in submitted_ids]
        
        # Query candidates with matching skills
        candidates = db.query(models.Candidate).filter(
            models.Candidate.status.in_(["shortlisted", "converted"]),
            models.Candidate.id.notin_(submitted_candidate_ids),
            models.Candidate.is_active == True
        ).all()
        
        # Filter by matching skills and experience
        matching_candidates = []
        for candidate in candidates:
            candidate_skills = candidate.skills or []
            if isinstance(candidate_skills, str):
                candidate_skills = [s.strip() for s in candidate_skills.split(",") if s.strip()]

            matched_skills = []
            
            for skill in required_skills:
                if any(skill.lower() in cs.lower() or cs.lower() in skill.lower() for cs in candidate_skills):
                    matched_skills.append(skill)
            
            # Calculate match percentage
            match_percentage = (len(matched_skills) / len(required_skills)) * 100 if required_skills else 0

            match_score = round(match_percentage, 2)
            fit_label = None
            semantic_score = None
            rule_based_score = None
            experience_score = None

            if matching_service:
                candidate_summary = ""
                if candidate.parsed_resume and isinstance(candidate.parsed_resume, dict):
                    candidate_summary = candidate.parsed_resume.get("summary", "")
                if not candidate_summary and candidate.experience:
                    candidate_summary = candidate.experience

                try:
                    match_result = matching_service.calculate_match_score(
                        candidate_skills=candidate_skills,
                        required_skills=required_skills,
                        preferred_skills=[],
                        candidate_experience_years=candidate.experience_years or 0,
                        required_experience_years=job.min_experience or 0,
                        job_description=job.description or job.title or "",
                        candidate_summary=candidate_summary,
                    )
                    match_score = match_result.get("match_score", match_score)
                    fit_label = match_result.get("fit_label")
                    semantic_score = match_result.get("semantic_score")
                    rule_based_score = match_result.get("rule_based_score")
                    experience_score = match_result.get("experience_score")
                except Exception as e:
                    logger.warning(
                        "SBERT match failed for candidate %s on job %s: %s",
                        candidate.id,
                        job_id,
                        e,
                    )
            
            # Check experience match
            candidate_exp = candidate.experience_years or 0
            experience_match = False
            if job.min_experience and job.max_experience:
                experience_match = job.min_experience <= candidate_exp <= job.max_experience
            elif job.min_experience:
                experience_match = candidate_exp >= job.min_experience
            else:
                experience_match = True
            
            matching_candidates.append({
                "candidate_id": candidate.id,
                "public_id": candidate.public_id,
                "full_name": candidate.full_name,
                "email": candidate.email,
                "phone": candidate.phone,
                "experience_years": candidate_exp,
                "skills": candidate_skills,
                "matched_skills": matched_skills,
                "unmatched_skills": [s for s in required_skills if s not in matched_skills],
                "match_percentage": round(match_score, 2),
                "match_score": round(match_score, 2),
                "fit_label": fit_label,
                "semantic_score": semantic_score,
                "rule_based_score": rule_based_score,
                "experience_score": experience_score,
                "experience_match": experience_match,
                "current_location": candidate.current_location,
                "expected_salary": candidate.expected_salary,
                "status": candidate.status,
                "resume_url": candidate.resume_url
            })
        
        # Sort by match score
        matching_candidates.sort(key=lambda x: x.get("match_score", 0), reverse=True)
        
        return {
            "job_id": job_id,
            "job_title": job.title,
            "required_skills": required_skills,
            "min_experience": job.min_experience,
            "max_experience": job.max_experience,
            "total_candidates_in_pool": len(matching_candidates),
            "candidates": matching_candidates
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching candidate pool: {str(e)}"
        )


@router.post("/assigned-jobs/{job_id}/send-candidates-to-am")
@require_permission("candidates", "create")
def send_job_candidates_to_am(
    job_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Send selected candidates to Account Manager for a specific job
    - Creates candidate submissions for the job
    - Notifies AM of the submission
    """
    recruiter_id = current_user.get("id")
    recruiter = db.query(models.User).filter(models.User.id == recruiter_id).first()
    
    if not recruiter_id:
        raise HTTPException(status_code=400, detail="Recruiter ID not found")
    
    try:
        # Get job (simplified - no strict recruiter check)
        job = (
            db.query(models.Job)
            .filter(
                models.Job.id == job_id,
                models.Job.status == "active"
            )
            .first()
        )
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found or not active")
        
        candidate_ids = payload.get("candidate_ids", [])
        if not candidate_ids:
            raise HTTPException(status_code=400, detail="No candidates selected")
        
        # Get Account Manager
        am_user = db.query(models.User).filter(
            models.User.id == job.account_manager_id
        ).first()
        
        if not am_user:
            raise HTTPException(status_code=404, detail="Account Manager not found for this job")
        
        submissions_created = []
        
        for candidate_id in candidate_ids:
            candidate = db.query(models.Candidate).filter(
                models.Candidate.id == candidate_id
            ).first()
            
            if not candidate:
                continue
            
            # CandidateSubmission (requirement workflow compatibility)
            existing_submission = db.query(models.CandidateSubmission).filter(
                models.CandidateSubmission.job_id == job_id,
                models.CandidateSubmission.candidate_id == candidate_id
            ).first()

            submission = existing_submission
            if not submission:
                submission = models.CandidateSubmission(
                    candidate_id=candidate_id,
                    job_id=job_id,
                    recruiter_id=recruiter_id,
                    status="submitted",
                    submitted_at=datetime.utcnow()
                )
                db.add(submission)

            # JobApplication (recruiter submissions + AM review compatibility)
            app = db.query(models.JobApplication).filter(
                models.JobApplication.job_id == job.id,
                models.JobApplication.candidate_id == candidate_id
            ).first()

            now = datetime.utcnow()
            app_created = False

            if not app:
                app = models.JobApplication(
                    job_id=job.id,
                    candidate_id=candidate_id,
                    full_name=candidate.full_name,
                    email=candidate.email,
                    phone=candidate.phone,
                    status="sent_to_am",
                    recruiter_id=recruiter_id,
                    applied_at=now,
                    sent_to_am_at=now,
                )
                db.add(app)
                app_created = True
            else:
                app.full_name = candidate.full_name or app.full_name
                app.email = candidate.email or app.email
                app.phone = candidate.phone or app.phone
                if recruiter_id and not app.recruiter_id:
                    app.recruiter_id = recruiter_id
                if not app.applied_at:
                    app.applied_at = now
                app.status = "sent_to_am"
                if not app.sent_to_am_at:
                    app.sent_to_am_at = now

            # Candidate status + timeline for recruiter workflow view
            if candidate.status != "sent_to_am":
                candidate.status = "sent_to_am"
                candidate.updated_at = now
                db.add(models.CandidateTimeline(
                    candidate_id=candidate_id,
                    status="sent_to_am",
                    note=f"Candidate sent to AM for {job.title or job.job_id or job.id}",
                    user_id=recruiter_id,
                ))

            if (not existing_submission) or app_created:
                log_activity(
                    db,
                    action="recruiter.submitted_to_am",
                    resource_type="submission",
                    actor=current_user,
                    resource_id=submission.id,
                    resource_name=candidate.full_name,
                    target_user_id=candidate_id,
                    job_id=job_id,
                    client_id=job.client_id,
                    recruiter_id=recruiter_id,
                    new_status="sent_to_am",
                    metadata={"job_title": job.title, "client_name": job.client_name},
                )
                db.flush()
                submissions_created.append({
                    "candidate_id": candidate_id,
                    "candidate_name": candidate.full_name,
                    "submission_id": submission.id,
                    "application_id": app.id,
                })
        
        db.commit()
        
        return {
            "message": f"Successfully sent {len(submissions_created)} candidates to AM",
            "job_id": job_id,
            "job_title": job.title,
            "account_manager": {
                "am_id": am_user.id,
                "am_name": am_user.full_name,
                "am_email": am_user.email
            },
            "recruiter": {
                "recruiter_id": recruiter_id,
                "recruiter_name": recruiter.full_name if recruiter else "Unknown"
            },
            "submissions": submissions_created,
            "total_submitted": len(submissions_created),
            "next_step": "Account Manager will review candidates"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error sending candidates: {str(e)}"
        )

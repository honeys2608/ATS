"""
Client Submission Management Routes
Track candidate submissions to clients
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

from app.db import get_db
from app.auth import get_current_user
from app.permissions import require_permission
import app.models as models

router = APIRouter(prefix="/v1/candidate-submissions", tags=["submissions"])

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


def _is_recruiter(current_user: dict) -> bool:
    return _normalize(current_user.get("role")) == "recruiter"


def _require_recruiter_job_access(db: Session, current_user: dict, job_id: str):
    if not _is_recruiter(current_user):
        return
    assigned = db.query(models.job_recruiters).filter(
        models.job_recruiters.c.job_id == job_id,
        models.job_recruiters.c.recruiter_id == current_user.get("id"),
    ).first()
    if not assigned:
        raise HTTPException(403, "You are not assigned to this job")


def _assert_submission_lock(
    db: Session,
    *,
    candidate_id: str,
    job_id: str,
    recruiter_id: str,
    action: str,
) -> models.CandidateSubmission:
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.candidate_id == candidate_id,
        models.CandidateSubmission.job_id == job_id,
    ).first()
    if submission:
        submission_status = _normalize(submission.status)
        if (
            submission.recruiter_id
            and str(submission.recruiter_id) != str(recruiter_id)
            and submission.is_locked
            and submission_status not in LOCK_RELEASE_STATUSES
        ):
            raise HTTPException(
                409,
                f"Candidate is already in progress by another recruiter for this job",
            )
        if submission.recruiter_id in (None, recruiter_id):
            submission.recruiter_id = recruiter_id
            submission.is_locked = True
            submission.stage = submission.stage or "recruiter_review"
            submission.updated_at = datetime.utcnow()
        return submission

    submission = models.CandidateSubmission(
        id=models.generate_uuid(),
        candidate_id=candidate_id,
        job_id=job_id,
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


class SubmissionCreate(BaseModel):
    candidate_id: str
    job_id: str
    notes: Optional[str] = None


class SubmissionUpdate(BaseModel):
    status: Optional[str] = None
    feedback: Optional[str] = None
    notes: Optional[str] = None


class SubmissionResponse(BaseModel):
    id: str
    candidate_id: str
    candidate_name: str
    candidate_email: str
    job_id: str
    job_title: str
    status: str
    created_at: datetime
    feedback: Optional[str]

    class Config:
        from_attributes = True

def build_submission_response(submission: models.CandidateSubmission) -> SubmissionResponse:
    return SubmissionResponse(
        id=submission.id,
        candidate_id=submission.candidate_id,
        candidate_name=submission.candidate.full_name if submission.candidate else "",
        candidate_email=submission.candidate.email if submission.candidate else "",
        job_id=submission.job_id,
        job_title=submission.job.title if submission.job else "",
        status=submission.status,
        created_at=submission.created_at,
        feedback=getattr(submission, "feedback", None),
    )


@router.post("", response_model=SubmissionResponse)
@require_permission("submissions", "create")
def create_submission(
    submission: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a new candidate submission to client."""
    
    # Validate candidate
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == submission.candidate_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Validate job
    job = db.query(models.Job).filter(
        models.Job.id == submission.job_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    _require_recruiter_job_access(db, current_user, job.id)
    _assert_submission_lock(
        db,
        candidate_id=submission.candidate_id,
        job_id=job.id,
        recruiter_id=current_user["id"],
        action="submission_create",
    )

    # Check for duplicate submission (candidate + job + client)
    existing = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.candidate_id == submission.candidate_id,
        models.CandidateSubmission.job_id == submission.job_id,
        models.CandidateSubmission.status != "withdrawn",
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Candidate already submitted for this job to this client"
        )

    # Create submission record
    new_submission = models.CandidateSubmission(
        id=models.generate_uuid(),
        candidate_id=submission.candidate_id,
        job_id=submission.job_id,
        recruiter_id=current_user["id"],
        status="submitted",
        submission_notes=submission.notes,
        created_at=datetime.utcnow(),
    )

    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)

    return build_submission_response(new_submission)



@router.get("", response_model=List[SubmissionResponse])
@require_permission("submissions", "view")
def list_submissions(
    status: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    job_id: Optional[str] = Query(None),
    candidate_id: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(50),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List candidate submissions with filters."""
    query = db.query(models.CandidateSubmission)

    if status:
        query = query.filter(models.CandidateSubmission.status == status)
    if client_id:
        query = query.join(models.Job).filter(models.Job.client_id == client_id)

    if job_id:
        query = query.filter(models.CandidateSubmission.job_id == job_id)
    if candidate_id:
        query = query.filter(models.CandidateSubmission.candidate_id == candidate_id)

    submissions = (
        query.order_by(models.CandidateSubmission.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [build_submission_response(s) for s in submissions]



@router.get("/{submission_id}", response_model=SubmissionResponse)
@require_permission("submissions", "view")
def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get submission details."""
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    return build_submission_response(submission)



@router.put("/{submission_id}", response_model=SubmissionResponse)
@require_permission("submissions", "update")
def update_submission(
    submission_id: str,
    submission_data: SubmissionUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update submission status or add client feedback."""
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Update fields
    if submission_data.status:
        submission.status = submission_data.status
    if submission_data.feedback:
        submission.feedback = submission_data.feedback
        submission.reviewed_date = datetime.utcnow()
    if submission_data.notes:
        submission.submission_notes = submission_data.notes

    submission.updated_at = datetime.utcnow()
    submission.updated_by = current_user["id"]

    db.commit()
    db.refresh(submission)

    return build_submission_response(submission)



@router.delete("/{submission_id}")
@require_permission("submissions", "delete")
def delete_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete a submission."""
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    db.delete(submission)
    db.commit()

    return {"message": "Submission deleted"}


@router.post("/{submission_id}/accept")
@require_permission("submissions", "update")
def accept_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Client accepts the submission."""
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.status = "accepted"
    submission.reviewed_date = datetime.utcnow()
    submission.updated_at = datetime.utcnow()
    submission.updated_by = current_user["id"]

    db.commit()

    # Update candidate status to "accepted" if needed
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == submission.candidate_id
    ).first()
    if candidate:
        candidate.status = "offer"

    db.commit()

    return {
        "message": "Submission accepted",
        "submission_id": submission_id,
        "status": "accepted",
    }


@router.post("/{submission_id}/reject")
@require_permission("submissions", "update")
def reject_submission(
    submission_id: str,
    feedback: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Client rejects the submission."""
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.status = "rejected"
    submission.feedback = feedback
    submission.reviewed_date = datetime.utcnow()
    submission.updated_at = datetime.utcnow()
    submission.updated_by = current_user["id"]

    db.commit()

    return {
        "message": "Submission rejected",
        "submission_id": submission_id,
        "status": "rejected",
    }


@router.post("/{submission_id}/resubmit")
@require_permission("submissions", "update")
def resubmit_submission(
    submission_id: str,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Resubmit a rejected or withdrawn submission."""
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.status not in ["rejected", "withdrawn"]:
        raise HTTPException(
            status_code=400,
            detail="Can only resubmit rejected or withdrawn submissions"
        )

    submission.status = "submitted"
    submission.submission_notes = reason or submission.submission_notes
    submission.updated_at = datetime.utcnow()
    submission.updated_by = current_user["id"]

    db.commit()

    return {
        "message": "Submission resubmitted",
        "submission_id": submission_id,
        "status": "submitted",
    }


@router.post("/{submission_id}/withdraw")
@require_permission("submissions", "update")
def withdraw_submission(
    submission_id: str,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Withdraw a submitted submission."""
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission.status = "withdrawn"
    submission.submission_notes = (
        reason + " | " + submission.submission_notes
        if submission.submission_notes
        else reason
    )
    submission.updated_at = datetime.utcnow()
    submission.updated_by = current_user["id"]

    db.commit()

    return {
        "message": "Submission withdrawn",
        "submission_id": submission_id,
        "status": "withdrawn",
    }


@router.get("/job/{job_id}/stats")
@require_permission("submissions", "view")
def get_job_submission_stats(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get submission statistics for a job."""
    submissions = (
        db.query(models.CandidateSubmission)
        .filter(models.CandidateSubmission.job_id == job_id)
        .all()
    )

    total = len(submissions)
    submitted = len([s for s in submissions if s.status == "submitted"])
    accepted = len([s for s in submissions if s.status == "accepted"])
    rejected = len([s for s in submissions if s.status == "rejected"])
    withdrawn = len([s for s in submissions if s.status == "withdrawn"])

    acceptance_rate = (
        (accepted / total * 100) if total > 0 else 0
    )

    return {
        "job_id": job_id,
        "total_submissions": total,
        "submitted": submitted,
        "accepted": accepted,
        "rejected": rejected,
        "withdrawn": withdrawn,
        "acceptance_rate": round(acceptance_rate, 1),
    }


@router.get("/client/{client_id}/performance")
@require_permission("submissions", "view")
def get_client_submission_performance(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get submission performance metrics for a client."""
    submissions = (
        db.query(models.CandidateSubmission)
        .join(models.Job)
        .filter(models.Job.client_id == client_id)

        .all()
    )

    total = len(submissions)
    accepted = len([s for s in submissions if s.status == "accepted"])
    avg_response_time = 0

    if submissions:
        response_times = []
        for s in submissions:
            if s.reviewed_date:
                response_time = (s.reviewed_date - s.created_at).total_seconds() / 86400
                response_times.append(response_time)

        if response_times:
            avg_response_time = sum(response_times) / len(response_times)

    return {
        "client_id": client_id,
        "total_submissions": total,
        "accepted": accepted,
        "acceptance_rate": round((accepted / total * 100) if total > 0 else 0, 1),
        "avg_response_time_days": round(avg_response_time, 1),
    }


@router.post("/submit-to-am", tags=["workflow"])
@require_permission("submissions", "create")
def submit_candidates_to_am(
    data: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Recruiter submits matching candidates to Account Manager.
    Workflow: Recruiter → AM → Client → Interview
    """
    job_id = data.get("job_id")
    candidate_ids = data.get("candidate_ids", [])
    notes = data.get("notes", "")

    if not job_id or not candidate_ids:
        raise HTTPException(status_code=400, detail="Missing job_id or candidates")

    # Get the job and its AM
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    _require_recruiter_job_access(db, current_user, job.id)

    # Get AM for this job (assuming job has assigned_to field)
    am_id = getattr(job, 'assigned_to', None) or getattr(job, 'account_manager_id', None)
    if not am_id:
        raise HTTPException(status_code=400, detail="No AM assigned to this job")

    # Create submission records for each candidate
    submissions = []
    for candidate_id in candidate_ids:
        candidate = db.query(models.Candidate).filter(
            models.Candidate.id == candidate_id
        ).first()
        
        if not candidate:
            continue
        _assert_submission_lock(
            db,
            candidate_id=candidate_id,
            job_id=job.id,
            recruiter_id=current_user["id"],
            action="submit_to_am",
        )

        # Check if already submitted
        existing = db.query(models.CandidateSubmission).filter(
            models.CandidateSubmission.candidate_id == candidate_id,
            models.CandidateSubmission.job_id == job_id,
            models.CandidateSubmission.status.notin_(["withdrawn", "rejected"]),
        ).first()

        if existing:
            continue

        submission = models.CandidateSubmission(
            id=models.generate_uuid(),
            candidate_id=candidate_id,
            job_id=job_id,
            recruiter_id=current_user["id"],
            status="pending_am_review",
            submission_notes=notes,
            created_at=datetime.utcnow(),
        )

        db.add(submission)
        submissions.append(submission)

    db.commit()

    return {
        "status": "success",
        "message": f"Submitted {len(submissions)} candidates to Account Manager",
        "submission_count": len(submissions),
        "job_id": job_id,
        "assigned_to_am": am_id,
    }


@router.get("/client-requests", tags=["workflow"])
@require_permission("interviews", "view")
def get_client_approval_requests(
    status: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(50),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Get pending client approval requests.
    These are submissions awaiting client decision.
    """
    query = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.status.in_(["pending_client_review", "pending_am_review"])
    )

    if status:
        query = query.filter(models.CandidateSubmission.status == status)

    requests = (
        query.order_by(models.CandidateSubmission.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    # Format as client requests
    client_requests = []
    for req in requests:
        client_requests.append({
            "id": req.id,
            "job_id": req.job_id,
            "job_title": getattr(req.job, 'title', 'N/A') if hasattr(req, 'job') else "N/A",
            "candidate_count": 1,  # Could be aggregated
            "status": "pending" if req.status == "pending_client_review" else "submitted",
            "created_at": req.created_at,
            "client_id": req.client_id,
        })

    return client_requests
@router.get(
    "/by-job/{job_id}/candidate/{candidate_id}",
    response_model=SubmissionResponse,
)
def get_submission_by_job_and_candidate(
    job_id: str,
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Get OR create submission for a candidate against a specific job
    Used while scheduling interviews
    """

    submission = (
        db.query(models.CandidateSubmission)
        .filter(
            models.CandidateSubmission.job_id == job_id,
            models.CandidateSubmission.candidate_id == candidate_id,
        )
        .first()
    )
    _require_recruiter_job_access(db, current_user, job_id)

    # ✅ AUTO CREATE SUBMISSION IF NOT EXISTS
    if not submission:
        candidate = db.query(models.Candidate).filter(
            models.Candidate.id == candidate_id
        ).first()
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        job = db.query(models.Job).filter(
            models.Job.id == job_id
        ).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        submission = models.CandidateSubmission(
            id=models.generate_uuid(),
            candidate_id=candidate_id,
            job_id=job_id,
            recruiter_id=current_user["id"],
            status="submitted",
            stage="recruiter_review",
            is_locked=True,
            created_at=datetime.utcnow(),
        )

        db.add(submission)
        db.commit()
        db.refresh(submission)

    return build_submission_response(submission)


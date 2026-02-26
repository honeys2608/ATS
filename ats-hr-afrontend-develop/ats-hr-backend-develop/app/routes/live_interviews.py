from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
import uuid

from app.db import get_db
from app.auth import get_current_user
from app import models, schemas

router = APIRouter(
    prefix="/v1/live-interviews",
    tags=["Live Interviews"]
)

# ============================================================
# 1️⃣ CREATE LIVE INTERVIEW
# ============================================================
@router.post(
    "",
    response_model=schemas.LiveInterviewJoinResponse,
    dependencies=[Depends(get_current_user)]
)
def create_live_interview(
    data: schemas.LiveInterviewCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    submission = (
        db.query(models.CandidateSubmission)
        .filter(models.CandidateSubmission.id == data.submission_id)
        .first()
    )

    if not submission:
        raise HTTPException(404, "Submission not found")

    # ✅ Meeting link logic
    meeting_link = None
    if data.type == schemas.LiveInterviewTypeEnum.video:
        meeting_link = (
            data.meeting_link
            or f"https://meet.yourapp.com/{uuid.uuid4().hex[:8]}"
        )

    interview = models.LiveInterview(
        submission_id=submission.id,
        interviewer_id=current_user.get("id"),
        scheduled_at=data.scheduled_at,
        meeting_link=meeting_link,
        recording_enabled=data.recording_enabled,
        status="scheduled",
        created_at=datetime.utcnow()
    )

    db.add(interview)
    db.commit()
    db.refresh(interview)

    return {
        "interview_id": interview.id,
        "meeting_link": interview.meeting_link,
        "recording_enabled": interview.recording_enabled
    }


# ============================================================
# 2️⃣ LIST LIVE INTERVIEWS
# ============================================================
@router.get(
    "",
    response_model=list[schemas.LiveInterviewBase],
    dependencies=[Depends(get_current_user)]
)
def list_live_interviews(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = (
        db.query(models.LiveInterview)
        .options(
            joinedload(models.LiveInterview.submission)
                .joinedload(models.CandidateSubmission.candidate),
            joinedload(models.LiveInterview.submission)
                .joinedload(models.CandidateSubmission.job),
        )
        .order_by(models.LiveInterview.created_at.desc())
    )

    # ✅ Candidate → only own interviews
    if current_user.get("role") == "candidate":
        candidate_id = (
            current_user.get("id")
            or current_user.get("candidate_id")
            or current_user.get("candidate", {}).get("id")
        )

        if candidate_id:
            query = (
                query.join(
                    models.CandidateSubmission,
                    models.LiveInterview.submission_id
                    == models.CandidateSubmission.id
                )
                .filter(models.CandidateSubmission.candidate_id == candidate_id)
            )

    return query.all()


# ============================================================
# 3️⃣ LIVE INTERVIEW DETAIL
# ============================================================
@router.get(
    "/{interview_id}",
    response_model=schemas.LiveInterviewBase,
    dependencies=[Depends(get_current_user)]
)
def get_live_interview_detail(
    interview_id: str,
    db: Session = Depends(get_db),
):
    interview = (
        db.query(models.LiveInterview)
        .options(
            joinedload(models.LiveInterview.submission)
                .joinedload(models.CandidateSubmission.candidate),
            joinedload(models.LiveInterview.submission)
                .joinedload(models.CandidateSubmission.job),
        )
        .filter(models.LiveInterview.id == interview_id)
        .first()
    )

    if not interview:
        raise HTTPException(404, "Live interview not found")

    return interview

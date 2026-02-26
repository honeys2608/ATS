# app/routes/ai_video_interviews.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db import get_db
from app.auth import get_current_user
from app import models, schemas
from app.ai_core import generate_video_interview_questions
from app.models import LiveInterview
import uuid

router = APIRouter(
    prefix="/v1/ai-video-interviews",
    tags=["AI Video Interviews"]
)

# ============================================================
# 1️⃣ CREATE AI VIDEO INTERVIEW
# ============================================================

@router.post(
    "",
    response_model=schemas.AIVideoInterviewStartResponse,
    dependencies=[Depends(get_current_user)]
)
def create_ai_video_interview(
    data: schemas.AIVideoInterviewCreate,
    db: Session = Depends(get_db)
):
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == data.candidate_id
    ).first()

    job = db.query(models.Job).filter(
        models.Job.id == data.job_id
    ).first()

    if not candidate:
        raise HTTPException(404, "Candidate not found")
    if not job:
        raise HTTPException(404, "Job not found")

    # 🔵 VIDEO-SPECIFIC QUESTIONS (NOT CHAT)
    questions = generate_video_interview_questions({
        "title": job.title,
        "skills": job.skills or [],
        "description": job.description or ""
    })

    interview = models.AIVideoInterview(
        candidate_id=data.candidate_id,
        job_id=data.job_id,
        questions=questions,
        recording_enabled=data.recording_enabled,
        status="scheduled"
    )

    db.add(interview)
    db.commit()
    db.refresh(interview)

    return {
        "interview_id": interview.id,
        "questions": questions
    }


# ============================================================
# 2️⃣ START AI VIDEO INTERVIEW
# ============================================================

@router.post(
    "/{interview_id}/start",
    dependencies=[Depends(get_current_user)]
)
def start_ai_video_interview(
    interview_id: str,
    db: Session = Depends(get_db)
):
    interview = db.query(models.AIVideoInterview).filter(
        models.AIVideoInterview.id == interview_id
    ).first()

    if not interview:
        raise HTTPException(404, "Video interview not found")

    interview.status = "in_progress"
    interview.started_at = datetime.utcnow()

    db.commit()

    return {
        "message": "AI video interview started",
        "questions": interview.questions,
        "recording_enabled": interview.recording_enabled
    }


# ============================================================
# 3️⃣ SUBMIT VIDEO ANSWER (PER QUESTION)
# ============================================================

@router.post(
    "/{interview_id}/answer",
    dependencies=[Depends(get_current_user)]
)
def submit_video_answer(
    interview_id: str,
    data: schemas.AIVideoInterviewAnswer,
    db: Session = Depends(get_db)
):
    interview = db.query(models.AIVideoInterview).filter(
        models.AIVideoInterview.id == interview_id
    ).first()

    if not interview:
        raise HTTPException(404, "Video interview not found")

    if interview.status != "in_progress":
        raise HTTPException(400, "Interview is not active")

    if data.question_index >= len(interview.questions):
        raise HTTPException(400, "Invalid question index")

    answers = interview.answers or []

    answers.append({
        "question_index": data.question_index,
        "question": interview.questions[data.question_index],
        "video_url": data.video_url,
        "duration": data.duration,
        "submitted_at": datetime.utcnow().isoformat()
    })

    interview.answers = answers
    db.commit()

    return {
        "message": "Video answer saved successfully",
        "answered_questions": len(answers)
    }


# ============================================================
# 4️⃣ COMPLETE AI VIDEO INTERVIEW
# ============================================================

@router.post(
    "/{interview_id}/complete",
    response_model=schemas.AIVideoInterviewCompleteResponse,
    dependencies=[Depends(get_current_user)]
)
def complete_ai_video_interview(
    interview_id: str,
    db: Session = Depends(get_db)
):
    interview = db.query(models.AIVideoInterview).filter(
        models.AIVideoInterview.id == interview_id
    ).first()

    if not interview:
        raise HTTPException(404, "Video interview not found")

    answers = interview.answers or []
    answered_count = len(answers)

    # 🎯 Simple & fair scoring (phase-1)
    overall_score = min(100.0, answered_count * 20.0)

    recommendation = (
        "hire" if overall_score >= 70
        else "consider" if overall_score >= 50
        else "no-hire"
    )

    interview.overall_ai_score = overall_score
    interview.ai_feedback = [
        f"Candidate answered {answered_count} video questions",
        f"Overall performance score: {overall_score}"
    ]
    interview.status = "completed"
    interview.completed_at = datetime.utcnow()

    db.commit()
    meeting_id = str(uuid.uuid4())[:8]
    meeting_url = f"https://meet.yourapp.com/{meeting_id}"

    live_interview = LiveInterview(
        candidate_id=interview.candidate_id,
        job_id=interview.job_id,
        meeting_url=meeting_url,
        recording_enabled=True,
        status="scheduled"
)

    db.add(live_interview)
    db.commit()

    return {
        "interview_id": interview.id,
        "overall_ai_score": overall_score,
        "recommendation": recommendation,
        "feedback": interview.ai_feedback
    }


# ============================================================
# 5️⃣ AI VIDEO INTERVIEW LOGS (ADMIN / HR)
# ============================================================

@router.get(
    "/logs",
    response_model=list[schemas.AIVideoInterviewLogResponse],
    dependencies=[Depends(get_current_user)]
)
def ai_video_interview_logs(db: Session = Depends(get_db)):
    interviews = (
        db.query(models.AIVideoInterview)
        .filter(models.AIVideoInterview.status == "completed")
        .order_by(models.AIVideoInterview.created_at.desc())
        .all()
    )

    return interviews

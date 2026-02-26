from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import get_current_user
from app import models

router = APIRouter(
    prefix="/v1/interview-summary",
    tags=["Interview Summary"]
)

@router.get("/{candidate_id}/{job_id}", dependencies=[Depends(get_current_user)])
def get_full_interview_summary(candidate_id: str, job_id: str, db: Session = Depends(get_db)):
    chat = db.query(models.Interview).filter(
        models.Interview.candidate_id == candidate_id,
        models.Interview.job_id == job_id,
        models.Interview.status == "completed"
    ).first()

    video = db.query(models.AIVideoInterview).filter(
        models.AIVideoInterview.candidate_id == candidate_id,
        models.AIVideoInterview.job_id == job_id,
        models.AIVideoInterview.status == "completed"
    ).first()

    live = db.query(models.LiveInterview).filter(
        models.LiveInterview.candidate_id == candidate_id,
        models.LiveInterview.job_id == job_id,
        models.LiveInterview.status == "completed"
    ).first()

    return {
        "chat_interview": {
            "score": chat.overall_ai_score if chat else None,
            "recommendation": chat.recommendation if chat else None
        },
        "ai_video_interview": {
            "score": video.overall_ai_score if video else None,
            "feedback": video.ai_feedback if video else None
        },
        "live_interview": {
            "recording": live.recording_url if live else None,
            "status": live.status if live else None
        }
    }

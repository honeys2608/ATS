from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from typing import Optional
from pydantic import BaseModel

from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from app.permissions import require_permission
from app.ai_core import AIInterviewer, generate_video_interview_questions


def _notify_candidate(
    db: Session,
    candidate_id: Optional[str],
    title: str,
    message: Optional[str] = None,
    notif_type: str = "interview",
):
    if not candidate_id:
        return
    db.add(
        models.Notification(
            candidate_id=candidate_id,
            title=title,
            message=message,
            type=notif_type,
        )
    )


def _add_interview_log(db: Session, interview_id: str, action: str, notes: Optional[str] = None):
    db.add(
        models.InterviewLog(
            interview_id=interview_id,
            action=action,
            notes=notes,
        )
    )


router = APIRouter(prefix="/v1/interviews", tags=["Interviews"])

# In-memory AI interview sessions
active_sessions: dict[str, AIInterviewer] = {}


def _build_interviewer_from_session(
    interview: models.Interview,
    session: models.InterviewSession,
    answers: list[models.InterviewAnswer],
):
    job = interview.submission.job
    resume_text = getattr(interview.submission.candidate, "resume_text", None)

    interviewer = AIInterviewer(
        job_data={
            "title": job.title,
            "skills": job.skills or [],
            "description": job.description or "",
        },
        resume_text=resume_text,
    )

    if session.questions:
        interviewer.questions = session.questions

    interviewer.current_index = session.current_index or 0

    # Rebuild conversation history and scores from persisted answers
    for ans in answers:
        if ans.question:
            interviewer._add_history("ai", ans.question)
        interviewer._add_history("candidate", ans.answer)
        try:
            score, _ = interviewer._score_answer(ans.answer)
            interviewer.scores.append(score)
        except Exception:
            pass

    # If a question was already asked and not yet answered, keep it in history
    if session.last_question:
        if not interviewer.conversation_history or interviewer.conversation_history[-1].get("content") != session.last_question:
            interviewer._add_history("ai", session.last_question)

    return interviewer

############################################
# 1️⃣ Create Interview 🔒
############################################
@router.post(
    "",
    response_model=schemas.InterviewResponse,
    dependencies=[Depends(get_current_user)]
)
def create_interview(
    data: schemas.InterviewCreate,
    db: Session = Depends(get_db)
):
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == data.submission_id
    ).first()

    if not submission:
        raise HTTPException(404, "Submission not found")

    interview = models.Interview(
        submission_id=submission.id,
        scheduled_at=data.scheduled_at,
        mode=data.mode,
        meeting_link=data.meeting_link,
        status="scheduled"
    )

    db.add(interview)
    _notify_candidate(
        db,
        submission.candidate_id,
        title="Interview Scheduled",
        message=f"Your interview for {submission.job.title if submission.job else 'the role'} has been scheduled.",
        notif_type="interview_scheduled",
    )
    db.commit()
    db.refresh(interview)

    return interview

############################################
# 2️⃣ Get All Interviews 🔒 (FIXED)
############################################
############################################
# 2️⃣ Get All Interviews 🔒 (FIXED – COPY PASTE)
############################################
############################################
# 2️⃣ Get All Interviews 🔒 (FINAL FIX)
############################################
@router.get(
    "",
    response_model=list[schemas.InterviewResponse],
    dependencies=[Depends(get_current_user)]
)
def list_interviews(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = (
        db.query(models.Interview)   # ✅ ONLY Interview table
        .options(
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.candidate),
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.job),
        )
    )

    # Candidate → only own interviews
    if current_user.get("role") == "candidate":
        candidate_id = (
            current_user.get("id")
            or current_user.get("candidate_id")
            or current_user.get("candidate", {}).get("id")
        )

        if candidate_id:
            query = query.join(
                models.CandidateSubmission,
                models.Interview.submission_id == models.CandidateSubmission.id
            ).filter(
                models.CandidateSubmission.candidate_id == candidate_id
            )

    return query.order_by(models.Interview.scheduled_at.desc()).all()

############################################
# 3️⃣ Interview Logs (Completed) 🔒
############################################
@router.get(
    "/logs",
    response_model=list[schemas.InterviewLogListResponse],
    dependencies=[Depends(get_current_user)]
)
def interview_logs(db: Session = Depends(get_db)):
    return (
        db.query(models.Interview)
        .options(
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.candidate),
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.job),
        )
        .filter(models.Interview.status == "completed")
        .order_by(models.Interview.completed_at.desc())
        .all()
    )


@router.get("/{id}/logs", dependencies=[Depends(get_current_user)])
def interview_action_logs(id: str, db: Session = Depends(get_db)):
    logs = (
        db.query(models.InterviewLog)
        .filter(models.InterviewLog.interview_id == id)
        .order_by(models.InterviewLog.timestamp.asc())
        .all()
    )
    return [
        {
            "id": log.id,
            "action": log.action,
            "timestamp": log.timestamp,
            "notes": log.notes,
        }
        for log in logs
    ]

############################################
# 4️⃣ Get Interview Detail 🔒
@router.get(
    "/{id}",
    response_model=schemas.InterviewDetailResponse,
    dependencies=[Depends(get_current_user)]
)
def get_interview(id: str, db: Session = Depends(get_db)):
    interview = (
        db.query(models.Interview)
        .options(
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.candidate),
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.job),
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.recruiter),
        )
        .filter(models.Interview.id == id)
        .first()
    )

    if not interview:
        raise HTTPException(404, "Interview not found")

    return interview

############################################
# 5️⃣ Update Interview 🔒
@router.put("/{id}", dependencies=[Depends(get_current_user)])
def update_interview(id: str, data: schemas.InterviewUpdate, db: Session = Depends(get_db)):
    interview = db.query(models.Interview).filter(models.Interview.id == id).first()
    if not interview:
        raise HTTPException(404, "Interview not found")

    old_status = interview.status
    old_scheduled_at = interview.scheduled_at

    for key, value in data.dict(exclude_unset=True).items():
        setattr(interview, key, value)

    db.commit()
    db.refresh(interview)

    submission = interview.submission
    candidate_id = submission.candidate_id if submission else None
    job_title = submission.job.title if submission and submission.job else "the role"

    payload = data.dict(exclude_unset=True)
    if "scheduled_at" in payload and interview.scheduled_at != old_scheduled_at:
        _notify_candidate(
            db,
            candidate_id,
            title="Interview Rescheduled",
            message=f"Your interview for {job_title} has been rescheduled.",
            notif_type="interview_rescheduled",
        )
        db.commit()

    if "status" in payload and interview.status != old_status:
        notif_title = (
            "Interview Result Updated"
            if interview.status in {"selected", "rejected"}
            else "Interview Status Updated"
        )
        _notify_candidate(
            db,
            candidate_id,
            title=notif_title,
            message=f"{job_title}: Interview status updated to {interview.status}.",
            notif_type="interview_status",
        )
        db.commit()

    return interview

##########################################################
#               AI Interview Flow 🔒
##########################################################

############################################
# 6️⃣ Start AI Interview
# ======================================================
@router.post("/{id}/start", dependencies=[Depends(get_current_user)])
def start_ai_interview(id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    interview = (
        db.query(models.Interview)
        .options(
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.candidate),
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.job),
        )
        .filter(models.Interview.id == id)
        .first()
    )

    if not interview:
        raise HTTPException(404, "Interview not found")

    if current_user.get("role") != "candidate":
        raise HTTPException(403, "Only candidates can start interview")

    cand_id = (
        current_user.get("id")
        or current_user.get("candidate_id")
        or current_user.get("candidate", {}).get("id")
    )

    if interview.submission.candidate_id != cand_id:
        raise HTTPException(403, "Unauthorized")

    # Prevent early access + enforce scheduled window
    now = datetime.now(timezone.utc)
    scheduled_at = interview.scheduled_at
    if scheduled_at is not None and scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    if scheduled_at is not None:
        if now < scheduled_at:
            raise HTTPException(400, "Interview not started yet")
        duration_seconds = interview.duration_seconds if interview.duration_seconds else 3600
        window_end = scheduled_at + timedelta(seconds=duration_seconds)
        if now > window_end and interview.status in {"scheduled", "interview_scheduled"}:
            interview.status = "no_show"
            _add_interview_log(db, id, "no_show")
            db.commit()
            raise HTTPException(400, "Interview window expired")

    existing_session = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.interview_id == id,
            models.InterviewSession.status == "in_progress",
        )
        .order_by(models.InterviewSession.created_at.desc())
        .first()
    )

    if existing_session:
        answers = (
            db.query(models.InterviewAnswer)
            .filter(models.InterviewAnswer.session_id == existing_session.id)
            .order_by(models.InterviewAnswer.created_at.asc())
            .all()
        )
        interviewer = _build_interviewer_from_session(interview, existing_session, answers)
        active_sessions[id] = interviewer

        if existing_session.last_question:
            return {
                "session_id": existing_session.id,
                "question": existing_session.last_question,
                "transcript": [
                    {
                        "question": ans.question,
                        "answer": ans.answer,
                        "timestamp": ans.created_at,
                    }
                    for ans in answers
                ],
                "status": "in_progress",
            }

        next_q = interviewer.get_next_question()
        if next_q:
            existing_session.current_index = interviewer.current_index
            existing_session.last_question = next_q["question_text"]
            existing_session.updated_at = datetime.utcnow()
            db.commit()
            return {
                "session_id": existing_session.id,
                "question": next_q,
                "transcript": [
                    {
                        "question": ans.question,
                        "answer": ans.answer,
                        "timestamp": ans.created_at,
                    }
                    for ans in answers
                ],
                "status": "in_progress",
            }

        return {
            "session_id": existing_session.id,
            "question": None,
            "transcript": [
                {
                    "question": ans.question,
                    "answer": ans.answer,
                    "timestamp": ans.created_at,
                }
                for ans in answers
            ],
            "status": existing_session.status,
        }

    interviewer = AIInterviewer(
        job_data={
            "title": interview.submission.job.title,
            "skills": interview.submission.job.skills or [],
            "description": interview.submission.job.description or "",
        },
        resume_text=getattr(interview.submission.candidate, "resume_text", None),
    )

    first_q = interviewer.get_next_question()

    session = models.InterviewSession(
        interview_id=id,
        candidate_id=cand_id,
        status="in_progress",
        started_at=datetime.utcnow(),
        questions=interviewer.questions,
        current_index=interviewer.current_index,
        last_question=first_q["question_text"] if first_q else None,
    )
    db.add(session)

    if not interview.started_at:
        interview.started_at = datetime.utcnow()
    interview.status = "in_progress"
    _add_interview_log(db, id, "joined")
    db.commit()

    active_sessions[id] = interviewer

    return {
        "session_id": session.id,
        "question": first_q,
        "transcript": [],
        "status": "in_progress",
    }


############################################
# 7️⃣ Get Next Question
############################################
@router.get("/{id}/question", dependencies=[Depends(get_current_user)])
def ai_next_question(id: str):
    interviewer = active_sessions.get(id)
    if not interviewer:
        raise HTTPException(400, "Interview session not found")

    q = interviewer.get_next_question()
    return q or {"message": "Interview finished"}

############################################
# 8️⃣ Submit Answer
############################################
@router.post("/{id}/answer", dependencies=[Depends(get_current_user)])
def ai_answer(
    id: str,
    payload: schemas.InterviewAnswerRequest,
    db: Session = Depends(get_db),
):
    session = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.interview_id == id,
            models.InterviewSession.status == "in_progress",
        )
        .order_by(models.InterviewSession.created_at.desc())
        .first()
    )

    if not session:
        raise HTTPException(400, "AI interview session not found")

    answers = (
        db.query(models.InterviewAnswer)
        .filter(models.InterviewAnswer.session_id == session.id)
        .order_by(models.InterviewAnswer.created_at.asc())
        .all()
    )

    interviewer = active_sessions.get(id)
    if not interviewer:
        interview = (
            db.query(models.Interview)
            .options(
                joinedload(models.Interview.submission)
                    .joinedload(models.CandidateSubmission.candidate),
                joinedload(models.Interview.submission)
                    .joinedload(models.CandidateSubmission.job),
            )
            .filter(models.Interview.id == id)
            .first()
        )
        if not interview:
            raise HTTPException(404, "Interview not found")
        interviewer = _build_interviewer_from_session(interview, session, answers)
        active_sessions[id] = interviewer

    if not session.last_question:
        next_q = interviewer.get_next_question()
        session.current_index = interviewer.current_index
        session.last_question = next_q["question_text"] if next_q else None
        session.updated_at = datetime.utcnow()
        db.commit()
        return {
            "next_question": next_q["question_text"] if next_q else None,
            "is_last_question": True if not next_q else next_q["is_last_question"],
        }

    response = interviewer.submit_answer(payload.answer)

    db.add(
        models.InterviewAnswer(
            interview_id=id,
            session_id=session.id,
            question=session.last_question,
            answer=payload.answer,
            ai_score=response.get("partial_score"),
        )
    )
    _add_interview_log(db, id, "answer_submitted")

    session.current_index = interviewer.current_index
    session.last_question = response.get("next_question")
    session.updated_at = datetime.utcnow()

    if response.get("is_last_question") and not response.get("next_question"):
        final_score = interviewer.get_final_score()
        interview = db.query(models.Interview).filter(models.Interview.id == id).first()
        if interview:
            interview.status = "completed"
            interview.completed_at = datetime.utcnow()
            interview.overall_ai_score = final_score
            interview.transcript = interviewer.conversation_history
            _add_interview_log(db, id, "completed")

        session.status = "completed"
        session.completed_at = datetime.utcnow()
        session.last_question = None

    db.commit()
    return response

############################################
# ======================================================
# 7️⃣ Complete Interview (FIXED)
# ======================================================
@router.post("/{id}/complete", dependencies=[Depends(get_current_user)])
def complete_interview(id: str, db: Session = Depends(get_db)):
    session = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.interview_id == id,
            models.InterviewSession.status == "in_progress",
        )
        .order_by(models.InterviewSession.created_at.desc())
        .first()
    )

    interviewer = active_sessions.get(id)
    if not interviewer:
        if not session:
            raise HTTPException(400, "Interview session not found")
        interview = (
            db.query(models.Interview)
            .options(
                joinedload(models.Interview.submission)
                    .joinedload(models.CandidateSubmission.candidate),
                joinedload(models.Interview.submission)
                    .joinedload(models.CandidateSubmission.job),
            )
            .filter(models.Interview.id == id)
            .first()
        )
        if not interview:
            raise HTTPException(404, "Interview not found")
        answers = (
            db.query(models.InterviewAnswer)
            .filter(models.InterviewAnswer.session_id == session.id)
            .order_by(models.InterviewAnswer.created_at.asc())
            .all()
        )
        interviewer = _build_interviewer_from_session(interview, session, answers)

    final_score = interviewer.get_final_score()

    interview = db.query(models.Interview).filter(models.Interview.id == id).first()
    if not interview:
        raise HTTPException(404, "Interview not found")

    interview.status = "completed"
    interview.overall_ai_score = final_score
    interview.transcript = interviewer.conversation_history
    interview.completed_at = datetime.utcnow()
    _add_interview_log(db, id, "completed")

    if session:
        session.status = "completed"
        session.completed_at = datetime.utcnow()
        session.last_question = None

    db.commit()

    job = interview.submission.job

    video_questions = generate_video_interview_questions({
        "title": job.title,
        "skills": job.skills or [],
        "description": job.description or ""
    })

    db.add(models.AIVideoInterview(
        candidate_id=interview.submission.candidate_id,
        job_id=interview.submission.job_id,
        questions=video_questions,
        status="scheduled"
    ))

    db.commit()
    active_sessions.pop(id, None)

    return {"message": "Interview completed", "final_score": final_score}


@router.get("/{id}/transcript", dependencies=[Depends(get_current_user)])
def get_interview_transcript(id: str, db: Session = Depends(get_db)):
    interview = db.query(models.Interview).filter(models.Interview.id == id).first()
    if not interview:
        raise HTTPException(404, "Interview not found")

    session = (
        db.query(models.InterviewSession)
        .filter(models.InterviewSession.interview_id == id)
        .order_by(models.InterviewSession.created_at.desc())
        .first()
    )

    query = db.query(models.InterviewAnswer).filter(
        models.InterviewAnswer.interview_id == id
    )
    if session:
        query = query.filter(models.InterviewAnswer.session_id == session.id)

    answers = query.order_by(models.InterviewAnswer.created_at.asc()).all()

    # Fallback: if the latest session has no answers, pull all answers for this interview.
    if session and not answers:
        answers = (
            db.query(models.InterviewAnswer)
            .filter(models.InterviewAnswer.interview_id == id)
            .order_by(models.InterviewAnswer.created_at.asc())
            .all()
        )

    if not answers and interview.transcript:
        # Fallback to stored transcript if answers were not captured
        transcript_pairs = []
        pending_question = None
        for msg in interview.transcript:
            role = msg.get("role")
            content = msg.get("content")
            if role in {"ai", "bot"}:
                pending_question = content
            elif role == "candidate" and pending_question:
                transcript_pairs.append(
                    {"question": pending_question, "answer": content, "timestamp": msg.get("timestamp")}
                )
                pending_question = None
        return {
            "interview_id": id,
            "session_id": session.id if session else None,
            "transcript": transcript_pairs,
        }

    return {
        "interview_id": id,
        "session_id": session.id if session else None,
        "transcript": [
            {
                "question": ans.question,
                "answer": ans.answer,
                "timestamp": ans.created_at,
            }
            for ans in answers
        ],
    }


# ============================================================
# NEW ATS INTERVIEW MODULE ENDPOINTS (NON-DESTRUCTIVE)
# ============================================================

@router.get("/recruiter/jobs")
@require_permission("interviews", "view")
def recruiter_jobs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = (current_user.get("role") or "").lower()
    query = db.query(models.Job)
    if role == "recruiter":
        query = query.join(models.job_recruiters).filter(
            models.job_recruiters.c.recruiter_id == current_user.get("id")
        )
    jobs = query.order_by(models.Job.created_at.desc()).all()
    return [
        {
            "id": j.id,
            "job_id": j.job_id,
            "title": j.title,
            "location": j.location,
            "department": j.department,
        }
        for j in jobs
    ]


@router.get("/recruiter/job-applicants")
@require_permission("interviews", "view")
def recruiter_job_applicants(
    job_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = (current_user.get("role") or "").lower()
    if role == "recruiter":
        assigned = (
            db.query(models.job_recruiters)
            .filter(
                models.job_recruiters.c.job_id == job_id,
                models.job_recruiters.c.recruiter_id == current_user.get("id"),
            )
            .first()
        )
        if not assigned:
            raise HTTPException(403, "You are not assigned to this job.")

    applicants = (
        db.query(models.JobApplication, models.Candidate)
        .join(models.Candidate, models.Candidate.id == models.JobApplication.candidate_id)
        .filter(models.JobApplication.job_id == job_id)
        .order_by(models.JobApplication.applied_at.desc())
        .all()
    )

    results = []
    for app, cand in applicants:
        results.append(
            {
                "candidate_id": cand.id,
                "full_name": cand.full_name,
                "email": cand.email,
                "phone": cand.phone,
                "status": cand.status,
                "applied_at": app.applied_at,
            }
        )
    return {"count": len(results), "results": results}


class BulkInterviewScheduleRequest(BaseModel):
    job_id: str
    candidate_ids: list[str]
    interview_type: str  # ai_chat | video | in_person
    scheduled_at: datetime
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    contact_person: Optional[str] = None


@router.post("/recruiter/schedule-bulk")
@require_permission("interviews", "create")
def schedule_bulk_interviews(
    payload: BulkInterviewScheduleRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = (current_user.get("role") or "").lower()
    recruiter_id = current_user.get("id")

    if not payload.candidate_ids:
        raise HTTPException(400, "Select at least one candidate.")

    if payload.interview_type not in {"ai_chat", "video", "in_person"}:
        raise HTTPException(400, "Invalid interview type.")

    if role == "recruiter":
        assigned = (
            db.query(models.job_recruiters)
            .filter(
                models.job_recruiters.c.job_id == payload.job_id,
                models.job_recruiters.c.recruiter_id == recruiter_id,
            )
            .first()
        )
        if not assigned:
            raise HTTPException(403, "You are not assigned to this job.")

    job = db.query(models.Job).filter(models.Job.id == payload.job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    now = datetime.now(timezone.utc)
    scheduled_at = payload.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    if scheduled_at < now:
        raise HTTPException(400, "Scheduled time must be in the future.")

    requirement = job.requirement
    if not requirement:
        requirement = (
            db.query(models.Requirement)
            .filter(models.Requirement.job_id == job.id)
            .first()
        )

    am_recipient_ids = set()
    if requirement and requirement.account_manager_id:
        am_recipient_ids.add(requirement.account_manager_id)
    if job.account_manager_id:
        am_recipient_ids.add(job.account_manager_id)
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
    recruiter_display_name = (
        str(current_user.get("full_name") or "").strip()
        or str(current_user.get("name") or "").strip()
        or str(current_user.get("email") or "").strip()
        or str(current_user.get("username") or "").strip()
        or "Recruiter"
    )
    requirement_label = (
        str(requirement.title or "").strip()
        if requirement and requirement.title
        else str(job.title or "").strip() or "the requirement"
    )
    scheduled_for_text = scheduled_at.astimezone(timezone.utc).strftime(
        "%b %d, %Y %I:%M %p UTC"
    )

    created = []
    for candidate_id in payload.candidate_ids:
        candidate = (
            db.query(models.Candidate)
            .filter(models.Candidate.id == candidate_id)
            .first()
        )
        if not candidate:
            continue

        submission = (
            db.query(models.CandidateSubmission)
            .filter(
                models.CandidateSubmission.candidate_id == candidate_id,
                models.CandidateSubmission.job_id == payload.job_id,
                models.CandidateSubmission.recruiter_id == recruiter_id,
            )
            .first()
        )
        if not submission:
            submission = models.CandidateSubmission(
                candidate_id=candidate_id,
                job_id=payload.job_id,
                recruiter_id=recruiter_id,
                status="submitted",
            )
            db.add(submission)
            db.flush()

        interview = models.Interview(
            submission_id=submission.id,
            mode=payload.interview_type,
            scheduled_at=payload.scheduled_at,
            meeting_link=payload.meeting_link,
            location=payload.location,
            contact_person=payload.contact_person,
            status="scheduled",
        )
        db.add(interview)
        db.flush()
        _add_interview_log(db, interview.id, "scheduled")

        try:
            candidate.status = models.CandidateStatus.interview_scheduled
        except Exception:
            candidate.status = "interview_scheduled"

        if am_recipient_ids:
            candidate_label = (
                str(candidate.full_name or "").strip()
                or str(candidate.public_id or "").strip()
                or "Candidate"
            )
            for am_user_id in am_recipient_ids:
                db.add(
                    models.SystemNotification(
                        user_id=am_user_id,
                        notification_type="interview_scheduled",
                        title=f"Interview scheduled by {recruiter_display_name}",
                        message=(
                            f"{recruiter_display_name} scheduled an interview for "
                            f"{candidate_label} ({requirement_label}) on "
                            f"{scheduled_for_text}."
                        ),
                        reference_id=candidate.id,
                        requirement_id=(requirement.id if requirement else None),
                        priority="high",
                        created_at=datetime.utcnow(),
                    )
                )

        created.append(
            {
                "interview_id": interview.id,
                "candidate_id": candidate_id,
                "candidate_name": candidate.full_name,
            }
        )

    db.commit()
    return {"count": len(created), "results": created}


@router.get("/recruiter/list")
@require_permission("interviews", "view")
def list_recruiter_interviews(
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(9, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = (current_user.get("role") or "").lower()
    query = (
        db.query(models.Interview)
        .join(models.CandidateSubmission, models.Interview.submission_id == models.CandidateSubmission.id)
        .join(models.Candidate, models.Candidate.id == models.CandidateSubmission.candidate_id)
        .join(models.Job, models.Job.id == models.CandidateSubmission.job_id)
        .join(models.User, models.User.id == models.CandidateSubmission.recruiter_id)
        .options(
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.candidate),
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.job),
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.recruiter),
        )
    )
    if role == "recruiter":
        query = query.filter(models.CandidateSubmission.recruiter_id == current_user.get("id"))

    ordered_query = query.order_by(models.Interview.scheduled_at.desc())
    if page is None:
        interviews = ordered_query.all()
        total_records = len(interviews)
    else:
        total_records = ordered_query.count()
        interviews = (
            ordered_query
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
    results = []
    for iv in interviews:
            results.append(
                {
                    "id": iv.id,
                    "mode": iv.mode,
                    "status": iv.status,
                    "scheduled_at": iv.scheduled_at,
                    "meeting_link": iv.meeting_link,
                    "location": iv.location,
                    "contact_person": iv.contact_person,
                    "overall_ai_score": iv.overall_ai_score,
                    "candidate": {
                        "id": iv.submission.candidate.id,
                        "full_name": iv.submission.candidate.full_name,
                        "email": iv.submission.candidate.email,
                        "phone": iv.submission.candidate.phone,
                    },
                    "job": {
                        "id": iv.submission.job.id,
                        "title": iv.submission.job.title,
                        "company_name": iv.submission.job.company_name,
                        "location": iv.submission.job.location,
                    },
                    "recruiter": {
                        "id": iv.submission.recruiter_id,
                        "full_name": (iv.submission.recruiter.full_name if iv.submission.recruiter else None),
                        "email": (iv.submission.recruiter.email if iv.submission.recruiter else None),
                    },
                }
            )
    if page is None:
        return {"count": len(results), "results": results}

    total_pages = max(1, (total_records + limit - 1) // limit) if total_records else 1
    return {
        "data": results,
        "results": results,
        "currentPage": page,
        "totalPages": total_pages,
        "totalRecords": total_records,
        "count": total_records,
        "limit": limit,
    }


@router.post("/{id}/join")
def candidate_join_interview(
    id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.get("role") != "candidate":
        raise HTTPException(403, "Only candidates can join interviews")

    interview = (
        db.query(models.Interview)
        .join(models.CandidateSubmission, models.Interview.submission_id == models.CandidateSubmission.id)
        .filter(models.Interview.id == id)
        .first()
    )
    if not interview:
        raise HTTPException(404, "Interview not found")

    candidate_id = (
        current_user.get("id")
        or current_user.get("candidate_id")
        or current_user.get("candidate", {}).get("id")
    )
    if interview.submission.candidate_id != candidate_id:
        raise HTTPException(403, "Unauthorized")

    # Prevent early access + enforce scheduled window
    now = datetime.now(timezone.utc)
    scheduled_at = interview.scheduled_at
    if scheduled_at is not None and scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    if scheduled_at is not None:
        if now < scheduled_at:
            raise HTTPException(400, "Interview not started yet")
        duration_seconds = interview.duration_seconds if interview.duration_seconds else 3600
        window_end = scheduled_at + timedelta(seconds=duration_seconds)
        if now > window_end and interview.status in {"scheduled", "interview_scheduled"}:
            interview.status = "no_show"
            _add_interview_log(db, id, "no_show")
            db.commit()
            raise HTTPException(400, "Interview window expired")

    if not interview.started_at:
        interview.started_at = datetime.utcnow()
    interview.status = "in_progress"
    _add_interview_log(db, id, "joined")
    db.commit()

    return {"status": "joined", "started_at": interview.started_at}


@router.post("/{id}/mark-no-show")
@require_permission("interviews", "update")
def mark_no_show(
    id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    interview = db.query(models.Interview).filter(models.Interview.id == id).first()
    if not interview:
        raise HTTPException(404, "Interview not found")

    interview.status = "no_show"
    _add_interview_log(db, id, "no_show")
    db.commit()
    return {"status": "no_show", "id": id}



##########################################################
#          Interview Feedback & Rescheduling 🔒
##########################################################

############################################
# 🔟 Add Interview Feedback
############################################
class InterviewFeedbackRequest(BaseModel):
    feedback_score: Optional[float] = None
    feedback_comments: Optional[str] = None
    rating_technical: Optional[int] = None
    rating_communication: Optional[int] = None
    rating_cultural_fit: Optional[int] = None


@router.post("/{id}/feedback", response_model=schemas.InterviewFeedbackResponse)
def submit_candidate_feedback(
    id: str,
    feedback: schemas.InterviewFeedbackRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    interview = db.query(models.Interview).filter(models.Interview.id == id).first()
    if not interview:
        raise HTTPException(404, "Interview not found")

    candidate_id = (
        current_user.get("id")
        or current_user.get("candidate_id")
        or current_user.get("candidate", {}).get("id")
    )

    if interview.submission.candidate_id != candidate_id:
        raise HTTPException(403, "Unauthorized")

    record = models.InterviewFeedback(
        interview_id=id,
        candidate_id=candidate_id,
        rating=feedback.rating,
        experience_feedback=feedback.experience_feedback,
        ease_of_use=feedback.ease_of_use,
        comments=feedback.comments,
        submitted_at=datetime.utcnow()
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return record

############################################
# 1️⃣1️⃣ Reschedule Interview
############################################
class RescheduleRequest(BaseModel):
    scheduled_date: datetime
    reason: Optional[str] = None


@router.post("/{id}/reschedule", dependencies=[Depends(get_current_user)])
def reschedule_interview(
    id: str,
    data: RescheduleRequest,
    db: Session = Depends(get_db)
):
    """Reschedule an interview to a new date/time."""
    interview = db.query(models.Interview).filter(
        models.Interview.id == id
    ).first()

    if not interview:
        raise HTTPException(404, "Interview not found")

    if interview.status == "completed":
        raise HTTPException(400, "Cannot reschedule completed interview")

    # Update scheduled time
    old_date = interview.scheduled_at
    interview.scheduled_at = data.scheduled_date
    interview.status = "rescheduled"

    db.commit()
    db.refresh(interview)

    submission = interview.submission
    _notify_candidate(
        db,
        submission.candidate_id if submission else None,
        title="Interview Rescheduled",
        message=f"Your interview for {submission.job.title if submission and submission.job else 'the role'} has been rescheduled.",
        notif_type="interview_rescheduled",
    )
    db.commit()

    return {
        "message": "Interview rescheduled",
        "interview_id": id,
        "old_date": old_date,
        "new_date": interview.scheduled_at,
        "reason": data.reason or "No reason provided"
    }


############################################
# 1️⃣2️⃣ Cancel Interview
############################################
@router.post("/{id}/cancel", dependencies=[Depends(get_current_user)])
def cancel_interview(id: str, db: Session = Depends(get_db)):
    """Cancel an interview."""
    interview = db.query(models.Interview).filter(
        models.Interview.id == id
    ).first()

    if not interview:
        raise HTTPException(404, "Interview not found")

    interview.status = "cancelled"
    db.commit()

    submission = interview.submission
    _notify_candidate(
        db,
        submission.candidate_id if submission else None,
        title="Interview Cancelled",
        message=f"Your interview for {submission.job.title if submission and submission.job else 'the role'} has been cancelled.",
        notif_type="interview_cancelled",
    )
    db.commit()

    return {"message": "Interview cancelled successfully"}


############################################
# 1️⃣3️⃣ Get Upcoming Interviews for Candidate
############################################
@router.get("/candidate/{candidate_id}/upcoming")
def get_candidate_upcoming_interviews(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get upcoming interviews for a specific candidate."""
    now = datetime.utcnow()
    upcoming = (
    db.query(models.Interview)
    .options(
        joinedload(models.Interview.submission)
            .joinedload(models.CandidateSubmission.candidate),
        joinedload(models.Interview.submission)
            .joinedload(models.CandidateSubmission.job),
    )
    .join(models.CandidateSubmission, models.Interview.submission_id == models.CandidateSubmission.id)
    .filter(
        models.CandidateSubmission.candidate_id == candidate_id,
        models.Interview.scheduled_at >= now,
        models.Interview.status.in_(["scheduled", "rescheduled"])
    )
    .order_by(models.Interview.scheduled_at)
    .all()
)

    return upcoming


############################################
# 1️⃣4️⃣ Get Interview Statistics
############################################
@router.get("/job/{job_id}/stats")
def get_job_interview_stats(
    job_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get interview statistics for a job."""
    interviews = (
        db.query(models.Interview)
        .filter(models.Interview.job_id == job_id)
        .all()
    )

    total = len(interviews)
    completed = len([i for i in interviews if i.status == "completed"])
    scheduled = len([i for i in interviews if i.status == "scheduled"])
    cancelled = len([i for i in interviews if i.status == "cancelled"])

    avg_score = (
        sum([i.overall_ai_score for i in interviews if i.overall_ai_score])
        / len([i for i in interviews if i.overall_ai_score])
        if any(i.overall_ai_score for i in interviews)
        else 0
    )

    return {
        "job_id": job_id,
        "total_interviews": total,
        "completed": completed,
        "scheduled": scheduled,
        "cancelled": cancelled,
        "average_score": round(avg_score, 1),
        "completion_rate": round((completed / total * 100) if total > 0 else 0, 1),
    }

@router.post("/{id}/recruiter-feedback", dependencies=[Depends(get_current_user)])
def recruiter_feedback(id: str, feedback: schemas.InterviewFeedbackRequest, db: Session = Depends(get_db)):
    interview = db.query(models.Interview).filter(models.Interview.id == id).first()
    if not interview:
        raise HTTPException(404, "Interview not found")

    interview.overall_ai_score = feedback.rating
    interview.completed_at = datetime.utcnow()
    interview.status = "completed"

    db.commit()
    return {"message": "Recruiter feedback saved"}


############################################
# 1️⃣5️⃣ Submit Interview Feedback (Candidate)
############################################
@router.post("/{id}/feedback", dependencies=[Depends(get_current_user)])
def submit_interview_feedback(
    id: str,
    feedback: schemas.InterviewFeedbackRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Submit feedback after interview completion (candidate portal)."""
    interview = db.query(models.Interview).filter(
        models.Interview.id == id
    ).first()

    if not interview:
        raise HTTPException(404, "Interview not found")

    # Get candidate ID from current user
    candidate_id = (
        current_user.get("id") 
        or current_user.get("candidate_id") 
        or current_user.get("candidate", {}).get("id")
    )

    if not candidate_id:
        raise HTTPException(400, "Candidate ID not found")

    # Verify candidate owns this interview
    if interview.submission.candidate_id != candidate_id:
        raise HTTPException(403, "Unauthorized to submit feedback for this interview")

    # Check if feedback already exists
    existing_feedback = db.query(models.InterviewFeedback).filter(
        models.InterviewFeedback.interview_id == id
    ).first()

    if existing_feedback:
        # Update existing feedback
        existing_feedback.rating = feedback.rating
        existing_feedback.experience_feedback = feedback.experience_feedback
        existing_feedback.ease_of_use = feedback.ease_of_use
        existing_feedback.comments = feedback.comments
        existing_feedback.submitted_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_feedback)
        return existing_feedback
    else:
        # Create new feedback
        interview_feedback = models.InterviewFeedback(
            interview_id=id,
            candidate_id=candidate_id,
            rating=feedback.rating,
            experience_feedback=feedback.experience_feedback,
            ease_of_use=feedback.ease_of_use,
            comments=feedback.comments
        )
        db.add(interview_feedback)
        db.commit()
        db.refresh(interview_feedback)
        return interview_feedback


############################################
# 1️⃣6️⃣ Get Interview Feedback
############################################
@router.get("/{id}/feedback", response_model=schemas.InterviewFeedbackResponse)
def get_interview_feedback(
    id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get feedback for a specific interview."""
    feedback = db.query(models.InterviewFeedback).filter(
        models.InterviewFeedback.interview_id == id
    ).first()

    if not feedback:
        raise HTTPException(404, "Interview feedback not found")

    return feedback


############################################
# 1️⃣7️⃣ List Interview Feedback (Recruiter/Admin)
############################################
@router.get("/job/{job_id}/feedbacks")
def get_job_interview_feedbacks(
    job_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all feedback for interviews of a specific job (Recruiter/Admin)."""
    feedbacks = (
        db.query(models.InterviewFeedback)
        .join(models.Interview, models.InterviewFeedback.interview_id == models.Interview.id)
        .filter(models.Interview.submission.job_id == job_id)
        .all()
    )
    return feedbacks


############################################
# 1️⃣8️⃣ Schedule Interview (Recruiter)
############################################
class InterviewScheduleRequest(BaseModel):
    candidate_id: str
    job_id: str
    interview_type: str  # "ai_chat", "video", "in_person"
    scheduled_at: datetime
    meeting_link: Optional[str] = None  # For video interviews
    location: Optional[str] = None  # For in-person interviews
    instructions: Optional[str] = None
    notes: Optional[str] = None


@router.post("/schedule", dependencies=[Depends(get_current_user)])
def schedule_interview(
    data: InterviewScheduleRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Schedule an interview for a candidate."""
    now = datetime.now(timezone.utc)
    scheduled_at = data.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    if scheduled_at < now:
        raise HTTPException(400, "Scheduled time must be in the future.")
    # Verify candidate and job exist
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

    candidate_status = (
        candidate.status.value if hasattr(candidate.status, "value") else str(candidate.status or "")
    ).strip().lower()
    if candidate_status != "interview_scheduled":
        raise HTTPException(
            400,
            "Candidate is not ready for interview scheduling. Ask AM to mark status as Schedule Interview first.",
        )

    # Get or create submission
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.candidate_id == data.candidate_id,
        models.CandidateSubmission.job_id == data.job_id
    ).first()

    if not submission:
        # Create submission if doesn't exist
        submission = models.CandidateSubmission(
            candidate_id=data.candidate_id,
            job_id=data.job_id,
            recruiter_id=current_user.get("id"),
            match_score=0,
            status="interview"
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

    # Create interview
    interview = models.Interview(
        submission_id=submission.id,
        mode=data.interview_type,
        scheduled_at=data.scheduled_at,
        status="scheduled",
        meeting_link=data.meeting_link,
        notes=data.notes
    )

    requirement = job.requirement
    if not requirement:
        requirement = (
            db.query(models.Requirement)
            .filter(models.Requirement.job_id == job.id)
            .first()
        )

    am_recipient_ids = set()
    if requirement and requirement.account_manager_id:
        am_recipient_ids.add(requirement.account_manager_id)
    if job.account_manager_id:
        am_recipient_ids.add(job.account_manager_id)
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

    recruiter_display_name = (
        str(current_user.get("full_name") or "").strip()
        or str(current_user.get("name") or "").strip()
        or str(current_user.get("email") or "").strip()
        or str(current_user.get("username") or "").strip()
        or "Recruiter"
    )
    candidate_label = (
        str(candidate.full_name or "").strip()
        or str(candidate.public_id or "").strip()
        or "Candidate"
    )
    requirement_label = (
        str(requirement.title or "").strip()
        if requirement and requirement.title
        else str(job.title or "").strip() or "the requirement"
    )
    scheduled_for_text = scheduled_at.astimezone(timezone.utc).strftime(
        "%b %d, %Y %I:%M %p UTC"
    )

    db.add(interview)

    for am_user_id in am_recipient_ids:
        db.add(
            models.SystemNotification(
                user_id=am_user_id,
                notification_type="interview_scheduled",
                title=f"Interview scheduled by {recruiter_display_name}",
                message=(
                    f"{recruiter_display_name} scheduled an interview for "
                    f"{candidate_label} ({requirement_label}) on "
                    f"{scheduled_for_text}."
                ),
                reference_id=candidate.id,
                requirement_id=(requirement.id if requirement else None),
                priority="high",
                created_at=datetime.utcnow(),
            )
        )

    db.commit()
    db.refresh(interview)

    return {
        "message": "Interview scheduled successfully",
        "interview_id": interview.id,
        "scheduled_at": interview.scheduled_at,
        "interview_type": data.interview_type
    }


############################################
# 1️⃣9️⃣ Get Recruiter Dashboard - All Scheduled Interviews
############################################
@router.get("/recruiter/dashboard/interviews")
def get_recruiter_interviews(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all interviews assigned to a recruiter."""
    if current_user.get("role") != "recruiter":
        raise HTTPException(403, "Only recruiters can access this")

    recruiter_id = current_user.get("id")

    query = (
        db.query(models.Interview)
        .options(
            joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.candidate),
             joinedload(models.Interview.submission)
                .joinedload(models.CandidateSubmission.job),
        )
        .join(models.CandidateSubmission, models.Interview.submission_id == models.CandidateSubmission.id)
        .filter(models.CandidateSubmission.recruiter_id == recruiter_id)
    )

    if status:
        query = query.filter(models.Interview.status == status)

    interviews = query.order_by(
        models.Interview.scheduled_at.desc()
    ).all()

    return interviews


############################################
# 2️⃣0️⃣ Mark Interview as Completed (Recruiter)
############################################
@router.post("/{id}/mark-completed")
def mark_interview_completed(
    id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Mark an interview as completed."""
    interview = db.query(models.Interview).filter(
        models.Interview.id == id
    ).first()

    if not interview:
        raise HTTPException(404, "Interview not found")

    raw_role = current_user.get("role")
    if hasattr(raw_role, "value"):
        raw_role = raw_role.value
    role = str(raw_role or "").strip().lower()
    is_account_manager = role in {"account_manager", "am"} or "account_manager" in role

    completed_at = datetime.utcnow()
    interview.status = "completed"
    interview.completed_at = completed_at
    _add_interview_log(db, id, "completed")

    submission = interview.submission
    client_decision_updated = False
    if is_account_manager and submission:
        submission.status = "selected"
        submission.stage = "selected"
        submission.decision_at = completed_at

        candidate = submission.candidate
        if candidate:
            try:
                candidate.status = models.CandidateStatus.selected
            except Exception:
                candidate.status = "selected"
            if hasattr(candidate, "updated_at"):
                candidate.updated_at = completed_at

        app = (
            db.query(models.JobApplication)
            .filter(
                models.JobApplication.candidate_id == submission.candidate_id,
                models.JobApplication.job_id == submission.job_id,
            )
            .first()
        )
        if app:
            app.status = "selected"
            app.client_decision = "selected"
            app.decision_at = completed_at
            if hasattr(app, "last_activity_at"):
                app.last_activity_at = completed_at
            if hasattr(app, "last_activity_type"):
                app.last_activity_type = "interview_completed_selected_by_am"
            client_decision_updated = True

    db.commit()
    db.refresh(interview)

    _notify_candidate(
        db,
        submission.candidate_id if submission else None,
        title="Interview Completed",
        message=f"Your interview for {submission.job.title if submission and submission.job else 'the role'} has been completed.",
        notif_type="interview_completed",
    )
    db.commit()

    return {
        "message": "Interview marked as completed",
        "interview_id": id,
        "completed_at": interview.completed_at,
        "client_decision_updated": client_decision_updated,
    }



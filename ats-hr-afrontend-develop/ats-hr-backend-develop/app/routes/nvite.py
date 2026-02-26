from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import time

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from app.utils.role_check import allow_user
from app.email_service import send_email
from app.validators import validate_email, sanitize_email
from sqlalchemy.orm import Session

router = APIRouter(prefix="/nvite", tags=["NVite"])


DEFAULT_TEMPLATE = """Dear {{name}},\n\nGreetings from {{company}}!\n\nWe came across your profile and believe you could be a great fit for the position of {{job_title}} at our organization.\n\n\ud83d\udccc Job Role: {{job_title}}\n\ud83d\udccd Location: {{location}}\n\nIf you are interested, we would love for you to apply using the link below:\n\n\ud83d\udc49 Apply Here: {{apply_link}}\n\nOur team will review your application and get in touch if your profile matches our requirements.\n\nBest regards,\n{{recruiter}}\n{{company}}\n"""


class JobInviteRequest(BaseModel):
    candidate_ids: List[str]
    job_id: str
    job_title: str
    job_location: str
    apply_link: str
    recruiter_name: str
    company_name: str
    message_template: Optional[str] = None


@router.post("/send-job-invite")
@require_permission("candidates", "update")
async def send_job_invites(
    payload: JobInviteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)

    candidate_ids = [cid for cid in (payload.candidate_ids or []) if cid]
    if not candidate_ids:
        raise HTTPException(status_code=400, detail="No candidate IDs provided")

    if not payload.job_id:
        raise HTTPException(status_code=400, detail="Job ID is required")

    if not payload.apply_link:
        raise HTTPException(status_code=400, detail="Apply link is required")

    # Rate limit / batch limit
    max_batch = 50
    if len(candidate_ids) > max_batch:
        raise HTTPException(
            status_code=400,
            detail=f"Batch too large. Max {max_batch} candidates per request.",
        )

    # Fetch candidates
    candidates = (
        db.query(models.Candidate)
        .filter(models.Candidate.id.in_(candidate_ids))
        .all()
    )

    if not candidates:
        raise HTTPException(status_code=404, detail="No candidates found")

    template = payload.message_template or DEFAULT_TEMPLATE

    def apply_template(tpl: str, candidate_name: str) -> str:
        return (
            tpl.replace("{{name}}", candidate_name)
            .replace("{{job_title}}", payload.job_title)
            .replace("{{company}}", payload.company_name)
            .replace("{{location}}", payload.job_location)
            .replace("{{apply_link}}", payload.apply_link)
            .replace("{{recruiter}}", payload.recruiter_name)
        )

    subject = f"Opportunity at {payload.company_name} – {payload.job_title}"

    sent = 0
    failed = 0
    details = []

    # Duplicate detection window
    duplicate_cutoff = datetime.utcnow() - timedelta(days=30)

    for idx, candidate in enumerate(candidates, start=1):
        candidate_name = candidate.full_name or candidate.name or candidate.email or "Candidate"
        candidate_email = candidate.email

        if not candidate_email:
            failed += 1
            details.append({"candidate": candidate_name, "status": "failed", "reason": "missing email"})
            continue

        valid, msg = validate_email(candidate_email)
        if not valid:
            failed += 1
            details.append({"candidate": candidate_name, "status": "failed", "reason": msg or "invalid email"})
            continue

        normalized_email = sanitize_email(candidate_email)
        candidate.email = normalized_email

        # Avoid duplicate invites for same job within 30 days
        existing = (
            db.query(models.CandidateInvite)
            .filter(
                models.CandidateInvite.candidate_id == candidate.id,
                models.CandidateInvite.job_id == payload.job_id,
                models.CandidateInvite.sent_at >= duplicate_cutoff,
                models.CandidateInvite.status.in_(["sent", "job_invite_sent"]),
            )
            .first()
        )
        if existing:
            failed += 1
            details.append({"candidate": candidate_name, "status": "failed", "reason": "duplicate invite"})
            continue

        personalized = apply_template(template, candidate_name)

        success = send_email(
            to_email=normalized_email,
            subject=subject,
            text=personalized,
        )

        invite_status = "job_invite_sent" if success else "failed"

        invite = models.CandidateInvite(
            candidate_id=candidate.id,
            recruiter_id=current_user.get("id"),
            job_id=payload.job_id,
            status=invite_status,
            message=template,
        )
        db.add(invite)

        if success:
            sent += 1
            details.append({"candidate": candidate_name, "status": "sent"})
        else:
            failed += 1
            details.append({"candidate": candidate_name, "status": "failed", "reason": "email send failed"})

        # Simple rate limiting: pause after every 10 emails
        if idx % 10 == 0:
            time.sleep(0.2)

    db.commit()

    return {
        "sent": sent,
        "failed": failed,
        "details": details,
    }

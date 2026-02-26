from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.db import get_db
from app import models
from app.auth import get_current_user, SECRET_KEY, ALGORITHM
from app.permissions import require_permission
from jose import jwt

router = APIRouter(prefix="/v1/communications", tags=["Communications"])

security = HTTPBearer()


# =====================================================================
# OPTIONAL: EXTRACT USER FROM TOKEN (if ever needed for public APIs)
# =====================================================================
def get_user_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return data
    except:
        raise HTTPException(401, "Invalid or expired token")


# =====================================================================
# BULK EMAIL
# =====================================================================
@router.post("/bulk-email")
@require_permission("communications", "update")
def send_bulk_email(
    recipient_type: str,            # candidates, employees, applicants, alumni
    recipient_ids: List[str],
    subject: str,
    message_body: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Send bulk emails to multiple recipients.
    NOTE: This only logs to CommunicationLog (status='queued').
    Actual SMTP integration is separate.
    """

    sent_count = 0
    failed_count = 0

    for recipient_id in recipient_ids:
        recipient = None
        email = None

        if recipient_type == "candidates":
            recipient = db.query(models.Candidate).filter(
                models.Candidate.id == recipient_id
            ).first()
            email = recipient.email if recipient else None

        elif recipient_type == "employees":
            recipient = db.query(models.Employee).filter(
                models.Employee.id == recipient_id
            ).first()
            email = recipient.email if recipient else None

        elif recipient_type == "applicants":
            recipient = db.query(models.JobApplication).filter(
                models.JobApplication.id == recipient_id
            ).first()
            email = recipient.email if recipient else None

        elif recipient_type == "alumni":
            recipient = db.query(models.Alumni).filter(
                models.Alumni.id == recipient_id
            ).first()
            if recipient:
                employee = db.query(models.Employee).filter(
                    models.Employee.id == recipient.employee_id
                ).first()
                email = employee.email if employee else None

        if not email:
            failed_count += 1
            continue

        log = models.CommunicationLog(
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            recipient_email=email,
            channel="email",
            message_type="bulk",
            subject=subject,
            message_body=message_body,
            status="queued",
            sent_at=datetime.utcnow(),
            sent_by=current_user["id"],
        )

        db.add(log)
        sent_count += 1

    db.commit()

    return {
        "message": "Bulk email queued successfully",
        "sent_count": sent_count,
        "failed_count": failed_count,
        "total_recipients": len(recipient_ids),
        "note": "SMTP integration required for actual email delivery. Currently only logs are created.",
    }


# =====================================================================
# BULK SMS
# =====================================================================
@router.post("/bulk-sms")
@require_permission("communications", "update")
def send_bulk_sms(
    recipient_type: str,          # candidates, employees, applicants
    recipient_ids: List[str],
    message_body: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Send bulk SMS using provider (e.g. Twilio).
    NOTE: Only logs are created (status='queued').
    """

    sent_count = 0
    failed_count = 0

    for recipient_id in recipient_ids:
        phone = None

        if recipient_type == "candidates":
            recipient = db.query(models.Candidate).filter(
                models.Candidate.id == recipient_id
            ).first()
            phone = recipient.phone if recipient else None

        elif recipient_type == "employees":
            recipient = db.query(models.Employee).filter(
                models.Employee.id == recipient_id
            ).first()
            phone = recipient.phone if recipient else None

        elif recipient_type == "applicants":
            recipient = db.query(models.JobApplication).filter(
                models.JobApplication.id == recipient_id
            ).first()
            phone = recipient.phone if recipient else None

        if not phone:
            failed_count += 1
            continue

        log = models.CommunicationLog(
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            recipient_phone=phone,
            channel="sms",
            message_type="bulk",
            message_body=message_body,
            status="queued",
            sent_at=datetime.utcnow(),
            sent_by=current_user["id"],
        )

        db.add(log)
        sent_count += 1

    db.commit()

    return {
        "message": "Bulk SMS queued successfully",
        "sent_count": sent_count,
        "failed_count": failed_count,
        "total_recipients": len(recipient_ids),
        "note": "SMS provider integration required. Currently only logs are created.",
    }


# =====================================================================
# WHATSAPP MESSAGE
# =====================================================================
@router.post("/whatsapp")
@require_permission("communications", "update")
def send_whatsapp_message(
    recipient_phone: str,
    message_body: str,
    recipient_type: Optional[str] = None,
    recipient_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Send WhatsApp message (requires WhatsApp Business API).
    Currently only logged as queued.
    """

    log = models.CommunicationLog(
        recipient_type=recipient_type,
        recipient_id=recipient_id,
        recipient_phone=recipient_phone,
        channel="whatsapp",
        message_type="individual",
        message_body=message_body,
        status="queued",
        sent_at=datetime.utcnow(),
        sent_by=current_user["id"],
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "message": "WhatsApp message queued successfully",
        "log_id": log.id,
        "note": "WhatsApp Business API integration required for actual delivery.",
    }


# =====================================================================
# SLACK NOTIFICATION
# =====================================================================
@router.post("/slack-notification")
@require_permission("communications", "update")
def send_slack_notification(
    channel: str,
    message: str,
    notification_type: str = "info",
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Send Slack notification (requires Slack integration).
    Currently only logged as queued.
    """

    log = models.CommunicationLog(
        recipient_type=None,
        recipient_id=None,
        channel="slack",
        message_type=notification_type,
        subject=f"Slack: {channel}",
        message_body=message,
        status="queued",
        sent_at=datetime.utcnow(),
        sent_by=current_user["id"],
    )

    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "message": "Slack notification queued successfully",
        "log_id": log.id,
        "note": "Slack integration required for actual delivery.",
    }


# =====================================================================
# GET COMMUNICATION LOGS
# =====================================================================
@router.get("/logs")
@require_permission("communications", "view")
def get_communication_logs(
    channel: Optional[str] = None,
    status: Optional[str] = None,
    recipient_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get communication logs with basic filters.
    """

    query = db.query(models.CommunicationLog)

    if channel:
        query = query.filter(models.CommunicationLog.channel == channel)
    if status:
        query = query.filter(models.CommunicationLog.status == status)
    if recipient_type:
        query = query.filter(models.CommunicationLog.recipient_type == recipient_type)

    logs = query.order_by(models.CommunicationLog.sent_at.desc()).limit(limit).all()

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "channel": log.channel,
            "recipient_type": log.recipient_type,
            "recipient_email": log.recipient_email,
            "recipient_phone": log.recipient_phone,
            "subject": log.subject,
            "message_type": log.message_type,
            "status": log.status,
            "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            "error_message": log.error_message,
        })

    return result


# =====================================================================
# EMAIL TEMPLATES FOR CANDIDATE STAGES
# =====================================================================
CANDIDATE_EMAIL_TEMPLATES: Dict[str, Dict[str, str]] = {
    "applied": {
        "subject": "Application Received - {job_title}",
        "body": """Dear {candidate_name},

Thank you for applying for the {job_title} position at our organization. We have received your application and our recruitment team is currently reviewing it.

We appreciate your interest in joining our team and will get back to you soon regarding the next steps.

Best regards,
Recruitment Team"""
    },
    "screening": {
        "subject": "Application Under Review - {job_title}",
        "body": """Dear {candidate_name},

Good news! Your application for the {job_title} position has moved to the screening stage. Our recruitment team is carefully reviewing your qualifications and experience.

We will contact you within the next few days regarding the next steps in the recruitment process.

Best regards,
Recruitment Team"""
    },
    "interview": {
        "subject": "Interview Scheduled - {job_title}",
        "body": """Dear {candidate_name},

Congratulations! We would like to invite you for an interview for the {job_title} position.

Interview Details:
- Date: {interview_date}
- Time: {interview_time}
- Mode: {interview_mode}
{interview_link}

Please confirm your availability by replying to this email.

We look forward to meeting you!

Best regards,
Recruitment Team"""
    },
    "offer": {
        "subject": "Job Offer - {job_title}",
        "body": """Dear {candidate_name},

We are pleased to offer you the position of {job_title} at our organization!

After careful consideration, we believe you would be a great addition to our team. Please find the detailed offer letter attached.

We request you to review the offer and respond within 3 business days.

Congratulations and we look forward to welcoming you aboard!

Best regards,
Recruitment Team"""
    },
    "hired": {
        "subject": "Welcome Aboard! - {job_title}",
        "body": """Dear {candidate_name},

Welcome to the team! We are excited to have you join us as {job_title}.

Your onboarding process will begin on {start_date}. Our HR team will contact you soon with all the necessary details and documentation required.

We look forward to working with you!

Best regards,
HR Team"""
    },
    "rejected": {
        "subject": "Application Status Update - {job_title}",
        "body": """Dear {candidate_name},

Thank you for your interest in the {job_title} position and for taking the time to go through our recruitment process.

After careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.

We appreciate your interest in our organization and encourage you to apply for future openings that match your skills and experience.

We wish you the best in your job search.

Best regards,
Recruitment Team"""
    },
}


# =====================================================================
# NOTIFY CANDIDATE BY STAGE
# =====================================================================
@router.post("/notify-candidate-stage")
@require_permission("communications", "update")
def notify_candidate_stage(
    candidate_id: str,
    stage: str,                      # applied, screening, interview, offer, hired, rejected
    channel: str = "email",          # email, sms, both
    custom_message: Optional[str] = None,
    interview_details: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Send automated notification to candidate based on their recruitment stage.
    """

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # NOTE: models.Candidate uses `applied_job_id`, NOT job_id
    job = None
    if candidate.applied_job_id:
        job = db.query(models.Job).filter(
            models.Job.id == candidate.applied_job_id
        ).first()

    job_title = job.title if job else "Position"
    candidate_name = candidate.full_name or "Candidate"

    # ----------------- Build subject + message -----------------
    if custom_message:
        subject = f"Update on your application - {job_title}"
        message_body = custom_message
    else:
        template = CANDIDATE_EMAIL_TEMPLATES.get(stage)
        if not template:
            raise HTTPException(status_code=400, detail=f"Invalid stage: {stage}")

        subject = template["subject"].format(
            job_title=job_title,
            candidate_name=candidate_name,
        )

        message_data = {
            "candidate_name": candidate_name,
            "job_title": job_title,
            "interview_date": "TBD",
            "interview_time": "TBD",
            "interview_mode": "Video Call",
            "interview_link": "",
            "start_date": "TBD",
        }

        if stage == "interview" and interview_details:
            message_data["interview_date"] = interview_details.get("date", "TBD")
            message_data["interview_time"] = interview_details.get("time", "TBD")
            message_data["interview_mode"] = interview_details.get("mode", "Video Call")
            link = interview_details.get("link")
            message_data["interview_link"] = f"\n- Link: {link}" if link else ""

        if stage == "hired" and interview_details:
            message_data["start_date"] = interview_details.get("start_date", "TBD")

        message_body = template["body"].format(**message_data)

    logs_created = []

    # ----------------- EMAIL -----------------
    if channel in ["email", "both"] and candidate.email:
        email_log = models.CommunicationLog(
            recipient_type="candidates",
            recipient_id=candidate_id,
            recipient_email=candidate.email,
            channel="email",
            message_type=f"stage_{stage}",
            subject=subject,
            message_body=message_body,
            status="queued",
            sent_at=datetime.utcnow(),
            sent_by=current_user["id"],
        )
        db.add(email_log)
        logs_created.append({"channel": "email", "status": "queued"})

    # ----------------- SMS -----------------
    if channel in ["sms", "both"] and candidate.phone:
        sms_message = (
            f"Hi {candidate_name}, update on your {job_title} application: "
            f"{stage.upper()}. Check your email for details."
        )
        sms_log = models.CommunicationLog(
            recipient_type="candidates",
            recipient_id=candidate_id,
            recipient_phone=candidate.phone,
            channel="sms",
            message_type=f"stage_{stage}",
            message_body=sms_message,
            status="queued",
            sent_at=datetime.utcnow(),
            sent_by=current_user["id"],
        )
        db.add(sms_log)
        logs_created.append({"channel": "sms", "status": "queued"})

    db.commit()

    return {
        "message": f"Candidate {stage} notification queued successfully",
        "candidate_id": candidate_id,
        "candidate_name": candidate_name,
        "stage": stage,
        "notifications_sent": logs_created,
        "note": "Actual email/SMS delivery needs integration. Currently only logs are created.",
    }


# =====================================================================
# GET TEMPLATES
# =====================================================================
@router.get("/templates")
@require_permission("communications", "view")
def get_notification_templates(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all available candidate notification templates.
    """
    return {
        "templates": CANDIDATE_EMAIL_TEMPLATES,
        "available_stages": list(CANDIDATE_EMAIL_TEMPLATES.keys()),
    }


# =====================================================================
# COMMUNICATION ANALYTICS
# =====================================================================
@router.get("/analytics")
@require_permission("communications", "view")
def get_communication_analytics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Simple communication analytics summary.
    """

    query = db.query(models.CommunicationLog)

    if start_date:
        query = query.filter(models.CommunicationLog.sent_at >= start_date)
    if end_date:
        query = query.filter(models.CommunicationLog.sent_at <= end_date)

    logs = query.all()

    total_sent = len(logs)
    by_channel: Dict[str, int] = {}
    by_status: Dict[str, int] = {}

    for log in logs:
        ch = log.channel or "Unknown"
        st = log.status or "Unknown"

        by_channel[ch] = by_channel.get(ch, 0) + 1
        by_status[st] = by_status.get(st, 0) + 1

    return {
        "total_communications": total_sent,
        "by_channel": by_channel,
        "by_status": by_status,
    }

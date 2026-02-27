"""
Email Service
Handles all email notifications, reminders, and escalations
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict
from datetime import datetime
import logging
from fastapi import BackgroundTasks
from app.db import SessionLocal
from app import models

logger = logging.getLogger(__name__)

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
FROM_EMAIL = os.getenv("SENDER_EMAIL", "noreply@akshu-hr.com")
FROM_PASSWORD = os.getenv("SENDER_PASSWORD", "your_app_password")


def _get_setting(key: str, default=None):
    db = SessionLocal()
    try:
        row = (
            db.query(models.SystemSettings)
            .filter(
                (models.SystemSettings.config_key == key)
                | (
                    (models.SystemSettings.module_name == key.split(".", 1)[0])
                    & (models.SystemSettings.setting_key == key.split(".", 1)[1] if "." in key else key)
                )
            )
            .order_by(models.SystemSettings.updated_at.desc())
            .first()
        )
        if not row:
            return default
        if row.value_json is not None:
            return row.value_json
        if row.setting_value is not None:
            return row.setting_value
        return default
    except Exception:
        return default
    finally:
        db.close()


def send_email(to_email: str, subject: str, text: str = None, html_content: str = None):
    """
    Supports BOTH plain text and HTML emails.
    """

    provider = str(_get_setting("email.provider", "smtp") or "smtp").strip().lower()
    if not bool(_get_setting("notify.enable_system_emails", True)):
        logger.info("System emails disabled by settings")
        return True

    sender_name = str(_get_setting("email.from_name", "ATS-HR") or "ATS-HR").strip()
    sender_address = str(_get_setting("email.from_address", FROM_EMAIL) or FROM_EMAIL).strip()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{sender_name} <{sender_address}>"
    msg["To"] = to_email

    # Add plain text if provided
    if text:
        msg.attach(MIMEText(text, "plain"))

    # Add HTML if provided
    if html_content:
        msg.attach(MIMEText(html_content, "html"))

    try:
        if provider not in {"smtp", "sendgrid"}:
            provider = "smtp"

        if provider == "sendgrid":
            # Keep runtime simple: SendGrid SMTP relay mode using existing SMTP pipeline.
            sendgrid_key = str(_get_setting("email.sendgrid_api_key", "") or "").strip()
            if sendgrid_key:
                smtp_server = "smtp.sendgrid.net"
                smtp_port = 587
                smtp_user = "apikey"
                smtp_password = sendgrid_key
            else:
                smtp_server = SMTP_SERVER
                smtp_port = SMTP_PORT
                smtp_user = sender_address
                smtp_password = FROM_PASSWORD
        else:
            smtp_cfg = _get_setting("email.smtp_config", {}) or {}
            smtp_server = str(smtp_cfg.get("server") or SMTP_SERVER)
            smtp_port = int(smtp_cfg.get("port") or SMTP_PORT)
            smtp_user = str(smtp_cfg.get("username") or sender_address)
            smtp_password = str(smtp_cfg.get("password") or FROM_PASSWORD)

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(sender_address, to_email, msg.as_string())
        server.quit()
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Email Error: {e}")
        return False


def send_email_background(
    background_tasks: BackgroundTasks,
    to_email: str,
    subject: str,
    text: str = None,
    html_content: str = None
):
    """
    Allows async (non-blocking) HTML OR text emails.
    """
    background_tasks.add_task(send_email, to_email, subject, text, html_content)


# ========================
# EMAIL TEMPLATES
# ========================

def send_application_received(candidate_name: str, recipient: str, job_title: str):
    """Email: Application received confirmation."""
    subject = f"Application Received - {job_title}"
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>Hi {candidate_name},</h2>
            <p>Thank you for applying for the <strong>{job_title}</strong> position!</p>
            <p>We have received your application and will review it carefully. You will hear from us within 3-5 business days.</p>
            <p>In the meantime, feel free to check our careers page for other opportunities.</p>
            <p>Best regards,<br/>The Recruitment Team</p>
        </body>
    </html>
    """
    return send_email(recipient, subject, html_content=html_body)


def send_interview_invitation(
    candidate_name: str,
    recipient: str,
    interview_date: str,
    interview_time: str,
    interview_type: str,
    interviewer_name: str,
    meeting_link: Optional[str] = None,
):
    """Email: Interview invitation."""
    subject = f"Interview Invitation - {interview_date}"
    meeting_info = f"""
    <p><strong>Meeting Link:</strong> <a href="{meeting_link}">{meeting_link}</a></p>
    """ if meeting_link else ""

    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>Hi {candidate_name},</h2>
            <p>Congratulations! You have been selected for an interview.</p>
            <p><strong>Interview Details:</strong></p>
            <ul>
                <li>Date: {interview_date}</li>
                <li>Time: {interview_time}</li>
                <li>Type: {interview_type.replace('_', ' ').title()}</li>
                <li>Interviewer: {interviewer_name}</li>
            </ul>
            {meeting_info}
            <p>Please confirm your availability by replying to this email.</p>
            <p>Best regards,<br/>The Recruitment Team</p>
        </body>
    </html>
    """
    return send_email(recipient, subject, html_content=html_body)


def send_interview_reminder(
    candidate_name: str,
    recipient: str,
    interview_date: str,
    interview_time: str,
    meeting_link: Optional[str] = None,
):
    """Email: Interview reminder (24 hours before)."""
    subject = f"Reminder: Interview Tomorrow at {interview_time}"
    meeting_info = f"""
    <p><strong>Join Meeting:</strong> <a href="{meeting_link}">{meeting_link}</a></p>
    """ if meeting_link else ""

    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>Hi {candidate_name},</h2>
            <p>This is a reminder about your interview scheduled for <strong>{interview_date} at {interview_time}</strong>.</p>
            {meeting_info}
            <p>Please ensure you have a stable internet connection and a quiet environment for the interview.</p>
            <p>If you need to reschedule, please let us know as soon as possible.</p>
            <p>Best regards,<br/>The Recruitment Team</p>
        </body>
    </html>
    """
    return send_email(recipient, subject, html_content=html_body)


def send_offer_letter(
    candidate_name: str,
    recipient: str,
    position_title: str,
    salary: float,
    currency: str,
    start_date: str,
    benefits: Optional[str] = None,
):
    """Email: Job offer letter."""
    subject = f"Job Offer - {position_title}"
    benefits_section = f"""
    <h3>Benefits:</h3>
    <p>{benefits}</p>
    """ if benefits else ""

    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>Congratulations {candidate_name}!</h2>
            <p>We are pleased to offer you the position of <strong>{position_title}</strong>.</p>
            <h3>Offer Details:</h3>
            <ul>
                <li>Position: {position_title}</li>
                <li>Salary: {salary:,.0f} {currency}/year</li>
                <li>Start Date: {start_date}</li>
            </ul>
            {benefits_section}
            <p>Please confirm your acceptance by replying to this email within 3 days.</p>
            <p>Best regards,<br/>The Recruitment Team</p>
        </body>
    </html>
    """
    return send_email(recipient, subject, html_content=html_body)


def send_rejection_email(
    candidate_name: str,
    recipient: str,
    job_title: str,
    feedback: Optional[str] = None,
):
    """Email: Rejection notification."""
    subject = f"Application Status - {job_title}"
    feedback_section = f"""
    <h3>Feedback:</h3>
    <p>{feedback}</p>
    """ if feedback else ""

    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>Hi {candidate_name},</h2>
            <p>Thank you for applying for the <strong>{job_title}</strong> position.</p>
            <p>After careful consideration, we have decided to move forward with other candidates.</p>
            {feedback_section}
            <p>We appreciate your interest and encourage you to apply for future opportunities.</p>
            <p>Best regards,<br/>The Recruitment Team</p>
        </body>
    </html>
    """
    return send_email(recipient, subject, html_content=html_body)


def send_daily_digest(
    recipient: str,
    metrics: Dict,
):
    """Email: Daily digest of recruitment metrics."""
    subject = f"Daily Recruitment Digest - {datetime.now().strftime('%B %d, %Y')}"

    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>Daily Recruitment Summary</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background-color: #f2f2f2;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Metric</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Value</th>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Open Positions</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">{metrics.get('open_positions', 0)}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">New Applications</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">{metrics.get('new_applications', 0)}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Interviews Scheduled</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">{metrics.get('interviews_scheduled', 0)}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Offers Extended</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">{metrics.get('offers_extended', 0)}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">Joinings</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">{metrics.get('joinings', 0)}</td>
                </tr>
            </table>
            <p style="margin-top: 20px;">Best regards,<br/>Akshu HR</p>
        </body>
    </html>
    """
    return send_email(recipient, subject, html_content=html_body)

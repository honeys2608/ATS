"""
CLIENT WORKFLOWS - Complete Implementation
Handles all 6 client workflows: Access Enablement, Profile Review,
Interview Feedback, Timesheet Approval, Invoice Viewing, and Payment Confirmation
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import os

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from app.utils.activity import log_activity
from pydantic import BaseModel

router = APIRouter(
    prefix="/v1/client",
    tags=["Client Workflows"]
)

# ==========================================
# SCHEMAS
# ==========================================

class InterviewFeedbackRequest(BaseModel):
    decision: str  # "selected", "rejected", "hold"
    feedback_comments: str  # Mandatory, min 10 chars

class TimesheetDecisionRequest(BaseModel):
    decision: str  # "approve", "reject"
    reason: Optional[str] = None  # Required if rejected

class PaymentConfirmationRequest(BaseModel):
    payment_date: str
    reference: Optional[str] = None


# ==========================================
# WORKFLOW A: CLIENT ACCESS & ENABLEMENT
# ==========================================

@router.get("/dashboard")
@require_permission("client", "view")
def client_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow A: Client Dashboard
    Shows assigned requirements, submissions, deployments
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    # Get client info
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.status == "active"
    ).first()
    
    if not client:
        raise HTTPException(403, "Client access is disabled")
    
    # Get assigned requirements
    requirements = db.query(models.Requirement).filter(
        models.Requirement.client_id == client_id,
        models.Requirement.status.in_(["active", "closed"])
    ).all()
    
    # Get submissions for this client's requirements
    requirement_ids = [r.id for r in requirements]
    
    submissions = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.requirement_id.in_(requirement_ids) if requirement_ids else False
    ).all()
    
    # Get active deployments
    deployments = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.client_id == client_id,
        models.ConsultantDeployment.status.in_(["active", "extended"])
    ).all()
    
    # Get pending timesheets
    pending_timesheets = db.query(models.Timesheet).filter(
        models.Timesheet.client_id == client_id,
        models.Timesheet.status == "submitted"
    ).count()
    
    # Get pending invoices
    pending_invoices = db.query(models.Invoice).filter(
        models.Invoice.client_id == client_id,
        models.Invoice.status == "sent"
    ).count()
    
    return {
        "message": f"Welcome {client.client_name}",
        "client_id": client.id,
        "total_requirements": len(requirements),
        "total_submissions": len(submissions),
        "active_deployments": len(deployments),
        "pending_timesheets": pending_timesheets,
        "pending_invoices": pending_invoices,
        "requirements": [{"id": r.id, "title": r.title, "status": r.status} for r in requirements],
        "next_step": "Review submissions and manage approvals"
    }


# ==========================================
# WORKFLOW B: CONSULTANT PROFILE REVIEW
# ==========================================

@router.get("/submissions")
@require_permission("client", "view")
def get_client_submissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get all submissions for client's requirements
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    # Get client's requirements
    requirements = db.query(models.Requirement).filter(
        models.Requirement.client_id == client_id
    ).all()
    
    requirement_ids = [r.id for r in requirements]
    
    if not requirement_ids:
        return {"total": 0, "submissions": []}
    
    # Get submissions for these requirements
    submissions = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.requirement_id.in_(requirement_ids)
    ).all()
    
    result = []
    for sub in submissions:
        consultant = db.query(models.Consultant).filter(
            models.Consultant.id == sub.consultant_id
        ).first()
        
        requirement = db.query(models.Requirement).filter(
            models.Requirement.id == sub.requirement_id
        ).first()
        
        if consultant and requirement:
            result.append({
                "submission_id": sub.id,
                "consultant_name": consultant.full_name,
                "consultant_email": consultant.email,
                "consultant_phone": consultant.phone,
                "skills": consultant.skills,
                "experience": consultant.years_experience if hasattr(consultant, "years_experience") else "N/A",
                "requirement_title": requirement.title,
                "status": sub.status,
                "submitted_at": sub.submitted_at,
                "interview_scheduled": sub.status == "interview_scheduled",
                "next_step": "Review and schedule interview"
            })
    
    return {
        "total": len(result),
        "submissions": result
    }


@router.get("/submissions/{submission_id}")
@require_permission("client", "view")
def get_submission_details(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow B: Get Consultant Profile Details
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()
    
    if not submission:
        raise HTTPException(404, "Submission not found")
    
    # Verify client owns this submission
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == submission.requirement_id,
        models.Requirement.client_id == client_id
    ).first()
    
    if not requirement:
        raise HTTPException(403, "You do not have access to this submission")
    
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == submission.consultant_id
    ).first()
    
    if not consultant:
        raise HTTPException(404, "Consultant not found")
    
    # Get interview details if scheduled
    interview = db.query(models.Interview).filter(
        models.Interview.submission_id == submission_id
    ).first()
    
    return {
        "submission_id": submission.id,
        "consultant": {
            "name": consultant.full_name,
            "email": consultant.email,
            "phone": consultant.phone,
            "skills": consultant.skills,
            "experience": consultant.total_experience,
            "location": consultant.location if hasattr(consultant, "location") else "N/A",
            "resume_url": consultant.resume_url if hasattr(consultant, "resume_url") else None,
            "availability_date": consultant.availability_date
        },
        "requirement": {
            "title": requirement.title,
            "location": requirement.location,
            "skills": requirement.skills,
            "billing_rate": requirement.billing_rate
        },
        "submission_status": submission.status,
        "interview": {
            "scheduled": interview is not None,
            "date": interview.scheduled_date if interview else None,
            "time": interview.scheduled_time if interview else None,
            "mode": interview.mode if interview else None,
            "status": interview.status if interview else None
        },
        "next_step": "Attend interview and provide feedback"
    }


# ==========================================
# WORKFLOW C: INTERVIEW & FEEDBACK SUBMISSION
# ==========================================

@router.post("/submissions/{submission_id}/feedback")
@require_permission("client", "feedback")
def submit_interview_feedback(
    submission_id: str,
    payload: InterviewFeedbackRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow C: Submit Interview Feedback
    Mandatory: Comments (min 10 chars)
    Decision: Selected, Rejected, or Hold
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()
    
    if not submission:
        raise HTTPException(404, "Submission not found")
    
    # Verify client owns this submission
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == submission.requirement_id,
        models.Requirement.client_id == client_id
    ).first()
    
    if not requirement:
        raise HTTPException(403, "You do not have access to this submission")
    
    # Validate feedback comments (mandatory)
    if not payload.feedback_comments or len(payload.feedback_comments) < 10:
        raise HTTPException(
            status_code=400,
            detail="Feedback comments are mandatory (minimum 10 characters)"
        )
    
    # Validate decision
    if payload.decision not in ["selected", "rejected", "hold"]:
        raise HTTPException(400, "Invalid decision. Must be: selected, rejected, or hold")
    
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == submission.consultant_id
    ).first()
    
    # Update submission with feedback
    submission.status = f"feedback_{payload.decision}"
    submission.client_feedback = payload.feedback_comments
    submission.client_decision = payload.decision
    submission.feedback_date = datetime.utcnow()
    submission.feedback_by = current_user["id"]
    
    # Update consultant status based on decision
    old_consultant_status = consultant.status
    
    if payload.decision == "selected":
        consultant.status = "selected"
        consultant.is_locked = True
    elif payload.decision == "rejected":
        consultant.status = "available"
        consultant.is_locked = False
    elif payload.decision == "hold":
        consultant.status = "on_hold"
        consultant.is_locked = True
    
    db.commit()
    db.refresh(submission)
    
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
        "message": f"Feedback submitted successfully - Decision: {payload.decision}",
        "submission_id": submission.id,
        "decision": payload.decision,
        "consultant_status": consultant.status,
        "next_step": "Account Manager will process your decision"
    }


# ==========================================
# WORKFLOW D: TIMESHEET APPROVAL
# ==========================================

@router.get("/timesheets")
@require_permission("client", "view")
def get_client_timesheets(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get timesheets requiring client approval
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    query = db.query(models.Timesheet).filter(
        models.Timesheet.client_id == client_id
    )
    
    if status:
        query = query.filter(models.Timesheet.status == status)
    else:
        # Default: show pending/submitted timesheets
        query = query.filter(models.Timesheet.status.in_(["submitted", "pending_approval"]))
    
    timesheets = query.all()
    
    result = []
    for ts in timesheets:
        deployment = db.query(models.ConsultantDeployment).filter(
            models.ConsultantDeployment.id == ts.deployment_id
        ).first()
        
        consultant = db.query(models.Consultant).filter(
            models.Consultant.id == deployment.consultant_id
        ).first() if deployment else None
        
        if deployment and consultant:
            result.append({
                "timesheet_id": ts.id,
                "consultant_name": consultant.full_name,
                "period_start": ts.period_start,
                "period_end": ts.period_end,
                "hours_logged": ts.hours if hasattr(ts, "hours") else 0,
                "status": ts.status,
                "submitted_date": ts.submitted_date,
                "next_step": "Approve or reject timesheet"
            })
    
    return {
        "total": len(result),
        "timesheets": result
    }


@router.put("/timesheets/{timesheet_id}/approve")
@require_permission("client", "approve")
def approve_timesheet(
    timesheet_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow D: Approve Timesheet
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    timesheet = db.query(models.Timesheet).filter(
        models.Timesheet.id == timesheet_id,
        models.Timesheet.client_id == client_id
    ).first()
    
    if not timesheet:
        raise HTTPException(404, "Timesheet not found or not assigned to you")
    
    if timesheet.status not in ["submitted", "pending_approval"]:
        raise HTTPException(400, "Only submitted timesheets can be approved")
    
    timesheet.status = "approved"
    timesheet.approved_by = current_user["id"]
    timesheet.approved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(timesheet)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="TIMESHEET_APPROVED",
        entity_type="timesheet",
        entity_id=timesheet.id,
        old_state="submitted",
        new_state="approved",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Timesheet approved successfully",
        "timesheet_id": timesheet.id,
        "status": "approved",
        "next_step": "Finance will generate invoice"
    }


@router.put("/timesheets/{timesheet_id}/reject")
@require_permission("client", "approve")
def reject_timesheet(
    timesheet_id: str,
    payload: TimesheetDecisionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Reject timesheet with mandatory reason
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    if not payload.reason or len(payload.reason) < 5:
        raise HTTPException(400, "Rejection reason is mandatory (minimum 5 characters)")
    
    timesheet = db.query(models.Timesheet).filter(
        models.Timesheet.id == timesheet_id,
        models.Timesheet.client_id == client_id
    ).first()
    
    if not timesheet:
        raise HTTPException(404, "Timesheet not found")
    
    if timesheet.status not in ["submitted", "pending_approval"]:
        raise HTTPException(400, "Only submitted timesheets can be rejected")
    
    timesheet.status = "rejected"
    timesheet.rejection_reason = payload.reason
    timesheet.rejected_by = current_user["id"]
    timesheet.rejected_at = datetime.utcnow()
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="TIMESHEET_REJECTED",
        entity_type="timesheet",
        entity_id=timesheet.id,
        old_state="submitted",
        new_state="rejected",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Timesheet rejected and returned to consultant",
        "timesheet_id": timesheet.id,
        "status": "rejected",
        "reason": payload.reason,
        "next_step": "Consultant will resubmit corrected timesheet"
    }


# ==========================================
# WORKFLOW E: INVOICE VIEW & ACKNOWLEDGEMENT
# ==========================================

@router.get("/invoices")
@require_permission("client", "view")
def get_client_invoices(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow E: Get Invoices
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    query = db.query(models.Invoice).filter(
        models.Invoice.client_id == client_id
    )
    
    if status:
        query = query.filter(models.Invoice.status == status)
    else:
        query = query.filter(models.Invoice.status.in_(["sent", "viewed", "acknowledged"]))
    
    invoices = query.all()
    
    result = []
    for inv in invoices:
        result.append({
            "invoice_id": inv.id,
            "invoice_number": inv.invoice_number,
            "amount": inv.amount,
            "billing_period": f"{inv.billing_period_start} to {inv.billing_period_end}",
            "due_date": inv.due_date,
            "status": inv.status,
            "created_date": inv.created_at,
            "next_step": "Download and review invoice"
        })
    
    return {
        "total": len(result),
        "invoices": result
    }


@router.get("/invoices/{invoice_id}/pdf")
@require_permission("client", "view")
def download_invoice_pdf(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Download invoice as PDF
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.client_id == client_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    if not invoice.pdf_url or not os.path.exists(invoice.pdf_url):
        raise HTTPException(404, "Invoice PDF not available")
    
    # Update invoice status to "viewed"
    if invoice.status == "sent":
        invoice.status = "viewed"
        invoice.viewed_at = datetime.utcnow()
        db.commit()
    
    return {
        "message": "Invoice PDF",
        "invoice_id": invoice.id,
        "pdf_url": invoice.pdf_url,
        "invoice_number": invoice.invoice_number
    }


@router.put("/invoices/{invoice_id}/acknowledge")
@require_permission("client", "view")
def acknowledge_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Acknowledge invoice receipt
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.client_id == client_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    invoice.status = "acknowledged"
    invoice.acknowledged_at = datetime.utcnow()
    invoice.acknowledged_by = current_user["id"]
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="INVOICE_ACKNOWLEDGED",
        entity_type="invoice",
        entity_id=invoice.id,
        old_state="sent",
        new_state="acknowledged",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Invoice acknowledged",
        "invoice_id": invoice.id,
        "status": "acknowledged",
        "due_date": invoice.due_date,
        "next_step": "Process payment and confirm"
    }


# ==========================================
# WORKFLOW F: PAYMENT & COLLECTION CONFIRMATION
# ==========================================

@router.put("/invoices/{invoice_id}/payment-confirmation")
@require_permission("client", "view")
def confirm_payment(
    invoice_id: str,
    payload: PaymentConfirmationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow F: Confirm Payment
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.client_id == client_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    old_status = str(invoice.status or "").lower()
    invoice.status = "paid"
    invoice.payment_date = payload.payment_date
    invoice.payment_reference = payload.reference
    invoice.confirmed_by = current_user["id"]
    invoice.confirmed_at = datetime.utcnow()
    log_activity(
        db,
        action="client.invoice_paid",
        resource_type="invoice",
        actor=current_user,
        resource_id=invoice.id,
        resource_name=invoice.invoice_number,
        client_id=invoice.client_id,
        old_status=old_status,
        new_status="paid",
        metadata={"amount": float(invoice.amount or 0)},
    )
    
    db.commit()
    db.refresh(invoice)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="PAYMENT_CONFIRMED",
        entity_type="invoice",
        entity_id=invoice.id,
        old_state="acknowledged",
        new_state="paid",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Payment confirmed successfully",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "amount": invoice.amount,
        "payment_date": payload.payment_date,
        "reference": payload.reference,
        "status": "paid"
    }


@router.post("/invoices/{invoice_id}/upload-payment-reference")
@require_permission("client", "view")
def upload_payment_reference(
    invoice_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Upload payment reference document (optional)
    """
    
    client_id = current_user.get("client_id")
    
    if not client_id:
        raise HTTPException(403, "You do not have client access")
    
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id,
        models.Invoice.client_id == client_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # Save reference file
    upload_dir = f"uploads/payment_references"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = f"{upload_dir}/{invoice_id}_{file.filename}"
    
    with open(file_path, "wb") as f:
        f.write(file.file.read())
    
    invoice.payment_reference_url = file_path
    db.commit()
    
    return {
        "message": "Payment reference uploaded successfully",
        "invoice_id": invoice.id,
        "file_url": file_path
    }

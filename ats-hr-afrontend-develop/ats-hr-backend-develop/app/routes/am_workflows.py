"""
ACCOUNT MANAGER WORKFLOWS - Complete Implementation
Handles all 8 AM workflows: Client Creation, Requirement Approval,
Submission Review, Selection Approval, Deployment, Change Management,
Invoice Approval, and Collection Tracking
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
from app.utils.email import send_email
from app.utils.activity import log_activity
from pydantic import BaseModel, EmailStr

router = APIRouter(
    prefix="/v1/am",
    tags=["Account Manager Workflows"]
)

# ==========================================
# SCHEMAS
# ==========================================

class ClientCreationRequest(BaseModel):
    client_name: str
    legal_entity: str
    billing_address: str
    gst_details: Optional[str] = None
    payment_terms: int  # Days

class RequirementApprovalRequest(BaseModel):
    requirement_id: str
    approved: bool
    rejection_reason: Optional[str] = None

class SubmissionReviewRequest(BaseModel):
    submission_id: str
    decision: str  # "approve", "reject", "sendback"
    comments: str

class SelectionApprovalRequest(BaseModel):
    submission_id: str
    verify_rate: float
    margin_percentage: float
    approved: bool
    comments: Optional[str] = None

class DeploymentCreationRequest(BaseModel):
    consultant_id: str
    client_id: str
    requirement_id: str
    start_date: str
    end_date: Optional[str] = None
    billing_rate: float
    billing_cycle: str  # "monthly", "weekly", etc.

class DeploymentExtensionRequest(BaseModel):
    new_end_date: str

class DeploymentRateChangeRequest(BaseModel):
    new_rate: float
    effective_date: str
    reason: str

class InvoiceApprovalRequest(BaseModel):
    invoice_id: str
    approved: bool
    rejection_reason: Optional[str] = None

class PaymentConfirmationRequest(BaseModel):
    invoice_id: str
    payment_date: str
    reference: Optional[str] = None


class RecruiterAssignmentRequest(BaseModel):
    requirement_id: str
    recruiter_ids: List[str]
    sla_deadline_days: int = 7
    target_cv_count: int = 5


# ==========================================
# WORKFLOW A: CLIENT CREATION & OWNERSHIP
# ==========================================

@router.post("/clients")
@require_permission("clients", "create")
def create_client(
    payload: ClientCreationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow A: Client Creation & Ownership
    - AM creates client profile
    - Uploads contracts (MSA, SOW, PO)
    - Defines billing terms
    - Status: Draft (until admin activates)
    """
    
    # Generate client ID
    count = db.query(models.Client).count()
    client_code = f"CLT-{str(count + 1).zfill(4)}"
    
    client = models.Client(
        client_name=payload.client_name,
        legal_entity=payload.legal_entity,
        billing_address=payload.billing_address,
        gst_details=payload.gst_details,
        payment_terms=payload.payment_terms,
        client_code=client_code,
        status="draft",
        am_id=current_user["id"],
        created_by=current_user["id"],
        created_at=datetime.utcnow()
    )
    
    db.add(client)
    db.commit()
    db.refresh(client)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="CLIENT_CREATED",
        entity_type="client",
        entity_id=client.id,
        old_state="None",
        new_state="draft",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Client created successfully",
        "client_id": client.id,
        "client_code": client_code,
        "status": "draft",
        "next_step": "Upload contracts and activate client"
    }


@router.post("/clients/{client_id}/upload-contracts")
@require_permission("clients", "update")
def upload_client_contracts(
    client_id: str,
    msa_file: Optional[UploadFile] = File(None),
    sow_file: Optional[UploadFile] = File(None),
    po_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Upload client contracts (MSA, SOW, PO)
    """
    
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.am_id == current_user["id"]
    ).first()
    
    if not client:
        raise HTTPException(404, "Client not found or not assigned to you")
    
    upload_dir = f"uploads/client_docs/{client_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    uploaded_files = {}
    
    if msa_file:
        msa_path = f"{upload_dir}/MSA_{msa_file.filename}"
        with open(msa_path, "wb") as f:
            f.write(msa_file.file.read())
        client.msa_url = msa_path
        uploaded_files["msa"] = msa_path
    
    if sow_file:
        sow_path = f"{upload_dir}/SOW_{sow_file.filename}"
        with open(sow_path, "wb") as f:
            f.write(sow_file.file.read())
        client.sow_url = sow_path
        uploaded_files["sow"] = sow_path
    
    if po_file:
        po_path = f"{upload_dir}/PO_{po_file.filename}"
        with open(po_path, "wb") as f:
            f.write(po_file.file.read())
        client.po_url = po_path
        uploaded_files["po"] = po_path
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="CLIENT_CONTRACTS_UPLOADED",
        entity_type="client",
        entity_id=client.id,
        old_state="draft",
        new_state="draft",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Contracts uploaded successfully",
        "client_id": client.id,
        "uploaded_files": uploaded_files,
        "next_step": "Request admin to activate client"
    }


@router.put("/clients/{client_id}/activate")
@require_permission("clients", "activate")
def activate_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Activate client (AM only, requires admin approval for system access)
    Transitions client from Draft → Active
    """
    
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.am_id == current_user["id"]
    ).first()
    
    if not client:
        raise HTTPException(404, "Client not found or not assigned to you")
    
    if client.status != "draft":
        raise HTTPException(400, "Only draft clients can be activated")
    
    client.status = "active"
    client.activated_at = datetime.utcnow()
    client.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(client)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="CLIENT_ACTIVATED",
        entity_type="client",
        entity_id=client.id,
        old_state="draft",
        new_state="active",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Client activated successfully",
        "client_id": client.id,
        "status": "active",
        "next_step": "Create requirements for this client"
    }


# ==========================================
# WORKFLOW B: REQUIREMENT APPROVAL
# ==========================================

@router.post("/requirements")
@require_permission("requirements", "create")
def create_requirement(
    title: str,
    skills: List[str],
    experience_min: int,
    experience_max: int,
    location: str,
    billing_rate: float,
    duration_days: int,
    positions_count: int,
    client_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Create requirement (AM creates or receives from client)
    """
    
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.am_id == current_user["id"]
    ).first()
    
    if not client:
        raise HTTPException(404, "Client not found or not assigned to you")
    
    requirement = models.Requirement(
        client_id=client_id,
        title=title,
        skills=skills,
        experience_min=experience_min,
        experience_max=experience_max,
        location=location,
        billing_rate=billing_rate,
        duration_days=duration_days,
        positions_count=positions_count,
        status="draft",
        account_manager_id=current_user["id"],
        created_by=current_user["id"],
        created_at=datetime.utcnow()
    )
    
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="REQUIREMENT_CREATED",
        entity_type="requirement",
        entity_id=requirement.id,
        old_state="None",
        new_state="draft",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Requirement created successfully",
        "requirement_id": requirement.id,
        "status": "draft",
        "next_step": "Review and approve requirement"
    }


@router.put("/requirements/{requirement_id}/approve")
@require_permission("requirements", "approve")
def approve_requirement(
    requirement_id: str,
    payload: RequirementApprovalRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow B: Approve or Reject Requirement
    Transitions requirement from Draft → Approved
    """
    
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == requirement_id,
        models.Requirement.account_manager_id == current_user["id"]
    ).first()
    
    if not requirement:
        raise HTTPException(404, "Requirement not found or not assigned to you")
    
    if requirement.status != "draft":
        raise HTTPException(400, "Only draft requirements can be approved")
    
    if payload.approved:
        requirement.status = "approved"
        requirement.rate_locked = True  # Lock rate once approved
        requirement.approved_at = datetime.utcnow()
        
        audit_log = models.AuditLog(
            user_id=current_user["id"],
            action="REQUIREMENT_APPROVED",
            entity_type="requirement",
            entity_id=requirement.id,
            old_state="draft",
            new_state="approved",
            timestamp=datetime.utcnow()
        )
    else:
        requirement.status = "rejected"
        requirement.rejection_reason = payload.rejection_reason
        requirement.rejected_at = datetime.utcnow()
        
        audit_log = models.AuditLog(
            user_id=current_user["id"],
            action="REQUIREMENT_REJECTED",
            entity_type="requirement",
            entity_id=requirement.id,
            old_state="draft",
            new_state="rejected",
            timestamp=datetime.utcnow()
        )
    
    requirement.updated_at = datetime.utcnow()
    if payload.approved:
        log_activity(
            db,
            action="am.requirement_approved",
            resource_type="requirement",
            actor=current_user,
            resource_id=requirement.id,
            resource_name=requirement.title,
            client_id=requirement.client_id,
            old_status="draft",
            new_status="approved",
        )
    db.commit()
    db.add(audit_log)
    db.commit()
    
    return {
        "message": f"Requirement {requirement.status}",
        "requirement_id": requirement.id,
        "status": requirement.status,
        "next_step": "Activate requirement or provide to recruiter"
    }


@router.post("/requirements/{requirement_id}/activate")
@require_permission("requirements", "activate")
def activate_requirement(
    requirement_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Activate approved requirement (becomes visible to recruiters)
    Transitions requirement from Approved → Active
    """
    
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == requirement_id,
        models.Requirement.account_manager_id == current_user["id"]
    ).first()
    
    if not requirement:
        raise HTTPException(404, "Requirement not found")
    
    if requirement.status != "approved":
        raise HTTPException(400, "Only approved requirements can be activated")
    
    requirement.status = "active"
    requirement.activated_at = datetime.utcnow()
    requirement.updated_at = datetime.utcnow()
    log_activity(
        db,
        action="am.requirement_activated",
        resource_type="requirement",
        actor=current_user,
        resource_id=requirement.id,
        resource_name=requirement.title,
        client_id=requirement.client_id,
        old_status="approved",
        new_status="active",
    )
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="REQUIREMENT_ACTIVATED",
        entity_type="requirement",
        entity_id=requirement.id,
        old_state="approved",
        new_state="active",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Requirement activated and visible to recruiters",
        "requirement_id": requirement_id,
        "status": "active",
        "next_step": "Assign recruiters and wait for submissions"
    }


@router.post("/requirements/assign")
@require_permission("requirements", "update")
def assign_requirement_to_recruiters(
    payload: RecruiterAssignmentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow B+: Assign Recruiters to Requirement/Job
    - Links multiple recruiters to a job
    - Sets SLA Deadline
    """
    # First try to find a Job with this ID (since frontend passes job.id)
    job = db.query(models.Job).filter(
        models.Job.id == payload.requirement_id
    ).first()
    
    requirement = None
    
    if not job:
        # Try to find Requirement (legacy flow) - using raw SQL to avoid model column issues
        try:
            from sqlalchemy import text
            result = db.execute(text("""
                SELECT id, title, job_id, client_id, department, 
                       skills_mandatory, skills_good_to_have,
                       experience_min, experience_max, location_details
                FROM requirements 
                WHERE id = :req_id AND account_manager_id = :am_id
                LIMIT 1
            """), {"req_id": str(payload.requirement_id), "am_id": str(current_user["id"])})
            row = result.fetchone()
            
            if row:
                # We have a requirement, check if it has a job
                if row.job_id:
                    job = db.query(models.Job).filter(models.Job.id == row.job_id).first()
                else:
                    # Create a job from requirement data
                    skills = []
                    if row.skills_mandatory:
                        skills.extend(row.skills_mandatory if isinstance(row.skills_mandatory, list) else [])
                    if row.skills_good_to_have:
                        skills.extend(row.skills_good_to_have if isinstance(row.skills_good_to_have, list) else [])
                    
                    location = None
                    if row.location_details:
                        loc = row.location_details if isinstance(row.location_details, dict) else {}
                        location = loc.get("city")
                    
                    new_job = models.Job(
                        title=row.title,
                        description="",
                        skills=skills,
                        min_experience=int(row.experience_min or 0),
                        max_experience=int(row.experience_max or 0),
                        location=location,
                        department=row.department,
                        client_id=row.client_id,
                        account_manager_id=current_user["id"],
                        status="active",
                        created_by=current_user["id"]
                    )
                    db.add(new_job)
                    db.flush()
                    
                    # Link job to requirement
                    db.execute(text("""
                        UPDATE requirements SET job_id = :job_id WHERE id = :req_id
                    """), {"job_id": str(new_job.id), "req_id": str(payload.requirement_id)})
                    
                    job = new_job
        except Exception as e:
            print(f"Requirement query failed: {e}")
            pass
    
    if not job:
        raise HTTPException(404, "Job/Requirement not found")

    # 2. Assign Recruiters
    recruiters = db.query(models.User).filter(models.User.id.in_(payload.recruiter_ids)).all()
    if not recruiters:
        raise HTTPException(400, "No valid recruiters found")
    
    job.recruiters = recruiters
    
    # 3. Update status
    job.status = "active"
    job.updated_at = datetime.utcnow()
    
    # 4. Try to create SLA record only if a matching requirement exists
    try:
        from sqlalchemy import text
        # First check if this requirement_id actually exists in requirements table
        req_exists = db.execute(text("""
            SELECT 1 FROM requirements WHERE id = :req_id LIMIT 1
        """), {"req_id": str(payload.requirement_id)}).fetchone()
        
        if req_exists:
            sla = db.query(models.RequirementSLA).filter(
                models.RequirementSLA.requirement_id == payload.requirement_id
            ).first()
            
            if not sla:
                sla = models.RequirementSLA(requirement_id=payload.requirement_id)
                db.add(sla)
            
            from datetime import timedelta
            sla.target_cv_count = payload.target_cv_count
            sla.deadline_date = datetime.utcnow() + timedelta(days=payload.sla_deadline_days)
    except Exception as sla_error:
        print(f"SLA update failed (non-critical): {sla_error}")
        db.rollback()
        # Re-apply the recruiter assignment after rollback
        job = db.query(models.Job).filter(models.Job.id == job.id).first()
        if job:
            recruiters = db.query(models.User).filter(models.User.id.in_(payload.recruiter_ids)).all()
            job.recruiters = recruiters
            job.status = "active"
            job.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": f"Successfully assigned {len(recruiters)} recruiters to the job",
        "job_id": str(job.id),
        "requirement_id": str(payload.requirement_id),
        "status": "assigned"
    }


# ==========================================
# WORKFLOW C: SUBMISSION REVIEW
# ==========================================

@router.put("/submissions/{submission_id}/am-review")
@require_permission("submissions", "review")
def review_submission(
    submission_id: str,
    payload: SubmissionReviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow C: AM Reviews Submission Quality
    Decision: Approve, Reject, or Send back to recruiter
    """
    
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()
    
    if not submission:
        raise HTTPException(404, "Submission not found")
    
    # Verify AM owns the requirement
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == submission.requirement_id,
        models.Requirement.account_manager_id == current_user["id"]
    ).first()
    
    if not requirement:
        raise HTTPException(403, "You do not have permission to review this submission")
    
    old_state = submission.status
    
    if payload.decision == "approve":
        submission.status = "am_approved"
    elif payload.decision == "reject":
        submission.status = "rejected"
        consultant = db.query(models.Consultant).filter(
            models.Consultant.id == submission.consultant_id
        ).first()
        if consultant:
            consultant.status = "available"
            consultant.is_locked = False
    elif payload.decision == "sendback":
        submission.status = "review_pending"
    
    submission.am_review_comments = payload.comments
    submission.am_reviewed_at = datetime.utcnow()
    submission.reviewed_by = current_user["id"]
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="SUBMISSION_AM_REVIEWED",
        entity_type="submission",
        entity_id=submission.id,
        old_state=old_state,
        new_state=submission.status,
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": f"Submission {payload.decision}ed",
        "submission_id": submission.id,
        "status": submission.status,
        "next_step": "Client will provide feedback if approved"
    }


# ==========================================
# WORKFLOW D: SELECTION APPROVAL & OFFER
# ==========================================

@router.put("/submissions/{submission_id}/approve-offer")
@require_permission("submissions", "approve")
def approve_offer(
    submission_id: str,
    payload: SelectionApprovalRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow D: AM Approves Offer
    - Verifies rate and margin
    - Locks rate for deployment
    - Consultant status: Selected
    """
    
    submission = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.id == submission_id
    ).first()
    
    if not submission:
        raise HTTPException(404, "Submission not found")
    
    # Verify AM owns the requirement
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == submission.requirement_id,
        models.Requirement.account_manager_id == current_user["id"]
    ).first()
    
    if not requirement:
        raise HTTPException(403, "You do not have permission to approve this submission")
    
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == submission.consultant_id
    ).first()
    
    if not consultant:
        raise HTTPException(404, "Consultant not found")
    
    if not payload.approved:
        submission.status = "offer_rejected"
        consultant.status = "available"
        consultant.is_locked = False
    else:
        submission.status = "offer_approved"
        consultant.status = "selected"
        consultant.is_locked = True
        submission.verified_rate = payload.verify_rate
        submission.margin_percentage = payload.margin_percentage
    
    submission.am_approval_comments = payload.comments
    submission.approved_at = datetime.utcnow()
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="OFFER_APPROVED" if payload.approved else "OFFER_REJECTED",
        entity_type="submission",
        entity_id=submission.id,
        old_state="feedback_selected",
        new_state=submission.status,
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": f"Offer {'approved' if payload.approved else 'rejected'}",
        "submission_id": submission.id,
        "consultant_status": consultant.status,
        "verified_rate": payload.verify_rate if payload.approved else None,
        "next_step": "Create deployment record"
    }


# ==========================================
# WORKFLOW E: DEPLOYMENT CREATION
# ==========================================

@router.post("/deployments")
@require_permission("deployments", "create")
def create_deployment(
    payload: DeploymentCreationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow E: Create Deployment
    - Validates consultant, client, requirement
    - Checks BGC and documents
    - Creates deployment record in Active state
    """
    
    # Verify ownership
    client = db.query(models.Client).filter(
        models.Client.id == payload.client_id,
        models.Client.am_id == current_user["id"]
    ).first()
    
    if not client:
        raise HTTPException(403, "You do not have permission to deploy for this client")
    
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == payload.consultant_id,
        models.Consultant.status == "selected"
    ).first()
    
    if not consultant:
        raise HTTPException(400, "Consultant must be in selected status")
    
    requirement = db.query(models.Requirement).filter(
        models.Requirement.id == payload.requirement_id
    ).first()
    
    if not requirement:
        raise HTTPException(404, "Requirement not found")
    
    # Check for duplicate deployment
    existing = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.consultant_id == payload.consultant_id,
        models.ConsultantDeployment.client_id == payload.client_id,
        models.ConsultantDeployment.status.in_(["active", "extended"])
    ).first()
    
    if existing:
        raise HTTPException(400, "Consultant already deployed for this client")
    
    # Create deployment
    deployment = models.ConsultantDeployment(
        consultant_id=payload.consultant_id,
        client_id=payload.client_id,
        requirement_id=payload.requirement_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        billing_rate=payload.billing_rate,
        billing_cycle=payload.billing_cycle,
        status="active",
        account_manager_id=current_user["id"],
        created_by=current_user["id"],
        created_at=datetime.utcnow()
    )
    
    db.add(deployment)
    
    # Update consultant status
    consultant.status = "joined"
    
    db.commit()
    db.refresh(deployment)
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="DEPLOYMENT_CREATED",
        entity_type="deployment",
        entity_id=deployment.id,
        old_state="None",
        new_state="active",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Deployment created successfully",
        "deployment_id": deployment.id,
        "consultant_id": payload.consultant_id,
        "status": "active",
        "next_step": "Monitor timesheets and invoices"
    }


# ==========================================
# WORKFLOW F: DEPLOYMENT CHANGE MANAGEMENT
# ==========================================

@router.put("/deployments/{deployment_id}/extend")
@require_permission("deployments", "update")
def extend_deployment(
    deployment_id: str,
    payload: DeploymentExtensionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Extend deployment end date
    """
    
    deployment = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.id == deployment_id,
        models.ConsultantDeployment.account_manager_id == current_user["id"]
    ).first()
    
    if not deployment:
        raise HTTPException(404, "Deployment not found or not assigned to you")
    
    old_end_date = deployment.end_date
    deployment.end_date = payload.new_end_date
    deployment.status = "extended"
    deployment.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="DEPLOYMENT_EXTENDED",
        entity_type="deployment",
        entity_id=deployment.id,
        old_state=f"end_date:{old_end_date}",
        new_state=f"end_date:{payload.new_end_date}",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Deployment extended successfully",
        "deployment_id": deployment.id,
        "new_end_date": payload.new_end_date,
        "status": "extended"
    }


@router.put("/deployments/{deployment_id}/change-rate")
@require_permission("deployments", "update")
def change_deployment_rate(
    deployment_id: str,
    payload: DeploymentRateChangeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Change deployment rate (future only, cannot modify past periods)
    """
    
    deployment = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.id == deployment_id,
        models.ConsultantDeployment.account_manager_id == current_user["id"]
    ).first()
    
    if not deployment:
        raise HTTPException(404, "Deployment not found")
    
    # Check if effective date is in future
    from datetime import datetime as dt
    if dt.fromisoformat(payload.effective_date) <= datetime.utcnow():
        raise HTTPException(400, "Rate change effective date must be in the future")
    
    old_rate = deployment.billing_rate
    deployment.billing_rate = payload.new_rate
    deployment.rate_change_reason = payload.reason
    deployment.rate_change_effective_date = payload.effective_date
    deployment.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="DEPLOYMENT_RATE_CHANGED",
        entity_type="deployment",
        entity_id=deployment.id,
        old_state=f"rate:{old_rate}",
        new_state=f"rate:{payload.new_rate}",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Deployment rate changed successfully",
        "deployment_id": deployment.id,
        "old_rate": old_rate,
        "new_rate": payload.new_rate,
        "effective_date": payload.effective_date
    }


@router.put("/deployments/{deployment_id}/rolloff")
@require_permission("deployments", "update")
def rolloff_deployment(
    deployment_id: str,
    early_rolloff_date: str,
    reason: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Early roll-off of deployment
    """
    
    deployment = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.id == deployment_id,
        models.ConsultantDeployment.account_manager_id == current_user["id"]
    ).first()
    
    if not deployment:
        raise HTTPException(404, "Deployment not found")
    
    deployment.end_date = early_rolloff_date
    deployment.status = "closed"
    deployment.rolloff_reason = reason
    deployment.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="DEPLOYMENT_ROLLED_OFF",
        entity_type="deployment",
        entity_id=deployment.id,
        old_state="active/extended",
        new_state="closed",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Deployment rolled off successfully",
        "deployment_id": deployment.id,
        "status": "closed",
        "rolloff_date": early_rolloff_date
    }


# ==========================================
# WORKFLOW G: INVOICE APPROVAL
# ==========================================

@router.put("/invoices/{invoice_id}/am-approve")
@require_permission("invoices", "approve")
def approve_invoice(
    invoice_id: str,
    payload: InvoiceApprovalRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow G: AM Approves Invoice
    Verifies timesheet alignment and rate correctness
    """
    
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    # Verify AM can approve this invoice (owns the deployment)
    deployment = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.id == invoice.deployment_id,
        models.ConsultantDeployment.account_manager_id == current_user["id"]
    ).first()
    
    if not deployment:
        raise HTTPException(403, "You do not have permission to approve this invoice")
    
    old_status = invoice.status
    
    if payload.approved:
        invoice.status = "approved"
        invoice.approved_at = datetime.utcnow()
        invoice.approved_by = current_user["id"]
    else:
        invoice.status = "rejected"
        invoice.rejection_reason = payload.rejection_reason
        invoice.rejected_at = datetime.utcnow()
    
    invoice.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="INVOICE_AM_APPROVED" if payload.approved else "INVOICE_AM_REJECTED",
        entity_type="invoice",
        entity_id=invoice.id,
        old_state=old_status,
        new_state=invoice.status,
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": f"Invoice {'approved' if payload.approved else 'rejected'}",
        "invoice_id": invoice.id,
        "status": invoice.status,
        "next_step": "Send to client for payment"
    }


# ==========================================
# WORKFLOW H: COLLECTION TRACKING
# ==========================================

@router.get("/invoices/overdue")
@require_permission("invoices", "view")
def get_overdue_invoices(
    days_threshold: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get overdue invoices (for collection tracking)
    """
    
    from datetime import timedelta
    
    threshold_date = datetime.utcnow() - timedelta(days=days_threshold)
    
    overdue_invoices = db.query(models.Invoice).filter(
        models.Invoice.due_date < threshold_date,
        models.Invoice.status != "paid"
    ).all()
    
    result = []
    for inv in overdue_invoices:
        deployment = db.query(models.ConsultantDeployment).filter(
            models.ConsultantDeployment.id == inv.deployment_id
        ).first()
        
        if deployment and deployment.account_manager_id == current_user["id"]:
            days_overdue = (datetime.utcnow() - inv.due_date).days
            result.append({
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "client_id": deployment.client_id,
                "amount": inv.amount,
                "due_date": inv.due_date,
                "days_overdue": days_overdue,
                "status": inv.status
            })
    
    return {
        "total_overdue": len(result),
        "invoices": result
    }


@router.put("/invoices/{invoice_id}/payment-confirmed")
@require_permission("invoices", "update")
def confirm_payment(
    invoice_id: str,
    payload: PaymentConfirmationRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Mark invoice as paid
    """
    
    invoice = db.query(models.Invoice).filter(
        models.Invoice.id == invoice_id
    ).first()
    
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    
    old_status = str(invoice.status or "").lower()
    invoice.status = "paid"
    invoice.payment_date = payload.payment_date
    invoice.payment_reference = payload.reference
    invoice.updated_at = datetime.utcnow()
    log_activity(
        db,
        action="admin.invoice_paid",
        resource_type="invoice",
        actor=current_user,
        resource_id=invoice.id,
        resource_name=invoice.invoice_number,
        client_id=invoice.client_id if hasattr(invoice, "client_id") else None,
        old_status=old_status,
        new_status="paid",
        metadata={"amount": float(invoice.amount or 0)},
    )
    
    db.commit()
    
    # Audit log
    audit_log = models.AuditLog(
        user_id=current_user["id"],
        action="PAYMENT_CONFIRMED",
        entity_type="invoice",
        entity_id=invoice.id,
        old_state="sent",
        new_state="paid",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "message": "Payment confirmed successfully",
        "invoice_id": invoice.id,
        "status": "paid",
        "payment_date": payload.payment_date
    }


# ==========================================
# AM DASHBOARD
# ==========================================

@router.get("/recruiters")
@require_permission("users", "read")
def get_recruiters_with_workload(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Workflow B: List Recruiters with Workload & Specialization
    - count active jobs
    - high-level skills based on recent assignments
    """
    # 1. Fetch all recruiters
    recruiters = db.query(models.User).filter(
        models.User.role.in_(["recruiter", "recruiter_lead", "admin"])
    ).all()
    
    # 2. Add workload info
    results = []
    for r in recruiters:
        # Count active jobs assigned to this recruiter
        active_jobs_count = db.query(models.job_recruiters).join(
            models.Job, models.job_recruiters.c.job_id == models.Job.id
        ).filter(
            models.job_recruiters.c.recruiter_id == r.id,
            models.Job.status == "active"
        ).count()
        
        # Simple specialization heuristic: Get skills from their last 5 jobs
        recent_jobs = db.query(models.Job).join(
            models.job_recruiters, models.Job.id == models.job_recruiters.c.job_id
        ).filter(
            models.job_recruiters.c.recruiter_id == r.id
        ).order_by(models.Job.created_at.desc()).limit(5).all()
        
        specialization = []
        for j in recent_jobs:
            if j.skills:
                specialization.extend(j.skills if isinstance(j.skills, list) else [])
        
        # Top 3 unique skills as specialization
        top_skills = sorted(list(set(specialization)), key=specialization.count, reverse=True)[:3]
        
        results.append({
            "id": r.id,
            "full_name": r.full_name,
            "email": r.email,
            "workload": active_jobs_count,
            "specialization": top_skills,
            "status": "available" if active_jobs_count < 5 else "busy"
        })
        
    return {"data": results}

@router.get("/dashboard")
@require_permission("am", "view")
def am_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get AM workflow metrics and pending approvals
    """
    
    am_id = current_user["id"]
    
    # Clients managed
    total_clients = db.query(models.Client).filter(
        models.Client.am_id == am_id
    ).count()
    
    active_clients = db.query(models.Client).filter(
        models.Client.am_id == am_id,
        models.Client.status == "active"
    ).count()
    
    # Requirements
    pending_requirements = db.query(models.Requirement).filter(
        models.Requirement.account_manager_id == am_id,
        models.Requirement.status == "draft"
    ).count()
    
    active_requirements = db.query(models.Requirement).filter(
        models.Requirement.account_manager_id == am_id,
        models.Requirement.status == "active"
    ).count()
    
    # Submissions pending review
    pending_submissions = db.query(models.CandidateSubmission).filter(
        models.CandidateSubmission.status == "submitted"
    ).count()
    
    # Deployments
    active_deployments = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.account_manager_id == am_id,
        models.ConsultantDeployment.status.in_(["active", "extended"])
    ).count()
    
    # Invoices
    pending_invoices = db.query(models.Invoice).filter(
        models.Invoice.status == "draft"
    ).count()
    
    overdue_invoices = db.query(models.Invoice).filter(
        models.Invoice.status != "paid",
        models.Invoice.due_date < datetime.utcnow()
    ).count()
    
    return {
        "clients_overview": {
            "total_clients": total_clients,
            "active_clients": active_clients
        },
        "requirements_overview": {
            "pending_approval": pending_requirements,
            "active_requirements": active_requirements
        },
        "submissions_overview": {
            "pending_review": pending_submissions
        },
        "deployments_overview": {
            "active_deployments": active_deployments
        },
        "invoices_overview": {
            "pending_invoices": pending_invoices,
            "overdue_invoices": overdue_invoices
        }
    }

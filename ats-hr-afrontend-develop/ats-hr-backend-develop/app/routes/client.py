from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from app import schemas 
from app.schemas import FinalDecisionRequest
from fastapi import UploadFile, File
import pandas as pd
from sqlalchemy import func
from app.routes.consultants import convert_candidate_to_consultant
from app import ai_core


router = APIRouter(
    prefix="/v1/client",
    tags=["Client"]
)


# ---------------------------------------------------------
# SAFE CLIENT ID FETCHER
# ---------------------------------------------------------
def get_client_id(current_user: dict):
    return (
        current_user.get("client_id")
        or current_user.get("id")
        or current_user.get("user_id")
        or current_user.get("sub")
    )


# ---------------------------------------------------------
# CLIENT CREATES A NEW REQUIREMENT  ⭐ IMPORTANT
@router.post("/requirements", status_code=201)
@require_permission("client", "create")
def create_requirement(
    payload: schemas.ClientRequirementCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    # 🔴 STEP 1: CLIENT FETCH
    client = db.query(models.User).filter(
        models.User.id == client_id
    ).first()

    if not client:
        raise HTTPException(404, "Client not found")

    # 🔴 STEP 2: ACCOUNT MANAGER CHECK
    if not client.account_manager_id:
        raise HTTPException(
            status_code=400,
            detail="No Account Manager assigned to this client"
        )

    # 🔴 STEP 3: REQUIREMENT CODE
    last_code = (
        db.query(models.Requirement.requirement_code)
        .filter(models.Requirement.requirement_code.isnot(None))
        .order_by(models.Requirement.requirement_code.desc())
        .first()
    )

    last_no = int(last_code[0].split("-")[-1]) if last_code and last_code[0] else 0
    requirement_code = f"ATS-R-{str(last_no + 1).zfill(4)}"

    # 🔴 STEP 4: CREATE REQUIREMENT (AM LINKED)
    new_req = models.Requirement(
        client_id=client_id,
        account_manager_id=client.account_manager_id,
        title=payload.title,
        description=payload.description,
        skills_mandatory=payload.skills_mandatory,
        skills_good_to_have=payload.skills_good_to_have,
        experience_min=payload.experience_min,
        experience_max=payload.experience_max,
        ctc_min=payload.ctc_min,
        ctc_max=payload.ctc_max,
        location_details=payload.location_details,
        certifications=payload.certifications,
        positions_count=payload.positions_count,
        interview_stages=payload.interview_stages,
        urgency=payload.urgency,
        target_start_date=payload.target_start_date,
        department=payload.department,
        reporting_manager=payload.reporting_manager,
        priority=payload.priority,
        status="NEW",
        created_at=datetime.utcnow(),
        requirement_code=requirement_code,
        created_by_id=current_user.get("id")
    )

    db.add(new_req)
    db.commit()
    db.refresh(new_req)

    return {
        "message": "Requirement created successfully",
        "requirement_id": new_req.id,
        "requirement_code": new_req.requirement_code,
        "status": new_req.status
    }

# ---------------------------------------------------------
# CLIENT JOB REQUIREMENTS (FOR PORTAL VIEW)
# ---------------------------------------------------------
@router.get("/requirements")
@require_permission("client", "view")
def get_requirements(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    requirements = db.query(models.Requirement).filter(
        models.Requirement.client_id == client_id
    ).all()

    return [
        {
            "id": r.id,
            "requirement_code": r.requirement_code,
            "title": r.title,
            "description": r.description,
            "status": r.status,
            "skills_mandatory": r.skills_mandatory,
            "skills_good_to_have": r.skills_good_to_have,
            "experience_min": r.experience_min,
            "experience_max": r.experience_max,
            "ctc_min": r.ctc_min,
            "ctc_max": r.ctc_max,
            "location_details": r.location_details,
            "certifications": r.certifications,
            "positions_count": r.positions_count,
            "interview_stages": r.interview_stages,
            "urgency": r.urgency,
            "target_start_date": r.target_start_date,
            "department": r.department,
            "reporting_manager": r.reporting_manager,
            "priority": r.priority,
            "created_at": r.created_at,
            "job_id": r.job_id
        }
        for r in requirements
    ]

# ---------------------------------------------------------
# SUBMISSIONS SENT TO CLIENT
# ---------------------------------------------------------
@router.get("/submissions")
@require_permission("client", "view")
def get_submissions(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    apps = (
        db.query(models.JobApplication)
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(
            models.JobApplication.job_id == job_id,
            models.Job.client_id == client_id
        )
        .all()
    )

    return {
        "job_id": job_id,
        "total": len(apps),
        "submissions": [
            {
                "application_id": a.id,
                "candidate_name": a.candidate.full_name if a.candidate else None,
                "email": a.candidate.email if a.candidate else None,
                "status": a.status
            }
            for a in apps
        ]
    }

# ---------------------------------------------------------
# SUBMISSIONS SENT TO CLIENT (PER JOB)
# ---------------------------------------------------------
@router.get("/jobs/{job_id}/submissions")
@require_permission("client", "view")
def get_job_submissions(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    applications = (
        db.query(models.JobApplication)
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(
            models.JobApplication.job_id == job_id,
            models.Job.client_id == client_id,
            func.lower(models.JobApplication.status) == "sent_to_client"
        )
        .all()
    )

    return {
        "job_id": job_id,
        "total": len(applications),
        "submissions": [
            {
                "application_id": a.id,
                "candidate_id": (
                    a.candidate.public_id
                    if a.candidate and a.candidate.public_id
                    else None
                ),
                "candidate_name": a.candidate.full_name if a.candidate else None,
                "email": a.candidate.email if a.candidate else None,
                "status": a.status,
                "sent_to_client_at": a.sent_to_client_at
            }
            for a in applications
        ]
    }


# ---------------------------------------------------------
# CLIENT INTERVIEW FEEDBACK
# ---------------------------------------------------------
@router.post("/interview-feedback")
@require_permission("client", "update")
def interview_feedback(
    application_id: str,
    feedback: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    app = db.query(models.JobApplication).filter(
        models.JobApplication.id == application_id
    ).first()

    if not app:
        raise HTTPException(404, "Application not found")

    app.client_feedback = feedback
    app.client_feedback_at = datetime.utcnow()

    db.commit()

    return {"message": "Feedback submitted successfully"}


# ---------------------------------------------------------
# CLIENT FINAL DECISION
# ---------------------------------------------------------
@router.post("/final-decision")
@require_permission("client", "update")
def final_decision(
    payload: FinalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    app = (
        db.query(models.JobApplication)
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(
            models.JobApplication.id == payload.application_id,
            models.Job.client_id == client_id
        )
        .first()
    )

    if not app:
        raise HTTPException(404, "Application not found for this client")

    decision = payload.decision.lower()

    if decision in ["hire", "hired"]:
        app.client_decision = "hired_by_client"
        app.status = "HIRED"
        app.ready_for_assignment = True
        app.sent_to_am_at = datetime.utcnow()

        existing_consultant = (
            db.query(models.Consultant)
            .filter(models.Consultant.candidate_id == app.candidate_id)
            .first()
        )
        if existing_consultant:
            existing_consultant.status = "available"
    else:
        app.client_decision = decision
        app.status = "rejected"
        app.ready_for_assignment = False

    app.decision_at = datetime.utcnow()
    db.commit()

    return {
        "message": "Client decision saved",
        "application_id": app.id,
        "status": app.status,
        "ready_for_assignment": app.ready_for_assignment
    }

# ---------------------------------------------------------
# CLIENT CONSULTANT DEPLOYMENTS
# ---------------------------------------------------------
@router.get("/deployments")
@require_permission("client", "view")
def get_deployments(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    deployments = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.client_id == client_id
    ).all()

    return [
        {
            "id": d.id,
            "consultant_id": d.consultant_id,
            "consultant_name": (
                d.consultant.candidate.full_name
                if d.consultant and d.consultant.candidate
                else "N/A"
            ),
            "client_name": d.client_name,
            "role": d.role,
            "status": d.status,
            "start_date": d.start_date,
        }
        for d in deployments
    ]


# ---------------------------------------------------------
# CLIENT INVOICES
# ---------------------------------------------------------
@router.get("/invoices")
@require_permission("client", "view")
def get_invoices(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    invoices = db.query(models.Invoice).filter(
        models.Invoice.client_id == client_id
    ).all()

    return [
        {
            "id": i.id,
            "invoice_number": i.invoice_number,
            "amount": i.amount,
            "status": i.status,
            "due_date": i.due_date,
        }
        for i in invoices
    ]


@router.get("/submissions/all")
@require_permission("client", "view")
def get_all_submissions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    applications = (
        db.query(models.JobApplication)
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(
            models.Job.client_id == client_id,
            func.lower(models.JobApplication.status) == "sent_to_client"
        )
        .all()
    )

    return {
        "total": len(applications),
        "submissions": [
            {
                "application_id": a.id,
                "job_id": a.job_id,
                "candidate_name": a.candidate.full_name if a.candidate else None,
                "email": a.candidate.email if a.candidate else None,
                "status": a.status,
                "sent_to_client_at": a.sent_to_client_at
            }
            for a in applications
        ]
    }


# ---------------------------------------------------------
# CLIENT MASTER PROFILE
# ---------------------------------------------------------
@router.get("/master")
@require_permission("client", "view")
def get_client_profile(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    client = db.query(models.User).filter(
        models.User.id == client_id
    ).first()

    if not client:
        raise HTTPException(404, "Client not found")

    return {
        "id": client.id,
        "name": client.full_name,
        "email": client.email,
        "company_name": client.company_name,
        "is_active": client.is_active
    }

@router.put("/master/{client_id}")
@require_permission("client", "update")
def update_client(
    client_id: str,
    payload: schemas.ClientUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client = db.query(models.User).filter(
        models.User.id == client_id
    ).first()

    if not client:
        raise HTTPException(404, "Client not found")

    client.full_name = payload.full_name
    client.company_name = payload.company_name
    db.commit()

    return {"message": "Client updated successfully"}


# ---------------------------------------------------------
# CLIENT CONTACTS
# ---------------------------------------------------------
@router.post("/contacts", status_code=201)
@require_permission("client", "create")
def add_contact(
    payload: schemas.ClientContactCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    contact = models.ClientContact(
        client_id=client_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone
    )

    db.add(contact)
    db.commit()

    return {"message": "Contact added successfully"}

@router.get("/contacts")
@require_permission("client", "view")
def get_contacts(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)
    contacts = db.query(models.ClientContact).filter(
        models.ClientContact.client_id == client_id
    ).all()
    return contacts

@router.put("/contacts/{contact_id}")
@require_permission("client", "update")
def update_contact(
    contact_id: str,
    payload: schemas.ClientContactUpdate,
    db: Session = Depends(get_db)
):
    contact = db.query(models.ClientContact).filter(
        models.ClientContact.id == contact_id
    ).first()

    if not contact:
        raise HTTPException(404, "Contact not found")

    contact.name = payload.name
    contact.email = payload.email
    contact.phone = payload.phone
    db.commit()

    return {"message": "Contact updated successfully"}

@router.delete("/contacts/{contact_id}")
@require_permission("client", "delete")
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    contact = db.query(models.ClientContact).filter(
        models.ClientContact.id == contact_id
    ).first()

    if not contact:
        raise HTTPException(404, "Contact not found")

    db.delete(contact)
    db.commit()

    return {"message": "Contact deleted successfully"}


# ---------------------------------------------------------
# REQUIREMENT MANAGEMENT (UPDATE / DELETE / STATUS)
# ---------------------------------------------------------
@router.put("/requirements/{req_id}")
@require_permission("client", "update")
def update_requirement(
    req_id: str,
    payload: schemas.ClientRequirementUpdate,
    db: Session = Depends(get_db)
):
    req = db.query(models.Requirement).filter(
        models.Requirement.id == req_id
    ).first()

    if not req:
        raise HTTPException(404, "Requirement not found")

    req.title = payload.title
    req.description = payload.description
    req.skills_mandatory = payload.skills_mandatory
    req.skills_good_to_have = payload.skills_good_to_have
    req.experience_min = payload.experience_min
    req.experience_max = payload.experience_max
    req.ctc_min = payload.ctc_min
    req.ctc_max = payload.ctc_max
    req.location_details = payload.location_details
    req.certifications = payload.certifications
    req.positions_count = payload.positions_count
    req.interview_stages = payload.interview_stages
    req.urgency = payload.urgency
    req.target_start_date = payload.target_start_date
    req.department = payload.department
    req.reporting_manager = payload.reporting_manager
    req.priority = payload.priority
    
    if payload.status:
        req.status = payload.status
        
    db.commit()
    return {"message": "Requirement updated successfully"}

@router.delete("/requirements/{req_id}")
@require_permission("client", "delete")
def delete_requirement(req_id: str, db: Session = Depends(get_db)):
    req = db.query(models.Requirement).filter(
        models.Requirement.id == req_id
    ).first()

    if not req:
        raise HTTPException(404, "Requirement not found")

    db.delete(req)
    db.commit()

    return {"message": "Requirement deleted successfully"}

@router.patch("/requirements/{req_id}/status")
@require_permission("client", "update")
def change_requirement_status(
    req_id: str,
    status: str,
    db: Session = Depends(get_db)
):
    req = db.query(models.Requirement).filter(
        models.Requirement.id == req_id
    ).first()

    if not req:
        raise HTTPException(404, "Requirement not found")

    req.status = status.upper()
    db.commit()

    return {"message": "Requirement status updated"}


# ---------------------------------------------------------
# BULK UPLOAD (REMAINING SAME FOR NOW)
# ---------------------------------------------------------
@router.post("/requirements/upload")
@require_permission("client", "create")
def upload_requirements_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    client = db.query(models.User).filter(
        models.User.id == client_id
    ).first()

    if not client or not client.account_manager_id:
        raise HTTPException(
            status_code=400,
            detail="No Account Manager assigned to this client"
        )

    df = pd.read_excel(file.file)

    required_columns = ["title", "skills", "budget", "location", "duration", "sla"]
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(400, f"Missing column: {col}")

    last_code = (
        db.query(models.Requirement.requirement_code)
        .filter(models.Requirement.requirement_code.isnot(None))
        .order_by(models.Requirement.requirement_code.desc())
        .first()
    )

    last_no = int(last_code[0].split("-")[-1]) if last_code and last_code[0] else 0
    created = 0

    for _, row in df.iterrows():
        last_no += 1

        req = models.Requirement(
            client_id=client_id,
            account_manager_id=client.account_manager_id,
            title=row["title"],
            # Compatibility with old Excel format
            skills_mandatory=[s.strip() for s in str(row["skills"]).split(",")] if row["skills"] else [],
            ctc_max=row["budget"] if "budget" in row else None,
            status="NEW",
            created_at=datetime.utcnow(),
            requirement_code=f"ATS-R-{str(last_no).zfill(4)}"
        )

        db.add(req)
        created += 1

    db.commit()

    return {
        "message": "Requirements uploaded successfully",
        "count": created
    }


# ---------------------------------------------------------
# CLIENT DASHBOARD METRICS
# ---------------------------------------------------------
@router.get("/dashboard")
@require_permission("client", "view")
def client_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client_id = get_client_id(current_user)

    requirements_count = db.query(models.Requirement).filter(
        models.Requirement.client_id == client_id
    ).count()

    candidates_received = (
        db.query(models.JobApplication)
        .join(models.Job, models.Job.id == models.JobApplication.job_id)
        .filter(
            models.Job.client_id == client_id,
            func.lower(models.JobApplication.status) == "sent_to_client"
        )
        .count()
    )

    active_deployments = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.client_id == client_id,
        models.ConsultantDeployment.status == "active"
    ).count()

    return {
        "requirements": requirements_count,
        "candidates_received": candidates_received,
        "active_deployments": active_deployments
    }


@router.post("/parse-jd")
@require_permission("client", "create")
def parse_jd_endpoint(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    jd_text = payload.get("description")
    if not jd_text:
        raise HTTPException(400, "Description is required")
    
    parsed_data = ai_core.parse_job_description(jd_text)
    return parsed_data

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from datetime import datetime

from app.db import get_db
from app.auth import get_current_user
from app import models
import os

router = APIRouter(prefix="/v1/vendor", tags=["Vendor"])


# ---------- ROLE CHECK ----------
def require_vendor(user, db):
    role = user.get("role") if isinstance(user, dict) else getattr(user, "role", None)

    if role != "vendor":
        raise HTTPException(403, "Vendor access only")

    vendor = db.query(models.Vendor).filter(
        models.Vendor.primary_contact_email == user["email"]
    ).first()

    # ⭐ Auto Create Vendor Profile If Missing
    if not vendor:
        vendor = models.Vendor(
            company_name="Unknown Vendor",
            gst_number="NA",
            payment_terms="NET_30",

            primary_contact_name=user.get("full_name", "Vendor User"),
            primary_contact_email=user["email"],
            primary_contact_phone=None,

            is_active=True,
            created_at=datetime.utcnow()
        )

        db.add(vendor)
        db.commit()
        db.refresh(vendor)

    return vendor


# ---------- PROFILE ----------
@router.get("/profile")
def get_vendor_profile(db: Session = Depends(get_db), user=Depends(get_current_user)):
    vendor = require_vendor(user, db)
    return vendor


@router.put("/profile")
def update_vendor_profile(
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    vendor = require_vendor(user, db)

    vendor.company_name = payload.get("company_name", vendor.company_name)
    vendor.gst_number = payload.get("gst_number", vendor.gst_number)
    vendor.payment_terms = payload.get("payment_terms", vendor.payment_terms)

    vendor.primary_contact_name = payload.get("primary_contact_name", vendor.primary_contact_name)
    vendor.primary_contact_email = payload.get("primary_contact_email", vendor.primary_contact_email)
    vendor.primary_contact_phone = payload.get("primary_contact_phone", vendor.primary_contact_phone)

    db.commit()
    db.refresh(vendor)
    return vendor


# ---------- CANDIDATES ----------
# ---------- CANDIDATES ----------
@router.post("/candidates")
async def upload_candidate(
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(None),
    experience_years: float = Form(None),
    skills: str = Form(None),

    resume: UploadFile = File(None),

    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    vendor = require_vendor(user, db)

    candidate = models.Candidate(
        full_name = full_name,
        email = email,
        phone = phone,
        experience_years = experience_years,
        skills = skills.split(",") if skills else [],
        source = "vendor",
        vendor_id = vendor.id,
        is_vendor_candidate = True,
        status = "Active",
        created_at = datetime.utcnow(),
        public_id=models.generate_candidate_public_id_from_org(db)
    )

    # ===== Resume Upload (optional) =====
    if resume:
        upload_dir = "uploads/vendor_candidates"
        os.makedirs(upload_dir, exist_ok=True)

        file_path = f"{upload_dir}/{vendor.id}_{resume.filename}"

        with open(file_path, "wb") as f:
            f.write(await resume.read())

        candidate.resume_url = file_path

    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    return {
        "message": "Candidate uploaded successfully",
        "candidate_id": candidate.id
    }


@router.get("/candidates")
def get_vendor_candidates(db: Session = Depends(get_db), user=Depends(get_current_user)):
    vendor = require_vendor(user, db)

    return db.query(models.Candidate).filter(
        models.Candidate.vendor_id == vendor.id
    ).all()


# ---------- DASHBOARD ----------
@router.get("/dashboard")
def vendor_dashboard(db: Session = Depends(get_db), user=Depends(get_current_user)):
    vendor = require_vendor(user, db)

    q = db.query(models.Candidate).filter(
        models.Candidate.vendor_id == vendor.id
    )

    return {
        "total_candidates": q.count(),
        "active_deployments": q.filter(models.Candidate.status == "deployed").count(),
        "pending_timesheets": 0,
        "expected_payout": 0
    }


# ---------- DOCUMENTS ----------
@router.post("/documents")
def upload_vendor_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    vendor = require_vendor(user, db)

    upload_dir = "uploads/vendor_docs"
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{vendor.id}_{file.filename}"
    path = os.path.join(upload_dir, filename)

    with open(path, "wb") as f:
        f.write(file.file.read())

    doc = models.VendorDocument(
        vendor_id=vendor.id,
        document_type=document_type,
        file_path=path,
        status="uploaded",
        uploaded_at=datetime.utcnow()
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)

    return doc


@router.get("/documents")
def get_vendor_documents(db: Session = Depends(get_db), user=Depends(get_current_user)):
    vendor = require_vendor(user, db)

    return db.query(models.VendorDocument).filter(
        models.VendorDocument.vendor_id == vendor.id
    ).all()

@router.get("/bgv/assigned")
def get_assigned_bgv_candidates(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    vendor = require_vendor(user, db)

    candidates = db.query(models.Candidate).filter(
        models.Candidate.bgv_vendor_id == vendor.id
    ).all()

    return {
        "count": len(candidates),
        "items": candidates
    }


@router.post("/bgv/{candidate_id}/submit")
async def submit_bgv_report(
    candidate_id: str,
    status: str = Form(...),
    remarks: str = Form(None),
    report: UploadFile = File(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    vendor = require_vendor(user, db)

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id,
        models.Candidate.bgv_vendor_id == vendor.id
    ).first()

    if not candidate:
        raise HTTPException(404, "Candidate not found or not assigned to you")

    file_path = None
    if report:
        upload_dir = "uploads/bgv_reports"
        os.makedirs(upload_dir, exist_ok=True)

        filename = f"{candidate_id}_{report.filename}"
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as f:
            f.write(await report.read())

    candidate.bgv_status = status
    candidate.bgv_report_url = file_path
    candidate.bgv_completed_at = datetime.utcnow()

    db.commit()
    db.refresh(candidate)

    return {
        "message": "BGV Report Submitted",
        "status": status,
        "report": file_path
    }

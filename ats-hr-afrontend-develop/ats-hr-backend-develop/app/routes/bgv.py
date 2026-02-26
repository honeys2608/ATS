from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import models
from datetime import datetime

router = APIRouter(
    prefix="/v1/bgv",
    tags=["BGV"]
)


# ---------------- LIST VENDORS ----------------
@router.get("/vendors")
def list_bgv_vendors(db: Session = Depends(get_db)):
    vendors = db.query(models.Vendor).all()

    return {
        "data": [
            {
                "id": v.id,
                "name": v.company_name,
                "email": v.primary_contact_email,
                "phone": v.primary_contact_phone
            }
            for v in vendors
        ]
    }


# ---------------- INITIATE BGV ----------------
@router.post("/{candidate_id}/initiate")
def initiate_bgv(candidate_id: str, payload: dict, db: Session = Depends(get_db)):

    candidate = (
        db.query(models.Candidate)
        .filter(models.Candidate.id == candidate_id)
        .first()
    )

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate.bgv_status = "in_progress"
    candidate.bgv_initiated = True

    db.commit()
    db.refresh(candidate)

    return {
        "message": "BGV Initiated Successfully",
        "candidate_id": candidate_id,
        "status": candidate.bgv_status,
        "checks": payload.get("checks", [])
    }


# ---------------- ASSIGN VENDOR ----------------
@router.post("/{candidate_id}/assign-vendor")
def assign_vendor(candidate_id: str, payload: dict, db: Session = Depends(get_db)):

    vendor_id = payload.get("vendor_id")
    if not vendor_id:
        raise HTTPException(status_code=400, detail="vendor_id required")

    candidate = (
        db.query(models.Candidate)
        .filter(models.Candidate.id == candidate_id)
        .first()
    )

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # assign vendor
    candidate.bgv_vendor_id = vendor_id
    candidate.bgv_status = "assigned"
    candidate.bgv_assigned_at = datetime.utcnow()

    db.commit()
    db.refresh(candidate)

    return {
        "message": "Vendor Assigned Successfully",
        "vendor_id": vendor_id
    }


# ---------------- GET REPORTS ----------------
@router.get("/{candidate_id}/reports")
def get_reports(candidate_id: str):
    # Future me DB connect kar denge
    return {
        "items": [
            {
                "id": "rep1",
                "name": "Identity Verification",
                "status": "clear",
                "download_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                "expiry_date": "2026-01-01"
            },
            {
                "id": "rep2",
                "name": "Education Verification",
                "status": "pending"
            }
        ]
    }


# ---------------- FINAL HR VERIFICATION ----------------
@router.patch("/admin/verify/{candidate_id}")
def final_bgv_verification(candidate_id: str, payload: dict, db: Session = Depends(get_db)):

    status = payload.get("status")
    remarks = payload.get("remarks", "")

    if status not in ["verified", "failed"]:
        raise HTTPException(400, "Invalid status")

    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()

    if not candidate:
        raise HTTPException(404, "Candidate not found")

    candidate.bgv_final_status = status
    candidate.bgv_final_remarks = remarks
    candidate.bgv_final_verified_at = datetime.utcnow()
    candidate.bgv_status = "completed"

    db.commit()
    db.refresh(candidate)

    return {
        "message": "Final BGV status updated",
        "candidate_id": candidate_id,
        "final_status": status
    }



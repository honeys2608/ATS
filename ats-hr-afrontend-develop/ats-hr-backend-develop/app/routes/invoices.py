from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app import models, schemas
from datetime import datetime

from app.permissions import require_permission        # ADD
from app.auth import get_current_user                 # ADD
from app.utils.activity import log_activity

router = APIRouter(prefix="/v1/invoices", tags=["Finance"])


# -------------------- CREATE INVOICE (SECURED) -------------------- #
@router.post("", response_model=schemas.InvoiceResponse, status_code=201)
@require_permission("finance", "create")               # <--- FIXED
def create_invoice(
    invoice_data: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)             # <--- REQUIRED
):
    invoice_number = f"INV{str(datetime.utcnow().timestamp()).replace('.', '')[:10]}"

    new_invoice = models.Invoice(
        client_name=invoice_data.client_name,
        client_id=getattr(invoice_data, "client_id", None),
        invoice_number=invoice_number,
        amount=invoice_data.amount,
        placements=invoice_data.placements,
        due_date=invoice_data.due_date,
        status="draft"
    )

    db.add(new_invoice)
    log_activity(
        db,
        action="admin.invoice_created",
        resource_type="invoice",
        actor=current_user,
        resource_id=new_invoice.id,
        resource_name=invoice_number,
        client_id=getattr(invoice_data, "client_id", None),
        metadata={"client_name": invoice_data.client_name, "amount": float(invoice_data.amount or 0)},
    )
    db.commit()
    db.refresh(new_invoice)

    return new_invoice


# -------------------- LIST INVOICES (SECURED) -------------------- #
@router.get("", response_model=List[schemas.InvoiceResponse])
@require_permission("finance", "view")                  # <--- FIXED
def list_invoices(
    status: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(models.Invoice)
    if status:
        query = query.filter(models.Invoice.status == status)
    return query.all()


# -------------------- UPDATE STATUS (SECURED) -------------------- #
@router.put("/{invoice_id}/status")
@require_permission("finance", "update")                # <--- FIXED
def update_invoice_status(
    invoice_id: str,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    old_status = str(invoice.status or "").lower()
    invoice.status = status
    if status == "paid":
        invoice.paid_date = datetime.utcnow()
    normalized_status = str(status or "").strip().lower()
    if normalized_status == "sent":
        log_activity(
            db,
            action="admin.invoice_sent",
            resource_type="invoice",
            actor=current_user,
            resource_id=invoice.id,
            resource_name=invoice.invoice_number,
            client_id=invoice.client_id,
            old_status=old_status,
            new_status=normalized_status,
            metadata={"client_name": invoice.client_name, "amount": float(invoice.amount or 0)},
        )
    elif normalized_status == "paid":
        log_activity(
            db,
            action="admin.invoice_paid",
            resource_type="invoice",
            actor=current_user,
            resource_id=invoice.id,
            resource_name=invoice.invoice_number,
            client_id=invoice.client_id,
            old_status=old_status,
            new_status=normalized_status,
            metadata={"client_name": invoice.client_name, "amount": float(invoice.amount or 0)},
        )

    db.commit()
    db.refresh(invoice)
    return invoice


# -------------------- BASIC METRICS (OPTIONAL) -------------------- #
@router.get("/dashboard/metrics")
@require_permission("finance", "view")                  # <--- SECURED
def dashboard_metrics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    total_invoices = db.query(models.Invoice).count()
    return {
        "invoices": total_invoices,
        "revenue": 0,
        "pending": 0,
        "paid": 0
    }

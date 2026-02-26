"""
Offer & Joining Management Routes
Create, track, and manage job offers and joining
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

from app.db import get_db
from app.auth import get_current_user
from app.permissions import require_permission
import app.models as models

router = APIRouter(prefix="/v1/offers", tags=["offers"])


class OfferCreate(BaseModel):
    candidate_id: str
    job_id: str
    client_id: str
    salary: float
    currency: str = "USD"
    position_title: str
    benefits: Optional[str] = None
    start_date: datetime
    expiry_date: datetime


class OfferUpdate(BaseModel):
    status: Optional[str] = None
    salary: Optional[float] = None
    benefits: Optional[str] = None
    start_date: Optional[datetime] = None


class OfferResponse(BaseModel):
    id: str
    candidate_id: str
    candidate_name: str
    job_id: str
    job_title: str
    client_id: str
    client_name: str
    salary: float
    currency: str
    position_title: str
    status: str
    created_at: datetime
    expiry_date: datetime

    class Config:
        from_attributes = True


@router.post("", response_model=OfferResponse)
@require_permission("offers", "create")
def create_offer(
    offer: OfferCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a new job offer for candidate."""
    
    # Validate candidate
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == offer.candidate_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Validate job
    job = db.query(models.Job).filter(
        models.Job.id == offer.job_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check for existing active offer
    existing_offer = db.query(models.Offer).filter(
        models.Offer.candidate_id == offer.candidate_id,
        models.Offer.job_id == offer.job_id,
        models.Offer.status.in_(["created", "sent", "accepted"]),
    ).first()

    if existing_offer:
        raise HTTPException(
            status_code=400,
            detail="Active offer already exists for this candidate-job pair"
        )

    # Create offer
    new_offer = models.Offer(
        id=models.generate_uuid(),
        candidate_id=offer.candidate_id,
        job_id=offer.job_id,
        client_id=offer.client_id,
        salary=offer.salary,
        currency=offer.currency,
        position_title=offer.position_title,
        benefits=offer.benefits,
        start_date=offer.start_date,
        expiry_date=offer.expiry_date,
        status="created",
        created_by=current_user["id"],
        created_at=datetime.utcnow(),
    )

    db.add(new_offer)
    db.commit()
    db.refresh(new_offer)

    return new_offer


@router.get("", response_model=list[OfferResponse])
@require_permission("offers", "view")
def list_offers(
    status: Optional[str] = Query(None),
    candidate_id: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(50),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List all offers with optional filters."""
    query = db.query(models.Offer)

    if status:
        query = query.filter(models.Offer.status == status)
    if candidate_id:
        query = query.filter(models.Offer.candidate_id == candidate_id)
    if client_id:
        query = query.filter(models.Offer.client_id == client_id)

    offers = (
        query.order_by(models.Offer.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return offers


@router.get("/{offer_id}", response_model=OfferResponse)
@require_permission("offers", "view")
def get_offer(
    offer_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get offer details."""
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer


@router.put("/{offer_id}", response_model=OfferResponse)
@require_permission("offers", "update")
def update_offer(
    offer_id: str,
    offer_data: OfferUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update offer details."""
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    # Update fields
    for field, value in offer_data.dict(exclude_unset=True).items():
        if value is not None:
            setattr(offer, field, value)

    offer.updated_at = datetime.utcnow()
    offer.updated_by = current_user["id"]

    db.commit()
    db.refresh(offer)
    return offer


@router.post("/{offer_id}/send")
@require_permission("offers", "update")
def send_offer(
    offer_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Send offer to candidate."""
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.status != "created":
        raise HTTPException(
            status_code=400,
            detail="Can only send offers in 'created' status"
        )

    offer.status = "sent"
    offer.sent_date = datetime.utcnow()
    offer.updated_at = datetime.utcnow()
    offer.updated_by = current_user["id"]

    db.commit()

    # TODO: Send email notification to candidate

    return {
        "message": "Offer sent to candidate",
        "offer_id": offer_id,
        "status": "sent",
    }


@router.post("/{offer_id}/accept")
@require_permission("offers", "update")
def accept_offer(
    offer_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Candidate accepts offer."""
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.status != "sent":
        raise HTTPException(
            status_code=400,
            detail="Offer must be in 'sent' status to accept"
        )

    # Check if offer expired
    if datetime.utcnow() > offer.expiry_date:
        raise HTTPException(status_code=400, detail="Offer has expired")

    offer.status = "accepted"
    offer.accepted_date = datetime.utcnow()
    offer.updated_at = datetime.utcnow()

    # Update candidate status
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == offer.candidate_id
    ).first()
    if candidate:
        candidate.status = "joined"

    db.commit()

    return {
        "message": "Offer accepted",
        "offer_id": offer_id,
        "status": "accepted",
        "start_date": offer.start_date,
    }


@router.post("/{offer_id}/reject")
@require_permission("offers", "update")
def reject_offer(
    offer_id: str,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Candidate rejects offer."""
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer.status = "rejected"
    offer.rejection_reason = reason
    offer.rejection_date = datetime.utcnow()
    offer.updated_at = datetime.utcnow()

    db.commit()

    return {
        "message": "Offer rejected",
        "offer_id": offer_id,
        "status": "rejected",
    }


@router.post("/{offer_id}/revoke")
@require_permission("offers", "update")
def revoke_offer(
    offer_id: str,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Revoke an offer."""
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.status == "accepted":
        raise HTTPException(
            status_code=400,
            detail="Cannot revoke accepted offers. Handle dropouts via joining status."
        )

    offer.status = "revoked"
    offer.revocation_reason = reason
    offer.updated_at = datetime.utcnow()
    offer.updated_by = current_user["id"]

    db.commit()

    return {
        "message": "Offer revoked",
        "offer_id": offer_id,
        "status": "revoked",
    }


@router.post("/{offer_id}/joining", response_model=OfferResponse)
@require_permission("offers", "update")
def mark_joined(
    offer_id: str,
    joining_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mark offer as joined (candidate has started work)."""
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.status != "accepted":
        raise HTTPException(
            status_code=400,
            detail="Only accepted offers can be marked as joined"
        )

    offer.status = "joined"
    offer.joining_date = joining_date or datetime.utcnow()
    offer.updated_at = datetime.utcnow()
    offer.updated_by = current_user["id"]

    # Update candidate status
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == offer.candidate_id
    ).first()
    if candidate:
        candidate.status = "joined"
        candidate.joining_date = offer.joining_date

    db.commit()
    db.refresh(offer)

    return offer


@router.post("/{offer_id}/dropout")
@require_permission("offers", "update")
def mark_dropout(
    offer_id: str,
    reason: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Mark offer as dropout (candidate withdrew after accepting)."""
    offer = db.query(models.Offer).filter(models.Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if offer.status not in ["accepted", "joined"]:
        raise HTTPException(
            status_code=400,
            detail="Only accepted or joined offers can be marked as dropout"
        )

    offer.status = "dropout"
    offer.dropout_reason = reason
    offer.dropout_date = datetime.utcnow()
    offer.updated_at = datetime.utcnow()
    offer.updated_by = current_user["id"]

    # Update candidate status
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == offer.candidate_id
    ).first()
    if candidate:
        candidate.status = "dropout"

    db.commit()

    return {
        "message": "Offer marked as dropout",
        "offer_id": offer_id,
        "status": "dropout",
        "reason": reason,
    }


@router.get("/candidate/{candidate_id}/active")
@require_permission("offers", "view")
def get_candidate_active_offer(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get active offer for a candidate."""
    offer = (
        db.query(models.Offer)
        .filter(
            models.Offer.candidate_id == candidate_id,
            models.Offer.status.in_(["sent", "accepted", "joined"]),
        )
        .order_by(models.Offer.created_at.desc())
        .first()
    )

    if not offer:
        raise HTTPException(status_code=404, detail="No active offer found")

    return offer


@router.get("/job/{job_id}/stats")
@require_permission("offers", "view")
def get_job_offer_stats(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get offer statistics for a job."""
    offers = db.query(models.Offer).filter(models.Offer.job_id == job_id).all()

    total = len(offers)
    sent = len([o for o in offers if o.status == "sent"])
    accepted = len([o for o in offers if o.status == "accepted"])
    joined = len([o for o in offers if o.status == "joined"])
    rejected = len([o for o in offers if o.status == "rejected"])
    dropout = len([o for o in offers if o.status == "dropout"])

    return {
        "job_id": job_id,
        "total_offers": total,
        "sent": sent,
        "accepted": accepted,
        "joined": joined,
        "rejected": rejected,
        "dropout": dropout,
        "acceptance_rate": round((accepted / total * 100) if total > 0 else 0, 1),
        "joining_rate": round((joined / total * 100) if total > 0 else 0, 1),
    }


@router.get("/client/{client_id}/stats")
@require_permission("offers", "view")
def get_client_offer_stats(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get offer statistics for a client."""
    offers = db.query(models.Offer).filter(models.Offer.client_id == client_id).all()

    total = len(offers)
    joined = len([o for o in offers if o.status == "joined"])
    dropout = len([o for o in offers if o.status == "dropout"])

    return {
        "client_id": client_id,
        "total_offers": total,
        "joined": joined,
        "dropout": dropout,
        "dropout_rate": round((dropout / total * 100) if total > 0 else 0, 1),
    }

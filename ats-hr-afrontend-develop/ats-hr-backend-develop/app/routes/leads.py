from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.db import get_db
from app import models
from app.auth import get_current_user

router = APIRouter(prefix="/v1/leads", tags=["Lead Management"])


# ============================================================
# CREATE CAMPAIGN
# ============================================================
@router.post("/campaigns", status_code=201)
def create_campaign(
    job_id: str,
    platform: str,
    campaign_name: str,
    utm_source: str,
    utm_medium: str = None,
    utm_campaign: str = None,
    budget: float = None,
    start_date: datetime = None,
    end_date: datetime = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    campaign = models.Campaign(
        job_id=job_id,
        platform=platform,
        campaign_name=campaign_name,
        utm_source=utm_source,
        utm_medium=utm_medium,
        utm_campaign=utm_campaign,
        budget=budget,
        start_date=start_date or datetime.utcnow(),
        end_date=end_date,
        status="active",
        impressions=0,
        clicks=0,
        applications=0,
        cost_per_application=0.0
    )

    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    return campaign


# ============================================================
# LIST CAMPAIGNS
# ============================================================
@router.get("/campaigns")
def list_campaigns(
    job_id: Optional[str] = None,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    query = db.query(models.Campaign)

    if job_id:
        query = query.filter(models.Campaign.job_id == job_id)
    if platform:
        query = query.filter(models.Campaign.platform == platform)
    if status:
        query = query.filter(models.Campaign.status == status)

    return query.order_by(models.Campaign.created_at.desc()).all()


# ============================================================
# UPDATE CAMPAIGN METRICS
# ============================================================
@router.put("/campaigns/{campaign_id}/metrics")
def update_campaign_metrics(
    campaign_id: str,
    impressions: Optional[int] = None,
    clicks: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    if impressions is not None:
        campaign.impressions = impressions
    if clicks is not None:
        campaign.clicks = clicks

    # CTR
    if campaign.impressions > 0:
        campaign.click_through_rate = round((campaign.clicks / campaign.impressions) * 100, 2)

    # Cost per application
    if campaign.budget and campaign.applications > 0:
        campaign.cost_per_application = round(campaign.budget / campaign.applications, 2)

    db.commit()
    return campaign


# ============================================================
# LIST LEADS
# ============================================================
@router.get("/")
def list_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    campaign_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    query = db.query(models.Lead)

    if status:
        query = query.filter(models.Lead.status == status)
    if source:
        query = query.filter(models.Lead.source == source)
    if campaign_id:
        query = query.filter(models.Lead.campaign_id == campaign_id)

    leads = query.order_by(models.Lead.created_at.desc()).all()

    return [
        {
            "id": l.id,
            "full_name": l.full_name,
            "email": l.email,
            "phone": l.phone,
            "source": l.source,
            "campaign_id": l.campaign_id,
            "status": l.status,
            "score": l.score,
            "created_at": l.created_at.isoformat() if l.created_at else None
        }
        for l in leads
    ]


# ============================================================
# CREATE NEW LEAD
# ============================================================
@router.post("/", status_code=201)
def create_lead(
    campaign_id: Optional[str] = None,
    full_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    location: Optional[str] = None,
    linkedin_url: Optional[str] = None,
    source: Optional[str] = None,
    utm_params: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    lead = models.Lead(
        campaign_id=campaign_id,
        full_name=full_name,
        email=email,
        phone=phone,
        location=location,
        linkedin_url=linkedin_url,
        source=source,
        utm_params=utm_params,
        status="new",
        score=0,
        created_at=datetime.utcnow()
    )

    db.add(lead)

    # Update campaign click count
    if campaign_id:
        campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
        if campaign:
            campaign.clicks += 1

    db.commit()
    db.refresh(lead)

    return lead


# ============================================================
# CONVERT LEAD → APPLICATION
# ============================================================
@router.post("/convert-to-applicant")
def convert_lead_to_applicant(
    lead_id: str,
    job_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")

    application = models.JobApplication(
        job_id=job_id,
        lead_id=lead.id,
        full_name=lead.full_name,
        email=lead.email,
        phone=lead.phone,
        current_location=lead.location,
        linkedin_url=lead.linkedin_url,
        status="applied",
        created_at=datetime.utcnow()
    )

    db.add(application)
    db.flush()

    # Update lead
    lead.status = "converted"
    lead.converted_to_application_id = application.id

    # Update campaign metrics
    if lead.campaign_id:
        campaign = db.query(models.Campaign).filter(models.Campaign.id == lead.campaign_id).first()
        if campaign:
            campaign.applications = db.query(models.JobApplication).filter(
                models.JobApplication.lead_id.in_(
                    db.query(models.Lead.id).filter(models.Lead.campaign_id == campaign.id)
                )
            ).count()

            if campaign.budget and campaign.applications > 0:
                campaign.cost_per_application = round(campaign.budget / campaign.applications, 2)

    db.commit()
    db.refresh(application)

    return {
        "message": "Lead converted successfully",
        "lead_id": lead_id,
        "application_id": application.id
    }


# ============================================================
# ANALYTICS
# ============================================================
@router.get("/analytics")
def get_lead_analytics(
    start_date: datetime = None,
    end_date: datetime = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    query = db.query(models.Lead)

    if start_date:
        query = query.filter(models.Lead.created_at >= start_date)
    if end_date:
        query = query.filter(models.Lead.created_at <= end_date)

    leads = query.all()

    total = len(leads)
    converted = len([l for l in leads if l.status == "converted"])
    qualified = len([l for l in leads if l.status == "qualified"])

    source_breakdown = {}
    for l in leads:
        s = l.source or "Unknown"
        source_breakdown[s] = source_breakdown.get(s, 0) + 1

    campaign_breakdown = {}
    for l in leads:
        if l.campaign_id:
            campaign_breakdown[l.campaign_id] = campaign_breakdown.get(l.campaign_id, 0) + 1

    conversion_rate = round((converted / total * 100), 2) if total > 0 else 0

    return {
        "total_leads": total,
        "qualified_leads": qualified,
        "converted_leads": converted,
        "conversion_rate": conversion_rate,
        "source_breakdown": source_breakdown,
        "campaign_breakdown": campaign_breakdown,
    }

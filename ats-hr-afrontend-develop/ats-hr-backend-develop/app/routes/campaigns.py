from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app import models
from app.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/v1/campaigns", tags=["Campaigns"])

@router.post("", status_code=201)
def create_campaign(
    job_id: str,
    platform: str,
    campaign_name: str,
    budget: float = 0,
    utm_source: str = None,
    utm_medium: str = None,
    utm_campaign: str = None,
    start_date: datetime = None,
    end_date: datetime = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a social media campaign for a job"""
    campaign = models.Campaign(
        job_id=job_id,
        platform=platform,
        campaign_name=campaign_name,
        budget=budget,
        utm_source=utm_source or platform,
        utm_medium=utm_medium or "social",
        utm_campaign=utm_campaign or campaign_name.lower().replace(" ", "_"),
        start_date=start_date or datetime.utcnow(),
        end_date=end_date,
        status="active"
    )
    
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    
    return campaign

@router.get("")
def list_campaigns(
    job_id: str = None,
    platform: str = None,
    status: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all campaigns"""
    query = db.query(models.Campaign)
    
    if job_id:
        query = query.filter(models.Campaign.job_id == job_id)
    if platform:
        query = query.filter(models.Campaign.platform == platform)
    if status:
        query = query.filter(models.Campaign.status == status)
    
    campaigns = query.order_by(models.Campaign.created_at.desc()).all()
    
    # Join with job data
    result = []
    for campaign in campaigns:
        job = db.query(models.Job).filter(models.Job.id == campaign.job_id).first()
        
        # Calculate metrics
        ctr = (campaign.clicks / campaign.impressions * 100) if campaign.impressions > 0 else 0
        cpa = (campaign.budget / campaign.applications) if campaign.applications > 0 else 0
        
        result.append({
            "id": campaign.id,
            "campaign_name": campaign.campaign_name,
            "platform": campaign.platform,
            "job_id": campaign.job_id,
            "job_title": job.title if job else "Unknown Job",
            "job_location": job.location if job else None,
            "budget": campaign.budget,
            "status": campaign.status,
            "impressions": campaign.impressions,
            "clicks": campaign.clicks,
            "applications": campaign.applications,
            "click_through_rate": round(ctr, 2),
            "cost_per_application": round(cpa, 2),
            "utm_source": campaign.utm_source,
            "utm_medium": campaign.utm_medium,
            "utm_campaign": campaign.utm_campaign,
            "start_date": campaign.start_date.isoformat() if campaign.start_date else None,
            "end_date": campaign.end_date.isoformat() if campaign.end_date else None,
            "created_at": campaign.created_at.isoformat() if campaign.created_at else None
        })
    
    return result

@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get campaign details"""
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    job = db.query(models.Job).filter(models.Job.id == campaign.job_id).first()
    
    return {
        "id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "platform": campaign.platform,
        "job_id": campaign.job_id,
        "job_title": job.title if job else "Unknown",
        "budget": campaign.budget,
        "status": campaign.status,
        "impressions": campaign.impressions,
        "clicks": campaign.clicks,
        "applications": campaign.applications,
        "click_through_rate": campaign.click_through_rate,
        "cost_per_application": campaign.cost_per_application,
        "utm_source": campaign.utm_source,
        "utm_medium": campaign.utm_medium,
        "utm_campaign": campaign.utm_campaign,
        "start_date": campaign.start_date,
        "end_date": campaign.end_date
    }

@router.put("/{campaign_id}/metrics")
def update_campaign_metrics(
    campaign_id: str,
    impressions: int = None,
    clicks: int = None,
    applications: int = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update campaign metrics (impressions, clicks, applications)"""
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if impressions is not None:
        campaign.impressions = impressions
    if clicks is not None:
        campaign.clicks = clicks
    if applications is not None:
        campaign.applications = applications
    
    # Recalculate derived metrics
    campaign.click_through_rate = (campaign.clicks / campaign.impressions * 100) if campaign.impressions > 0 else 0
    campaign.cost_per_application = (campaign.budget / campaign.applications) if campaign.applications > 0 else 0
    
    db.commit()
    db.refresh(campaign)
    
    return campaign

@router.put("/{campaign_id}/status")
def update_campaign_status(
    campaign_id: str,
    status: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update campaign status (active, paused, completed)"""
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    campaign.status = status
    
    db.commit()
    db.refresh(campaign)
    
    return {"message": f"Campaign status updated to {status}", "campaign_id": campaign_id}

@router.delete("/{campaign_id}")
def delete_campaign(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete a campaign"""
    campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    db.delete(campaign)
    db.commit()
    
    return {"message": "Campaign deleted", "campaign_id": campaign_id}

@router.get("/dashboard/metrics")
def get_campaign_metrics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get overall campaign metrics"""
    campaigns = db.query(models.Campaign).all()
    
    total_budget = sum(c.budget for c in campaigns)
    total_impressions = sum(c.impressions for c in campaigns)
    total_clicks = sum(c.clicks for c in campaigns)
    total_applications = sum(c.applications for c in campaigns)
    active_campaigns = len([c for c in campaigns if c.status == "active"])
    
    avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
    avg_cpa = (total_budget / total_applications) if total_applications > 0 else 0
    
    # Platform breakdown
    platform_stats = {}
    for campaign in campaigns:
        if campaign.platform not in platform_stats:
            platform_stats[campaign.platform] = {
                "campaigns": 0,
                "budget": 0,
                "impressions": 0,
                "clicks": 0,
                "applications": 0
            }
        platform_stats[campaign.platform]["campaigns"] += 1
        platform_stats[campaign.platform]["budget"] += campaign.budget
        platform_stats[campaign.platform]["impressions"] += campaign.impressions
        platform_stats[campaign.platform]["clicks"] += campaign.clicks
        platform_stats[campaign.platform]["applications"] += campaign.applications
    
    return {
        "total_campaigns": len(campaigns),
        "active_campaigns": active_campaigns,
        "total_budget": total_budget,
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "total_applications": total_applications,
        "average_ctr": round(avg_ctr, 2),
        "average_cpa": round(avg_cpa, 2),
        "platform_stats": platform_stats
    }

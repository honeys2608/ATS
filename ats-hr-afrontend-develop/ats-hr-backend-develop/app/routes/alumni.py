from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app import models, schemas

router = APIRouter(prefix="/v1/alumni", tags=["Alumni"])

@router.get("", response_model=List[schemas.AlumniResponse])
def list_alumni(db: Session = Depends(get_db)):
    alumni = db.query(models.Alumni).all()
    return alumni

@router.get("/{alumni_id}", response_model=schemas.AlumniResponse)
def get_alumni(alumni_id: str, db: Session = Depends(get_db)):
    alumni = db.query(models.Alumni).filter(models.Alumni.id == alumni_id).first()
    
    if not alumni:
        raise HTTPException(status_code=404, detail="Alumni record not found")
    
    return alumni

@router.put("/{alumni_id}/update")
def update_alumni(
    alumni_id: str,
    current_company: str = None,
    current_designation: str = None,
    linkedin_url: str = None,
    db: Session = Depends(get_db)
):
    alumni = db.query(models.Alumni).filter(models.Alumni.id == alumni_id).first()
    if not alumni:
        raise HTTPException(status_code=404, detail="Alumni record not found")
    
    if current_company:
        alumni.current_company = current_company
    if current_designation:
        alumni.current_designation = current_designation
    if linkedin_url:
        alumni.linkedin_url = linkedin_url
    
    db.commit()
    db.refresh(alumni)
    
    return alumni

@router.post("/{alumni_id}/referral")
def track_referral(alumni_id: str, db: Session = Depends(get_db)):
    alumni = db.query(models.Alumni).filter(models.Alumni.id == alumni_id).first()
    if not alumni:
        raise HTTPException(status_code=404, detail="Alumni record not found")
    
    alumni.referrals_made += 1
    alumni.engagement_score = min(100, alumni.engagement_score + 5)
    
    db.commit()
    db.refresh(alumni)
    
    return {"message": "Referral tracked", "total_referrals": alumni.referrals_made}

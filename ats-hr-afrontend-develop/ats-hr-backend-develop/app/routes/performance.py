from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.db import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(prefix="/v1/performance", tags=["Performance"])

@router.get("", response_model=List[schemas.PerformanceReviewResponse])
def list_performance_reviews(
    employee_id: str = None, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = db.query(models.PerformanceReview)
    
    if employee_id:
        query = query.filter(models.PerformanceReview.employee_id == employee_id)
    
    reviews = query.all()
    return reviews

@router.get("/{review_id}", response_model=schemas.PerformanceReviewResponse)
def get_performance_review(
    review_id: str, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    review = db.query(models.PerformanceReview).filter(models.PerformanceReview.id == review_id).first()
    
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found")
    
    return review

@router.post("", response_model=schemas.PerformanceReviewResponse, status_code=201)
def create_performance_review(
    review_data: schemas.PerformanceReviewCreate, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    new_review = models.PerformanceReview(
        **review_data.dict(exclude={'reviewer_id'}),
        reviewer_id=current_user["id"],
        created_at=datetime.utcnow()
    )
    
    db.add(new_review)
    db.commit()
    db.refresh(new_review)
    
    return new_review

@router.put("/{review_id}", response_model=schemas.PerformanceReviewResponse)
def update_performance_review(
    review_id: str,
    review_data: schemas.PerformanceReviewCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    review = db.query(models.PerformanceReview).filter(models.PerformanceReview.id == review_id).first()
    
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found")
    
    for key, value in review_data.dict(exclude_unset=True).items():
        setattr(review, key, value)
    
    db.commit()
    db.refresh(review)
    
    return review

@router.delete("/{review_id}")
def delete_performance_review(
    review_id: str, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    review = db.query(models.PerformanceReview).filter(models.PerformanceReview.id == review_id).first()
    
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found")
    
    db.delete(review)
    db.commit()
    
    return {"message": "Performance review deleted successfully"}

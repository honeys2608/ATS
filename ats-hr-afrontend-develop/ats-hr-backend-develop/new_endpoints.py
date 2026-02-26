@router.put("/{candidate_id}")
@require_permission("candidates", "update")
async def update_candidate(
    candidate_id: str,
    candidate_data: schemas.CandidateUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Update candidate information"""
    allow_user(current_user)

    # Find the candidate
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.merged_into_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot update merged candidate"
        )

    # Update candidate fields
    for field, value in candidate_data.dict(exclude_unset=True).items():
        if hasattr(candidate, field) and value is not None:
            setattr(candidate, field, value)
    
    # Update timestamp
    candidate.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(candidate)
        
        # Add to timeline
        timeline = models.CandidateTimeline(
            candidate_id=candidate.id,
            status=candidate.status,
            note="Candidate details updated",
            user_id=current_user["id"]
        )
        db.add(timeline)
        db.commit()
        
        return {
            "message": "Candidate updated successfully",
            "candidate": {
                "id": candidate.id,
                "full_name": candidate.full_name,
                "email": candidate.email,
                "phone": candidate.phone,
                "current_location": candidate.current_location,
                "current_address": candidate.current_address,
                "permanent_address": candidate.permanent_address,
                "skills": candidate.skills,
                "experience": candidate.experience_years,
                "education": candidate.education,
                "current_employer": candidate.current_employer,
                "previous_employers": candidate.previous_employers,
                "notice_period": candidate.notice_period,
                "expected_salary": candidate.expected_salary,
                "preferred_location": candidate.preferred_location,
                "languages_known": candidate.languages_known,
                "linkedin_url": candidate.linkedin_url,
                "github_url": candidate.github_url,
                "source": candidate.source,
                "referral": candidate.referral,
                "status": candidate.status,
                "updated_at": candidate.updated_at
            }
        }
    except IntegrityError as e:
        db.rollback()
        if "email" in str(e):
            raise HTTPException(status_code=400, detail="Email already exists")
        raise HTTPException(status_code=400, detail="Update failed due to data constraint")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update candidate: {str(e)}")

@router.delete("/{candidate_id}")
@require_permission("candidates", "delete")
async def delete_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Delete a candidate"""
    allow_user(current_user)

    # Find the candidate
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.merged_into_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete merged candidate"
        )

    try:
        # Delete related records first (cascade should handle this, but being explicit)
        # Delete timelines
        db.query(models.CandidateTimeline).filter(
            models.CandidateTimeline.candidate_id == candidate.id
        ).delete()
        
        # Delete call feedback
        db.query(models.CallFeedback).filter(
            models.CallFeedback.candidate_id == candidate.id
        ).delete()
        
        # Delete job applications
        db.query(models.JobApplication).filter(
            models.JobApplication.candidate_id == candidate.id
        ).delete()
        
        # Delete interviews
        db.query(models.Interview).filter(
            models.Interview.candidate_id == candidate.id
        ).delete()
        
        # Delete the candidate
        db.delete(candidate)
        db.commit()
        
        return {
            "message": "Candidate deleted successfully",
            "candidate_id": candidate_id
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete candidate: {str(e)}")
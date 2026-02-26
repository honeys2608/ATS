"""
Candidate-Job Matching API Routes
Endpoints for evaluating candidate-job matches and getting recommendations
Uses hybrid scoring: Rule-based (70%) + Semantic similarity via SBERT (30%)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict
from app.db import get_db
from app import models
from app.matching_service import get_matching_service
from app.auth import get_current_user
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/matching", tags=["matching"])


class MatchingRequest(BaseModel):
    """Request model for matching evaluation"""
    job_id: str
    candidate_id: str


class MatchingResponse(BaseModel):
    """Response model for matching results"""
    match_score: float
    fit_label: str
    skill_match: float
    matched_skills: List[str]
    missing_skills: List[str]
    experience_match: str
    experience_score: float
    semantic_score: float
    rule_based_score: float


class CandidateMatchResult(BaseModel):
    """Candidate with match results"""
    candidate_id: str
    candidate_name: str
    candidate_email: str
    match_score: float
    fit_label: str
    matched_skills: List[str]
    missing_skills: List[str]
    experience_match: str


@router.post("/evaluate", response_model=MatchingResponse)
async def evaluate_match(
    request: MatchingRequest,
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """
    Evaluate match between a candidate and a job requirement.
    
    Uses hybrid scoring:
    - Rule-based (70%): skills, experience
    - Semantic similarity (30%): SBERT model comparison
    """
    
    # Fetch job and candidate
    job = db.query(models.Job).filter(models.Job.id == request.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    candidate = db.query(models.Candidate).filter(models.Candidate.id == request.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    # Get matching service
    matching_service = get_matching_service()
    
    # Extract data for matching
    candidate_skills = candidate.skills or []
    required_skills = job.skills or []
    preferred_skills = []
    
    candidate_experience = candidate.experience_years or 0
    required_experience = job.min_experience or 0
    
    job_description = job.description or job.title or ""
    
    candidate_summary = ""
    if candidate.parsed_resume:
        candidate_summary = candidate.parsed_resume.get("summary", "")
    if not candidate_summary and candidate.experience:
        candidate_summary = candidate.experience
    
    # Calculate match
    result = matching_service.calculate_match_score(
        candidate_skills=candidate_skills,
        required_skills=required_skills,
        preferred_skills=preferred_skills,
        candidate_experience_years=candidate_experience,
        required_experience_years=required_experience,
        job_description=job_description,
        candidate_summary=candidate_summary
    )
    
    logger.info(
        f"Match evaluated - Job: {job.id}, Candidate: {candidate.id}, Score: {result['match_score']}"
    )
    
    return MatchingResponse(**result)


@router.get("/jobs/{job_id}/recommended-candidates", response_model=List[CandidateMatchResult])
async def get_recommended_candidates(
    job_id: str,
    limit: int = Query(10, ge=1, le=100),
    min_score: float = Query(40, ge=0, le=100),
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """
    Get recommended candidates for a job, sorted by match score.
    
    Returns candidates who have been submitted to this job,
    with their match scores calculated and sorted by best match first.
    
    Query Parameters:
    - limit: Maximum number of candidates to return (default 10)
    - min_score: Minimum match score to include (default 40)
    """
    
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    candidates_subquery = db.query(models.CandidateSubmission.candidate_id).filter(
        models.CandidateSubmission.job_id == job_id
    ).distinct()
    
    candidates = db.query(models.Candidate).filter(
        models.Candidate.id.in_(candidates_subquery)
    ).all()
    
    if not candidates:
        return []
    
    matching_service = get_matching_service()
    results = []
    
    for candidate in candidates:
        try:
            match_result = matching_service.calculate_match_score(
                candidate_skills=candidate.skills or [],
                required_skills=job.skills or [],
                candidate_experience_years=candidate.experience_years or 0,
                required_experience_years=job.min_experience or 0,
                job_description=job.description or job.title or "",
                candidate_summary=candidate.parsed_resume.get("summary", "") if candidate.parsed_resume else ""
            )
            
            if match_result["match_score"] >= min_score:
                results.append(CandidateMatchResult(
                    candidate_id=candidate.id,
                    candidate_name=candidate.full_name or "Unknown",
                    candidate_email=candidate.email or "",
                    match_score=match_result["match_score"],
                    fit_label=match_result["fit_label"],
                    matched_skills=match_result["matched_skills"],
                    missing_skills=match_result["missing_skills"],
                    experience_match=match_result["experience_match"]
                ))
        except Exception as e:
            logger.error(f"Error calculating match for candidate {candidate.id}: {e}")
            continue
    
    results.sort(key=lambda x: x.match_score, reverse=True)
    return results[:limit]


@router.get("/jobs/{job_id}/candidates-with-scores", response_model=List[CandidateMatchResult])
async def get_candidates_with_scores(
    job_id: str,
    sort_by: str = Query("match_score", regex="^(match_score|fit_label|name)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    """
    Get all candidates for a job with their calculated match scores.
    Allows sorting by different criteria.
    """
    
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    candidates_subquery = db.query(models.CandidateSubmission.candidate_id).filter(
        models.CandidateSubmission.job_id == job_id
    ).distinct()
    
    candidates = db.query(models.Candidate).filter(
        models.Candidate.id.in_(candidates_subquery)
    ).all()
    
    matching_service = get_matching_service()
    results = []
    
    for candidate in candidates:
        try:
            match_result = matching_service.calculate_match_score(
                candidate_skills=candidate.skills or [],
                required_skills=job.skills or [],
                candidate_experience_years=candidate.experience_years or 0,
                required_experience_years=job.min_experience or 0,
                job_description=job.description or job.title or "",
                candidate_summary=candidate.parsed_resume.get("summary", "") if candidate.parsed_resume else ""
            )
            
            results.append(CandidateMatchResult(
                candidate_id=candidate.id,
                candidate_name=candidate.full_name or "Unknown",
                candidate_email=candidate.email or "",
                match_score=match_result["match_score"],
                fit_label=match_result["fit_label"],
                matched_skills=match_result["matched_skills"],
                missing_skills=match_result["missing_skills"],
                experience_match=match_result["experience_match"]
            ))
        except Exception as e:
            logger.error(f"Error calculating match for candidate {candidate.id}: {e}")
            continue
    
    reverse_sort = sort_order == "desc"
    
    if sort_by == "match_score":
        results.sort(key=lambda x: x.match_score, reverse=reverse_sort)
    elif sort_by == "fit_label":
        label_order = {"Excellent Fit": 4, "Good Fit": 3, "Partial Fit": 2, "Poor Fit": 1}
        results.sort(key=lambda x: label_order.get(x.fit_label, 0), reverse=reverse_sort)
    elif sort_by == "name":
        results.sort(key=lambda x: x.candidate_name, reverse=reverse_sort)
    
    return results


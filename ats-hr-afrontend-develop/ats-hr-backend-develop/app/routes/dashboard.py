from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import distinct, and_, func
from datetime import datetime, date
from typing import Optional
from app.db import get_db
from app.models import Job, Candidate, JobApplication, CandidateSubmission, Interview, CandidateStatus
from app.permissions import require_permission
from app.auth import get_current_user

router = APIRouter(prefix="/v1/dashboard", tags=["Dashboard Metrics"])


# ============================================================
# RECRUITER PIPELINE ENDPOINT
# ============================================================
@router.get("/recruiter/pipeline")
@require_permission("dashboard", "view")
def get_recruiter_pipeline(
    from_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get real-time recruitment pipeline counts with date filtering.
    
    NEW Pipeline stages in order:
    - Applied: Initial applications
    - Screened: Candidates who passed initial screening
    - Submitted: Candidates submitted to clients (NEW STAGE)
    - Interview: Candidates in interview process
    - Offer: Candidates with extended offers
    - Hired: Successfully hired candidates
    - Rejected: Rejected candidates at any stage
    """
    user_role = current_user.get("role")
    user_id = current_user.get("id")
    
    # Parse date filters
    date_filter = None
    if from_date or to_date:
        try:
            start_dt = datetime.strptime(from_date, "%Y-%m-%d").date() if from_date else None
            end_dt = datetime.strptime(to_date, "%Y-%m-%d").date() if to_date else None
            date_filter = (start_dt, end_dt)
        except ValueError:
            raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
    
    # Get job IDs based on role
    if user_role in ["admin", "super_admin"]:
        job_ids = [j.id for j in db.query(Job).all()]
    else:
        job_ids = [j.id for j in db.query(Job).join(Job.recruiters).filter(
            Job.recruiters.any(id=user_id)
        ).all()]
    
    if not job_ids:
        return {
            "applied": 0, "screened": 0, "submitted": 0, 
            "interview": 0, "offer": 0, "hired": 0, "rejected": 0
        }
    
    def get_candidate_count(status_filter):
        """Helper to get candidate counts with optional date filtering"""
        query = db.query(distinct(Candidate.id)).join(
            CandidateSubmission, CandidateSubmission.candidate_id == Candidate.id
        ).filter(
            CandidateSubmission.job_id.in_(job_ids),
            Candidate.status == status_filter
        )
        
        if date_filter:
            start_dt, end_dt = date_filter
            if start_dt:
                query = query.filter(func.date(CandidateSubmission.created_at) >= start_dt)
            if end_dt:
                query = query.filter(func.date(CandidateSubmission.created_at) <= end_dt)
        
        return query.count()
    
    # NEW Pipeline Order Counts
    applied = get_candidate_count(CandidateStatus.applied) + get_candidate_count(CandidateStatus.sourced) + get_candidate_count(CandidateStatus.new)
    screened = get_candidate_count(CandidateStatus.screening) + get_candidate_count(CandidateStatus.screened) + get_candidate_count(CandidateStatus.shortlisted)
    submitted = get_candidate_count(CandidateStatus.submitted)  # NEW STAGE
    interview = get_candidate_count(CandidateStatus.interview) + get_candidate_count(CandidateStatus.interview_scheduled) + get_candidate_count(CandidateStatus.interview_completed)
    offer = get_candidate_count(CandidateStatus.offer) + get_candidate_count(CandidateStatus.offer_extended) + get_candidate_count(CandidateStatus.offer_accepted)
    hired = get_candidate_count(CandidateStatus.hired) + get_candidate_count(CandidateStatus.joined)
    rejected = get_candidate_count(CandidateStatus.rejected)
    
    return {
        "applied": applied or 0,
        "screened": screened or 0,
        "submitted": submitted or 0,  # NEW
        "interview": interview or 0,
        "offer": offer or 0,
        "hired": hired or 0,
        "rejected": rejected or 0,
        "last_updated": datetime.utcnow().isoformat(),
        "date_range": {
            "from": from_date,
            "to": to_date
        } if date_filter else None
    }


@router.get("/metrics")
@require_permission("dashboard", "view")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    user_role = current_user.get("role")
    user_id = current_user.get("id")

    # ================================
    # ⭐ ADMIN → SEE ALL DATA
    # ================================
    if user_role in ["admin", "super_admin"]:
        total_jobs_open = db.query(Job).filter(
            Job.status.in_(["open", "active", "OPEN", "Active"])
        ).count()

        total_candidates = db.query(Candidate).count()

        interviews_scheduled = db.query(JobApplication).filter(
            JobApplication.status == "interview_scheduled"
        ).count()

        offers_pending = db.query(JobApplication).filter(
            JobApplication.status == "offer_made"
        ).count()

        employees_onboarding = db.query(JobApplication).filter(
            JobApplication.status == "hired"
        ).count()

    # ================================
    # ⭐ RECRUITER → ONLY HIS DATA
    # ================================
    else:
       jobs = db.query(Job).join(Job.recruiters).filter(
        Job.recruiters.any(id=user_id)
       ).all()

       job_ids = [j.id for j in jobs]

       total_jobs_open = len(jobs)

    # 🔥 GLOBAL CANDIDATE COUNT
       total_candidates = db.query(Candidate).count()

       interviews_scheduled = db.query(JobApplication).filter(
        JobApplication.job_id.in_(job_ids),
        JobApplication.status == "interview_scheduled"
       ).count()

       offers_pending = db.query(JobApplication).filter(
        JobApplication.job_id.in_(job_ids),
        JobApplication.status == "offer_made"
       ).count()

       employees_onboarding = db.query(JobApplication).filter(
        JobApplication.job_id.in_(job_ids),
        JobApplication.status == "hired"
      ).count()

    # ================================
    # FINAL RESPONSE
    # ================================
    revenue_projected = total_jobs_open * 50000
    revenue_realized = employees_onboarding * 60000

    return {
        "total_jobs_open": total_jobs_open,
        "total_candidates": total_candidates,
        "interviews_scheduled": interviews_scheduled,
        "offers_pending": offers_pending,
        "employees_onboarding": employees_onboarding,
        "revenue_projected": revenue_projected,
        "revenue_realized": revenue_realized,
        "time_to_hire_avg": 12,
    }


# ============================================================
# SUBMIT CANDIDATE TO CLIENT
# ============================================================
@router.post("/candidates/{candidate_id}/submit")
@require_permission("candidates", "update")
def submit_candidate_to_client(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Submit candidate to client (move to SUBMITTED stage).
    Updates candidate status and creates timeline entry.
    """
    # Find candidate
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(404, "Candidate not found")
    
    # Verify candidate is in a valid state for submission
    valid_statuses = [CandidateStatus.screened, CandidateStatus.screening, CandidateStatus.shortlisted]
    if candidate.status not in valid_statuses:
        raise HTTPException(400, f"Cannot submit candidate with status '{candidate.status}'. Must be screened/screening/shortlisted.")
    
    try:
        # Update candidate status to submitted
        candidate.status = CandidateStatus.submitted
        
        # Create timeline entry
        from app.models import CandidateTimeline
        timeline_entry = CandidateTimeline(
            candidate_id=candidate_id,
            action="submitted",
            description=f"Candidate submitted to client by {current_user.get('username', 'system')}",
            performed_by=current_user.get("id"),
            timestamp=datetime.utcnow()
        )
        db.add(timeline_entry)
        
        # Update any related candidate submissions
        submissions = db.query(CandidateSubmission).filter(
            CandidateSubmission.candidate_id == candidate_id
        ).all()
        
        for submission in submissions:
            if not submission.submitted_at:
                submission.submitted_at = datetime.utcnow()
                submission.status = "submitted"
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Candidate {candidate.full_name or candidate.email} submitted to client successfully",
            "candidate_id": candidate_id,
            "new_status": candidate.status,
            "submitted_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to submit candidate: {str(e)}")


# ============================================================  
# REAL-TIME PIPELINE STATISTICS API
# ============================================================
@router.get("/recruiter/pipeline/stats")
@require_permission("dashboard", "view") 
def get_pipeline_stats(
    period: str = Query("daily", description="Period: daily, weekly, monthly"),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get detailed pipeline statistics with time-based grouping.
    Supports daily/weekly/monthly breakdowns and date range filtering.
    """
    user_role = current_user.get("role")
    user_id = current_user.get("id")
    
    # Parse date filters
    if from_date or to_date:
        try:
            start_dt = datetime.strptime(from_date, "%Y-%m-%d") if from_date else None
            end_dt = datetime.strptime(to_date, "%Y-%m-%d") if to_date else None
        except ValueError:
            raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
    else:
        start_dt = end_dt = None
    
    # Get job IDs based on role
    if user_role in ["admin", "super_admin"]:
        job_ids = [j.id for j in db.query(Job).all()]
    else:
        job_ids = [j.id for j in db.query(Job).join(Job.recruiters).filter(
            Job.recruiters.any(id=user_id)
        ).all()]
    
    if not job_ids:
        return {"stats": [], "summary": {}}
    
    # Build time-based query grouping
    if period == "daily":
        date_trunc = func.date(CandidateSubmission.created_at)
    elif period == "weekly":
        date_trunc = func.date_trunc('week', CandidateSubmission.created_at)
    elif period == "monthly":
        date_trunc = func.date_trunc('month', CandidateSubmission.created_at)
    else:
        raise HTTPException(400, "Invalid period. Use: daily, weekly, monthly")
    
    # Base query for time-grouped stats
    base_query = db.query(
        date_trunc.label('period'),
        Candidate.status,
        func.count(distinct(Candidate.id)).label('count')
    ).join(
        CandidateSubmission, CandidateSubmission.candidate_id == Candidate.id
    ).filter(
        CandidateSubmission.job_id.in_(job_ids)
    )
    
    # Apply date filtering
    if start_dt:
        base_query = base_query.filter(CandidateSubmission.created_at >= start_dt)
    if end_dt:
        base_query = base_query.filter(CandidateSubmission.created_at <= end_dt)
    
    # Group and execute
    stats = base_query.group_by(date_trunc, Candidate.status).all()
    
    # Format response
    formatted_stats = []
    summary = {"total_periods": 0, "total_candidates": 0, "avg_per_period": 0}
    
    period_data = {}
    for stat in stats:
        period_str = stat.period.isoformat() if hasattr(stat.period, 'isoformat') else str(stat.period)
        
        if period_str not in period_data:
            period_data[period_str] = {}
        
        period_data[period_str][stat.status] = stat.count
    
    # Transform to list format
    for period_str, statuses in period_data.items():
        formatted_stats.append({
            "period": period_str,
            "applied": statuses.get('applied', 0) + statuses.get('sourced', 0) + statuses.get('new', 0),
            "screened": statuses.get('screening', 0) + statuses.get('screened', 0) + statuses.get('shortlisted', 0),
            "submitted": statuses.get('submitted', 0),
            "interview": statuses.get('interview', 0) + statuses.get('interview_scheduled', 0) + statuses.get('interview_completed', 0),
            "offer": statuses.get('offer', 0) + statuses.get('offer_extended', 0) + statuses.get('offer_accepted', 0),
            "hired": statuses.get('hired', 0) + statuses.get('joined', 0),
            "rejected": statuses.get('rejected', 0)
        })
    
    # Calculate summary
    total_candidates = sum(sum(period.values()) for period in period_data.values())
    summary = {
        "total_periods": len(period_data),
        "total_candidates": total_candidates,
        "avg_per_period": round(total_candidates / len(period_data), 2) if period_data else 0
    }
    
    return {
        "stats": formatted_stats,
        "summary": summary,
        "period": period,
        "date_range": {"from": from_date, "to": to_date} if (from_date or to_date) else None
    }

"""
Resdex - Advanced search, saved searches, folders, and invites
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, String, or_, and_
from datetime import datetime, timedelta
from typing import Optional, List
import time

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from app.utils.role_check import allow_user
from app.ai_core import generate_embedding
from app.utils.search_utils import cosine_similarity
from app.utils.resdex_search_engine import (
    split_csv,
    tokenize,
    apply_synonyms,
    extract_experience_range,
    candidate_document,
    keyword_score,
    skills_score,
    experience_score,
    location_score,
    availability_bucket,
    availability_score,
    certification_score,
    recency_score,
    structured_score,
    confidence,
    facets,
    spell_check_query,
    search_suggestions,
    related_searches,
    safe_lower,
)

router = APIRouter(prefix="/v1/resdex", tags=["resdex"])


# ============================================================
# SUGGEST - Query autocomplete suggestions
# ============================================================

@router.get("/suggest")
@require_permission("candidates", "view")
async def resdex_suggest(
    q: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)

    try:
        suggestions = search_suggestions(db, q or "", current_user)
        return {
            "query": q,
            "count": len(suggestions),
            "results": suggestions,
            "did_you_mean": spell_check_query(db, q or ""),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# SEARCH - Live search across all candidates
# ============================================================

@router.get("/search")
@require_permission("candidates", "view")
async def resdex_search(
    q: Optional[str] = None,
    min_exp: Optional[float] = None,
    max_exp: Optional[float] = None,
    location: Optional[str] = None,
    skills: Optional[str] = None,  # comma-separated
    skills_logic: str = "AND",
    certifications: Optional[str] = None,  # comma-separated
    availability: Optional[str] = None,  # comma-separated buckets: immediate,2weeks,1month,not_available
    salary_min: Optional[float] = None,
    salary_max: Optional[float] = None,
    tags: Optional[str] = None,  # comma-separated
    tags_logic: str = "AND",
    profile_min: Optional[int] = None,
    last_active: Optional[str] = None,  # 24h|7days|30days|90days|any
    willing_to_relocate: Optional[bool] = None,
    sort: str = "relevance",
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Live search across all candidate data (Intake, Profile, Pool)
    Aggregates and de-duplicates results
    """
    allow_user(current_user)
    
    try:
        t0 = time.perf_counter()

        # -------------------------
        # Stage 1: Query Understanding
        # -------------------------
        parsed_min_exp, parsed_max_exp = extract_experience_range(q or "")
        effective_min_exp = min_exp if min_exp is not None else parsed_min_exp
        effective_max_exp = max_exp if max_exp is not None else parsed_max_exp

        required_skills = split_csv(skills)
        required_certs = split_csv(certifications)
        required_tags = split_csv(tags)
        availability_list = [a.strip().lower() for a in split_csv(availability)]

        query_tokens = apply_synonyms(tokenize(q or ""))

        # If the user didn't explicitly pass skills=..., try to extract skill phrases from the query
        skills_for_scoring = list(required_skills)
        if not skills_for_scoring and q and q.strip() and query_tokens:
            phrases = set(query_tokens)
            phrases.update([" ".join(query_tokens[i : i + 2]) for i in range(len(query_tokens) - 1)])
            phrases.update([" ".join(query_tokens[i : i + 3]) for i in range(len(query_tokens) - 2)])
            try:
                rows = (
                    db.query(models.Skill.normalized_name)
                    .filter(models.Skill.normalized_name.in_(list(phrases)))
                    .all()
                )
                vocab = set([r[0] for r in rows if r and r[0]])
                skills_for_scoring = [p for p in phrases if p in vocab]
            except Exception:
                skills_for_scoring = []

        # -------------------------
        # Stage 2: Structured Filters (SQL where possible)
        # -------------------------
        query = db.query(models.Candidate)

        if hasattr(models.Candidate, "merged_into_id"):
            query = query.filter(models.Candidate.merged_into_id.is_(None))

        if hasattr(models.Candidate, "is_active"):
            query = query.filter(models.Candidate.is_active == True)

        if effective_min_exp is not None:
            query = query.filter(models.Candidate.experience_years >= effective_min_exp)
        if effective_max_exp is not None:
            query = query.filter(models.Candidate.experience_years <= effective_max_exp)
        if location:
            query = query.filter(models.Candidate.current_location.ilike(f"%{location}%"))
        if salary_min is not None:
            query = query.filter(models.Candidate.expected_salary >= salary_min)
        if salary_max is not None:
            query = query.filter(models.Candidate.expected_salary <= salary_max)
        if profile_min is not None:
            query = query.filter(models.Candidate.profile_completion >= profile_min)
        if willing_to_relocate is True:
            query = query.filter(models.Candidate.willing_to_relocate == True)

        # Last-active (coarse SQL filter)
        la = (last_active or "").strip().lower()
        if la and la != "any" and hasattr(models.Candidate, "last_activity_at"):
            now = datetime.utcnow()
            if la == "24h":
                query = query.filter(models.Candidate.last_activity_at >= (now - timedelta(hours=24)))
            elif la == "7days":
                query = query.filter(models.Candidate.last_activity_at >= (now - timedelta(days=7)))
            elif la == "30days":
                query = query.filter(models.Candidate.last_activity_at >= (now - timedelta(days=30)))
            elif la == "90days":
                query = query.filter(models.Candidate.last_activity_at >= (now - timedelta(days=90)))

        # Skills filter against JSON (best-effort string match)
        if required_skills:
            if (skills_logic or "").strip().upper() == "OR":
                query = query.filter(
                    or_(
                        *[
                            cast(models.Candidate.skills, String).ilike(f"%{s}%")
                            for s in required_skills
                        ]
                    )
                )
            else:
                for s in required_skills:
                    query = query.filter(cast(models.Candidate.skills, String).ilike(f"%{s}%"))

        # Tags filter against JSON (best-effort)
        if required_tags:
            if (tags_logic or "").strip().upper() == "OR":
                query = query.filter(
                    or_(
                        *[
                            cast(models.Candidate.tags, String).ilike(f"%{t}%")
                            for t in required_tags
                        ]
                    )
                )
            else:
                for t in required_tags:
                    query = query.filter(cast(models.Candidate.tags, String).ilike(f"%{t}%"))

        candidates = query.all()

        # Post-filters not easily expressible in SQL
        if availability_list:
            allowed = set([a for a in availability_list if a])
            candidates = [c for c in candidates if (availability_bucket(c) or "") in allowed]

        if required_certs:
            req = [safe_lower(x) for x in required_certs if x]
            filtered = []
            for c in candidates:
                doc = candidate_document(c)
                if any(r in doc for r in req):
                    filtered.append(c)
            candidates = filtered

        # -------------------------
        # Stage 2: Semantic + Keyword scoring inputs
        # -------------------------
        query_embedding = generate_embedding(q.strip()) if (q and q.strip()) else None

        structured_filters = {
            "min_exp": effective_min_exp,
            "max_exp": effective_max_exp,
            "location": location,
            "skills": required_skills,
            "skills_logic": skills_logic,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "tags": required_tags,
            "tags_logic": tags_logic,
            "profile_min": profile_min,
            "last_active": last_active,
            "availability": availability_list,
            "willing_to_relocate": willing_to_relocate,
        }

        scored = []
        for c in candidates:
            doc = candidate_document(c)

            semantic = 0.0
            if query_embedding and getattr(c, "embedding_vector", None):
                sim = cosine_similarity(query_embedding, c.embedding_vector)
                semantic = float(max(0.0, sim) * 100.0)

            keyword = keyword_score(query_tokens, doc) if (q and q.strip()) else 50.0
            structured = structured_score(structured_filters, c)
            relevance = float((semantic * 0.4) + (keyword * 0.3) + (structured * 0.3))

            # -------------------------
            # Stage 3: Multi-factor ranking
            # -------------------------
            skill_sc = skills_score(skills_for_scoring, getattr(c, "skills", []) or [])
            exp_sc = experience_score(query_tokens, effective_min_exp, effective_max_exp, c)
            loc_sc = location_score(location, c)
            cert_sc = certification_score(required_certs, c)
            rec_sc = recency_score(c)
            complete_sc = float(getattr(c, "profile_completion", 0) or 0.0)
            avail_sc = availability_score(c)

            final_score = (
                relevance * 0.25
                + skill_sc * 0.25
                + exp_sc * 0.20
                + loc_sc * 0.10
                + cert_sc * 0.10
                + rec_sc * 0.05
                + complete_sc * 0.03
                + avail_sc * 0.02
            )
            final_score = float(round(min(100.0, max(0.0, final_score)), 2))

            breakdown = {
                "semantic": semantic,
                "keyword": keyword,
                "structured": structured,
                "relevance": relevance,
                "skills": skill_sc,
                "experience": exp_sc,
                "location": loc_sc,
                "certification": cert_sc,
                "recency": rec_sc,
                "completeness": complete_sc,
                "availability": avail_sc,
                "final_score": final_score,
            }

            scored.append(
                {
                    "_candidate_obj": c,
                    "id": c.id,
                    "name": c.full_name or "N/A",
                    "email": c.email or "N/A",
                    "phone": c.phone or "N/A",
                    "skills": c.skills if isinstance(c.skills, list) else [],
                    "experience": c.experience_years or 0,
                    "location": c.current_location or "N/A",
                    "city": c.city or "N/A",
                    "employer": c.current_employer or "N/A",
                    "designation": c.experience or getattr(c, "current_job_title", None) or "N/A",
                    "salary": c.expected_salary or 0,
                    "status": str(c.status) if c.status else "N/A",
                    "resume_url": c.resume_url,
                    "source": c.source or "N/A",
                    "match_score": final_score,
                    "score_breakdown": breakdown,
                    "confidence": confidence(breakdown),
                }
            )

        # -------------------------
        # Sorting / pagination
        # -------------------------
        sort_key = (sort or "relevance").strip().lower()
        if sort_key == "experience_desc":
            scored.sort(key=lambda x: float(x.get("experience") or 0), reverse=True)
        elif sort_key == "recency_desc":
            scored.sort(
                key=lambda x: float(x.get("score_breakdown", {}).get("recency") or 0),
                reverse=True,
            )
        else:
            scored.sort(key=lambda x: float(x.get("match_score") or 0), reverse=True)

        total_count = len(scored)
        paginated = scored[offset : offset + limit]

        paginated_results = []
        for r in paginated:
            rr = dict(r)
            rr.pop("_candidate_obj", None)
            paginated_results.append(rr)

        search_time_ms = int((time.perf_counter() - t0) * 1000)
        did_you_mean = spell_check_query(db, q or "")
        suggestions = search_suggestions(db, q or "", current_user)
        related = related_searches(q or "", scored)
        facet_data = facets(scored)

        return {
            "total": total_count,
            "count": len(paginated_results),
            "limit": limit,
            "offset": offset,
            "results": paginated_results,
            "metadata": {
                "search_time_ms": search_time_ms,
                "suggestions": suggestions,
                "related_searches": related,
                "did_you_mean": did_you_mean,
                "active_filters": {
                    "q": q,
                    "min_exp": effective_min_exp,
                    "max_exp": effective_max_exp,
                    "location": location,
                    "skills": required_skills,
                    "skills_logic": skills_logic,
                    "certifications": required_certs,
                    "availability": availability_list,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "tags": required_tags,
                    "tags_logic": tags_logic,
                    "profile_min": profile_min,
                    "last_active": last_active,
                    "willing_to_relocate": willing_to_relocate,
                },
                "facets": facet_data,
            },
        }
    
    except Exception as e:
        print(f"Resdex search error: {str(e)}")
        return {
            "total": 0,
            "count": 0,
            "limit": limit,
            "offset": offset,
            "results": [],
            "error": str(e),
        }

# ============================================================
# SAVED SEARCHES
# ============================================================

@router.post("/saved-search")
@require_permission("candidates", "create")
async def create_saved_search(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Save a search query for later use
    payload: { name, query, logic, min_exp, max_exp, location, folder_id }
    """
    allow_user(current_user)
    
    try:
        saved_search = models.SavedSearch(
            name=payload.get("name"),
            user_id=current_user.get("id"),
            query=payload.get("query"),
            logic=payload.get("logic", "OR"),
            min_exp=payload.get("min_exp"),
            max_exp=payload.get("max_exp"),
            location=payload.get("location"),
            folder_id=payload.get("folder_id"),
        )
        
        db.add(saved_search)
        db.commit()
        db.refresh(saved_search)
        
        return {
            "id": saved_search.id,
            "name": saved_search.name,
            "query": saved_search.query,
            "created_at": saved_search.created_at,
            "status": "saved",
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/saved-search")
@require_permission("candidates", "view")
async def get_saved_searches(
    folder_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get all saved searches for current user
    Optionally filter by folder_id
    """
    allow_user(current_user)
    
    try:
        query = db.query(models.SavedSearch).filter(
            models.SavedSearch.user_id == current_user.get("id"),
            models.SavedSearch.is_active == True,
        )
        
        if folder_id:
            query = query.filter(models.SavedSearch.folder_id == folder_id)
        
        saved_searches = query.order_by(models.SavedSearch.created_at.desc()).all()
        
        results = []
        for ss in saved_searches:
            results.append({
                "id": ss.id,
                "name": ss.name,
                "query": ss.query,
                "logic": ss.logic,
                "min_exp": ss.min_exp,
                "max_exp": ss.max_exp,
                "location": ss.location,
                "folder_id": ss.folder_id,
                "created_at": ss.created_at,
                "last_used_at": ss.last_used_at,
            })
        
        return {
            "count": len(results),
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/saved-search/{search_id}")
@require_permission("candidates", "delete")
async def delete_saved_search(
    search_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Delete a saved search (soft delete - just mark as inactive)
    """
    allow_user(current_user)
    
    try:
        saved_search = db.query(models.SavedSearch).filter(
            models.SavedSearch.id == search_id,
            models.SavedSearch.user_id == current_user.get("id"),
        ).first()
        
        if not saved_search:
            raise HTTPException(status_code=404, detail="Saved search not found")
        
        saved_search.is_active = False
        db.commit()
        
        return {"status": "deleted", "id": search_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# FOLDERS
# ============================================================

@router.post("/folder")
@require_permission("candidates", "create")
async def create_folder(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Create a new folder for organizing searches
    payload: { name, description }
    """
    allow_user(current_user)
    
    try:
        folder = models.Folder(
            name=payload.get("name"),
            description=payload.get("description"),
            user_id=current_user.get("id"),
        )
        
        db.add(folder)
        db.commit()
        db.refresh(folder)
        
        return {
            "id": folder.id,
            "name": folder.name,
            "created_at": folder.created_at,
            "status": "created",
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/folder")
@require_permission("candidates", "view")
async def get_folders(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get all folders with their saved searches
    """
    allow_user(current_user)
    
    try:
        folders = db.query(models.Folder).filter(
            models.Folder.user_id == current_user.get("id"),
            models.Folder.is_active == True,
        ).order_by(models.Folder.created_at.desc()).all()
        
        results = []
        for folder in folders:
            folder_data = {
                "id": folder.id,
                "name": folder.name,
                "description": folder.description,
                "created_at": folder.created_at,
                "searches": [],
            }
            
            # Add searches in this folder
            for ss in folder.saved_searches:
                if ss.is_active:
                    folder_data["searches"].append({
                        "id": ss.id,
                        "name": ss.name,
                        "query": ss.query,
                    })
            
            results.append(folder_data)
        
        return {
            "count": len(results),
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/folder/{folder_id}")
@require_permission("candidates", "delete")
async def delete_folder(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Delete a folder (soft delete)
    """
    allow_user(current_user)
    
    try:
        folder = db.query(models.Folder).filter(
            models.Folder.id == folder_id,
            models.Folder.user_id == current_user.get("id"),
        ).first()
        
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        
        folder.is_active = False
        db.commit()
        
        return {"status": "deleted", "id": folder_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================
# SEND INVITE
# ============================================================

@router.post("/invite")
@require_permission("candidates", "create")
async def send_invite(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Send invite to candidate
    payload: { candidate_id, job_id, message }
    """
    allow_user(current_user)
    
    try:
        candidate_id = payload.get("candidate_id")
        job_id = payload.get("job_id")
        message = payload.get("message", "")
        
        # Verify candidate exists
        candidate = db.query(models.Candidate).filter(
            models.Candidate.id == candidate_id
        ).first()
        
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")
        
        # Verify job exists if provided
        if job_id:
            job = db.query(models.Job).filter(models.Job.id == job_id).first()
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
        
        # Create invite record
        invite = models.CandidateInvite(
            candidate_id=candidate_id,
            recruiter_id=current_user.get("id"),
            job_id=job_id,
            message=message,
            status="sent",
        )
        
        db.add(invite)
        
        # Update candidate status
        candidate.status = models.CandidateStatus.invited
        
        db.commit()
        db.refresh(invite)
        
        return {
            "id": invite.id,
            "candidate_id": candidate_id,
            "candidate_name": candidate.full_name,
            "status": "sent",
            "sent_at": invite.sent_at,
            "message": "Invite sent successfully",
        }
    except Exception as e:
        db.rollback()
        print(f"Invite error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invite/{candidate_id}")
@require_permission("candidates", "view")
async def get_candidate_invites(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get all invites sent to a candidate
    """
    allow_user(current_user)
    
    try:
        invites = db.query(models.CandidateInvite).filter(
            models.CandidateInvite.candidate_id == candidate_id
        ).order_by(models.CandidateInvite.sent_at.desc()).all()
        
        results = []
        for invite in invites:
            results.append({
                "id": invite.id,
                "job_id": invite.job_id,
                "status": invite.status,
                "sent_at": invite.sent_at,
                "opened_at": invite.opened_at,
                "response": invite.response,
            })
        
        return {
            "count": len(results),
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/invite")
@require_permission("candidates", "view")
async def list_invites(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List invites sent by current recruiter
    """
    allow_user(current_user)

    try:
        invites = (
            db.query(models.CandidateInvite, models.Candidate, models.Job)
            .join(
                models.Candidate,
                models.Candidate.id == models.CandidateInvite.candidate_id,
            )
            .outerjoin(
                models.Job,
                models.Job.id == models.CandidateInvite.job_id,
            )
            .filter(models.CandidateInvite.recruiter_id == current_user.get("id"))
            .order_by(models.CandidateInvite.sent_at.desc())
            .all()
        )

        results = []
        for invite, candidate, job in invites:
            results.append({
                "id": invite.id,
                "candidate_id": invite.candidate_id,
                "candidate_name": candidate.full_name or candidate.name,
                "job_id": invite.job_id,
                "job_title": job.title if job else None,
                "status": invite.status,
                "sent_at": invite.sent_at,
                "opened_at": invite.opened_at,
                "response": invite.response,
            })

        return {
            "count": len(results),
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

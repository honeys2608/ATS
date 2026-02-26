from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, or_

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from app.utils.role_check import allow_user

router = APIRouter(prefix="/searches", tags=["Searches"])


class SaveSearchRequest(BaseModel):
    search_name: str
    filters: Dict[str, Any]
    folder_id: Optional[str] = None


def _build_candidate_query(db: Session, filters: Dict[str, Any]):
    query = db.query(models.Candidate)
    if hasattr(models.Candidate, "merged_into_id"):
        query = query.filter(models.Candidate.merged_into_id.is_(None))

    skills = filters.get("skills") or []
    location = filters.get("location")
    exp_min = filters.get("experience_min")
    exp_max = filters.get("experience_max")

    if isinstance(skills, str):
        skills = [s.strip() for s in skills.split(",") if s.strip()]

    if skills:
        skill_conditions = [
            cast(models.Candidate.skills, String).ilike(f"%{skill}%")
            for skill in skills
        ]
        query = query.filter(or_(*skill_conditions))

    if location:
        query = query.filter(models.Candidate.current_location.ilike(f"%{location}%"))

    if exp_min is not None and hasattr(models.Candidate, "experience_years"):
        query = query.filter(models.Candidate.experience_years >= exp_min)
    if exp_max is not None and hasattr(models.Candidate, "experience_years"):
        query = query.filter(models.Candidate.experience_years <= exp_max)

    return query


@router.post("/save")
@require_permission("searches", "create")
async def save_search(
    payload: SaveSearchRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)

    if not payload.search_name or not payload.search_name.strip():
        raise HTTPException(status_code=400, detail="search_name is required")

    recruiter_id = current_user.get("id")

    existing = (
        db.query(models.SavedSearch)
        .filter(
            models.SavedSearch.user_id == recruiter_id,
            models.SavedSearch.is_active == True,
            models.SavedSearch.name == payload.search_name.strip(),
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Search name already exists")

    total = (
        db.query(models.SavedSearch)
        .filter(models.SavedSearch.user_id == recruiter_id, models.SavedSearch.is_active == True)
        .count()
    )
    if total >= 50:
        raise HTTPException(status_code=400, detail="Max 50 saved searches allowed")

    filters = payload.filters or {}
    folder_id = payload.folder_id

    if folder_id:
        folder = (
            db.query(models.Folder)
            .filter(
                models.Folder.id == folder_id,
                models.Folder.user_id == recruiter_id,
                models.Folder.is_active == True,
            )
            .first()
        )
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
    skills = filters.get("skills") or []
    if isinstance(skills, str):
        skills = [s.strip() for s in skills.split(",") if s.strip()]

    query_keyword = " ".join(skills) if skills else (filters.get("keyword") or "")

    candidate_query = _build_candidate_query(db, filters)
    result_count = candidate_query.count()

    saved = models.SavedSearch(
        name=payload.search_name.strip(),
        user_id=recruiter_id,
        query=query_keyword or "-",
        logic="OR",
        min_exp=filters.get("experience_min"),
        max_exp=filters.get("experience_max"),
        location=filters.get("location"),
        filters=filters,
        result_count=result_count,
        created_at=datetime.utcnow(),
        folder_id=folder_id,
    )

    db.add(saved)
    db.commit()
    db.refresh(saved)

    return {
        "id": saved.id,
        "search_name": saved.name,
        "filters": filters,
        "result_count": saved.result_count,
        "created_at": saved.created_at,
        "folder_id": saved.folder_id,
    }


@router.get("")
@require_permission("searches", "view")
async def list_searches(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)
    recruiter_id = current_user.get("id")

    searches = (
        db.query(models.SavedSearch)
        .filter(models.SavedSearch.user_id == recruiter_id, models.SavedSearch.is_active == True)
        .order_by(models.SavedSearch.created_at.desc())
        .all()
    )

    results = []
    for s in searches:
        results.append({
            "id": s.id,
            "search_name": s.name,
            "filters": s.filters or {},
            "result_count": s.result_count or 0,
            "created_at": s.created_at,
            "folder_id": s.folder_id,
        })

    return {"count": len(results), "results": results}


@router.get("/{search_id}/run")
@require_permission("searches", "view")
async def run_search(
    search_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)
    recruiter_id = current_user.get("id")

    saved = (
        db.query(models.SavedSearch)
        .filter(
            models.SavedSearch.id == search_id,
            models.SavedSearch.user_id == recruiter_id,
            models.SavedSearch.is_active == True,
        )
        .first()
    )
    if not saved:
        raise HTTPException(status_code=404, detail="Search not found")

    filters = saved.filters or {}
    query = _build_candidate_query(db, filters)
    candidates = query.order_by(models.Candidate.created_at.desc()).all()

    saved.last_used_at = datetime.utcnow()
    saved.result_count = len(candidates)
    db.commit()

    results = []
    for c in candidates:
        results.append({
            "id": c.id,
            "full_name": c.full_name,
            "email": c.email,
            "phone": c.phone,
            "status": c.status,
        })

    return {
        "filters": filters,
        "result_count": len(results),
        "candidates": results,
    }


@router.delete("/{search_id}")
@require_permission("searches", "delete")
async def delete_search(
    search_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)
    recruiter_id = current_user.get("id")

    saved = (
        db.query(models.SavedSearch)
        .filter(
            models.SavedSearch.id == search_id,
            models.SavedSearch.user_id == recruiter_id,
            models.SavedSearch.is_active == True,
        )
        .first()
    )
    if not saved:
        raise HTTPException(status_code=404, detail="Search not found")

    saved.is_active = False
    db.commit()

    return {"status": "deleted", "id": search_id}


@router.put("/{search_id}/folder")
@require_permission("folders", "update")
async def assign_search_folder(
    search_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)
    recruiter_id = current_user.get("id")
    folder_id = payload.get("folder_id")

    saved = (
        db.query(models.SavedSearch)
        .filter(
            models.SavedSearch.id == search_id,
            models.SavedSearch.user_id == recruiter_id,
            models.SavedSearch.is_active == True,
        )
        .first()
    )
    if not saved:
        raise HTTPException(status_code=404, detail="Search not found")

    if folder_id:
        folder = (
            db.query(models.Folder)
            .filter(
                models.Folder.id == folder_id,
                models.Folder.user_id == recruiter_id,
                models.Folder.is_active == True,
            )
            .first()
        )
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

    saved.folder_id = folder_id
    db.commit()

    return {"status": "updated", "id": search_id, "folder_id": folder_id}

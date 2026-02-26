from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db

router = APIRouter(prefix="/v1/activity", tags=["Activity Feed"])


def _user_id(user: dict) -> Optional[str]:
    return user.get("id") or user.get("user_id") or user.get("sub")


def _role(user: dict) -> str:
    role = str(user.get("role") or "").strip().lower()
    if role in {"super_admin", "admin"}:
        return "admin"
    if role in {"account_manager", "am"}:
        return "am"
    if role in {"recruiter"}:
        return "recruiter"
    if role in {"candidate"}:
        return "candidate"
    return role


def _to_dict(row: models.ActivityLog):
    return {
        "id": row.id,
        "actor_id": row.actor_id,
        "actor_name": row.actor_name,
        "actor_role": row.actor_role,
        "actor_avatar": row.actor_avatar,
        "action": row.action,
        "resource_type": row.resource_type,
        "resource_id": row.resource_id,
        "resource_name": row.resource_name,
        "target_user_id": row.target_user_id,
        "job_id": row.job_id,
        "client_id": row.client_id,
        "recruiter_id": row.recruiter_id,
        "old_status": row.old_status,
        "new_status": row.new_status,
        "note": row.note,
        "metadata": row.activity_metadata or {},
        "is_visible_to_candidate": bool(row.is_visible_to_candidate),
        "ip_address": row.ip_address,
        "created_at": row.created_at,
    }


def _apply_scope(q, db: Session, user: dict):
    role = _role(user)
    uid = _user_id(user)

    if role == "admin":
        return q

    if role == "am":
        am_job_ids = (
            db.query(models.Job.id)
            .filter(
                or_(
                    models.Job.account_manager_id == uid,
                    models.Job.account_manager_id.is_(None),
                )
            )
            .subquery()
        )
        return q.filter(
            or_(
                models.ActivityLog.actor_id == uid,
                models.ActivityLog.job_id.in_(am_job_ids),
            )
        )

    if role == "recruiter":
        return q.filter(
            or_(
                models.ActivityLog.actor_id == uid,
                models.ActivityLog.recruiter_id == uid,
            )
        )

    if role == "candidate":
        return q.filter(
            and_(
                models.ActivityLog.target_user_id == uid,
                models.ActivityLog.is_visible_to_candidate.is_(True),
            )
        )

    return q.filter(models.ActivityLog.actor_id == uid)


@router.get("/feed")
def get_activity_feed(
    action: Optional[str] = Query(default=None),
    resource_type: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(models.ActivityLog)
    q = _apply_scope(q, db, current_user)

    if action:
        q = q.filter(models.ActivityLog.action == action)
    if resource_type:
        q = q.filter(models.ActivityLog.resource_type == resource_type)
    if date_from:
        q = q.filter(models.ActivityLog.created_at >= date_from)
    if date_to:
        q = q.filter(models.ActivityLog.created_at <= date_to)
    if search:
        token = f"%{search.strip()}%"
        q = q.filter(
            or_(
                models.ActivityLog.resource_name.ilike(token),
                models.ActivityLog.actor_name.ilike(token),
                models.ActivityLog.note.ilike(token),
            )
        )

    total = q.count()
    rows = (
        q.order_by(models.ActivityLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {"total": total, "count": len(rows), "items": [_to_dict(r) for r in rows]}


@router.get("/me")
def get_my_activity(
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    uid = _user_id(current_user)
    rows = (
        db.query(models.ActivityLog)
        .filter(models.ActivityLog.actor_id == uid)
        .order_by(models.ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return {"count": len(rows), "items": [_to_dict(r) for r in rows]}


@router.get("/candidate/{candidate_id}")
def get_candidate_activity(
    candidate_id: str,
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = _role(current_user)
    uid = _user_id(current_user)

    q = db.query(models.ActivityLog).filter(
        or_(
            models.ActivityLog.target_user_id == candidate_id,
            and_(
                models.ActivityLog.resource_type == "candidate",
                models.ActivityLog.resource_id == candidate_id,
            ),
        )
    )
    q = _apply_scope(q, db, current_user)

    if role == "candidate" and uid != candidate_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if role == "candidate":
        q = q.filter(models.ActivityLog.is_visible_to_candidate.is_(True))

    rows = q.order_by(models.ActivityLog.created_at.desc()).limit(limit).all()
    return {"count": len(rows), "items": [_to_dict(r) for r in rows]}


@router.get("/candidate/{candidate_id}/portal")
def get_candidate_portal_activity(
    candidate_id: str,
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    uid = _user_id(current_user)
    role = _role(current_user)

    if role == "candidate" and uid != candidate_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if role not in {"candidate", "admin", "am", "recruiter"}:
        raise HTTPException(status_code=403, detail="Not authorized")

    rows = (
        db.query(models.ActivityLog)
        .filter(
            models.ActivityLog.target_user_id == candidate_id,
            models.ActivityLog.is_visible_to_candidate.is_(True),
        )
        .order_by(models.ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return {"count": len(rows), "items": [_to_dict(r) for r in rows]}


@router.get("/job/{job_id}")
def get_job_activity(
    job_id: str,
    limit: int = Query(default=150, ge=1, le=400),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = _role(current_user)
    uid = _user_id(current_user)

    if role == "recruiter":
        assigned = (
            db.query(models.job_recruiters)
            .filter(
                models.job_recruiters.c.job_id == job_id,
                models.job_recruiters.c.recruiter_id == uid,
            )
            .first()
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Not authorized for this job")

    if role == "am":
        job = db.query(models.Job.id).filter(
            models.Job.id == job_id,
            or_(
                models.Job.account_manager_id == uid,
                models.Job.account_manager_id.is_(None),
            ),
        ).first()
        if not job:
            raise HTTPException(status_code=403, detail="Not authorized for this job")

    q = db.query(models.ActivityLog).filter(
        or_(
            models.ActivityLog.job_id == job_id,
            and_(
                models.ActivityLog.resource_type == "job",
                models.ActivityLog.resource_id == job_id,
            ),
        )
    )
    q = _apply_scope(q, db, current_user)
    rows = q.order_by(models.ActivityLog.created_at.desc()).limit(limit).all()
    return {"count": len(rows), "items": [_to_dict(r) for r in rows]}


@router.get("/recruiter/{recruiter_id}")
def get_recruiter_activity(
    recruiter_id: str,
    limit: int = Query(default=150, ge=1, le=400),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = _role(current_user)
    uid = _user_id(current_user)

    if role == "recruiter" and uid != recruiter_id:
        raise HTTPException(status_code=403, detail="Recruiters can view only their own activity")
    if role not in {"admin", "am", "recruiter"}:
        raise HTTPException(status_code=403, detail="Not authorized")

    rows = (
        db.query(models.ActivityLog)
        .filter(
            or_(
                models.ActivityLog.actor_id == recruiter_id,
                models.ActivityLog.recruiter_id == recruiter_id,
            )
        )
        .order_by(models.ActivityLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return {"count": len(rows), "items": [_to_dict(r) for r in rows]}


@router.get("/stats")
def get_activity_stats(
    period: str = Query(default="month"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    key = str(period or "month").strip().lower()
    now = datetime.utcnow()
    if key == "today":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif key == "week":
        since = now - timedelta(days=7)
    else:
        since = now - timedelta(days=30)

    q = db.query(models.ActivityLog).filter(models.ActivityLog.created_at >= since)
    q = _apply_scope(q, db, current_user)

    by_action = (
        q.with_entities(models.ActivityLog.action, func.count(models.ActivityLog.id))
        .group_by(models.ActivityLog.action)
        .order_by(func.count(models.ActivityLog.id).desc())
        .all()
    )
    by_resource = (
        q.with_entities(models.ActivityLog.resource_type, func.count(models.ActivityLog.id))
        .group_by(models.ActivityLog.resource_type)
        .order_by(func.count(models.ActivityLog.id).desc())
        .all()
    )

    return {
        "period": key,
        "from": since,
        "to": now,
        "total_events": int(q.count()),
        "by_action": [{"action": k, "count": int(v)} for k, v in by_action],
        "by_resource_type": [{"resource_type": k, "count": int(v)} for k, v in by_resource],
    }

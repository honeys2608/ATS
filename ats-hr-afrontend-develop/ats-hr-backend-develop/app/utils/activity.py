from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models import ActivityLog


def _actor_id(actor: Optional[Dict[str, Any]]) -> Optional[str]:
    if not actor:
        return None
    return actor.get("id") or actor.get("user_id") or actor.get("sub")


def _actor_name(actor: Optional[Dict[str, Any]]) -> Optional[str]:
    if not actor:
        return None
    return actor.get("full_name") or actor.get("name") or actor.get("email")


def _normalize_role(role: Optional[str]) -> str:
    key = str(role or "").strip().lower()
    if key in {"super_admin", "admin"}:
        return "admin"
    if key in {"account_manager", "am"}:
        return "am"
    if key in {"recruiter"}:
        return "recruiter"
    if key in {"candidate"}:
        return "candidate"
    if key:
        return key
    return "system"


def log_activity(
    db: Session,
    *,
    action: str,
    resource_type: str,
    actor: Optional[Dict[str, Any]] = None,
    resource_id: Optional[str] = None,
    resource_name: Optional[str] = None,
    target_user_id: Optional[str] = None,
    job_id: Optional[str] = None,
    client_id: Optional[str] = None,
    recruiter_id: Optional[str] = None,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    note: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    is_visible_to_candidate: bool = False,
    request=None,
) -> ActivityLog:
    """
    Caller owns transaction and commit.
    """
    entry = ActivityLog(
        actor_id=_actor_id(actor),
        actor_name=_actor_name(actor),
        actor_role=_normalize_role((actor or {}).get("role")),
        actor_avatar=(actor or {}).get("avatar_url"),
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        resource_name=resource_name,
        target_user_id=str(target_user_id) if target_user_id else None,
        job_id=str(job_id) if job_id else None,
        client_id=str(client_id) if client_id else None,
        recruiter_id=str(recruiter_id) if recruiter_id else None,
        old_status=old_status,
        new_status=new_status,
        note=note,
        activity_metadata=metadata or {},
        is_visible_to_candidate=bool(is_visible_to_candidate),
        ip_address=(request.client.host if request and request.client else None),
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    return entry

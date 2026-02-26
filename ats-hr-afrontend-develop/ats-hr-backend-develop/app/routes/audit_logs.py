from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db

router = APIRouter(prefix="/v1/audit-logs", tags=["Audit Logs"])

TEAM_VIEW_ROLES = {"super_admin", "admin", "account_manager", "recruiter", "client"}


def _normalize_role(role: Optional[str]) -> str:
    return str(role or "").strip().lower()


def _parse_ua_summary(user_agent: Optional[str]) -> dict:
    ua = str(user_agent or "").lower().strip()
    if not ua:
        return {"device": None, "browser": None, "os": None}

    os_name = None
    if "windows nt" in ua:
        os_name = "Windows"
    elif "mac os x" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "android" in ua:
        os_name = "Android"
    elif "iphone" in ua or "ipad" in ua:
        os_name = "iOS"
    elif "linux" in ua:
        os_name = "Linux"

    browser = None
    if "edg/" in ua:
        browser = "Edge"
    elif "chrome/" in ua:
        browser = "Chrome"
    elif "firefox/" in ua:
        browser = "Firefox"
    elif "safari/" in ua and "chrome/" not in ua:
        browser = "Safari"

    device = "Mobile" if any(k in ua for k in ("android", "iphone", "ipad")) else "Desktop"
    return {"device": device, "browser": browser, "os": os_name}


def _current_user_id(user: dict) -> Optional[str]:
    uid = user.get("id") or user.get("user_id") or user.get("sub")
    return str(uid) if uid else None


def _current_tenant_id(user: dict) -> Optional[str]:
    tid = user.get("tenant_id") or user.get("client_id")
    return str(tid) if tid else None


def _apply_filters(
    query,
    *,
    action: Optional[str] = None,
    module: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
):
    if action:
        query = query.filter(models.AuditLog.action.ilike(f"%{action.strip()}%"))
    if module:
        query = query.filter(models.AuditLog.module.ilike(f"%{module.strip()}%"))
    if severity:
        query = query.filter(models.AuditLog.severity == severity.strip().upper())
    if status:
        query = query.filter(models.AuditLog.status == status.strip().lower())
    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type.strip())
    if entity_id:
        query = query.filter(models.AuditLog.entity_id == entity_id.strip())
    if date_from:
        query = query.filter(models.AuditLog.timestamp >= date_from)
    if date_to:
        query = query.filter(models.AuditLog.timestamp <= date_to)
    return query


def _serialize_logs(db: Session, rows: list[models.AuditLog]) -> list[dict]:
    actor_ids = {row.actor_id or row.user_id for row in rows if (row.actor_id or row.user_id)}
    users = {}
    if actor_ids:
        users = {
            u.id: u
            for u in db.query(models.User).filter(models.User.id.in_(list(actor_ids))).all()
        }

    items = []
    for row in rows:
        actor_id = row.actor_id or row.user_id
        actor_user = users.get(actor_id)
        ua_parts = _parse_ua_summary(row.user_agent)
        items.append(
            {
                "id": row.id,
                "log_id": row.log_id or row.id,
                "timestamp": row.timestamp,
                "created_at": row.created_at or row.timestamp,
                "actor_id": actor_id,
                "user_id": actor_id,  # backward compatibility for older frontend
                "actor_name": row.actor_name or ((actor_user.full_name or actor_user.email or actor_user.username) if actor_user else None),
                "actor_email": row.actor_email or (actor_user.email if actor_user else None),
                "actor_role": row.actor_role or (actor_user.role if actor_user else None),
                "tenant_id": row.tenant_id or (actor_user.client_id if actor_user else None),
                "action": row.action,
                "action_type": row.action,
                "action_label": row.action_label or str(row.action or "").replace("_", " ").title(),
                "module": row.module,
                "status": (row.status or "success").lower(),
                "severity": row.severity,
                "entity_type": row.entity_type,
                "entity_id": row.entity_id,
                "entity_name": row.entity_name,
                "description": row.description,
                "failure_reason": row.failure_reason,
                "old_value": row.old_value or row.old_values,
                "new_value": row.new_value or row.new_values,
                "old_values": row.old_values,
                "new_values": row.new_values,
                "ip_address": row.ip_address,
                "user_agent": row.user_agent,
                "device": row.device or ua_parts["device"],
                "browser": row.browser or ua_parts["browser"],
                "os": row.os or ua_parts["os"],
                "location": row.location,
                "endpoint": row.endpoint,
                "http_method": row.http_method,
                "response_code": row.response_code,
                "is_system_action": row.is_system_action,
            }
        )
    return items


@router.get("/me")
def my_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    action: str | None = Query(None),
    module: str | None = Query(None),
    severity: str | None = Query(None),
    status: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    uid = _current_user_id(current_user)
    if not uid:
        raise HTTPException(401, "Authentication required")

    query = db.query(models.AuditLog).filter(
        or_(models.AuditLog.actor_id == uid, models.AuditLog.user_id == uid)
    )
    query = _apply_filters(
        query,
        action=action,
        module=module,
        severity=severity,
        status=status,
        entity_type=entity_type,
        entity_id=entity_id,
        date_from=date_from,
        date_to=date_to,
    )

    total = query.count()
    rows = (
        query.order_by(models.AuditLog.timestamp.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "items": _serialize_logs(db, rows),
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.get("/team")
def team_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    action: str | None = Query(None),
    module: str | None = Query(None),
    severity: str | None = Query(None),
    status: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = _normalize_role(current_user.get("role"))
    if role not in TEAM_VIEW_ROLES:
        raise HTTPException(403, "Not authorized to view team audit logs")

    actor_fk = func.coalesce(models.AuditLog.actor_id, models.AuditLog.user_id)
    query = db.query(models.AuditLog).outerjoin(models.User, actor_fk == models.User.id)

    if role != "super_admin":
        tenant_id = _current_tenant_id(current_user)
        if not tenant_id:
            raise HTTPException(403, "Tenant context required for team audit logs")
        query = query.filter(
            or_(
                models.AuditLog.tenant_id == tenant_id,
                and_(models.AuditLog.tenant_id.is_(None), models.User.client_id == tenant_id),
            )
        )

    query = _apply_filters(
        query,
        action=action,
        module=module,
        severity=severity,
        status=status,
        entity_type=entity_type,
        entity_id=entity_id,
        date_from=date_from,
        date_to=date_to,
    )

    total = query.count()
    rows = (
        query.order_by(models.AuditLog.timestamp.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "items": _serialize_logs(db, rows),
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": max(1, (total + limit - 1) // limit) if total else 1,
    }

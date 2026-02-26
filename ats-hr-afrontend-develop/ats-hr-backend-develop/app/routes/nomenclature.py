from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db
from app.permissions import require_permission

router = APIRouter(prefix="/v1/super-admin/nomenclature", tags=["Nomenclature"])

DEFAULT_LABELS: List[Dict[str, str]] = [
    {"key": "status.sent_to_am", "category": "status", "default_value": "Sent to AM"},
    {"key": "status.am_shortlisted", "category": "status", "default_value": "AM Shortlisted"},
    {"key": "status.sent_to_client", "category": "status", "default_value": "Sent to Client"},
    {"key": "status.client_shortlisted", "category": "status", "default_value": "Client Shortlisted"},
    {"key": "status.hired", "category": "status", "default_value": "Hired"},
    {"key": "nav.roles_permissions", "category": "navigation", "default_value": "Roles & Permissions"},
    {"key": "nav.user_management", "category": "navigation", "default_value": "User Management"},
    {"key": "tab.inbox", "category": "tabs", "default_value": "Inbox"},
    {"key": "btn.shortlist", "category": "buttons", "default_value": "Shortlist"},
]


def _seed_defaults_if_missing(db: Session) -> None:
    existing = {
        (str(row[0] or "").strip().lower())
        for row in db.query(models.UILabel.key).all()
        if row and row[0]
    }
    to_create = []
    for item in DEFAULT_LABELS:
        key = item["key"].strip()
        if key.lower() in existing:
            continue
        to_create.append(
            models.UILabel(
                key=key,
                category=item.get("category"),
                default_value=item.get("default_value", ""),
            )
        )
    if to_create:
        db.add_all(to_create)
        db.commit()


def _serialize_label(row: models.UILabel) -> Dict[str, Any]:
    value = row.custom_value if row.custom_value not in (None, "") else row.default_value
    return {
        "id": row.id,
        "key": row.key,
        "category": row.category,
        "default_value": row.default_value,
        "custom_value": row.custom_value,
        "resolved_value": value,
        "is_customized": bool(row.custom_value not in (None, "")),
        "updated_at": row.updated_at,
    }


@router.get("/labels")
@require_permission("system_settings", "view")
def list_labels(
    search: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    status: str = Query(default="all"),  # all | customized | default
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    _seed_defaults_if_missing(db)
    q = db.query(models.UILabel)

    if search:
        needle = f"%{search.strip()}%"
        q = q.filter(
            or_(
                models.UILabel.key.ilike(needle),
                models.UILabel.default_value.ilike(needle),
                models.UILabel.custom_value.ilike(needle),
            )
        )

    if category:
        q = q.filter(func.lower(models.UILabel.category) == category.strip().lower())

    st = (status or "all").strip().lower()
    if st == "customized":
        q = q.filter(models.UILabel.custom_value.isnot(None), models.UILabel.custom_value != "")
    elif st == "default":
        q = q.filter(or_(models.UILabel.custom_value.is_(None), models.UILabel.custom_value == ""))
    elif st != "all":
        raise HTTPException(400, "Invalid status. Use: all | customized | default")

    rows = q.order_by(models.UILabel.key.asc()).all()
    categories = [r[0] for r in db.query(models.UILabel.category).distinct().order_by(models.UILabel.category.asc()).all() if r[0]]
    return {"items": [_serialize_label(r) for r in rows], "categories": categories, "total": len(rows)}


@router.put("/labels/{label_key}")
@require_permission("system_settings", "update")
def upsert_custom_label(
    label_key: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    key = str(label_key or "").strip()
    if not key:
        raise HTTPException(400, "label_key is required")

    _seed_defaults_if_missing(db)
    row = db.query(models.UILabel).filter(func.lower(models.UILabel.key) == key.lower()).first()
    if not row:
        row = models.UILabel(
            key=key,
            category=payload.get("category"),
            default_value=str(payload.get("default_value") or key),
        )
        db.add(row)

    custom_value = payload.get("custom_value")
    if custom_value in (None, ""):
        row.custom_value = None
    else:
        row.custom_value = str(custom_value).strip()
    row.updated_at = datetime.utcnow()
    row.updated_by = str((current_user or {}).get("id") or "") or None
    db.commit()
    db.refresh(row)
    return {"message": "Label updated", "item": _serialize_label(row)}


@router.post("/labels/{label_key}/reset")
@require_permission("system_settings", "update")
def reset_single_label(
    label_key: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    row = db.query(models.UILabel).filter(func.lower(models.UILabel.key) == label_key.strip().lower()).first()
    if not row:
        raise HTTPException(404, "Label not found")
    row.custom_value = None
    row.updated_at = datetime.utcnow()
    row.updated_by = str((current_user or {}).get("id") or "") or None
    db.commit()
    db.refresh(row)
    return {"message": "Label reset to default", "item": _serialize_label(row)}


@router.post("/labels/reset-all")
@require_permission("system_settings", "update")
def reset_all_labels(
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    confirm = str(payload.get("confirm") or "").strip()
    if confirm != "RESET":
        raise HTTPException(400, "Confirmation failed. Send confirm='RESET'")
    updated = (
        db.query(models.UILabel)
        .filter(models.UILabel.custom_value.isnot(None), models.UILabel.custom_value != "")
        .update({models.UILabel.custom_value: None, models.UILabel.updated_at: datetime.utcnow()}, synchronize_session=False)
    )
    db.commit()
    return {"message": "All labels reset to defaults", "updated": int(updated or 0)}


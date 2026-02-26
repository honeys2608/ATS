from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, asc, desc
from typing import Dict, List, Any, Optional
from io import StringIO
from datetime import datetime, timezone
import csv

from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from app.permissions import require_permission, ROLE_PERMISSIONS
from app.services.audit_service import log_audit, map_audit_severity

router = APIRouter(prefix="/v1/permissions-matrix", tags=["Permissions Matrix"])
LOCKED_PERMISSION_IDS: set[str] = set()
CRITICAL_MODULES = {"settings", "roles_permissions", "system_settings", "users"}
RESERVED_ROLES = {"super_admin", "admin", "candidate"}


def _normalize_key(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _normalize_permission_key(value: Optional[str]) -> str:
    return _normalize_key(value).replace(" ", "_")


def _parse_datetime(value: Optional[str], field_name: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except Exception:
        raise HTTPException(400, detail=f"Invalid {field_name}. Use ISO datetime format.")


def _is_critical_permission(permission: models.Permission) -> bool:
    return (
        permission.module_name in CRITICAL_MODULES
        or permission.role_name in RESERVED_ROLES
    )


def _serialize_permission(permission: models.Permission) -> Dict[str, Any]:
    is_locked = permission.id in LOCKED_PERMISSION_IDS
    is_critical = _is_critical_permission(permission)
    updated_at = getattr(permission, "updated_at", None) or permission.created_at
    return {
        "id": permission.id,
        "role_name": permission.role_name,
        "module_name": permission.module_name,
        "action_name": permission.action_name,
        "created_at": permission.created_at,
        "updated_at": updated_at,
        "assigned_by": "system",
        "status": "locked" if is_locked else "active",
        "is_locked": is_locked,
        "is_critical": is_critical,
    }


def _permission_state(permission: models.Permission) -> Dict[str, Any]:
    return {
        "id": permission.id,
        "role_name": permission.role_name,
        "module_name": permission.module_name,
        "action_name": permission.action_name,
        "created_at": permission.created_at.isoformat() if permission.created_at else None,
        "status": "locked" if permission.id in LOCKED_PERMISSION_IDS else "active",
        "is_critical": _is_critical_permission(permission),
    }


def _audit_permissions_event(
    *,
    actor: dict,
    action: str,
    description: str,
    severity: str = "INFO",
    entity_id: Optional[str] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
) -> None:
    final_severity = map_audit_severity(
        action=action,
        action_label=description,
        status="success",
        explicit=severity,
    )
    log_audit(
        actor=actor,
        action=action,
        action_label=description,
        module="permissions_matrix",
        entity_type="permission",
        entity_id=entity_id,
        entity_name=entity_id,
        status="success",
        description=description,
        old_value=old_values,
        new_value=new_values,
        old_values=old_values,
        new_values=new_values,
        severity=final_severity,
    )


def _apply_permission_filters(
    query,
    *,
    search: Optional[str] = None,
    role_name: Optional[str] = None,
    module_name: Optional[str] = None,
    action_name: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Permission.role_name.ilike(needle),
                models.Permission.module_name.ilike(needle),
                models.Permission.action_name.ilike(needle),
            )
        )

    if role_name:
        query = query.filter(models.Permission.role_name == role_name.strip())
    if module_name:
        query = query.filter(models.Permission.module_name == module_name.strip())
    if action_name:
        query = query.filter(models.Permission.action_name == action_name.strip())

    if status:
        status_value = status.strip().lower()
        if status_value == "locked":
            if LOCKED_PERMISSION_IDS:
                query = query.filter(models.Permission.id.in_(LOCKED_PERMISSION_IDS))
            else:
                query = query.filter(models.Permission.id == "__none__")
        elif status_value == "active":
            if LOCKED_PERMISSION_IDS:
                query = query.filter(~models.Permission.id.in_(LOCKED_PERMISSION_IDS))
        elif status_value != "all":
            raise HTTPException(400, detail="Invalid status. Allowed: active, locked, all")

    dt_from = _parse_datetime(date_from, "date_from")
    dt_to = _parse_datetime(date_to, "date_to")
    if dt_from:
        query = query.filter(models.Permission.created_at >= dt_from)
    if dt_to:
        query = query.filter(models.Permission.created_at <= dt_to)

    return query

def _validate_permission_payload(
    data: schemas.PermissionCreate,
    db: Session,
    current_permission_id: str | None = None,
):
    role_name = _normalize_key(data.role_name)
    module_name = _normalize_permission_key(data.module_name)
    action_name = _normalize_permission_key(data.action_name)

    if not role_name or not module_name or not action_name:
        raise HTTPException(400, detail="role_name, module_name and action_name are required")

    role_exists = (
        db.query(models.Role)
        .filter(func.lower(models.Role.name) == role_name)
        .first()
        is not None
    )
    if not role_exists and role_name not in ROLE_PERMISSIONS:
        raise HTTPException(400, detail=f"Invalid role '{role_name}'")

    # ROLE_PERMISSIONS is used as a default seed, not a hard runtime constraint.
    # Super-admin UI must allow custom module/action additions and edits.

    duplicate_query = db.query(models.Permission).filter(
        models.Permission.role_name == role_name,
        models.Permission.module_name == module_name,
        models.Permission.action_name == action_name
    )

    if current_permission_id:
        duplicate_query = duplicate_query.filter(models.Permission.id != current_permission_id)

    if duplicate_query.first():
        raise HTTPException(400, detail="Permission already exists")

    return role_name, module_name, action_name


# -----------------------------------------------------------
# GET PERMISSIONS MATRIX  (Frontend: Table View)
# -----------------------------------------------------------
@router.get("", response_model=Dict[str, Any])
@require_permission("settings", "view")
def get_permissions_matrix(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    # Load all roles from DB (sorted)
    roles = db.query(models.Role).order_by(models.Role.id).all()
    roles_list = [{"id": r.id, "name": r.name} for r in roles]

    # Load permissions table
    perms = db.query(models.Permission).all()

    # Build matrix: module → action → [roles]
    matrix: Dict[str, Dict[str, List[str]]] = {}

    for p in perms:
        module = p.module_name
        action = p.action_name
        role = p.role_name

        if module not in matrix:
            matrix[module] = {}

        if action not in matrix[module]:
            matrix[module][action] = []

        if role not in matrix[module][action]:
            matrix[module][action].append(role)

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSIONS_MATRIX_VIEWED",
        description="Permissions matrix viewed",
        severity="INFO",
        new_values={"roles_count": len(roles_list), "permissions_total": len(perms)},
    )

    return {
        "roles": roles_list,
        "matrix": matrix,
        "permissions_total": len(perms)
    }


# -----------------------------------------------------------
# LIST ALL PERMISSIONS (admin table)
# -----------------------------------------------------------
@router.get("/list", response_model=Dict[str, Any])
@require_permission("settings", "view")
def list_permissions(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=500),
    search: Optional[str] = Query(default=None),
    role_name: Optional[str] = Query(default=None),
    module_name: Optional[str] = Query(default=None),
    action_name: Optional[str] = Query(default=None),
    status: str = Query(default="all"),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    base_query = db.query(models.Permission)
    filtered = _apply_permission_filters(
        base_query,
        search=search,
        role_name=role_name,
        module_name=module_name,
        action_name=action_name,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )

    sort_map = {
        "role_name": models.Permission.role_name,
        "module_name": models.Permission.module_name,
        "action_name": models.Permission.action_name,
        "created_at": models.Permission.created_at,
    }
    sort_column = sort_map.get(sort_by, models.Permission.created_at)
    order_fn = asc if sort_order.lower() == "asc" else desc

    total = filtered.count()
    total_pages = max(1, (total + limit - 1) // limit) if total else 1
    rows = (
        filtered
        .order_by(order_fn(sort_column), desc(models.Permission.created_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    role_options = [
        r.name for r in db.query(models.Role).order_by(models.Role.name.asc()).all()
    ]
    module_options = [
        m[0] for m in db.query(models.Permission.module_name).distinct().order_by(models.Permission.module_name.asc()).all()
    ]
    action_options = [
        a[0] for a in db.query(models.Permission.action_name).distinct().order_by(models.Permission.action_name.asc()).all()
    ]

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSIONS_LIST_VIEWED",
        description="Permissions list viewed with filters",
        severity="INFO",
        new_values={
            "page": page,
            "limit": limit,
            "total": total,
            "search": search,
            "role_name": role_name,
            "module_name": module_name,
            "action_name": action_name,
            "status": status,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "date_from": date_from,
            "date_to": date_to,
        },
    )

    return {
        "items": [_serialize_permission(row) for row in rows],
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": total_pages,
        "filters": {
            "roles": role_options,
            "modules": module_options,
            "actions": action_options,
        },
    }


@router.get("/roles-summary", response_model=Dict[str, Any])
@require_permission("settings", "view")
def roles_summary(
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    roles = db.query(models.Role).order_by(models.Role.name.asc()).all()
    agg_rows = (
        db.query(
            models.Permission.role_name,
            func.count(models.Permission.id).label("permissions_count"),
            func.max(models.Permission.created_at).label("last_modified"),
        )
        .group_by(models.Permission.role_name)
        .all()
    )
    counts_map = {row.role_name: row for row in agg_rows}
    role_names_from_db = {role.name for role in roles}
    merged_names = sorted(role_names_from_db.union(counts_map.keys()))

    items: List[Dict[str, Any]] = []
    for name in merged_names:
        if search and search.strip().lower() not in name.lower():
            continue
        row = counts_map.get(name)
        items.append(
            {
                "name": name,
                "permissions_count": int(row.permissions_count) if row else 0,
                "last_modified": row.last_modified if row else None,
                "status": "protected" if name in RESERVED_ROLES else "active",
            }
        )

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSIONS_ROLES_SUMMARY_VIEWED",
        description="Permissions role summary viewed",
        severity="INFO",
        new_values={"search": search, "total": len(items)},
    )

    return {
        "items": items,
        "total": len(items),
    }


# -----------------------------------------------------------
# CREATE PERMISSION (with validation)
# -----------------------------------------------------------
@router.post("", response_model=schemas.PermissionResponse, status_code=201)
@require_permission("settings", "update")
def create_permission(
    data: schemas.PermissionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    role_name, module_name, action_name = _validate_permission_payload(data, db)

    # Create
    perm = models.Permission(
        role_name=role_name,
        module_name=module_name,
        action_name=action_name
    )

    db.add(perm)
    db.commit()
    db.refresh(perm)

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSION_CREATED",
        description="Permission created",
        severity="WARNING" if _is_critical_permission(perm) else "INFO",
        entity_id=perm.id,
        new_values=_permission_state(perm),
    )

    return perm


# -----------------------------------------------------------
# BULK DELETE PERMISSIONS
# -----------------------------------------------------------
@router.post("/bulk-delete", response_model=Dict[str, Any])
@require_permission("settings", "update")
def bulk_delete_permissions(
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ids = payload.get("ids") or []
    if not isinstance(ids, list) or not ids:
        raise HTTPException(400, detail="ids must be a non-empty list")

    rows = db.query(models.Permission).filter(models.Permission.id.in_(ids)).all()
    deleted = 0
    skipped_locked: List[str] = []
    for row in rows:
        if row.id in LOCKED_PERMISSION_IDS:
            skipped_locked.append(row.id)
            continue
        db.delete(row)
        deleted += 1

    db.commit()
    _audit_permissions_event(
        actor=current_user,
        action="PERMISSIONS_BULK_DELETED",
        description="Bulk permission delete executed",
        severity="CRITICAL",
        new_values={
            "requested": len(ids),
            "deleted": deleted,
            "deleted_ids": [row.id for row in rows if row.id not in skipped_locked],
            "skipped_locked": skipped_locked,
        },
    )
    return {
        "requested": len(ids),
        "deleted": deleted,
        "skipped_locked": skipped_locked,
    }


@router.post("/bulk-lock", response_model=Dict[str, Any])
@require_permission("settings", "update")
def bulk_lock_permissions(
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    ids = payload.get("ids") or []
    lock = bool(payload.get("lock", True))
    if not isinstance(ids, list) or not ids:
        raise HTTPException(400, detail="ids must be a non-empty list")

    existing_ids = {
        row.id for row in db.query(models.Permission.id).filter(models.Permission.id.in_(ids)).all()
    }
    if lock:
        LOCKED_PERMISSION_IDS.update(existing_ids)
    else:
        LOCKED_PERMISSION_IDS.difference_update(existing_ids)

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSIONS_BULK_LOCK_UPDATED",
        description="Permission lock status updated in bulk",
        severity="WARNING" if lock else "INFO",
        new_values={
            "lock": lock,
            "updated_ids": sorted(existing_ids),
            "locked_total": len(LOCKED_PERMISSION_IDS),
        },
    )

    return {
        "updated": len(existing_ids),
        "locked_total": len(LOCKED_PERMISSION_IDS),
        "lock": lock,
    }


@router.get("/export")
@require_permission("settings", "view")
def export_permissions(
    search: Optional[str] = Query(default=None),
    role_name: Optional[str] = Query(default=None),
    module_name: Optional[str] = Query(default=None),
    action_name: Optional[str] = Query(default=None),
    status: str = Query(default="all"),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = _apply_permission_filters(
        db.query(models.Permission),
        search=search,
        role_name=role_name,
        module_name=module_name,
        action_name=action_name,
        status=status,
        date_from=date_from,
        date_to=date_to,
    ).order_by(desc(models.Permission.created_at))
    rows = query.all()

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["id", "role_name", "module_name", "action_name", "assigned_by", "last_updated", "status"]
    )
    for row in rows:
        serialized = _serialize_permission(row)
        writer.writerow(
            [
                serialized["id"],
                serialized["role_name"],
                serialized["module_name"],
                serialized["action_name"],
                serialized["assigned_by"],
                serialized["updated_at"],
                serialized["status"],
            ]
        )
    buffer.seek(0)

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSIONS_EXPORTED",
        description="Permissions exported to CSV",
        severity="CRITICAL",
        new_values={
            "format": "csv",
            "records": len(rows),
            "search": search,
            "role_name": role_name,
            "module_name": module_name,
            "action_name": action_name,
            "status": status,
            "date_from": date_from,
            "date_to": date_to,
        },
    )

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=permissions_export.csv"},
    )


@router.get("/history/{permission_id}", response_model=Dict[str, Any])
@require_permission("settings", "view")
def get_permission_history(
    permission_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.query(models.Permission).filter(models.Permission.id == permission_id).first()
    if not row:
        raise HTTPException(404, detail="Permission not found")

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSION_HISTORY_VIEWED",
        description="Permission history viewed",
        severity="INFO",
        entity_id=permission_id,
    )

    return {
        "permission_id": permission_id,
        "events": [
            {
                "event": "created",
                "at": row.created_at,
                "by": "system",
                "details": f"{row.role_name} -> {row.module_name}.{row.action_name}",
            }
        ],
    }


# -----------------------------------------------------------
# UPDATE PERMISSION
# -----------------------------------------------------------
@router.put("/{permission_id}", response_model=schemas.PermissionResponse)
@require_permission("settings", "update")
def update_permission(
    permission_id: str,
    data: schemas.PermissionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    perm = db.query(models.Permission).filter(models.Permission.id == permission_id).first()
    if not perm:
        raise HTTPException(404, detail="Permission not found")
    if permission_id in LOCKED_PERMISSION_IDS:
        raise HTTPException(403, detail="Permission is locked and cannot be edited")

    old_state = _permission_state(perm)

    role_name, module_name, action_name = _validate_permission_payload(
        data, db, current_permission_id=permission_id
    )

    perm.role_name = role_name
    perm.module_name = module_name
    perm.action_name = action_name
    db.commit()
    db.refresh(perm)

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSION_UPDATED",
        description="Permission updated",
        severity="WARNING" if _is_critical_permission(perm) else "INFO",
        entity_id=perm.id,
        old_values=old_state,
        new_values=_permission_state(perm),
    )
    return perm


# -----------------------------------------------------------
# DELETE PERMISSION
# -----------------------------------------------------------
@router.delete("/{permission_id}", status_code=204)
@require_permission("settings", "update")
def delete_permission(
    permission_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    perm = db.query(models.Permission).filter(models.Permission.id == permission_id).first()

    if not perm:
        raise HTTPException(404, detail="Permission not found")
    if permission_id in LOCKED_PERMISSION_IDS:
        raise HTTPException(403, detail="Permission is locked and cannot be deleted")

    old_state = _permission_state(perm)

    db.delete(perm)
    db.commit()

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSION_DELETED",
        description="Permission deleted",
        severity="CRITICAL",
        entity_id=permission_id,
        old_values=old_state,
    )

    return


# -----------------------------------------------------------
# RESET MATRIX (Danger – Admin Only)
# -----------------------------------------------------------
@router.post("/reset", status_code=200)
@require_permission("settings", "update")
def reset_permission_matrix(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    total_before = db.query(models.Permission).count()
    db.query(models.Permission).delete()
    db.commit()

    _audit_permissions_event(
        actor=current_user,
        action="PERMISSIONS_MATRIX_RESET",
        description="All permissions cleared from matrix",
        severity="CRITICAL",
        new_values={"deleted_count": total_before},
    )

    return {"message": "All permissions cleared. Re-seed required."}

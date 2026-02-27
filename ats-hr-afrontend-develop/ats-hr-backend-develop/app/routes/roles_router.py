from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from app.permissions import require_permission

router = APIRouter(prefix="/v1/roles", tags=["Roles Management"])

# ----------------------------------------------
# FIXED SYSTEM ROLES
# ----------------------------------------------
SYSTEM_ROLES = [
    "super_admin",
    "admin",
    "recruiter",
    "employee",
    "account_manager",
    "internal_hr",
    "accounts",
    "consultant",
    "consultant_support",
    "candidate",
]

# HIDDEN roles - exist in system but NOT shown in frontend
HIDDEN_ROLES = ["partner"]


# Roles that cannot be deleted or renamed
RESERVED_ROLES = ["super_admin", "admin", "candidate"]


# ----------------------------------------------------------
# GET ALL ROLES (hidden excluded)
# ----------------------------------------------------------
@router.get("")
@require_permission("settings", "view")
def get_roles(
    page: int | None = Query(default=None, ge=1),
    limit: int = Query(default=9, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    roles = db.query(models.Role).all()
    role_map = {}

    # Start with persisted roles.
    for role in roles:
        role_name = str(getattr(role, "name", "") or "").strip().lower()
        if not role_name or role_name in HIDDEN_ROLES:
            continue
        role_map[role_name] = {
            "id": getattr(role, "id", None),
            "name": role_name,
        }

    # Ensure core system roles are always available in dropdowns.
    for role_name in SYSTEM_ROLES:
        normalized = str(role_name or "").strip().lower()
        if not normalized or normalized in HIDDEN_ROLES:
            continue
        if normalized not in role_map:
            role_map[normalized] = {
                "id": None,
                "name": normalized,
            }

    # Include any legacy roles currently used by users but missing in Role table.
    user_role_rows = (
        db.query(models.User.role)
        .filter(models.User.role.isnot(None))
        .distinct()
        .all()
    )
    for (raw_role,) in user_role_rows:
        normalized = str(raw_role or "").strip().lower()
        if not normalized or normalized in HIDDEN_ROLES:
            continue
        if normalized not in role_map:
            role_map[normalized] = {
                "id": None,
                "name": normalized,
            }

    visible_roles = sorted(role_map.values(), key=lambda item: item["name"])

    if page is None:
        return visible_roles

    total_records = len(visible_roles)
    start = (page - 1) * limit
    paged_roles = visible_roles[start:start + limit]
    total_pages = max(1, (total_records + limit - 1) // limit) if total_records else 1

    return {
        "data": paged_roles,
        "roles": paged_roles,
        "currentPage": page,
        "totalPages": total_pages,
        "totalRecords": total_records,
        "total": total_records,
        "limit": limit,
    }


# ----------------------------------------------------------
# CREATE ROLE
# ----------------------------------------------------------
@router.post("", response_model=schemas.RoleResponse)
@require_permission("settings", "update")
def create_role(
    data: schemas.RoleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    name = data.name.lower().strip()

    # prevent creating system or hidden roles
    if name in SYSTEM_ROLES or name in HIDDEN_ROLES:
        raise HTTPException(400, "This role already exists in system defaults")

    # check duplicate
    if db.query(models.Role).filter(models.Role.name == name).first():
        raise HTTPException(400, "Role already exists")

    new_role = models.Role(name=name)
    db.add(new_role)
    db.commit()
    db.refresh(new_role)

    return new_role


# ----------------------------------------------------------
# UPDATE ROLE
# ----------------------------------------------------------
@router.put("/{role_id}", response_model=schemas.RoleResponse)
@require_permission("settings", "update")
def update_role(
    role_id: int,
    data: schemas.RoleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Role not found")

    # reserved roles cannot be renamed
    if role.name in RESERVED_ROLES:
        raise HTTPException(403, "This role cannot be modified")

    new_name = data.name.lower().strip()

    # prevent renaming to another system role
    if new_name in SYSTEM_ROLES and new_name != role.name:
        raise HTTPException(400, "This role name is reserved")

    # prevent duplicate names
    if (
        db.query(models.Role)
        .filter(models.Role.name == new_name, models.Role.id != role_id)
        .first()
    ):
        raise HTTPException(400, "Role with this name already exists")

    role.name = new_name
    db.commit()
    db.refresh(role)

    return role


# ----------------------------------------------------------
# DELETE ROLE
# ----------------------------------------------------------
@router.delete("/{role_id}")
@require_permission("settings", "update")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Role not found")

    # reserved cannot be deleted
    if role.name in RESERVED_ROLES:
        raise HTTPException(403, "This role cannot be deleted")

    db.delete(role)
    db.commit()

    return {"message": "Role deleted successfully"}


# ----------------------------------------------------------
# GET SINGLE ROLE BY ID
# ----------------------------------------------------------
@router.get("/{role_id}", response_model=schemas.RoleResponse)
@require_permission("settings", "view")
def get_single_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Role not found")

    return role


@router.get("/{role_id}/permissions")
@require_permission("settings", "view")
def get_role_permissions_by_id(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Role not found")
    rows = (
        db.query(models.Permission)
        .filter(func.lower(models.Permission.role_name) == func.lower(role.name))
        .all()
    )
    return {
        "role": {"id": role.id, "name": role.name},
        "permissions": [
            {
                "id": row.id,
                "module_name": row.module_name,
                "action_name": row.action_name,
            }
            for row in rows
        ],
    }


@router.put("/{role_id}/permissions")
@require_permission("settings", "update")
def update_role_permissions_by_id(
    role_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not role:
        raise HTTPException(404, "Role not found")

    entries = payload.get("permissions")
    if not isinstance(entries, list):
        raise HTTPException(400, "permissions must be a list")

    db.query(models.Permission).filter(
        func.lower(models.Permission.role_name) == func.lower(role.name)
    ).delete(synchronize_session=False)

    for entry in entries:
        module_name = str(entry.get("module_name") or "").strip().lower()
        action_name = str(entry.get("action_name") or "").strip().lower()
        if not module_name or not action_name:
            continue
        db.add(
            models.Permission(
                role_name=role.name.lower(),
                module_name=module_name,
                action_name=action_name,
            )
        )
    db.commit()
    return {"message": "Role permissions updated"}


@router.post("/seed-defaults")
def seed_default_roles(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    default_roles = [
        "super_admin", "admin", "recruiter", "employee",
        "account_manager", "internal_hr", "accounts",
        "consultant", "consultant_support", "candidate"
    ]

    added = []

    for r in default_roles:
        exists = db.query(models.Role).filter(models.Role.name == r).first()
        if not exists:
            db.add(models.Role(name=r))
            added.append(r)

    db.commit()

    return {"message": "Roles seeded", "added": added}

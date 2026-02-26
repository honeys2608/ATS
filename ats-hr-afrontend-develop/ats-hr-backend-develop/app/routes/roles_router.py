from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
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

    # exclude hidden roles from response
    visible_roles = [r for r in roles if r.name not in HIDDEN_ROLES]

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

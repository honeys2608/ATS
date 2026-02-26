# app/routes/users.py

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List

from app.db import get_db
from app import models, schemas
from app.auth import get_current_user, get_password_hash

# Import only what REALLY exists in permissions.py
from app.permissions import ROLE_PERMISSIONS, get_all_roles_summary, get_user_permissions, MODULE_NAMES
from app.utils.audit_decorator import audit_action
from app.services.audit_service import log_audit, map_audit_severity

from datetime import datetime

router = APIRouter(prefix="/v1/users", tags=["User Management"])


def _normalize_role(value: str) -> str:
    return str(value or "").strip().lower()


def _role_exists_in_db(db: Session, role_name: str) -> bool:
    return (
        db.query(models.Role)
        .filter(models.Role.name == role_name)
        .first()
        is not None
    )


# -----------------------------------------------------------
# 📌 ROLE SUMMARY
# -----------------------------------------------------------
@router.get("/roles/summary")
def get_roles_summary(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):

    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=403, detail="Only administrators can view role information"
        )

    base = get_all_roles_summary()
    db_roles = [r.name for r in db.query(models.Role).all()]
    for role_name in db_roles:
        key = _normalize_role(role_name)
        if key not in base:
            base[key] = {
                "role": key,
                "total_modules": 0,
                "total_permissions": 0,
                "modules": {},
            }
    return base


# -----------------------------------------------------------
# 📌 ROLE PERMISSIONS FOR SPECIFIC ROLE
# -----------------------------------------------------------
@router.get("/roles/{role}/permissions")
def get_role_permissions(role: str, current_user: dict = Depends(get_current_user)):

    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=403, detail="Only administrators can view role permissions"
        )

    role_key = _normalize_role(role)
    if role_key not in ROLE_PERMISSIONS:
        # Keep backward compatibility: custom roles from DB can exist with zero/default permissions.
        return {
            "role": role_key,
            "permissions": {},
            "summary": {
                "role": role_key,
                "total_modules": 0,
                "total_permissions": 0,
                "modules": {},
            },
        }

    return {
        "role": role_key,
        "permissions": get_user_permissions(role_key),
        "summary": get_all_roles_summary().get(role_key, {}),
    }


# -----------------------------------------------------------
# 📌 PERMISSIONS MATRIX
# -----------------------------------------------------------
@router.get("/permissions/matrix")
def get_permissions_matrix(current_user: dict = Depends(get_current_user)):

    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=403, detail="Only administrators can view permissions matrix"
        )

    matrix = {}

    for role, modules in ROLE_PERMISSIONS.items():
        matrix[role] = {}
        for module, actions in modules.items():
            readable = MODULE_NAMES.get(module, module)
            matrix[role][readable] = actions

    return matrix


# -----------------------------------------------------------
# 📌 LIST USERS (ADMIN) — EXISTING ENDPOINT
# -----------------------------------------------------------
@router.get("", response_model=List[schemas.UserResponse])
def list_users(
    role: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "super_admin", "recruiter", "account_manager"]:
        raise HTTPException(403, "Only administrators can view all users")
    
    query = db.query(models.User)
    if role:
        query = query.filter(models.User.role == role)
    
    return query.all()


# -----------------------------------------------------------
# 📌 MISSING API #3 — LIST RECRUITERS FOR FRONTEND
# GET /v1/users?role=recruiter

# -----------------------------------------------------------
# 📌 CREATE USER (ADMIN)
# -----------------------------------------------------------
@router.post("", response_model=schemas.UserResponse, status_code=201)
@audit_action(
    action="User Created",
    module="User Management",
    severity="INFO",
    entity_type="user",
    entity_id_getter=lambda result, args, kwargs: getattr(result, "id", None),
    description_getter=lambda result, args, kwargs: f"User '{getattr(result, 'username', '')}' created",
)
def create_user(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(403, "Only administrators can create users")

    # Duplicate check
    exists = db.query(models.User).filter(
        (models.User.email == user_data.email) |
        (models.User.username == user_data.username)
    ).first()

    if exists:
        raise HTTPException(400, "Username or Email already exists")

    # Validate role: allow both static roles and DB-created roles.
    role_key = _normalize_role(user_data.role)
    if role_key not in ROLE_PERMISSIONS and not _role_exists_in_db(db, role_key):
        raise HTTPException(400, "Invalid role selected")
    if role_key == "super_admin" and current_user["role"] != "super_admin":
        raise HTTPException(403, "Only Super Admin can assign super_admin role")

    hashed_password = get_password_hash(user_data.password or "")

    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        password=hashed_password,
        role=role_key,
        full_name=user_data.full_name,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# -----------------------------------------------------------
# 📌 GET USER
# -----------------------------------------------------------
@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):

    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        raise HTTPException(404, "User not found")

    if current_user["role"] not in ["admin", "super_admin"] and current_user["id"] != user_id:
        raise HTTPException(403, "You can only view your own profile")

    return user


# -----------------------------------------------------------
# 📌 UPDATE USER ROLE (ADMIN)
# -----------------------------------------------------------
@router.put("/{user_id}/role")
def update_user_role(
    user_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(403, "Only administrators can update roles")

    new_role = _normalize_role(payload.get("role"))
    if not new_role:
        raise HTTPException(400, "Role is required")

    if new_role not in ROLE_PERMISSIONS and not _role_exists_in_db(db, new_role):
        raise HTTPException(400, "Invalid role")
    if new_role == "super_admin" and current_user["role"] != "super_admin":
        raise HTTPException(403, "Only Super Admin can assign super_admin role")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    if user.id == current_user["id"]:
        raise HTTPException(400, "You cannot change your own role")

    old = user.role
    user.role = new_role

    db.commit()
    db.refresh(user)
    log_audit(
        actor=current_user,
        action="USER_ROLE_CHANGED",
        action_label="User Role Changed",
        module="Users",
        entity_type="user",
        entity_id=user.id,
        entity_name=user.full_name or user.email or user.username,
        status="success",
        severity=map_audit_severity(action="USER_ROLE_CHANGED", status="success"),
        old_value={"role": old},
        new_value={"role": new_role},
        description=f"Role changed from {old} -> {new_role}",
    )

    return {
        "message": f"Role changed from {old} -> {new_role}",
        "user": user
    }


# -----------------------------------------------------------
# 📌 DELETE USER (ADMIN)
# -----------------------------------------------------------
@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(403, "Only administrators can delete users")

    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        raise HTTPException(404, "User not found")

    if user.id == current_user["id"]:
        raise HTTPException(400, "You cannot delete yourself")

    deleted_snapshot = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "is_active": user.is_active,
    }
    db.delete(user)
    db.commit()
    log_audit(
        actor=current_user,
        action="USER_DELETED",
        action_label="User Deleted",
        module="Users",
        entity_type="user",
        entity_id=user_id,
        entity_name=deleted_snapshot.get("username") or deleted_snapshot.get("email"),
        status="success",
        severity=map_audit_severity(action="USER_DELETED", status="success"),
        old_value=deleted_snapshot,
        new_value=None,
        description=f"User '{deleted_snapshot.get('username')}' deleted",
    )

    return {"message": f"User '{user.username}' deleted successfully"}


@router.put("/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(403, "Only administrators can change user status")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    if user.id == current_user["id"]:
        raise HTTPException(400, "You cannot lock yourself")

    is_active = payload.get("is_active")
    if is_active is None:
        raise HTTPException(400, "is_active is required")

    user.is_active = is_active
    db.commit()
    action = "ACCOUNT_UNLOCKED" if is_active else "ACCOUNT_LOCKED"
    log_audit(
        actor=current_user,
        action=action,
        action_label="Account Unlocked" if is_active else "Account Locked",
        module="Users",
        entity_type="user",
        entity_id=user.id,
        entity_name=user.full_name or user.email or user.username,
        status="success",
        severity=map_audit_severity(action=action, status="success"),
        old_value={"is_active": not is_active},
        new_value={"is_active": is_active},
        description=f"Account {'unlocked' if is_active else 'locked'} by administrator",
    )

    return {
        "message": "User status updated",
        "status": "Active" if is_active else "Locked"
    }

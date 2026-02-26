from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from app.permissions import require_permission, ROLE_PERMISSIONS, get_user_permissions

router = APIRouter(prefix="/v1/permissions", tags=["RBAC Permissions"])


# -----------------------------------------------------------
# GET ALL PERMISSIONS (ADMIN)
# -----------------------------------------------------------
@router.get("", response_model=List[schemas.PermissionResponse])
# @require_permission("settings", "view")
def get_permissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    permissions = db.query(models.Permission).order_by(models.Permission.created_at.desc()).all()
    return permissions


# -----------------------------------------------------------
# CREATE A NEW PERMISSION (ADMIN)
# -----------------------------------------------------------
@router.post("", response_model=schemas.PermissionResponse, status_code=201)
@require_permission("settings", "update")
def create_permission(
    data: schemas.PermissionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    # Validate role exists in the system RBAC config
    if data.role_name not in ROLE_PERMISSIONS:
        raise HTTPException(400, detail=f"Invalid role '{data.role_name}'")

    # Validate module exists in RBAC schema
    if data.module_name not in ROLE_PERMISSIONS[data.role_name]:
        raise HTTPException(400, detail=f"Invalid module '{data.module_name}' for role '{data.role_name}'")

    # Validate action is correct
    valid_actions = ROLE_PERMISSIONS[data.role_name][data.module_name]
    if data.action_name not in valid_actions:
        raise HTTPException(
            400,
            detail=f"Invalid action '{data.action_name}'. Allowed: {valid_actions}"
        )

    # Prevent duplicate permission
    existing = (
        db.query(models.Permission)
        .filter(
            models.Permission.role_name == data.role_name,
            models.Permission.module_name == data.module_name,
            models.Permission.action_name == data.action_name,
        )
        .first()
    )

    if existing:
        raise HTTPException(400, detail="Permission already exists")

    # Create permission
    new_perm = models.Permission(
        role_name=data.role_name,
        module_name=data.module_name,
        action_name=data.action_name,
    )
    db.add(new_perm)
    db.commit()
    db.refresh(new_perm)

    return new_perm


# -----------------------------------------------------------
# DELETE PERMISSION (ADMIN)
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

    db.delete(perm)
    db.commit()

    return

# -----------------------------------------------------------
# GET LOGGED-IN USER PERMISSIONS  🚀 FRONTEND depends on this
# ===========================================
# CURRENT USER PERMISSIONS FOR FRONTEND SIDEBAR
# ===========================================
@router.get("/me", tags=["RBAC Permissions"])
def get_my_permissions(current_user=Depends(get_current_user)):
    role = current_user["role"]

    modules = get_user_permissions(role)
    return {
        "role": role,
        "modules": modules
    }

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.routes import super_admin

router = APIRouter(prefix="/v1/superadmin", tags=["Super Admin"])


@router.get("/users")
def list_users_alias(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    search: str | None = Query(None),
    role: str | None = Query(None),
    status: str | None = Query(None),
    tenant_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return super_admin.list_super_admin_users(
        page=page,
        limit=limit,
        search=search,
        role=role,
        status=status,
        tenant_id=tenant_id,
        db=db,
        current_user=current_user,
    )


@router.post("/users")
def create_user_alias(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return super_admin.create_super_admin_user(payload=payload, db=db, current_user=current_user)


@router.get("/users/{user_id}")
def get_user_alias(
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return super_admin.get_super_admin_user(user_id=user_id, db=db, current_user=current_user)


@router.put("/users/{user_id}")
def update_user_alias(
    user_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return super_admin.update_super_admin_user(user_id=user_id, payload=payload, db=db, current_user=current_user)


@router.patch("/users/{user_id}/status")
def update_status_alias(
    user_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return super_admin.update_super_admin_user_status(user_id=user_id, payload=payload, db=db, current_user=current_user)


@router.post("/users/{user_id}/reset-password")
def reset_password_alias(
    user_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return super_admin.reset_super_admin_user_password(user_id=user_id, payload=payload, db=db, current_user=current_user)


@router.post("/users/{user_id}/force-logout")
def force_logout_alias(
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return super_admin.force_logout_super_admin_user(user_id=user_id, db=db, current_user=current_user)

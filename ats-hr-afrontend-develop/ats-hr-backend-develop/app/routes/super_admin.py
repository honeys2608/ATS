from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app import models, schemas
from app.auth import get_current_user, get_password_hash
from app.db import get_db
from app.permissions import require_permission
from app.services.audit_service import log_audit, map_audit_severity
from app.utils.user_agent import parse_user_agent
from app.utils.user_management_validation import (
    generate_temp_password,
    normalize_email,
    validate_email_address,
    validate_first_name,
    validate_password_strength,
)

router = APIRouter(prefix="/v1/super-admin", tags=["Super Admin"])


def require_super_admin(current_user: dict):
    role = (current_user.get("role") or "").lower()
    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")


USER_STATUSES = {"active", "inactive", "suspended", "locked", "pending"}


def _normalize_user_status(value: str | None) -> str:
    status = str(value or "").strip().lower()
    return status if status in USER_STATUSES else "active"


def _display_name(user: models.User) -> str:
    return (
        str(getattr(user, "full_name", "") or "").strip()
        or " ".join(
            [
                str(getattr(user, "first_name", "") or "").strip(),
                str(getattr(user, "last_name", "") or "").strip(),
            ]
        ).strip()
        or str(getattr(user, "email", "") or "").strip()
        or str(getattr(user, "username", "") or "").strip()
    )


def _serialize_user_row(user: models.User, tenant_name_map: dict[str, str]) -> dict:
    role_value = str(getattr(user, "role", "") or "").strip().lower()
    return {
        "id": user.id,
        "first_name": getattr(user, "first_name", None),
        "last_name": getattr(user, "last_name", None),
        "full_name": _display_name(user),
        "email": normalize_email(user.email),
        "phone": getattr(user, "phone", None),
        "status": _normalize_user_status(getattr(user, "status", None)),
        "role_id": getattr(user, "role_id", None),
        "role": role_value,
        "tenant_id": getattr(user, "tenant_id", None) or getattr(user, "client_id", None),
        "tenant_name": tenant_name_map.get((getattr(user, "tenant_id", None) or getattr(user, "client_id", None) or "")),
        "failed_login_attempts": getattr(user, "failed_login_attempts", 0) or 0,
        "account_locked_until": getattr(user, "account_locked_until", None),
        "last_login_at": getattr(user, "last_login_at", None),
        "created_at": getattr(user, "created_at", None),
        "updated_at": getattr(user, "updated_at", None),
        "created_by": getattr(user, "created_by", None),
        "updated_by": getattr(user, "updated_by", None),
        "is_active": bool(getattr(user, "is_active", False)),
    }


def _resolve_role_fields(db: Session, *, role_id: int | None, role_name: str | None) -> tuple[int | None, str]:
    role_key = str(role_name or "").strip().lower()
    resolved_role_id = role_id
    if resolved_role_id is not None:
        role_row = db.query(models.Role).filter(models.Role.id == resolved_role_id).first()
        if not role_row:
            raise HTTPException(400, "Invalid role selected")
        role_key = str(role_row.name or "").strip().lower()

    if role_key:
        role_row = db.query(models.Role).filter(func.lower(models.Role.name) == role_key).first()
        if role_row:
            resolved_role_id = role_row.id
            role_key = str(role_row.name or "").strip().lower()
    if not role_key:
        raise HTTPException(400, "Role is required")
    if role_key == "super_admin":
        resolved_role_id = (
            db.query(models.Role.id).filter(func.lower(models.Role.name) == "super_admin").scalar()
            or resolved_role_id
        )
    return resolved_role_id, role_key


def _set_status_flags(user: models.User, status: str) -> None:
    normalized = _normalize_user_status(status)
    user.status = normalized
    if normalized == "active":
        user.is_active = True
        user.account_locked_until = None
        user.failed_login_attempts = 0
    elif normalized == "locked":
        user.is_active = True
        user.account_locked_until = datetime.utcnow()
        user.failed_login_attempts = max(int(user.failed_login_attempts or 0), 5)
    else:
        user.is_active = False


@router.get("/users")
@require_permission("users", "view")
def list_super_admin_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    search: str | None = Query(None),
    role: str | None = Query(None),
    status: str | None = Query(None),
    tenant_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    query = db.query(models.User)

    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.User.email.ilike(needle),
                models.User.username.ilike(needle),
                models.User.full_name.ilike(needle),
                models.User.first_name.ilike(needle),
                models.User.last_name.ilike(needle),
            )
        )
    if role:
        query = query.filter(func.lower(models.User.role) == str(role).strip().lower())
    if status:
        query = query.filter(func.lower(models.User.status) == _normalize_user_status(status))
    if tenant_id:
        tid = str(tenant_id).strip()
        query = query.filter(
            or_(models.User.tenant_id == tid, models.User.client_id == tid)
        )

    total = query.count()
    rows = (
        query.order_by(models.User.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    tenant_ids = {
        (getattr(row, "tenant_id", None) or getattr(row, "client_id", None))
        for row in rows
        if (getattr(row, "tenant_id", None) or getattr(row, "client_id", None))
    }
    tenants = db.query(models.Client).filter(models.Client.id.in_(list(tenant_ids))).all() if tenant_ids else []
    tenant_name_map = {
        str(t.id): (t.company_name or t.primary_contact_name or t.id)
        for t in tenants
    }

    summary_query = db.query(models.User)
    total_users = summary_query.count()
    active_users = summary_query.filter(func.lower(models.User.status) == "active").count()
    suspended_locked_users = summary_query.filter(
        func.lower(models.User.status).in_(["suspended", "locked"])
    ).count()

    return {
        "items": [_serialize_user_row(row, tenant_name_map) for row in rows],
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": max(1, (total + limit - 1) // limit) if total else 1,
        "summary": {
            "total_users": total_users,
            "active_users": active_users,
            "suspended_locked_users": suspended_locked_users,
        },
    }


@router.get("/users/{user_id}")
@require_permission("users", "view")
def get_super_admin_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    tenant_name_map = {}
    tenant_key = getattr(user, "tenant_id", None) or getattr(user, "client_id", None)
    if tenant_key:
        tenant = db.query(models.Client).filter(models.Client.id == tenant_key).first()
        if tenant:
            tenant_name_map[tenant.id] = tenant.company_name or tenant.primary_contact_name or tenant.id
    return _serialize_user_row(user, tenant_name_map)


@router.post("/users")
@require_permission("users", "create")
def create_super_admin_user(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)

    first_name = str(payload.get("first_name") or "").strip()
    last_name = str(payload.get("last_name") or "").strip() or None
    phone = str(payload.get("phone") or "").strip() or None
    email = normalize_email(payload.get("email"))
    tenant_id = str(payload.get("tenant_id") or "").strip() or None
    role_id = payload.get("role_id")
    role_name = payload.get("role") or payload.get("role_name")
    status = _normalize_user_status(payload.get("status") or "active")

    ok, msg = validate_first_name(first_name)
    if not ok:
        raise HTTPException(400, msg)
    ok, msg = validate_email_address(email)
    if not ok:
        raise HTTPException(400, msg)

    if db.query(models.User.id).filter(func.lower(models.User.email) == email).first():
        raise HTTPException(400, "Email already exists")

    resolved_role_id, resolved_role = _resolve_role_fields(
        db,
        role_id=(int(role_id) if role_id is not None else None),
        role_name=role_name,
    )

    mode = str(payload.get("password_mode") or "generate").strip().lower()
    password = str(payload.get("password") or "")
    generated_password = None
    if mode == "manual":
        ok, msg = validate_password_strength(password)
        if not ok:
            raise HTTPException(400, msg)
    else:
        generated_password = generate_temp_password()
        password = generated_password

    username = (
        str(payload.get("username") or "").strip()
        or email.split("@", 1)[0]
    )

    user = models.User(
        username=username,
        first_name=first_name,
        last_name=last_name,
        full_name=" ".join([first_name, last_name or ""]).strip(),
        email=email,
        phone=phone,
        role=resolved_role,
        role_id=resolved_role_id,
        tenant_id=tenant_id,
        client_id=tenant_id,
        created_by=current_user.get("id"),
        updated_by=current_user.get("id"),
        must_change_password=True,
        password=get_password_hash(password),
    )
    _set_status_flags(user, status)
    db.add(user)
    db.commit()
    db.refresh(user)

    sev = map_audit_severity(action="USER_CREATED", status="success")
    log_audit(
        actor=current_user,
        action="USER_CREATED",
        action_label="User Created",
        module="users",
        entity_type="user",
        entity_id=user.id,
        entity_name=_display_name(user),
        status="success",
        severity=sev,
        old_value=None,
        new_value={
            "email": user.email,
            "role": user.role,
            "tenant_id": user.tenant_id,
            "status": user.status,
        },
    )

    if tenant_id:
        log_audit(
            actor=current_user,
            action="TENANT_ASSIGNED",
            action_label="Tenant Assigned",
            module="users",
            entity_type="user",
            entity_id=user.id,
            entity_name=_display_name(user),
            status="success",
            severity="CRITICAL",
            old_value=None,
            new_value={"tenant_id": tenant_id},
        )
    if resolved_role:
        log_audit(
            actor=current_user,
            action="ROLE_ASSIGNED",
            action_label="Role Assigned",
            module="users",
            entity_type="user",
            entity_id=user.id,
            entity_name=_display_name(user),
            status="success",
            severity="CRITICAL",
            old_value=None,
            new_value={"role": resolved_role},
        )

    return {
        "message": "User created successfully",
        "user": _serialize_user_row(user, {}),
        "temp_password": generated_password,
    }


@router.put("/users/{user_id}")
@require_permission("users", "update")
def update_super_admin_user(
    user_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    old_state = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id or user.client_id,
        "status": user.status,
    }

    if "first_name" in payload:
        first_name = str(payload.get("first_name") or "").strip()
        ok, msg = validate_first_name(first_name)
        if not ok:
            raise HTTPException(400, msg)
        user.first_name = first_name
    if "last_name" in payload:
        user.last_name = str(payload.get("last_name") or "").strip() or None
    if "phone" in payload:
        user.phone = str(payload.get("phone") or "").strip() or None
    if "email" in payload:
        email = normalize_email(payload.get("email"))
        ok, msg = validate_email_address(email)
        if not ok:
            raise HTTPException(400, msg)
        existing = db.query(models.User).filter(func.lower(models.User.email) == email, models.User.id != user_id).first()
        if existing:
            raise HTTPException(400, "Email already exists")
        user.email = email
    if "tenant_id" in payload:
        tenant_id = str(payload.get("tenant_id") or "").strip() or None
        user.tenant_id = tenant_id
        user.client_id = tenant_id
    if "status" in payload:
        _set_status_flags(user, payload.get("status"))
    if "role" in payload or "role_name" in payload or "role_id" in payload:
        resolved_role_id, resolved_role = _resolve_role_fields(
            db,
            role_id=(int(payload.get("role_id")) if payload.get("role_id") is not None else None),
            role_name=payload.get("role") or payload.get("role_name"),
        )
        user.role_id = resolved_role_id
        user.role = resolved_role
        user.session_invalid_after = datetime.utcnow()

    user.full_name = " ".join([str(user.first_name or "").strip(), str(user.last_name or "").strip()]).strip() or user.full_name
    user.updated_by = current_user.get("id")
    db.add(user)
    db.commit()
    db.refresh(user)

    new_state = {
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id or user.client_id,
        "status": user.status,
    }
    log_audit(
        actor=current_user,
        action="USER_UPDATED",
        action_label="User Updated",
        module="users",
        entity_type="user",
        entity_id=user.id,
        entity_name=_display_name(user),
        status="success",
        severity=map_audit_severity(action="USER_UPDATED", status="success"),
        old_value=old_state,
        new_value=new_state,
    )
    if old_state.get("role") != new_state.get("role"):
        log_audit(
            actor=current_user,
            action="ROLE_CHANGED",
            action_label="Role Changed",
            module="users",
            entity_type="user",
            entity_id=user.id,
            entity_name=_display_name(user),
            status="success",
            severity="CRITICAL",
            old_value={"role": old_state.get("role")},
            new_value={"role": new_state.get("role")},
        )
    if old_state.get("tenant_id") != new_state.get("tenant_id"):
        log_audit(
            actor=current_user,
            action="TENANT_CHANGED",
            action_label="Tenant Changed",
            module="users",
            entity_type="user",
            entity_id=user.id,
            entity_name=_display_name(user),
            status="success",
            severity="CRITICAL",
            old_value={"tenant_id": old_state.get("tenant_id")},
            new_value={"tenant_id": new_state.get("tenant_id")},
        )

    return {"message": "User updated successfully", "user": _serialize_user_row(user, {})}


@router.patch("/users/{user_id}/status")
@require_permission("users", "update")
def update_super_admin_user_status(
    user_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    old_status = _normalize_user_status(user.status)
    new_status = _normalize_user_status(payload.get("status"))
    if old_status == new_status:
        return {"message": "Status unchanged", "user": _serialize_user_row(user, {})}

    _set_status_flags(user, new_status)
    user.updated_by = current_user.get("id")
    if new_status in {"suspended", "inactive", "locked"}:
        user.session_invalid_after = datetime.utcnow()
    db.add(user)
    db.commit()
    db.refresh(user)

    severity = "CRITICAL" if new_status in {"suspended", "locked"} else "WARNING"
    log_audit(
        actor=current_user,
        action="USER_STATUS_CHANGED",
        action_label="User Status Changed",
        module="users",
        entity_type="user",
        entity_id=user.id,
        entity_name=_display_name(user),
        status="success",
        severity=severity,
        old_value={"status": old_status},
        new_value={"status": new_status},
    )
    return {"message": "Status updated", "user": _serialize_user_row(user, {})}


@router.post("/users/{user_id}/reset-password")
@require_permission("users", "update")
def reset_super_admin_user_password(
    user_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    mode = str(payload.get("mode") or "generate").strip().lower()
    password = str(payload.get("password") or "")
    generated_password = None
    if mode == "manual":
        ok, msg = validate_password_strength(password)
        if not ok:
            raise HTTPException(400, msg)
    else:
        generated_password = generate_temp_password()
        password = generated_password

    user.password = get_password_hash(password)
    user.must_change_password = True
    user.session_invalid_after = datetime.utcnow()
    user.updated_by = current_user.get("id")
    db.add(user)
    db.commit()

    log_audit(
        actor=current_user,
        action="PASSWORD_RESET_TRIGGERED",
        action_label="Password Reset Triggered",
        module="users",
        entity_type="user",
        entity_id=user.id,
        entity_name=_display_name(user),
        status="success",
        severity="WARNING",
        old_value=None,
        new_value={"must_change_password": True},
    )
    return {"message": "Password reset successful", "temp_password": generated_password}


@router.post("/users/{user_id}/force-logout")
@require_permission("users", "update")
def force_logout_super_admin_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    user.session_invalid_after = datetime.utcnow()
    user.updated_by = current_user.get("id")
    db.add(user)
    db.commit()
    log_audit(
        actor=current_user,
        action="USER_FORCE_LOGOUT",
        action_label="User Force Logout",
        module="users",
        entity_type="user",
        entity_id=user.id,
        entity_name=_display_name(user),
        status="success",
        severity="WARNING",
        old_value=None,
        new_value={"session_invalid_after": user.session_invalid_after.isoformat()},
    )
    return {"message": "User sessions invalidated"}


@router.post("/audit-logs")
@require_permission("audit_logs", "view")
def create_audit_log_event(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    action = str(payload.get("action_type") or payload.get("action") or "AUDIT_EVENT").strip().upper()
    status = str(payload.get("status") or "success").strip().lower()
    module = str(payload.get("module") or "audit_logs").strip() or "audit_logs"
    label = str(payload.get("action_label") or action.replace("_", " ").title()).strip()
    severity = map_audit_severity(
        action=action,
        action_label=label,
        status=status,
        explicit=payload.get("severity"),
    )

    log_audit(
        actor=current_user,
        action=action,
        action_label=label,
        module=module,
        entity_type=payload.get("entity_type"),
        entity_id=payload.get("entity_id"),
        entity_name=payload.get("entity_name"),
        status=status,
        severity=severity,
        failure_reason=payload.get("failure_reason"),
        old_value=payload.get("old_value") or payload.get("old_values"),
        new_value=payload.get("new_value") or payload.get("new_values"),
    )
    return {"ok": True}

@router.get("/dashboard", response_model=schemas.SuperAdminDashboardResponse)
@require_permission("super_admin_dashboard", "view")
def super_admin_dashboard(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_super_admin(current_user)

    active_clients = (
        db.query(models.User)
        .filter(models.User.role == "client", models.User.is_active == True)
        .count()
    )
    active_jobs = (
        db.query(models.Job)
        .filter(models.Job.status == "active")
        .count()
    )
    recruiter_count = (
        db.query(models.User)
        .filter(models.User.role == "recruiter", models.User.is_active == True)
        .count()
    )
    total_applications = db.query(models.JobApplication).count()
    recruiter_productivity = (
        float(total_applications) / recruiter_count if recruiter_count else 0.0
    )

    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    revenue_mtd = (
        db.query(models.Invoice)
        .filter(models.Invoice.created_at >= month_start)
        .with_entities(models.Invoice.amount)
        .all()
    )
    revenue_mtd = float(sum([row[0] or 0 for row in revenue_mtd]))

    sla_breaches = 0
    system_warnings = 0

    return schemas.SuperAdminDashboardResponse(
        active_clients=active_clients,
        active_jobs=active_jobs,
        recruiter_productivity=round(recruiter_productivity, 2),
        revenue_mtd=round(revenue_mtd, 2),
        sla_breaches=sla_breaches,
        system_warnings=system_warnings,
    )


@router.get("/clients", response_model=list[schemas.SuperAdminClientSummary])
@require_permission("clients_tenants", "view")
def list_clients(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_super_admin(current_user)
    clients = db.query(models.User).filter(models.User.role == "client").all()
    results = []
    for c in clients:
        active_jobs = (
            db.query(models.Job)
            .filter(models.Job.client_id == c.id, models.Job.status == "active")
            .count()
        )
        results.append(
            schemas.SuperAdminClientSummary(
                id=c.id,
                name=c.company_name or c.full_name or c.username,
                email=c.email,
                status="Active" if c.is_active else "Suspended",
                account_manager_id=c.account_manager_id,
                active_jobs=active_jobs,
                subscription_plan=None,
                usage_percent=None,
            )
        )
    return results


@router.get("/tenants")
@require_permission("clients_tenants", "view")
def list_tenants_alias(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    tenants = db.query(models.Client).order_by(models.Client.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "name": t.company_name or t.primary_contact_name or t.id,
            "email": t.primary_contact_email,
            "is_active": t.is_active,
        }
        for t in tenants
    ]


@router.put("/clients/{client_id}/status")
@require_permission("clients_tenants", "update")
def update_client_status(
    client_id: str,
    payload: schemas.SuperAdminStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    client = (
        db.query(models.User)
        .filter(models.User.id == client_id, models.User.role == "client")
        .first()
    )
    if not client:
        raise HTTPException(404, "Client not found")
    old_state = "Active" if client.is_active else "Suspended"
    client.is_active = payload.is_active
    db.add(client)
    log_audit(
        actor=current_user,
        action="CLIENT_STATUS_UPDATED",
        module="Clients & Tenants",
        entity_type="client",
        entity_id=client.id,
        description="Client status updated by super admin",
        old_values={"status": old_state},
        new_values={"status": "Active" if payload.is_active else "Suspended"},
        severity="WARNING" if payload.is_active is False else "INFO",
    )
    db.commit()
    return {"message": "Client status updated"}


@router.get("/admins", response_model=list[schemas.SuperAdminAdminSummary])
@require_permission("admin_management", "view")
def list_admins(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_super_admin(current_user)
    admins = db.query(models.User).filter(models.User.role.in_(["admin", "super_admin"])).all()
    results = []
    for a in admins:
        last_login = (
            db.query(models.LoginLog)
            .filter(models.LoginLog.user_id == a.id)
            .order_by(models.LoginLog.created_at.desc())
            .first()
        )
        if not last_login:
            # Backward-compatibility for environments where login logs were not persisted yet.
            activity_login = (
                db.query(models.ActivityLog.created_at)
                .filter(
                    models.ActivityLog.actor_id == a.id,
                    models.ActivityLog.action.ilike("%login%"),
                )
                .order_by(models.ActivityLog.created_at.desc())
                .first()
            )
            if activity_login:
                class _SyntheticLogin:
                    pass
                temp = _SyntheticLogin()
                temp.created_at = activity_login.created_at
                last_login = temp
        results.append(
            schemas.SuperAdminAdminSummary(
                id=a.id,
                full_name=a.full_name or a.username,
                email=a.email,
                role=a.role,
                scope="Global",
                last_login=last_login.created_at.isoformat() if last_login else None,
                status="Active" if a.is_active else "Suspended",
            )
        )
    return results


@router.post("/admins", response_model=schemas.UserResponse)
@require_permission("admin_management", "create")
def create_admin(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    if payload.role.lower() != "admin":
        raise HTTPException(400, "Only admin role can be created here")
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(400, "Email already exists")
    user = models.User(
        username=payload.username,
        email=payload.email,
        password=get_password_hash(payload.password),
        role="admin",
        full_name=payload.full_name,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_audit(
        actor=current_user,
        action="ADMIN_CREATED",
        module="Admin Management",
        entity_type="user",
        entity_id=user.id,
        description="Admin account created",
        old_values=None,
        new_values={"role": "admin", "email": user.email},
        severity="INFO",
    )
    return user


def _resolve_setting_row(db: Session, key: str):
    return (
        db.query(models.SystemSettings)
        .filter(
            or_(
                models.SystemSettings.config_key == key,
                and_(
                    models.SystemSettings.module_name == key.split(".", 1)[0],
                    models.SystemSettings.setting_key == key.split(".", 1)[1] if "." in key else key,
                ),
            )
        )
        .first()
    )


def _setting_to_dict(row: models.SystemSettings) -> dict:
    full_key = row.config_key or f"{row.module_name}.{row.setting_key}"
    value = row.value_json if row.value_json is not None else row.setting_value
    return {
        "id": row.id,
        "key": full_key,
        "value": None if row.is_secret else value,
        "has_value": bool(value is not None),
        "value_type": row.value_type or "json",
        "category": row.category or (str(full_key).split(".", 1)[0] if full_key else "general"),
        "description": row.description,
        "is_secret": bool(row.is_secret),
        "is_editable": bool(row.is_editable) if row.is_editable is not None else True,
        "updated_by": row.updated_by,
        "updated_at": row.updated_at,
    }


@router.get("/system-settings")
@require_permission("system_settings", "view")
def list_system_settings(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    q = db.query(models.SystemSettings)
    if category:
        q = q.filter(func.lower(func.coalesce(models.SystemSettings.category, "")) == category.strip().lower())
    rows = q.order_by(models.SystemSettings.category.asc(), models.SystemSettings.config_key.asc(), models.SystemSettings.setting_key.asc()).all()
    return {"items": [_setting_to_dict(row) for row in rows]}


@router.put("/system-settings")
@require_permission("system_settings", "update")
def upsert_system_setting(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)

    updates = payload.get("updates")
    if not updates:
        module_name = str(payload.get("module_name") or "").strip()
        setting_key = str(payload.get("setting_key") or "").strip()
        setting_value = payload.get("setting_value")
        if module_name and setting_key:
            updates = [{"key": f"{module_name}.{setting_key}", "value": setting_value, "description": payload.get("description")}]

    if not isinstance(updates, list) or not updates:
        raise HTTPException(400, "updates[] is required")

    changed: list[dict] = []
    for item in updates:
        key = str(item.get("key") or "").strip()
        if not key or "." not in key:
            raise HTTPException(400, f"Invalid key: {key or '<empty>'}")
        module_name, setting_key = key.split(".", 1)
        value = item.get("value")
        value_type = str(item.get("value_type") or ("boolean" if isinstance(value, bool) else "number" if isinstance(value, (int, float)) else "json" if isinstance(value, (dict, list)) else "string")).lower()

        existing = _resolve_setting_row(db, key)
        before = None
        if existing:
            before = existing.value_json if existing.value_json is not None else existing.setting_value
            existing.config_key = key
            existing.value_json = value
            existing.setting_value = value
            existing.value_type = value_type
            existing.category = str(item.get("category") or existing.category or module_name)
            if item.get("description") is not None:
                existing.description = item.get("description")
            existing.is_secret = bool(item.get("is_secret", existing.is_secret))
            existing.is_editable = bool(item.get("is_editable", True if existing.is_editable is None else existing.is_editable))
            existing.module_name = module_name
            existing.setting_key = setting_key
            existing.updated_by = current_user.get("id")
            existing.updated_at = datetime.utcnow()
            row = existing
        else:
            row = models.SystemSettings(
                config_key=key,
                value_json=value,
                value_type=value_type,
                category=str(item.get("category") or module_name),
                module_name=module_name,
                setting_key=setting_key,
                setting_value=value,
                description=item.get("description"),
                is_secret=bool(item.get("is_secret", False)),
                is_editable=bool(item.get("is_editable", True)),
                updated_by=current_user.get("id"),
                updated_at=datetime.utcnow(),
            )
            db.add(row)
        changed.append({"key": key, "before": before, "after": value})

    db.commit()
    for row in changed:
        log_audit(
            actor=current_user,
            action="SYSTEM_SETTINGS_UPDATED",
            module="system_settings",
            entity_type="system_setting",
            entity_id=row["key"],
            description=f"Updated setting {row['key']}",
            old_values={"value": row["before"]},
            new_values={"value": row["after"]},
            severity="CRITICAL" if row["key"].startswith(("auth.", "maintenance.", "rate_limit.")) else "INFO",
        )
    return {"message": "System settings updated", "updated_count": len(changed)}


@router.get("/feature-flags")
@require_permission("feature_flags", "view")
def list_feature_flags(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_super_admin(current_user)
    rows = db.query(models.FeatureFlag).order_by(models.FeatureFlag.public_key.asc(), models.FeatureFlag.flag_key.asc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "key": row.public_key or row.flag_key,
                "enabled": bool(row.enabled),
                "rollout_json": row.rollout_json or {},
                "description": row.description,
                "updated_by": row.updated_by,
                "updated_at": row.updated_at,
            }
            for row in rows
        ]
    }


@router.put("/feature-flags/{key}")
@require_permission("feature_flags", "update")
def update_feature_flag(
    key: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    normalized = key.strip()
    if not normalized:
        raise HTTPException(400, "Feature key is required")
    row = (
        db.query(models.FeatureFlag)
        .filter(or_(models.FeatureFlag.public_key == normalized, models.FeatureFlag.flag_key == normalized))
        .first()
    )
    before = None
    if row:
        before = {"enabled": row.enabled, "rollout_json": row.rollout_json, "description": row.description}
        row.public_key = normalized
        row.flag_key = normalized
        row.enabled = bool(payload.get("enabled", row.enabled))
        row.rollout_json = payload.get("rollout_json", row.rollout_json or {})
        row.description = payload.get("description", row.description)
        row.updated_by = current_user.get("id")
        row.updated_at = datetime.utcnow()
    else:
        row = models.FeatureFlag(
            public_key=normalized,
            flag_key=normalized,
            enabled=bool(payload.get("enabled", False)),
            rollout_json=payload.get("rollout_json", {}),
            description=payload.get("description"),
            updated_by=current_user.get("id"),
            updated_at=datetime.utcnow(),
        )
        db.add(row)

    db.commit()
    log_audit(
        actor=current_user,
        action="FEATURE_FLAG_UPDATED",
        module="system_settings",
        entity_type="feature_flag",
        entity_id=normalized,
        description=f"Feature flag updated: {normalized}",
        old_values=before,
        new_values={"enabled": row.enabled, "rollout_json": row.rollout_json, "description": row.description},
        severity="INFO",
    )
    return {"message": "Feature flag updated"}


@router.put("/feature-flags")
@require_permission("feature_flags", "update")
def upsert_feature_flag_legacy(
    payload: schemas.FeatureFlagUpsert,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return update_feature_flag(payload.key, {"enabled": payload.enabled, "description": payload.description}, db, current_user)


@router.put("/maintenance")
@require_permission("system_settings", "update")
def update_maintenance_settings(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    updates = [
        {"key": "maintenance.enabled", "value": bool(payload.get("enabled", False))},
        {"key": "maintenance.message", "value": payload.get("message") or "Platform is under maintenance. Please try again later."},
    ]
    if payload.get("api_rpm") is not None:
        updates.append({"key": "rate_limit.api_rpm", "value": int(payload.get("api_rpm") or 0)})
    return upsert_system_setting({"updates": updates}, db, current_user)


@router.get("/system-settings/audit")
@require_permission("audit_logs", "view")
def list_system_settings_audit(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    q = (
        db.query(models.AuditLog)
        .filter(func.lower(func.coalesce(models.AuditLog.module, "")) == "system_settings")
        .order_by(models.AuditLog.timestamp.desc())
    )
    total = q.count()
    rows = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [
            {
                "id": row.log_id,
                "actor_id": row.actor_id,
                "actor_name": row.actor_name,
                "action": row.action,
                "module": row.module,
                "before_json": row.old_values,
                "after_json": row.new_values,
                "created_at": row.timestamp,
            }
            for row in rows
        ],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.get("/audit-logs")
@require_permission("audit_logs", "view")
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    action: str | None = Query(None),
    action_type: str | None = Query(None),
    module: str | None = Query(None),
    severity: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    role: str | None = Query(None),
    user_id: str | None = Query(None),
    actor: str | None = Query(None),
    tenant_id: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    include_logins: bool = Query(True),
    include_api_reads: bool = Query(False),
):
    require_super_admin(current_user)
    query = db.query(models.AuditLog)

    action_filter = action_type or action
    actor_filter = user_id or actor

    if action_filter:
        needle = f"%{action_filter.strip()}%"
        query = query.filter(
            or_(
                models.AuditLog.action.ilike(needle),
                models.AuditLog.action_label.ilike(needle),
            )
        )
    if module:
        query = query.filter(models.AuditLog.module.ilike(f"%{module.strip()}%"))
    if severity:
        query = query.filter(models.AuditLog.severity == severity.strip().upper())
    if status:
        query = query.filter(models.AuditLog.status == status.strip().lower())
    if role:
        query = query.filter(models.AuditLog.actor_role.ilike(f"%{role.strip()}%"))
    if actor_filter:
        needle = f"%{actor_filter.strip()}%"
        query = query.filter(
            or_(
                models.AuditLog.actor_id.ilike(needle),
                models.AuditLog.actor_name.ilike(needle),
                models.AuditLog.actor_email.ilike(needle),
            )
        )
    if tenant_id:
        query = query.filter(models.AuditLog.tenant_id == tenant_id.strip())
    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(models.AuditLog.entity_id == entity_id)
    if date_from:
        query = query.filter(models.AuditLog.timestamp >= date_from)
    if date_to:
        query = query.filter(models.AuditLog.timestamp <= date_to)
    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.AuditLog.action.ilike(needle),
                models.AuditLog.action_label.ilike(needle),
                models.AuditLog.module.ilike(needle),
                models.AuditLog.entity_type.ilike(needle),
                models.AuditLog.entity_name.ilike(needle),
                models.AuditLog.actor_name.ilike(needle),
                models.AuditLog.actor_email.ilike(needle),
                models.AuditLog.description.ilike(needle),
            )
        )

    logs = query.order_by(models.AuditLog.timestamp.desc()).all()
    if not include_logins:
        logs = [
            row
            for row in logs
            if "login" not in str(row.action or "").lower()
        ]
    if not include_api_reads:
        logs = [
            row
            for row in logs
            if not (
                str(row.entity_type or "").lower() == "api_request"
                or str(row.action or "").upper().startswith("API_GET_")
                or str(row.description or "").upper().startswith("GET /")
            )
        ]

    # Also include ActivityLog + LoginLog so audit screen represents full system activity.
    activity_query = db.query(models.ActivityLog)
    if action_filter:
        activity_query = activity_query.filter(models.ActivityLog.action.ilike(f"%{action_filter.strip()}%"))
    if module:
        activity_query = activity_query.filter(models.ActivityLog.resource_type.ilike(f"%{module.strip()}%"))
    if actor_filter:
        needle = f"%{actor_filter.strip()}%"
        activity_query = activity_query.filter(
            or_(
                models.ActivityLog.actor_id.ilike(needle),
                models.ActivityLog.actor_name.ilike(needle),
            )
        )
    if role:
        activity_query = activity_query.filter(models.ActivityLog.actor_role.ilike(f"%{role.strip()}%"))
    if tenant_id:
        activity_query = activity_query.filter(models.ActivityLog.client_id == tenant_id.strip())
    if entity_type:
        activity_query = activity_query.filter(models.ActivityLog.resource_type == entity_type)
    if entity_id:
        activity_query = activity_query.filter(models.ActivityLog.resource_id == entity_id)
    if date_from:
        activity_query = activity_query.filter(models.ActivityLog.created_at >= date_from)
    if date_to:
        activity_query = activity_query.filter(models.ActivityLog.created_at <= date_to)
    if severity and severity.strip().upper() not in {"INFO"}:
        activity_rows = []
    else:
        activity_rows = activity_query.order_by(models.ActivityLog.created_at.desc()).all()
    if status:
        status_lower = status.strip().lower()
        if status_lower == "failed":
            activity_rows = []
    if not include_logins:
        activity_rows = [
            row
            for row in activity_rows
            if "login" not in str(row.action or "").lower()
        ]

    login_query = db.query(models.LoginLog)
    if action_filter:
        act = action_filter.strip().lower()
        if "login" in act:
            pass
        else:
            login_query = login_query.filter(models.LoginLog.id == "__none__")
    if actor_filter:
        needle = f"%{actor_filter.strip()}%"
        login_query = login_query.filter(
            or_(
                models.LoginLog.user_id.ilike(needle),
                models.LoginLog.username.ilike(needle),
                models.LoginLog.email.ilike(needle),
            )
        )
    if role:
        login_query = login_query.outerjoin(models.User, models.User.id == models.LoginLog.user_id).filter(
            models.User.role.ilike(f"%{role.strip()}%")
        )
    if entity_id:
        login_query = login_query.filter(models.LoginLog.user_id == entity_id)
    if date_from:
        login_query = login_query.filter(models.LoginLog.created_at >= date_from)
    if date_to:
        login_query = login_query.filter(models.LoginLog.created_at <= date_to)
    if severity:
        sev = severity.strip().upper()
        if sev == "INFO":
            login_query = login_query.filter(models.LoginLog.status == "success")
        elif sev == "WARNING":
            login_query = login_query.filter(models.LoginLog.status != "success")
        elif sev == "CRITICAL":
            login_query = login_query.filter(models.LoginLog.id == "__none__")
    if entity_type and entity_type not in {"user", "login"}:
        login_query = login_query.filter(models.LoginLog.id == "__none__")
    if status:
        login_query = login_query.filter(models.LoginLog.status == status.strip().lower())

    login_rows = login_query.order_by(models.LoginLog.created_at.desc()).all()
    if not include_logins:
        login_rows = []

    user_ids = {
        log.actor_id or log.user_id
        for log in logs
        if (log.actor_id or log.user_id)
    }
    user_ids.update({row.actor_id for row in activity_rows if row.actor_id})
    user_ids.update({row.user_id for row in login_rows if row.user_id})
    users = {}
    if user_ids:
        users = {
            user.id: user
            for user in db.query(models.User).filter(models.User.id.in_(list(user_ids))).all()
        }

    candidate_ids = {log.entity_id for log in logs if log.entity_type == "candidate" and log.entity_id}
    job_ids = {log.entity_id for log in logs if log.entity_type == "job" and log.entity_id}
    requirement_ids = {log.entity_id for log in logs if log.entity_type == "requirement" and log.entity_id}
    submission_ids = {log.entity_id for log in logs if log.entity_type == "submission" and log.entity_id}
    invoice_ids = {log.entity_id for log in logs if log.entity_type == "invoice" and log.entity_id}

    candidates = {}
    jobs = {}
    requirements = {}
    submissions = {}
    invoices = {}

    if candidate_ids:
        candidates = {
            c.id: c
            for c in db.query(models.Candidate).filter(models.Candidate.id.in_(list(candidate_ids))).all()
        }
    if job_ids:
        jobs = {
            j.id: j
            for j in db.query(models.Job).filter(models.Job.id.in_(list(job_ids))).all()
        }
    if requirement_ids:
        requirements = {
            r.id: r
            for r in db.query(models.Requirement).filter(models.Requirement.id.in_(list(requirement_ids))).all()
        }
    if submission_ids:
        submissions = {
            s.id: s
            for s in db.query(models.CandidateSubmission).filter(models.CandidateSubmission.id.in_(list(submission_ids))).all()
        }
    if invoice_ids:
        invoices = {
            i.id: i
            for i in db.query(models.Invoice).filter(models.Invoice.id.in_(list(invoice_ids))).all()
        }

    def _entity_label(log):
        entity_type = (log.entity_type or "").lower()
        entity_id = log.entity_id
        if entity_type == "candidate":
            candidate = candidates.get(entity_id)
            if candidate:
                return candidate.full_name or candidate.public_id or entity_id
        if entity_type == "job":
            job = jobs.get(entity_id)
            if job:
                return job.title or job.job_id or entity_id
        if entity_type == "requirement":
            requirement = requirements.get(entity_id)
            if requirement:
                return requirement.title or requirement.requirement_code or entity_id
        if entity_type == "submission":
            submission = submissions.get(entity_id)
            if submission:
                candidate = candidates.get(submission.candidate_id)
                return candidate.full_name if candidate and candidate.full_name else f"Submission {entity_id}"
            return f"Submission {entity_id}"
        if entity_type == "invoice":
            invoice = invoices.get(entity_id)
            if invoice:
                return invoice.invoice_number or entity_id
        if entity_type == "user":
            user = users.get(entity_id)
            if user:
                return user.full_name or user.email or user.username or entity_id
        return entity_id

    payload = []
    for log in logs:
        actor = users.get(log.actor_id or log.user_id)
        actor_name = None
        if actor:
            actor_name = actor.full_name or actor.email or actor.username
        ua_parts = parse_user_agent(log.user_agent)
        payload.append(
            {
                "id": log.id,
                "log_id": log.log_id or log.id,
                "timestamp": log.timestamp,
                "created_at": log.created_at or log.timestamp,
                "actor_id": log.actor_id or log.user_id,
                "user_id": log.actor_id or log.user_id,
                "actor_name": log.actor_name or actor_name,
                "actor_email": log.actor_email or (actor.email if actor else None),
                "actor_role": log.actor_role or (actor.role if actor else None),
                "tenant_id": log.tenant_id,
                "action": log.action,
                "action_type": log.action,
                "action_label": log.action_label or str(log.action or "").replace("_", " ").title(),
                "module": log.module,
                "status": (log.status or "success").lower(),
                "severity": log.severity,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "entity_name": log.entity_name or _entity_label(log),
                "entity_label": _entity_label(log),
                "description": log.description,
                "failure_reason": log.failure_reason,
                "old_value": log.old_value or log.old_values,
                "new_value": log.new_value or log.new_values,
                "old_values": log.old_values,
                "new_values": log.new_values,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "device": log.device or ua_parts["device"],
                "browser": log.browser or ua_parts["browser"],
                "os": log.os or ua_parts["os"],
                "location": log.location,
                "endpoint": log.endpoint,
                "http_method": log.http_method,
                "response_code": log.response_code,
                "is_system_action": log.is_system_action,
            }
        )

    for row in activity_rows:
        actor = users.get(row.actor_id)
        if tenant_id and (row.client_id or (actor.client_id if actor else None)) != tenant_id:
            continue
        payload.append(
            {
                "id": f"activity:{row.id}",
                "log_id": f"activity:{row.id}",
                "timestamp": row.created_at,
                "created_at": row.created_at,
                "actor_id": row.actor_id,
                "user_id": row.actor_id,
                "actor_email": actor.email if actor else None,
                "actor_role": row.actor_role or (actor.role if actor else None),
                "tenant_id": row.client_id or (actor.client_id if actor else None),
                "actor_name": row.actor_name or (actor.full_name if actor else None) or (actor.username if actor else None),
                "action": row.action,
                "action_type": row.action,
                "action_label": str(row.action or "").replace("_", " ").title(),
                "module": row.resource_type,
                "status": "success",
                "severity": "INFO",
                "entity_type": row.resource_type,
                "entity_id": row.resource_id,
                "entity_name": row.resource_name or row.resource_id,
                "entity_label": row.resource_name or row.resource_id,
                "description": row.note,
                "failure_reason": None,
                "old_value": {"status": row.old_status} if row.old_status else None,
                "new_value": {"status": row.new_status} if row.new_status else None,
                "old_values": {"status": row.old_status} if row.old_status else None,
                "new_values": {"status": row.new_status} if row.new_status else None,
                "ip_address": row.ip_address,
                "user_agent": None,
                "device": None,
                "browser": None,
                "os": None,
                "location": "--",
                "endpoint": None,
                "http_method": None,
                "response_code": None,
                "is_system_action": (row.actor_role or "").lower() == "system",
            }
        )

    for row in login_rows:
        actor = users.get(row.user_id)
        ua_parts = parse_user_agent(row.user_agent)
        if tenant_id and (actor.client_id if actor else None) != tenant_id:
            continue
        payload.append(
            {
                "id": f"login:{row.id}",
                "log_id": f"login:{row.id}",
                "timestamp": row.created_at,
                "created_at": row.created_at,
                "actor_id": row.user_id,
                "user_id": row.user_id,
                "actor_email": row.email or (actor.email if actor else None),
                "actor_role": actor.role if actor else None,
                "tenant_id": actor.client_id if actor else None,
                "actor_name": (actor.full_name if actor else None) or row.username,
                "action": "USER_LOGIN_SUCCESS" if (row.status or "").lower() == "success" else "USER_LOGIN_FAILED",
                "action_type": "USER_LOGIN_SUCCESS" if (row.status or "").lower() == "success" else "USER_LOGIN_FAILED",
                "action_label": "Login Successful" if (row.status or "").lower() == "success" else "Login Failed",
                "module": "authentication",
                "status": "success" if (row.status or "").lower() == "success" else "failed",
                "severity": "INFO" if (row.status or "").lower() == "success" else "WARNING",
                "entity_type": "user",
                "entity_id": row.user_id,
                "entity_name": (actor.full_name if actor else None) or row.username or row.email,
                "entity_label": (actor.full_name if actor else None) or row.username or row.email,
                "description": row.message,
                "failure_reason": row.message if (row.status or "").lower() != "success" else None,
                "old_value": None,
                "new_value": None,
                "old_values": None,
                "new_values": None,
                "ip_address": row.ip_address,
                "user_agent": row.user_agent,
                "device": ua_parts["device"],
                "browser": ua_parts["browser"],
                "os": ua_parts["os"],
                "location": "--",
                "endpoint": "/auth/login",
                "http_method": "POST",
                "response_code": 200 if (row.status or "").lower() == "success" else 401,
                "is_system_action": False,
            }
        )

    payload.sort(key=lambda item: item.get("timestamp") or datetime.min, reverse=True)
    total = len(payload)
    start = (page - 1) * limit
    end = start + limit
    paged_items = payload[start:end]

    return {
        "items": paged_items,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.get("/operations-analytics")
@require_permission("operations_analytics", "view")
def operations_analytics(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_super_admin(current_user)
    total_jobs = db.query(models.Job).count()
    total_applications = db.query(models.JobApplication).count()
    total_interviews = db.query(models.Interview).count()
    return {
        "total_jobs": total_jobs,
        "total_applications": total_applications,
        "total_interviews": total_interviews,
    }


@router.get("/finance/summary")
@require_permission("finance_billing", "view")
def finance_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_super_admin(current_user)
    invoices = db.query(models.Invoice).all()
    total = sum([i.amount or 0 for i in invoices])
    paid = sum([i.amount or 0 for i in invoices if (i.status or "").lower() == "paid"])
    pending = sum([i.amount or 0 for i in invoices if (i.status or "").lower() != "paid"])
    return {
        "total_invoices": len(invoices),
        "total_amount": float(total),
        "paid_amount": float(paid),
        "pending_amount": float(pending),
    }


@router.get("/compliance/summary")
@require_permission("compliance_security", "view")
def compliance_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_super_admin(current_user)
    failed_logins = (
        db.query(models.LoginLog)
        .filter(models.LoginLog.status != "success")
        .count()
    )
    return {
        "failed_logins": failed_logins,
    }

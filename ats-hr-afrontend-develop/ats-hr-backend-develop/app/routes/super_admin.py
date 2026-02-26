from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app import models, schemas
from app.auth import get_current_user, get_password_hash
from app.db import get_db
from app.permissions import require_permission
from app.services.audit_service import log_audit, map_audit_severity

router = APIRouter(prefix="/v1/super-admin", tags=["Super Admin"])


def require_super_admin(current_user: dict):
    role = (current_user.get("role") or "").lower()
    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")


def _parse_ua_summary(user_agent: str | None) -> dict:
    ua = (user_agent or "").lower()
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


@router.get("/system-settings", response_model=list[schemas.SystemSettingUpsert])
@require_permission("system_settings", "view")
def list_system_settings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_super_admin(current_user)
    settings = db.query(models.SystemSettings).all()
    return [
        schemas.SystemSettingUpsert(
            module_name=s.module_name,
            setting_key=s.setting_key,
            setting_value=s.setting_value or {},
            description=s.description,
        )
        for s in settings
    ]


@router.put("/system-settings")
@require_permission("system_settings", "update")
def upsert_system_setting(
    payload: schemas.SystemSettingUpsert,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    existing = (
        db.query(models.SystemSettings)
        .filter(
            models.SystemSettings.module_name == payload.module_name,
            models.SystemSettings.setting_key == payload.setting_key,
        )
        .first()
    )
    old_state = None
    if existing:
        old_state = str(existing.setting_value)
        existing.setting_value = payload.setting_value
        existing.description = payload.description
        existing.updated_by = current_user.get("id")
        existing.updated_at = datetime.utcnow()
        db.add(existing)
        entity_id = existing.id
    else:
        new_setting = models.SystemSettings(
            module_name=payload.module_name,
            setting_key=payload.setting_key,
            setting_value=payload.setting_value,
            description=payload.description,
            updated_by=current_user.get("id"),
            updated_at=datetime.utcnow(),
        )
        db.add(new_setting)
        db.commit()
        db.refresh(new_setting)
        entity_id = new_setting.id
    log_audit(
        actor=current_user,
        action="SYSTEM_SETTING_UPSERT",
        module="System Settings",
        entity_type="system_setting",
        entity_id=entity_id,
        description="System setting upserted",
        old_values={"setting_value": old_state},
        new_values={"setting_value": payload.setting_value},
        severity="INFO",
    )
    db.commit()
    return {"message": "System setting updated"}


@router.get("/feature-flags", response_model=list[schemas.FeatureFlagUpsert])
@require_permission("feature_flags", "view")
def list_feature_flags(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    require_super_admin(current_user)
    flags = db.query(models.FeatureFlag).all()
    return [
        schemas.FeatureFlagUpsert(
            key=f.flag_key,
            enabled=f.enabled,
            description=f.description,
        )
        for f in flags
    ]


@router.put("/feature-flags")
@require_permission("feature_flags", "update")
def upsert_feature_flag(
    payload: schemas.FeatureFlagUpsert,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    existing = (
        db.query(models.FeatureFlag)
        .filter(models.FeatureFlag.flag_key == payload.key)
        .first()
    )
    old_state = None
    if existing:
        old_state = str(existing.enabled)
        existing.enabled = payload.enabled
        existing.description = payload.description
        existing.updated_by = current_user.get("id")
        existing.updated_at = datetime.utcnow()
        db.add(existing)
        entity_id = existing.id
    else:
        new_flag = models.FeatureFlag(
            flag_key=payload.key,
            enabled=payload.enabled,
            description=payload.description,
            updated_by=current_user.get("id"),
            updated_at=datetime.utcnow(),
        )
        db.add(new_flag)
        db.commit()
        db.refresh(new_flag)
        entity_id = new_flag.id
    log_audit(
        actor=current_user,
        action="FEATURE_FLAG_UPSERT",
        module="Feature Flags",
        entity_type="feature_flag",
        entity_id=entity_id,
        description="Feature flag upserted",
        old_values={"enabled": old_state},
        new_values={"enabled": payload.enabled, "flag": payload.key},
        severity="INFO",
    )
    db.commit()
    return {"message": "Feature flag updated"}


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
        ua_parts = _parse_ua_summary(log.user_agent)
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
        ua_parts = _parse_ua_summary(row.user_agent)
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

from datetime import datetime
import os
from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db
from app.permissions import require_permission
from app.services.audit_service import log_audit
from app.models import generate_uuid

router = APIRouter(prefix="/v1/super-admin", tags=["Super Admin Business Setup"])


def require_super_admin(current_user: dict):
    role = str(current_user.get("role") or "").strip().lower()
    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")


def _normalize_scope(scope: str | None) -> str:
    normalized = str(scope or "global").strip().lower()
    return "tenant" if normalized == "tenant" else "global"


def _scope_tenant_id(scope: str, tenant_id: str | None) -> str | None:
    if scope == "tenant":
        tid = str(tenant_id or "").strip()
        if not tid:
            raise HTTPException(400, "tenant_id is required for tenant scope")
        return tid
    return None


def _effective_query(db: Session, model, scope: str, tenant_id: str | None):
    if scope == "tenant":
        scoped_q = db.query(model).filter(model.tenant_id == tenant_id)
        if scoped_q.count() > 0:
            return scoped_q
        return db.query(model).filter(model.tenant_id.is_(None))
    return db.query(model).filter(model.tenant_id.is_(None))


def _apply_search(query, model, search: str | None):
    if not search:
        return query
    needle = f"%{str(search).strip()}%"
    clauses = []
    for attr in ("name", "code", "city", "state", "country", "level"):
        if hasattr(model, attr):
            clauses.append(getattr(model, attr).ilike(needle))
    if clauses:
        query = query.filter(or_(*clauses))
    return query


def _paginate(query, page: int, limit: int):
    total = query.count()
    entity = query.column_descriptions[0]["entity"]
    order_column = getattr(entity, "created_at", None) or getattr(entity, "updated_at")
    rows = query.order_by(order_column.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "items": rows,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


def _serialize_basic(row):
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "name": getattr(row, "name", None),
        "code": getattr(row, "code", None),
        "city": getattr(row, "city", None),
        "state": getattr(row, "state", None),
        "country": getattr(row, "country", None),
        "level": getattr(row, "level", None),
        "is_active": bool(getattr(row, "is_active", True)),
        "created_at": row.created_at,
        "updated_at": getattr(row, "updated_at", None),
    }


def _audit_business_setup(
    current_user: dict,
    *,
    action: str,
    entity_type: str,
    entity_id: str | None,
    entity_name: str | None,
    tenant_id: str | None,
    old_value: dict | None,
    new_value: dict | None,
):
    log_audit(
        actor=current_user,
        action=action,
        action_label=action.replace("_", " ").title(),
        module="business_setup",
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        tenant_id=tenant_id,
        status="success",
        old_value=old_value,
        new_value=new_value,
        severity="CRITICAL" if any(k in action for k in ("WORKFLOW", "ROLE", "TENANT")) else "INFO",
    )


@router.get("/tenants")
@require_permission("business_setup", "view")
def list_business_setup_tenants(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    rows = db.query(models.Client).order_by(models.Client.client_name.asc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "name": row.client_name or row.legal_entity or row.id,
                "status": row.status,
            }
            for row in rows
        ]
    }


@router.get("/business-setup/summary")
@require_permission("business_setup", "view")
def business_setup_summary(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    scoped_tenant_id = _scope_tenant_id(scope, tenant_id)

    def count(model, extra_filter=None):
        q = _effective_query(db, model, scope, scoped_tenant_id)
        if hasattr(model, "is_active"):
            q = q.filter(model.is_active.is_(True))
        if extra_filter is not None:
            q = q.filter(extra_filter)
        return q.count()

    branding_count = 1 if _effective_query(db, models.BrandingSetting, scope, scoped_tenant_id).first() else 0
    portal_count = 1 if _effective_query(db, models.PortalPreference, scope, scoped_tenant_id).first() else 0

    return {
        "departments": count(models.Department),
        "locations": count(models.Location),
        "designations": count(models.Designation),
        "job_templates": count(models.JobTemplate),
        "hiring_stages": count(models.HiringStage),
        "branding": branding_count,
        "portal_preferences": portal_count,
        "candidate_email_templates": count(models.BusinessEmailTemplate, models.BusinessEmailTemplate.category == "candidate"),
        "notification_email_templates": count(models.BusinessEmailTemplate, models.BusinessEmailTemplate.category == "notification"),
        "job_approval_workflows": count(models.ApprovalWorkflow, models.ApprovalWorkflow.type == "job"),
        "offer_approval_workflows": count(models.ApprovalWorkflow, models.ApprovalWorkflow.type == "offer"),
        "integrations": count(models.Integration, models.Integration.status == "connected"),
    }


def _list_org_resource(model, scope, tenant_id, page, limit, search, db):
    q = _effective_query(db, model, scope, tenant_id)
    q = _apply_search(q, model, search)
    result = _paginate(q, page, limit)
    return {
        **result,
        "items": [_serialize_basic(row) for row in result["items"]],
    }


@router.get("/departments")
@require_permission("org_structure", "view")
def list_departments(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    return _list_org_resource(models.Department, scope, _scope_tenant_id(scope, tenant_id), page, limit, search, db)


@router.post("/departments")
@require_permission("org_structure", "manage")
def create_department(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    code = str(payload.get("code") or "").strip() or None

    exists = db.query(models.Department).filter(
        models.Department.tenant_id == tenant_id,
        func.lower(models.Department.name) == name.lower(),
    ).first()
    if exists:
        raise HTTPException(400, "Department already exists")

    row = models.Department(
        tenant_id=tenant_id,
        name=name,
        code=code,
        is_active=bool(payload.get("is_active", True)),
        created_by=current_user.get("id"),
        updated_by=current_user.get("id"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_DEPARTMENT_CREATED",
        entity_type="department",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=None,
        new_value=_serialize_basic(row),
    )
    return {"message": "Department created", "item": _serialize_basic(row)}


@router.put("/departments/{department_id}")
@require_permission("org_structure", "manage")
def update_department(
    department_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not row:
        raise HTTPException(404, "Department not found")
    old_state = _serialize_basic(row)
    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "Name is required")
        row.name = name
    if "code" in payload:
        row.code = str(payload.get("code") or "").strip() or None
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_DEPARTMENT_UPDATED",
        entity_type="department",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_basic(row),
    )
    return {"message": "Department updated", "item": _serialize_basic(row)}


@router.patch("/departments/{department_id}/status")
@require_permission("org_structure", "manage")
def update_department_status(
    department_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not row:
        raise HTTPException(404, "Department not found")
    old_state = _serialize_basic(row)
    row.is_active = bool(payload.get("is_active", True))
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_DEPARTMENT_STATUS_CHANGED",
        entity_type="department",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_basic(row),
    )
    return {"message": "Department status updated", "item": _serialize_basic(row)}
@router.get("/locations")
@require_permission("org_structure", "view")
def list_locations(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    result = _list_org_resource(models.Location, scope, _scope_tenant_id(scope, tenant_id), page, limit, search, db)
    return result


@router.post("/locations")
@require_permission("org_structure", "manage")
def create_location(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    row = models.Location(
        tenant_id=tenant_id,
        name=name,
        city=str(payload.get("city") or "").strip() or None,
        state=str(payload.get("state") or "").strip() or None,
        country=str(payload.get("country") or "").strip() or None,
        is_active=bool(payload.get("is_active", True)),
        created_by=current_user.get("id"),
        updated_by=current_user.get("id"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_LOCATION_CREATED",
        entity_type="location",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=None,
        new_value=_serialize_basic(row),
    )
    return {"message": "Location created", "item": _serialize_basic(row)}


@router.put("/locations/{location_id}")
@require_permission("org_structure", "manage")
def update_location(
    location_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not row:
        raise HTTPException(404, "Location not found")
    old_state = _serialize_basic(row)
    for key in ("name", "city", "state", "country"):
        if key in payload:
            value = str(payload.get(key) or "").strip() or None
            if key == "name" and not value:
                raise HTTPException(400, "Name is required")
            setattr(row, key, value)
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_LOCATION_UPDATED",
        entity_type="location",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_basic(row),
    )
    return {"message": "Location updated", "item": _serialize_basic(row)}


@router.patch("/locations/{location_id}/status")
@require_permission("org_structure", "manage")
def update_location_status(
    location_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not row:
        raise HTTPException(404, "Location not found")
    old_state = _serialize_basic(row)
    row.is_active = bool(payload.get("is_active", True))
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_LOCATION_STATUS_CHANGED",
        entity_type="location",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_basic(row),
    )
    return {"message": "Location status updated", "item": _serialize_basic(row)}


@router.get("/designations")
@require_permission("org_structure", "view")
def list_designations(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    result = _list_org_resource(models.Designation, scope, _scope_tenant_id(scope, tenant_id), page, limit, search, db)
    return result


@router.post("/designations")
@require_permission("org_structure", "manage")
def create_designation(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    row = models.Designation(
        tenant_id=tenant_id,
        name=name,
        level=str(payload.get("level") or "").strip() or None,
        is_active=bool(payload.get("is_active", True)),
        created_by=current_user.get("id"),
        updated_by=current_user.get("id"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_DESIGNATION_CREATED",
        entity_type="designation",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=None,
        new_value=_serialize_basic(row),
    )
    return {"message": "Designation created", "item": _serialize_basic(row)}


@router.put("/designations/{designation_id}")
@require_permission("org_structure", "manage")
def update_designation(
    designation_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.Designation).filter(models.Designation.id == designation_id).first()
    if not row:
        raise HTTPException(404, "Designation not found")
    old_state = _serialize_basic(row)
    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "Name is required")
        row.name = name
    if "level" in payload:
        row.level = str(payload.get("level") or "").strip() or None
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_DESIGNATION_UPDATED",
        entity_type="designation",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_basic(row),
    )
    return {"message": "Designation updated", "item": _serialize_basic(row)}


@router.patch("/designations/{designation_id}/status")
@require_permission("org_structure", "manage")
def update_designation_status(
    designation_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.Designation).filter(models.Designation.id == designation_id).first()
    if not row:
        raise HTTPException(404, "Designation not found")
    old_state = _serialize_basic(row)
    row.is_active = bool(payload.get("is_active", True))
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_DESIGNATION_STATUS_CHANGED",
        entity_type="designation",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_basic(row),
    )
    return {"message": "Designation status updated", "item": _serialize_basic(row)}
def _serialize_job_template(row):
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "name": row.name,
        "json_config": row.json_config or {},
        "is_active": bool(row.is_active),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("/job-templates")
@require_permission("job_settings", "view")
def list_job_templates(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    q = _effective_query(db, models.JobTemplate, scope, _scope_tenant_id(scope, tenant_id))
    if search:
        q = q.filter(models.JobTemplate.name.ilike(f"%{str(search).strip()}%"))
    result = _paginate(q, page, limit)
    return {**result, "items": [_serialize_job_template(row) for row in result["items"]]}


@router.post("/job-templates")
@require_permission("job_settings", "manage")
def create_job_template(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    name = str(payload.get("name") or payload.get("template_name") or "").strip()
    if not name:
        raise HTTPException(400, "Template name is required")
    row = models.JobTemplate(
        tenant_id=tenant_id,
        name=name,
        json_config=payload.get("json_config") or payload,
        is_active=bool(payload.get("is_active", True)),
        created_by=current_user.get("id"),
        updated_by=current_user.get("id"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_JOB_TEMPLATE_CREATED",
        entity_type="job_template",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=None,
        new_value=_serialize_job_template(row),
    )
    return {"message": "Job template created", "item": _serialize_job_template(row)}


@router.put("/job-templates/{template_id}")
@require_permission("job_settings", "manage")
def update_job_template(
    template_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.JobTemplate).filter(models.JobTemplate.id == template_id).first()
    if not row:
        raise HTTPException(404, "Job template not found")
    old_state = _serialize_job_template(row)
    if "name" in payload or "template_name" in payload:
        name = str(payload.get("name") or payload.get("template_name") or "").strip()
        if not name:
            raise HTTPException(400, "Template name is required")
        row.name = name
    if "json_config" in payload:
        row.json_config = payload.get("json_config") or {}
    elif payload:
        row.json_config = payload
    if "is_active" in payload:
        row.is_active = bool(payload.get("is_active"))
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_JOB_TEMPLATE_UPDATED",
        entity_type="job_template",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_job_template(row),
    )
    return {"message": "Job template updated", "item": _serialize_job_template(row)}


@router.post("/job-templates/{template_id}/duplicate")
@require_permission("job_settings", "manage")
def duplicate_job_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.JobTemplate).filter(models.JobTemplate.id == template_id).first()
    if not row:
        raise HTTPException(404, "Job template not found")
    clone = models.JobTemplate(
        tenant_id=row.tenant_id,
        name=f"{row.name} (Copy)",
        json_config=row.json_config or {},
        is_active=row.is_active,
        created_by=current_user.get("id"),
        updated_by=current_user.get("id"),
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_JOB_TEMPLATE_DUPLICATED",
        entity_type="job_template",
        entity_id=clone.id,
        entity_name=clone.name,
        tenant_id=clone.tenant_id,
        old_value=None,
        new_value=_serialize_job_template(clone),
    )
    return {"message": "Job template duplicated", "item": _serialize_job_template(clone)}


@router.patch("/job-templates/{template_id}/status")
@require_permission("job_settings", "manage")
def update_job_template_status(
    template_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.JobTemplate).filter(models.JobTemplate.id == template_id).first()
    if not row:
        raise HTTPException(404, "Job template not found")
    old_state = _serialize_job_template(row)
    row.is_active = bool(payload.get("is_active", True))
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_JOB_TEMPLATE_STATUS_CHANGED",
        entity_type="job_template",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_job_template(row),
    )
    return {"message": "Job template status updated", "item": _serialize_job_template(row)}


def _serialize_hiring_stage(row):
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "name": row.name,
        "stage_type": row.stage_type,
        "sort_order": row.sort_order,
        "required_fields": row.required_fields or [],
        "is_default": bool(row.is_default),
        "is_active": bool(row.is_active),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("/hiring-stages")
@require_permission("job_settings", "view")
def list_hiring_stages(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    rows = _effective_query(db, models.HiringStage, scope, _scope_tenant_id(scope, tenant_id)).order_by(models.HiringStage.sort_order.asc()).all()
    return {"items": [_serialize_hiring_stage(row) for row in rows]}


@router.post("/hiring-stages")
@require_permission("job_settings", "manage")
def create_hiring_stage(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    name = str(payload.get("name") or payload.get("stage_name") or "").strip()
    if not name:
        raise HTTPException(400, "Stage name is required")
    is_default = bool(payload.get("is_default", False))
    if is_default:
        db.query(models.HiringStage).filter(models.HiringStage.tenant_id == tenant_id).update({"is_default": False})
    max_order = db.query(func.max(models.HiringStage.sort_order)).filter(models.HiringStage.tenant_id == tenant_id).scalar() or 0
    row = models.HiringStage(
        tenant_id=tenant_id,
        name=name,
        stage_type=str(payload.get("stage_type") or "screening").strip(),
        sort_order=int(payload.get("sort_order") or (max_order + 1)),
        required_fields=payload.get("required_fields") or [],
        is_default=is_default,
        is_active=bool(payload.get("is_active", True)),
        created_by=current_user.get("id"),
        updated_by=current_user.get("id"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_HIRING_STAGE_CREATED",
        entity_type="hiring_stage",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=None,
        new_value=_serialize_hiring_stage(row),
    )
    return {"message": "Hiring stage created", "item": _serialize_hiring_stage(row)}


@router.put("/hiring-stages/{stage_id}")
@require_permission("job_settings", "manage")
def update_hiring_stage(
    stage_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.HiringStage).filter(models.HiringStage.id == stage_id).first()
    if not row:
        raise HTTPException(404, "Hiring stage not found")
    old_state = _serialize_hiring_stage(row)
    if "name" in payload or "stage_name" in payload:
        name = str(payload.get("name") or payload.get("stage_name") or "").strip()
        if not name:
            raise HTTPException(400, "Stage name is required")
        row.name = name
    if "stage_type" in payload:
        row.stage_type = str(payload.get("stage_type") or "").strip() or row.stage_type
    if "required_fields" in payload:
        row.required_fields = payload.get("required_fields") or []
    if "is_default" in payload and bool(payload.get("is_default")):
        db.query(models.HiringStage).filter(models.HiringStage.tenant_id == row.tenant_id).update({"is_default": False})
        row.is_default = True
    if "is_active" in payload:
        row.is_active = bool(payload.get("is_active"))
    if "sort_order" in payload:
        row.sort_order = int(payload.get("sort_order") or row.sort_order)
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_HIRING_STAGE_UPDATED",
        entity_type="hiring_stage",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_hiring_stage(row),
    )
    return {"message": "Hiring stage updated", "item": _serialize_hiring_stage(row)}


@router.put("/hiring-stages/reorder")
@require_permission("job_settings", "manage")
def reorder_hiring_stages(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    stage_ids = payload.get("stage_ids") or []
    if not isinstance(stage_ids, list) or not stage_ids:
        raise HTTPException(400, "stage_ids is required")
    rows = db.query(models.HiringStage).filter(models.HiringStage.id.in_(stage_ids)).all()
    row_map = {row.id: row for row in rows}
    for index, stage_id in enumerate(stage_ids):
        row = row_map.get(stage_id)
        if row:
            row.sort_order = index + 1
            row.updated_by = current_user.get("id")
            row.updated_at = datetime.utcnow()
            db.add(row)
    db.commit()
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_HIRING_STAGE_REORDERED",
        entity_type="hiring_stage",
        entity_id=None,
        entity_name="Hiring Stages",
        tenant_id=None,
        old_value=None,
        new_value={"stage_ids": stage_ids},
    )
    return {"message": "Hiring stages reordered"}
def _serialize_setting(row):
    if not row:
        return None
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "config_json": row.config_json or {},
        "updated_at": row.updated_at,
    }


def _upsert_single_setting(db, model, tenant_id, config_json, user_id):
    row = db.query(model).filter(model.tenant_id == tenant_id).first()
    if not row and tenant_id is None:
        row = db.query(model).filter(model.tenant_id.is_(None)).first()
    old_state = _serialize_setting(row)
    if not row:
        row = model(tenant_id=tenant_id, config_json=config_json or {}, updated_by=user_id)
    else:
        row.config_json = config_json or {}
        row.updated_by = user_id
        row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, old_state


@router.get("/branding")
@require_permission("company_profile", "view")
def get_branding(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    row = _effective_query(db, models.BrandingSetting, scope, _scope_tenant_id(scope, tenant_id)).first()
    return {"item": _serialize_setting(row)}


@router.put("/branding")
@require_permission("company_profile", "manage")
def upsert_branding(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    row, old_state = _upsert_single_setting(
        db,
        models.BrandingSetting,
        tenant_id,
        payload.get("config_json") or payload,
        current_user.get("id"),
    )
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_BRANDING_UPDATED",
        entity_type="branding",
        entity_id=row.id,
        entity_name="Branding",
        tenant_id=tenant_id,
        old_value=old_state,
        new_value=_serialize_setting(row),
    )
    return {"message": "Branding updated", "item": _serialize_setting(row)}


@router.post("/branding/upload-logo")
@require_permission("company_profile", "manage")
def upload_branding_logo(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    ext = os.path.splitext(str(file.filename or ""))[1].lower()
    if ext not in {".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico"}:
        raise HTTPException(400, "Unsupported file type")
    os.makedirs("uploads/branding", exist_ok=True)
    filename = f"{generate_uuid()}{ext}"
    full_path = os.path.join("uploads", "branding", filename)
    with open(full_path, "wb") as out:
        out.write(file.file.read())
    return {"url": f"/uploads/branding/{filename}"}


@router.get("/portal-preferences")
@require_permission("company_profile", "view")
def get_portal_preferences(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    row = _effective_query(db, models.PortalPreference, scope, _scope_tenant_id(scope, tenant_id)).first()
    return {"item": _serialize_setting(row)}


@router.put("/portal-preferences")
@require_permission("company_profile", "manage")
def upsert_portal_preferences(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    row, old_state = _upsert_single_setting(
        db,
        models.PortalPreference,
        tenant_id,
        payload.get("config_json") or payload,
        current_user.get("id"),
    )
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_PORTAL_PREFERENCES_UPDATED",
        entity_type="portal_preferences",
        entity_id=row.id,
        entity_name="Portal Preferences",
        tenant_id=tenant_id,
        old_value=old_state,
        new_value=_serialize_setting(row),
    )
    return {"message": "Portal preferences updated", "item": _serialize_setting(row)}


def _serialize_email_template(row):
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "category": row.category,
        "key": row.key,
        "subject": row.subject,
        "body_html": row.body_html,
        "is_active": bool(row.is_active),
        "updated_at": row.updated_at,
    }


@router.get("/email-templates")
@require_permission("email_templates", "view")
def list_email_templates(
    category: str | None = Query(None),
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    q = _effective_query(db, models.BusinessEmailTemplate, scope, _scope_tenant_id(scope, tenant_id))
    if category:
        q = q.filter(models.BusinessEmailTemplate.category == str(category).strip().lower())
    rows = q.order_by(models.BusinessEmailTemplate.category.asc(), models.BusinessEmailTemplate.key.asc()).all()
    return {"items": [_serialize_email_template(row) for row in rows]}


@router.post("/email-templates")
@require_permission("email_templates", "manage")
def create_email_template(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    category = str(payload.get("category") or "").strip().lower()
    key = str(payload.get("key") or "").strip().lower()
    subject = str(payload.get("subject") or "").strip()
    body_html = str(payload.get("body_html") or "").strip()
    if not category or not key or not subject or not body_html:
        raise HTTPException(400, "category, key, subject and body_html are required")
    row = models.BusinessEmailTemplate(
        tenant_id=tenant_id,
        category=category,
        key=key,
        subject=subject,
        body_html=body_html,
        is_active=bool(payload.get("is_active", True)),
        updated_by=current_user.get("id"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_EMAIL_TEMPLATE_CREATED",
        entity_type="email_template",
        entity_id=row.id,
        entity_name=f"{row.category}:{row.key}",
        tenant_id=row.tenant_id,
        old_value=None,
        new_value=_serialize_email_template(row),
    )
    return {"message": "Email template created", "item": _serialize_email_template(row)}


@router.put("/email-templates/{template_id}")
@require_permission("email_templates", "manage")
def update_email_template(
    template_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.BusinessEmailTemplate).filter(models.BusinessEmailTemplate.id == template_id).first()
    if not row:
        raise HTTPException(404, "Email template not found")
    old_state = _serialize_email_template(row)
    for key in ("subject", "body_html"):
        if key in payload:
            value = str(payload.get(key) or "").strip()
            if not value:
                raise HTTPException(400, f"{key} is required")
            setattr(row, key, value)
    if "is_active" in payload:
        row.is_active = bool(payload.get("is_active"))
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_EMAIL_TEMPLATE_UPDATED",
        entity_type="email_template",
        entity_id=row.id,
        entity_name=f"{row.category}:{row.key}",
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_email_template(row),
    )
    return {"message": "Email template updated", "item": _serialize_email_template(row)}


@router.post("/email-templates/test-send")
@require_permission("email_templates", "manage")
def test_send_email_template(
    payload: dict = Body(default={}),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    to_email = str(payload.get("to_email") or "").strip()
    if not to_email:
        raise HTTPException(400, "to_email is required")
    return {"message": "Test email request accepted", "to_email": to_email}
def _serialize_workflow(row, steps=None):
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "type": row.type,
        "name": row.name,
        "is_active": bool(row.is_active),
        "condition_json": row.condition_json or {},
        "steps": steps or [],
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("/approval-workflows")
@require_permission("approval_workflows", "view")
def list_approval_workflows(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    workflow_type: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    q = _effective_query(db, models.ApprovalWorkflow, scope, _scope_tenant_id(scope, tenant_id))
    if workflow_type:
        q = q.filter(models.ApprovalWorkflow.type == str(workflow_type).strip().lower())
    rows = q.order_by(models.ApprovalWorkflow.created_at.desc()).all()
    workflow_ids = [row.id for row in rows]
    step_rows = db.query(models.ApprovalStep).filter(models.ApprovalStep.workflow_id.in_(workflow_ids)).all() if workflow_ids else []
    step_map = {}
    for step in step_rows:
        step_map.setdefault(step.workflow_id, [])
        step_map[step.workflow_id].append(
            {
                "id": step.id,
                "step_order": step.step_order,
                "approver_type": step.approver_type,
                "approver_ref": step.approver_ref,
            }
        )
    for key in step_map:
        step_map[key] = sorted(step_map[key], key=lambda item: item["step_order"])
    return {"items": [_serialize_workflow(row, step_map.get(row.id, [])) for row in rows]}


@router.post("/approval-workflows")
@require_permission("approval_workflows", "manage")
def create_approval_workflow(
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    row = models.ApprovalWorkflow(
        tenant_id=tenant_id,
        type=str(payload.get("type") or "job").strip().lower(),
        name=str(payload.get("name") or "").strip() or "Untitled Workflow",
        is_active=bool(payload.get("is_active", True)),
        condition_json=payload.get("condition_json") or {},
        created_by=current_user.get("id"),
        updated_by=current_user.get("id"),
    )
    db.add(row)
    db.flush()
    steps = payload.get("steps") or []
    for index, step in enumerate(steps):
        db.add(
            models.ApprovalStep(
                workflow_id=row.id,
                step_order=int(step.get("step_order") or index + 1),
                approver_type=str(step.get("approver_type") or "role"),
                approver_ref=str(step.get("approver_ref") or ""),
            )
        )
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_APPROVAL_WORKFLOW_CREATED",
        entity_type="approval_workflow",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=None,
        new_value=_serialize_workflow(row, steps),
    )
    return {"message": "Approval workflow created", "item": _serialize_workflow(row, steps)}


@router.put("/approval-workflows/{workflow_id}")
@require_permission("approval_workflows", "manage")
def update_approval_workflow(
    workflow_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    row = db.query(models.ApprovalWorkflow).filter(models.ApprovalWorkflow.id == workflow_id).first()
    if not row:
        raise HTTPException(404, "Approval workflow not found")
    old_state = _serialize_workflow(row)
    for key in ("name", "type"):
        if key in payload:
            value = str(payload.get(key) or "").strip()
            if not value:
                raise HTTPException(400, f"{key} is required")
            setattr(row, key, value.lower() if key == "type" else value)
    if "is_active" in payload:
        row.is_active = bool(payload.get("is_active"))
    if "condition_json" in payload:
        row.condition_json = payload.get("condition_json") or {}
    row.updated_by = current_user.get("id")
    row.updated_at = datetime.utcnow()
    db.add(row)
    db.commit()
    db.refresh(row)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_APPROVAL_WORKFLOW_UPDATED",
        entity_type="approval_workflow",
        entity_id=row.id,
        entity_name=row.name,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_workflow(row),
    )
    return {"message": "Approval workflow updated", "item": _serialize_workflow(row)}


@router.put("/approval-workflows/{workflow_id}/steps")
@require_permission("approval_workflows", "manage")
def upsert_approval_steps(
    workflow_id: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    workflow = db.query(models.ApprovalWorkflow).filter(models.ApprovalWorkflow.id == workflow_id).first()
    if not workflow:
        raise HTTPException(404, "Approval workflow not found")
    steps = payload.get("steps") or []
    db.query(models.ApprovalStep).filter(models.ApprovalStep.workflow_id == workflow_id).delete()
    for index, step in enumerate(steps):
        db.add(
            models.ApprovalStep(
                workflow_id=workflow_id,
                step_order=int(step.get("step_order") or index + 1),
                approver_type=str(step.get("approver_type") or "role"),
                approver_ref=str(step.get("approver_ref") or ""),
            )
        )
    db.commit()
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_APPROVAL_STEPS_UPDATED",
        entity_type="approval_workflow",
        entity_id=workflow_id,
        entity_name=workflow.name,
        tenant_id=workflow.tenant_id,
        old_value=None,
        new_value={"steps": steps},
    )
    return {"message": "Approval steps updated"}


def _serialize_integration(row):
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "provider": row.provider,
        "status": row.status,
        "config_json": row.config_json or {},
        "updated_at": row.updated_at,
    }


@router.get("/integrations")
@require_permission("integrations", "view")
def list_integrations(
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    rows = _effective_query(db, models.Integration, scope, _scope_tenant_id(scope, tenant_id)).order_by(models.Integration.provider.asc()).all()
    return {"items": [_serialize_integration(row) for row in rows]}


def _upsert_integration_status(db: Session, tenant_id: str | None, provider: str, status: str, current_user: dict, config_json: dict | None = None):
    row = db.query(models.Integration).filter(
        models.Integration.tenant_id == tenant_id,
        models.Integration.provider == provider,
    ).first()
    if not row and tenant_id is None:
        row = db.query(models.Integration).filter(models.Integration.tenant_id.is_(None), models.Integration.provider == provider).first()
    old_state = _serialize_integration(row) if row else None
    if not row:
        row = models.Integration(
            tenant_id=tenant_id,
            provider=provider,
            status=status,
            config_json=config_json or {},
            created_by=current_user.get("id"),
            updated_by=current_user.get("id"),
        )
    else:
        row.status = status
        row.config_json = config_json or row.config_json or {}
        row.updated_by=current_user.get("id")
        row.updated_at = datetime.utcnow()
    db.add(row)
    db.flush()
    db.add(
        models.IntegrationLog(
            integration_id=row.id,
            status=status,
            message=f"{provider} marked as {status}",
        )
    )
    db.commit()
    db.refresh(row)
    return row, old_state


@router.post("/integrations/{provider}/connect")
@require_permission("integrations", "manage")
def connect_integration(
    provider: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    provider_key = str(provider or "").strip().lower()
    row, old_state = _upsert_integration_status(db, tenant_id, provider_key, "connected", current_user, payload.get("config_json") or {})
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_INTEGRATION_CONNECTED",
        entity_type="integration",
        entity_id=row.id,
        entity_name=row.provider,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_integration(row),
    )
    return {"message": "Integration connected", "item": _serialize_integration(row)}


@router.post("/integrations/{provider}/disconnect")
@require_permission("integrations", "manage")
def disconnect_integration(
    provider: str,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(payload.get("scope"))
    tenant_id = _scope_tenant_id(scope, payload.get("tenant_id"))
    provider_key = str(provider or "").strip().lower()
    row, old_state = _upsert_integration_status(db, tenant_id, provider_key, "disconnected", current_user)
    _audit_business_setup(
        current_user,
        action="BUSINESS_SETUP_INTEGRATION_DISCONNECTED",
        entity_type="integration",
        entity_id=row.id,
        entity_name=row.provider,
        tenant_id=row.tenant_id,
        old_value=old_state,
        new_value=_serialize_integration(row),
    )
    return {"message": "Integration disconnected", "item": _serialize_integration(row)}


@router.get("/integrations/{provider}/logs")
@require_permission("integrations", "view")
def integration_logs(
    provider: str,
    scope: str = Query("global"),
    tenant_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    require_super_admin(current_user)
    scope = _normalize_scope(scope)
    scoped_tenant_id = _scope_tenant_id(scope, tenant_id)
    integration = _effective_query(db, models.Integration, scope, scoped_tenant_id).filter(models.Integration.provider == str(provider).strip().lower()).first()
    if not integration:
        return {"items": []}
    rows = db.query(models.IntegrationLog).filter(models.IntegrationLog.integration_id == integration.id).order_by(models.IntegrationLog.created_at.desc()).limit(100).all()
    return {
        "items": [
            {
                "id": row.id,
                "integration_id": row.integration_id,
                "status": row.status,
                "message": row.message,
                "created_at": row.created_at,
            }
            for row in rows
        ]
    }

from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db
from app.services.audit_service import log_audit

router = APIRouter(prefix="/v1/super-admin/workflows", tags=["Super Admin Workflows"])


def _must_access(user: Dict[str, Any]) -> None:
    role = str((user or {}).get("role") or "").strip().lower()
    if role != "super_admin":
        raise HTTPException(403, "Super Admin access required")


def _normalize_key(value: str) -> str:
    return str(value or "").strip().lower().replace(" ", "_").replace("-", "_")


def _serialize_workflow(wf: models.Workflow) -> Dict[str, Any]:
    return {
        "id": wf.id,
        "key": wf.key,
        "tenant_id": getattr(wf, "tenant_id", None),
        "name": wf.name,
        "description": wf.description,
        "department": getattr(wf, "department", None),
        "job_type": getattr(wf, "job_type", None),
        "status": getattr(wf, "status", "draft") or "draft",
        "is_active": bool(wf.is_active),
        "is_default": bool(wf.is_default),
        "created_at": wf.created_at,
        "updated_at": wf.updated_at,
    }


def _serialize_version(v: models.WorkflowVersion) -> Dict[str, Any]:
    return {
        "id": v.id,
        "workflow_id": v.workflow_id,
        "version_no": v.version_no,
        "status": v.status,
        "published_at": v.published_at,
        "config_json": v.config_json or {},
        "created_at": v.created_at,
        "updated_at": v.updated_at,
    }


def _serialize_stage(stage: models.WorkflowStage) -> Dict[str, Any]:
    settings = stage.settings_json or {}
    return {
        "id": stage.id,
        "workflow_id": stage.workflow_id,
        "workflow_version_id": getattr(stage, "workflow_version_id", None),
        "stage_key": stage.stage_key,
        "stage_name": stage.stage_name,
        "stage_type": settings.get("stage_type", "CUSTOM"),
        "order_index": stage.order_index,
        "color": stage.color,
        "is_terminal": bool(stage.is_terminal),
        "is_rejection": bool(stage.is_rejection),
        "settings_json": settings,
        "created_at": stage.created_at,
        "updated_at": stage.updated_at,
    }


def _serialize_rule(rule: models.WorkflowRule) -> Dict[str, Any]:
    return {
        "id": rule.id,
        "workflow_version_id": rule.workflow_version_id,
        "name": rule.name,
        "trigger": rule.trigger,
        "condition_json": rule.condition_json or {},
        "action_json": rule.action_json or {},
        "is_active": bool(rule.is_active),
        "created_at": rule.created_at,
        "updated_at": rule.updated_at,
    }


def _latest_version(db: Session, workflow_id: str) -> models.WorkflowVersion | None:
    return (
        db.query(models.WorkflowVersion)
        .filter(models.WorkflowVersion.workflow_id == workflow_id)
        .order_by(models.WorkflowVersion.version_no.desc())
        .first()
    )


def _draft_version(db: Session, workflow_id: str) -> models.WorkflowVersion | None:
    return (
        db.query(models.WorkflowVersion)
        .filter(models.WorkflowVersion.workflow_id == workflow_id, models.WorkflowVersion.status == "draft")
        .order_by(models.WorkflowVersion.version_no.desc())
        .first()
    )


def _published_version(db: Session, workflow_id: str) -> models.WorkflowVersion | None:
    return (
        db.query(models.WorkflowVersion)
        .filter(models.WorkflowVersion.workflow_id == workflow_id, models.WorkflowVersion.status == "published")
        .order_by(models.WorkflowVersion.version_no.desc())
        .first()
    )


def _default_stages():
    return [
        {"stage_key": "applied", "stage_name": "Applied", "stage_type": "APPLIED", "color": "#64748B", "is_terminal": False, "is_rejection": False},
        {"stage_key": "screening", "stage_name": "Screening", "stage_type": "SCREENING", "color": "#2563EB", "is_terminal": False, "is_rejection": False},
        {"stage_key": "interview", "stage_name": "Interview", "stage_type": "INTERVIEW", "color": "#7C3AED", "is_terminal": False, "is_rejection": False},
        {"stage_key": "offer", "stage_name": "Offer", "stage_type": "OFFER", "color": "#0EA5E9", "is_terminal": False, "is_rejection": False},
        {"stage_key": "hired", "stage_name": "Hired", "stage_type": "HIRED", "color": "#16A34A", "is_terminal": True, "is_rejection": False},
        {"stage_key": "rejected", "stage_name": "Rejected", "stage_type": "REJECTED", "color": "#DC2626", "is_terminal": True, "is_rejection": True},
    ]


def _create_version_with_stages(db: Session, workflow: models.Workflow, *, copy_from_version: models.WorkflowVersion | None, created_by: str | None):
    latest = _latest_version(db, workflow.id)
    next_version_no = (latest.version_no if latest else 0) + 1
    version = models.WorkflowVersion(
        workflow_id=workflow.id,
        version_no=next_version_no,
        status="draft",
        created_by=created_by,
        config_json={},
    )
    db.add(version)
    db.flush()

    if copy_from_version:
        source_stages = (
            db.query(models.WorkflowStage)
            .filter(models.WorkflowStage.workflow_version_id == copy_from_version.id)
            .order_by(models.WorkflowStage.order_index.asc())
            .all()
        )
        source_rules = db.query(models.WorkflowRule).filter(models.WorkflowRule.workflow_version_id == copy_from_version.id).all()
        if source_stages:
            for stage in source_stages:
                db.add(
                    models.WorkflowStage(
                        workflow_id=workflow.id,
                        workflow_version_id=version.id,
                        stage_key=stage.stage_key,
                        stage_name=stage.stage_name,
                        order_index=stage.order_index,
                        color=stage.color,
                        settings_json=stage.settings_json or {},
                        is_terminal=bool(stage.is_terminal),
                        is_rejection=bool(stage.is_rejection),
                    )
                )
        if source_rules:
            for rule in source_rules:
                db.add(
                    models.WorkflowRule(
                        workflow_version_id=version.id,
                        name=rule.name,
                        trigger=rule.trigger,
                        condition_json=rule.condition_json or {},
                        action_json=rule.action_json or {},
                        is_active=bool(rule.is_active),
                        created_by=created_by,
                    )
                )
    else:
        for idx, stage in enumerate(_default_stages(), start=1):
                db.add(
                    models.WorkflowStage(
                    workflow_id=workflow.id,
                    workflow_version_id=version.id,
                    stage_key=stage["stage_key"],
                    stage_name=stage["stage_name"],
                    order_index=idx,
                        color=stage["color"],
                        settings_json={"stage_type": stage["stage_type"]},
                        is_terminal=stage["is_terminal"],
                        is_rejection=stage["is_rejection"],
                    )
                )

    db.flush()
    return version


def _audit(current_user, action: str, entity_type: str, entity_id: str | None, new_value=None, old_value=None):
    log_audit(
        actor=current_user,
        action=action,
        action_label=action.replace("_", " ").title(),
        module="workflow_builder",
        entity_type=entity_type,
        entity_id=entity_id,
        status="success",
        severity="INFO",
        old_value=old_value,
        new_value=new_value,
    )


@router.get("")
def list_workflows(
    tenant_id: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    q = db.query(models.Workflow)
    if tenant_id is not None:
        q = q.filter(models.Workflow.tenant_id == (str(tenant_id).strip() or None))
    if status:
        q = q.filter(func.lower(models.Workflow.status) == str(status).strip().lower())

    rows = q.order_by(models.Workflow.updated_at.desc()).all()
    items = []
    for wf in rows:
        latest = _latest_version(db, wf.id)
        item = _serialize_workflow(wf)
        item["latest_version_no"] = latest.version_no if latest else None
        items.append(item)
    return {"items": items, "total": len(items)}


@router.post("")
def create_workflow(
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "name is required")

    key = _normalize_key(payload.get("key") or name)
    if db.query(models.Workflow).filter(func.lower(models.Workflow.key) == key).first():
        raise HTTPException(400, "workflow key already exists")

    tenant_id = str(payload.get("tenant_id") or "").strip() or None
    wf = models.Workflow(
        key=key,
        name=name,
        tenant_id=tenant_id,
        description=str(payload.get("description") or "").strip() or None,
        department=str(payload.get("department") or "").strip() or None,
        job_type=str(payload.get("job_type") or "").strip() or None,
        status="draft",
        is_active=True,
        is_default=False,
        created_by=str((current_user or {}).get("id") or "") or None,
    )
    db.add(wf)
    db.flush()

    created_by = str((current_user or {}).get("id") or "") or None
    version = _create_version_with_stages(db, wf, copy_from_version=None, created_by=created_by)
    db.commit()
    db.refresh(wf)
    db.refresh(version)

    _audit(current_user, "WORKFLOW_CREATED", "workflow", wf.id, new_value={"name": wf.name, "version": version.version_no})
    return {"message": "Workflow created", "item": _serialize_workflow(wf), "version": _serialize_version(version)}


@router.get("/{workflow_id}")
def get_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    wf = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    published = _published_version(db, wf.id)
    draft = _draft_version(db, wf.id)
    return {"item": _serialize_workflow(wf), "published_version": _serialize_version(published) if published else None, "draft_version": _serialize_version(draft) if draft else None}


@router.put("/{workflow_id}")
def update_workflow(
    workflow_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    wf = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")

    old_state = _serialize_workflow(wf)
    for field in ("name", "description", "department", "job_type", "status"):
        if field in payload:
            value = str(payload.get(field) or "").strip() or None
            if field == "name" and not value:
                raise HTTPException(400, "name cannot be empty")
            setattr(wf, field, value if field != "status" else (value or "draft"))

    if payload.get("set_default") is True:
        db.query(models.Workflow).filter(models.Workflow.tenant_id == wf.tenant_id).update({models.Workflow.is_default: False}, synchronize_session=False)
        wf.is_default = True

    if "is_active" in payload:
        wf.is_active = bool(payload.get("is_active"))

    db.commit()
    db.refresh(wf)
    _audit(current_user, "WORKFLOW_UPDATED", "workflow", wf.id, old_value=old_state, new_value=_serialize_workflow(wf))
    return {"message": "Workflow updated", "item": _serialize_workflow(wf)}


@router.post("/{workflow_id}/duplicate")
def duplicate_workflow(
    workflow_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    source = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if not source:
        raise HTTPException(404, "Workflow not found")

    base_name = str(payload.get("name") or f"{source.name} Copy").strip()
    key = _normalize_key(payload.get("key") or base_name)
    if db.query(models.Workflow).filter(func.lower(models.Workflow.key) == key).first():
        key = f"{key}_{int(datetime.utcnow().timestamp())}"

    clone = models.Workflow(
        key=key,
        tenant_id=source.tenant_id,
        name=base_name,
        description=source.description,
        department=source.department,
        job_type=source.job_type,
        status="draft",
        is_active=True,
        is_default=False,
        created_by=str((current_user or {}).get("id") or "") or None,
    )
    db.add(clone)
    db.flush()

    src_version = _latest_version(db, source.id)
    created_by = str((current_user or {}).get("id") or "") or None
    version = _create_version_with_stages(db, clone, copy_from_version=src_version, created_by=created_by)
    db.commit()
    db.refresh(clone)

    _audit(current_user, "WORKFLOW_DUPLICATED", "workflow", clone.id, new_value={"source_workflow_id": source.id})
    return {"message": "Workflow duplicated", "item": _serialize_workflow(clone), "version": _serialize_version(version)}


@router.patch("/{workflow_id}/archive")
def archive_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    wf = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    if wf.is_default:
        raise HTTPException(400, "Default workflow cannot be archived")

    wf.status = "archived"
    wf.is_active = False
    db.query(models.WorkflowVersion).filter(models.WorkflowVersion.workflow_id == wf.id).update({models.WorkflowVersion.status: "archived"}, synchronize_session=False)
    db.commit()
    _audit(current_user, "WORKFLOW_ARCHIVED", "workflow", wf.id)
    return {"message": "Workflow archived"}


@router.get("/{workflow_id}/versions")
def list_versions(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    rows = (
        db.query(models.WorkflowVersion)
        .filter(models.WorkflowVersion.workflow_id == workflow_id)
        .order_by(models.WorkflowVersion.version_no.desc())
        .all()
    )
    return {"items": [_serialize_version(row) for row in rows], "total": len(rows)}


@router.post("/{workflow_id}/versions")
def create_draft_version(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    wf = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    src = _published_version(db, workflow_id) or _latest_version(db, workflow_id)
    version = _create_version_with_stages(db, wf, copy_from_version=src, created_by=str((current_user or {}).get("id") or "") or None)
    db.commit()
    db.refresh(version)
    _audit(current_user, "WORKFLOW_VERSION_CREATED", "workflow_version", version.id, new_value={"workflow_id": workflow_id, "version_no": version.version_no})
    return {"message": "Draft version created", "item": _serialize_version(version)}


@router.post("/workflow-versions/{version_id}/publish")
def publish_version(
    version_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    version = db.query(models.WorkflowVersion).filter(models.WorkflowVersion.id == version_id).first()
    if not version:
        raise HTTPException(404, "Version not found")
    workflow = db.query(models.Workflow).filter(models.Workflow.id == version.workflow_id).first()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    db.query(models.WorkflowVersion).filter(models.WorkflowVersion.workflow_id == workflow.id).filter(models.WorkflowVersion.id != version.id).filter(models.WorkflowVersion.status == "published").update({models.WorkflowVersion.status: "archived"}, synchronize_session=False)
    version.status = "published"
    version.published_at = datetime.utcnow()

    workflow.status = "published"
    workflow.is_active = True
    db.commit()

    _audit(current_user, "WORKFLOW_VERSION_PUBLISHED", "workflow_version", version.id, new_value={"workflow_id": workflow.id, "version_no": version.version_no})
    return {"message": "Version published", "item": _serialize_version(version)}


@router.post("/workflow-versions/{version_id}/rollback")
def rollback_version(
    version_id: str,
    to: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    ref = db.query(models.WorkflowVersion).filter(models.WorkflowVersion.id == version_id).first()
    if not ref:
        raise HTTPException(404, "Version not found")

    target = (
        db.query(models.WorkflowVersion)
        .filter(models.WorkflowVersion.workflow_id == ref.workflow_id, models.WorkflowVersion.version_no == to)
        .first()
    )
    if not target:
        raise HTTPException(404, "Target version not found")

    db.query(models.WorkflowVersion).filter(models.WorkflowVersion.workflow_id == ref.workflow_id).filter(models.WorkflowVersion.status == "published").update({models.WorkflowVersion.status: "archived"}, synchronize_session=False)
    target.status = "published"
    target.published_at = datetime.utcnow()
    db.commit()

    _audit(current_user, "WORKFLOW_VERSION_ROLLBACK", "workflow_version", target.id, new_value={"to_version_no": to})
    return {"message": "Rollback complete", "item": _serialize_version(target)}


@router.get("/workflow-versions/{version_id}/stages")
def list_version_stages(
    version_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    rows = (
        db.query(models.WorkflowStage)
        .filter(models.WorkflowStage.workflow_version_id == version_id)
        .order_by(models.WorkflowStage.order_index.asc())
        .all()
    )
    return {"items": [_serialize_stage(r) for r in rows], "total": len(rows)}


@router.post("/workflow-versions/{version_id}/stages")
def create_stage(
    version_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    version = db.query(models.WorkflowVersion).filter(models.WorkflowVersion.id == version_id).first()
    if not version:
        raise HTTPException(404, "Version not found")

    stage_key = _normalize_key(payload.get("stage_key") or payload.get("stage_name"))
    stage_name = str(payload.get("stage_name") or "").strip()
    if not stage_key or not stage_name:
        raise HTTPException(400, "stage_name is required")

    max_order = (
        db.query(func.max(models.WorkflowStage.order_index))
        .filter(models.WorkflowStage.workflow_version_id == version_id)
        .scalar()
        or 0
    )
    stage = models.WorkflowStage(
        workflow_id=version.workflow_id,
        workflow_version_id=version_id,
        stage_key=stage_key,
        stage_name=stage_name,
        order_index=int(payload.get("order_index") or (max_order + 1)),
        color=str(payload.get("color") or "#6C2BD9"),
        settings_json=payload.get("settings_json") or {"stage_type": str(payload.get("stage_type") or "CUSTOM").upper()},
        is_terminal=bool(payload.get("is_terminal", False)),
        is_rejection=bool(payload.get("is_rejection", False)),
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    _audit(current_user, "WORKFLOW_STAGE_CREATED", "workflow_stage", stage.id, new_value={"version_id": version_id})
    return {"message": "Stage created", "item": _serialize_stage(stage)}


@router.put("/workflow-stages/{stage_id}")
def update_stage(
    stage_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    stage = db.query(models.WorkflowStage).filter(models.WorkflowStage.id == stage_id).first()
    if not stage:
        raise HTTPException(404, "Stage not found")
    old_state = _serialize_stage(stage)

    if "stage_key" in payload:
        stage.stage_key = _normalize_key(payload.get("stage_key"))
    if "stage_name" in payload:
        name = str(payload.get("stage_name") or "").strip()
        if not name:
            raise HTTPException(400, "stage_name cannot be empty")
        stage.stage_name = name
    if "order_index" in payload:
        stage.order_index = int(payload.get("order_index") or stage.order_index)
    if "color" in payload:
        stage.color = str(payload.get("color") or stage.color)
    if "settings_json" in payload:
        stage.settings_json = payload.get("settings_json") or {}
    elif "stage_type" in payload:
        merged = dict(stage.settings_json or {})
        merged["stage_type"] = str(payload.get("stage_type") or "CUSTOM").upper()
        stage.settings_json = merged
    if "is_terminal" in payload:
        stage.is_terminal = bool(payload.get("is_terminal"))
    if "is_rejection" in payload:
        stage.is_rejection = bool(payload.get("is_rejection"))

    db.commit()
    db.refresh(stage)
    _audit(current_user, "WORKFLOW_STAGE_UPDATED", "workflow_stage", stage.id, old_value=old_state, new_value=_serialize_stage(stage))
    return {"message": "Stage updated", "item": _serialize_stage(stage)}


@router.put("/workflow-versions/{version_id}/stages/reorder")
def reorder_stages(
    version_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    ids = payload.get("stage_ids") or []
    if not isinstance(ids, list) or not ids:
        raise HTTPException(400, "stage_ids must be a non-empty list")

    rows = db.query(models.WorkflowStage).filter(models.WorkflowStage.workflow_version_id == version_id).all()
    by_id = {row.id: row for row in rows}
    if set(ids) != set(by_id.keys()):
        raise HTTPException(400, "stage_ids must include all version stages")

    for idx, stage_id in enumerate(ids, start=1):
        by_id[stage_id].order_index = idx
    db.commit()
    _audit(current_user, "WORKFLOW_STAGE_REORDERED", "workflow_version", version_id, new_value={"stage_ids": ids})
    return {"message": "Stage order updated"}


@router.get("/workflow-versions/{version_id}/rules")
def list_rules(
    version_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    rows = db.query(models.WorkflowRule).filter(models.WorkflowRule.workflow_version_id == version_id).order_by(models.WorkflowRule.created_at.desc()).all()
    return {"items": [_serialize_rule(row) for row in rows], "total": len(rows)}


@router.post("/workflow-versions/{version_id}/rules")
def create_rule(
    version_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    if not db.query(models.WorkflowVersion.id).filter(models.WorkflowVersion.id == version_id).first():
        raise HTTPException(404, "Version not found")

    name = str(payload.get("name") or "").strip()
    trigger = str(payload.get("trigger") or "").strip()
    if not name or not trigger:
        raise HTTPException(400, "name and trigger are required")

    rule = models.WorkflowRule(
        workflow_version_id=version_id,
        name=name,
        trigger=trigger,
        condition_json=payload.get("condition_json") or {},
        action_json=payload.get("action_json") or {},
        is_active=bool(payload.get("is_active", True)),
        created_by=str((current_user or {}).get("id") or "") or None,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    _audit(current_user, "WORKFLOW_RULE_CREATED", "workflow_rule", rule.id)
    return {"message": "Rule created", "item": _serialize_rule(rule)}


@router.put("/workflow-rules/{rule_id}")
def update_rule(
    rule_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    rule = db.query(models.WorkflowRule).filter(models.WorkflowRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")

    old_state = _serialize_rule(rule)
    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "name cannot be empty")
        rule.name = name
    if "trigger" in payload:
        trigger = str(payload.get("trigger") or "").strip()
        if not trigger:
            raise HTTPException(400, "trigger cannot be empty")
        rule.trigger = trigger
    if "condition_json" in payload:
        rule.condition_json = payload.get("condition_json") or {}
    if "action_json" in payload:
        rule.action_json = payload.get("action_json") or {}
    if "is_active" in payload:
        rule.is_active = bool(payload.get("is_active"))

    db.commit()
    db.refresh(rule)
    _audit(current_user, "WORKFLOW_RULE_UPDATED", "workflow_rule", rule.id, old_value=old_state, new_value=_serialize_rule(rule))
    return {"message": "Rule updated", "item": _serialize_rule(rule)}


@router.patch("/workflow-rules/{rule_id}/toggle")
def toggle_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    rule = db.query(models.WorkflowRule).filter(models.WorkflowRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    rule.is_active = not bool(rule.is_active)
    db.commit()
    db.refresh(rule)
    _audit(current_user, "WORKFLOW_RULE_TOGGLED", "workflow_rule", rule.id, new_value={"is_active": rule.is_active})
    return {"message": "Rule toggled", "item": _serialize_rule(rule)}


# Compatibility endpoints for existing page paths
@router.get("/{workflow_id}/stages")
def list_stages_compat(workflow_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _must_access(current_user)
    version = _draft_version(db, workflow_id) or _published_version(db, workflow_id) or _latest_version(db, workflow_id)
    if not version:
        return {"items": [], "total": 0}
    return list_version_stages(version.id, db, current_user)


@router.post("/{workflow_id}/stages")
def create_stage_compat(workflow_id: str, payload: Dict[str, Any] = Body(default={}), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _must_access(current_user)
    version = _draft_version(db, workflow_id)
    if not version:
        version = create_draft_version(workflow_id, db, current_user)["item"]
        version_id = version["id"]
    else:
        version_id = version.id
    return create_stage(version_id, payload, db, current_user)


@router.put("/stages/{stage_id}")
def update_stage_compat(stage_id: str, payload: Dict[str, Any] = Body(default={}), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return update_stage(stage_id, payload, db, current_user)


@router.post("/{workflow_id}/stages/reorder")
def reorder_stages_compat(workflow_id: str, payload: Dict[str, Any] = Body(default={}), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _must_access(current_user)
    version = _draft_version(db, workflow_id) or _published_version(db, workflow_id) or _latest_version(db, workflow_id)
    if not version:
        raise HTTPException(404, "No version found")
    return reorder_stages(version.id, payload, db, current_user)

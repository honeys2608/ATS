from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db

router = APIRouter(prefix="/v1/super-admin/workflows", tags=["Super Admin Workflows"])


def _must_access(user: Dict[str, Any]) -> None:
    role = str((user or {}).get("role") or "").strip().lower()
    if role not in {"super_admin", "admin"}:
        raise HTTPException(403, "Super Admin/Admin access required")


def _normalize_key(value: str) -> str:
    return str(value or "").strip().lower().replace(" ", "_").replace("-", "_")


def _serialize_workflow(wf: models.Workflow) -> Dict[str, Any]:
    return {
        "id": wf.id,
        "key": wf.key,
        "name": wf.name,
        "description": wf.description,
        "is_active": bool(wf.is_active),
        "is_default": bool(wf.is_default),
        "created_at": wf.created_at,
        "updated_at": wf.updated_at,
    }


def _serialize_stage(stage: models.WorkflowStage) -> Dict[str, Any]:
    return {
        "id": stage.id,
        "workflow_id": stage.workflow_id,
        "stage_key": stage.stage_key,
        "stage_name": stage.stage_name,
        "order_index": stage.order_index,
        "color": stage.color,
        "is_terminal": bool(stage.is_terminal),
        "is_rejection": bool(stage.is_rejection),
        "created_at": stage.created_at,
        "updated_at": stage.updated_at,
    }


def _ensure_default_workflow(db: Session) -> models.Workflow:
    existing = db.query(models.Workflow).filter(func.lower(models.Workflow.key) == "standard_hiring").first()
    if existing:
        return existing

    wf = models.Workflow(
        key="standard_hiring",
        name="Standard Hiring",
        description="Default hiring workflow",
        is_active=True,
        is_default=True,
    )
    db.add(wf)
    db.commit()
    db.refresh(wf)

    defaults = [
        ("new", "New", "#64748B", False, False),
        ("sent_to_am", "Sent to AM", "#2563EB", False, False),
        ("am_shortlisted", "AM Shortlisted", "#7C3AED", False, False),
        ("sent_to_client", "Sent to Client", "#0EA5E9", False, False),
        ("client_shortlisted", "Client Shortlisted", "#14B8A6", False, False),
        ("interview_scheduled", "Interview Scheduled", "#F59E0B", False, False),
        ("selected", "Selected", "#22C55E", False, False),
        ("hired", "Hired", "#16A34A", True, False),
    ]
    for idx, (k, n, c, terminal, rej) in enumerate(defaults, start=1):
        db.add(
            models.WorkflowStage(
                workflow_id=wf.id,
                stage_key=k,
                stage_name=n,
                order_index=idx,
                color=c,
                is_terminal=terminal,
                is_rejection=rej,
            )
        )
    db.add(models.WorkflowScope(workflow_id=wf.id, scope_type="global", scope_value=None, is_active=True))
    db.commit()
    return wf


@router.get("")
def list_workflows(
    include_stages: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    _ensure_default_workflow(db)
    rows = db.query(models.Workflow).order_by(models.Workflow.created_at.asc()).all()
    items = []
    for wf in rows:
        item = _serialize_workflow(wf)
        if include_stages:
            stages = (
                db.query(models.WorkflowStage)
                .filter(models.WorkflowStage.workflow_id == wf.id)
                .order_by(models.WorkflowStage.order_index.asc())
                .all()
            )
            item["stages"] = [_serialize_stage(s) for s in stages]
        items.append(item)
    return {"items": items, "total": len(items)}


@router.post("")
def create_workflow(
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    key = _normalize_key(payload.get("key") or payload.get("name"))
    name = str(payload.get("name") or "").strip()
    if not key or not name:
        raise HTTPException(400, "name/key is required")
    if db.query(models.Workflow).filter(func.lower(models.Workflow.key) == key).first():
        raise HTTPException(400, "Workflow key already exists")
    wf = models.Workflow(
        key=key,
        name=name,
        description=str(payload.get("description") or "").strip() or None,
        is_active=bool(payload.get("is_active", True)),
        is_default=False,
        created_by=str((current_user or {}).get("id") or "") or None,
    )
    db.add(wf)
    db.commit()
    db.refresh(wf)
    return {"message": "Workflow created", "item": _serialize_workflow(wf)}


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
    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "name cannot be empty")
        wf.name = name
    if "description" in payload:
        wf.description = str(payload.get("description") or "").strip() or None
    if "is_active" in payload:
        wf.is_active = bool(payload.get("is_active"))
    if payload.get("set_default") is True:
        db.query(models.Workflow).update({models.Workflow.is_default: False}, synchronize_session=False)
        wf.is_default = True
    db.commit()
    db.refresh(wf)
    return {"message": "Workflow updated", "item": _serialize_workflow(wf)}


@router.delete("/{workflow_id}")
def delete_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    wf = db.query(models.Workflow).filter(models.Workflow.id == workflow_id).first()
    if not wf:
        raise HTTPException(404, "Workflow not found")
    if wf.is_default:
        raise HTTPException(400, "Default workflow cannot be deleted")
    db.query(models.WorkflowTask).filter(models.WorkflowTask.workflow_id == wf.id).delete(synchronize_session=False)
    db.query(models.WorkflowStage).filter(models.WorkflowStage.workflow_id == wf.id).delete(synchronize_session=False)
    db.query(models.WorkflowScope).filter(models.WorkflowScope.workflow_id == wf.id).delete(synchronize_session=False)
    db.delete(wf)
    db.commit()
    return {"message": "Workflow deleted"}


@router.get("/{workflow_id}/stages")
def list_stages(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    rows = (
        db.query(models.WorkflowStage)
        .filter(models.WorkflowStage.workflow_id == workflow_id)
        .order_by(models.WorkflowStage.order_index.asc())
        .all()
    )
    return {"items": [_serialize_stage(r) for r in rows], "total": len(rows)}


@router.post("/{workflow_id}/stages")
def create_stage(
    workflow_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    if not db.query(models.Workflow.id).filter(models.Workflow.id == workflow_id).first():
        raise HTTPException(404, "Workflow not found")
    stage_key = _normalize_key(payload.get("stage_key") or payload.get("stage_name"))
    stage_name = str(payload.get("stage_name") or "").strip()
    if not stage_key or not stage_name:
        raise HTTPException(400, "stage_key/stage_name required")
    max_order = (
        db.query(func.max(models.WorkflowStage.order_index))
        .filter(models.WorkflowStage.workflow_id == workflow_id)
        .scalar()
        or 0
    )
    stage = models.WorkflowStage(
        workflow_id=workflow_id,
        stage_key=stage_key,
        stage_name=stage_name,
        order_index=int(payload.get("order_index") or (max_order + 1)),
        color=str(payload.get("color") or "#6C2BD9"),
        is_terminal=bool(payload.get("is_terminal", False)),
        is_rejection=bool(payload.get("is_rejection", False)),
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return {"message": "Stage created", "item": _serialize_stage(stage)}


@router.put("/stages/{stage_id}")
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
    if "stage_key" in payload:
        stage.stage_key = _normalize_key(payload.get("stage_key"))
    if "stage_name" in payload:
        stage.stage_name = str(payload.get("stage_name") or "").strip() or stage.stage_name
    if "order_index" in payload:
        stage.order_index = int(payload.get("order_index") or stage.order_index)
    if "color" in payload:
        stage.color = str(payload.get("color") or stage.color)
    if "is_terminal" in payload:
        stage.is_terminal = bool(payload.get("is_terminal"))
    if "is_rejection" in payload:
        stage.is_rejection = bool(payload.get("is_rejection"))
    db.commit()
    db.refresh(stage)
    return {"message": "Stage updated", "item": _serialize_stage(stage)}


@router.delete("/stages/{stage_id}")
def delete_stage(
    stage_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    stage = db.query(models.WorkflowStage).filter(models.WorkflowStage.id == stage_id).first()
    if not stage:
        raise HTTPException(404, "Stage not found")
    db.query(models.WorkflowTask).filter(models.WorkflowTask.stage_id == stage.id).delete(synchronize_session=False)
    db.delete(stage)
    db.commit()
    return {"message": "Stage deleted"}


@router.post("/{workflow_id}/stages/reorder")
def reorder_stages(
    workflow_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    ids = payload.get("stage_ids") or []
    if not isinstance(ids, list) or not ids:
        raise HTTPException(400, "stage_ids must be non-empty list")
    rows = db.query(models.WorkflowStage).filter(models.WorkflowStage.workflow_id == workflow_id).all()
    by_id = {r.id: r for r in rows}
    if set(ids) != set(by_id.keys()):
        raise HTTPException(400, "stage_ids must include all stages of the workflow")
    for idx, sid in enumerate(ids, start=1):
        by_id[sid].order_index = idx
    db.commit()
    return {"message": "Stage order updated"}


@router.get("/{workflow_id}/scope")
def list_scope(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    rows = (
        db.query(models.WorkflowScope)
        .filter(models.WorkflowScope.workflow_id == workflow_id)
        .order_by(models.WorkflowScope.scope_type.asc(), models.WorkflowScope.scope_value.asc())
        .all()
    )
    return {
        "items": [
            {
                "id": r.id,
                "workflow_id": r.workflow_id,
                "scope_type": r.scope_type,
                "scope_value": r.scope_value,
                "is_active": bool(r.is_active),
            }
            for r in rows
        ],
        "total": len(rows),
    }


@router.post("/{workflow_id}/scope")
def upsert_scope(
    workflow_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    scope_type = _normalize_key(payload.get("scope_type"))
    scope_value = str(payload.get("scope_value") or "").strip() or None
    if scope_type not in {"global", "client", "job", "requirement"}:
        raise HTTPException(400, "scope_type must be one of: global, client, job, requirement")
    row = (
        db.query(models.WorkflowScope)
        .filter(models.WorkflowScope.workflow_id == workflow_id)
        .filter(func.lower(models.WorkflowScope.scope_type) == scope_type)
        .filter(func.coalesce(models.WorkflowScope.scope_value, "") == (scope_value or ""))
        .first()
    )
    if not row:
        row = models.WorkflowScope(
            workflow_id=workflow_id,
            scope_type=scope_type,
            scope_value=scope_value,
            is_active=bool(payload.get("is_active", True)),
        )
        db.add(row)
    else:
        row.is_active = bool(payload.get("is_active", True))
    db.commit()
    return {"message": "Scope saved", "item": {"id": row.id, "scope_type": row.scope_type, "scope_value": row.scope_value, "is_active": row.is_active}}


@router.delete("/scope/{scope_id}")
def delete_scope(
    scope_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    row = db.query(models.WorkflowScope).filter(models.WorkflowScope.id == scope_id).first()
    if not row:
        raise HTTPException(404, "Scope not found")
    db.delete(row)
    db.commit()
    return {"message": "Scope deleted"}


def _resolve_workflow_for_submission(db: Session, submission: models.CandidateSubmission) -> Optional[models.Workflow]:
    job = db.query(models.Job).filter(models.Job.id == submission.job_id).first()
    requirement_id = str(submission.requirement_id or "").strip()
    job_id = str(submission.job_id or "").strip()
    client_id = str(getattr(job, "client_id", None) or "").strip()

    checks = [
        ("requirement", requirement_id),
        ("job", job_id),
        ("client", client_id),
        ("global", None),
    ]
    for scope_type, scope_value in checks:
        q = (
            db.query(models.Workflow)
            .join(models.WorkflowScope, models.WorkflowScope.workflow_id == models.Workflow.id)
            .filter(models.Workflow.is_active.is_(True), models.WorkflowScope.is_active.is_(True))
            .filter(func.lower(models.WorkflowScope.scope_type) == scope_type)
        )
        if scope_value is None:
            q = q.filter(models.WorkflowScope.scope_value.is_(None))
        else:
            q = q.filter(models.WorkflowScope.scope_value == scope_value)
        hit = q.order_by(models.Workflow.is_default.desc(), models.Workflow.created_at.asc()).first()
        if hit:
            return hit
    return (
        db.query(models.Workflow)
        .filter(models.Workflow.is_active.is_(True))
        .order_by(models.Workflow.is_default.desc(), models.Workflow.created_at.asc())
        .first()
    )


@router.post("/submissions/{submission_id}/advance")
def advance_submission_stage(
    submission_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    target_key = _normalize_key(payload.get("next_stage_key"))
    if not target_key:
        raise HTTPException(400, "next_stage_key is required")

    submission = db.query(models.CandidateSubmission).filter(models.CandidateSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(404, "Submission not found")

    wf = _resolve_workflow_for_submission(db, submission)
    if not wf:
        raise HTTPException(400, "No active workflow mapped")

    stages = (
        db.query(models.WorkflowStage)
        .filter(models.WorkflowStage.workflow_id == wf.id)
        .order_by(models.WorkflowStage.order_index.asc())
        .all()
    )
    by_key = {s.stage_key: s for s in stages}
    target = by_key.get(target_key)
    if not target:
        raise HTTPException(400, "Target stage not found in resolved workflow")

    current_key = _normalize_key(submission.stage or submission.status or "")
    current_stage = by_key.get(current_key)
    if current_stage:
        req_tasks = (
            db.query(models.WorkflowTask)
            .filter(models.WorkflowTask.stage_id == current_stage.id, models.WorkflowTask.is_required.is_(True))
            .all()
        )
        if req_tasks:
            done_ids = {
                row[0]
                for row in db.query(models.TaskCompletion.task_id)
                .filter(models.TaskCompletion.submission_id == submission.id)
                .all()
            }
            missing = [t.task_name for t in req_tasks if t.id not in done_ids]
            if missing:
                raise HTTPException(400, f"Required tasks incomplete: {', '.join(missing)}")
        if target.order_index <= current_stage.order_index:
            raise HTTPException(400, "Stage can only move forward")

    submission.stage = target.stage_key
    submission.status = target.stage_key
    submission.updated_at = datetime.utcnow()
    if target.is_terminal:
        submission.decision_at = datetime.utcnow()
    db.commit()
    return {
        "message": "Submission advanced",
        "workflow": _serialize_workflow(wf),
        "stage": _serialize_stage(target),
        "submission_id": submission.id,
    }


from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db

router = APIRouter(prefix="/v1/super-admin/tasks", tags=["Super Admin Workflow Tasks"])


def _must_access(user: Dict[str, Any]) -> None:
    role = str((user or {}).get("role") or "").strip().lower()
    if role not in {"super_admin", "admin"}:
        raise HTTPException(403, "Super Admin/Admin access required")


def _normalize_key(value: str) -> str:
    return str(value or "").strip().lower().replace(" ", "_").replace("-", "_")


def _serialize_task(task: models.WorkflowTask) -> Dict[str, Any]:
    return {
        "id": task.id,
        "workflow_id": task.workflow_id,
        "stage_id": task.stage_id,
        "task_key": task.task_key,
        "task_name": task.task_name,
        "role_name": task.role_name,
        "resource_name": task.resource_name,
        "action_name": task.action_name,
        "is_required": bool(task.is_required),
        "helper_link": task.helper_link,
        "order_index": task.order_index,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


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


@router.get("/workflows/{workflow_id}")
def list_tasks(
    workflow_id: str,
    stage_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    q = db.query(models.WorkflowTask).filter(models.WorkflowTask.workflow_id == workflow_id)
    if stage_id:
        q = q.filter(models.WorkflowTask.stage_id == stage_id)
    rows = q.order_by(models.WorkflowTask.stage_id.asc(), models.WorkflowTask.order_index.asc()).all()
    return {"items": [_serialize_task(r) for r in rows], "total": len(rows)}


@router.post("/workflows/{workflow_id}")
def create_task(
    workflow_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    stage_id = str(payload.get("stage_id") or "").strip()
    task_name = str(payload.get("task_name") or "").strip()
    role_name = _normalize_key(payload.get("role_name"))
    if not stage_id or not task_name or not role_name:
        raise HTTPException(400, "stage_id, task_name and role_name are required")
    stage = db.query(models.WorkflowStage).filter(models.WorkflowStage.id == stage_id, models.WorkflowStage.workflow_id == workflow_id).first()
    if not stage:
        raise HTTPException(400, "Invalid stage_id for this workflow")
    max_order = (
        db.query(func.max(models.WorkflowTask.order_index))
        .filter(models.WorkflowTask.stage_id == stage_id)
        .scalar()
        or 0
    )
    task = models.WorkflowTask(
        workflow_id=workflow_id,
        stage_id=stage_id,
        task_key=_normalize_key(payload.get("task_key") or task_name),
        task_name=task_name,
        role_name=role_name,
        resource_name=_normalize_key(payload.get("resource_name") or ""),
        action_name=_normalize_key(payload.get("action_name") or ""),
        is_required=bool(payload.get("is_required", True)),
        helper_link=str(payload.get("helper_link") or "").strip() or None,
        order_index=int(payload.get("order_index") or (max_order + 1)),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"message": "Task created", "item": _serialize_task(task)}


@router.put("/{task_id}")
def update_task(
    task_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    task = db.query(models.WorkflowTask).filter(models.WorkflowTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if "task_name" in payload:
        val = str(payload.get("task_name") or "").strip()
        if not val:
            raise HTTPException(400, "task_name cannot be empty")
        task.task_name = val
    if "task_key" in payload:
        task.task_key = _normalize_key(payload.get("task_key"))
    if "role_name" in payload:
        task.role_name = _normalize_key(payload.get("role_name"))
    if "resource_name" in payload:
        task.resource_name = _normalize_key(payload.get("resource_name") or "")
    if "action_name" in payload:
        task.action_name = _normalize_key(payload.get("action_name") or "")
    if "is_required" in payload:
        task.is_required = bool(payload.get("is_required"))
    if "helper_link" in payload:
        task.helper_link = str(payload.get("helper_link") or "").strip() or None
    if "order_index" in payload:
        task.order_index = int(payload.get("order_index"))
    db.commit()
    db.refresh(task)
    return {"message": "Task updated", "item": _serialize_task(task)}


@router.delete("/{task_id}")
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    task = db.query(models.WorkflowTask).filter(models.WorkflowTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.query(models.TaskCompletion).filter(models.TaskCompletion.task_id == task.id).delete(synchronize_session=False)
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}


@router.post("/workflows/{workflow_id}/reorder")
def reorder_tasks(
    workflow_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _must_access(current_user)
    ids = payload.get("task_ids") or []
    if not isinstance(ids, list) or not ids:
        raise HTTPException(400, "task_ids must be non-empty list")
    rows = db.query(models.WorkflowTask).filter(models.WorkflowTask.workflow_id == workflow_id).all()
    by_id = {r.id: r for r in rows}
    if set(ids) != set(by_id.keys()):
        raise HTTPException(400, "task_ids must include all tasks in workflow")
    stage_order: Dict[str, int] = {}
    for tid in ids:
        task = by_id[tid]
        stage_order[task.stage_id] = stage_order.get(task.stage_id, 0) + 1
        task.order_index = stage_order[task.stage_id]
    db.commit()
    return {"message": "Task order updated"}


@router.get("/submissions/{submission_id}/checklist")
def submission_checklist(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sub = db.query(models.CandidateSubmission).filter(models.CandidateSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(404, "Submission not found")
    wf = _resolve_workflow_for_submission(db, sub)
    if not wf:
        return {"submission_id": submission_id, "workflow_id": None, "stage_key": sub.stage, "items": []}
    stage_key = _normalize_key(sub.stage or sub.status or "")
    stage = (
        db.query(models.WorkflowStage)
        .filter(models.WorkflowStage.workflow_id == wf.id, func.lower(models.WorkflowStage.stage_key) == stage_key)
        .first()
    )
    if not stage:
        return {"submission_id": submission_id, "workflow_id": wf.id, "stage_key": stage_key, "items": []}

    tasks = (
        db.query(models.WorkflowTask)
        .filter(models.WorkflowTask.workflow_id == wf.id, models.WorkflowTask.stage_id == stage.id)
        .order_by(models.WorkflowTask.order_index.asc())
        .all()
    )
    completions = {
        row.task_id: row
        for row in db.query(models.TaskCompletion).filter(models.TaskCompletion.submission_id == sub.id).all()
    }
    items = []
    for task in tasks:
        done = completions.get(task.id)
        items.append(
            {
                **_serialize_task(task),
                "completed": done is not None,
                "completed_at": done.completed_at if done else None,
                "completed_by": done.completed_by if done else None,
                "notes": done.notes if done else None,
            }
        )
    return {"submission_id": sub.id, "workflow_id": wf.id, "stage_key": stage.stage_key, "items": items}


@router.post("/submissions/{submission_id}/tasks/{task_id}/complete")
def complete_task(
    submission_id: str,
    task_id: str,
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    sub = db.query(models.CandidateSubmission).filter(models.CandidateSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(404, "Submission not found")
    task = db.query(models.WorkflowTask).filter(models.WorkflowTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    role = _normalize_key((current_user or {}).get("role"))
    if role not in {"super_admin", "admin"} and role != _normalize_key(task.role_name):
        raise HTTPException(403, "Current role is not allowed to complete this task")

    row = (
        db.query(models.TaskCompletion)
        .filter(models.TaskCompletion.submission_id == submission_id, models.TaskCompletion.task_id == task_id)
        .first()
    )
    if not row:
        row = models.TaskCompletion(
            submission_id=submission_id,
            task_id=task_id,
            completed_by=str((current_user or {}).get("id") or "") or None,
            notes=str(payload.get("notes") or "").strip() or None,
            completed_at=datetime.utcnow(),
        )
        db.add(row)
    else:
        row.completed_by = str((current_user or {}).get("id") or "") or None
        row.notes = str(payload.get("notes") or "").strip() or row.notes
        row.completed_at = datetime.utcnow()
    db.commit()
    return {"message": "Task marked complete", "submission_id": submission_id, "task_id": task_id}


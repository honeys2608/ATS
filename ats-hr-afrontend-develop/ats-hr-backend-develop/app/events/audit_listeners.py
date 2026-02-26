from __future__ import annotations

from typing import Any, Dict, Iterable

from sqlalchemy import event, inspect

from app import models
from app.services.audit_service import log_audit

_REGISTERED = False

MODEL_MODULE_MAP = {
    "User": "User Management",
    "Candidate": "Candidate Management",
    "Job": "Job Management",
    "CallFeedback": "Recruiter Feedback",
}


def _entity_type(target: Any) -> str:
    return target.__class__.__name__.lower()


def _entity_id(target: Any) -> str | None:
    value = getattr(target, "id", None)
    return str(value) if value else None


def _to_dict(target: Any) -> Dict[str, Any]:
    state = inspect(target)
    out: Dict[str, Any] = {}
    for attr in state.mapper.column_attrs:
        key = attr.key
        out[key] = getattr(target, key, None)
    return out


def _updated_values(target: Any) -> Dict[str, Any]:
    state = inspect(target)
    old_vals: Dict[str, Any] = {}
    new_vals: Dict[str, Any] = {}

    for attr in state.attrs:
        history = attr.history
        if not history.has_changes():
            continue
        key = attr.key
        old_vals[key] = history.deleted[0] if history.deleted else None
        new_vals[key] = history.added[0] if history.added else getattr(target, key, None)

    return {"old": old_vals, "new": new_vals}


def _module_name(target: Any) -> str:
    return MODEL_MODULE_MAP.get(target.__class__.__name__, target.__class__.__name__)


def _is_audit_log(target: Any) -> bool:
    return isinstance(target, models.AuditLog)


def _log_insert(mapper, connection, target) -> None:
    if _is_audit_log(target):
        return
    log_audit(
        actor=None,
        action=f"{target.__class__.__name__.upper()}_CREATED",
        module=_module_name(target),
        entity_type=_entity_type(target),
        entity_id=_entity_id(target),
        description=f"{target.__class__.__name__} created",
        old_values=None,
        new_values=_to_dict(target),
        severity="INFO",
        is_system_action=True,
    )


def _log_update(mapper, connection, target) -> None:
    if _is_audit_log(target):
        return
    payload = _updated_values(target)
    if not payload["old"] and not payload["new"]:
        return
    log_audit(
        actor=None,
        action=f"{target.__class__.__name__.upper()}_UPDATED",
        module=_module_name(target),
        entity_type=_entity_type(target),
        entity_id=_entity_id(target),
        description=f"{target.__class__.__name__} updated",
        old_values=payload["old"],
        new_values=payload["new"],
        severity="INFO",
        is_system_action=True,
    )


def _log_delete(mapper, connection, target) -> None:
    if _is_audit_log(target):
        return
    log_audit(
        actor=None,
        action=f"{target.__class__.__name__.upper()}_DELETED",
        module=_module_name(target),
        entity_type=_entity_type(target),
        entity_id=_entity_id(target),
        description=f"{target.__class__.__name__} deleted",
        old_values=_to_dict(target),
        new_values=None,
        severity="WARNING",
        is_system_action=True,
    )


def register_audit_listeners() -> None:
    global _REGISTERED
    if _REGISTERED:
        return

    tracked_models: Iterable[type] = (
        models.User,
        models.Candidate,
        models.Job,
        models.CallFeedback,
    )
    for model in tracked_models:
        event.listen(model, "after_insert", _log_insert)
        event.listen(model, "after_update", _log_update)
        event.listen(model, "after_delete", _log_delete)

    _REGISTERED = True


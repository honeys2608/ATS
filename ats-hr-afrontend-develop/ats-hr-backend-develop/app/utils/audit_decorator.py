from __future__ import annotations

import inspect
from functools import wraps
from typing import Any, Callable, Optional

from fastapi.responses import JSONResponse
from starlette.responses import Response

from app.services.audit_service import log_audit, reset_audit_actor, set_audit_actor


def _extract_status_code(result: Any) -> int:
    if isinstance(result, Response):
        return int(getattr(result, "status_code", 200))
    if isinstance(result, JSONResponse):
        return int(result.status_code)
    return 200


def _extract_actor(args: tuple, kwargs: dict) -> Optional[dict]:
    if "current_user" in kwargs and isinstance(kwargs["current_user"], dict):
        return kwargs["current_user"]
    if "user" in kwargs and isinstance(kwargs["user"], dict):
        return kwargs["user"]
    for item in args:
        if isinstance(item, dict) and ("role" in item or "id" in item):
            return item
    return None


def audit_action(
    *,
    action: str,
    module: str,
    severity: str = "INFO",
    entity_type: Optional[str] = None,
    entity_id_getter: Optional[Callable[[Any, tuple, dict], Optional[str]]] = None,
    description_getter: Optional[Callable[[Any, tuple, dict], Optional[str]]] = None,
):
    def decorator(func: Callable):
        is_async = inspect.iscoroutinefunction(func)

        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            actor = _extract_actor(args, kwargs)
            actor_token = set_audit_actor(actor)
            try:
                result = await func(*args, **kwargs)
            finally:
                reset_audit_actor(actor_token)

            status_code = _extract_status_code(result)
            if status_code in (200, 201):
                entity_id = entity_id_getter(result, args, kwargs) if entity_id_getter else None
                description = description_getter(result, args, kwargs) if description_getter else None
                log_audit(
                    actor=actor,
                    action=action,
                    module=module,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    description=description,
                    severity=severity,
                )
            return result

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            actor = _extract_actor(args, kwargs)
            actor_token = set_audit_actor(actor)
            try:
                result = func(*args, **kwargs)
            finally:
                reset_audit_actor(actor_token)

            status_code = _extract_status_code(result)
            if status_code in (200, 201):
                entity_id = entity_id_getter(result, args, kwargs) if entity_id_getter else None
                description = description_getter(result, args, kwargs) if description_getter else None
                log_audit(
                    actor=actor,
                    action=action,
                    module=module,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    description=description,
                    severity=severity,
                )
            return result

        return async_wrapper if is_async else sync_wrapper

    return decorator


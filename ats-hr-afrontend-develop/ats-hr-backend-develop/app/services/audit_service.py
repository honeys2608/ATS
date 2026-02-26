from __future__ import annotations

import json
import ipaddress
import os
from contextvars import ContextVar, Token
from datetime import datetime
from typing import Any, Dict, Mapping, Optional
from urllib.error import URLError
from urllib.request import urlopen

from fastapi import FastAPI, Request
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app import models
from app.db import SessionLocal

SECRET_KEY = os.getenv("SESSION_SECRET", "akshu-hr-secret-key")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

_request_ctx: ContextVar[Optional[Request]] = ContextVar("audit_request_ctx", default=None)
_actor_ctx: ContextVar[Optional[dict]] = ContextVar("audit_actor_ctx", default=None)
_reentry_guard: ContextVar[bool] = ContextVar("audit_reentry_guard", default=False)

SENSITIVE_FIELDS = {
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
    "authorization",
    "ssn",
    "pan",
    "aadhaar",
}

SEVERITY_LEVELS = {"INFO", "WARNING", "ERROR", "CRITICAL"}
LOCATION_CACHE_TTL_SECONDS = 6 * 60 * 60
_location_cache: Dict[str, tuple[datetime, Optional[str]]] = {}


def _normalize_text(value: Optional[str]) -> str:
    return str(value or "").strip()


def register_audit_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def _audit_context_middleware(request: Request, call_next):
        req_token = _request_ctx.set(request)
        actor_token = _actor_ctx.set(_extract_actor_from_request(request))
        try:
            response = await call_next(request)
            _auto_log_request_action(request, response)
            return response
        finally:
            _actor_ctx.reset(actor_token)
            _request_ctx.reset(req_token)


def set_audit_actor(actor: Optional[dict]) -> Token:
    return _actor_ctx.set(actor)


def reset_audit_actor(token: Token) -> None:
    _actor_ctx.reset(token)


def get_audit_actor() -> Optional[dict]:
    return _actor_ctx.get()


def _normalize_severity(value: Optional[str]) -> str:
    severity = _normalize_text(value).upper() or "INFO"
    return severity if severity in SEVERITY_LEVELS else "INFO"


def _mask_sensitive(data: Any) -> Any:
    if isinstance(data, Mapping):
        masked: Dict[str, Any] = {}
        for key, value in data.items():
            key_str = str(key).lower()
            if key_str in SENSITIVE_FIELDS or any(s in key_str for s in ("password", "token", "secret")):
                masked[str(key)] = "***REDACTED***"
            else:
                masked[str(key)] = _mask_sensitive(value)
        return masked
    if isinstance(data, list):
        return [_mask_sensitive(item) for item in data]
    if isinstance(data, tuple):
        return tuple(_mask_sensitive(item) for item in data)
    return data


def _safe_json(data: Any) -> Any:
    try:
        json.dumps(data, default=str)
        return data
    except Exception:
        return {"value": str(data)}


def _resolve_actor(actor: Optional[dict]) -> dict:
    source = actor or get_audit_actor() or {}
    actor_id = source.get("id") or source.get("user_id") or source.get("sub")
    tenant_id = source.get("tenant_id") or source.get("client_id")
    return {
        "id": str(actor_id) if actor_id else None,
        "name": source.get("name") or source.get("full_name") or source.get("username"),
        "email": source.get("email"),
        "role": source.get("role"),
        "tenant_id": str(tenant_id) if tenant_id else None,
    }


def _get_request() -> Optional[Request]:
    return _request_ctx.get()


def _extract_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _extract_user_agent(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    return request.headers.get("user-agent")


def _is_public_ip(ip_value: Optional[str]) -> bool:
    ip_text = _normalize_text(ip_value)
    if not ip_text:
        return False
    try:
        addr = ipaddress.ip_address(ip_text)
        return not (
            addr.is_private
            or addr.is_loopback
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
            or addr.is_link_local
        )
    except Exception:
        return False


def _resolve_location_from_ip(ip_value: Optional[str]) -> Optional[str]:
    ip_text = _normalize_text(ip_value)
    if not _is_public_ip(ip_text):
        return None

    now = datetime.utcnow()
    cached = _location_cache.get(ip_text)
    if cached and (now - cached[0]).total_seconds() <= LOCATION_CACHE_TTL_SECONDS:
        return cached[1]

    location_value: Optional[str] = None
    try:
        with urlopen(f"https://ipapi.co/{ip_text}/json/", timeout=1.5) as response:
            payload = json.loads(response.read().decode("utf-8", errors="ignore") or "{}")
        city = _normalize_text(payload.get("city"))
        region = _normalize_text(payload.get("region"))
        country = _normalize_text(payload.get("country_name"))
        pieces = [p for p in (city, region, country) if p]
        location_value = ", ".join(pieces) if pieces else None
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError, OSError):
        location_value = None
    except Exception:
        location_value = None

    _location_cache[ip_text] = (now, location_value)
    return location_value


def _parse_user_agent(user_agent: Optional[str]) -> dict:
    ua = _normalize_text(user_agent)
    ua_lower = ua.lower()
    if not ua:
        return {"device": None, "browser": None, "os": None}

    device = "Desktop"
    if any(k in ua_lower for k in ("mobile", "iphone", "android")):
        device = "Mobile"
    elif any(k in ua_lower for k in ("ipad", "tablet")):
        device = "Tablet"

    browser = "Other"
    if "edg/" in ua_lower:
        browser = "Edge"
    elif "chrome/" in ua_lower and "chromium" not in ua_lower and "edg/" not in ua_lower:
        browser = "Chrome"
    elif "safari/" in ua_lower and "chrome/" not in ua_lower:
        browser = "Safari"
    elif "firefox/" in ua_lower:
        browser = "Firefox"

    os_name = "Other"
    if "windows" in ua_lower:
        os_name = "Windows"
    elif "mac os" in ua_lower or "macintosh" in ua_lower:
        os_name = "macOS"
    elif "android" in ua_lower:
        os_name = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower or "ios" in ua_lower:
        os_name = "iOS"
    elif "linux" in ua_lower:
        os_name = "Linux"

    return {"device": device, "browser": browser, "os": os_name}


def map_audit_severity(
    *,
    action: Optional[str] = None,
    action_label: Optional[str] = None,
    status: Optional[str] = None,
    explicit: Optional[str] = None,
) -> str:
    if explicit:
        return _normalize_severity(explicit)

    key = f"{_normalize_text(action)} {_normalize_text(action_label)}".lower()
    stat = _normalize_text(status).lower()

    if "unauthorized" in key or "forbidden" in key:
        return "CRITICAL"
    if "permission" in key and ("change" in key or "update" in key or "grant" in key or "revoke" in key):
        return "CRITICAL"
    if "user" in key and ("delete" in key or "removed" in key):
        return "CRITICAL"
    if "export" in key:
        return "WARNING"
    if "account" in key and "lock" in key:
        return "ERROR"
    if "role" in key and ("change" in key or "update" in key):
        return "WARNING"
    if "login" in key:
        return "WARNING" if stat == "failed" else "INFO"
    return "WARNING" if stat == "failed" else "INFO"


def _extract_actor_from_request(request: Request) -> Optional[dict]:
    auth_header = request.headers.get("authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = payload.get("sub")
        role = payload.get("role")
        tenant_id = payload.get("client_id")
        return {
            "id": str(uid) if uid else None,
            "name": payload.get("name"),
            "email": payload.get("email"),
            "role": role,
            "tenant_id": str(tenant_id) if tenant_id else None,
        }
    except JWTError:
        return None
    except Exception:
        return None


def _route_module(path: str) -> str:
    clean = path.strip("/") or "root"
    if clean.startswith("v1/"):
        clean = clean[3:]
    return clean.split("/", 1)[0].replace("-", "_")


def _should_skip_auto_log(request: Request) -> bool:
    path = request.url.path or ""
    if path in {"/health", "/api"}:
        return True
    if path.startswith("/uploads"):
        return True
    # Avoid self-referential noise for audit screens.
    if path.startswith("/v1/super-admin/audit-logs") or path.startswith("/v1/audit-logs"):
        return True
    if path.startswith("/v1/recruiter/workflow-logs"):
        return True
    if path.startswith("/auth/login"):
        return True
    return False


def _auto_log_request_action(request: Request, response) -> None:
    try:
        if _should_skip_auto_log(request):
            return

        method = (request.method or "").upper()
        path = request.url.path or "/"
        actor = get_audit_actor()
        if not actor or not actor.get("id"):
            return

        # Avoid noisy read telemetry in audit stream; track state-changing API actions only.
        if method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return

        code = int(getattr(response, "status_code", 0))
        status = "success" if 200 <= code < 300 else "failed"
        action = f"API_{method}_{path.strip('/').replace('/', '_').replace('-', '_').upper()}"
        action_label = f"{method} {path}"
        module = _route_module(path)
        log_audit(
            actor=actor,
            action=action,
            action_label=action_label,
            module=module,
            entity_type="api_request",
            entity_id=None,
            entity_name=path,
            description=action_label,
            status=status,
            severity=map_audit_severity(
                action=action,
                action_label=action_label,
                status=status,
                explicit=("WARNING" if method == "DELETE" else None),
            ),
            failure_reason=(None if status == "success" else f"HTTP {code}"),
            old_value=None,
            new_value={"status_code": code},
            endpoint=path,
            http_method=method,
            response_code=code,
            is_system_action=False,
        )
    except Exception:
        # Never break primary request flow due to auto-audit.
        return


def trigger_critical_alert(payload: Dict[str, Any]) -> None:
    # Stub hook for future integrations (email, Slack, PagerDuty, SIEM).
    return None


def _legacy_state(values: Any) -> Optional[str]:
    if values is None:
        return None
    if isinstance(values, str):
        return values
    try:
        return json.dumps(values, default=str)
    except Exception:
        return str(values)


def log_audit(
    actor: Optional[dict] = None,
    action: str = "",
    module: str = "system",
    action_label: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    status: Optional[str] = "success",
    description: Optional[str] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    failure_reason: Optional[str] = None,
    tenant_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
    endpoint: Optional[str] = None,
    http_method: Optional[str] = None,
    response_code: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    device: Optional[str] = None,
    browser: Optional[str] = None,
    os: Optional[str] = None,
    location: Optional[str] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    severity: str = "INFO",
    is_system_action: bool = False,
) -> None:
    if not action:
        return
    if _reentry_guard.get():
        return

    token = _reentry_guard.set(True)
    db: Optional[Session] = None
    try:
        request = _get_request()
        actor_info = _resolve_actor(actor)
        merged_old = old_value if old_value is not None else old_values
        merged_new = new_value if new_value is not None else new_values
        old_payload = _safe_json(_mask_sensitive(merged_old))
        new_payload = _safe_json(_mask_sensitive(merged_new))
        final_status = _normalize_text(status).lower() or "success"
        if final_status not in {"success", "failed"}:
            final_status = "success"

        req_path = endpoint or (request.url.path if request else None)
        req_method = (http_method or (request.method if request else "") or "").upper() or None
        req_code = response_code
        if req_code is None and final_status == "failed":
            req_code = 500
        req_ip = ip_address or _extract_ip(request)
        req_ua = user_agent or _extract_user_agent(request)
        ua_parts = _parse_user_agent(req_ua)
        final_device = device or ua_parts["device"]
        final_browser = browser or ua_parts["browser"]
        final_os = os or ua_parts["os"]
        final_location = location or _resolve_location_from_ip(req_ip) or None
        fail_reason = _normalize_text(failure_reason) or None

        explicit_actor_id = actor_id or actor_info["id"]
        explicit_actor_name = actor_name or actor_info["name"]
        explicit_actor_email = actor_email or actor_info["email"]
        explicit_actor_role = actor_role or actor_info["role"]
        explicit_tenant_id = tenant_id or actor_info["tenant_id"]
        label = action_label or action.replace("_", " ").title()
        sev = map_audit_severity(
            action=action,
            action_label=label,
            status=final_status,
            explicit=severity,
        )
        db = SessionLocal()
        now = datetime.utcnow()

        log = models.AuditLog(
            log_id=models.generate_uuid(),
            timestamp=now,
            created_at=now,
            actor_id=explicit_actor_id,
            actor_name=explicit_actor_name,
            actor_email=explicit_actor_email,
            actor_role=explicit_actor_role,
            tenant_id=explicit_tenant_id,
            action=action,
            action_label=label,
            module=module,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            entity_name=entity_name,
            status=final_status,
            description=description or label,
            failure_reason=fail_reason,
            old_value=old_payload,
            new_value=new_payload,
            old_values=old_payload,
            new_values=new_payload,
            ip_address=req_ip,
            user_agent=req_ua,
            device=final_device,
            browser=final_browser,
            os=final_os,
            location=final_location,
            endpoint=req_path,
            http_method=req_method,
            response_code=req_code,
            severity=sev,
            is_system_action=bool(is_system_action),
            # Legacy compatibility fields (older code paths still use these).
            user_id=explicit_actor_id,
            old_state=_legacy_state(old_payload),
            new_state=_legacy_state(new_payload) or "N/A",
            details={"description": description, "module": module},
        )
        db.add(log)
        db.commit()

        if sev == "CRITICAL":
            print(f"[AUDIT][CRITICAL] {action} module={module} entity={entity_type}:{entity_id}")
            trigger_critical_alert(
                {
                    "action": action,
                    "module": module,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "actor_id": explicit_actor_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
    except Exception:
        if db is not None:
            try:
                db.rollback()
            except Exception:
                pass
    finally:
        if db is not None:
            try:
                db.close()
            except Exception:
                pass
        _reentry_guard.reset(token)

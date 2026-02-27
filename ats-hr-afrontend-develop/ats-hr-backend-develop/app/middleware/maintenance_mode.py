from __future__ import annotations

from jose import JWTError, jwt
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.auth import ALGORITHM, SECRET_KEY
from app.db import SessionLocal


SKIP_PREFIXES = (
    "/health",
    "/api",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/verify-otp",
    "/auth/reset-password",
)


def _is_super_admin(request: Request) -> bool:
    token = request.headers.get("authorization", "")
    if not token.lower().startswith("bearer "):
        return False
    raw = token.split(" ", 1)[1].strip()
    if not raw:
        return False
    try:
        payload = jwt.decode(raw, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return False
    return str(payload.get("role") or "").strip().lower() == "super_admin"


def register_maintenance_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def maintenance_guard(request: Request, call_next):
        path = request.url.path or "/"
        if any(path.startswith(prefix) for prefix in SKIP_PREFIXES):
            return await call_next(request)

        db = SessionLocal()
        try:
            row = db.execute(
                text(
                    """
SELECT COALESCE(value_json, setting_value) AS value_text
FROM system_settings
WHERE key = 'maintenance.enabled'
   OR (module_name = 'maintenance' AND setting_key = 'enabled')
ORDER BY updated_at DESC
LIMIT 1
                    """
                )
            ).fetchone()
            msg_row = db.execute(
                text(
                    """
SELECT COALESCE(value_json, setting_value) AS value_text
FROM system_settings
WHERE key = 'maintenance.message'
   OR (module_name = 'maintenance' AND setting_key = 'message')
ORDER BY updated_at DESC
LIMIT 1
                    """
                )
            ).fetchone()
        except Exception:
            db.close()
            return await call_next(request)
        finally:
            db.close()

        enabled_text = str((row[0] if row else "false") or "false").strip().lower()
        enabled = enabled_text in {"true", "1", "t", '"true"'}
        if not enabled:
            return await call_next(request)

        if _is_super_admin(request):
            return await call_next(request)

        message = str((msg_row[0] if msg_row else "") or "").strip().strip('"') or "Platform is under maintenance. Please try again later."
        return JSONResponse(
            status_code=503,
            content={"detail": message, "maintenance": True},
        )

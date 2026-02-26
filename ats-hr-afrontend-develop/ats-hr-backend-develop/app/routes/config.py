from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.db import get_db
from app.permissions import ROLE_PERMISSIONS

router = APIRouter(prefix="/v1/config", tags=["Config"])


def _permission_matrix_from_db(db: Session) -> Dict[str, Dict[str, List[str]]]:
    rows = db.query(models.Permission).all()
    out: Dict[str, Dict[str, List[str]]] = {}
    for row in rows:
        role = "_".join(str(row.role_name or "").strip().lower().split())
        module = str(row.module_name or "").strip().lower()
        action = str(row.action_name or "").strip().lower()
        if not role or not module or not action:
            continue
        out.setdefault(role, {}).setdefault(module, [])
        if action not in out[role][module]:
            out[role][module].append(action)
    return out


@router.get("/permissions")
def get_runtime_permissions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    matrix = _permission_matrix_from_db(db)
    if not matrix:
        matrix = ROLE_PERMISSIONS
    # Super admin is always full-access and should never be DB-gated.
    matrix["super_admin"] = ROLE_PERMISSIONS.get("super_admin", {})
    return {"permissions": matrix}


@router.get("/labels")
def get_runtime_labels(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    rows = db.query(models.UILabel).all()
    labels: Dict[str, str] = {}
    for row in rows:
        key = str(row.key or "").strip()
        if not key:
            continue
        labels[key] = str(row.custom_value or row.default_value or "")
    return {"labels": labels}

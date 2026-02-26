from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from app.utils.role_check import allow_user

router = APIRouter(prefix="/v1/folders", tags=["Folders"])


@router.post("")
@require_permission("folders", "create")
async def create_folder(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)
    name = (payload.get("name") or "").strip()
    description = payload.get("description")
    if not name:
        raise HTTPException(status_code=400, detail="Folder name is required.")

    user_id = current_user.get("id")
    existing = (
        db.query(models.Folder)
        .filter(
            models.Folder.user_id == user_id,
            models.Folder.is_active == True,
            models.Folder.name == name,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Folder name already exists.")

    folder = models.Folder(
        name=name,
        description=description,
        user_id=user_id,
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)

    return {
        "id": folder.id,
        "name": folder.name,
        "description": folder.description,
        "created_at": folder.created_at,
        "status": "created",
    }


@router.get("")
@require_permission("folders", "view")
async def list_folders(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)
    user_id = current_user.get("id")

    folders = (
        db.query(models.Folder)
        .filter(models.Folder.user_id == user_id, models.Folder.is_active == True)
        .order_by(models.Folder.created_at.desc())
        .all()
    )

    results = []
    for folder in folders:
        count = (
            db.query(models.SavedSearch)
            .filter(
                models.SavedSearch.user_id == user_id,
                models.SavedSearch.is_active == True,
                models.SavedSearch.folder_id == folder.id,
            )
            .count()
        )
        results.append(
            {
                "id": folder.id,
                "name": folder.name,
                "description": folder.description,
                "created_at": folder.created_at,
                "search_count": count,
            }
        )

    return {"count": len(results), "results": results}


@router.get("/{folder_id}/searches")
@require_permission("folders", "view")
async def get_folder_searches(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)
    user_id = current_user.get("id")

    folder = (
        db.query(models.Folder)
        .filter(
            models.Folder.id == folder_id,
            models.Folder.user_id == user_id,
            models.Folder.is_active == True,
        )
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")

    searches = (
        db.query(models.SavedSearch)
        .filter(
            models.SavedSearch.user_id == user_id,
            models.SavedSearch.is_active == True,
            models.SavedSearch.folder_id == folder_id,
        )
        .order_by(models.SavedSearch.created_at.desc())
        .all()
    )

    results = []
    for s in searches:
        results.append(
            {
                "id": s.id,
                "search_name": s.name,
                "filters": s.filters or {},
                "result_count": s.result_count or 0,
                "created_at": s.created_at,
                "folder_id": s.folder_id,
            }
        )

    return {
        "folder": {
            "id": folder.id,
            "name": folder.name,
            "description": folder.description,
        },
        "count": len(results),
        "results": results,
    }


@router.delete("/{folder_id}")
@require_permission("folders", "delete")
async def delete_folder(
    folder_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allow_user(current_user)
    user_id = current_user.get("id")

    folder = (
        db.query(models.Folder)
        .filter(
            models.Folder.id == folder_id,
            models.Folder.user_id == user_id,
            models.Folder.is_active == True,
        )
        .first()
    )
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")

    # Move searches to unfiled (folder_id = NULL)
    (
        db.query(models.SavedSearch)
        .filter(
            models.SavedSearch.user_id == user_id,
            models.SavedSearch.is_active == True,
            models.SavedSearch.folder_id == folder_id,
        )
        .update({"folder_id": None})
    )

    folder.is_active = False
    db.commit()

    return {"status": "deleted", "id": folder_id}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from app.permissions import require_permission
from app.models import generate_requirement_code


router = APIRouter(
    prefix="/v1/client",
    tags=["Client Admin"]
)

# ---------------------------------------------------------
# ADMIN CREATES NEW CLIENT
# ---------------------------------------------------------
@router.post("/master", status_code=201)
@require_permission("admin", "create")
def create_client(
    payload: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client = models.User(
        full_name=payload.full_name,
        email=payload.email,
        company_name=payload.company_name,
        role="client",
        is_active=True,
        created_at=datetime.utcnow()
    )

    db.add(client)
    db.commit()
    db.refresh(client)

    return {
        "message": "Client created successfully",
        "client_id": client.id
    }

# ---------------------------------------------------------
# ADMIN - GET ALL CLIENTS
# ---------------------------------------------------------
@router.get("/master")
def get_all_clients(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    clients = (
        db.query(models.User)
        .filter(models.User.role == "client")
        .order_by(models.User.created_at.desc())
        .all()
    )

    response = []

    for c in clients:
        account_manager_name = None

        if c.account_manager_id:
            account_manager_name = (
                db.query(models.User.full_name)
                .filter(models.User.id == c.account_manager_id)
                .scalar()
            )

        response.append({
            "id": c.id,
            "name": c.full_name,
            "email": c.email,
            "company_name": c.company_name,
            "is_active": c.is_active,
            "created_at": c.created_at,
            "account_manager": {
                "id": c.account_manager_id,
                "name": account_manager_name
            }
        })

    return response

# ---------------------------------------------------------
# ADMIN LOCK CLIENT
# ---------------------------------------------------------
@router.patch("/master/{client_id}/lock")
@require_permission("client", "update")

def lock_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client = db.query(models.User).filter(
        models.User.id == client_id,
        models.User.role == "client"
    ).first()

    if not client:
        raise HTTPException(404, "Client not found")

    client.is_active = False
    db.commit()

    return {"message": "Client locked successfully"}

# ---------------------------------------------------------
# ADMIN UNLOCK CLIENT
# ---------------------------------------------------------
@router.patch("/master/{client_id}/unlock")
@require_permission("client", "update")

def unlock_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    client = db.query(models.User).filter(
        models.User.id == client_id,
        models.User.role == "client"
    ).first()

    if not client:
        raise HTTPException(404, "Client not found")

    client.is_active = True
    db.commit()

    return {"message": "Client unlocked successfully"}

@router.post("/{client_id}/requirements", status_code=201)
def create_client_requirement(
    client_id: str,
    payload: schemas.ClientRequirementCreate,   # ⚠️ schema exist hona chahiye
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Check client exists
    client = db.query(models.User).filter(
        models.User.id == client_id,
        models.User.role == "client"
    ).first()

    if not client:
        raise HTTPException(404, "Client not found")

    req = models.Requirement(
    requirement_code=generate_requirement_code(db),  # ✅ RIGHT PLACE
    client_id=client_id,
    account_manager_id=client.account_manager_id,  # ⭐ ADD
    title=payload.title,
    skills=payload.skills,
    budget=payload.budget,
    sla=payload.sla,
    location=payload.location,
    duration=payload.duration,
    status="NEW",
    created_at=datetime.utcnow()
)



    db.add(req)
    db.commit()
    db.refresh(req)

    return {
    "message": "Requirement created successfully",
    "requirement_code": req.requirement_code
}




@router.get("/{client_id}/requirements")
def get_client_requirements(
    client_id: str,
    db: Session = Depends(get_db),
):
    requirements = (
        db.query(models.Requirement)
        .filter(models.Requirement.client_id == client_id)
        .all()
    )

    return [
        {
            "id": r.id,                     # ✅ FIXED
            "requirement_code": r.requirement_code,
            "title": r.title,
            "status": r.status,
            "skills": r.skills.split(",") if r.skills else [],
            "budget": r.budget,
            "sla": r.sla,
            "location": r.location,
            "duration": r.duration,
            "created_at": r.created_at,
            "job_id": r.job_id
        }
        for r in requirements   # ✅ THIS WAS MISSING / BROKEN
    ]

@router.put("/master/{client_id}/assign-account-manager")
def assign_account_manager(
    client_id: str,
    payload: schemas.AssignAccountManagerRequest,
    db: Session = Depends(get_db)
):
    client = db.query(models.User).filter(
        models.User.id == client_id,
        models.User.role == "client"
    ).first()

    if not client:
        raise HTTPException(404, "Client not found")

    am = db.query(models.User).filter(
        models.User.id == payload.account_manager_id,
        models.User.role == "account_manager"
    ).first()

    if not am:
        raise HTTPException(404, "Account Manager not found")

    # 1️⃣ Assign AM to client
    client.account_manager_id = am.id

    # 2️⃣ 🔥 AUTO-ASSIGN ALL EXISTING REQUIREMENTS
    db.query(models.Requirement).filter(
        models.Requirement.client_id == client_id
    ).update({
        models.Requirement.account_manager_id: am.id
    })

    db.commit()

    return {
        "message": "Account Manager assigned successfully",
        "client_id": client_id,
        "account_manager_id": am.id
    }

# ---------------------------------------------------------
# ADMIN - LIST ACCOUNT MANAGERS
# ---------------------------------------------------------
@router.get("/admin/account-managers")
def list_account_managers(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    account_managers = (
        db.query(models.User)
        .filter(
            models.User.role == "account_manager",
            models.User.is_active == True
        )
        .all()
    )

    return [
        {
            "id": am.id,
            "full_name": am.full_name,
            "email": am.email
        }
        for am in account_managers
    ]

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid

from app.db import get_db
from app import models, schemas
from app.auth import get_current_user

router = APIRouter(
    prefix="/v1/consultant-deployments",
    tags=["Consultant Deployments"]
)

security = HTTPBearer()


# ======================================================
# 1️⃣ DEPLOY CONSULTANT (AUTO STATUS → deployed)
# ======================================================
@router.post(
    "",
    response_model=schemas.ConsultantDeploymentResponse,
    status_code=201,
    dependencies=[Depends(security)]
)
def deploy_consultant(
    payload: schemas.ConsultantDeploymentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == payload.consultantId
    ).first()

    if not consultant:
        raise HTTPException(404, "Consultant not found")

    if consultant.status == "deployed":
        raise HTTPException(400, "Consultant already deployed")

    deployment = models.ConsultantDeployment(
        id=str(uuid.uuid4()),
        consultant_id=payload.consultantId,
         # ✅ MAIN FIX — client_id MUST come from consultant
    client_id=consultant.client_id,

    # ✅ client_name auto-fill (safe)
    client_name=(
        consultant.client.company_name
        if consultant.client else None
    ),
        role=payload.role,
        start_date=payload.startDate,
        end_date=payload.endDate,
        billing_type=payload.billingType,
        billing_rate=payload.billingRate,
        payout_rate=payload.payoutRate,
        status="active",
        created_at=datetime.utcnow()
    )

    # ✅ AUTO UPDATE CONSULTANT STATUS
    consultant.status = "deployed"

    db.add(deployment)
    db.commit()
    db.refresh(deployment)

    return deployment


# ======================================================
# 2️⃣ GET SINGLE DEPLOYMENT
# ======================================================
@router.get(
    "/{deployment_id}",
    response_model=schemas.ConsultantDeploymentResponse,
    dependencies=[Depends(security)]
)
def get_deployment(
    deployment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    deployment = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.id == deployment_id
    ).first()

    if not deployment:
        raise HTTPException(404, "Deployment not found")

    return deployment


# ======================================================
# 3️⃣ END DEPLOYMENT (AUTO STATUS → available)
# ======================================================
@router.put(
    "/{deployment_id}/end",
    response_model=schemas.ConsultantDeploymentResponse,
    dependencies=[Depends(security)]
)
def end_deployment(
    deployment_id: str,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    deployment = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.id == deployment_id
    ).first()

    if not deployment:
        raise HTTPException(404, "Deployment not found")

    if deployment.status == "ended":
        raise HTTPException(400, "Deployment already ended")

    deployment.status = "ended"
    deployment.end_date = end_date or datetime.utcnow()

    # ✅ AUTO UPDATE CONSULTANT STATUS
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == deployment.consultant_id
    ).first()

    if consultant:
        consultant.status = "available"

    db.commit()
    db.refresh(deployment)

    return deployment

@router.get(
    "",
    response_model=List[schemas.ConsultantDeploymentListItem],
    dependencies=[Depends(security)]
)
def list_deployments(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 🔐 ONLY consultant can access
    if current_user.get("role") != "consultant":
        raise HTTPException(403, "Access denied")

    consultant = (
        db.query(models.Consultant)
        .filter(models.Consultant.user_id == current_user["id"])
        .first()
    )

    if not consultant:
        return []  # 👈 frontend me "No deployments found"

    q = (
        db.query(models.ConsultantDeployment)
        .filter(models.ConsultantDeployment.consultant_id == consultant.id)
    )

    if status:
        q = q.filter(models.ConsultantDeployment.status == status)

    deployments = q.order_by(
        models.ConsultantDeployment.start_date.desc()
    ).all()

    return [
        schemas.ConsultantDeploymentListItem(
            id=d.id,
            consultant_name=consultant.candidate.full_name,
            client_name=d.client_name or "—",
            role=d.role or "—",
            start_date=d.start_date,
            end_date=d.end_date,
            status=d.status,
        )
        for d in deployments
    ]


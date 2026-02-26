from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from datetime import datetime
from app import schemas

from app.db import get_db
from app.auth import get_current_user
from app import models
from app.schemas import ConsultantDashboardResponse, ConsultantActiveDeployment
from app.auth import get_password_hash
from app.auth import verify_password
router = APIRouter(
    prefix="/v1/consultant",
    tags=["Consultant Dashboard"]
)

security = HTTPBearer()


@router.get(
    "/dashboard",
    response_model=ConsultantDashboardResponse,
    dependencies=[Depends(security)]
)
def consultant_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 🔐 Role check
    if current_user.get("role") != "consultant":
        raise HTTPException(status_code=403, detail="Access denied")

    # 🔍 Fetch consultant
    consultant = (
        db.query(models.Consultant)
        .filter(models.Consultant.user_id == current_user["id"])
        .first()
    )

    if not consultant:
        raise HTTPException(404, "Consultant profile not found")

    # 📦 Active deployment
    active = (
        db.query(models.ConsultantDeployment)
        .filter(
            models.ConsultantDeployment.consultant_id == consultant.id,
            models.ConsultantDeployment.status == "active"
        )
        .order_by(models.ConsultantDeployment.start_date.desc())
        .first()
    )

    active_deployment = None
    if active:
        active_deployment = ConsultantActiveDeployment(
            id=active.id,
            client_name=active.client_name,
            role=active.role,
            start_date=active.start_date,
            end_date=active.end_date,
            billing_rate=active.billing_rate,
            payout_rate=active.payout_rate,
        )

    total_deployments = (
        db.query(models.ConsultantDeployment)
        .filter(models.ConsultantDeployment.consultant_id == consultant.id)
        .count()
    )

    return ConsultantDashboardResponse(
        consultant_id=consultant.id,
        status=consultant.status,
        type=consultant.type.value,
        payroll_ready=consultant.payroll_ready,
        active_deployment=active_deployment,
        total_deployments=total_deployments,
        server_time=datetime.utcnow()
    )

@router.get(
    "/me",
    response_model=schemas.ConsultantProfileResponse,
    dependencies=[Depends(security)]
)
def get_my_consultant_profile(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "consultant":
        raise HTTPException(status_code=403, detail="Access denied")

    consultant = (
        db.query(models.Consultant)
        .filter(models.Consultant.user_id == current_user["id"])
        .first()
    )

    if not consultant:
        raise HTTPException(404, "Consultant profile not found")

    candidate = consultant.candidate  # 🔥 JOINED DATA

    return {
    "id": consultant.id,
    "consultant_code": consultant.consultant_code,
    "type": consultant.type.value,
    "status": consultant.status,
    "payroll_ready": consultant.payroll_ready,
    "created_at": consultant.created_at,

    "candidate_id": consultant.candidate_id,
    "full_name": candidate.full_name if candidate else None,
    "email": candidate.email if candidate else None,
    "phone": candidate.phone if candidate else None,
    "designation": getattr(candidate, "designation", None),


    "skills": candidate.skills or [] if candidate else [],
    "experience_years": candidate.experience_years if candidate else None,
    "education": candidate.education if candidate else None,
    "current_location": getattr(candidate, "current_location", None),
}


@router.put(
    "/me",
    dependencies=[Depends(security)]
)
def update_my_consultant_profile(
    payload: schemas.ConsultantSelfUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "consultant":
        raise HTTPException(status_code=403, detail="Access denied")

    consultant = (
        db.query(models.Consultant)
        .filter(models.Consultant.user_id == current_user["id"])
        .first()
    )

    if not consultant:
        raise HTTPException(404, "Consultant profile not found")

    candidate = consultant.candidate
    if not candidate:
        raise HTTPException(404, "Linked candidate not found")

    # ✅ Update allowed fields only
    if payload.phone is not None:
        candidate.phone = payload.phone

    if payload.current_location is not None:
        candidate.current_location = payload.current_location

    if payload.education is not None:
        candidate.education = payload.education

    if payload.experience_years is not None:
        candidate.experience_years = payload.experience_years

    if payload.skills is not None:
        candidate.skills = payload.skills

    candidate.updated_at = datetime.utcnow()

    db.commit()

    return {"message": "Profile updated successfully"}

@router.post("/change-password", dependencies=[Depends(security)])
def change_my_password(
    payload: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "consultant":
        raise HTTPException(status_code=403, detail="Access denied")

    user = db.query(models.User).filter(
        models.User.id == current_user["id"]
    ).first()

    if not user:
        raise HTTPException(404, "User not found")


    if payload.password != payload.confirm_password:
        raise HTTPException(400, "Passwords do not match")

    user.password = get_password_hash(payload.password)
    user.must_change_password = False
    db.commit()

    return {"message": "Password changed successfully"}
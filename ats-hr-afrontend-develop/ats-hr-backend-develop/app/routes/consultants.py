from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from app.models import ConsultantType, CandidateClassification
from app import models
import secrets
from app.auth import get_password_hash
from app.utils.email import send_email

router = APIRouter(prefix="/v1/consultants", tags=["Consultants"])
security = HTTPBearer()


# ======================================================
# 🔁 SAFE ENUM PARSER
# ======================================================
def parse_consultant_type(value: str):
    try:
        return ConsultantType(value.lower())
    except Exception:
        raise HTTPException(400, "Invalid consultant type. Use sourcing or payroll")



# ======================================================
# 2️⃣ GET CONSULTANT
# ======================================================
@router.get(
    "/{consultant_id}",
    response_model=schemas.ConsultantResponse,
    dependencies=[Depends(security)]
)
def get_consultant(
    consultant_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == consultant_id
    ).first()

    if not consultant:
        raise HTTPException(404, "Consultant not found")

    return consultant


# ======================================================
# 3️⃣ RE-CLASSIFY CONSULTANT
# ======================================================
@router.put(
    "/{consultant_id}/classify",
    response_model=schemas.ConsultantResponse,
    dependencies=[Depends(security)]
)
def classify_consultant(
    consultant_id: str,
    payload: schemas.ConsultantClassify,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == consultant_id
    ).first()

    if not consultant:
        raise HTTPException(404, "Consultant not found")

    consultant.type = parse_consultant_type(payload.type)
    consultant.payroll_ready = False

    db.commit()
    db.refresh(consultant)

    return consultant


# ======================================================
# 4️⃣ SOURCING CONFIG
@router.post(
    "/from-candidate/{candidate_id}",
    response_model=schemas.ConsultantResponse,
    status_code=201,
    dependencies=[Depends(security)]
)
def convert_candidate_to_consultant(
    candidate_id: str,
    payload: schemas.ConvertCandidateToConsultantRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    print("\n================= CONVERT CANDIDATE =================")
    print("Candidate ID:", candidate_id)

    # 1️⃣ Fetch candidate
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()

    if not candidate:
        print("❌ Candidate not found")
        raise HTTPException(404, "Candidate not found")

    # ❌ BLOCK MERGED CANDIDATE
    if candidate.merged_into_id:
        print("❌ Candidate is merged into:", candidate.merged_into_id)
        raise HTTPException(
            status_code=400,
            detail="Merged candidate cannot be converted. Convert primary profile only."
        )

    print("Candidate Email:", candidate.email)
    print("Candidate Classification:", candidate.classification)

    # 2️⃣ Candidate must be classified
    if candidate.classification == CandidateClassification.unclassified:
        print("❌ Candidate not classified")
        raise HTTPException(
            400,
            "Candidate must be classified as payroll or sourcing before conversion"
        )

    # 3️⃣ Validate client
    client = db.query(models.User).filter(
        models.User.id == payload.client_id,
        models.User.role == "client"
    ).first()

    if not client:
        print("❌ Invalid client:", payload.client_id)
        raise HTTPException(400, "Valid client is required")

    print("Client ID:", client.id)

    # 4️⃣ Prevent double conversion
    existing = db.query(models.Consultant).filter(
        models.Consultant.candidate_id == candidate.id
    ).first()

    if existing:
        print("❌ Candidate already converted:", existing.id)
        raise HTTPException(400, "Candidate already converted to consultant")

    # 5️⃣ EMAIL SOURCE
    if not candidate.email:
        print("❌ Candidate email missing")
        raise HTTPException(400, "Candidate email is required")

    # 6️⃣ Create / fetch USER
    user = db.query(models.User).filter(
        models.User.email == candidate.email
    ).first()

    temp_password = None

    if not user:
        temp_password = secrets.token_urlsafe(8)
        hashed_password = get_password_hash(temp_password)

        print("🆕 NEW USER CREATED")
        print("Login Email:", candidate.email)
        print("Temporary Password:", temp_password)

        user = models.User(
            username=candidate.email.split("@")[0],
            email=candidate.email,
            password=hashed_password,
            role="consultant",
            full_name=candidate.full_name,
            must_change_password=True,
            linked_candidate_id=candidate.id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        print("♻️ EXISTING USER FOUND")
        print("Login Email:", user.email)
        print("Password NOT regenerated")

        user.role = "consultant"
        user.must_change_password = True
        user.linked_candidate_id = candidate.id
        db.commit()

    # 7️⃣ Consultant type
    consultant_type = ConsultantType(candidate.classification.value)
    print("Consultant Type:", consultant_type)

    consultant = models.Consultant(
        candidate_id=candidate.id,
        user_id=user.id,
        client_id=payload.client_id,
        consultant_code=f"CONS-{int(datetime.utcnow().timestamp())}",
        type=consultant_type,
        status="available",
        payroll_ready=False,
        created_at=datetime.utcnow()
    )

    db.add(consultant)

    # 8️⃣ Lock candidate
    candidate.status = "converted"
    candidate.is_active = False
    candidate.converted_at = datetime.utcnow()

    db.commit()
    db.refresh(consultant)

    print("✅ CONSULTANT CREATED")
    print("Consultant ID:", consultant.id)
    print("User ID:", user.id)
    print("=====================================================\n")

    # 9️⃣ Send email only if password generated
    if temp_password:
        try:
            send_email(
                to=candidate.email,
                subject="Your Consultant Account Created",
                body=f"""
Hi {candidate.full_name},

Your consultant account has been created.

Login Email: {candidate.email}
Temporary Password: {temp_password}

Please login and change your password.

Regards,
HR Team
"""
            )
        except Exception as e:
            print("❌ Email sending failed:", e)

    return consultant


# ======================================================
# 5️⃣ PAYROLL SETUP
# ======================================================
@router.put(
    "/{consultant_id}/payroll-setup",
    response_model=schemas.ConsultantResponse,
    dependencies=[Depends(security)]
)
def set_payroll_config(
    consultant_id: str,
    payload: schemas.ConsultantPayrollSetup,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == consultant_id
    ).first()

    if not consultant:
        raise HTTPException(404, "Consultant not found")

    if consultant.type != models.ConsultantType.payroll:
        raise HTTPException(400, "Only payroll consultants allowed")

    consultant.billing_rate = payload.billingRate
    consultant.payout_rate = payload.payoutRate
    consultant.payroll_ready = True

    db.commit()
    db.refresh(consultant)

    return consultant


# ======================================================
# 6️⃣ LIST CONSULTANTS
# ======================================================
@router.get(
    "",
    response_model=List[schemas.ConsultantResponse],
    dependencies=[Depends(security)]
)
def list_consultants(
    type: Optional[str] = Query(None),
    ready: Optional[bool] = Query(None),
    limit: int = Query(20),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(models.Consultant)

    if type:
        q = q.filter(models.Consultant.type == parse_consultant_type(type))

    if ready is not None:
        q = q.filter(models.Consultant.payroll_ready == ready)

    consultants = (
        q.order_by(models.Consultant.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []
    for c in consultants:
        result.append({
            "id": c.id,
            "candidate_id": c.candidate_id,

            # ✅ FINAL CORRECT SOURCE
            "full_name": c.candidate.full_name if c.candidate else None,
            "email": c.candidate.email if c.candidate else None,
            "phone": c.candidate.phone if c.candidate else None,

            # ✅ ENUM FIX
            "type": c.type.value if hasattr(c.type, "value") else c.type,
            "status": c.status,
            "payroll_ready": c.payroll_ready,
            "created_at": c.created_at,
        })

    return result

# ======================================================
# 7️⃣ CONSULTANT DEPLOYMENT ELIGIBILITY CHECK
# ======================================================
@router.get(
    "/{consultant_id}/deployment-eligibility",
    response_model=schemas.ConsultantEligibilityResponse,
    dependencies=[Depends(security)]
)
def check_deployment_eligibility(
    consultant_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == consultant_id
    ).first()

    if not consultant:
        raise HTTPException(404, "Consultant not found")

    reasons = []

    if consultant.type != models.ConsultantType.payroll:
        reasons.append("Consultant is not payroll type")

    if not consultant.billing_rate:
        reasons.append("Billing rate not configured")

    if not consultant.payout_rate:
        reasons.append("Payout rate not configured")

    if not consultant.payroll_ready:
        reasons.append("Payroll setup not completed")

    if consultant.status == "deployed":
        reasons.append("Consultant already deployed")

    return {
        "consultantId": consultant.id,
        "eligible": len(reasons) == 0,
        "reasons": reasons
    }


# ======================================================
# 8️⃣ VALIDATE ELIGIBILITY (Used before deployment)
# ======================================================
@router.post(
    "/{consultant_id}/validate-eligibility",
    response_model=schemas.ConsultantEligibilityResponse,
    dependencies=[Depends(security)]
)
def validate_deployment_eligibility(
    consultant_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = check_deployment_eligibility(
        consultant_id=consultant_id,
        db=db,
        current_user=current_user
    )

    if not result["eligible"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Consultant not eligible for deployment",
                "reasons": result["reasons"]
            }
        )

    return result


# ======================================================
# 7️⃣ CONSULTANT SUMMARY (Dashboard View)
# ======================================================
@router.get(
    "/{consultant_id}/summary",
    dependencies=[Depends(security)]
)
def consultant_summary(
    consultant_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    consultant = (
        db.query(models.Consultant)
        .filter(models.Consultant.id == consultant_id)
        .first()
    )

    if not consultant:
        raise HTTPException(404, "Consultant not found")

    deployments = (
        db.query(models.ConsultantDeployment)
        .filter(models.ConsultantDeployment.consultant_id == consultant_id)
        .all()
    )

    active_deployment = next(
        (d for d in deployments if d.status == "active"),
        None
    )

    return {
        "consultant": {
            "id": consultant.id,
            "candidateId": consultant.candidate_id,
            "type": consultant.type,
            "status": consultant.status,
            "payrollReady": consultant.payroll_ready,
            "createdAt": consultant.created_at,
        },
        "stats": {
            "totalDeployments": len(deployments),
            "activeDeployment": {
                "id": active_deployment.id,
                "clientName": active_deployment.client_name,
                "role": active_deployment.role,
                "startDate": active_deployment.start_date,
                "billingType": active_deployment.billing_type,
                "billingRate": active_deployment.billing_rate,
            } if active_deployment else None
        }
    }

@router.post(
    "/{consultant_id}/reset-password",
    dependencies=[Depends(security)]
)
def reset_consultant_password(
    consultant_id: str,
    payload: schemas.EmployeeResetPasswordRequest,  # reuse schema
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 🔐 Only Admin / HR allowed
    if current_user["role"] not in ["admin", "super_admin"]:
        raise HTTPException(403, "Not allowed")

    consultant = db.query(models.Consultant).filter(
        models.Consultant.id == consultant_id
    ).first()

    if not consultant:
        raise HTTPException(404, "Consultant not found")

    user = db.query(models.User).filter(
        models.User.id == consultant.user_id
    ).first()

    if not user:
        raise HTTPException(404, "User account not found")

    user.password = get_password_hash(payload.password)
    user.must_change_password = True
    db.commit()

    try:
        send_email(
            to=user.email,
            subject="Password Reset by HR",
            body=f"""
Hi {user.full_name or 'Consultant'},

Your password has been reset by HR.

Please login and change your password immediately.

Regards,
HR Team
"""
        )
    except Exception as e:
        print("Consultant reset email failed:", e)

    return {"message": "Consultant password reset successfully"}

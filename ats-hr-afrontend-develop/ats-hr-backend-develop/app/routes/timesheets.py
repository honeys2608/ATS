from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
from sqlalchemy import or_
from app.db import get_db
from app import models, schemas
from app.auth import get_current_user
from sqlalchemy.orm import joinedload
router = APIRouter(
    prefix="/v1/timesheets",
    tags=["Timesheets"]
)

security = HTTPBearer()

# ======================================================
# 1️⃣ CREATE / UPDATE TIMESHEET (CONSULTANT)
# ======================================================
@router.post(
    "/deployments/{deployment_id}",
    response_model=schemas.TimesheetResponse,
    dependencies=[Depends(security)]
)
def create_or_update_timesheet(
    deployment_id: str,
    payload: schemas.TimesheetCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "consultant":
        raise HTTPException(403, "Only consultant can create timesheet")

    deployment = db.query(models.ConsultantDeployment).filter(
        models.ConsultantDeployment.id == deployment_id
    ).first()

    if not deployment:
        raise HTTPException(404, "Deployment not found")

    consultant = db.query(models.Consultant).filter(
        models.Consultant.user_id == current_user["id"]
    ).first()

    if not consultant or consultant.id != deployment.consultant_id:
        raise HTTPException(403, "Not your deployment")

    # 🔍 ONLY reuse DRAFT timesheet
    timesheet = db.query(models.Timesheet).filter(
        models.Timesheet.deployment_id == deployment_id,
        models.Timesheet.period_start == payload.period_start,
        models.Timesheet.period_end == payload.period_end,
        models.Timesheet.status == models.TimesheetStatus.draft

    ).first()

    # 🆕 ALWAYS create new if none or submitted exists
    if not timesheet:
        timesheet = models.Timesheet(
            id=str(uuid.uuid4()),
            deployment_id=deployment_id,
            consultant_id=consultant.id,
            client_id=deployment.client_id,
            period_type=payload.period_type,
            period_start=payload.period_start,
            period_end=payload.period_end,
            status=models.TimesheetStatus.draft,

            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(timesheet)
        db.flush()

    # Remove old entries
    db.query(models.TimesheetEntry).filter(
        models.TimesheetEntry.timesheet_id == timesheet.id
    ).delete()

    total_hours = 0
    for e in payload.entries:
        total_hours += e.hours
        db.add(models.TimesheetEntry(
            id=str(uuid.uuid4()),
            timesheet_id=timesheet.id,
            work_date=e.work_date,
            hours=e.hours,
            description=e.description,
            created_at=datetime.utcnow()
        ))

    timesheet.total_hours = total_hours
    timesheet.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(timesheet)
    return timesheet


# ======================================================
# 2️⃣ SUBMIT TIMESHEET (CONSULTANT)
@router.post(
    "/{timesheet_id}/submit",
    response_model=schemas.TimesheetResponse,
    dependencies=[Depends(security)]
)
def submit_timesheet(
    timesheet_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "consultant":
        raise HTTPException(403, "Only consultant can submit")

    timesheet = db.query(models.Timesheet).filter(
        models.Timesheet.id == timesheet_id
    ).first()

    if not timesheet:
        raise HTTPException(404, "Timesheet not found")

    # ✅ ENUM SAFE CHECK
    if timesheet.status != models.TimesheetStatus.draft:
        raise HTTPException(
            400,
            f"Invalid state: {timesheet.status}"
        )

    # ✅ ENUM SAFE ASSIGN
    timesheet.status = models.TimesheetStatus.submitted
    timesheet.submitted_at = datetime.utcnow()
    timesheet.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(timesheet)
    return timesheet


# ======================================================
# 3️⃣ AM APPROVE TIMESHEET
# ======================================================
@router.post(
    "/{timesheet_id}/am-approve",
    response_model=schemas.TimesheetResponse,
    dependencies=[Depends(security)]
)
def am_approve_timesheet(
    timesheet_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "account_manager":
        raise HTTPException(403, "Only AM can approve")

    timesheet = db.query(models.Timesheet).filter(
        models.Timesheet.id == timesheet_id
    ).first()

    if not timesheet or timesheet.status != models.TimesheetStatus.submitted:

        raise HTTPException(400, "Invalid timesheet state")

    timesheet.status = models.TimesheetStatus.am_approved

    timesheet.am_approved_at = datetime.utcnow()
    timesheet.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(timesheet)
    return timesheet


# ======================================================
# 4️⃣ CLIENT APPROVE TIMESHEET
# ======================================================
@router.post(
    "/{timesheet_id}/client-approve",
    response_model=schemas.TimesheetResponse,
    dependencies=[Depends(security)]
)
def client_approve_timesheet(
    timesheet_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "client":
        raise HTTPException(403, "Only client can approve")

    timesheet = db.query(models.Timesheet).filter(
        models.Timesheet.id == timesheet_id
    ).first()

    if not timesheet or timesheet.status != models.TimesheetStatus.am_approved:
        raise HTTPException(400, "Invalid timesheet state")

    timesheet.status = models.TimesheetStatus.client_approved
    timesheet.client_approved_at = datetime.utcnow()
    timesheet.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(timesheet)
    return timesheet


# ======================================================
# 5️⃣ REJECT TIMESHEET (AM / CLIENT)
# ======================================================
@router.post(
    "/{timesheet_id}/reject",
    response_model=schemas.TimesheetResponse,
    dependencies=[Depends(security)]
)
def reject_timesheet(
    timesheet_id: str,
    payload: schemas.TimesheetRejectRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") not in ["account_manager", "client"]:
        raise HTTPException(403, "Access denied")

    timesheet = db.query(models.Timesheet).filter(
        models.Timesheet.id == timesheet_id
    ).first()

    if not timesheet:
        raise HTTPException(404, "Timesheet not found")

    timesheet.status = models.TimesheetStatus.rejected

    timesheet.rejection_reason = payload.reason
    timesheet.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(timesheet)
    return timesheet


# ======================================================
# 6️⃣ LIST TIMESHEETS (ROLE BASED)
# ======================================================
@router.get(
    "",
    response_model=schemas.ConsultantTimesheetListResponse,
    dependencies=[Depends(security)]
)
def list_timesheets(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    role = current_user.get("role")
    q = db.query(models.Timesheet)

    if role == "consultant":
        consultant = db.query(models.Consultant).filter(
            models.Consultant.user_id == current_user["id"]
        ).first()
        if not consultant:
            return {"total": 0, "timesheets": []}
        q = q.filter(models.Timesheet.consultant_id == consultant.id)

    elif role == "account_manager":
        q = q.filter(models.Timesheet.status == models.TimesheetStatus.submitted)


    elif role == "client":
        q = q.filter(
        models.Timesheet.status == models.TimesheetStatus.am_approved
    )


    else:
        raise HTTPException(403, "Access denied")

    if status:
        q = q.filter(models.Timesheet.status == status)

    timesheets = q.order_by(models.Timesheet.created_at.desc()).all()
    return {"total": len(timesheets), "timesheets": timesheets}

@router.get(
    "/consultant",
    response_model=schemas.ConsultantTimesheetListResponse,
    dependencies=[Depends(security)]
)
def list_consultant_timesheets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "consultant":
        raise HTTPException(403, "Access denied")

    consultant = (
        db.query(models.Consultant)
        .filter(models.Consultant.user_id == current_user["id"])
        .first()
    )

    if not consultant:
        return {"total": 0, "timesheets": []}

    timesheets = (
        db.query(models.Timesheet)
        .filter(models.Timesheet.consultant_id == consultant.id)
        .order_by(models.Timesheet.created_at.desc())
        .all()
    )

    return {
        "total": len(timesheets),
        "timesheets": timesheets
    }
@router.get("/am/timesheets")
def list_am_timesheets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    timesheets = (
        db.query(models.Timesheet)
        .options(
            joinedload(models.Timesheet.entries),
            joinedload(models.Timesheet.consultant).joinedload(models.Consultant.candidate),
            joinedload(models.Timesheet.client)
        )
        .filter(models.Timesheet.status == models.TimesheetStatus.submitted)
        .all()
    )

    result = []

    for t in timesheets:
        result.append({
            "id": t.id,

            "consultant_name": (
                t.consultant.candidate.full_name
                if t.consultant and t.consultant.candidate
                else None
            ),

            "client_name": (
                t.client.full_name
                if t.client
                else None
            ),

            "period_start": t.period_start,
            "period_end": t.period_end,
            "total_hours": t.total_hours,
            "status": t.status.value,

            "entries": [
                {
                    "id": e.id,
                    "work_date": e.work_date,
                    "hours": e.hours,
                    "description": e.description
                }
                for e in t.entries
            ]
        })

    return {"timesheets": result}

@router.get("/client")
def list_client_timesheets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "client":
        raise HTTPException(403, "Access denied")

    timesheets = (
        db.query(models.Timesheet)
        .options(
            joinedload(models.Timesheet.entries),
            joinedload(models.Timesheet.consultant)
                .joinedload(models.Consultant.candidate)
        )
        .filter(
            models.Timesheet.client_id == current_user["id"],
            or_(
                models.Timesheet.status == models.TimesheetStatus.am_approved,
                models.Timesheet.status == models.TimesheetStatus.client_approved,
                models.Timesheet.status == models.TimesheetStatus.rejected
            )
        )
        .order_by(models.Timesheet.updated_at.desc())
        .all()
    )

    result = []
    for t in timesheets:
        result.append({
            "id": t.id,
            "consultant_name": (
                t.consultant.candidate.full_name
                if t.consultant and t.consultant.candidate
                else None
            ),
            "period_start": t.period_start,
            "period_end": t.period_end,
            "total_hours": t.total_hours,
            "status": t.status.value,
            "entries": [
                {
                    "id": e.id,
                    "work_date": e.work_date,
                    "hours": e.hours,
                    "description": e.description
                } for e in t.entries
            ]
        })

    return {"timesheets": result}

@router.get(
    "/am/pending",
    response_model=schemas.AMTimesheetListResponse
)
def am_pending_timesheets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "account_manager":
        raise HTTPException(403, "Only Account Manager allowed")

    timesheets = (
        db.query(models.Timesheet)
        .filter(models.Timesheet.status == models.TimesheetStatus.submitted)
        .order_by(models.Timesheet.submitted_at.desc())
        .all()
    )

    return {
        "total": len(timesheets),
        "timesheets": timesheets
    }

@router.post(
    "/{timesheet_id}/am-reject",
    response_model=schemas.TimesheetResponse
)
def am_reject_timesheet(
    timesheet_id: str,
    payload: schemas.TimesheetRejectRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "account_manager":
        raise HTTPException(403, "Only Account Manager allowed")

    ts = db.query(models.Timesheet).filter(
        models.Timesheet.id == timesheet_id
    ).first()

    if not ts:
        raise HTTPException(404, "Timesheet not found")

    ts.status = models.TimesheetStatus.rejected
    ts.rejection_reason = payload.reason
    ts.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(ts)
    return ts

@router.get(
    "/client/pending",
    response_model=schemas.ClientTimesheetListResponse
)
def client_pending_timesheets(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "client":
        raise HTTPException(403, "Only Client allowed")

    timesheets = (
        db.query(models.Timesheet)
        .filter(
            models.Timesheet.client_id == current_user["id"],
            models.Timesheet.status == models.TimesheetStatus.am_approved

        )
        .order_by(models.Timesheet.am_approved_at.desc())
        .all()
    )

    return {
        "total": len(timesheets),
        "timesheets": timesheets
    }


@router.get(
    "/{timesheet_id}",
    response_model=schemas.TimesheetResponse,
    dependencies=[Depends(security)]
)
def get_timesheet_by_id(
    timesheet_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    role = current_user.get("role")

    q = (
        db.query(models.Timesheet)
        .options(joinedload(models.Timesheet.entries))
        .filter(models.Timesheet.id == timesheet_id)
    )

    timesheet = q.first()

    if not timesheet:
        raise HTTPException(404, "Timesheet not found")

    # 🔐 ROLE CHECK
    if role == "consultant":
        consultant = db.query(models.Consultant).filter(
            models.Consultant.user_id == current_user["id"]
        ).first()

        if not consultant or timesheet.consultant_id != consultant.id:
            raise HTTPException(403, "Access denied")

    elif role == "account_manager":
        pass  # AM can view submitted timesheets

    elif role == "client":
        if timesheet.client_id != current_user["id"]:
            raise HTTPException(403, "Access denied")

    else:
        raise HTTPException(403, "Access denied")

    return timesheet

@router.get("/am/history")
def am_timesheet_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.get("role") != "account_manager":
        raise HTTPException(403, "Access denied")

    timesheets = (
        db.query(models.Timesheet)
        .options(
            joinedload(models.Timesheet.consultant)
                .joinedload(models.Consultant.candidate),
            joinedload(models.Timesheet.client)
        )
        .filter(
            or_(
                models.Timesheet.status == models.TimesheetStatus.am_approved,
                models.Timesheet.status == models.TimesheetStatus.client_approved,
                models.Timesheet.status == models.TimesheetStatus.rejected
            )
        )
        .order_by(models.Timesheet.updated_at.desc())
        .all()
    )

    return {
        "timesheets": [
            {
                "id": t.id,
                "consultant_name": (
                    t.consultant.candidate.full_name
                    if t.consultant and t.consultant.candidate
                    else None
                ),
                "client_name": t.client.full_name if t.client else None,
                "status": t.status.value,
                "period_start": t.period_start,
                "period_end": t.period_end,
                "total_hours": t.total_hours,
                "updated_at": t.updated_at,
                "rejection_reason": t.rejection_reason
            }
            for t in timesheets
        ]
    }

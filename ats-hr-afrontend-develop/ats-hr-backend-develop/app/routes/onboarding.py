from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.db import get_db
from app import models
from app.auth import get_current_user
from app.permissions import require_permission
from fastapi.encoders import jsonable_encoder
from app.email_service import send_email

router = APIRouter(prefix="/v1/onboarding", tags=["Onboarding"])


# --------------------------------------------------------
# DEFAULT TASKS
# --------------------------------------------------------
DEFAULT_ONBOARDING_TASKS = [
    {"title": "Complete Personal Information Form", "task_type": "personal_info", "days_offset": 0},
    {"title": "Submit Government Identity Documents", "task_type": "id_documents", "days_offset": 0},
    {"title": "Submit Bank Account Details", "task_type": "bank_details", "days_offset": 1},
    {"title": "Add Emergency Contact", "task_type": "emergency_contact", "days_offset": 1},
    {"title": "Background Check Initiation", "task_type": "background_check", "days_offset": 2},
    {"title": "Sign Offer Letter", "task_type": "offer_sign", "days_offset": 0},
    {"title": "Acknowledge Employee Handbook", "task_type": "policy_ack", "days_offset": 3},
]


# --------------------------------------------------------
# TASK → REQUIRED DOCUMENT MAP
# --------------------------------------------------------
TASK_DOCUMENT_MAP = {
    "personal_info": ["photo"],
    "id_documents": ["aadhar", "pan"],
    "bank_details": ["bank_passbook"],
    "background_check": ["resume"],
    "offer_sign": ["offer_letter"],
    "policy_ack": [],
    "emergency_contact": []
}


# --------------------------------------------------------
# 1️⃣ START ONBOARDING
# --------------------------------------------------------
@router.post("/{employee_id}/start")
def start_onboarding(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    require_permission("employees", "update")(current_user)

    employee = db.query(models.Employee).filter(
        models.Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # ✅ SMART CHECK (partial onboarding safe)
    existing_count = db.query(models.OnboardingTask).filter(
        models.OnboardingTask.employee_id == employee_id
    ).count()

    if existing_count >= len(DEFAULT_ONBOARDING_TASKS):
        raise HTTPException(status_code=400, detail="Onboarding already initiated")

    start_date = employee.join_date or datetime.utcnow()

    for item in DEFAULT_ONBOARDING_TASKS:
        task_exists = db.query(models.OnboardingTask).filter(
            models.OnboardingTask.employee_id == employee_id,
            models.OnboardingTask.task_type == item["task_type"]
        ).first()

        if task_exists:
            continue  # skip already created task

        task = models.OnboardingTask(
            employee_id=employee_id,
            title=item["title"],
            description=f"Please complete: {item['title']}",
            task_type=item["task_type"],
            due_date=start_date + timedelta(days=item["days_offset"]),
            status="pending"
        )
        db.add(task)

    employee.status = "onboarding"
    db.commit()

    if employee.email:
        send_email(
            to_email=employee.email,
            subject="Welcome! Your Onboarding Has Started 🎉",
            html_content=f"""
                <h3>Hello {employee.full_name},</h3>
                <p>Your onboarding process has started.</p>
                <p>Please complete all assigned tasks.</p>
            """
        )

    return {"message": "Onboarding started successfully"}


# --------------------------------------------------------
# 2️⃣ LIST ONBOARDING TASKS (WITH DOCUMENTS)
# --------------------------------------------------------
@router.get("/{employee_id}")
def get_onboarding_tasks(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    employee = db.query(models.Employee).filter(
        models.Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    tasks = db.query(models.OnboardingTask).filter(
        models.OnboardingTask.employee_id == employee_id
    ).order_by(models.OnboardingTask.created_at.asc()).all()

    result = []

    for task in tasks:
        required_categories = TASK_DOCUMENT_MAP.get(task.task_type, [])

        documents = db.query(models.Document).filter(
            models.Document.employee_id == employee_id,
            models.Document.category.in_(required_categories)
        ).all()

        documents_data = [
            {
                "id": d.id,
                "category": d.category,
                "filename": d.filename,
                "uploaded_at": None

            }
            for d in documents
        ]

        result.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "task_type": task.task_type,
            "status": task.status,
            "due_date": task.due_date,
            "completed_at": task.completed_at,
            "documents": documents_data
        })

    return jsonable_encoder(result)


# --------------------------------------------------------
# 3️⃣ COMPLETE TASK
# --------------------------------------------------------
@router.put("/{task_id}/complete")
def complete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    task = db.query(models.OnboardingTask).filter(
        models.OnboardingTask.id == task_id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = "completed"
    task.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(task)

    employee = db.query(models.Employee).filter(
        models.Employee.id == task.employee_id
    ).first()

    if employee and employee.email:
        send_email(
            to_email=employee.email,
            subject=f"Task Completed: {task.title}",
            html_content=f"""
                <p>Dear {employee.full_name},</p>
                <p>You have completed the task:</p>
                <b>{task.title}</b>
            """
        )

    # 🔥 AUTO ACTIVATE IF ALL TASKS DONE
    total = db.query(models.OnboardingTask).filter(
        models.OnboardingTask.employee_id == task.employee_id
    ).count()

    completed = db.query(models.OnboardingTask).filter(
        models.OnboardingTask.employee_id == task.employee_id,
        models.OnboardingTask.status == "completed"
    ).count()

    if total == completed:
        employee.status = "active"
        db.commit()

        if employee.email:
            send_email(
                to_email=employee.email,
                subject="🎉 Onboarding Completed!",
                html_content=f"""
                    <h3>Congratulations {employee.full_name}!</h3>
                    <p>Your onboarding is complete.</p>
                """
            )

    return jsonable_encoder(task)


# --------------------------------------------------------
# 4️⃣ ONBOARDING PROGRESS
# --------------------------------------------------------
@router.get("/{employee_id}/progress")
def onboarding_progress(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    employee = db.query(models.Employee).filter(
        models.Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    total = db.query(models.OnboardingTask).filter(
        models.OnboardingTask.employee_id == employee_id
    ).count()

    completed = db.query(models.OnboardingTask).filter(
        models.OnboardingTask.employee_id == employee_id,
        models.OnboardingTask.status == "completed"
    ).count()

    percentage = (completed / total * 100) if total else 0

    return {
        "employee_id": employee_id,
        "total_tasks": total,
        "completed_tasks": completed,
        "percentage": round(percentage, 2),
        "status": employee.status
    }

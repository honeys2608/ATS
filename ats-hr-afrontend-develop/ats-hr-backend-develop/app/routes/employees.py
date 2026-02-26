from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import or_
from datetime import datetime
import secrets

from app.db import get_db
from app import models, schemas
from app.auth import get_password_hash, get_current_user
from app.utils.email import send_email
from app import models, schemas

from sqlalchemy.orm import joinedload
router = APIRouter(prefix="/v1/employees", tags=["Employees"])
security = HTTPBearer()


# ======================================================
# STATUS TRANSITION RULES
# ======================================================
ALLOWED_TRANSITIONS = {
    "onboarding": ["active"],
    "active": ["notice_period", "resigned", "terminated"],
    "notice_period": ["resigned", "terminated"],
    "resigned": ["alumni"],
    "terminated": ["alumni"],
    "alumni": [],
}


def validate_status_transition(current_status, new_status):
    if current_status == new_status:
        return True
    allowed = ALLOWED_TRANSITIONS.get(current_status or "onboarding", [])
    return new_status in allowed


# ======================================================
# FETCH ORGANIZATION CODE FROM SETTINGS
# ======================================================
def get_org_code(db: Session):
    setting = (
        db.query(models.SystemSettings)
        .filter(
            models.SystemSettings.module_name == "organization",
            models.SystemSettings.setting_key == "organization_code",
        )
        .first()
    )

    if not setting or "code" not in setting.setting_value:
        return "ORG"  # fallback

    return setting.setting_value["code"]


# ======================================================
# UNIQUE EMPLOYEE ID GENERATOR (ORG-E-0001)
# ======================================================
def generate_employee_code(db: Session):
    org = get_org_code(db)

    last_code = (
        db.query(models.Employee.employee_code)
        .filter(models.Employee.employee_code.like(f"{org}-E-%"))
        .order_by(models.Employee.employee_code.desc())
        .first()
    )

    if last_code and last_code[0]:
        try:
            last_num = int(last_code[0].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1

    return f"{org}-E-{next_num:04d}"


# ======================================================
# LOGGING FUNCTION
# ======================================================
def add_employee_log(db: Session, emp_id: str, action: str, old=None, new=None):

    def clean(data):
        if not data:
            return None

        d = dict(data)
        d.pop("_sa_instance_state", None)

        # 🔥 datetime ko string bana do (JSON safe)
        for k, v in d.items():
            if isinstance(v, datetime):
                d[k] = v.isoformat()

        return d

    log = models.EmployeeLog(
        employee_id=emp_id,
        action=action,
        old_value=clean(old),
        new_value=clean(new)
    )
    db.add(log)
    db.commit()

def get_user_id(user: dict):
    return (
        user.get("id")
        or user.get("user_id")
        or user.get("sub")
    )

# ======================================================
# 1) CREATE EMPLOYEE (Manual)
# ======================================================
@router.post("", response_model=schemas.EmployeeResponse, status_code=201, dependencies=[Depends(security)])
def create_employee_manual(employee_data: schemas.EmployeeCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):

    if not employee_data.user_id:
        raise HTTPException(400, "user_id is required to create an employee")

    # ⭐ NEW UNIQUE ID
    employee_code = generate_employee_code(db)

    new_emp = models.Employee(
    employee_code=employee_code,
    full_name=employee_data.full_name,
    designation=employee_data.designation,
    department=employee_data.department,
    join_date=employee_data.join_date,
    ctc=employee_data.ctc,
    location=employee_data.location,
    status=employee_data.status or "onboarding",
    manager_id=employee_data.manager_id,
    candidate_id=employee_data.candidate_id,
    user_id=employee_data.user_id
)


    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    add_employee_log(db, new_emp.id, "created", new=new_emp.__dict__)

    return new_emp


# ======================================================
# 2) CONVERT CANDIDATE → EMPLOYEE
@router.post(
    "/from-candidate/{candidate_id}",
    response_model=schemas.EmployeeResponse,
    status_code=201,
    dependencies=[Depends(security)]
)
def convert_candidate_to_employee(
    candidate_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    print("\n================= CONVERT CANDIDATE → EMPLOYEE =================")
    print("Candidate ID:", candidate_id)

    # 1️⃣ Fetch candidate
    candidate = db.query(models.Candidate).filter(
        models.Candidate.id == candidate_id
    ).first()

    if not candidate:
        print("❌ Candidate not found")
        raise HTTPException(404, "Candidate not found")

    # 🔒 BLOCK MERGED CANDIDATE
    if candidate.merged_into_id:
        print("❌ Candidate is merged into:", candidate.merged_into_id)
        raise HTTPException(
            status_code=400,
            detail="Merged candidate cannot be converted. Convert primary profile only."
        )

    print("Candidate Email:", candidate.email)
    print("Candidate Classification:", candidate.classification)
    print("Candidate Status:", candidate.status)

    # 2️⃣ Only payroll candidates allowed
    if candidate.classification != models.CandidateClassification.payroll:
        print("❌ Not a payroll candidate")
        raise HTTPException(
            status_code=400,
            detail="Only payroll candidates can be converted to Employee"
        )

    # 3️⃣ Prevent double conversion
    existing_employee = db.query(models.Employee).filter(
        models.Employee.candidate_id == candidate.id
    ).first()

    if existing_employee:
        print("❌ Candidate already converted to employee:", existing_employee.id)
        raise HTTPException(400, "Candidate already converted to employee")

    # 4️⃣ Candidate email is mandatory
    if not candidate.email:
        print("❌ Candidate email missing")
        raise HTTPException(400, "Candidate email is required")

    # 5️⃣ Create / fetch USER (login)
    user = db.query(models.User).filter(
        models.User.email == candidate.email
    ).first()

    temp_password = None

    if not user:
        temp_password = secrets.token_urlsafe(8)
        hashed_password = get_password_hash(temp_password)

        print("🆕 NEW EMPLOYEE USER CREATED")
        print("Login Email:", candidate.email)
        print("Temporary Password:", temp_password)

        user = models.User(
            username=candidate.email.split("@")[0],
            email=candidate.email,
            password=hashed_password,
            role="employee",
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

        user.role = "employee"
        user.must_change_password = True
        user.linked_candidate_id = candidate.id
        db.commit()

    # 6️⃣ Create EMPLOYEE record
    employee_code = generate_employee_code(db)

    employee = models.Employee(
        candidate_id=candidate.id,
        user_id=user.id,
        full_name=candidate.full_name,
        email=candidate.email,
        phone=candidate.phone,
        employee_code=employee_code,
        designation=None,
        department=None,
        status="onboarding",
        join_date=datetime.utcnow(),
        location=candidate.current_location,
        ctc=None
    )

    db.add(employee)

    # 7️⃣ Lock candidate (REMOVE FROM INTAKE)
    candidate.status = "converted"
    candidate.is_active = False
    candidate.converted_at = datetime.utcnow()

    db.commit()
    db.refresh(employee)

    print("✅ EMPLOYEE CREATED")
    print("Employee ID:", employee.id)
    print("Employee Code:", employee.employee_code)
    print("User ID:", user.id)
    print("===============================================================\n")

    # 8️⃣ Send email ONLY if password generated
    if temp_password:
        try:
            send_email(
                to=candidate.email,
                subject="Your Employee Account Created",
                body=f"""
Hi {candidate.full_name},

Your employee account has been created.

Login Email: {candidate.email}
Temporary Password: {temp_password}

Please login and change your password immediately.

Regards,
HR Team
"""
            )
        except Exception as e:
            print("❌ Employee email failed:", e)

    return employee

# ======================================================
# GET LOGGED-IN EMPLOYEE (SELF PROFILE)
@router.get(
    "/me",
    response_model=schemas.EmployeeResponse,
    dependencies=[Depends(security)]
)
def get_my_employee(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    employee = (
        db.query(models.Employee)
        .options(
            joinedload(models.Employee.user),
            joinedload(models.Employee.candidate)
        )
        .filter(models.Employee.user_id == get_user_id(current_user))

        .first()
    )

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # 🔥 FLATTEN DATA FOR FRONTEND
    if employee.user:
        employee.email = employee.user.email

    if employee.candidate:
        employee.phone = employee.candidate.phone

    # fallback name
    if not employee.full_name:
        if employee.user and employee.user.full_name:
            employee.full_name = employee.user.full_name
        elif employee.candidate and employee.candidate.full_name:
            employee.full_name = employee.candidate.full_name

    return employee


# ======================================================
# 3) LIST EMPLOYEES  ✅ (FIXED)
# ======================================================
@router.get(
    "",
    dependencies=[Depends(security)]
)
def list_employees(
    search: str = Query(None),
    status: str = Query(None),
    department: str = Query(None),
    location: str = Query(None),
    page: Optional[int] = Query(None, ge=1),
    limit: int = Query(9, ge=1, le=200),
    offset: Optional[int] = Query(None, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = (
        db.query(models.Employee)
        .options(
            joinedload(models.Employee.candidate),
            joinedload(models.Employee.user)
        )
    )

    if search:
        pattern = f"%{search}%"
        q = q.filter(
            or_(
                models.Employee.employee_code.ilike(pattern),
                models.Employee.full_name.ilike(pattern),
                models.Employee.designation.ilike(pattern),
                models.Employee.department.ilike(pattern),
            )
        )

    if status:
        q = q.filter(models.Employee.status == status)

    if department:
        q = q.filter(models.Employee.department == department)

    if location:
        q = q.filter(models.Employee.location == location)

    ordered_query = q.order_by(models.Employee.join_date.desc())
    if page is None:
        use_offset = offset or 0
        employees = ordered_query.offset(use_offset).limit(limit).all()
        total_records = len(employees)
    else:
        total_records = ordered_query.count()
        employees = (
            ordered_query
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

    # 🔥 FINAL NAME RESOLUTION (THIS IS THE FIX)
    result = []
    for emp in employees:
        if not emp.full_name:
            if emp.candidate and emp.candidate.full_name:
                emp.full_name = emp.candidate.full_name
            elif emp.user and emp.user.full_name:
                emp.full_name = emp.user.full_name
            else:
                emp.full_name = "N/A"
        result.append(emp)

    if page is None:
        return result

    total_pages = max(1, (total_records + limit - 1) // limit) if total_records else 1
    return {
        "data": result,
        "employees": result,
        "currentPage": page,
        "totalPages": total_pages,
        "totalRecords": total_records,
        "total": total_records,
        "limit": limit,
    }




# ======================================================
# 4) GET EMPLOYEE (includes manager name)
# ======================================================
@router.get("/{employee_id}", response_model=schemas.EmployeeResponse, dependencies=[Depends(security)])
def get_employee(employee_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):

    emp = (
    db.query(models.Employee)
    .options(
        joinedload(models.Employee.user),
        joinedload(models.Employee.candidate)
    )
    .filter(models.Employee.id == employee_id)
    .first()
)

    if not emp:
        raise HTTPException(404, "Employee not found")

# 🔥 FLATTEN EMAIL & PHONE (VERY IMPORTANT)
    if emp.user:
        emp.email = emp.user.email

    if emp.candidate:
        emp.phone = emp.candidate.phone

# 🔥 FULL NAME FALLBACK
    if not emp.full_name:
        if emp.user and emp.user.full_name:
            emp.full_name = emp.user.full_name
        elif emp.candidate and emp.candidate.full_name:
            emp.full_name = emp.candidate.full_name

# 🔥 MANAGER NAME
    emp.manager_name = None
    if emp.manager_id:
        manager = db.query(models.Employee).filter(
            models.Employee.id == emp.manager_id
        ).first()
        if manager:
            emp.manager_name = manager.full_name

    return emp



# ======================================================
# 5) UPDATE EMPLOYEE
# ======================================================
@router.put("/{employee_id}", response_model=schemas.EmployeeResponse, dependencies=[Depends(security)])
def update_employee(employee_id: str, payload: schemas.EmployeeUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):

    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    old_data = emp.__dict__.copy()
    old_data.pop("_sa_instance_state", None)

    if payload.status:
        if not validate_status_transition(emp.status, payload.status):
            raise HTTPException(400, "Invalid status transition")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(emp, field, value)

    db.commit()
    db.refresh(emp)

    new_data = emp.__dict__.copy()
    new_data.pop("_sa_instance_state", None)

    add_employee_log(db, employee_id, "updated", old=old_data, new=new_data)

    return emp


# ======================================================
# 6) DELETE EMPLOYEE
# ======================================================
@router.delete("/{employee_id}", dependencies=[Depends(security)])
def delete_employee(employee_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):

    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    snapshot = emp.__dict__.copy()
    snapshot.pop("_sa_instance_state", None)

    db.delete(emp)
    db.commit()

    add_employee_log(db, employee_id, "deleted", old=snapshot)

    return {"message": "Employee deleted successfully"}


# ======================================================
# 7) EXIT PROCESS → Alumni Conversion
# ======================================================

@router.post("/{employee_id}/exit", dependencies=[Depends(security)])
def initiate_exit(
    employee_id: str,
    exit_interview_data: schemas.ExitInterviewCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    emp = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    # ---------------------------
    # UPDATE EMPLOYEE STATUS
    # ---------------------------
    old_status = emp.status
    emp.status = "resigned"

    emp.exit_date = datetime.utcnow()

    # ---------------------------
    # EXIT INTERVIEW (FIXED)
    # ---------------------------
    exit_interview = models.ExitInterview(
        employee_id=employee_id,
        interviewer_id=current_user["id"],  # ✅ VALID FK
        exit_reason=exit_interview_data.exit_reason,
        feedback=exit_interview_data.feedback,
        would_rehire=exit_interview_data.would_rehire,
        would_recommend=exit_interview_data.would_recommend,
        conducted_at=datetime.utcnow()
    )
    db.add(exit_interview)

    # ---------------------------
    # ALUMNI ENTRY
    # ---------------------------
    tenure_years = (
        (datetime.utcnow() - emp.join_date).days / 365.25
        if emp.join_date else 0
    )

    alumni = models.Alumni(
        employee_id=employee_id,
        exit_date=datetime.utcnow(),
        last_designation=emp.designation,
        tenure_years=tenure_years,
        is_eligible_for_rehire=exit_interview_data.would_rehire,
        engagement_score=75.0
    )
    db.add(alumni)

    db.commit()

    add_employee_log(
        db,
        employee_id,
        "exited",
        old={"status": old_status},
        new={"status": "exited"}
    )

    return {
        "message": "Exit process initiated successfully",
        "employee_id": employee_id
    }
@router.post(
    "/{employee_id}/reset-password",
    dependencies=[Depends(security)]
)
def reset_employee_password(
    employee_id: str,
    payload: schemas.EmployeeResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 🔐 Only Admin / HR allowed
    if current_user["role"] not in ["admin","employee"]:
        raise HTTPException(403, "Not allowed")

    # 1️⃣ Fetch employee
    employee = db.query(models.Employee).filter(
        models.Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(404, "Employee not found")

    # 2️⃣ Fetch linked user
    user = db.query(models.User).filter(
        models.User.id == employee.user_id
    ).first()

    if not user:
        raise HTTPException(404, "User account not found")

    # 3️⃣ Update password
    user.password = get_password_hash(payload.password)
    user.must_change_password = True   # 🔥 force change on login

    db.commit()

    # 4️⃣ Optional Email Notification
    try:
        send_email(
            to=user.email,
            subject="Password Reset by HR",
            body=f"""
Hi {user.full_name or 'Employee'},

Your password has been reset by HR.

Please login and change your password immediately.

Regards,
HR Team
"""
        )
    except Exception as e:
        print("Password reset email failed:", e)

    # 5️⃣ Audit log
    add_employee_log(
        db,
        employee.id,
        "password_reset",
        old=None,
        new={"reset_by": current_user["email"]}
    )

    return {"message": "Password reset successfully"}

# ======================================================
# 8) EMPLOYEE LOGS
# ======================================================
@router.get("/{employee_id}/logs", response_model=List[schemas.EmployeeLogResponse], dependencies=[Depends(security)])
def get_employee_logs(employee_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):

    logs = (
        db.query(models.EmployeeLog)
        .filter(models.EmployeeLog.employee_id == employee_id)
        .order_by(models.EmployeeLog.created_at.desc())
        .all()
    )
    return logs


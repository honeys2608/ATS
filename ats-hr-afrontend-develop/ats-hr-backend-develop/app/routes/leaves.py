from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import LeaveRequest, LeaveBalance, Employee
from app.auth import get_current_user
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/v1/leaves", tags=["leaves"])

class LeaveRequestCreate(BaseModel):
    employee_id: str
    leave_type: str
    start_date: str
    end_date: str
    reason: Optional[str] = None

class LeaveApproval(BaseModel):
    status: str
    rejection_reason: Optional[str] = None

@router.post("")
def create_leave_request(leave_data: LeaveRequestCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    employee = db.query(Employee).filter(Employee.id == leave_data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    start = datetime.fromisoformat(leave_data.start_date.replace('Z', '+00:00'))
    end = datetime.fromisoformat(leave_data.end_date.replace('Z', '+00:00'))
    days = (end - start).days + 1
    
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == leave_data.employee_id,
        LeaveBalance.leave_type == leave_data.leave_type,
        LeaveBalance.year == datetime.now().year
    ).first()
    
    if balance and balance.available < days:
        raise HTTPException(status_code=400, detail=f"Insufficient {leave_data.leave_type} leave balance. Available: {balance.available} days")
    
    leave = LeaveRequest(
        employee_id=leave_data.employee_id,
        leave_type=leave_data.leave_type,
        start_date=start,
        end_date=end,
        days_count=days,
        reason=leave_data.reason,
        status="pending"
    )
    
    db.add(leave)
    db.commit()
    db.refresh(leave)
    
    return {
        "id": leave.id,
        "employee_id": leave.employee_id,
        "leave_type": leave.leave_type,
        "start_date": leave.start_date.isoformat(),
        "end_date": leave.end_date.isoformat(),
        "days_count": leave.days_count,
        "reason": leave.reason,
        "status": leave.status,
        "created_at": leave.created_at.isoformat()
    }

@router.get("")
def get_leave_requests(employee_id: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    query = db.query(LeaveRequest)
    
    if employee_id:
        query = query.filter(LeaveRequest.employee_id == employee_id)
    if status:
        query = query.filter(LeaveRequest.status == status)
    
    leaves = query.order_by(LeaveRequest.created_at.desc()).all()
    
    result = []
    for leave in leaves:
        employee = db.query(Employee).filter(Employee.id == leave.employee_id).first()
        result.append({
            "id": leave.id,
            "employee_id": leave.employee_id,
            "employee_name": employee.designation if employee else "Unknown",
            "leave_type": leave.leave_type,
            "start_date": leave.start_date.isoformat(),
            "end_date": leave.end_date.isoformat(),
            "days_count": leave.days_count,
            "reason": leave.reason,
            "status": leave.status,
            "approved_by": leave.approved_by,
            "approved_at": leave.approved_at.isoformat() if leave.approved_at else None,
            "rejection_reason": leave.rejection_reason,
            "created_at": leave.created_at.isoformat()
        })
    
    return result

@router.put("/{leave_id}/approve")
def approve_leave(leave_id: str, approval: LeaveApproval, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Leave request already processed")
    
    leave.status = approval.status
    leave.approved_by = current_user["id"]
    leave.approved_at = datetime.utcnow()
    
    if approval.status == "approved":
        balance = db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == leave.employee_id,
            LeaveBalance.leave_type == leave.leave_type,
            LeaveBalance.year == datetime.now().year
        ).first()
        
        if balance:
            balance.used += leave.days_count
            balance.available -= leave.days_count
    elif approval.status == "rejected":
        leave.rejection_reason = approval.rejection_reason
    
    db.commit()
    
    return {"message": f"Leave request {approval.status}", "leave_id": leave_id}

@router.get("/balance/{employee_id}")
def get_leave_balance(employee_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    year = datetime.now().year
    balances = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == employee_id,
        LeaveBalance.year == year
    ).all()
    
    return [{
        "leave_type": balance.leave_type,
        "total_allocated": balance.total_allocated,
        "used": balance.used,
        "available": balance.available,
        "year": balance.year
    } for balance in balances]

@router.post("/balance/initialize")
def initialize_leave_balance(employee_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    year = datetime.now().year
    
    leave_types = {
        "casual": 12,
        "sick": 12,
        "earned": 15,
        "maternity": 180,
        "paternity": 15
    }
    
    for leave_type, allocated in leave_types.items():
        existing = db.query(LeaveBalance).filter(
            LeaveBalance.employee_id == employee_id,
            LeaveBalance.leave_type == leave_type,
            LeaveBalance.year == year
        ).first()
        
        if not existing:
            balance = LeaveBalance(
                employee_id=employee_id,
                leave_type=leave_type,
                total_allocated=allocated,
                used=0,
                available=allocated,
                year=year
            )
            db.add(balance)
    
    db.commit()
    
    return {"message": "Leave balances initialized", "employee_id": employee_id}

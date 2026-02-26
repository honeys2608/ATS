from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db import get_db
from app import models
from app.auth import get_current_user
from datetime import datetime, timedelta
from calendar import monthrange

router = APIRouter(prefix="/v1/payroll", tags=["Payroll"])

@router.post("/salaries", status_code=201)
def create_employee_salary(
    employee_id: str,
    basic_salary: float,
    hra: float = 0.0,
    transport_allowance: float = 0.0,
    medical_allowance: float = 0.0,
    special_allowance: float = 0.0,
    bank_name: str = None,
    account_number: str = None,
    ifsc_code: str = None,
    pan_number: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create salary structure for an employee"""
    # Deactivate existing salary if any
    existing_salaries = db.query(models.EmployeeSalary).filter(
        models.EmployeeSalary.employee_id == employee_id,
        models.EmployeeSalary.is_active == True
    ).all()
    
    for salary in existing_salaries:
        salary.is_active = False
        salary.effective_to = datetime.utcnow()
    
    # Calculate gross
    gross_salary = basic_salary + hra + transport_allowance + medical_allowance + special_allowance
    
    new_salary = models.EmployeeSalary(
        employee_id=employee_id,
        basic_salary=basic_salary,
        hra=hra,
        transport_allowance=transport_allowance,
        medical_allowance=medical_allowance,
        special_allowance=special_allowance,
        gross_salary=gross_salary,
        bank_name=bank_name,
        account_number=account_number,
        ifsc_code=ifsc_code,
        pan_number=pan_number,
        effective_from=datetime.utcnow(),
        is_active=True
    )
    
    db.add(new_salary)
    db.commit()
    db.refresh(new_salary)
    
    return new_salary

@router.get("/salaries")
def list_employee_salaries(
    employee_id: str = None,
    is_active: bool = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List employee salaries"""
    query = db.query(models.EmployeeSalary)
    
    if employee_id:
        query = query.filter(models.EmployeeSalary.employee_id == employee_id)
    if is_active is not None:
        query = query.filter(models.EmployeeSalary.is_active == is_active)
    
    salaries = query.all()
    
    # Join with employee data
    result = []
    for salary in salaries:
        employee = db.query(models.Employee).filter(models.Employee.id == salary.employee_id).first()
        result.append({
            "id": salary.id,
            "employee_id": salary.employee_id,
            "employee_name": employee.full_name if employee else "Unknown",
            "employee_code": employee.employee_code if employee else None,
            "department": employee.department if employee else None,
            "designation": employee.designation if employee else None,
            "basic_salary": salary.basic_salary,
            "hra": salary.hra,
            "transport_allowance": salary.transport_allowance,
            "medical_allowance": salary.medical_allowance,
            "special_allowance": salary.special_allowance,
            "gross_salary": salary.gross_salary,
            "bank_name": salary.bank_name,
            "account_number": salary.account_number,
            "is_active": salary.is_active,
            "effective_from": salary.effective_from.isoformat() if salary.effective_from else None,
            "effective_to": salary.effective_to.isoformat() if salary.effective_to else None
        })
    
    return result

@router.post("/deductions", status_code=201)
def create_deduction(
    employee_id: str,
    deduction_type: str,
    amount: float,
    description: str = None,
    is_percentage: bool = False,
    is_recurring: bool = True,
    end_date: datetime = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a salary deduction for an employee"""
    deduction = models.SalaryDeduction(
        employee_id=employee_id,
        deduction_type=deduction_type,
        description=description,
        amount=amount,
        is_percentage=is_percentage,
        is_recurring=is_recurring,
        start_date=datetime.utcnow(),
        end_date=end_date
    )
    
    db.add(deduction)
    db.commit()
    db.refresh(deduction)
    
    return deduction

@router.get("/deductions")
def list_deductions(
    employee_id: str = None,
    deduction_type: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List salary deductions"""
    query = db.query(models.SalaryDeduction)
    
    if employee_id:
        query = query.filter(models.SalaryDeduction.employee_id == employee_id)
    if deduction_type:
        query = query.filter(models.SalaryDeduction.deduction_type == deduction_type)
    
    # Only return active deductions (no end_date or end_date in future)
    current_date = datetime.utcnow()
    query = query.filter(
        (models.SalaryDeduction.end_date == None) | 
        (models.SalaryDeduction.end_date > current_date)
    )
    
    deductions = query.all()
    
    # Join with employee data
    result = []
    for deduction in deductions:
        employee = db.query(models.Employee).filter(models.Employee.id == deduction.employee_id).first()
        result.append({
            "id": deduction.id,
            "employee_id": deduction.employee_id,
            "employee_name": employee.full_name if employee else "Unknown",
            "deduction_type": deduction.deduction_type,
            "description": deduction.description,
            "amount": deduction.amount,
            "is_percentage": deduction.is_percentage,
            "is_recurring": deduction.is_recurring,
            "start_date": deduction.start_date.isoformat() if deduction.start_date else None,
            "end_date": deduction.end_date.isoformat() if deduction.end_date else None
        })
    
    return result

@router.post("/runs", status_code=201)
def create_payroll_run(
    month: int,
    year: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a payroll run for a specific month/year"""
    # Check if payroll already exists for this month
    existing = db.query(models.PayrollRun).filter(
        models.PayrollRun.period_month == month,
        models.PayrollRun.period_year == year
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Payroll for {month}/{year} already exists")
    
    # Calculate period dates
    days_in_month = monthrange(year, month)[1]
    period_start = datetime(year, month, 1)
    period_end = datetime(year, month, days_in_month, 23, 59, 59)
    
    # Get all active employees with salaries
    active_employees = db.query(models.Employee).filter(
        models.Employee.status.in_(["active", "onboarding"])
    ).all()
    
    # Filter employees who have active salaries
    employees_with_salary = []
    for emp in active_employees:
        salary = db.query(models.EmployeeSalary).filter(
            models.EmployeeSalary.employee_id == emp.id,
            models.EmployeeSalary.is_active == True
        ).first()
        if salary:
            employees_with_salary.append(emp)
    
    payroll_run = models.PayrollRun(
        period_month=month,
        period_year=year,
        period_start=period_start,
        period_end=period_end,
        total_employees=len(employees_with_salary),
        status="draft",
        processed_by=current_user["id"]
    )
    
    db.add(payroll_run)
    db.commit()
    db.refresh(payroll_run)
    
    # Generate pay slips for all employees with salaries
    total_gross = 0
    total_deductions = 0
    total_net = 0
    
    for employee in employees_with_salary:
        # Get active salary
        salary = db.query(models.EmployeeSalary).filter(
            models.EmployeeSalary.employee_id == employee.id,
            models.EmployeeSalary.is_active == True
        ).first()
        
        # Get deductions that are active during this payroll period
        deductions = db.query(models.SalaryDeduction).filter(
            models.SalaryDeduction.employee_id == employee.id,
            models.SalaryDeduction.start_date <= period_end,
            (models.SalaryDeduction.end_date == None) | (models.SalaryDeduction.end_date >= period_start)
        ).all()
        
        # Calculate deductions
        tax_ded = 0
        pf_ded = 0
        insurance_ded = 0
        loan_ded = 0
        other_ded = []
        
        for ded in deductions:
            ded_amount = ded.amount
            if ded.is_percentage:
                ded_amount = (salary.gross_salary * ded.amount) / 100
            
            if ded.deduction_type == "tax":
                tax_ded += ded_amount
            elif ded.deduction_type == "provident_fund":
                pf_ded += ded_amount
            elif ded.deduction_type == "insurance":
                insurance_ded += ded_amount
            elif ded.deduction_type in ["loan", "advance"]:
                loan_ded += ded_amount
            else:
                other_ded.append({"type": ded.deduction_type, "amount": ded_amount})
            
            # For one-time deductions, set end_date to prevent future application
            if not ded.is_recurring and ded.end_date is None:
                ded.end_date = period_end
        
        total_ded = tax_ded + pf_ded + insurance_ded + loan_ded + sum(d["amount"] for d in other_ded)
        net_pay = salary.gross_salary - total_ded
        
        # Calculate leave days from approved leave records during this period
        approved_leaves = db.query(models.LeaveRequest).filter(
            models.LeaveRequest.employee_id == employee.id,
            models.LeaveRequest.status == "approved",
            models.LeaveRequest.start_date <= period_end,
            models.LeaveRequest.end_date >= period_start
        ).all()
        
        # Merge overlapping leave intervals to avoid double-counting
        leave_intervals = []
        for leave in approved_leaves:
            # Calculate overlap between leave period and payroll period
            leave_start = max(leave.start_date, period_start)
            leave_end = min(leave.end_date, period_end)
            if leave_start <= leave_end:
                leave_intervals.append((leave_start, leave_end))
        
        # Sort intervals by start date and merge overlapping periods
        leave_intervals.sort()
        merged_intervals = []
        for start, end in leave_intervals:
            if merged_intervals and start <= merged_intervals[-1][1] + timedelta(days=1):
                # Overlapping or adjacent - merge with previous interval
                merged_intervals[-1] = (merged_intervals[-1][0], max(merged_intervals[-1][1], end))
            else:
                # Non-overlapping - add new interval
                merged_intervals.append((start, end))
        
        # Calculate total leave days from merged intervals
        total_leave_days = 0
        for start, end in merged_intervals:
            total_leave_days += (end - start).days + 1
        
        # Calculate present days with safeguard against negative values
        present_days_count = max(0, days_in_month - total_leave_days)
        
        # Create payslip
        payslip = models.PaySlip(
            payroll_run_id=payroll_run.id,
            employee_id=employee.id,
            basic_salary=salary.basic_salary,
            hra=salary.hra,
            transport_allowance=salary.transport_allowance,
            medical_allowance=salary.medical_allowance,
            special_allowance=salary.special_allowance,
            gross_salary=salary.gross_salary,
            tax_deduction=tax_ded,
            provident_fund=pf_ded,
            insurance=insurance_ded,
            loan_repayment=loan_ded,
            other_deductions=other_ded,
            total_deductions=total_ded,
            net_salary=net_pay,
            working_days=days_in_month,
            present_days=present_days_count,
            leave_days=total_leave_days,
            payment_status="pending"
        )
        
        db.add(payslip)
        
        total_gross += salary.gross_salary
        total_deductions += total_ded
        total_net += net_pay
    
    # Update payroll run totals
    payroll_run.total_gross = total_gross
    payroll_run.total_deductions = total_deductions
    payroll_run.total_net = total_net
    payroll_run.status = "completed"
    payroll_run.processed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(payroll_run)
    
    return payroll_run

@router.get("/runs")
def list_payroll_runs(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List all payroll runs"""
    runs = db.query(models.PayrollRun).order_by(models.PayrollRun.period_year.desc(), models.PayrollRun.period_month.desc()).all()
    
    result = []
    for run in runs:
        result.append({
            "id": run.id,
            "period_month": run.period_month,
            "period_year": run.period_year,
            "period_display": f"{datetime(2000, run.period_month, 1).strftime('%B')} {run.period_year}",
            "total_employees": run.total_employees,
            "total_gross": run.total_gross,
            "total_deductions": run.total_deductions,
            "total_net": run.total_net,
            "status": run.status,
            "processed_at": run.processed_at.isoformat() if run.processed_at else None,
            "created_at": run.created_at.isoformat() if run.created_at else None
        })
    
    return result

@router.get("/payslips/{payroll_run_id}")
def get_payslips_for_run(
    payroll_run_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all payslips for a specific payroll run"""
    payslips = db.query(models.PaySlip).filter(models.PaySlip.payroll_run_id == payroll_run_id).all()
    
    result = []
    for slip in payslips:
        employee = db.query(models.Employee).filter(models.Employee.id == slip.employee_id).first()
        result.append({
            "id": slip.id,
            "employee_id": slip.employee_id,
            "employee_name": employee.full_name if employee else "Unknown",
            "employee_code": employee.employee_code if employee else None,
            "department": employee.department if employee else None,
            "designation": employee.designation if employee else None,
            "basic_salary": slip.basic_salary,
            "hra": slip.hra,
            "transport_allowance": slip.transport_allowance,
            "medical_allowance": slip.medical_allowance,
            "special_allowance": slip.special_allowance,
            "gross_salary": slip.gross_salary,
            "tax_deduction": slip.tax_deduction,
            "provident_fund": slip.provident_fund,
            "insurance": slip.insurance,
            "loan_repayment": slip.loan_repayment,
            "total_deductions": slip.total_deductions,
            "net_salary": slip.net_salary,
            "working_days": slip.working_days,
            "present_days": slip.present_days,
            "leave_days": slip.leave_days,
            "payment_status": slip.payment_status,
            "payment_date": slip.payment_date.isoformat() if slip.payment_date else None
        })
    
    return result

@router.put("/payslips/{payslip_id}/mark-paid")
def mark_payslip_paid(
    payslip_id: str,
    payment_method: str = "bank_transfer",
    payment_reference: str = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Mark a payslip as paid"""
    payslip = db.query(models.PaySlip).filter(models.PaySlip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    
    payslip.payment_status = "paid"
    payslip.payment_date = datetime.utcnow()
    payslip.payment_method = payment_method
    payslip.payment_reference = payment_reference
    
    db.commit()
    db.refresh(payslip)
    
    return {"message": "Payslip marked as paid", "payslip_id": payslip_id}

@router.get("/dashboard/metrics")
def get_payroll_metrics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get payroll dashboard metrics"""
    # Get latest payroll run
    latest_run = db.query(models.PayrollRun).order_by(
        models.PayrollRun.period_year.desc(), 
        models.PayrollRun.period_month.desc()
    ).first()
    
    # Count active employees with salary
    total_employees = db.query(models.EmployeeSalary).filter(
        models.EmployeeSalary.is_active == True
    ).count()
    
    # Get pending payments
    pending_payslips = db.query(models.PaySlip).filter(
        models.PaySlip.payment_status == "pending"
    ).all()
    pending_amount = sum(slip.net_salary for slip in pending_payslips)
    
    # Calculate total payroll cost (all active salaries)
    active_salaries = db.query(models.EmployeeSalary).filter(
        models.EmployeeSalary.is_active == True
    ).all()
    total_payroll_cost = sum(s.gross_salary for s in active_salaries)
    
    return {
        "total_employees": total_employees,
        "total_monthly_payroll": total_payroll_cost,
        "pending_payments": len(pending_payslips),
        "pending_amount": pending_amount,
        "latest_payroll": {
            "month": latest_run.period_month if latest_run else None,
            "year": latest_run.period_year if latest_run else None,
            "total_net": latest_run.total_net if latest_run else 0
        } if latest_run else None
    }

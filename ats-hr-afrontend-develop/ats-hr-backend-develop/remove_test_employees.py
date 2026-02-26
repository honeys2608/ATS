#!/usr/bin/env python3
"""
Script to remove specific test employees from the database
"""
import sys
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import models

def remove_test_employees():
    """Remove specific test employees from the database"""
    
    db = SessionLocal()
    
    try:
        # List of employee identifiers to remove
        employees_to_remove = [
            {"name": "Riya", "email": "riya@gmail.com"},
            {"name": "Ninda", "email": "ninda@email.com"},
            {"name": "Legacy Employee", "email": "legacy@company.com"},
            {"name": "honeys", "email": "honeys@email.com"}
        ]
        
        removed_count = 0
        
        for emp_data in employees_to_remove:
            # Try to find employee by email or name
            employee = (
                db.query(models.Employee)
                .filter(
                    (models.Employee.email == emp_data["email"]) |
                    (models.Employee.full_name == emp_data["name"])
                )
                .first()
            )
            
            if employee:
                print(f"Found employee: {employee.full_name} ({employee.email})")
                print(f"Employee ID: {employee.id}")
                print(f"Employee Code: {employee.employee_code}")
                
                # Remove the employee
                db.delete(employee)
                removed_count += 1
                print(f"✓ Removed employee: {employee.full_name}")
                print("-" * 50)
            else:
                print(f"✗ Employee not found: {emp_data['name']} ({emp_data['email']})")
                print("-" * 50)
        
        # Commit the changes
        if removed_count > 0:
            db.commit()
            print(f"Successfully removed {removed_count} test employees from the database.")
        else:
            print("No test employees found to remove.")
            
    except Exception as e:
        print(f"Error removing employees: {str(e)}")
        db.rollback()
        sys.exit(1)
        
    finally:
        db.close()

if __name__ == "__main__":
    print("🔥 Removing test employees from database...")
    print("=" * 60)
    remove_test_employees()
    print("=" * 60)
    print("✅ Operation completed!")
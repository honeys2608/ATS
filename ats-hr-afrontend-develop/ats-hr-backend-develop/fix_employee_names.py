#!/usr/bin/env python3
"""
Script to fix capitalization of employee names in the database
"""
import sys
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import models

def fix_employee_name_capitalization():
    """Fix capitalization of specific employee names"""
    
    db = SessionLocal()
    
    try:
        # List of employees to fix
        employees_to_fix = [
            {"current_name": "honey sinha", "correct_name": "Honey Sinha"},
            {"current_name": "aloo", "correct_name": "Aloo"}
        ]
        
        updated_count = 0
        
        for emp_data in employees_to_fix:
            # Find employee by current name
            employee = (
                db.query(models.Employee)
                .filter(models.Employee.full_name == emp_data["current_name"])
                .first()
            )
            
            if employee:
                print(f"Found employee: {employee.full_name}")
                print(f"Employee ID: {employee.id}")
                print(f"Employee Code: {employee.employee_code}")
                print(f"Current name: {employee.full_name}")
                
                # Update the name
                employee.full_name = emp_data["correct_name"]
                updated_count += 1
                
                print(f"✓ Updated name to: {employee.full_name}")
                print("-" * 50)
            else:
                print(f"✗ Employee not found: {emp_data['current_name']}")
                print("-" * 50)
        
        # Commit the changes
        if updated_count > 0:
            db.commit()
            print(f"Successfully updated {updated_count} employee names with proper capitalization.")
        else:
            print("No employees found to update.")
            
    except Exception as e:
        print(f"Error updating employee names: {str(e)}")
        db.rollback()
        sys.exit(1)
        
    finally:
        db.close()

if __name__ == "__main__":
    print("🔤 Fixing employee name capitalization...")
    print("=" * 60)
    fix_employee_name_capitalization()
    print("=" * 60)
    print("✅ Operation completed!")
#!/usr/bin/env python3
"""
Script to find and fix all employee names with improper capitalization
"""
import sys
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import models

def find_and_fix_capitalization():
    """Find all employees and fix capitalization issues"""
    
    db = SessionLocal()
    
    try:
        # Get all employees
        employees = db.query(models.Employee).all()
        
        print("All current employees:")
        print("-" * 60)
        
        updated_count = 0
        
        for emp in employees:
            print(f"ID: {emp.id}")
            print(f"Name: '{emp.full_name}'")
            print(f"Email: {emp.email}")
            print(f"Code: {emp.employee_code}")
            
            # Check if name needs capitalization fix
            if emp.full_name and not emp.full_name[0].isupper():
                original_name = emp.full_name
                # Fix capitalization - title case
                emp.full_name = emp.full_name.title()
                updated_count += 1
                print(f"✓ Updated: '{original_name}' → '{emp.full_name}'")
            
            print("-" * 40)
        
        # Commit the changes
        if updated_count > 0:
            db.commit()
            print(f"Successfully updated {updated_count} employee names with proper capitalization.")
        else:
            print("All employee names already have proper capitalization.")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        db.rollback()
        sys.exit(1)
        
    finally:
        db.close()

if __name__ == "__main__":
    print("🔍 Finding and fixing employee name capitalization...")
    print("=" * 60)
    find_and_fix_capitalization()
    print("=" * 60)
    print("✅ Operation completed!")
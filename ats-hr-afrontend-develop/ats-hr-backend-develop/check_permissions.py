#!/usr/bin/env python3
"""
Script to check user permissions in the ATS system
"""
import sys
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import models

def check_user_permissions():
    """Check what permissions users have"""
    
    db = SessionLocal()
    
    try:
        # Get all users
        users = db.query(models.User).all()
        
        print("Current Users and Their Roles:")
        print("=" * 60)
        
        for user in users:
            print(f"User: {user.username}")
            print(f"Email: {user.email}")
            print(f"Role: {user.role}")
            print(f"Full Name: {user.full_name}")
            print(f"Active: {user.is_active}")
            print("-" * 40)
        
        print("\nRole-Based Permissions Available:")
        print("=" * 60)
        print("Admin Role:")
        print("- All permissions on all modules")
        print()
        print("Recruiter Role:")
        print("- Jobs: create, view, update")
        print("- Candidates: create, view, update, delete")
        print("- Interviews: create, view, update") 
        print()
        print("Employee Role:")
        print("- Limited permissions")
        print()
        
    except Exception as e:
        print(f"Error checking permissions: {str(e)}")
        sys.exit(1)
        
    finally:
        db.close()

if __name__ == "__main__":
    print("🔍 Checking user permissions...")
    print("=" * 60)
    check_user_permissions()
    print("=" * 60)
    print("✅ Permission check completed!")
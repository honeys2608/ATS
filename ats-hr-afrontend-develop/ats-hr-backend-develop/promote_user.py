#!/usr/bin/env python3
"""
Script to promote user to recruiter role for candidate management
"""
import sys
from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import models

def promote_user_to_recruiter():
    """Promote specific users to recruiter role"""
    
    db = SessionLocal()
    
    try:
        # Users to promote (can be modified based on who needs access)
        users_to_promote = ["honey1234", "jiya", "anjali"]  # Add more usernames as needed
        
        updated_count = 0
        
        for username in users_to_promote:
            user = db.query(models.User).filter(
                models.User.username == username
            ).first()
            
            if user:
                print(f"Found user: {user.username}")
                print(f"Current role: {user.role}")
                print(f"Email: {user.email}")
                
                if user.role in ["candidate", "employee"]:
                    user.role = "recruiter"
                    updated_count += 1
                    print(f"✓ Updated {user.username} to recruiter role")
                else:
                    print(f"ℹ  {user.username} already has {user.role} role (no change needed)")
                    
                print("-" * 50)
            else:
                print(f"✗ User not found: {username}")
                print("-" * 50)
        
        # Commit the changes
        if updated_count > 0:
            db.commit()
            print(f"Successfully promoted {updated_count} users to recruiter role.")
            print("These users can now delete/manage candidates.")
        else:
            print("No users were promoted (they already have sufficient permissions).")
            
    except Exception as e:
        print(f"Error promoting users: {str(e)}")
        db.rollback()
        sys.exit(1)
        
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Promoting users to recruiter role...")
    print("=" * 60)
    promote_user_to_recruiter()
    print("=" * 60)
    print("✅ User promotion completed!")
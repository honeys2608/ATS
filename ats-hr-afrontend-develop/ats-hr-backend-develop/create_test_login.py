#!/usr/bin/env python3
from app.db import SessionLocal
from app.models import User
from app.auth import get_password_hash, verify_password, create_access_token

def create_test_login():
    db = SessionLocal()
    try:
        # Find admin user
        user = db.query(User).filter(User.email == 'jiya@gmail.com').first()
        if not user:
            print("User not found")
            return
        
        print(f"User: {user.username} ({user.email})")
        print(f"Role: {user.role}")
        print(f"Current password hash: {user.password[:50] if user.password else 'None'}...")
        
        # Reset password to something we know
        new_password = "admin123"
        new_hash = get_password_hash(new_password)
        
        user.password = new_hash
        db.commit()
        
        print(f"Password reset to: {new_password}")
        
        # Test login
        if verify_password(new_password, user.password):
            print("Password verification successful!")
            
            # Create token
            token_data = {
                "sub": str(user.id),
                "email": user.email,
                "role": user.role,
                "username": user.username
            }
            
            token = create_access_token(token_data)
            print(f"Full Token: {token}")
            print("") 
            print("Copy this token and run in browser console:")
            print(f"localStorage.setItem('access_token', '{token}')")
            print("")
            
            # Test API call
            import requests
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get("http://127.0.0.1:8000/v1/candidates", headers=headers)
            print(f"API Test - Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Candidates found: {len(data) if isinstance(data, list) else 'Error in response format'}")
                if isinstance(data, list) and len(data) > 0:
                    print(f"First candidate: {data[0].get('full_name', 'No name')} ({data[0].get('email', 'No email')})")
            else:
                print(f"API Error: {response.text}")
                
        else:
            print("Password verification failed!")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_login()
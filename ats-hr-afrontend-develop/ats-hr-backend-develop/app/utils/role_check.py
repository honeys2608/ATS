from fastapi import HTTPException

ADMIN_ROLES = ["super_admin", "admin", "hr", "recruiter", "employee", "manager"]

def allow_user(current):
    if current.get("type") != "user":
        raise HTTPException(403, "Only admin type users can access this route")

def allow_candidate(current):
    if current.get("type") != "candidate":
        raise HTTPException(403, "Only candidates can access this route")

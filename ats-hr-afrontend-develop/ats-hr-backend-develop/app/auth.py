# app/auth.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional
import hashlib, secrets, os

from app.db import get_db
from app import models, schemas

# ⬇️ optional but useful for role separation frontend
from app.utils.role_check import allow_user, allow_candidate

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()

# In-memory OTP store for candidate registration (dev-friendly)
# Format: {user_id: {"otp": "123456", "expires_at": datetime}}
candidate_registration_otps = {}

# JWT config
SECRET_KEY = os.getenv("SESSION_SECRET", "akshu-hr-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hrs


# =====================================================================
# PASSWORD HASH
# =====================================================================
def get_password_hash(password: str):
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()
    return f"{salt}:{hashed}"

def verify_password(password: str, stored: str):
    # support legacy hash
    if ":" not in stored:
        return hashlib.sha256(password.encode()).hexdigest() == stored

    salt, old_hash = stored.split(":")
    new_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()
    return new_hash == old_hash

# =====================================================================
# JWT
# =====================================================================
def create_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    data.update({"exp": expire})
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)


# =====================================================================
# CURRENT USER
# =====================================================================
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security),
                     db: Session = Depends(get_db)):

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")

    uid = payload.get("sub")
    role = payload.get("role")
    utype = payload.get("type", "user")   # default admin side

    if not uid:
        raise HTTPException(401, "Invalid token: missing user ID")

    # -------------------- Candidate
    if utype == "candidate":
        user = db.query(models.Candidate).filter(models.Candidate.id == uid).first()
        if not user:
            raise HTTPException(401, "Candidate not found")

        return {
            "id": user.id,
            "email": user.email,
            "name": user.full_name,
            "role": "candidate",
            "type": "candidate"
        }

    # -------------------- Admin/User
    user = db.query(models.User).filter(models.User.id == uid).first()
    if not user:
        raise HTTPException(401, "User not found")

    # 🔥 allow admin even if inactive; only block when explicitly set False
    if user.is_active is False and user.role not in ["admin", "super_admin"]:
        raise HTTPException(403, "User account is locked")

    return {
        "id": user.id,
        "email": user.email,
        "name": user.full_name,
        "role": role,
        "type": "user",
        "client_id": user.client_id
    }
@router.post("/login")
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):

    # Validate input
    if not data.email or not data.email.strip():
        raise HTTPException(400, "Email is required")
    
    if not data.password or not data.password.strip():
        raise HTTPException(400, "Password is required")

    # 1️⃣ Try Admin/HR/Recruiter
    user = db.query(models.User).filter(
        (models.User.email == data.email) | (models.User.username == data.email)
    ).first()

    # 2️⃣ If admin not found, try Candidate
    candidate = None if user else db.query(models.Candidate).filter(
        models.Candidate.email == data.email
    ).first()

    if not user and not candidate:
        raise HTTPException(404, "Account not found")

    account = user or candidate     # unify checking

    if not verify_password(data.password, account.password):
        raise HTTPException(401, "Incorrect password")


    # -------------------- Admin/User Token
    if user:
        token = create_access_token({"sub": user.id, "role": user.role, "type": "user", "client_id": user.client_id})
        return {
            "access_token": token,
            "token_type": "bearer",
            "type": "user",
            "role": user.role,
            "user_id": user.id,
            "client_id": user.client_id
        }

    # -------------------- Candidate Token
    # 🔥 FIX: Include email in token for consistency with registration
    token = create_access_token({
        "sub": candidate.id,
        "email": candidate.email,
        "role": "candidate",
        "type": "candidate"
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "type": "candidate",
        "role": "candidate",
        "user": {
            "id": candidate.id,
            "email": candidate.email,
            "name": candidate.full_name,
            "role": "candidate",
            "type": "candidate"
        }
    }


# =====================================================================
# ADMIN/HR USER REGISTER
# =====================================================================
@router.post("/register", response_model=schemas.UserResponse)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):

    # No changes — same behavior
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(400, "Email already registered")
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(400, "Username already taken")

    role = data.role.lower() if data.role else "employee"

    user = models.User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        password=get_password_hash(data.password),
        role=role,
        is_active=True,
    )

    db.add(user); db.commit(); db.refresh(user)
    return user



# =====================================================================
# =====================================================================
# CANDIDATE REGISTER (FIXED WITH PUBLIC ID GENERATION)
# =====================================================================
@router.post("/candidate/register")
def candidate_register(data: schemas.CandidateRegister, db: Session = Depends(get_db)):

    # Check duplicate email
    if db.query(models.Candidate).filter(models.Candidate.email == data.email).first():
        raise HTTPException(400, "Email already used")

    # ---------------------------
    # 1) Fetch ORG CODE from settings
    # ---------------------------
    org_setting = db.query(models.SystemSettings).filter(
        models.SystemSettings.module_name == "organization",
        models.SystemSettings.setting_key == "organization_code"
    ).first()

    org_code = "ORG"
    if org_setting and isinstance(org_setting.setting_value, dict):
        org_code = org_setting.setting_value.get("code", "ORG")

    # ---------------------------
    # 2) Fetch CANDIDATE PREFIX from settings
    # ---------------------------
    cand_prefix_setting = db.query(models.SystemSettings).filter(
        models.SystemSettings.module_name == "organization",
        models.SystemSettings.setting_key == "candidate_prefix"
    ).first()

    cand_prefix = "C"
    if cand_prefix_setting and isinstance(cand_prefix_setting.setting_value, dict):
        cand_prefix = cand_prefix_setting.setting_value.get("prefix", "C")

    # ---------------------------
    # 3) Generate next public ID → INF-C-0001
    # ---------------------------
    prefix = f"{org_code}-{cand_prefix}-"

    last = (
        db.query(models.Candidate.public_id)
        .filter(models.Candidate.public_id.like(f"{prefix}%"))
        .order_by(models.Candidate.public_id.desc())
        .first()
    )

    if last and last[0]:
        try:
            last_num = int(last[0].split("-")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1

    public_id = f"{prefix}{next_num:04d}"

    # ---------------------------
    # 4) Create candidate entry
    # ---------------------------
    c = models.Candidate(
    public_id=public_id,
    full_name=data.full_name,
    email=data.email,
    password=get_password_hash(data.password),
    status="new",
    source="Portal"   # ✅ EXACT FIX — YAHIN ADD KARO
)

    db.add(c)
    db.commit()
    db.refresh(c)

    # ---------------------------
    # 5) Generate OTP for registration verification
    # ---------------------------
    otp = str(secrets.randbelow(999999)).zfill(6)
    candidate_registration_otps[c.id] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
    }
    print(f"\nCandidate Registration OTP for {c.email}: {otp}")

    token = create_access_token({
        "sub": c.id,
        "email": c.email,
        "role": "candidate",
        "type": "candidate"
    })

    return {
        "message": "OTP sent to email",
        "user_id": c.id,
        "access_token": token,
        "token_type": "bearer",
        "type": "candidate",
        "role": "candidate",
        "user": {
            "id": c.id,
            "email": c.email,
            "name": c.full_name,
            "role": "candidate",
            "type": "candidate"
        }
    }


# =====================================================================
# CANDIDATE REGISTER OTP VERIFY
# =====================================================================
@router.post("/verify-otp-registration")
def verify_registration_otp(
    data: schemas.VerifyRegistrationOTPRequest,
    db: Session = Depends(get_db),
):
    cand = db.query(models.Candidate).filter(
        models.Candidate.id == data.user_id
    ).first()
    if not cand:
        raise HTTPException(404, "Candidate not found")

    record = candidate_registration_otps.get(cand.id)
    if not record or record.get("otp") != data.otp:
        raise HTTPException(400, "Invalid OTP")

    if datetime.utcnow() > record.get("expires_at"):
        candidate_registration_otps.pop(cand.id, None)
        raise HTTPException(400, "OTP expired")

    candidate_registration_otps.pop(cand.id, None)
    return {"message": "OTP verified"}


# =====================================================================
# CANDIDATE REGISTER OTP RESEND
# =====================================================================
@router.post("/resend-otp")
def resend_registration_otp(
    data: schemas.ResendRegistrationOTPRequest,
    db: Session = Depends(get_db),
):
    cand = db.query(models.Candidate).filter(
        models.Candidate.id == data.user_id
    ).first()
    if not cand:
        raise HTTPException(404, "Candidate not found")

    otp = str(secrets.randbelow(999999)).zfill(6)
    candidate_registration_otps[cand.id] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
    }
    print(f"\nCandidate Registration OTP for {cand.email}: {otp}")
    return {"message": "OTP sent to email"}


# =====================================================================
# OTP Password Reset (unchanged)
# =====================================================================
@router.post("/forgot-password")
def forgot_password(data: schemas.SendOTPRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.email == data.email
    ).first()

    if not user:
        user = db.query(models.Candidate).filter(
            models.Candidate.email == data.email
        ).first()

    if not user:
        raise HTTPException(404, "Email not registered")

    otp = str(secrets.randbelow(999999)).zfill(6)
    user.otp_code = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    print("\n📌 OTP:", otp)
    return {"message": "OTP sent to email"}


@router.post("/verify-otp")
def verify_otp(data: schemas.VerifyOTPRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.email == data.email
    ).first()

    if not user:
        user = db.query(models.Candidate).filter(
            models.Candidate.email == data.email
        ).first()

    if not user or user.otp_code != data.otp:
        raise HTTPException(400, "Invalid OTP")

    if datetime.utcnow() > user.otp_expiry:
        raise HTTPException(400, "OTP expired")

    return {"message": "OTP verified"}


@router.post("/reset-password")
def reset_pw(data: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.email == data.email
    ).first()

    if not user:
        user = db.query(models.Candidate).filter(
            models.Candidate.email == data.email
        ).first()

    if not user:
        raise HTTPException(404, "User not found")

    if user.otp_code != data.otp:
        raise HTTPException(400, "Invalid OTP")

    user.password = get_password_hash(data.new_password)
    user.otp_code = None
    user.otp_expiry = None
    db.commit()

    return {"message": "Password reset successful"}

# ---------------------------- LOGOUT
@router.post("/logout")
def logout(): return {"message":"Logged out — Remove token in frontend"}


# ---------------------------- WHO AM I
@router.get("/me")
def me(
    current=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current.get("type") == "candidate":
        return current

    user = db.query(models.User).filter(models.User.id == current["id"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "company_name": user.company_name,
        "is_active": user.is_active,
    }


# ---------------------------- UPDATE MY PROFILE
@router.put("/me")
def update_me(
    payload: dict,
    current=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current.get("type") == "candidate":
        raise HTTPException(403, "Candidate profile updates are not supported here")

    user = db.query(models.User).filter(models.User.id == current["id"]).first()
    if not user:
        raise HTTPException(404, "User not found")

    if "full_name" in payload:
        user.full_name = payload.get("full_name")
    if "company_name" in payload:
        user.company_name = payload.get("company_name")

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "company_name": user.company_name,
        "is_active": user.is_active,
    }
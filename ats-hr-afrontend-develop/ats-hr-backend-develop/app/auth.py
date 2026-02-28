# app/auth.py
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import jwt, JWTError
from typing import Optional
import hashlib, secrets, os

from app.db import get_db
from app import models, schemas
from app.validators import validate_email, validate_password
from app.services.audit_service import log_audit, map_audit_severity
from app.utils.activity import log_activity
from app.services.audit_service import log_audit, map_audit_severity
from app.permissions import get_user_permissions

# â¬‡ï¸ optional but useful for role separation frontend
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


def _get_system_setting_value(db: Session, key: str, default=None):
    row = (
        db.query(models.SystemSettings)
        .filter(
            (models.SystemSettings.config_key == key)
            | (
                (models.SystemSettings.module_name == key.split(".", 1)[0])
                & (models.SystemSettings.setting_key == key.split(".", 1)[1] if "." in key else key)
            )
        )
        .order_by(models.SystemSettings.updated_at.desc())
        .first()
    )
    if not row:
        return default
    if row.value_json is not None:
        return row.value_json
    if row.setting_value is not None:
        return row.setting_value
    return default


def _request_meta(request: Request) -> tuple[Optional[str], Optional[str]]:
    ip_addr = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return ip_addr, ua


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
    data.update({"exp": expire, "iat": datetime.utcnow()})
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
    token_iat = payload.get("iat")

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

    if token_iat and getattr(user, "session_invalid_after", None):
        try:
            token_iat_dt = datetime.utcfromtimestamp(float(token_iat))
            if token_iat_dt < user.session_invalid_after:
                raise HTTPException(401, "Session expired. Please login again.")
        except HTTPException:
            raise
        except Exception:
            pass

    # ðŸ”¥ allow admin even if inactive; only block when explicitly set False
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
def login(data: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip_addr = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    min_length = int(_get_system_setting_value(db, "auth.password_min_length", 8) or 8)
    mfa_required = bool(_get_system_setting_value(db, "auth.mfa_required_global", False))

    if data.password and len(data.password) < min_length:
        raise HTTPException(400, detail={"field": "password", "message": f"Password must be at least {min_length} characters"})

    if mfa_required and not data.otp:
        raise HTTPException(403, detail={"field": "otp", "message": "MFA is required. Provide OTP to continue."})

    valid_email, email_err = validate_email(data.email)
    if not valid_email:
        log_audit(
            actor=None,
            action="USER_LOGIN_FAILED",
            action_label="Login Failed",
            module="Authentication",
            entity_type="user",
            entity_name=data.email,
            status="failed",
            severity=map_audit_severity(action="USER_LOGIN_FAILED", status="failed"),
            failure_reason=email_err,
            endpoint=str(request.url.path),
            http_method=request.method,
            response_code=400,
            ip_address=ip_addr,
            user_agent=ua,
        )
        raise HTTPException(400, detail={"field": "email", "message": email_err})

    valid_pwd, pwd_err = validate_password(data.password)
    if not valid_pwd:
        log_audit(
            actor=None,
            action="USER_LOGIN_FAILED",
            action_label="Login Failed",
            module="Authentication",
            entity_type="user",
            entity_name=data.email,
            status="failed",
            severity=map_audit_severity(action="USER_LOGIN_FAILED", status="failed"),
            failure_reason=pwd_err,
            endpoint=str(request.url.path),
            http_method=request.method,
            response_code=400,
            ip_address=ip_addr,
            user_agent=ua,
        )
        raise HTTPException(400, detail={"field": "password", "message": pwd_err})

    user = db.query(models.User).filter(
        (models.User.email == data.email) | (models.User.username == data.email)
    ).first()
    candidate = None if user else db.query(models.Candidate).filter(models.Candidate.email == data.email).first()

    if not user and not candidate:
        db.add(
            models.LoginLog(
                user_id=None,
                username=data.email,
                email=data.email,
                status="failed",
                ip_address=ip_addr,
                user_agent=ua,
                message="Invalid email or password",
            )
        )
        db.commit()
        log_audit(
            actor={"email": data.email},
            action="USER_LOGIN_FAILED",
            action_label="Login Failed",
            module="Authentication",
            entity_type="user",
            entity_name=data.email,
            status="failed",
            severity=map_audit_severity(action="USER_LOGIN_FAILED", status="failed"),
            failure_reason="Invalid email or password",
            endpoint=str(request.url.path),
            http_method=request.method,
            response_code=401,
            ip_address=ip_addr,
            user_agent=ua,
        )
        raise HTTPException(401, detail={"field": "general", "message": "Invalid email or password"})

    if user:
        now = datetime.utcnow()

        if user.is_active is False:
            db.add(
                models.LoginLog(
                    user_id=user.id,
                    username=user.username,
                    email=user.email,
                    status="failed",
                    ip_address=ip_addr,
                    user_agent=ua,
                    message="Account locked",
                )
            )
            db.commit()
            log_audit(
                actor={"id": user.id, "email": user.email, "role": user.role, "name": user.full_name or user.username, "client_id": user.client_id},
                action="ACCOUNT_LOCKED",
                action_label="Account Locked",
                module="Authentication",
                entity_type="user",
                entity_id=user.id,
                entity_name=user.full_name or user.email or user.username,
                status="failed",
                severity=map_audit_severity(action="ACCOUNT_LOCKED", status="failed"),
                failure_reason="Account is locked",
                endpoint=str(request.url.path),
                http_method=request.method,
                response_code=403,
                ip_address=ip_addr,
                user_agent=ua,
            )
            raise HTTPException(403, detail={"field": "general", "message": "User account is locked"})

        if getattr(user, "account_locked_until", None) and user.account_locked_until > now:
            log_audit(
                actor={"id": user.id, "email": user.email, "role": user.role, "name": user.full_name or user.username, "client_id": user.client_id},
                action="ACCOUNT_LOCKED",
                action_label="Account Locked",
                module="Authentication",
                entity_type="user",
                entity_id=user.id,
                entity_name=user.full_name or user.email or user.username,
                status="failed",
                severity=map_audit_severity(action="ACCOUNT_LOCKED", status="failed"),
                failure_reason="Account locked due to multiple failed attempts",
                endpoint=str(request.url.path),
                http_method=request.method,
                response_code=403,
                ip_address=ip_addr,
                user_agent=ua,
            )
            raise HTTPException(403, detail={"field": "general", "message": "Account locked due to multiple failed attempts. Try again later."})

        if not verify_password(data.password, user.password):
            if hasattr(user, "failed_login_attempts"):
                user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if hasattr(user, "last_failed_login_at"):
                user.last_failed_login_at = now
            locked_now = False
            if hasattr(user, "account_locked_until") and hasattr(user, "failed_login_attempts") and (user.failed_login_attempts or 0) >= 5:
                user.account_locked_until = now + timedelta(minutes=15)
                locked_now = True
            db.add(user)
            db.add(
                models.LoginLog(
                    user_id=user.id,
                    username=user.username,
                    email=user.email,
                    status="failed",
                    ip_address=ip_addr,
                    user_agent=ua,
                    message="Account locked due to multiple failed attempts" if locked_now else "Incorrect password",
                )
            )
            db.commit()
            action = "ACCOUNT_LOCKED" if locked_now else "USER_LOGIN_FAILED"
            reason = "Account locked due to multiple failed attempts" if locked_now else "Incorrect password"
            code = 403 if locked_now else 401
            log_audit(
                actor={"id": user.id, "email": user.email, "role": user.role, "name": user.full_name or user.username, "client_id": user.client_id},
                action=action,
                action_label="Account Locked" if locked_now else "Login Failed",
                module="Authentication",
                entity_type="user",
                entity_id=user.id,
                entity_name=user.full_name or user.email or user.username,
                status="failed",
                severity=map_audit_severity(action=action, status="failed"),
                failure_reason=reason,
                endpoint=str(request.url.path),
                http_method=request.method,
                response_code=code,
                ip_address=ip_addr,
                user_agent=ua,
            )
            raise HTTPException(code, detail={"field": "general" if locked_now else "password", "message": reason})

        if hasattr(user, "failed_login_attempts"):
            user.failed_login_attempts = 0
        if hasattr(user, "account_locked_until"):
            user.account_locked_until = None
        if hasattr(user, "last_login_at"):
            user.last_login_at = now
        if hasattr(user, "status"):
            user.status = "active"
        db.add(user)
        db.add(
            models.LoginLog(
                user_id=user.id,
                username=user.username,
                email=user.email,
                status="success",
                ip_address=ip_addr,
                user_agent=ua,
                message="Login successful",
            )
        )
        log_activity(
            db,
            action=f"{user.role}.login" if user.role else "user.login",
            resource_type="user",
            actor={"id": user.id, "full_name": user.full_name, "role": user.role},
            resource_id=user.id,
            resource_name=user.full_name or user.email,
            target_user_id=user.id,
            is_visible_to_candidate=False,
        )
        db.commit()
        log_audit(
            actor={"id": user.id, "email": user.email, "role": user.role, "name": user.full_name or user.username, "client_id": user.client_id},
            action="USER_LOGIN_SUCCESS",
            action_label="Login Successful",
            module="Authentication",
            entity_type="user",
            entity_id=user.id,
            entity_name=user.full_name or user.email or user.username,
            status="success",
            severity=map_audit_severity(action="USER_LOGIN_SUCCESS", status="success"),
            endpoint=str(request.url.path),
            http_method=request.method,
            response_code=200,
            ip_address=ip_addr,
            user_agent=ua,
        )
        token = create_access_token({"sub": user.id, "role": user.role, "type": "user", "client_id": user.client_id})
        return {
            "access_token": token,
            "token_type": "bearer",
            "type": "user",
            "role": user.role,
            "permissions": get_user_permissions(user.role),
            "user_id": user.id,
            "client_id": user.client_id,
        }

    if not verify_password(data.password, candidate.password):
        db.add(
            models.LoginLog(
                user_id=candidate.id,
                username=candidate.full_name or candidate.email,
                email=candidate.email,
                status="failed",
                ip_address=ip_addr,
                user_agent=ua,
                message="Incorrect password",
            )
        )
        db.commit()
        log_audit(
            actor={"id": candidate.id, "email": candidate.email, "role": "candidate", "name": candidate.full_name},
            action="USER_LOGIN_FAILED",
            action_label="Login Failed",
            module="Authentication",
            entity_type="user",
            entity_id=candidate.id,
            entity_name=candidate.full_name or candidate.email,
            status="failed",
            severity=map_audit_severity(action="USER_LOGIN_FAILED", status="failed"),
            failure_reason="Incorrect password",
            endpoint=str(request.url.path),
            http_method=request.method,
            response_code=401,
            ip_address=ip_addr,
            user_agent=ua,
        )
        raise HTTPException(401, detail={"field": "password", "message": "Incorrect password"})

    token = create_access_token({"sub": candidate.id, "email": candidate.email, "role": "candidate", "type": "candidate"})
    db.add(
        models.LoginLog(
            user_id=candidate.id,
            username=candidate.full_name or candidate.email,
            email=candidate.email,
            status="success",
            ip_address=ip_addr,
            user_agent=ua,
            message="Candidate login successful",
        )
    )
    log_activity(
        db,
        action="candidate.login",
        resource_type="user",
        actor={"id": candidate.id, "full_name": candidate.full_name, "role": "candidate"},
        resource_id=candidate.id,
        resource_name=candidate.full_name or candidate.email,
        target_user_id=candidate.id,
        is_visible_to_candidate=True,
    )
    db.commit()
    log_audit(
        actor={"id": candidate.id, "email": candidate.email, "role": "candidate", "name": candidate.full_name},
        action="USER_LOGIN_SUCCESS",
        action_label="Login Successful",
        module="Authentication",
        entity_type="user",
        entity_id=candidate.id,
        entity_name=candidate.full_name or candidate.email,
        status="success",
        severity=map_audit_severity(action="USER_LOGIN_SUCCESS", status="success"),
        endpoint=str(request.url.path),
        http_method=request.method,
        response_code=200,
        ip_address=ip_addr,
        user_agent=ua,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "type": "candidate",
        "role": "candidate",
        "permissions": get_user_permissions("candidate"),
        "user": {
            "id": candidate.id,
            "email": candidate.email,
            "name": candidate.full_name,
            "role": "candidate",
            "type": "candidate",
        },
    }
# =====================================================================
# ADMIN/HR USER REGISTER
# =====================================================================
@router.post("/register", response_model=schemas.UserResponse)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Email validation
    valid_email, email_err = validate_email(data.email)
    if not valid_email:
        raise HTTPException(400, detail={"field": "email", "message": email_err})
    # Password validation
    valid_pwd, pwd_err = validate_password(data.password)
    if not valid_pwd:
        raise HTTPException(400, detail={"field": "password", "message": pwd_err})
    # Username validation (simple)
    if not data.username or not data.username.strip():
        raise HTTPException(400, detail={"field": "username", "message": "Username is required"})
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(400, detail={"field": "email", "message": "Email already registered"})
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(400, detail={"field": "username", "message": "Username already taken"})
    role = data.role.lower() if data.role else "admin"
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
    # 3) Generate next public ID â†’ INF-C-0001
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
    source="Portal"   # âœ… EXACT FIX â€” YAHIN ADD KARO
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

    print("\nðŸ“Œ OTP:", otp)
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
def logout(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        role = str(current_user.get("role") or "user").strip().lower()
        log_activity(
            db,
            action=f"{role}.logout",
            resource_type="user",
            actor=current_user,
            resource_id=current_user.get("id"),
            resource_name=current_user.get("name") or current_user.get("email"),
            target_user_id=current_user.get("id"),
            is_visible_to_candidate=(role == "candidate"),
        )
        db.commit()
    except Exception:
        db.rollback()
    return {"message": "Logged out - Remove token in frontend"}


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



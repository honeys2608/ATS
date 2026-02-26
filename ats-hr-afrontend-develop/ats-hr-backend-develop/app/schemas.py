
from pydantic import BaseModel, Field, EmailStr, validator, constr, confloat
from typing import Optional, List, Any, Dict
from datetime import datetime
from fastapi import Form
from enum import Enum
from datetime import date
import re

# ==========================
# FILTERS & SORTING ENUMS
# ==========================
class SortByEnum(str, Enum):
    name = "name"
    email = "email"
    recent = "recent"
    date = "date"

class SortOrderEnum(str, Enum):
    asc = "asc"
    desc = "desc"

class FilterSortRequest(BaseModel):
    sort_by: Optional[SortByEnum] = SortByEnum.recent
    sort_order: Optional[SortOrderEnum] = SortOrderEnum.desc
    # Search filters
    name: Optional[str] = None
    email: Optional[str] = None
    applied_job: Optional[str] = None  # 🔍 Added for applied job search
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None

    class Config:
        from_attributes = True

# ============================================================
# PHONE VALIDATION (Market Standard - International Format)
# ============================================================
PHONE_REGEX = re.compile(r"^(?:\+\d{1,3})?[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}$")

def normalize_phone(v: str):
    if v is None:
        return v

    v = v.strip()

    # Support international format
    if not PHONE_REGEX.match(v):
        raise ValueError("Invalid phone number format")

    # Normalize Indian numbers to +91 format
    if v.startswith("91") and not v.startswith("+91"):
        v = "+91" + v[2:]
    elif not v.startswith("+") and len(v.replace(r"\D", "")) == 10:
        # Indian 10-digit format
        v = "+91" + v

    return v

# ============================================================
# PASSWORD VALIDATION (NIST SP 800-63B Standards)
# ============================================================
def validate_strong_password(password: str):
    """
    Market-standard password validation following NIST SP 800-63B
    - Minimum 8 characters
    - Must contain: uppercase, lowercase, number, special character
    - No common patterns
    """
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    if len(password) > 128:
        raise ValueError("Password is too long")

    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")

    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")

    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")

    if not re.search(r"[@$!%*?&#^()\-_=\[\]{};':\"\\|,.<>/?]", password):
        raise ValueError("Password must contain at least one special character")

    return password

# ============================================================
# TEXT FORMATTING (Title Case for Names/Departments)
# ============================================================
def to_title_case(value: str):
    """
    Smart title case formatting for professional names and titles
    """
    if value is None:
        return value

    value = value.strip()
    if not value:
        return value

    words = value.split()
    formatted = []

    for word in words:
        # Preserve existing ALL CAPS words (acronyms)
        if word.isupper() and len(word) > 1:
            formatted.append(word)
            continue

        lw = word.lower()

        # Acronym rule: short words (<=3 chars) become uppercase
        if len(lw) <= 3:
            formatted.append(lw.upper())
            continue

        # Special character rule (R&D, UI/UX, etc.)
        if any(ch in lw for ch in ["&", "/", "-"]):
            formatted.append(lw.upper())
            continue

        # Normal title case
        formatted.append(lw.capitalize())

    return " ".join(formatted)

class JobStatusEnum(str, Enum):
    draft = "draft"
    active = "active"
    closed = "closed"
    on_hold = "on_hold"

# ==========================
# JOB LIST RESPONSE (🔥 REQUIRED)
# ==========================

class JobListItem(BaseModel):
    id: str                     # internal UUID
    job_id: Optional[str]       # ⭐ ATS-J-0001
    title: str
    department: Optional[str]
    location: Optional[str]
    status: JobStatusEnum
    created_at: Optional[datetime]
    
    # Activity tracking fields
    last_activity_at: Optional[datetime] = None
    last_activity_type: Optional[str] = None
    last_activity_relative: Optional[str] = None

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    total: int = 0
    jobs: List[JobListItem] = Field(default_factory=list)
    data: Optional[List[JobListItem]] = None
    currentPage: Optional[int] = None
    totalPages: Optional[int] = None
    totalRecords: Optional[int] = None
    limit: Optional[int] = None

    class Config:
        from_attributes = True

# ==========================
# Base Response
# ==========================
class ResponseBase(BaseModel):
    message: Optional[str] = None


# ==========================
# USER / AUTH / ROLES
# ==========================
class UserBase(BaseModel):
    id: Optional[str]
    username: Optional[str]
    email: Optional[str]
    full_name: Optional[str]
    role: Optional[str]
    is_active: Optional[bool] = True   # ✅ ADD THIS LINE

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str
    full_name: Optional[str] = None

    @validator("password")
    def strong_password(cls, v):
        return validate_strong_password(v)


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(UserBase):
    created_at: Optional[datetime]


class RoleSchema(BaseModel):
    id: Optional[int]
    name: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class RoleResponse(BaseModel):
    id: Optional[int]
    name: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PermissionSchema(BaseModel):
    id: Optional[str]
    role_name: str
    module_name: str
    action_name: str

    class Config:
        from_attributes = True


class PermissionCreate(BaseModel):
    role_name: str
    module_name: str
    action_name: str


class PermissionResponse(BaseModel):
    id: Optional[str]
    role_name: str
    module_name: str
    action_name: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==========================
# JOB SCHEMAS
# ==========================


# ==========================
# ACCOUNT MANAGER (MINI)
# ==========================
class AccountManagerMini(BaseModel):
    id: Optional[str]
    full_name: Optional[str]
    email: Optional[str]

    class Config:
        from_attributes = True

class JobBase(BaseModel):
    id: Optional[str]
    job_id: Optional[str] = None
    title: str
    company_name: Optional[str] = None
    description: Optional[str] = None
    skills: Optional[List[str]] = []
    min_experience: Optional[int]
    max_experience: Optional[int]
    location: Optional[str]
    department: Optional[str]
    job_type: Optional[str] = None
    salary_range: Optional[str] = None
    apply_by: Optional[date] = None
    sla_days: Optional[int] = None
    jd_url: Optional[str] = None
        
    class Config:
        from_attributes = True



class JobCreate(BaseModel):
    title: str
    company_name: Optional[str] = None
    description: Optional[str] = None
    skills: Optional[List[str]] = []
    min_experience: int = 0
    max_experience: Optional[int] = None
    location: Optional[str] = None
    department: Optional[str] = None
    job_type: Optional[str] = None
    salary_range: Optional[str] = None
    apply_by: Optional[date] = None
    sla_days: Optional[int] = None


    status: JobStatusEnum = JobStatusEnum.active   # 🔥 FIX
    is_active: bool = True
    client_id: Optional[str] = None
    @validator("title", pre=True)
    def normalize_title(cls, v):
        return to_title_case(v)

    @validator("department", pre=True)
    def normalize_department(cls, v):
        return to_title_case(v)

# ==========================
# JOB UPDATE (🔥 REQUIRED)
# ==========================
class JobUpdate(BaseModel):
    title: Optional[str] = None
    company_name: Optional[str] = None
    description: Optional[str] = None
    skills: Optional[List[str]] = None
    min_experience: Optional[int] = None
    max_experience: Optional[int] = None
    job_type: Optional[str] = None
    salary_range: Optional[str] = None
    apply_by: Optional[date] = None
    sla_days: Optional[int] = None

    location: Optional[str] = None
    department: Optional[str] = None
    status: Optional[JobStatusEnum] = None
    is_active: Optional[bool] = None
    client_id: Optional[str] = None
    # ✅ AUTO TITLE CASE (ONLY IF PROVIDED)
    @validator("title", pre=True)
    def normalize_title(cls, v):
        return to_title_case(v)

    @validator("department", pre=True)
    def normalize_department(cls, v):
        return to_title_case(v)

    class Config:
        from_attributes = True



class JobResponse(JobBase):
    min_experience: Optional[int] = None
    max_experience: Optional[int] = None
    job_type: Optional[str] = None
    salary_range: Optional[str] = None
    apply_by: Optional[date] = None
    sla_days: Optional[int] = None

    status: JobStatusEnum   # 🔥 FIX
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None
    client_id: Optional[str] = None
    account_manager: Optional[AccountManagerMini] = None



class PublicJobResponse(JobBase):
    min_experience: Optional[int] = None
    max_experience: Optional[int] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True



# ==========================
# CERTIFICATION SCHEMAS
# ==========================
class CertificationCreate(BaseModel):
    name: str
    organization: str
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None

    @validator("name")
    def validate_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError("Certification name must be at least 2 characters")
        return v.strip()

    @validator("organization")
    def validate_organization(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError("Organization must be at least 2 characters")
        return v.strip()

    @validator("credential_url", pre=True)
    def validate_credential_url(cls, v):
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Credential URL must start with http:// or https://")
        return v


class CertificationResponse(BaseModel):
    id: str
    name: str
    organization: str
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CertificationsUpdate(BaseModel):
    certifications: List[CertificationCreate]


# ==========================
# CANDIDATE SCHEMAS

class CandidateClassificationEnum(str, Enum):
    unclassified = "unclassified"
    payroll = "payroll"
    sourcing = "sourcing"

class CandidateBase(BaseModel):
    id: Optional[str] = None
    public_id: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    alternate_email: Optional[str] = None
    emergency_contact: Optional[str] = None
    dob: Optional[datetime] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    marital_status: Optional[str] = None
    
    # Address
    current_location: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    current_address: Optional[str] = None
    permanent_address: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    
    # Application
    applied_job_id: Optional[str] = None
    job_title: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    referral: Optional[str] = None
    account_manager_id: Optional[str] = None
    account_manager_name: Optional[str] = None
    account_manager_email: Optional[str] = None
    
    # Profile
    profile_completed: Optional[bool] = False
    profile_completion: Optional[int] = 0
    resume_url: Optional[str] = None
    resume_path: Optional[str] = None
    parsed_resume: Optional[Any] = None
    parsed_data_json: Optional[Any] = None
    resume_versions: Optional[List[Any]] = []
    photo_url: Optional[str] = None
    
    # Professional
    skills: Optional[List[str]] = []
    experience_years: Optional[float] = None
    experience: Optional[str] = None
    education: Optional[Any] = None
    current_employer: Optional[str] = None
    previous_employers: Optional[Any] = None
    notice_period: Optional[str] = None
    current_role: Optional[str] = None
    professional_headline: Optional[str] = None
    employment_status: Optional[str] = None
    career_summary: Optional[str] = None
    work_history: Optional[List[Any]] = None
    education_history: Optional[List[Any]] = None
    projects: Optional[List[Any]] = None
    references: Optional[List[Any]] = None
    certifications: Optional[List[Any]] = None
    
    # Compensation
    current_ctc: Optional[float] = None
    expected_ctc: Optional[str] = None
    expected_salary: Optional[float] = None
    minimum_ctc: Optional[float] = None
    salary_negotiable: Optional[bool] = None
    
    # Preferences
    preferred_location: Optional[str] = None
    ready_to_relocate: Optional[str] = None
    willing_to_relocate: Optional[bool] = None
    preferred_work_mode: Optional[str] = None
    availability_status: Optional[str] = None
    travel_availability: Optional[str] = None
    work_authorization: Optional[str] = None
    requires_sponsorship: Optional[bool] = None
    available_from: Optional[datetime] = None
    time_zone: Optional[str] = None
    
    # Links
    languages_known: Optional[Any] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    
    created_at: Optional[datetime] = None

    # 🔥 Forwarding fields
    forwarded_to: Optional[str] = None
    forward_note: Optional[str] = None
    forwarded_at: Optional[datetime] = None
    classification: Optional[str] = "unclassified"
    intake_status: Optional[str] = None
    uploaded_by_recruiter_id: Optional[str] = None

    # ⭐⭐⭐ BGV FIELDS ⭐⭐⭐
    bgv_status: Optional[str] = "new"           # new | pending | in_progress | completed | failed
    bgv_vendor_id: Optional[str] = None         # assigned Vendor ID
    bgv_initiated: Optional[bool] = False

    class Config:
        from_attributes = True

class CandidateClassificationUpdate(BaseModel):
    classification: CandidateClassificationEnum


class CandidateRegister(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str

    @validator("password")
    def strong_password(cls, v):
        return validate_strong_password(v)

    @validator("confirm_password")
    def passwords_match(cls, v, values):
        if "password" in values and v != values["password"]:
            raise ValueError("Passwords do not match")
        return v


class CandidateLogin(BaseModel):
    email: str
    password: str


class CandidateUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    current_location: Optional[str] = None
    current_address: Optional[str] = None
    permanent_address: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    experience_years: Optional[float] = None
    education: Optional[Any] = None
    current_employer: Optional[str] = None
    previous_employers: Optional[str] = None
    notice_period: Optional[str] = None
    expected_salary: Optional[str] = None
    expected_ctc: Optional[str] = None
    preferred_location: Optional[str] = None
    languages_known: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    source: Optional[str] = None
    referral: Optional[str] = None
    city: Optional[str] = None
    
    @validator("phone", allow_reuse=True)
    def validate_phone(cls, v):
        if v:
            return normalize_phone(v)
        return v


class CandidateResponse(CandidateBase):
    public_id: Optional[str] = None
    embedding_vector: Optional[Any] = None
    fit_score: Optional[float] = None
    fit_explanation: Optional[Any] = None
    email_logs: Optional[List[Any]] = []
    tags: Optional[List[str]] = []

    forwarded_to: Optional[str] = None
    forward_note: Optional[str] = None
    forwarded_at: Optional[datetime] = None

    # ⭐⭐⭐ BGV FIELDS ⭐⭐⭐
    bgv_status: Optional[str] = None
    bgv_vendor_id: Optional[str] = None
    bgv_initiated: Optional[bool] = None

    # Certifications
    certifications: Optional[List[CertificationResponse]] = []
    profile_strength_percentage: Optional[int] = None

    # Activity tracking fields
    last_activity_at: Optional[datetime] = None
    last_activity_type: Optional[str] = None
    last_activity_relative: Optional[str] = None

    class Config:
        from_attributes = True


class CandidateBulkUploadLogResponse(BaseModel):
    id: str
    filename: Optional[str]
    total_rows: int
    success_count: int
    failed_count: int
    error_csv_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CandidateBulkVerifyRequest(BaseModel):
    ids: List[str]

class CandidateSelfProfileUpdate(BaseModel):
    # ---------- Basic ----------
    full_name: Optional[str] = None
    fullName: Optional[str] = None  # Alias
    email: Optional[str] = None
    phone: Optional[str] = None
    @validator("phone")
    def validate_phone(cls, v):
        return normalize_phone(v)
    alternate_phone: Optional[str] = None
    alternate_email: Optional[str] = None
    emergency_contact: Optional[str] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    dob: Optional[date] = None
    dateOfBirth: Optional[date] = None  # Alias
    current_location: Optional[str] = None
    currentLocation: Optional[str] = None  # Alias
    city: Optional[str] = None
    pincode: Optional[str] = None
    current_address: Optional[str] = None
    currentAddress: Optional[str] = None  # Alias
    permanent_address: Optional[str] = None
    permanentAddress: Optional[str] = None  # Alias

    # ---------- Application ----------
    source: Optional[str] = None
    status: Optional[str] = None
    referral: Optional[str] = None

    # ---------- Professional ----------
    skills: Optional[List[str]] = None
    experience: Optional[str] = None
    experience_years: Optional[int] = None
    current_role: Optional[str] = None
    professional_headline: Optional[str] = None
    employment_status: Optional[str] = None
    career_summary: Optional[str] = None
    education: Optional[str] = None
    current_employer: Optional[str] = None
    currentEmployer: Optional[str] = None  # Alias
    previous_employers: Optional[str] = None
    previousEmployers: Optional[str] = None  # Alias
    notice_period: Optional[str] = None
    noticePeriod: Optional[str] = None  # Alias

    # ---------- Salary & Compensation ----------
    current_ctc: Optional[float] = None
    expected_salary: Optional[float] = None
    expectedCtc: Optional[str] = None  # Alias
    minimum_ctc: Optional[float] = None
    salary_negotiable: Optional[bool] = None

    # ---------- Preferences ----------
    preferred_location: Optional[str] = None
    preferredLocation: Optional[str] = None  # Alias
    ready_to_relocate: Optional[str] = None
    preferred_work_mode: Optional[str] = None
    availability_status: Optional[str] = None
    travel_availability: Optional[str] = None
    work_authorization: Optional[str] = None
    requires_sponsorship: Optional[bool] = None
    available_from: Optional[date] = None
    time_zone: Optional[str] = None

    # ---------- Links ----------
    languages_known: Optional[str] = None
    languagesKnown: Optional[str] = None  # Alias
    linkedin_url: Optional[str] = None
    linkedinUrl: Optional[str] = None  # Alias
    github_url: Optional[str] = None
    githubUrl: Optional[str] = None  # Alias
    portfolio_url: Optional[str] = None
    portfolioUrl: Optional[str] = None  # Alias
    resume_url: Optional[str] = None
    resumeUrl: Optional[str] = None  # Alias

    # ---------- Work History ----------
    work_history: Optional[List[dict]] = None

    # ---------- Certifications ----------
    certifications: Optional[List[CertificationCreate]] = None

    # ---------- Education History ----------
    education_history: Optional[List[dict]] = None
    educationHistory: Optional[List[dict]] = None  # Alias

    # ---------- Projects ----------
    projects: Optional[List[dict]] = None

    # ---------- References ----------
    references: Optional[List[dict]] = None

    # ---------- Profile Completion ----------
    profileCompletion: Optional[int] = None
    profileCompleted: Optional[bool] = None


    class Config:
        from_attributes = True
        extra = "ignore"

# ==========================
# Resume Version / Notes / Timeline
# ==========================
class ResumeVersion(BaseModel):
    version_id: str
    url: str
    uploaded_at: datetime
    parsed_snapshot: Optional[Any]

    class Config:
        from_attributes = True


class CandidateNoteCreate(BaseModel):
    note: Optional[str] = None
    submission_id: Optional[str] = None
    note_stage: Optional[str] = None
    rating: Optional[int] = None
    strengths: Optional[str] = None
    concerns: Optional[str] = None
    free_text: Optional[str] = None


class CandidateNoteResponse(BaseModel):
    id: str
    note: str
    submission_id: Optional[str] = None
    note_stage: Optional[str] = None
    rating: Optional[int] = None
    strengths: Optional[str] = None
    concerns: Optional[str] = None
    free_text: Optional[str] = None
    author: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateTimelineResponse(BaseModel):
    id: str
    status: str
    note: Optional[str]
    by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ForwardProfileRequest(BaseModel):
    forwarded_to_user_id: str
    note: Optional[str]


# ==========================
# Candidate Job Application
# ==========================
class CandidateApplyRequest(BaseModel):
    job_id: str
    candidate_id: str
    cover_letter: Optional[str] = None
    linkedin_url: Optional[str] = None
    portfolio_url: Optional[str] = None


class CandidateApplicationResponse(BaseModel):
    id: str
    job_id: str
    candidate_id: str
    status: str
    applied_at: datetime
    resume_url: Optional[str]
    parsed_resume: Optional[Any]
    ready_for_assignment: bool = False   # ⭐ ADD THIS
    # ⭐ NEW CLIENT WORKFLOW FIELDS
    client_feedback: Optional[str] = None
    client_decision: Optional[str] = None
    sent_to_client_at: Optional[datetime] = None
    decision_at: Optional[datetime] = None

    class Config:
        from_attributes = True





class DirectHireRequest(BaseModel):
    note: Optional[str] = None

    class Config:
        from_attributes = True
# ==========================
# INTERVIEW + AI
# ==========================
class InterviewScoreSchema(BaseModel):
    id: str
    dimension: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    top_factors: Optional[Any]

    class Config:
        from_attributes = True


class InterviewScoreResponse(BaseModel):
    id: str
    interview_id: Optional[str]
    dimension: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    top_factors: Optional[Any]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class InterviewAnswerRequest(BaseModel):
    answer: str

    class Config:
        from_attributes = True


# ==========================
# INTERVIEW ENUMS (FIXED)
# ==========================

# ONLY for AI interviews
class InterviewModeEnum(str, Enum):
    ai = "ai"
    ai_chat = "ai_chat"


# ONLY for LIVE interviews
class LiveInterviewTypeEnum(str, Enum):
    video = "video"
    phone = "phone"
    in_person = "in_person"



class InterviewCreate(BaseModel):
    submission_id: str   # 🔒 SINGLE SOURCE OF TRUTH

    mode: InterviewModeEnum = InterviewModeEnum.ai   # ✅ FIXED
    scheduled_at: Optional[datetime] = None

    meeting_link: Optional[str] = None
    notes: Optional[str] = None

    @validator("meeting_link")
    def validate_meeting_link(cls, v):
        if v and not v.startswith(("http://", "https://")):
            raise ValueError("Meeting link must be a valid URL")
        return v


class InterviewUpdate(BaseModel):
    mode: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None

class InterviewCandidateShort(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]

    class Config:
        from_attributes = True

class InterviewJobShort(BaseModel):
    id: str
    title: Optional[str]
    company_name: Optional[str]
    location: Optional[str]

    class Config:
        from_attributes = True



class InterviewSubmissionMini(BaseModel):
    candidate: Optional[InterviewCandidateShort]
    job: Optional[InterviewJobShort]
    recruiter: Optional["InterviewRecruiterShort"]

    class Config:
        from_attributes = True


class InterviewResponse(BaseModel):
    id: str
    mode: Optional[str]
    status: Optional[str]

    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]

    overall_ai_score: Optional[float]
    meeting_link: Optional[str] = None
    location: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None

    # ✅ THIS IS THE FIX
    submission: Optional[InterviewSubmissionMini]

    class Config:
        from_attributes = True


class InterviewQuestion(BaseModel):
    id: Optional[str]
    question_text: Optional[str]
    answer_text: Optional[str]
    score: Optional[float]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==========================
# INTERVIEW QUESTION (FIXED FOR AI FLOW)
# ==========================
class InterviewQuestionResponse(BaseModel):
    question_id: Optional[int] = None
    question_text: Optional[str] = None
    is_last_question: Optional[bool] = False

    class Config:
        from_attributes = True
        extra = "allow"

class InterviewCandidateMini(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]

    class Config:
        from_attributes = True


class InterviewJobMini(BaseModel):
    id: str
    title: Optional[str]

    class Config:
        from_attributes = True

class InterviewLogResponse(BaseModel):
    id: str
    status: str
    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]
    overall_ai_score: Optional[float]

    candidate: Optional[InterviewCandidateMini]
    job: Optional[InterviewJobMini]

    class Config:
        from_attributes = True


class InterviewFeedbackRequest(BaseModel):
    rating: int  # 1-5 scale
    experience_feedback: Optional[str] = None
    ease_of_use: Optional[int] = None  # 1-5 scale
    comments: Optional[str] = None


class InterviewFeedbackResponse(BaseModel):
    id: str
    interview_id: str
    candidate_id: str
    rating: int
    experience_feedback: Optional[str]
    ease_of_use: Optional[int]
    comments: Optional[str]
    submitted_at: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==========================
# AI ANSWER SCORE SUMMARY RESPONSE
# ==========================
class AIScoreSummary(BaseModel):
    partial_score: float
    feedback: Any
    is_last_question: bool


# ==========================
# FINAL INTERVIEW SUMMARY
# ==========================
class InterviewSummaryResponse(BaseModel):
    score: float
    recommendation: str
    strengths: List[str]
    weaknesses: List[str]
    transcript: List[Any]

    class Config:
        from_attributes = True


class AIVideoInterviewCreate(BaseModel):
    candidate_id: str
    job_id: str
    recording_enabled: bool = True


class AIVideoInterviewStartResponse(BaseModel):
    interview_id: str
    questions: List[str]


class AIVideoInterviewAnswer(BaseModel):
    question_index: int
    video_url: str
    duration: Optional[float] = None


class AIVideoInterviewCompleteResponse(BaseModel):
    interview_id: str
    overall_ai_score: float
    recommendation: str
    feedback: List[str]


class AIVideoInterviewLogResponse(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    overall_ai_score: Optional[float]
    status: str
    created_at: datetime


class InterviewListResponse(BaseModel):
    id: str
    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]
    status: Optional[str]
    mode: Optional[str]

    candidate: Optional[InterviewCandidateShort]
    job: Optional[InterviewJobShort]

    overall_ai_score: Optional[float]

    class Config:
        from_attributes = True
class InterviewDetailResponse(BaseModel):
    id: str
    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]
    status: Optional[str]
    mode: Optional[str]
    overall_ai_score: Optional[float]
    meeting_link: Optional[str]
    location: Optional[str]
    contact_person: Optional[str]
    notes: Optional[str]

    submission: Optional[InterviewSubmissionMini]

    class Config:
        from_attributes = True



class InterviewLogListResponse(BaseModel):
    id: str
    status: str
    scheduled_at: Optional[datetime]
    completed_at: Optional[datetime]
    overall_ai_score: Optional[float]

    candidate: Optional[InterviewCandidateMini]
    job: Optional[InterviewJobMini]

    class Config:
        from_attributes = True


# ==========================
# HUMAN REVIEW
# ==========================
class HumanReviewCreate(BaseModel):
    overall_score_override: Optional[float]
    notes: Optional[str]
    decision: Optional[str]  # hire / reject / hold

    class Config:
        from_attributes = True


class HumanReviewResponse(BaseModel):
    id: str
    interview_id: Optional[str]
    reviewer_id: Optional[str]
    overall_score_override: Optional[float]
    notes: Optional[str]
    decision: Optional[str]
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


## ==========================
# EMPLOYEE / HRMS (FIXED)
# ==========================

class EmployeeBase(BaseModel):
    id: Optional[str]
    employee_code: Optional[str]

    candidate_id: Optional[str]
    user_id: Optional[str]

    designation: Optional[str]
    department: Optional[str]
    status: Optional[str]

    location: Optional[str]
    join_date: Optional[datetime]
    exit_date: Optional[datetime]
    ctc: Optional[float]

    manager_id: Optional[str]

    class Config:
        from_attributes = True

class EmployeeCreate(BaseModel):
    candidate_id: str
    user_id: str

    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    @validator("phone")
    def validate_phone(cls, v):
        return normalize_phone(v)

    designation: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    join_date: Optional[datetime] = None
    status: Optional[str] = "onboarding"
    ctc: Optional[float] = None
    manager_id: Optional[str] = None

    class Config:
        from_attributes = True

class EmployeeUpdate(BaseModel):
    designation: Optional[str] = None
    department: Optional[str] = None
    join_date: Optional[datetime] = None
    ctc: Optional[float] = None
    location: Optional[str] = None
    status: Optional[str] = None
    manager_id: Optional[str] = None

    class Config:
        from_attributes = True

class EmployeeUserMini(BaseModel):
    full_name: Optional[str]
    email: Optional[str]

    class Config:
        from_attributes = True

class EmployeeCandidateMini(BaseModel):
    phone: Optional[str]

    class Config:
        from_attributes = True


class EmployeeResponse(EmployeeBase):
    # 🔥 ADD THESE (CRITICAL)
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    user: Optional[EmployeeUserMini]
    candidate: Optional[EmployeeCandidateMini]

    manager_name: Optional[str] = None

    class Config:
        from_attributes = True


class EmployeeLogResponse(BaseModel):
    id: str
    employee_id: str
    action: str
    old_value: dict | None = None
    new_value: dict | None = None
    created_at: datetime

    class Config:
        from_attributes = True




class AlumniResponse(BaseModel):
    id: str
    employee_id: Optional[str]
    exit_date: Optional[datetime]
    last_designation: Optional[str]
    tenure_years: Optional[float]
    current_company: Optional[str]
    current_designation: Optional[str]
    linkedin_url: Optional[str]
    is_eligible_for_rehire: Optional[bool]
    referrals_made: Optional[int]
    engagement_score: Optional[float]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==========================
# ONBOARDING / PERFORMANCE / EXIT
# ==========================
class OnboardingTaskSchema(BaseModel):
    id: str
    title: Optional[str]
    description: Optional[str]
    status: Optional[str]
    due_date: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class OnboardingTaskResponse(BaseModel):
    id: str
    employee_id: Optional[str]
    title: Optional[str]
    description: Optional[str]
    task_type: Optional[str]
    status: Optional[str]
    assigned_to: Optional[str]
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    documents_required: Optional[Any]
    documents_submitted: Optional[Any]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PerformanceReviewSchema(BaseModel):
    id: str
    overall_rating: Optional[float]
    strengths: Optional[str]
    areas_of_improvement: Optional[str]
    comments: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PerformanceReviewCreate(BaseModel):
    overall_rating: Optional[float]
    strengths: Optional[str]
    areas_of_improvement: Optional[str]
    comments: Optional[str]

    class Config:
        from_attributes = True


class PerformanceReviewResponse(BaseModel):
    id: str
    employee_id: Optional[str]
    reviewer_id: Optional[str]
    overall_rating: Optional[float]
    goals_achieved: Optional[Any] = None
    strengths: Optional[str]
    areas_of_improvement: Optional[str]
    comments: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ExitInterviewSchema(BaseModel):
    id: str
    exit_reason: Optional[str]
    feedback: Optional[str]
    would_rehire: Optional[bool]
    would_recommend: Optional[bool]
    conducted_at: Optional[datetime]

    class Config:
       from_attributes = True


class ExitInterviewCreate(BaseModel):
    exit_reason: Optional[str]
    feedback: Optional[str]
    would_rehire: Optional[bool] = None
    would_recommend: Optional[bool] = None
    conducted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==========================
# LEAVE / PAYROLL
# ==========================
class LeaveRequestSchema(BaseModel):
    id: str
    leave_type: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    days_count: Optional[float]
    status: Optional[str]

    class Config:
        from_attributes = True


class PayrollSlip(BaseModel):
    id: str
    employee_id: str
    net_salary: Optional[float]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

# ==========================
# COMMUNICATION
# ==========================
class EmailLogSchema(BaseModel):
    subject: str
    body: str
    sent_at: str
    sent_by: Optional[str]


# ==========================
# SYSTEM SETTINGS
# ==========================
class SystemSettingSchema(BaseModel):
    id: str
    module_name: str
    setting_key: str
    setting_value: Optional[Any]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==========================
# INVOICE
# ==========================
class InvoiceCreate(BaseModel):
    client_name: Optional[str]
    client_id: Optional[str]
    amount: Optional[float]
    due_date: Optional[datetime]
    placements: Optional[List[Any]] = []
    status: Optional[str] = "draft"

    class Config:
        from_attributes = True

class InvoiceResponse(BaseModel):
    id: str
    client_name: Optional[str]
    client_id: Optional[str]
    invoice_number: Optional[str]
    amount: Optional[float]
    status: Optional[str]
    placements: Optional[List[Any]]
    due_date: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

# ==========================
# AUTH REQUEST MODELS
# ==========================
class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None
    otp: Optional[str] = None


class SendOTPRequest(BaseModel):
    email: str


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

    @validator("new_password")
    def strong_password(cls, v):
        return validate_strong_password(v)


class VerifyRegistrationOTPRequest(BaseModel):
    user_id: str
    otp: str


class ResendRegistrationOTPRequest(BaseModel):
    user_id: str
    verification_method: Optional[str] = None


# ==========================
# MATCHING RESPONSE (AI)
# ==========================
class CandidateMatchScore(BaseModel):
    candidate_id: str
    full_name: str
    email: Optional[str]
    fit_score: float
    fit_explanation: Optional[Any]
    resume_url: Optional[str]

    class Config:
        from_attributes = True
class CandidateMatchResponse(BaseModel):
    job_id: str
    job_title: Optional[str]
    matched_candidates: List[CandidateMatchScore]

    class Config:
        from_attributes = True

# ==========================
# TOKEN RESPONSE
# ==========================
class Token(BaseModel):
    access_token: str
    token_type: str
    role: Optional[str] = None
    candidate: Optional[dict] = None

    class Config:
        from_attributes = True
class CandidateMatchRequest(BaseModel):
    job_id: str
    limit: int = 10

    class Config:
        json_schema_extra = {
            "example": {
                "job_id": "123e45g-abc-789",
                "limit": 5
            }
        }

# ==========================
# JOB → Applied Candidates List Response (NEW)
# ==========================
class JobCandidateShortInfo(BaseModel):
    candidate_id: str
    public_id: Optional[str]
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]

    class Config:
        from_attributes = True


class JobCandidateListResponse(BaseModel):
    job_id: str
    total_candidates: int
    candidates: List[JobCandidateShortInfo]

    class Config:
        from_attributes = True

# ==========================
# CHAT SCHEMAS
# ==========================
class ChatMessageCreate(BaseModel):
    sender_id: str
    receiver_id: str
    message: Optional[str] = None
    
    @classmethod
    def as_form(
        cls,
        sender_id: str = Form(...),
        receiver_id: str = Form(...),
        message: Optional[str] = Form(None)
    ):
        return cls(sender_id=sender_id, receiver_id=receiver_id, message=message)


class ChatMessageResponse(BaseModel):
    id: str
    sender_id: str
    receiver_id: str
    message: Optional[str]
    file_url: Optional[str]
    file_type: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================
# DOCUMENT MANAGEMENT SCHEMAS (Sprint 5)
# ==========================

class DocumentBase(BaseModel):
    category: str    # resume, offer_letter, id_proof, contract, etc.


class DocumentUploadResponse(BaseModel):
    id: str
    filename: str
    category: str
    uploaded_at: datetime

    class Config:
        from_attributes = True



class DocumentResponse(BaseModel):
    id: str
    employee_id: str
    category: str
    filename: str
    storage_path: str
    file_size: int
    mime_type: str
    uploaded_by: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True



class DocumentAuditResponse(BaseModel):
    id: str
    document_id: str
    user_id: str
    action: str   # upload / download / delete
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# ACTIVITY TRACKING SCHEMAS
# ============================================================

class ActivityCreate(BaseModel):
    """Schema for creating a new activity record."""
    entity_type: str  # 'job', 'candidate', 'application'
    entity_id: str
    activity_type: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "entity_type": "job",
                "entity_id": "123e4567-e89b-12d3-a456-426614174000",
                "activity_type": "Job Created",
                "description": "New software engineer position created",
                "metadata": {"department": "Engineering"}
            }
        }


class ActivityResponse(BaseModel):
    """Schema for activity response."""
    id: str
    entity_type: str
    entity_id: str
    activity_type: str
    description: Optional[str]
    actor_id: Optional[str]
    actor_role: Optional[str]
    activity_metadata: Optional[Dict[str, Any]]
    created_at: datetime
    
    # Computed fields
    relative_time: Optional[str] = None
    actor_name: Optional[str] = None

    class Config:
        from_attributes = True


class LastActivityInfo(BaseModel):
    """Schema for last activity information on entities."""
    last_activity_at: Optional[datetime]
    last_activity_type: Optional[str]
    relative_time: Optional[str]
    days_since_activity: Optional[int]

    class Config:
        from_attributes = True


class EntityActivitySummary(BaseModel):
    """Summary of recent activities for an entity."""
    entity_type: str
    entity_id: str
    total_activities: int
    last_activity: Optional[ActivityResponse]
    recent_activities: List[ActivityResponse]

    class Config:
        from_attributes = True


class StaleEntityResponse(BaseModel):
    """Response for entities with stale/no recent activity."""
    entity_type: str
    id: str
    last_activity_at: Optional[datetime]
    last_activity_type: Optional[str]
    days_since_activity: Optional[int]
    
    # Entity-specific details (populated based on entity_type)
    title: Optional[str] = None  # for jobs
    name: Optional[str] = None   # for candidates
    status: Optional[str] = None

    class Config:
        from_attributes = True



# schemas.py me add karo

# schemas.py
class CandidateMergeRequest(BaseModel):
    candidate_ids: List[str]

# ==========================
# CONSULTANT DEPLOYMENT LIST (CONSULTANT VIEW)
# ==========================

class ConsultantDeploymentListItem(BaseModel):
    id: str
    consultant_name: str
    client_name: str
    role: Optional[str]
    start_date: datetime
    end_date: Optional[datetime]
    status: str

    class Config:
        from_attributes = True



# ==========================
# CONSULTANT SCHEMAS
# ==========================
class ConsultantSelfUpdate(BaseModel):
    phone: Optional[str] = None
    @validator("phone")
    def validate_phone(cls, v):
        return normalize_phone(v)

    current_location: Optional[str] = None
    education: Optional[str] = None
    experience_years: Optional[float] = None
    skills: Optional[List[str]] = None

class ConsultantProfileResponse(BaseModel):
    # Consultant info
    id: str
    consultant_code: str
    type: str
    status: str
    payroll_ready: bool
    created_at: datetime

    # Candidate linked info (🔥 IMPORTANT)
    candidate_id: str
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]

    skills: Optional[List[str]] = []
    experience_years: Optional[float]
    education: Optional[str]
    current_location: Optional[str]

    class Config:
        from_attributes = True



class ConsultantTypeEnum(str, Enum):
    unclassified = "unclassified"
    payroll = "payroll"
    sourcing = "sourcing"


class ConsultantCreate(BaseModel):
    candidateId: str
    type: ConsultantTypeEnum


class ConsultantClassify(BaseModel):
    type: ConsultantTypeEnum


class ConsultantSourcingConfig(BaseModel):
    feeType: str = Field(..., example="ONE_TIME")
    feeAmount: float

# ⭐ ADD THIS
class ConvertCandidateToConsultantRequest(BaseModel):
    client_id: str   # 👈 client MUST be selected


class ConsultantPayrollSetup(BaseModel):
    billingRate: float
    payoutRate: float
    vendorId: Optional[str] = None


class ConsultantResponse(BaseModel):
    id: str
    candidate_id: str

    # 🔥 REQUIRED FOR UI
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

    type: str
    status: str
    payroll_ready: bool
    created_at: datetime

    class Config:
        from_attributes = True



class ConsultantDeploymentCreate(BaseModel):
    # ✅ ONE of them is required
    consultantId: Optional[str] = None
    applicationId: Optional[str] = None

    clientId: str
    clientName: str
    role: Optional[str] = None

    startDate: datetime
    endDate: Optional[datetime] = None

    billingType: str
    billingRate: float
    payoutRate: Optional[float] = None


class ConsultantDeploymentResponse(BaseModel):
    id: str
    consultant_id: str
    client_name: str
    role: Optional[str]
    start_date: datetime
    end_date: Optional[datetime]
    billing_type: str
    billing_rate: float
    payout_rate: Optional[float]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ChangePasswordRequest(BaseModel):
    password: str
    confirm_password: str


# ======================================================
# CONSULTANT DEPLOYMENT ELIGIBILITY
# ======================================================

class ConsultantEligibilityResponse(BaseModel):
    consultantId: str
    eligible: bool
    reasons: List[str] = []

    class Config:
        from_attributes = True



class LiveInterviewCreate(BaseModel):
    submission_id: str   # 🔒 REQUIRED

    type: LiveInterviewTypeEnum
    scheduled_at: datetime

    meeting_link: Optional[str] = None
    recording_enabled: bool = True

    @validator("meeting_link")
    def validate_meeting_link(cls, v, values):
        if values.get("type") == LiveInterviewTypeEnum.video and not v:
            raise ValueError("Meeting link is required for video interview")
        return v


class LiveInterviewJoinResponse(BaseModel):
    interview_id: str
    meeting_link: Optional[str] = None
    recording_enabled: bool


class LiveInterviewRecordingUpdate(BaseModel):
    recording_url: Optional[str] = None


class LiveInterviewEndResponse(BaseModel):
    interview_id: str
    status: str
    started_at: Optional[datetime]
    ended_at: Optional[datetime]


class LiveInterviewLogResponse(BaseModel):
    id: str
    submission_id: str
    status: str
    meeting_link: Optional[str]
    recording_enabled: bool
    recording_url: Optional[str]
    created_at: datetime



class AIInterviewResultCreate(BaseModel):
    interview_id: str
    mode: str  # chat | video
    score: float
    transcript: list


class LiveInterviewFeedbackCreate(BaseModel):
    interview_id: str
    rating: int
    comments: str | None = None


class InterviewRecordingCreate(BaseModel):
    interview_id: str
    file_url: str
    recorded_by: str


class NotificationCreate(BaseModel):
    candidate_id: str
    title: str
    message: Optional[str] = None
    type: Optional[str] = "info"

class NotificationResponse(BaseModel):
    id: str
    candidate_id: str
    title: str
    message: Optional[str]
    type: Optional[str]
    read: bool
    created_at: datetime

    class Config:
       from_attributes = True




class AssignRecruiterRequest(BaseModel):
    job_id: str
    recruiter_id: str


class RecruiterAssignedJobResponse(BaseModel):
    job_id: str
    title: Optional[str]
    location: Optional[str]
    status: Optional[str]
    created_at: Optional[datetime]

    class Config:
       from_attributes = True


class RecruiterSubmissionResponse(BaseModel):
    application_id: str
    candidate_name: Optional[str]
    email: Optional[str]
    status: Optional[str]
    fit_score: Optional[float]
    submitted_at: Optional[datetime]

    class Config:
        from_attributes = True


class ClientRequirementCreate(BaseModel):
    title: str
    description: Optional[str] = None
    skills_mandatory: List[str] = []
    skills_good_to_have: List[str] = []
    experience_min: float = 0.0
    experience_max: Optional[float] = None
    ctc_min: Optional[float] = None
    ctc_max: Optional[float] = None
    location_details: Optional[Dict[str, Any]] = None
    certifications: List[str] = []
    positions_count: int = 1
    interview_stages: List[str] = ["Screening", "Technical", "HR"]
    urgency: Optional[str] = None
    target_start_date: Optional[date] = None
    department: Optional[str] = None
    reporting_manager: Optional[str] = None
    priority: str = "Medium"


class ClientRequirementResponse(BaseModel):
    id: str
    client_id: str
    title: str
    description: Optional[str]
    skills_mandatory: List[str]
    skills_good_to_have: List[str]
    experience_min: float
    experience_max: Optional[float]
    ctc_min: Optional[float]
    ctc_max: Optional[float]
    location_details: Optional[Dict[str, Any]]
    certifications: List[str]
    positions_count: int
    interview_stages: List[str]
    urgency: Optional[str]
    target_start_date: Optional[date]
    department: Optional[str]
    reporting_manager: Optional[str]
    priority: str
    status: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True



# ==========================
# SEND TO CLIENT REQUEST
# ==========================
class SendToClientRequest(BaseModel):
    job_id: str
    application_ids: List[str]
class FinalDecisionRequest(BaseModel):
    application_id: str
    decision: str


class VendorBase(BaseModel):
    id: Optional[str]
    company_name: Optional[str]
    gst_number: Optional[str]
    payment_terms: Optional[str]
    primary_contact_name: Optional[str]
    primary_contact_email: Optional[str]
    primary_contact_phone: Optional[str]
    is_active: Optional[bool]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class VendorUpdate(BaseModel):
    primary_contact_name: Optional[str]
    primary_contact_email: Optional[str]
    primary_contact_phone: Optional[str]
    @validator("primary_contact_phone")
    def validate_phone(cls, v):
        return normalize_phone(v)

    class Config:
        from_attributes = True


class VendorDocumentResponse(BaseModel):
    id: str
    vendor_id: str
    document_type: str
    file_path: str
    status: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True


class VendorDashboardResponse(BaseModel):
    total_candidates: int
    active_deployments: int
    pending_timesheets: int
    expected_payout: float


class VendorCandidateResponse(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    experience_years: Optional[float]
    skills: Optional[List[str]]
    status: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class LiveInterviewCandidate(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]

    class Config:
        from_attributes = True


class LiveInterviewJob(BaseModel):
    id: str
    title: Optional[str]

    class Config:
        from_attributes = True

class LiveInterviewSubmissionMini(BaseModel):
    candidate: Optional[InterviewCandidateShort]
    job: Optional[InterviewJobShort]

    class Config:
        from_attributes = True
class LiveInterviewBase(BaseModel):
    id: str
    status: Optional[str] = None

    scheduled_at: Optional[datetime] = None
    meeting_link: Optional[str] = None

    recording_enabled: Optional[bool] = None
    recording_url: Optional[str] = None
    created_at: Optional[datetime] = None

    # ✅ FIX HERE
    submission: Optional[LiveInterviewSubmissionMini] = None

    class Config:
        from_attributes = True


class LiveInterviewListResponse(LiveInterviewBase):
    pass


class ClientCreate(BaseModel):
    full_name: str
    email: EmailStr
    company_name: Optional[str] = None


class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None

class ClientResponse(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]
    company_name: Optional[str]
    is_active: Optional[bool]

    class Config:
       from_attributes = True


class ClientContactCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    @validator("phone")
    def validate_phone(cls, v):
        return normalize_phone(v)
class ClientContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    @validator("phone")
    def validate_phone(cls, v):
        return normalize_phone(v)
    
class ClientContactResponse(BaseModel):
    id: str
    client_id: str
    name: Optional[str]
    email: Optional[str]
    phone: Optional[str]

    class Config:
        from_attributes = True

class ClientRequirementUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    skills_mandatory: Optional[List[str]] = None
    skills_good_to_have: Optional[List[str]] = None
    experience_min: Optional[float] = None
    experience_max: Optional[float] = None
    ctc_min: Optional[float] = None
    ctc_max: Optional[float] = None
    location_details: Optional[Dict[str, Any]] = None
    certifications: Optional[List[str]] = None
    positions_count: Optional[int] = None
    interview_stages: Optional[List[str]] = None
    urgency: Optional[str] = None
    target_start_date: Optional[date] = None
    department: Optional[str] = None
    reporting_manager: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

class RequirementStatusUpdate(BaseModel):
    status: str   # OPEN | CLOSED | ON_HOLD etc.

class AssignAccountManagerRequest(BaseModel):
    account_manager_id: str

class EmployeeResetPasswordRequest(BaseModel):
    password: str
    confirm_password: str

    @validator("password")
    def strong_password(cls, v):
        return validate_strong_password(v)

    @validator("confirm_password")
    def passwords_match(cls, v, values):
        if "password" in values and v != values["password"]:
            raise ValueError("Passwords do not match")
        return v

# ==========================
# CONSULTANT DASHBOARD
# ==========================

# ==========================
# TIMESHEET MANAGEMENT
# ==========================

class TimesheetStatusEnum(str, Enum):
    draft = "draft"
    submitted = "submitted"
    am_approved = "am_approved"
    client_approved = "client_approved"
    rejected = "rejected"
    locked = "locked"


# --------------------------
# TIMESHEET ENTRY
# --------------------------

class TimesheetEntryCreate(BaseModel):
    work_date: date
    hours: float = Field(..., gt=0, le=24)
    description: Optional[str] = None


class TimesheetEntryResponse(BaseModel):
    id: str
    work_date: date
    hours: float
    description: Optional[str]
    created_at: datetime

    class Config:
       from_attributes = True


# --------------------------
# TIMESHEET CREATE / UPDATE
# --------------------------

class TimesheetPeriodEnum(str, Enum):
    weekly = "weekly"
    monthly = "monthly"


class TimesheetCreate(BaseModel):
    period_type: TimesheetPeriodEnum
    period_start: date
    period_end: date
    entries: List[TimesheetEntryCreate]


class TimesheetUpdate(BaseModel):
    entries: List[TimesheetEntryCreate]


# --------------------------
# TIMESHEET ACTIONS
# --------------------------

class TimesheetSubmitRequest(BaseModel):
    pass   # no body required


class TimesheetApproveRequest(BaseModel):
    pass   # AM / Client approval


class TimesheetRejectRequest(BaseModel):
    reason: str


# --------------------------
# TIMESHEET RESPONSE
# --------------------------

class TimesheetResponse(BaseModel):
    id: str
    deployment_id: str
    consultant_id: str
    client_id: str

    period_type: TimesheetPeriodEnum
    period_start: date
    period_end: date

    total_hours: float
    status: TimesheetStatusEnum

    submitted_at: Optional[datetime]
    am_approved_at: Optional[datetime]
    client_approved_at: Optional[datetime]
    locked_at: Optional[datetime]

    rejection_reason: Optional[str]

    entries: List[TimesheetEntryResponse] = []

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --------------------------
# LIST RESPONSES
# --------------------------

class ConsultantTimesheetListResponse(BaseModel):
    total: int
    timesheets: List[TimesheetResponse]


class AMTimesheetListResponse(BaseModel):
    total: int
    timesheets: List[TimesheetResponse]


class ClientTimesheetListResponse(BaseModel):
    total: int
    timesheets: List[TimesheetResponse]


class ConsultantActiveDeployment(BaseModel):
    id: str
    client_name: str
    role: Optional[str]
    start_date: datetime
    end_date: Optional[datetime]
    billing_rate: float
    payout_rate: Optional[float]

    class Config:
        from_attributes = True


class ConsultantDashboardResponse(BaseModel):
    consultant_id: str
    status: str
    type: str
    payroll_ready: bool

    active_deployment: Optional[ConsultantActiveDeployment]
    total_deployments: int

    server_time: datetime

class SkillResponse(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


# ============================================================
# 🤖 AI RECRUITER PROMPTS SCHEMAS (12 Workflows)
# ============================================================

# -------- 1️⃣ JOB REQUIREMENT UNDERSTANDING --------
class JobRequirementAnalysisRequest(BaseModel):
    """Convert raw requirement into structured JD"""
    requirement_text: constr(min_length=50, max_length=5000) = Field(
        ..., description="Raw job requirement/description"
    )
    
    class Config:
        from_attributes = True


class JobRequirementAnalysisResponse(BaseModel):
    """Structured JD from requirement analysis"""
    job_title: str
    must_have_skills: List[str]
    good_to_have_skills: List[str]
    experience_range: str
    location: str
    work_mode: str
    budget_ctc_range: str
    key_responsibilities: List[str]
    screening_keywords: List[str]


# -------- 2️⃣ CANDIDATE SOURCING --------
class CandidateSourcingRequest(BaseModel):
    """Find matching candidates from ATS pool"""
    job_details: dict = Field(..., description="Job requirement details")
    filters: Optional[dict] = Field(default=None, description="Location, experience filters")
    limit: int = Field(default=10, ge=1, le=100)
    
    class Config:
        from_attributes = True


class CandidateSourcingResponse(BaseModel):
    """Ranked candidates matching job"""
    candidates: List[dict]
    ranking_criteria: str


# -------- 3️⃣ RESUME SCREENING & SCORING --------
class ResumeScreeningRequest(BaseModel):
    """Shortlist or reject resumes"""
    job_description: constr(min_length=20, max_length=3000)
    resume_text: constr(min_length=50, max_length=10000)
    candidate_id: Optional[str] = None
    
    class Config:
        from_attributes = True


class ResumeScreeningResponse(BaseModel):
    """Resume evaluation with recommendation"""
    match_score: int = Field(ge=0, le=100)
    strengths: List[str]
    gaps: List[str]
    recommendation: str  # Shortlist / Hold / Reject


# -------- 4️⃣ RECRUITER SCREENING NOTES GENERATOR --------
class RecruiterScreeningNotesRequest(BaseModel):
    """Auto-generate recruiter notes"""
    conversation_summary: constr(min_length=50, max_length=5000)
    candidate_name: constr(min_length=2, max_length=100)
    job_title: constr(min_length=2, max_length=100)
    
    class Config:
        from_attributes = True


class RecruiterScreeningNotesResponse(BaseModel):
    """Professional recruiter screening notes"""
    skill_validation: str
    communication_assessment: str
    salary_expectation: str
    notice_period: str
    overall_recommendation: str


# -------- 5️⃣ CANDIDATE INTEREST CONFIRMATION --------
class CandidateInterestChecklistRequest(BaseModel):
    """Recruiter checklist to confirm candidate interest"""
    candidate_id: str
    candidate_name: constr(min_length=2, max_length=100)
    job_title: constr(min_length=2, max_length=100)
    job_description: constr(min_length=20, max_length=2000)
    
    class Config:
        from_attributes = True


class CandidateInterestChecklistResponse(BaseModel):
    """Interest confirmation checklist"""
    role_understanding_questions: List[str]
    salary_alignment_check: str
    availability_status: str
    relocation_willingness: str
    overall_readiness: str


# -------- 6️⃣ CLIENT SUBMISSION SUMMARY --------
class ClientSubmissionRequest(BaseModel):
    """Create client-ready candidate summary"""
    candidate_id: str
    job_id: str
    include_salary: bool = True
    include_notice_period: bool = True
    
    class Config:
        from_attributes = True


class ClientSubmissionResponse(BaseModel):
    """Client submission profile"""
    total_experience: str
    relevant_skills: List[str]
    key_projects: List[str]
    strengths: List[str]
    current_ctc: Optional[str]
    expected_ctc: Optional[str]
    notice_period: str
    recruiter_remarks: str


# -------- 7️⃣ INTERVIEW QUESTION GENERATOR --------
class InterviewQuestionGeneratorRequest(BaseModel):
    """Generate role-based interview questions"""
    job_title: constr(min_length=2, max_length=100)
    required_skills: List[str] = Field(min_items=1, max_items=20)
    experience_level: str  # junior / mid / senior
    interview_type: str = "technical"  # technical / behavioral / mixed
    
    class Config:
        from_attributes = True


class InterviewQuestionGeneratorResponse(BaseModel):
    """Role-based interview questions"""
    basic_questions: List[str]
    intermediate_questions: List[str]
    advanced_questions: List[str]
    scenario_based_questions: List[str]


# -------- 8️⃣ INTERVIEW FEEDBACK ANALYSIS --------
class InterviewFeedbackAnalysisRequest(BaseModel):
    """Analyze interview outcome"""
    interview_feedback: constr(min_length=50, max_length=5000)
    candidate_name: constr(min_length=2, max_length=100)
    job_title: constr(min_length=2, max_length=100)
    
    class Config:
        from_attributes = True


class InterviewFeedbackAnalysisResponse(BaseModel):
    """Interview analysis with recommendation"""
    skill_assessment: str
    strengths: List[str]
    weaknesses: List[str]
    hiring_recommendation: str  # Hire / Hold / Reject
    risk_factors: List[str]


# -------- 9️⃣ OFFER FIT & SALARY ALIGNMENT --------
class OfferFitAnalysisRequest(BaseModel):
    """Check offer acceptance probability"""
    candidate_expectations: dict = Field(
        ..., description="salary, work_mode, notice_period etc"
    )
    offer_details: dict = Field(
        ..., description="salary, work_mode, location, benefits etc"
    )
    candidate_id: Optional[str] = None
    
    class Config:
        from_attributes = True


class OfferFitAnalysisResponse(BaseModel):
    """Offer acceptance probability"""
    alignment_score: int = Field(ge=0, le=100)
    salary_alignment: str
    work_mode_fit: str
    location_fit: str
    acceptance_probability: str  # Low / Medium / High


# -------- 🔟 DROPOUT RISK PREDICTION --------
class DropoutRiskAnalysisRequest(BaseModel):
    """Reduce candidate drop-offs"""
    candidate_timeline: List[dict] = Field(
        ..., description="List of interactions: {date, action, status}"
    )
    candidate_name: constr(min_length=2, max_length=100)
    current_stage: str  # sourced / screening / interview / offer / etc
    
    class Config:
        from_attributes = True


class DropoutRiskAnalysisResponse(BaseModel):
    """Dropout risk assessment"""
    dropout_risk_level: str  # Low / Medium / High
    possible_reasons: List[str]
    preventive_actions: List[str]
    follow_up_strategy: str


# -------- 1️⃣1️⃣ DAILY RECRUITER REPORT --------
class DailyRecruiterReportRequest(BaseModel):
    """Auto recruiter reporting"""
    recruiter_id: str
    report_date: Optional[str] = None  # defaults to today
    include_metrics: bool = True
    
    class Config:
        from_attributes = True


class DailyRecruiterReportResponse(BaseModel):
    """Daily recruiter activity report"""
    open_requirements: int
    candidates_sourced_today: int
    profiles_submitted_today: int
    interviews_scheduled: int
    offer_letters_sent: int
    closures_today: int
    pipeline_summary: str


# -------- 1️⃣2️⃣ RECRUITER PERFORMANCE INSIGHTS --------
class RecruiterPerformanceRequest(BaseModel):
    """Productivity & KPI insights"""
    recruiter_id: str
    period: str = "month"  # week / month / quarter / year
    
    class Config:
        from_attributes = True


class RecruiterPerformanceResponse(BaseModel):
    """Performance metrics & insights"""
    time_to_fill_days: float
    submission_to_interview_ratio: float
    interview_to_offer_ratio: float
    offer_to_closure_ratio: float
    average_candidate_quality_score: float
    improvement_suggestions: List[str]


# ==========================
# JOB SUBMISSION (Recruiter → AM)
# ==========================
# ==========================
# JOB SUBMISSION (Recruiter → AM)
# ==========================
class JobSubmissionCreate(BaseModel):
    candidate_id: str
    job_id: str
    note: Optional[str] = None

class InterviewRecruiterShort(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]

    class Config:
        from_attributes = True

InterviewSubmissionMini.model_rebuild()


# ==========================
# SUPER ADMIN - BUSINESS & OPS
# ==========================
class SuperAdminDashboardResponse(BaseModel):
    active_clients: int
    active_jobs: int
    recruiter_productivity: float
    revenue_mtd: float
    sla_breaches: int
    system_warnings: int


class SuperAdminClientSummary(BaseModel):
    id: str
    name: Optional[str]
    email: str
    status: str
    account_manager_id: Optional[str]
    active_jobs: int
    subscription_plan: Optional[str]
    usage_percent: Optional[float]


class SuperAdminAdminSummary(BaseModel):
    id: str
    full_name: Optional[str]
    email: str
    role: str
    scope: str
    last_login: Optional[str]
    status: str


class SuperAdminStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = None


class SystemSettingUpsert(BaseModel):
    module_name: str
    setting_key: str
    setting_value: dict
    description: Optional[str] = None


class FeatureFlagUpsert(BaseModel):
    key: str
    enabled: bool
    description: Optional[str] = None

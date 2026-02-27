import enum
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    JSON,
    DateTime,
    Date,
    Text,
    Boolean,
    ForeignKey,
    Table,
    Enum,
    event,
    Index,
)
from sqlalchemy.orm import relationship
# from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, date
import uuid
from app.db import Base
from app.utils.user_agent import parse_user_agent
from sqlalchemy import UniqueConstraint   # 👈 add at top if not present

def validate_candidate_job_match(candidate, job):
    candidate_skills = set(candidate.skills or [])
    job_skills = set(job.skills or [])

    if not job_skills:
        raise Exception("Job skills not defined")

    matched = candidate_skills & job_skills
    match_score = len(matched) / len(job_skills)

    if match_score < 0.6:
        raise Exception("Skill mismatch")

    if candidate.experience_years is None:
        raise Exception("Candidate experience missing")

    if not (job.min_experience <= candidate.experience_years <= job.max_experience):
        raise Exception("Experience mismatch")

    return round(match_score * 100, 2)


def normalize_skill(value: str) -> str:
    if not value:
        return ""

    words = value.strip().split()
    out = []

    for w in words:
        # acronyms: AI, ML, AWS, SQL
        if len(w) <= 3 and w.isupper():
            out.append(w)
        # special tech: C++, .NET, UI/UX
        elif any(c in w for c in "+./&-"):
            out.append(w.upper())
        else:
            out.append(w.capitalize())

    return " ".join(out)

def generate_uuid() -> str:
    return str(uuid.uuid4())


def generate_candidate_public_id_from_org(db):
    """
    Generates candidate public ID like:
    ATS-C-0001
    ATS-C-0002
    """

    # 1️⃣ Get org code from system_settings
    setting = (
        db.query(SystemSettings)
        .filter(
            SystemSettings.module_name == "organization",
            SystemSettings.setting_key == "organization_code",
        )
        .first()
    )

    org_code = "ATS"
    if setting and isinstance(setting.setting_value, dict):
        org_code = setting.setting_value.get("code", "ATS")

    org_code = (org_code or "ATS").strip().upper() or "ATS"

    # 2️⃣ Find max numeric suffix across existing IDs (robust even if older
    # candidates are backfilled with new public_ids).
    prefix = f"{org_code}-C-"
    existing_ids = (
        db.query(Candidate.public_id)
        .filter(Candidate.public_id.like(f"{prefix}%"))
        .all()
    )

    max_num = 0
    for (pid,) in existing_ids:
        if not pid:
            continue
        try:
            num = int(str(pid).split("-")[-1])
            if num > max_num:
                max_num = num
        except Exception:
            continue

    next_number = max_num + 1
    return f"{org_code}-C-{str(next_number).zfill(4)}"


def generate_requirement_code(db):
    org_code = "ATS"

    last_req = (
        db.query(Requirement.requirement_code)
        .filter(Requirement.requirement_code.like(f"{org_code}-R-%"))
        .order_by(Requirement.created_at.desc())
        .first()
    )

    if last_req and last_req[0]:
        num = int(last_req[0].split("-")[-1])
        next_num = num + 1
    else:
        next_num = 1

    return f"{org_code}-R-{str(next_num).zfill(4)}"


# ============================================================
# ROLES & PERMISSIONS – RBAC
# ============================================================
class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(String, primary_key=True, default=generate_uuid)
    role_name = Column(String, nullable=False)
    module_name = Column(String, nullable=False)
    action_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================
# USER (HR / Admin Login)
# ============================================================
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)

    otp_code = Column(String, nullable=True)
    otp_expiry = Column(DateTime, nullable=True)

    role = Column(String, default="employee")
    must_change_password = Column(Boolean, default=False)   # 🔥 ADD
    linked_candidate_id = Column(
        String,
        ForeignKey("candidates.id"),
        nullable=True
    )
    full_name = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active", index=True)
    role_id = Column(Integer, nullable=True, index=True)
    tenant_id = Column(String, nullable=True, index=True)
    last_login_at = Column(DateTime, nullable=True)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    session_invalid_after = Column(DateTime, nullable=True)

    # ⭐⭐ IMPORTANT — CLIENT COMPANY NAME ⭐⭐
    company_name = Column(String, nullable=True)

    is_active = Column(Boolean, default=True)
    failed_login_attempts = Column(Integer, default=0)
    last_failed_login_at = Column(DateTime, nullable=True)
    account_locked_until = Column(DateTime, nullable=True)
    
    # ⭐ Reference to Client Company Profile
    client_id = Column(String, ForeignKey("clients.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    employees = relationship("Employee", back_populates="user")
    notes = relationship("CandidateNote", back_populates="author")
    login_logs = relationship("LoginLog", back_populates="user")

    assigned_jobs = relationship("Job", secondary="job_recruiters", overlaps="recruiters")
    # ⭐ ADD THIS FOR CLIENT → ACCOUNT MANAGER MAPPING
    account_manager_id = Column(
    String,
    ForeignKey("users.id"),
    nullable=True
)


class LoginLog(Base):
    __tablename__ = "login_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    username = Column(String)
    email = Column(String)
    status = Column(String)
    ip_address = Column(String)
    user_agent = Column(String)
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="login_logs")


# ============================================================
# JOB MODEL – used by Public Careers + ATS
# ============================================================
job_recruiters = Table(
    "job_recruiters",
    Base.metadata,
    Column("job_id", String, ForeignKey("jobs.id"), primary_key=True),
    Column("recruiter_id", String, ForeignKey("users.id"), primary_key=True),
    Column("assigned_at", DateTime, default=datetime.utcnow)
)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=generate_uuid)

    # 🔥 Unique Job Code like ORG-J-0001
    job_id = Column(String, unique=True, index=True)

    title = Column(String, nullable=False)
    company_name = Column(String, nullable=True)

    description = Column(Text)
    skills = Column(JSON, default=list)
    min_experience = Column(Integer, default=0)
    max_experience = Column(Integer)
    location = Column(String)
    department = Column(String)
    # ⭐ Job meta (used by frontend)
    job_type = Column(String, nullable=True)          # Full-time / Contract
    salary_range = Column(String, nullable=True)      # 10–15 LPA
    apply_by = Column(Date, nullable=True)             # last date to apply
    sla_days = Column(Integer, nullable=True)          # SLA tracking


    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime)
    status = Column(String, default="active", nullable=False)

    is_active = Column(Boolean, default=True)

    embedding_vector = Column(JSON, nullable=True)

    # ⭐ REQUIRED for JD Upload feature
    jd_url = Column(String)

    # ⭐ REQUIRED for Assign Recruiters feature
    recruiters = relationship("User", secondary="job_recruiters", overlaps="assigned_jobs")

    # Existing relationships
    applications = relationship("JobApplication", back_populates="job")
    campaigns = relationship("Campaign", back_populates="job")
    client_id = Column(String, ForeignKey("clients.id"), nullable=True)
    client_name = Column(String, nullable=True)  # Store client name directly for flexibility
    # ⭐ ADD THIS — Account Manager mapping
    account_manager_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=True
    )

    account_manager = relationship(
        "User",
        foreign_keys=[account_manager_id]
    )
    requirement = relationship("Requirement", back_populates="job", uselist=False)

    # ============================================================
    # ACTIVITY TRACKING FIELDS
    # ============================================================
    last_activity_at = Column(DateTime, nullable=True, index=True)
    last_activity_type = Column(String(100), nullable=True)

    # ============================================================
    # JOB CREATION MODULE FIELDS
    # ============================================================
    serial_number = Column(Integer, unique=True, nullable=True)  # S# Auto-generated
    date_created = Column(Date, nullable=True)  # Date requirement was created
    client_ta = Column(String, nullable=True)  # Client TA/HR contact name
    mode = Column(String, nullable=True)  # hybrid, remote, onsite, contract
    jd_text = Column(Text, nullable=True)  # Full JD text (rich text or plain)
    duration = Column(String, nullable=True)  # e.g., "6 months", "Full-time permanent"
    no_of_positions = Column(Integer, nullable=True)  # Number of open positions
    budget = Column(String, nullable=True)  # e.g., "₹15–20 LPA", "AUD $90–110k"
    work_timings = Column(String, nullable=True)  # e.g., "5:30 AM – 2:30 PM"
    joining_preference = Column(String, nullable=True)  # e.g., "Immediate joiners only"
    notes_for_recruiter = Column(Text, nullable=True)  # AM's private instructions
    
    # Relationships for job management
    job_assignments = relationship("JobAssignment", back_populates="job", cascade="all, delete-orphan")
    job_postings = relationship("JobPosting", back_populates="job", cascade="all, delete-orphan")

class Client(Base):
    """
    Workflow A: Client Profile & Ownership
    Tracks full contract details (MSA, SOW, PO) and billing terms.
    """
    __tablename__ = "clients"

    id = Column(String, primary_key=True, default=generate_uuid)
    client_code = Column(String, unique=True, index=True)
    client_name = Column(String, nullable=False)
    legal_entity = Column(String)
    
    status = Column(String, default="draft")  # draft, active, inactive
    
    # Contract URLs (File Paths)
    msa_url = Column(String)
    sow_url = Column(String)
    po_url = Column(String)
    
    # Billing & Logistics
    billing_address = Column(Text)
    gst_details = Column(String)
    payment_terms = Column(Integer)  # Days (e.g., 30, 45, 60)
    
    # Ownership
    am_id = Column(String, ForeignKey("users.id"))  # Assigned Account Manager
    created_by = Column(String, ForeignKey("users.id"))
    
    activated_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relationships
    account_manager = relationship("User", foreign_keys=[am_id])


class CandidateClassification(str, enum.Enum):
    unclassified = "unclassified"
    payroll = "payroll"
    sourcing = "sourcing"


class CandidateStatus(str, enum.Enum):
    """
    Complete Candidate Recruitment Workflow Statuses
    Tracks candidate from first view → recruiter actions → AM review → client decision → interview → final outcome
    """
    # ==========================================
    # STAGE 1: INITIAL / NEW CANDIDATE
    # ==========================================
    new = "new"                         # Candidate profile opened first time
    applied = "applied"                 # Applied through portal
    sourced = "sourced"                 # Sourced by recruiter/vendor
    
    # ==========================================
    # STAGE 2: RECRUITER ACTIONS
    # ==========================================
    called = "called"                   # Recruiter called the candidate
    feedback_added = "feedback_added"   # Recruiter added call feedback
    hold_revisit = "hold_revisit"       # Put on hold for later
    rejected_by_recruiter = "rejected_by_recruiter"  # FINAL - Rejected by recruiter
    
    # ==========================================
    # STAGE 3: SENT TO ACCOUNT MANAGER
    # ==========================================
    sent_to_am = "sent_to_am"           # Recruiter sent to AM
    am_viewed = "am_viewed"             # AM opened the profile
    am_shortlisted = "am_shortlisted"   # AM shortlisted
    am_rejected = "am_rejected"         # FINAL - AM rejected
    
    # ==========================================
    # STAGE 4: CLIENT DECISION
    # ==========================================
    sent_to_client = "sent_to_client"   # AM sent to client
    client_viewed = "client_viewed"     # Client viewed profile
    client_shortlisted = "client_shortlisted"  # Client shortlisted
    client_hold = "client_hold"         # Client put on hold
    client_rejected = "client_rejected" # FINAL - Client rejected
    
    # ==========================================
    # STAGE 5: INTERVIEW STAGE
    # ==========================================
    interview_scheduled = "interview_scheduled"   # Interview scheduled
    interview_completed = "interview_completed"   # Interview done
    interview = "interview"             # Legacy - in interview process
    
    # ==========================================
    # STAGE 6: FINAL OUTCOME
    # ==========================================
    selected = "selected"               # Selected after interview
    negotiation = "negotiation"         # Salary negotiation
    offer_extended = "offer_extended"   # Offer sent
    offer_accepted = "offer_accepted"   # Offer accepted
    hired = "hired"                     # FINAL - Hired
    offer_declined = "offer_declined"   # FINAL - Candidate declined offer
    rejected = "rejected"               # FINAL - Generic rejection
    
    # ==========================================
    # OTHER STAGES
    # ==========================================
    joined = "joined"                   # FINAL - Joined company
    screening = "screening"             # In screening
    screened = "screened"               # Screened
    submitted = "submitted"             # Submitted to client (legacy)
    offer = "offer"                     # Offer stage (legacy)
    active = "active"                   # Active in pool
    shortlisted = "shortlisted"         # Shortlisted (legacy)
    verified = "verified"               # Verified
    converted = "converted"             # Converted


# Define FINAL (locked) statuses - no further changes allowed
FINAL_STATUSES = {
    "rejected_by_recruiter",
    "am_rejected", 
    "client_rejected",
    "hired",
    "offer_declined",
    "rejected",
    "joined"
}


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String, primary_key=True, default=generate_uuid)
    public_id = Column(String, unique=True, index=True)

    # =========================
    # Basic Info
    # =========================
    full_name = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=True, index=True)
    password = Column(String, nullable=True)
    phone = Column(String)
    alternate_phone = Column(String)
    alternate_email = Column(String)
    emergency_contact = Column(String)
    dob = Column(Date)
    gender = Column(String)
    nationality = Column(String)
    marital_status = Column(String)

    # =========================
    # Address
    # =========================
    current_location = Column(String)
    city = Column(String)
    pincode = Column(String)
    current_address = Column(Text)
    permanent_address = Column(Text)
    state = Column(String)
    country = Column(String)

    # =========================
    # Application Info
    # =========================
    source = Column(String)                      # portal / recruiter / vendor / referral
    applied_job_id = Column(String)
    application_date = Column(DateTime)
    status = Column(Enum(CandidateStatus, name="candidate_status"), default=CandidateStatus.applied)
    referral = Column(String)
    current_job_title = Column(String)

    # =========================
    # Vendor Support
    # =========================
    vendor_id = Column(String, nullable=True)
    is_vendor_candidate = Column(Boolean, default=False)

    billing_rate = Column(Float, nullable=True)
    payout_rate = Column(Float, nullable=True)

    # =========================
    # =========================
# Background Verification ⭐⭐
# =========================
    bgv_status = Column(String, default="new")          # new | in_progress | completed | failed
    bgv_vendor_id = Column(String, ForeignKey("vendors.id"), nullable=True)

# ⭐ Add these new important fields
    bgv_initiated = Column(Boolean, default=False)
    bgv_assigned_at = Column(DateTime, nullable=True)
    bgv_report_url = Column(Text, nullable=True)
    bgv_completed_at = Column(DateTime, nullable=True)

        # -------------------------
    # Final HR Verification
    # -------------------------
    bgv_final_status = Column(String, nullable=True)  # verified | failed
    bgv_final_remarks = Column(Text, nullable=True)
    bgv_final_verified_at = Column(DateTime, nullable=True)


    # =========================
    # Resume + Files
    # =========================
    resume_url = Column(Text)
    resume_path = Column(Text)
    resume_version = Column(String)
    cover_letter_url = Column(Text)
    certificates_url = Column(Text)
    photo_url = Column(Text)
    sign_url = Column(Text)

    # =========================
    # Professional
    # =========================
    skills = Column(JSON, default=list)
    experience_years = Column(Float)
    relevant_experience_years = Column(Float)
    education = Column(JSON)
    qualification = Column(String)
    university = Column(String)
    graduation_year = Column(Integer)
    certifications_text = Column(Text)
    current_employer = Column(String)
    previous_employers = Column(JSON)
    notice_period = Column(String)
    notice_period_days = Column(Integer)
    primary_skill = Column(String)
    secondary_skill = Column(String)

    # Additional Professional Fields
    current_role = Column(String)
    professional_headline = Column(String)
    employment_status = Column(String)
    career_summary = Column(Text)
    work_history = Column(JSON)
    education_history = Column(JSON)
    projects = Column(JSON)
    references = Column(JSON)

    linkedin_url = Column(String)
    github_url = Column(String)
    portfolio_url = Column(String)

    expected_ctc = Column(String)
    current_ctc = Column(Float)
    minimum_ctc = Column(Float)
    salary_negotiable = Column(Boolean)
    experience = Column(String)
    date_of_birth = Column(String)

    # =========================
    # AI / Parsing / Analytics
    # =========================
    parsed_resume = Column(JSON)
    parsed_data_json = Column(JSON)
    parsed_json = Column(JSON)
    parsed_at = Column(DateTime)
    parser_version = Column(String(50))
    raw_text = Column(Text)
    embedding_vector = Column(JSON)
    resume_versions = Column(JSON)

    fit_score = Column(Float)
    fit_explanation = Column(JSON)

    # =========================
    # Tags / Logs / Profile
    # =========================
    profile_completed = Column(Boolean, default=False)
    profile_completion = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    last_login = Column(DateTime)
    internal_notes = Column(Text)
    tags = Column(JSON)

    intake_status = Column(String)
    uploaded_by_recruiter_id = Column(String, ForeignKey("users.id"), nullable=True)
    email_logs = Column(JSON)

    # =========================
    # Preferences
    # =========================
    expected_salary = Column(Float)
    preferred_location = Column(String)
    languages_known = Column(JSON)
    social_profiles = Column(JSON)
    willing_to_relocate = Column(Boolean)
    ready_to_relocate = Column(String)
    preferred_employment_type = Column(String)
    preferred_work_mode = Column(String)
    availability_to_join = Column(Date)
    available_from = Column(Date)
    last_working_day = Column(Date)
    availability_status = Column(String)
    travel_availability = Column(String)
    work_authorization = Column(String)
    requires_sponsorship = Column(Boolean)
    time_zone = Column(String)

    # =========================
    # Interview Stage
    # =========================
    interview_stage = Column(String)
    interview_feedback = Column(Text)

    # =========================
    # Forwarding / Client Submission
    # =========================
    forwarded_to = Column(String)
    forward_note = Column(Text)
    forwarded_at = Column(DateTime)

    # =========================
    # Classification
    # =========================
    classification = Column(
        Enum(CandidateClassification, name="candidateclassification"),
        nullable=False,
        default=CandidateClassification.unclassified
    )

    # =========================
    # Relationships
    # =========================
    applications = relationship("JobApplication", back_populates="candidate")
    notes = relationship("CandidateNote", back_populates="candidate")
    timeline_events = relationship("CandidateTimeline", back_populates="candidate")
    employee_record = relationship("Employee", back_populates="candidate", uselist=False)
    call_feedbacks = relationship("CallFeedback", back_populates="candidate")
    certifications = relationship("Certification", back_populates="candidate", cascade="all, delete-orphan")
        # =========================
    # Merge / Soft Delete Control
    # =========================

    # Is this candidate active & visible in ATS lists
    is_active = Column(Boolean, default=True, nullable=False)

    # If merged, points to primary candidate.id
    merged_into_id = Column(
        String,
        ForeignKey("candidates.id"),
        nullable=True
    )

    # ============================================================
    # ACTIVITY TRACKING FIELDS
    # ============================================================
    last_activity_at = Column(DateTime, nullable=True, index=True)
    last_activity_type = Column(String(100), nullable=True)

    # Optional relationship (not mandatory but good)
    merged_into = relationship(
        "Candidate",
        remote_side="Candidate.id",
        lazy="joined"
    )


# ============================================================
# CONSULTANT DEPLOYMENT (Client Assignment)
# ============================================================

class ConsultantDeployment(Base):
    __tablename__ = "consultant_deployments"

    id = Column(String, primary_key=True, default=generate_uuid)
    consultant_id = Column(String, ForeignKey("consultants.id"), nullable=False)
    client_id = Column(String)

    client_name = Column(String, nullable=False)
    role = Column(String, nullable=True)

    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)

    billing_type = Column(String, nullable=False)  # monthly | hourly
    billing_rate = Column(Float, nullable=False)
    payout_rate = Column(Float, nullable=True)

    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    # ✅ ADD THIS
    consultant = relationship(
        "Consultant",
        back_populates="deployments"
    )
class TimesheetStatus(enum.Enum):
    draft = "draft"
    submitted = "submitted"
    am_approved = "am_approved"
    client_approved = "client_approved"
    rejected = "rejected"
    locked = "locked"

class Timesheet(Base):
    __tablename__ = "timesheets"

    id = Column(String, primary_key=True, default=generate_uuid)

    # 🔗 CORE LINKS
    deployment_id = Column(
        String,
        ForeignKey("consultant_deployments.id"),
        nullable=False
    )

    consultant_id = Column(
        String,
        ForeignKey("consultants.id"),
        nullable=False
    )

    client_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=False
    )

    # 📅 PERIOD
    period_type = Column(String, nullable=False)   # weekly | monthly
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    total_hours = Column(Float, default=0)

    status = Column(
        Enum(TimesheetStatus, name="timesheet_status"),
        default=TimesheetStatus.draft,
        nullable=False
    )

    # ⏱ WORKFLOW TIMESTAMPS
    submitted_at = Column(DateTime, nullable=True)
    am_approved_at = Column(DateTime, nullable=True)
    client_approved_at = Column(DateTime, nullable=True)
    locked_at = Column(DateTime, nullable=True)

    rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # 🔁 RELATIONSHIPS
    deployment = relationship("ConsultantDeployment")
    consultant = relationship("Consultant")
    client = relationship("User")

    entries = relationship(
        "TimesheetEntry",
        back_populates="timesheet",
        cascade="all, delete"
    )

class TimesheetEntry(Base):
    __tablename__ = "timesheet_entries"

    id = Column(String, primary_key=True, default=generate_uuid)

    timesheet_id = Column(
        String,
        ForeignKey("timesheets.id"),
        nullable=False
    )

    work_date = Column(Date, nullable=False)
    hours = Column(Float, nullable=False)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # 🔁 RELATIONSHIP
    timesheet = relationship(
        "Timesheet",
        back_populates="entries"
    )


# ============================================================
# JOB APPLICATIONS (Candidate Portal & ATS)
# ============================================================
class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        UniqueConstraint(
            "job_id",
            "candidate_id",
            name="uq_job_application_job_candidate"
        ),
    )
    id = Column(String, primary_key=True, default=generate_uuid)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)

    full_name = Column(String)
    email = Column(String)
    phone = Column(String)

    resume_url = Column(Text)
    resume_version = Column(String)
    linkedin_url = Column(String)
    portfolio_url = Column(String)
    cover_letter_url = Column(Text)
    certificates_url = Column(Text)
    photo_url = Column(Text)
    sign_url = Column(Text)

    skills = Column(JSON, default=list)
    experience_years = Column(Float)

    parsed_resume = Column(JSON)
    screening_score = Column(Float, nullable=True)

    profile_completed = Column(Boolean, default=False)

    status = Column(String, default="applied")
    applied_at = Column(DateTime, default=datetime.utcnow)
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=True)  # ⭐⭐ ADD THIS
    shortlisted_at = Column(DateTime, nullable=True)

    candidate = relationship("Candidate", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    client_feedback = Column(Text, nullable=True)
    client_decision = Column(String(50), nullable=True)   # shortlisted | rejected | hired
    sent_to_am_at = Column(DateTime, nullable=True)   # ⭐ ADD THIS
    sent_to_client_at = Column(DateTime, nullable=True)
    decision_at = Column(DateTime, nullable=True)
    ready_for_assignment = Column(Boolean, default=False)
    interview_scheduling_ready = Column(Boolean, default=False)
    interview_scheduling_note = Column(Text, nullable=True)
    interview_scheduling_ready_at = Column(DateTime, nullable=True)
    interview_scheduling_ready_by = Column(String, ForeignKey("users.id"), nullable=True)

    # ============================================================
    # ACTIVITY TRACKING FIELDS
    # ============================================================
    last_activity_at = Column(DateTime, nullable=True, index=True)
    last_activity_type = Column(String(100), nullable=True)


# ============================================================
# ============================================================
# CANDIDATE SUBMISSION (RECRUITER → JOB)
# ============================================================
class CandidateSubmission(Base):
    __tablename__ = "candidate_submissions"

    __table_args__ = (
        UniqueConstraint(
            "candidate_id",
            "job_id",
            name="uq_candidate_submission"
        ),
    )

    id = Column(String, primary_key=True, default=generate_uuid)

    candidate_id = Column(
        String,
        ForeignKey("candidates.id"),
        nullable=False
    )

    requirement_id = Column(
        String,
        ForeignKey("requirements.id"),
        nullable=True
    )

    job_id = Column(
        String,
        ForeignKey("jobs.id"),
        nullable=False
    )

    recruiter_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=False
    )

    match_score = Column(Float, nullable=False, default=0)
    match_details = Column(JSON, nullable=True)

    status = Column(String, default="submitted")
    stage = Column(String, default="recruiter_review")
    is_locked = Column(Boolean, default=False)
    source = Column(String, nullable=True)

    # ✅ STANDARD TIMESTAMPS (FIXES YOUR ERROR)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    shortlisted_at = Column(DateTime, nullable=True)
    decision_at = Column(DateTime, nullable=True)

    # ✅ RELATIONSHIPS
    candidate = relationship(
        "Candidate",
        backref="submissions",
        lazy="joined"
    )

    job = relationship(
        "Job",
        backref="submissions",
        lazy="joined"
    )

    requirement = relationship(
        "Requirement",
        foreign_keys=[requirement_id]
    )

    recruiter = relationship("User")

    interviews = relationship(
        "Interview",
        back_populates="submission",
        cascade="all, delete"
    )

# ============================================================
# CANDIDATE NOTES (Admin → Add notes)
# ============================================================
class CandidateNote(Base):
    __tablename__ = "candidate_notes"

    id = Column(String, primary_key=True, default=generate_uuid)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)
    submission_id = Column(String, ForeignKey("candidate_submissions.id"), nullable=True)
    note_stage = Column(String, nullable=True)  # call_feedback | interview_notes | am_feedback | client_feedback
    rating = Column(Integer, nullable=True)  # 1-5
    strengths = Column(Text, nullable=True)
    concerns = Column(Text, nullable=True)
    free_text = Column(Text, nullable=True)
    note = Column(Text, nullable=False)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="notes")
    author = relationship("User", back_populates="notes")
    submission = relationship("CandidateSubmission")


# ============================================================
# CANDIDATE TIMELINE (Status tracking)
# ============================================================
class CandidateTimeline(Base):
    __tablename__ = "candidate_timelines"

    id = Column(String, primary_key=True, default=generate_uuid)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)

    status = Column(String, nullable=False)
    note = Column(Text)
    user_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", back_populates="timeline_events")
    user = relationship("User")


# ============================================================
# CERTIFICATIONS
# ============================================================
class Certification(Base):
    __tablename__ = "certifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)

    name = Column(String, nullable=False)
    organization = Column(String, nullable=False)
    issue_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    credential_id = Column(String, nullable=True)
    credential_url = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    candidate = relationship("Candidate", back_populates="certifications")


# ============================================================
# MARKETING SOURCE MANAGEMENT (Bulk sourcing system)
# ============================================================
class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String, primary_key=True, default=generate_uuid)
    job_id = Column(String, ForeignKey("jobs.id"))

    platform = Column(String)
    campaign_name = Column(String)
    utm_source = Column(String)
    utm_medium = Column(String)
    utm_campaign = Column(String)

    budget = Column(Float)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(String, default="active")

    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    applications = Column(Integer, default=0)
    click_through_rate = Column(Float, default=0.0)
    cost_per_application = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="campaigns")
        



class Lead(Base):
    __tablename__ = "leads"

    id = Column(String, primary_key=True, default=generate_uuid)
    campaign_id = Column(String, ForeignKey("campaigns.id"))

    full_name = Column(String)
    email = Column(String)
    phone = Column(String)
    location = Column(String)
    linkedin_url = Column(String)
    source = Column(String)
    utm_params = Column(JSON)

    status = Column(String, default="new")
    score = Column(Integer, default=0)
    notes = Column(Text)

    converted_to_application_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_contacted_at = Column(DateTime)


# ============================================================
# INTERVIEW SYSTEM (Video / AI support)
# ============================================================
class Interview(Base):
    __tablename__ = "interviews"

    id = Column(String, primary_key=True, default=generate_uuid)

    submission_id = Column(
        String,
        ForeignKey("candidate_submissions.id"),
        nullable=False
    )

    # Interview meta
    mode = Column(String)  # ai_chat | video | live | in_person
    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    interview_date = Column(Date, nullable=True)
    interview_time = Column(String, nullable=True)
    interviewer_name = Column(String, nullable=True)
    location_or_link = Column(String, nullable=True)
    am_informed = Column(Boolean, default=False)
    client_informed = Column(Boolean, default=False)

    status = Column(String, default="scheduled")

    transcript = Column(JSON, default=list)
    total_questions = Column(Integer)
    duration_seconds = Column(Integer)
    overall_ai_score = Column(Float)

    video_path = Column(String, nullable=True)
    audio_path = Column(String, nullable=True)

    # ✅ LIVE INTERVIEW SUPPORT
    meeting_link = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    location = Column(Text, nullable=True)
    contact_person = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # ✅ THIS IS THE MOST IMPORTANT LINE
    submission = relationship(
        "CandidateSubmission",
        back_populates="interviews",
        lazy="joined"
    )

    # Optional scoring & review
    scores = relationship(
        "InterviewScore",
        back_populates="interview",
        cascade="all, delete"
    )

    review = relationship(
        "HumanReview",
        back_populates="interview",
        uselist=False
    )


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    interview_id = Column(String, ForeignKey("interviews.id"), nullable=False)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=True)

    status = Column(String, default="in_progress")
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # AI chat state
    questions = Column(JSON, default=list)
    current_index = Column(Integer, default=0)
    last_question = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    interview = relationship("Interview")
    candidate = relationship("Candidate")


class InterviewScore(Base):
    __tablename__ = "interview_scores"

    id = Column(String, primary_key=True, default=generate_uuid)
    interview_id = Column(String, ForeignKey("interviews.id"))

    dimension = Column(String)
    score = Column(Float)
    explanation = Column(Text)
    top_factors = Column(JSON)
    ai_model_version = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    interview = relationship("Interview", back_populates="scores")


class AIVideoInterview(Base):
    __tablename__ = "ai_video_interviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False)

    status = Column(String, default="scheduled")
    # scheduled | in_progress | completed

    questions = Column(JSON)        # list[str] – questions asked
    answers = Column(JSON)          # [{question, video_url, duration}]

    transcript = Column(JSON)       # optional (future speech-to-text)

    overall_ai_score = Column(Float)
    ai_feedback = Column(JSON)

    recording_enabled = Column(Boolean, default=True)

    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Optional relationships (safe to keep)
    candidate = relationship("Candidate", lazy="joined")
    job = relationship("Job", lazy="joined")

class LiveInterview(Base):
    __tablename__ = "live_interviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # 🔥 ADD THIS (CRITICAL FIX)
    submission_id = Column(
        String,
        ForeignKey("candidate_submissions.id"),
        nullable=False
    )

    # KEEP existing columns (DO NOT REMOVE)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=True)

    interviewer_id = Column(String, nullable=True)

    status = Column(String, default="scheduled")
    scheduled_at = Column(DateTime, nullable=True)
    meeting_link = Column(String, nullable=True)

    recording_enabled = Column(Boolean, default=True)
    recording_url = Column(String, nullable=True)

    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # ✅ RELATIONSHIPS (THIS FIXES FRONTEND)
    submission = relationship(
        "CandidateSubmission",
        lazy="joined"
    )

    candidate = relationship(
        "Candidate",
        lazy="joined"
    )

    job = relationship(
        "Job",
        lazy="joined"
    )


class HumanReview(Base):
    __tablename__ = "human_reviews"

    id = Column(String, primary_key=True, default=generate_uuid)
    interview_id = Column(String, ForeignKey("interviews.id"))
    reviewer_id = Column(String, ForeignKey("users.id"))

    overall_score_override = Column(Float)
    notes = Column(Text)
    decision = Column(String)  # hire / reject / hold
    reviewed_at = Column(DateTime, default=datetime.utcnow)

    interview = relationship("Interview", back_populates="review")



class AIInterviewResult(Base):
    __tablename__ = "ai_interview_results"

    id = Column(String, primary_key=True, default=generate_uuid)
    interview_id = Column(String, ForeignKey("interviews.id"))
    mode = Column(String)  # chat | video
    score = Column(Float)
    transcript = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class LiveInterviewResult(Base):
    __tablename__ = "live_interview_results"

    id = Column(String, primary_key=True, default=generate_uuid)
    interview_id = Column(String, ForeignKey("interviews.id"))
    interviewer_id = Column(String, nullable=True)
    rating = Column(Integer)
    comments = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class InterviewRecording(Base):
    __tablename__ = "interview_recordings"

    id = Column(String, primary_key=True, default=generate_uuid)
    interview_id = Column(String, ForeignKey("interviews.id"))
    file_url = Column(String)
    recorded_by = Column(String)  # ai | human
    created_at = Column(DateTime, default=datetime.utcnow)


class InterviewFeedback(Base):
    __tablename__ = "interview_feedbacks"

    id = Column(String, primary_key=True, default=generate_uuid)
    interview_id = Column(String, ForeignKey("interviews.id"), nullable=False)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)

    # Feedback content
    rating = Column(Integer, nullable=False)  # 1-5 scale
    experience_feedback = Column(Text, nullable=True)  # Qualitative feedback
    ease_of_use = Column(Integer, nullable=True)  # 1-5 scale
    comments = Column(Text, nullable=True)

    submitted_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    interview = relationship("Interview", backref="feedback")
    candidate = relationship("Candidate")


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"

    id = Column(String, primary_key=True, default=generate_uuid)
    interview_id = Column(String, ForeignKey("interviews.id"), nullable=False)
    session_id = Column(String, ForeignKey("interview_sessions.id"), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    ai_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    interview = relationship("Interview")
    session = relationship("InterviewSession")


class InterviewLog(Base):
    __tablename__ = "interview_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    interview_id = Column(String, ForeignKey("interviews.id"), nullable=False)
    action = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    interview = relationship("Interview")


# ============================================================
# EMPLOYEE RECORD (converted candidate to employee)
class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, default=generate_uuid)

    candidate_id = Column(
        String,
        ForeignKey("candidates.id"),
        nullable=False,
        unique=True
    )

    user_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=False
    )
    full_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    employee_code = Column(String, unique=True)

    designation = Column(String)
    department = Column(String)
    manager_id = Column(String, ForeignKey("employees.id"))
    status = Column(String, default="onboarding")

    join_date = Column(DateTime)
    exit_date = Column(DateTime)
    location = Column(String)
    ctc = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ================= RELATIONSHIPS =================

    candidate = relationship(
        "Candidate",
        back_populates="employee_record",
        lazy="joined"
    )

    user = relationship(
        "User",
        back_populates="employees"
    )

    manager = relationship(
        "Employee",
        remote_side="Employee.id",
        backref="team_members"
    )

    onboarding_tasks = relationship(
        "OnboardingTask",
        back_populates="employee",
        cascade="all, delete"
    )

    performance_reviews = relationship(
        "PerformanceReview",
        back_populates="employee",
        cascade="all, delete"
    )

    exit_interview = relationship(
        "ExitInterview",
        back_populates="employee",
        uselist=False
    )

    alumni_record = relationship(
        "Alumni",
        back_populates="employee",
        uselist=False
    )

# app/models/consultant.py (or models.py me add)

class ConsultantType(enum.Enum):
    sourcing = "sourcing"
    payroll = "payroll"




class Consultant(Base):
    __tablename__ = "consultants"

    id = Column(String, primary_key=True, default=generate_uuid)

    candidate_id = Column(
        String,
        ForeignKey("candidates.id"),
        nullable=False,
        unique=True
    )

    user_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=False
    )

    client_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=True
    )

    consultant_code = Column(String, unique=True)

    type = Column(
        Enum(ConsultantType, name="consultant_type"),
        nullable=False
    )

    status = Column(String, default="available")

    billing_rate = Column(Float)
    payout_rate = Column(Float)
    payroll_ready = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    # ✅ RELATIONSHIPS (VERY IMPORTANT)
    user = relationship(
        "User",
        foreign_keys=[user_id]
    )

    client = relationship(
        "User",
        foreign_keys=[client_id]
    )

    candidate = relationship("Candidate", lazy="joined")

    deployments = relationship(
        "ConsultantDeployment",
        back_populates="consultant",
        cascade="all, delete"
    )


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(String, ForeignKey("employees.id"))
    category = Column(String)                     # aadhar, pan, resume, offer_letter, etc.
    filename = Column(String)
    storage_path = Column(String)
    file_size = Column(Integer)
    mime_type = Column(String)
    uploaded_by = Column(String, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", backref="documents")




class DocumentAudit(Base):
    __tablename__ = "document_audits"

    id = Column(String, primary_key=True, default=generate_uuid)
    # document_id = Column(String, ForeignKey("documents.id")) # comment/remove
    document_id = Column(String)   # without FK for now

    user_id = Column(String, ForeignKey("users.id"))
    action = Column(String)  # upload, download, delete
    created_at = Column(DateTime, default=datetime.utcnow)

# ============================================================
# ONBOARDING TASKS
# ============================================================
class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(String, ForeignKey("employees.id"))

    title = Column(String)
    description = Column(Text)
    task_type = Column(String)
    status = Column(String, default="pending")
    assigned_to = Column(String, ForeignKey("users.id"), nullable=True)

    due_date = Column(DateTime)
    completed_at = Column(DateTime)

    documents_required = Column(JSON)
    documents_submitted = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="onboarding_tasks")
    # note: relationship to User is optional and only one-sided if needed:
    # assignee = relationship("User")


# ============================================================
# PERFORMANCE REVIEW
# ============================================================
class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(String, ForeignKey("employees.id"))
    reviewer_id = Column(String, ForeignKey("users.id"))

    review_period_start = Column(DateTime)
    review_period_end = Column(DateTime)
    overall_rating = Column(Float)

    goals_achieved = Column(JSON)
    strengths = Column(Text)
    areas_of_improvement = Column(Text)
    comments = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="performance_reviews")


# ============================================================
# EXIT INTERVIEW
# ============================================================
class ExitInterview(Base):
    __tablename__ = "exit_interviews"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(String, ForeignKey("employees.id"))
    interviewer_id = Column(String, ForeignKey("users.id"))

    exit_reason = Column(String)
    feedback = Column(Text)
    would_rehire = Column(Boolean)
    would_recommend = Column(Boolean)

    conducted_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship(
        "Employee",
        back_populates="exit_interview"
    )


# ============================================================
# ALUMNI RECORD
# ============================================================
class Alumni(Base):
    __tablename__ = "alumni"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(String, ForeignKey("employees.id"))

    exit_date = Column(DateTime)
    last_designation = Column(String)
    tenure_years = Column(Float)

    current_company = Column(String)
    current_designation = Column(String)
    linkedin_url = Column(String)

    is_eligible_for_rehire = Column(Boolean, default=True)
    referrals_made = Column(Integer, default=0)
    engagement_score = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship(
        "Employee",
        back_populates="alumni_record"
    )


# ============================================================
# LEAVES SYSTEM
# ============================================================
class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(String, ForeignKey("employees.id"))

    leave_type = Column(String)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    days_count = Column(Float)

    reason = Column(Text)
    status = Column(String, default="pending")
    approved_by = Column(String, ForeignKey("users.id"))
    approved_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)


class LeaveBalance(Base):
    __tablename__ = "leave_balances"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(String, ForeignKey("employees.id"))

    leave_type = Column(String)
    total_allocated = Column(Float, default=0.0)
    used = Column(Float, default=0.0)
    available = Column(Float, default=0.0)
    year = Column(Integer)

    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================
# PAYROLL MODULE
# ============================================================
class EmployeeSalary(Base):
    __tablename__ = "employee_salaries"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(String, ForeignKey("employees.id"))

    basic_salary = Column(Float)
    hra = Column(Float, default=0.0)
    transport_allowance = Column(Float, default=0.0)
    medical_allowance = Column(Float, default=0.0)
    special_allowance = Column(Float, default=0.0)

    other_allowances = Column(JSON)
    gross_salary = Column(Float)

    bank_name = Column(String)
    account_number = Column(String)
    ifsc_code = Column(String)
    pan_number = Column(String)

    effective_from = Column(DateTime)
    effective_to = Column(DateTime)
    is_active = Column(Boolean, default=True)
    currency = Column(String, default="INR")

    created_at = Column(DateTime, default=datetime.utcnow)


class SalaryDeduction(Base):
    __tablename__ = "salary_deductions"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(String, ForeignKey("employees.id"))

    deduction_type = Column(String)
    description = Column(String)
    amount = Column(Float)
    is_percentage = Column(Boolean, default=False)

    is_recurring = Column(Boolean, default=True)
    start_date = Column(DateTime)
    end_date = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)


class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id = Column(String, primary_key=True, default=generate_uuid)

    period_month = Column(Integer)
    period_year = Column(Integer)
    period_start = Column(DateTime)
    period_end = Column(DateTime)

    total_employees = Column(Integer, default=0)
    total_gross = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    total_net = Column(Float, default=0.0)

    status = Column(String, default="draft")
    processed_by = Column(String, ForeignKey("users.id"))
    processed_at = Column(DateTime)

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class PaySlip(Base):
    __tablename__ = "payslips"

    id = Column(String, primary_key=True, default=generate_uuid)
    payroll_run_id = Column(String, ForeignKey("payroll_runs.id"))
    employee_id = Column(String, ForeignKey("employees.id"))

    basic_salary = Column(Float)
    hra = Column(Float, default=0.0)
    transport_allowance = Column(Float, default=0.0)
    medical_allowance = Column(Float, default=0.0)
    special_allowance = Column(Float, default=0.0)

    other_earnings = Column(JSON)
    gross_salary = Column(Float)

    tax_deduction = Column(Float, default=0.0)
    provident_fund = Column(Float, default=0.0)
    insurance = Column(Float, default=0.0)
    loan_repayment = Column(Float, default=0.0)
    other_deductions = Column(JSON)
    total_deductions = Column(Float, default=0.0)

    net_salary = Column(Float)
    working_days = Column(Integer, default=0)
    present_days = Column(Integer, default=0)
    leave_days = Column(Integer, default=0)

    payment_status = Column(String, default="pending")
    payment_date = Column(DateTime)
    payment_method = Column(String)
    payment_reference = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================
# FINANCE / AUDIT / SYSTEM SETTINGS
# ============================================================
class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=generate_uuid)
    client_name = Column(String)
    client_id = Column(String)
    invoice_number = Column(String, unique=True)
    amount = Column(Float)
    status = Column(String, default="draft")
    placements = Column(JSON)
    due_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class AIAudit(Base):
    __tablename__ = "ai_audit"

    id = Column(String, primary_key=True, default=generate_uuid)
    decision_type = Column(String)
    model_name = Column(String)
    model_version = Column(String)
    input_data = Column(JSON)
    output_data = Column(JSON)
    confidence_score = Column(Float)
    explanation = Column(JSON)
    related_entity_id = Column(String)
    related_entity_type = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    config_key = Column("key", String, unique=True, index=True, nullable=True)
    value_json = Column(JSON, nullable=True)
    value_type = Column(String(20), nullable=True, default="json")
    category = Column(String(100), nullable=True, index=True)
    module_name = Column(String)
    setting_key = Column(String)
    setting_value = Column(JSON)
    description = Column(Text)
    is_secret = Column(Boolean, default=False, nullable=False)
    is_editable = Column(Boolean, default=True, nullable=False)
    updated_by = Column(String, ForeignKey("users.id"))
    updated_at = Column(DateTime, default=datetime.utcnow)


class Department(Base):
    __tablename__ = "departments"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    code = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_departments_tenant_name"),
    )


class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_locations_tenant_name"),
    )


class Designation(Base):
    __tablename__ = "designations"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    level = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_designations_tenant_name"),
    )


class JobTemplate(Base):
    __tablename__ = "job_templates"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    json_config = Column(JSON, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HiringStage(Base):
    __tablename__ = "hiring_stages"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False, index=True)
    stage_type = Column(String, nullable=True, index=True)
    sort_order = Column(Integer, default=0, nullable=False, index=True)
    required_fields = Column(JSON, default=list, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_hiring_stages_tenant_name"),
        Index("ix_hiring_stages_tenant_sort", "tenant_id", "sort_order"),
    )


class BrandingSetting(Base):
    __tablename__ = "branding_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True, unique=True)
    config_json = Column(JSON, default=dict, nullable=False)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PortalPreference(Base):
    __tablename__ = "portal_preferences"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True, unique=True)
    config_json = Column(JSON, default=dict, nullable=False)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BusinessEmailTemplate(Base):
    __tablename__ = "business_email_templates"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True)
    category = Column(String, nullable=False, index=True)
    key = Column(String, nullable=False, index=True)
    subject = Column(String, nullable=False)
    body_html = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "category", "key", name="uq_business_email_templates_scope_key"),
    )


class ApprovalWorkflow(Base):
    __tablename__ = "approval_workflows"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True)
    type = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    condition_json = Column(JSON, default=dict, nullable=False)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ApprovalStep(Base):
    __tablename__ = "approval_steps"

    id = Column(String, primary_key=True, default=generate_uuid)
    workflow_id = Column(String, ForeignKey("approval_workflows.id"), nullable=False, index=True)
    step_order = Column(Integer, default=1, nullable=False, index=True)
    approver_type = Column(String, nullable=False)
    approver_ref = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ApprovalCondition(Base):
    __tablename__ = "approval_conditions"

    id = Column(String, primary_key=True, default=generate_uuid)
    workflow_id = Column(String, ForeignKey("approval_workflows.id"), nullable=False, index=True)
    condition_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Integration(Base):
    __tablename__ = "integrations"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=True, index=True)
    provider = Column(String, nullable=False, index=True)
    status = Column(String, default="disconnected", nullable=False, index=True)
    config_json = Column(JSON, default=dict, nullable=False)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("tenant_id", "provider", name="uq_integrations_scope_provider"),
    )


class IntegrationLog(Base):
    __tablename__ = "integration_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    integration_id = Column(String, ForeignKey("integrations.id"), nullable=False, index=True)
    status = Column(String, nullable=False, index=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id = Column(String, primary_key=True, default=generate_uuid)
    public_key = Column("key", String, unique=True, index=True, nullable=True)
    flag_key = Column(String, unique=True, index=True, nullable=False)
    enabled = Column(Boolean, default=False)
    rollout_json = Column(JSON, default=dict, nullable=False)
    description = Column(Text, nullable=True)
    updated_by = Column(String, ForeignKey("users.id"))
    updated_at = Column(DateTime, default=datetime.utcnow)


class UILabel(Base):
    __tablename__ = "ui_labels"

    id = Column(String, primary_key=True, default=generate_uuid)
    key = Column(String(255), unique=True, nullable=False, index=True)
    category = Column(String(100), nullable=True, index=True)
    default_value = Column(Text, nullable=False)
    custom_value = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    updated_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String, primary_key=True, default=generate_uuid)
    key = Column(String(120), unique=True, nullable=False, index=True)
    tenant_id = Column(String, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    department = Column(String(120), nullable=True, index=True)
    job_type = Column(String(120), nullable=True, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="draft", index=True)  # draft | published | archived
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class WorkflowStage(Base):
    __tablename__ = "workflow_stages"

    id = Column(String, primary_key=True, default=generate_uuid)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False, index=True)
    workflow_version_id = Column(String, ForeignKey("workflow_versions.id"), nullable=True, index=True)
    stage_key = Column(String(120), nullable=False, index=True)
    stage_name = Column(String(255), nullable=False)
    order_index = Column(Integer, nullable=False, default=0, index=True)
    color = Column(String(20), nullable=True, default="#6C2BD9")
    settings_json = Column(JSON, default=dict, nullable=False)
    is_terminal = Column(Boolean, default=False, nullable=False)
    is_rejection = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    __table_args__ = (
        UniqueConstraint("workflow_id", "stage_key", name="uq_workflow_stage_key"),
        UniqueConstraint("workflow_id", "order_index", name="uq_workflow_stage_order"),
    )


class WorkflowVersion(Base):
    __tablename__ = "workflow_versions"

    id = Column(String, primary_key=True, default=generate_uuid)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False, index=True)
    version_no = Column(Integer, nullable=False, default=1, index=True)
    status = Column(String(30), nullable=False, default="draft", index=True)  # draft | published | archived
    published_at = Column(DateTime, nullable=True)
    config_json = Column(JSON, default=dict, nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    __table_args__ = (
        UniqueConstraint("workflow_id", "version_no", name="uq_workflow_version_no"),
    )


class WorkflowTransition(Base):
    __tablename__ = "workflow_transitions"

    id = Column(String, primary_key=True, default=generate_uuid)
    workflow_version_id = Column(String, ForeignKey("workflow_versions.id"), nullable=False, index=True)
    from_stage_id = Column(String, ForeignKey("workflow_stages.id"), nullable=False, index=True)
    to_stage_id = Column(String, ForeignKey("workflow_stages.id"), nullable=False, index=True)
    condition_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class WorkflowRule(Base):
    __tablename__ = "workflow_rules"

    id = Column(String, primary_key=True, default=generate_uuid)
    workflow_version_id = Column(String, ForeignKey("workflow_versions.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    trigger = Column(String(120), nullable=False, index=True)
    condition_json = Column(JSON, default=dict, nullable=False)
    action_json = Column(JSON, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class WorkflowScope(Base):
    __tablename__ = "workflow_scope"

    id = Column(String, primary_key=True, default=generate_uuid)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False, index=True)
    scope_type = Column(String(50), nullable=False, index=True)  # global | client | job | requirement
    scope_value = Column(String(255), nullable=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    __table_args__ = (
        UniqueConstraint("workflow_id", "scope_type", "scope_value", name="uq_workflow_scope"),
    )


class WorkflowTask(Base):
    __tablename__ = "workflow_tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    workflow_id = Column(String, ForeignKey("workflows.id"), nullable=False, index=True)
    stage_id = Column(String, ForeignKey("workflow_stages.id"), nullable=False, index=True)
    task_key = Column(String(120), nullable=False, index=True)
    task_name = Column(String(255), nullable=False)
    role_name = Column(String(120), nullable=False, index=True)
    resource_name = Column(String(120), nullable=True)
    action_name = Column(String(50), nullable=True)  # create | read | update | delete | export | custom
    is_required = Column(Boolean, default=True, nullable=False)
    helper_link = Column(String(500), nullable=True)
    order_index = Column(Integer, nullable=False, default=0, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    __table_args__ = (
        UniqueConstraint("workflow_id", "task_key", name="uq_workflow_task_key"),
        UniqueConstraint("stage_id", "order_index", name="uq_stage_task_order"),
    )


class TaskCompletion(Base):
    __tablename__ = "task_completions"

    id = Column(String, primary_key=True, default=generate_uuid)
    submission_id = Column(String, ForeignKey("candidate_submissions.id"), nullable=False, index=True)
    task_id = Column(String, ForeignKey("workflow_tasks.id"), nullable=False, index=True)
    completed_by = Column(String, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    completed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    __table_args__ = (
        UniqueConstraint("submission_id", "task_id", name="uq_task_completion_submission_task"),
    )


class CandidateStageHistory(Base):
    __tablename__ = "candidate_stage_history"

    id = Column(String, primary_key=True, default=generate_uuid)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False, index=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=True, index=True)
    workflow_version_id = Column(String, ForeignKey("workflow_versions.id"), nullable=True, index=True)
    from_stage_id = Column(String, ForeignKey("workflow_stages.id"), nullable=True, index=True)
    to_stage_id = Column(String, ForeignKey("workflow_stages.id"), nullable=False, index=True)
    changed_by = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    meta_json = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class CandidateStageCurrent(Base):
    __tablename__ = "candidate_stage_current"

    id = Column(String, primary_key=True, default=generate_uuid)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False, index=True)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=True, index=True)
    workflow_version_id = Column(String, ForeignKey("workflow_versions.id"), nullable=True, index=True)
    stage_id = Column(String, ForeignKey("workflow_stages.id"), nullable=False, index=True)
    owner_user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    entered_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_candidate_stage_current_candidate_job"),
    )


# ============================================================
# Candidate Bulk Upload Log
# ============================================================
class CandidateBulkUploadLog(Base):
    __tablename__ = "candidate_bulk_upload_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=True)
    filename = Column(String, nullable=True)
    total_rows = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    error_csv_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploader = relationship("User", foreign_keys=[uploaded_by])

# ==========================
# CHAT MODEL
# ==========================
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    sender_id = Column(String, nullable=False)         # admin/candidate id
    receiver_id = Column(String, nullable=False)       # jisko msg bheja
    message = Column(Text, nullable=True)              # plain text
    file_url = Column(String, nullable=True)           # file/image/pdf
    file_type = Column(String, nullable=True)          # image/pdf/video
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)

    candidate_id = Column(
        String,
        ForeignKey("candidates.id"),
        nullable=False
    )

    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)

    type = Column(String, default="info")
    # examples:
    # application_submitted
    # interview_scheduled
    # status_changed
    # profile_completed
    # admin_note

    read = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    candidate = relationship("Candidate", backref="notifications")


class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(String, primary_key=True, default=generate_uuid)

    # ⭐ ADD THIS
    requirement_code = Column(String, unique=True, index=True)

    client_id = Column(String, ForeignKey("clients.id"))
    client_name = Column(String, nullable=True)
    client_contact = Column(String, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text)  # Rich text description
    entry_method = Column(String, default="manual")  # manual | email_parsed
    raw_email_content = Column(Text, nullable=True)

    # Skills Breakdown
    skills_mandatory = Column(JSON, default=list)
    skills_good_to_have = Column(JSON, default=list)
    
    # Range fields
    experience_min = Column(Float, default=0.0)
    experience_max = Column(Float)
    ctc_min = Column(Float)
    ctc_max = Column(Float)
    
    # Location & Logistics
    location_details = Column(JSON)  # {city, type: remote/hybrid/onsite}
    certifications = Column(JSON, default=list)
    positions_count = Column(Integer, default=1)
    
    # Process & Urgency
    interview_stages = Column(JSON) # List of stages: ["Screening", "Technical", ...]
    urgency = Column(String)  # Immediate, 1 week, etc.
    target_start_date = Column(Date)
    department = Column(String)
    reporting_manager = Column(String)
    priority = Column(String, default="Medium")

    approved_at = Column(DateTime, nullable=True)
    activated_at = Column(DateTime, nullable=True)

    job_id = Column(String, ForeignKey("jobs.id"), nullable=True)
    status = Column(String, default="new")
    
    # Metadata for AI/Audit
    metadata_json = Column(JSON)
    
    # ============================================================
    # NEW: ACTIVITY TRACKING FOR PASSIVE REQUIREMENT DETECTION
    # ============================================================
    last_activity_at = Column(DateTime, default=datetime.utcnow)
    activity_status = Column(String, default="active")  # active / passive
    passive_notification_sent = Column(Boolean, default=False)
    last_passive_alert_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id = Column(String, ForeignKey("users.id"))
    account_manager_id = Column(
        String,
        ForeignKey("users.id"),
        nullable=True
    )
    
    # Relationships
    client = relationship("Client", backref="requirements")
    account_manager = relationship("User", foreign_keys=[account_manager_id])
    job = relationship("Job", back_populates="requirement")
    
    # SLA Tracking
    sla_records = relationship("RequirementSLA", back_populates="requirement")


class RequirementAssignment(Base):
    __tablename__ = "requirement_assignments"

    id = Column(String, primary_key=True, default=generate_uuid)
    requirement_id = Column(String, ForeignKey("requirements.id"), nullable=False)
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_by = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")  # active | completed | reassigned
    notes = Column(Text, nullable=True)

    requirement = relationship("Requirement", foreign_keys=[requirement_id])
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    assigner = relationship("User", foreign_keys=[assigned_by])


class RequirementSLA(Base):
    __tablename__ = "requirement_sla"

    id = Column(String, primary_key=True, default=generate_uuid)
    requirement_id = Column(String, ForeignKey("requirements.id"), nullable=False)
    
    # Stages of SLA
    intake_to_approval_hours = Column(Float)
    approval_to_assignment_hours = Column(Float)
    assignment_to_first_cv_hours = Column(Float)
    
    # Deadlines
    target_cv_count = Column(Integer, default=5)
    deadline_date = Column(DateTime)
    
    # Status
    is_met = Column(Boolean, default=True)
    breach_notified = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    requirement = relationship("Requirement", back_populates="sla_records")


# ============================================================
# RECRUITER ACTIVITY TRACKING
# ============================================================
class RecruiterActivity(Base):
    __tablename__ = "recruiter_activities"

    id = Column(String, primary_key=True, default=generate_uuid)
    
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=False)
    requirement_id = Column(String, ForeignKey("requirements.id"), nullable=False)
    
    activity_type = Column(String, nullable=False)  # view, submit_candidate, comment, etc.
    description = Column(Text, nullable=True)
    activity_metadata = Column(JSON, nullable=True)  # Additional activity data
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    requirement = relationship("Requirement", foreign_keys=[requirement_id])


# ============================================================
# SYSTEM NOTIFICATIONS
# ============================================================
class SystemNotification(Base):
    __tablename__ = "system_notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    notification_type = Column(String, nullable=False)  # passive_requirement, deadline, etc.
    
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    
    # For passive requirement notifications
    requirement_id = Column(String, ForeignKey("requirements.id"), nullable=True)
    reference_id = Column(String, nullable=True)
    
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    priority = Column(String, default="normal")  # low, normal, high, urgent
    
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    requirement = relationship("Requirement", foreign_keys=[requirement_id])


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(String, primary_key=True, default=generate_uuid)

    company_name = Column(String, nullable=False)
    gst_number = Column(String, nullable=True)
    payment_terms = Column(String, default="NET_30")

    primary_contact_name = Column(String, nullable=True)
    primary_contact_email = Column(String, nullable=True)
    primary_contact_phone = Column(String, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class VendorDocument(Base):
    __tablename__ = "vendor_documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    vendor_id = Column(String, ForeignKey("vendors.id"))

    document_type = Column(String)   # GST, NDA, Agreement, Insurance
    file_path = Column(Text)
    status = Column(String, default="uploaded")

    uploaded_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor")


class ClientContact(Base):
    __tablename__ = "client_contacts"

    id = Column(String, primary_key=True, default=generate_uuid)

    client_id = Column(String, ForeignKey("users.id"), nullable=False)

    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("User")


class EmployeeLog(Base):
    __tablename__ = "employee_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    employee_id = Column(
    String,
    ForeignKey("employees.id")
)
    action = Column(String, nullable=False)

    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

class Skill(Base):
    __tablename__ = "skills"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)              # Display name
    normalized_name = Column(String, nullable=False)  # lowercase key
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("normalized_name", name="uq_skill_normalized"),
    )


class AuditLog(Base):
    """
    Audit trail for all workflow actions and state transitions
    Tracks: Who, What, When, Old State, New State
    """
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    log_id = Column(String, nullable=True, unique=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Enterprise audit fields
    actor_id = Column(String, nullable=True, index=True)
    actor_name = Column(String, nullable=True)
    actor_email = Column(String, nullable=True)
    actor_role = Column(String, nullable=True)
    tenant_id = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False)
    action_label = Column(String, nullable=True)
    module = Column(String, nullable=True, index=True)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    entity_name = Column(String, nullable=True)
    status = Column(String, nullable=False, default="success", index=True)
    description = Column(Text, nullable=True)
    failure_reason = Column(Text, nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    device = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    os = Column(String, nullable=True)
    location = Column(String, nullable=True)
    endpoint = Column(String, nullable=True)
    http_method = Column(String, nullable=True)
    response_code = Column(Integer, nullable=True)
    severity = Column(String, nullable=False, default="INFO", index=True)
    is_system_action = Column(Boolean, nullable=False, default=False)

    # Legacy compatibility fields (do not remove yet)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    old_state = Column(String, nullable=True)
    new_state = Column(String, nullable=True)
    details = Column(JSON, nullable=True)

    # Relationships
    user = relationship("User")


def _populate_audit_ua_fields(target: "AuditLog") -> None:
    ua = str(getattr(target, "user_agent", "") or "").strip()
    if not ua:
        return

    parsed = parse_user_agent(ua)
    if not getattr(target, "device", None):
        target.device = parsed.get("device")
    if not getattr(target, "browser", None):
        target.browser = parsed.get("browser")
    if not getattr(target, "os", None):
        target.os = parsed.get("os")


@event.listens_for(AuditLog, "before_insert")
def _audit_log_before_insert(_mapper, _connection, target: "AuditLog") -> None:
    _populate_audit_ua_fields(target)


@event.listens_for(AuditLog, "before_update")
def _audit_log_before_update(_mapper, _connection, target: "AuditLog") -> None:
    _populate_audit_ua_fields(target)


# ============================================================
# CALL FEEDBACK SYSTEM (Recruiter feedback after candidate calls)
# ============================================================
class CallFeedback(Base):
    __tablename__ = "call_feedbacks"

    id = Column(String, primary_key=True, default=generate_uuid)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=False)

    # =========================
    # Call Metadata
    # =========================
    call_type = Column(String, nullable=False)  # Initial Screening, HR Round, Technical Discussion, Follow-up
    call_date = Column(DateTime, nullable=False)
    call_duration = Column(Integer, nullable=True)  # in minutes
    call_mode = Column(String, nullable=False)  # Phone, Google Meet, Zoom, WhatsApp

    # =========================
    # Structured Evaluation (Star Ratings 1-5)
    # =========================
    ratings = Column(JSON, nullable=False)  # { "communication": 4, "technical_fit": 3, "experience_relevance": 4, "culture_fit": 5 }
    salary_alignment = Column(String, nullable=False)  # Yes, No, Negotiable

    # =========================
    # Recruiter Notes
    # =========================
    strengths = Column(Text, nullable=True)
    concerns = Column(Text, nullable=True)
    additional_notes = Column(Text, nullable=True)

    # =========================
    # Candidate Intent & Decision
    # =========================
    candidate_intent = Column(String, nullable=True)  # Actively looking, Passive, Offer in hand, Just exploring
    decision = Column(String, nullable=False)  # Proceed to Next Round, Hold / Revisit Later, Reject, Needs Another Call
    rejection_reason = Column(String, nullable=True)  # Skill mismatch, Salary mismatch, Experience mismatch, Not interested, No show
    
    # =========================
    # Next Actions
    # =========================
    next_actions = Column(JSON, nullable=True)  # ["Schedule technical interview", "Set follow-up reminder", "Assign interviewer"]
    
    # =========================
    # Metadata
    # =========================
    is_draft = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="call_feedbacks")
    recruiter = relationship("User")


# ============================================================
# USER PROFILE & SETTINGS MODULE TABLES
# ============================================================
class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True)
    email_notifications = Column(Boolean, default=True)
    sms_alerts = Column(Boolean, default=False)
    report_emails = Column(Boolean, default=True)
    interview_reminders = Column(Boolean, default=True)
    two_factor_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PasswordResetLog(Base):
    __tablename__ = "password_reset_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    reset_count = Column(Integer, default=0)
    last_reset_date = Column(DateTime)
    is_locked = Column(Boolean, default=False)
    request_reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AccountActivityLog(Base):
    __tablename__ = "account_activity_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    action_type = Column(String, nullable=False)
    ip_address = Column(String, nullable=True)
    device_info = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


# ============================================================
# RESDEX - Saved Searches & Folders
# ============================================================

class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    folder_id = Column(String, ForeignKey("folders.id"), nullable=True)

    # New ATS filters storage
    filters = Column(JSON, nullable=True)
    result_count = Column(Integer, default=0)
    
    # Search query parameters
    query = Column(String, nullable=False)  # The search keyword
    logic = Column(String, default="OR")  # AND or OR
    min_exp = Column(Float, nullable=True)
    max_exp = Column(Float, nullable=True)
    location = Column(String, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    folder = relationship("Folder", back_populates="saved_searches")
    user = relationship("User")


class Folder(Base):
    __tablename__ = "folders"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    description = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    saved_searches = relationship("SavedSearch", back_populates="folder", cascade="all, delete-orphan")
    user = relationship("User")


class CandidateInvite(Base):
    __tablename__ = "candidate_invites"

    id = Column(String, primary_key=True, default=generate_uuid)
    candidate_id = Column(String, ForeignKey("candidates.id"), nullable=False)
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=False)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=True)
    
    # Status tracking
    status = Column(String, default="sent")  # sent, opened, accepted, declined
    message = Column(Text, nullable=True)
    
    # Metadata
    sent_at = Column(DateTime, default=datetime.utcnow)
    opened_at = Column(DateTime, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    response = Column(String, nullable=True)  # accepted or declined
    
    # Relationships
    candidate = relationship("Candidate")
    recruiter = relationship("User")
    job = relationship("Job")


# ============================================================
# ACTIVITY TRACKING SYSTEM
# ============================================================
class ActivityLog(Base):
    """
    Unified activity feed table used by Admin, AM, Recruiter and Candidate views.
    """
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=generate_uuid)

    actor_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_name = Column(String(255), nullable=True)
    actor_role = Column(String(50), nullable=False, default="system", index=True)
    actor_avatar = Column(String(500), nullable=True)

    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(80), nullable=False, index=True)
    resource_id = Column(String(255), nullable=True, index=True)
    resource_name = Column(String(500), nullable=True)

    target_user_id = Column(String, nullable=True, index=True)
    job_id = Column(String, nullable=True, index=True)
    client_id = Column(String, nullable=True, index=True)
    recruiter_id = Column(String, nullable=True, index=True)

    old_status = Column(String(100), nullable=True)
    new_status = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    activity_metadata = Column("metadata", JSON, nullable=True)
    is_visible_to_candidate = Column(Boolean, nullable=False, default=False, index=True)
    ip_address = Column(String(45), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    actor = relationship("User", foreign_keys=[actor_id], viewonly=True)


class Activity(Base):
    """
    Tracks meaningful actions across the ATS system.
    Used to provide 'Last Activity' indicators for Jobs, Candidates, and Applications.
    """
    __tablename__ = "activities"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    
    # Entity being acted upon
    entity_type = Column(String(50), nullable=False, index=True)  # 'job', 'candidate', 'application'
    entity_id = Column(String, nullable=False, index=True)
    
    # Activity details
    activity_type = Column(String(100), nullable=False)  # 'Job Created', 'Candidate Applied', etc.
    description = Column(Text, nullable=True)  # Human-readable description
    
    # Actor information
    actor_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_role = Column(String(50), nullable=True)  # admin, recruiter, candidate, system
    
    # Additional context
    activity_metadata = Column(JSON, nullable=True)  # Store extra details as needed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, nullable=True)
    
    # Relationships
    actor = relationship("User", foreign_keys=[actor_id])
    
    def __repr__(self):
        return f"<Activity({self.activity_type} on {self.entity_type}:{self.entity_id})>"


# =====================================================================
# JOB CREATION & JOB POSTING MODELS
# =====================================================================

class JobStatus(str, enum.Enum):
    """Job status enumeration"""
    open = "open"
    in_progress = "in_progress"
    closed = "closed"
    on_hold = "on_hold"


class JobMode(str, enum.Enum):
    """Job work mode enumeration"""
    hybrid = "hybrid"
    remote = "remote"
    onsite = "onsite"
    contract = "contract"


class JobPostingStatus(str, enum.Enum):
    """Job posting status enumeration"""
    draft = "draft"
    active = "active"
    expired = "expired"


class AssignmentStatus(str, enum.Enum):
    """Job assignment status enumeration"""
    active = "active"
    completed = "completed"
    reassigned = "reassigned"


class JobAssignment(Base):
    """Tracks which recruiter is assigned to which job"""
    __tablename__ = "job_assignments"

    id = Column(String, primary_key=True, default=generate_uuid)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False, index=True)
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    assigned_by = Column(String, ForeignKey("users.id"), nullable=False)  # AM or self
    am_notes = Column(Text, nullable=True)  # AM's instructions to recruiter
    
    status = Column(Enum(AssignmentStatus, name="assignment_status"), default=AssignmentStatus.active, nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    job = relationship("Job", back_populates="job_assignments")
    recruiter = relationship("User", foreign_keys=[recruiter_id], viewonly=True)
    assigned_by_user = relationship("User", foreign_keys=[assigned_by], viewonly=True)


class JobPosting(Base):
    """Simplified external-facing job posting for candidates"""
    __tablename__ = "job_postings"

    id = Column(String, primary_key=True, default=generate_uuid)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=True)  # Can be standalone or linked
    
    # Display information
    title = Column(String, nullable=False)
    client_display_name = Column(String, nullable=False)
    jd_content = Column(Text, nullable=False)
    
    # Details (no internal fields)
    ctc = Column(String, nullable=False)
    location = Column(String, nullable=False)
    mode = Column(Enum(JobMode, name="job_mode_posting"), nullable=False)
    experience_required = Column(String, nullable=False)
    skills = Column(JSON, default=list, nullable=False)
    last_date_to_apply = Column(Date, nullable=False)
    
    # Status
    status = Column(Enum(JobPostingStatus, name="job_posting_status"), default=JobPostingStatus.draft, nullable=False)
    
    # Audit
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    job = relationship("Job", back_populates="job_postings")
    creator = relationship("User", foreign_keys=[created_by], viewonly=True)


class CandidateSendTemplate(Base):
    """Saved template for which fields to send to candidate"""
    __tablename__ = "candidate_send_templates"

    id = Column(String, primary_key=True, default=generate_uuid)
    job_id = Column(String, ForeignKey("jobs.id"), nullable=False, index=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)  # Recruiter
    
    template_name = Column(String, nullable=False)
    visible_fields = Column(JSON, default=list, nullable=False)  # Array of field keys to include
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    job = relationship("Job", viewonly=True)
    creator = relationship("User", foreign_keys=[created_by], viewonly=True)


# Activity type constants
class ActivityType:
    """Standard activity types for consistent tracking"""
    
    # Job activities
    JOB_CREATED = "Job Created"
    JOB_UPDATED = "Job Updated"
    JOB_PUBLISHED = "Job Published"
    JOB_UNPUBLISHED = "Job Unpublished"
    JOB_PAUSED = "Job Paused"
    JOB_REOPENED = "Job Reopened"
    JOB_CLOSED = "Job Closed"
    JOB_RECRUITER_ASSIGNED = "Recruiter Assigned"
    
    # Candidate activities
    CANDIDATE_CREATED = "Candidate Added"
    CANDIDATE_APPLIED = "Candidate Applied"
    CANDIDATE_UPDATED = "Profile Updated"
    CANDIDATE_RESUME_UPLOADED = "Resume Uploaded"
    CANDIDATE_STATUS_CHANGED = "Status Changed"
    CANDIDATE_EMAIL_SENT = "Email Sent"
    CANDIDATE_EMAIL_RECEIVED = "Email Received"
    CANDIDATE_INVITED = "Candidate Invited"
    
    # Application activities
    APPLICATION_CREATED = "Application Created"
    APPLICATION_STATUS_CHANGED = "Application Status Changed"
    APPLICATION_SHORTLISTED = "Application Shortlisted"
    APPLICATION_REJECTED = "Application Rejected"
    APPLICATION_WITHDRAWN = "Application Withdrawn"
    
    # Interview activities
    INTERVIEW_SCHEDULED = "Interview Scheduled"
    INTERVIEW_RESCHEDULED = "Interview Rescheduled"
    INTERVIEW_CANCELLED = "Interview Cancelled"
    INTERVIEW_COMPLETED = "Interview Completed"
    INTERVIEW_FEEDBACK_SUBMITTED = "Interview Feedback Submitted"
    
    # Offer activities
    OFFER_CREATED = "Offer Created"
    OFFER_SENT = "Offer Sent"
    OFFER_ACCEPTED = "Offer Accepted"
    OFFER_REJECTED = "Offer Rejected"
    OFFER_WITHDRAWN = "Offer Withdrawn"
    
    # System activities
    VENDOR_SUBMISSION = "Vendor Submission"
    RESUME_PARSED = "Resume Parsed"
    BULK_UPLOAD = "Bulk Upload"


class TrackerSubmission(Base):
    __tablename__ = "tracker_submissions"

    id = Column(String, primary_key=True, default=generate_uuid)
    serial_no = Column(Integer, nullable=True)
    submission_date = Column(Date, nullable=True, index=True)
    client_id = Column(String, ForeignKey("users.id"), nullable=True)
    client_name = Column(String(255), nullable=False, index=True)
    requirement_no = Column(String(100), nullable=True)
    spoc_name = Column(String(255), nullable=True)
    am_id = Column(String, ForeignKey("users.id"), nullable=True)
    am_name = Column(String(255), nullable=True, index=True)
    recruiter_id = Column(String, ForeignKey("users.id"), nullable=True)
    recruiter_name = Column(String(255), nullable=True, index=True)
    candidate_name = Column(String(255), nullable=False, index=True)
    tech_stack = Column(String(255), nullable=True)
    skill = Column(String(255), nullable=True, index=True)
    contact_no = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    pan_no = Column(String(50), nullable=True)
    total_experience = Column(String(50), nullable=True)
    relevant_exp = Column(String(50), nullable=True)
    current_location = Column(String(255), nullable=True)
    preferred_location = Column(String(255), nullable=True)
    current_ctc = Column(String(100), nullable=True)
    expected_ctc = Column(String(100), nullable=True)
    notice_period = Column(String(100), nullable=True)
    status = Column(String(100), nullable=False, index=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class TrackerSelection(Base):
    __tablename__ = "tracker_selections"

    id = Column(String, primary_key=True, default=generate_uuid)
    client_name = Column(String(255), nullable=False, index=True)
    am_name = Column(String(255), nullable=True, index=True)
    recruiter_name = Column(String(255), nullable=True, index=True)
    candidate_name = Column(String(255), nullable=False, index=True)
    skill_set = Column(String(255), nullable=True, index=True)
    contact_no = Column(String(50), nullable=True)
    date_of_joining = Column(Date, nullable=True, index=True)
    billing_per_day = Column(Float, nullable=True)
    ctc_per_month = Column(Float, nullable=True)
    gp_value = Column(Float, nullable=True)
    gp_percent = Column(Float, nullable=True)
    location = Column(String(255), nullable=True)
    ta = Column(String(100), nullable=True)
    ecms_no = Column(String(100), nullable=True)
    status = Column(String(100), nullable=True, index=True)
    po_no = Column(String(100), nullable=True)
    po_location = Column(String(255), nullable=True)
    account = Column(String(255), nullable=True)
    bgv_with = Column(String(255), nullable=True)
    bgv_type = Column(String(100), nullable=True)
    bgv_initiated_dt = Column(Date, nullable=True)
    bgv_interim_dt = Column(Date, nullable=True)
    bgv_final_dt = Column(Date, nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class TrackerChannelPartner(Base):
    __tablename__ = "tracker_channel_partners"

    id = Column(String, primary_key=True, default=generate_uuid)
    cp_name = Column(String(255), nullable=False, index=True)
    ecms_team = Column(String(255), nullable=True)
    candidate_name = Column(String(255), nullable=False, index=True)
    ecms_no = Column(String(100), nullable=True)
    skill_set = Column(String(255), nullable=True, index=True)
    contact_no = Column(String(50), nullable=True)
    date_of_joining = Column(Date, nullable=True, index=True)
    cp_billing = Column(Float, nullable=True)
    routing_fee = Column(Float, nullable=True)
    infy_billing = Column(Float, nullable=True)
    status = Column(String(100), nullable=True, index=True)
    po_no = Column(String(100), nullable=True)
    po_location = Column(String(255), nullable=True)
    account = Column(String(255), nullable=True)
    cp_po_no = Column(String(100), nullable=True)
    bgv_with = Column(String(255), nullable=True)
    bgv_type = Column(String(100), nullable=True)
    bgv_interim_dt = Column(Date, nullable=True)
    bgv_final_dt = Column(Date, nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class TrackerClientInvoice(Base):
    __tablename__ = "tracker_client_invoices"

    id = Column(String, primary_key=True, default=generate_uuid)
    client_name = Column(String(255), nullable=False, index=True)
    service_month = Column(String(50), nullable=True, index=True)
    candidate_name = Column(String(255), nullable=False, index=True)
    po_no = Column(String(100), nullable=True)
    invoice_no = Column(String(100), nullable=True, index=True)
    invoice_date = Column(Date, nullable=True, index=True)
    invoice_value = Column(Float, nullable=True)
    gst_amount = Column(Float, nullable=True)
    total_inv_value = Column(Float, nullable=True)
    status = Column(String(100), nullable=True, index=True)
    payment_date = Column(Date, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)


class TrackerCPInvoice(Base):
    __tablename__ = "tracker_cp_invoices"

    id = Column(String, primary_key=True, default=generate_uuid)
    cp_name = Column(String(255), nullable=False, index=True)
    candidate_name = Column(String(255), nullable=False, index=True)
    service_month = Column(String(50), nullable=True, index=True)
    client_inv_no = Column(String(100), nullable=True, index=True)
    client_inv_date = Column(Date, nullable=True, index=True)
    client_inv_value = Column(Float, nullable=True)
    client_payment_dt = Column(Date, nullable=True)
    cp_inv_no = Column(String(100), nullable=True, index=True)
    cp_inv_date = Column(Date, nullable=True, index=True)
    cp_inv_value = Column(Float, nullable=True)
    cp_payment_status = Column(String(100), nullable=True, index=True)
    remarks = Column(Text, nullable=True)
    gst_status = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

"""
Job Creation & Job Posting Routes
Handle internal job requirements and external job postings
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel
import app.models as models
from app.db import get_db
from app.auth import get_current_user
from app.permissions import require_permission
import tempfile
import os
import re

router = APIRouter(prefix="/v1/job-management", tags=["Job Management"])

# ============================================================
# SCHEMAS
# ============================================================

class JobCreateRequest(BaseModel):
    date_created: date
    client_id: Optional[str] = None
    client_name: Optional[str] = None  # Store client name directly
    client_ta: Optional[str] = None
    job_title: str
    mode: str  # remote, hybrid, onsite
    skills: List[str]
    jd_text: str
    experience: Optional[str] = None
    experience_min: Optional[int] = None
    experience_max: Optional[int] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    no_of_positions: Optional[int] = 1
    budget: Optional[str] = None
    ctc_currency: Optional[str] = None
    ctc_min: Optional[float] = None
    ctc_max: Optional[float] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    work_timings: Optional[str] = None
    joining_preference: Optional[str] = None
    recruiter_ids: Optional[List[str]] = None  # For AM assigning recruiters
    am_notes: Optional[List[str]] = None  # Notes per recruiter
    status: Optional[str] = "open"


class JobUpdateRequest(BaseModel):
    date_created: Optional[date] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    client_ta: Optional[str] = None
    job_title: Optional[str] = None
    mode: Optional[str] = None
    skills: Optional[List[str]] = None
    jd_text: Optional[str] = None
    experience: Optional[str] = None
    experience_min: Optional[int] = None
    experience_max: Optional[int] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    no_of_positions: Optional[int] = None
    budget: Optional[str] = None
    ctc_currency: Optional[str] = None
    ctc_min: Optional[float] = None
    ctc_max: Optional[float] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    work_timings: Optional[str] = None
    joining_preference: Optional[str] = None
    recruiter_ids: Optional[List[str]] = None
    am_notes: Optional[List[str]] = None
    status: Optional[str] = None


class JobAssignmentRequest(BaseModel):
    recruiter_ids: List[str]
    am_notes: Optional[List[str]] = None  # One note per recruiter


class JobPostingRequest(BaseModel):
    job_id: Optional[str] = None
    title: str
    client_display_name: str
    jd_content: str
    ctc: str
    location: str
    mode: str
    experience_required: str
    skills: List[str]
    last_date_to_apply: date


class CandidateSendTemplateRequest(BaseModel):
    template_name: str
    visible_fields: List[str]


# ============================================================
# VALIDATION HELPERS
# ============================================================

MODE_CANONICAL = {
    "remote": "remote",
    "hybrid": "hybrid",
    "onsite": "onsite",
    "on-site": "onsite",
    "on site": "onsite",
}

DURATION_CANONICAL = {
    "3 months": "3 Months",
    "6 months": "6 Months",
    "12 months": "12 Months",
    "full-time": "Full-Time",
    "full time": "Full-Time",
}

JOINING_CANONICAL = {
    "immediate": "Immediate",
    "15 days": "15 Days",
    "30 days": "30 Days",
    "negotiable": "Negotiable",
}

CURRENCY_ALLOWED = {"INR", "USD", "EUR", "GBP", "AUD"}
TITLE_EXCEPTIONS = {
    "AI",
    "API",
    "AWS",
    "BA",
    "BI",
    "BPO",
    "CRM",
    "ERP",
    "ETL",
    "GCP",
    "HR",
    "HRMS",
    "IT",
    "L2",
    "L3",
    "ML",
    "PM",
    "PMO",
    "QA",
    "REST",
    "SAP",
    "SRE",
    "SQL",
    "UI",
    "UX",
}

EMOJI_REGEX = re.compile(r"[\U0001F300-\U0001FAFF\U00002700-\U000027BF]")
JOB_TITLE_REGEX = re.compile(r"^[A-Za-z0-9 ]+$")
CLIENT_TA_CONTACT_REGEX = re.compile(r"^[A-Za-z0-9@.+\-()' ]+$")
LOCATION_REGEX = re.compile(r"^[A-Za-z0-9,\- ]+$")
SKILL_REGEX = re.compile(r"^[A-Za-z0-9+.#/\- ]+$")


def _normalize_spaces(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _has_emoji(value: str) -> bool:
    if not value:
        return False
    return bool(EMOJI_REGEX.search(value))


def _looks_like_contact_value(value: str) -> bool:
    if not value:
        return False
    return bool(re.search(r"[@+\d]", value))


def _is_acronym_token(token: str) -> bool:
    if not token:
        return False
    cleaned = re.sub(r"[^A-Za-z0-9]", "", token)
    if not cleaned:
        return False
    if cleaned.upper() in TITLE_EXCEPTIONS:
        return True
    if re.search(r"\d", cleaned):
        return True
    if re.fullmatch(r"[A-Z]{2,4}", token):
        return True
    return False


def _title_case_word(word: str) -> str:
    if not word:
        return ""
    upper_word = word.upper()
    if _is_acronym_token(word):
        return upper_word

    if re.fullmatch(r"[A-Za-z]+", word):
        return word[0].upper() + word[1:].lower()

    parts = re.split(r"([.+#/\-])", word)
    normalized_parts: List[str] = []
    for part in parts:
        if not part or re.fullmatch(r"[.+#/\-]", part):
            normalized_parts.append(part)
            continue
        if _is_acronym_token(part):
            normalized_parts.append(part.upper())
        else:
            normalized_parts.append(part[0].upper() + part[1:].lower())
    return "".join(normalized_parts)


def _to_title_case(value: str) -> str:
    normalized = _normalize_spaces(value)
    if not normalized:
        return ""
    return " ".join(_title_case_word(word) for word in normalized.split(" "))


def _is_title_case(value: str) -> bool:
    normalized = _normalize_spaces(value)
    if not normalized:
        return False
    return normalized == _to_title_case(normalized)


def _normalize_choice(raw_value: Any, mapping: Dict[str, str]) -> Optional[str]:
    normalized = _normalize_spaces(raw_value).lower()
    if not normalized:
        return None
    return mapping.get(normalized)


def _coerce_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_float(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_model_payload(model: BaseModel, exclude_unset: bool = False) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=exclude_unset)
    return model.dict(exclude_unset=exclude_unset)


def _validation_http_error(
    errors: Dict[str, str],
    warnings: Optional[List[str]] = None,
    status_code: int = 422,
    message: str = "Validation failed",
) -> HTTPException:
    detail: Dict[str, Any] = {"message": message, "errors": errors}
    if warnings:
        detail["warnings"] = warnings
    return HTTPException(status_code=status_code, detail=detail)


def _resolve_client(
    db: Session,
    client_id: str,
    client_name: str,
    auto_create: bool = False,
    creator_user_id: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str]]:
    normalized_id = _normalize_spaces(client_id)
    normalized_name = _normalize_spaces(client_name)

    client_record = None
    if normalized_id:
        client_record = (
            db.query(models.Client)
            .filter(models.Client.id == normalized_id)
            .first()
        )

    if not client_record and normalized_name:
        client_record = (
            db.query(models.Client)
            .filter(func.lower(models.Client.client_name) == normalized_name.lower())
            .first()
        )

    if client_record:
        return str(client_record.id), _normalize_spaces(client_record.client_name)

    conditions = []
    if normalized_id:
        conditions.append(models.Job.client_id == normalized_id)
    if normalized_name:
        conditions.append(
            func.lower(func.coalesce(models.Job.client_name, "")) == normalized_name.lower()
        )

    if conditions:
        existing_job_client = (
            db.query(models.Job.client_id, models.Job.client_name)
            .filter(or_(*conditions))
            .first()
        )
        if existing_job_client:
            resolved_id = _normalize_spaces(existing_job_client[0]) or normalized_id
            resolved_name = _normalize_spaces(existing_job_client[1]) or normalized_name
            return resolved_id, resolved_name

    if auto_create and normalized_name:
        created_client = models.Client(
            client_name=_to_title_case(normalized_name),
            status="active",
            created_by=creator_user_id,
            am_id=creator_user_id,
        )
        db.add(created_client)
        db.flush()
        return str(created_client.id), _normalize_spaces(created_client.client_name)

    return None, None


def _parse_work_timings(
    work_start_time: Any,
    work_end_time: Any,
    work_timings: Any,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    start_time = _normalize_spaces(work_start_time)
    end_time = _normalize_spaces(work_end_time)
    timings_text = _normalize_spaces(work_timings)

    if not start_time and not end_time and timings_text:
        direct_match = re.match(
            r"^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$",
            timings_text,
        )
        if direct_match:
            start_time = f"{direct_match.group(1)}:{direct_match.group(2)}"
            end_time = f"{direct_match.group(3)}:{direct_match.group(4)}"

    if not start_time and not end_time:
        return None, None, None

    if (start_time and not end_time) or (end_time and not start_time):
        return None, None, "Select both start and end time"

    time_pattern = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
    if not time_pattern.match(start_time or "") or not time_pattern.match(end_time or ""):
        return None, None, "Start and End times must be in HH:MM format"

    if start_time >= end_time:
        return None, None, "Start time must be earlier than end time"

    return start_time, end_time, f"{start_time} - {end_time}"


def _validate_and_normalize_job_payload(
    payload: Dict[str, Any],
    db: Session,
    editing_job_id: Optional[str] = None,
    allow_create_client: bool = False,
    creator_user_id: Optional[str] = None,
) -> Tuple[Dict[str, Any], List[str]]:
    errors: Dict[str, str] = {}
    warnings: List[str] = []
    duplicate_detected = False
    normalized: Dict[str, Any] = {}

    title = _normalize_spaces(payload.get("job_title"))
    if (
        not title
        or len(title) < 3
        or len(title) > 80
        or not JOB_TITLE_REGEX.fullmatch(title)
        or title.isdigit()
        or _has_emoji(title)
    ):
        errors["title"] = (
            "Enter a valid job title (e.g., Senior React Developer)"
        )
    else:
        normalized["job_title"] = _to_title_case(title)

    resolved_mode = _normalize_choice(payload.get("mode"), MODE_CANONICAL)
    if not resolved_mode:
        errors["mode"] = "Mode must be Remote, Hybrid, or Onsite"
    else:
        normalized["mode"] = resolved_mode

    client_id = _normalize_spaces(payload.get("client_id"))
    client_name = _normalize_spaces(payload.get("client_name"))
    if not client_id and not client_name:
        errors["client_id"] = "Please select a client from the dropdown"
    else:
        resolved_client_id, resolved_client_name = _resolve_client(
            db,
            client_id,
            client_name,
            auto_create=allow_create_client,
            creator_user_id=creator_user_id,
        )
        if not resolved_client_id:
            errors["client_id"] = "Selected client does not exist in database"
        else:
            normalized["client_id"] = resolved_client_id
            normalized["client_name"] = resolved_client_name or client_name

    client_ta = _normalize_spaces(payload.get("client_ta"))
    if client_ta:
        is_contact_format = _looks_like_contact_value(client_ta)
        if (
            len(client_ta) < 2
            or len(client_ta) > 60
            or not CLIENT_TA_CONTACT_REGEX.fullmatch(client_ta)
            or _has_emoji(client_ta)
        ):
            errors["client_ta"] = (
                "Client TA must be 2-60 characters (name in Title Case or valid contact details)"
            )
        elif not is_contact_format and not _is_title_case(client_ta):
            errors["client_ta"] = (
                "Client TA name must be in Title Case (e.g., John Smith)"
            )
        else:
            normalized["client_ta"] = (
                client_ta if is_contact_format else _to_title_case(client_ta)
            )
    else:
        normalized["client_ta"] = None

    exp_min = _coerce_int(payload.get("experience_min"))
    exp_max = _coerce_int(payload.get("experience_max"))
    if exp_min is None or exp_max is None:
        raw_experience = _normalize_spaces(payload.get("experience"))
        numbers = re.findall(r"\d+", raw_experience) if raw_experience else []
        if exp_min is None and numbers:
            exp_min = _coerce_int(numbers[0])
        if exp_max is None:
            if len(numbers) > 1:
                exp_max = _coerce_int(numbers[1])
            elif numbers:
                exp_max = _coerce_int(numbers[0])

    if (
        exp_min is None
        or exp_max is None
        or exp_min < 0
        or exp_max > 30
        or exp_min > exp_max
    ):
        errors["experience"] = "Experience must be between 0 and 30 years"
    else:
        normalized["experience_min"] = exp_min
        normalized["experience_max"] = exp_max
        normalized["experience"] = f"{exp_min}-{exp_max}"

    location = _normalize_spaces(payload.get("location"))
    if normalized.get("mode") == "remote":
        normalized["location"] = "Remote"
    else:
        if not location:
            errors["location"] = "Location is required for Hybrid and Onsite jobs"
        elif (
            len(location) < 2
            or len(location) > 100
            or not LOCATION_REGEX.fullmatch(location)
            or _has_emoji(location)
            or not _is_title_case(location)
        ):
            errors["location"] = (
                "Location must be 2-100 characters in Title Case (letters, numbers, commas, hyphens only)"
            )
        else:
            normalized["location"] = _to_title_case(location)

    duration = _normalize_choice(payload.get("duration"), DURATION_CANONICAL)
    if payload.get("duration") and not duration:
        errors["duration"] = "Duration must be one of: 3 Months, 6 Months, 12 Months, Full-Time"
    normalized["duration"] = duration

    positions = _coerce_int(payload.get("no_of_positions"))
    if positions is None or positions < 1 or positions > 500:
        errors["no_of_positions"] = "Number of positions must be between 1 and 500"
    else:
        normalized["no_of_positions"] = positions

    ctc_min = _coerce_float(payload.get("ctc_min"))
    ctc_max = _coerce_float(payload.get("ctc_max"))
    ctc_currency = _normalize_spaces(payload.get("ctc_currency")).upper() or "INR"
    has_ctc_range = ctc_min is not None or ctc_max is not None
    if has_ctc_range:
        if ctc_min is None or ctc_max is None:
            errors["ctc_range"] = "Enter both Min CTC and Max CTC"
        elif ctc_min < 0 or ctc_max < 0:
            errors["ctc_range"] = "CTC values cannot be negative"
        elif ctc_min > ctc_max:
            errors["ctc_range"] = "Min CTC cannot be greater than Max CTC"
        elif ctc_currency not in CURRENCY_ALLOWED:
            errors["ctc_range"] = "Unsupported currency selected"
        else:
            normalized["ctc_currency"] = ctc_currency
            normalized["ctc_min"] = ctc_min
            normalized["ctc_max"] = ctc_max
            normalized["budget"] = f"{ctc_currency} {ctc_min:g} - {ctc_max:g}"
            if ctc_min > 0 and (ctc_max / ctc_min > 8 or ctc_max > 100000000):
                warnings.append(
                    "Salary range appears unusually wide. Please verify budget values."
                )
    else:
        normalized["ctc_currency"] = None
        normalized["ctc_min"] = None
        normalized["ctc_max"] = None
        normalized["budget"] = _normalize_spaces(payload.get("budget"))

    start_time, end_time, timings_result = _parse_work_timings(
        payload.get("work_start_time"),
        payload.get("work_end_time"),
        payload.get("work_timings"),
    )
    timing_inputs_present = bool(
        payload.get("work_start_time")
        or payload.get("work_end_time")
        or payload.get("work_timings")
    )
    if timing_inputs_present:
        if not timings_result or " - " not in timings_result:
            errors["work_timings"] = timings_result or "Select valid work timings"
        else:
            normalized["work_start_time"] = start_time
            normalized["work_end_time"] = end_time
            normalized["work_timings"] = timings_result
    else:
        normalized["work_start_time"] = None
        normalized["work_end_time"] = None
        normalized["work_timings"] = None

    joining_preference = _normalize_choice(
        payload.get("joining_preference"),
        JOINING_CANONICAL,
    )
    if payload.get("joining_preference") and not joining_preference:
        errors["joining_preference"] = (
            "Joining Preference must be one of: Immediate, 15 Days, 30 Days, Negotiable"
        )
    normalized["joining_preference"] = joining_preference

    raw_skills = payload.get("skills") if isinstance(payload.get("skills"), list) else []
    cleaned_skills: List[str] = []
    seen_skills = set()
    if len(raw_skills) < 1 or len(raw_skills) > 30:
        errors["skills"] = "Add at least one valid skill"
    else:
        for raw_skill in raw_skills:
            skill = _to_title_case(_normalize_spaces(raw_skill))
            if (
                not skill
                or len(skill) < 2
                or len(skill) > 30
                or not SKILL_REGEX.fullmatch(skill)
                or _has_emoji(skill)
                or not _is_title_case(skill)
            ):
                errors["skills"] = "Add at least one valid skill"
                break
            key = skill.lower()
            if key in seen_skills:
                errors["skills"] = "Duplicate skills are not allowed"
                break
            seen_skills.add(key)
            cleaned_skills.append(skill)
    normalized["skills"] = cleaned_skills

    jd_text = _normalize_text(payload.get("jd_text"))
    if not jd_text:
        errors["jd_text"] = "Job description is required"
    elif _has_emoji(jd_text):
        errors["jd_text"] = "Emojis are not allowed in Job Description"
    normalized["jd_text"] = jd_text

    notes = payload.get("am_notes")
    note_text = ""
    if isinstance(notes, list) and notes:
        note_text = _normalize_text(notes[0])
    elif isinstance(notes, str):
        note_text = _normalize_text(notes)
    if note_text and _has_emoji(note_text):
        errors["notes_for_recruiter"] = "Emojis are not allowed in recruiter notes"
    normalized["am_note"] = note_text or None

    recruiters = payload.get("recruiter_ids")
    if isinstance(recruiters, list):
        normalized["recruiter_ids"] = [str(rid).strip() for rid in recruiters if str(rid).strip()]
    else:
        normalized["recruiter_ids"] = []

    status_value = _normalize_spaces(payload.get("status")).lower() or "open"
    if status_value not in {"open", "active", "in_progress", "closed", "draft"}:
        errors["status"] = "Invalid status value"
    normalized["status"] = status_value

    if (
        "title" not in errors
        and "client_id" not in errors
        and normalized.get("job_title")
        and normalized.get("client_id")
    ):
        duplicate_query = db.query(models.Job).filter(
            func.lower(models.Job.title) == normalized["job_title"].lower(),
            models.Job.client_id == normalized["client_id"],
        )
        if editing_job_id:
            duplicate_query = duplicate_query.filter(models.Job.id != editing_job_id)

        if duplicate_query.first():
            duplicate_detected = True
            errors["title"] = "Duplicate job detected: same Client and Job Title already exists"

    if errors:
        status_code = 409 if duplicate_detected and len(errors) == 1 else 422
        raise _validation_http_error(
            errors=errors,
            warnings=warnings,
            status_code=status_code,
            message="Job validation failed",
        )

    return normalized, warnings


# ============================================================
# JOB CRUD ENDPOINTS
# ============================================================

@router.get("/requirements")
def get_requirements(
    skip: int = Query(0),
    limit: int = Query(20),
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    recruiter_id: Optional[str] = None,
    mode: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all jobs/requirements. Filters apply based on user role.
    - AM: sees all jobs
    - Recruiter: sees all open/in_progress jobs + assigned jobs
    """
    query = db.query(models.Job)
    
    # Apply filters
    if client_id:
        query = query.filter(models.Job.client_id == client_id)
    if status:
        query = query.filter(models.Job.status == status)
    if mode:
        query = query.filter(models.Job.mode == mode)
    
    # Role-based filtering
    user_id = current_user.get("id")
    user_role = current_user.get("role")  # admin, account_manager, recruiter
    
    if user_role == "recruiter":
        # Recruiters see: assigned jobs + open/in_progress unassigned jobs
        assigned_jobs = db.query(models.JobAssignment.job_id).filter(
            models.JobAssignment.recruiter_id == user_id,
            models.JobAssignment.status == "active"
        ).subquery()
        
        query = query.filter(
            or_(
                models.Job.id.in_(assigned_jobs),
                and_(
                    models.Job.status.in_(["open", "in_progress"]),
                    ~models.Job.id.in_(assigned_jobs)
                )
            )
        )
    
    if recruiter_id and user_role != "recruiter":  # AM filter by recruiter
        assigned_jobs = db.query(models.JobAssignment.job_id).filter(
            models.JobAssignment.recruiter_id == recruiter_id
        ).subquery()
        query = query.filter(models.Job.id.in_(assigned_jobs))
    
    total = query.count()
    jobs = query.order_by(models.Job.created_at.desc()).offset(skip).limit(limit).all()
    
    # Serialize jobs with recruiters
    jobs_data = []
    for job in jobs:
        # Format experience as string
        exp_str = ""
        if job.min_experience is not None:
            exp_str = str(job.min_experience)
            if job.max_experience is not None:
                exp_str += f"-{job.max_experience}"
        
        job_dict = {
            "id": job.id,
            "job_id": job.job_id,
            "serial_number": job.serial_number,
            "title": job.title,
            "job_title": job.title,
            "company_name": job.company_name,
            "description": job.description,
            "skills": job.skills or [],
            "min_experience": job.min_experience,
            "max_experience": job.max_experience,
            "experience": exp_str,
            "location": job.location,
            "department": job.department,
            "job_type": job.job_type,
            "salary_range": job.salary_range,
            "apply_by": str(job.apply_by) if job.apply_by else None,
            "sla_days": job.sla_days,
            "created_by": job.created_by,
            "created_at": str(job.created_at) if job.created_at else None,
            "date_created": str(job.date_created) if job.date_created else None,
            "updated_at": str(job.updated_at) if job.updated_at else None,
            "status": job.status,
            "is_active": job.is_active,
            "jd_url": job.jd_url,
            "jd_text": job.jd_text,
            "client_id": job.client_id,
            "client_ta": job.client_ta,
            "mode": job.mode,
            "duration": job.duration,
            "no_of_positions": getattr(job, 'no_of_positions', None),
            "budget": getattr(job, 'budget', None),
            "work_timings": getattr(job, 'work_timings', None),
            "joining_preference": getattr(job, 'joining_preference', None),
            "account_manager_id": job.account_manager_id,
            # Include assigned recruiters
            "recruiters": [
                {
                    "id": r.id,
                    "name": r.full_name or r.email,
                    "full_name": r.full_name,
                    "email": r.email
                }
                for r in (job.recruiters or [])
            ]
        }
        # Get client name - first from job.client_name, then fallback to Client lookup
        if job.client_name:
            job_dict["client_name"] = job.client_name
        elif job.client_id:
            client = db.query(models.Client).filter(models.Client.id == job.client_id).first()
            if client:
                job_dict["client_name"] = client.client_name
        jobs_data.append(job_dict)
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "jobs": jobs_data
    }


@router.get("/requirements/{job_id}")
def get_requirement(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single job/requirement with all details and assignments"""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check authorization
    user_role = current_user.get("role")
    user_id = current_user.get("id")
    
    if user_role == "recruiter":
        # Recruiter can only access assigned jobs or open jobs
        is_assigned = db.query(models.JobAssignment).filter(
            models.JobAssignment.job_id == job_id,
            models.JobAssignment.recruiter_id == user_id,
            models.JobAssignment.status == "active"
        ).first()
        
        if not is_assigned and job.status not in ["open", "in_progress"]:
            raise HTTPException(status_code=403, detail="Access denied to this job")
    
    # Load assignments
    assignments = db.query(models.JobAssignment).filter(
        models.JobAssignment.job_id == job_id,
        models.JobAssignment.status == "active"
    ).all()
    
    return {
        "job": job,
        "assignments": assignments,
        "am_notes": [a.am_notes for a in assignments] if assignments else []
    }


@router.post("/requirements")
def create_requirement(
    data: JobCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new job/requirement.
    - AM can assign to multiple recruiters
    - Recruiter auto-assigns to self
    """
    user_id = current_user.get("id")
    user_role = current_user.get("role")

    incoming_payload = _extract_model_payload(data)
    normalized, warnings = _validate_and_normalize_job_payload(
        payload=incoming_payload,
        db=db,
        allow_create_client=True,
        creator_user_id=user_id,
    )

    requested_status = normalized.get("status", "open")
    if requested_status == "open":
        requested_status = "active"
    if requested_status not in {"active", "in_progress", "closed", "draft"}:
        requested_status = "active"

    # Create job with validated fields
    job = models.Job(
        title=normalized["job_title"],
        client_id=normalized.get("client_id"),
        client_name=normalized.get("client_name"),
        client_ta=normalized.get("client_ta"),
        skills=normalized.get("skills", []),
        description=normalized["jd_text"],
        jd_text=normalized["jd_text"],
        location=normalized.get("location"),
        mode=normalized.get("mode"),
        min_experience=normalized.get("experience_min"),
        max_experience=normalized.get("experience_max"),
        duration=normalized.get("duration"),
        no_of_positions=normalized.get("no_of_positions", 1),
        budget=normalized.get("budget"),
        salary_range=normalized.get("budget"),
        work_timings=normalized.get("work_timings"),
        joining_preference=normalized.get("joining_preference"),
        notes_for_recruiter=normalized.get("am_note"),
        date_created=data.date_created,
        status=requested_status,
        created_by=user_id,
    )

    db.add(job)
    db.flush()  # Get the job ID

    # Assign to recruiters
    recruiters_to_assign = normalized.get("recruiter_ids", [])

    if user_role == "recruiter" and user_id not in recruiters_to_assign:
        # Auto-assign recruiter to self
        recruiters_to_assign.append(user_id)

    # Create assignments
    notes_list = data.am_notes or [None] * len(recruiters_to_assign)
    for idx, recruiter_id in enumerate(recruiters_to_assign):
        assignment = models.JobAssignment(
            job_id=job.id,
            recruiter_id=recruiter_id,
            assigned_by=user_id,
            am_notes=notes_list[idx] if idx < len(notes_list) else None,
            status="active"
        )
        db.add(assignment)

    db.commit()
    db.refresh(job)

    return {
        "status": "created",
        "job_id": job.id,
        "serial_number": job.serial_number,
        "job": {
            "id": job.id,
            "serial_number": job.serial_number,
            "job_title": job.title,
            "client_id": job.client_id,
            "status": job.status,
            "created_at": job.created_at
        },
        "warnings": warnings,
        "message": f"Job '{job.title}' created successfully"
    }


@router.put("/requirements/{job_id}")
def update_requirement(
    job_id: str,
    data: JobUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a job/requirement (AM only, or recruiter on own jobs)"""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    user_id = current_user.get("id")
    user_role = current_user.get("role")
    
    # Authorization check
    if user_role == "recruiter" and job.created_by != user_id:
        raise HTTPException(status_code=403, detail="Can only edit your own jobs")

    incoming_patch = _extract_model_payload(data, exclude_unset=True)
    if not incoming_patch:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    # Status-only update path (used by close/reopen actions)
    if set(incoming_patch.keys()).issubset({"status"}):
        requested_status = _normalize_spaces(incoming_patch.get("status")).lower()
        if requested_status == "open":
            requested_status = "active"
        if requested_status not in {"active", "in_progress", "closed", "draft"}:
            raise _validation_http_error(
                errors={"status": "Invalid status value"},
                message="Job validation failed",
            )
        job.status = requested_status
        job.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return {
            "status": "updated",
            "job_id": job.id,
            "message": "Job status updated successfully",
        }

    existing_start_time, existing_end_time, _ = _parse_work_timings(
        None,
        None,
        job.work_timings,
    )
    existing_budget = _normalize_spaces(job.budget)
    existing_currency = ""
    existing_ctc_min = None
    existing_ctc_max = None
    if existing_budget:
        currency_match = re.search(r"\b(INR|USD|EUR|GBP|AUD)\b", existing_budget, flags=re.IGNORECASE)
        if currency_match:
            existing_currency = currency_match.group(1).upper()
        budget_numbers = re.findall(r"\d+(?:\.\d+)?", existing_budget.replace(",", ""))
        if budget_numbers:
            existing_ctc_min = _coerce_float(budget_numbers[0])
            if len(budget_numbers) > 1:
                existing_ctc_max = _coerce_float(budget_numbers[1])
            else:
                existing_ctc_max = existing_ctc_min

    existing_payload: Dict[str, Any] = {
        "date_created": job.date_created or date.today(),
        "client_id": job.client_id,
        "client_name": job.client_name,
        "client_ta": job.client_ta,
        "job_title": job.title,
        "mode": job.mode or "hybrid",
        "skills": job.skills or [],
        "jd_text": job.jd_text or job.description or "",
        "experience": (
            f"{job.min_experience if job.min_experience is not None else 0}-"
            f"{job.max_experience if job.max_experience is not None else (job.min_experience if job.min_experience is not None else 0)}"
        ),
        "experience_min": job.min_experience if job.min_experience is not None else 0,
        "experience_max": (
            job.max_experience
            if job.max_experience is not None
            else (job.min_experience if job.min_experience is not None else 0)
        ),
        "location": job.location,
        "duration": job.duration,
        "no_of_positions": job.no_of_positions or 1,
        "budget": job.budget,
        "ctc_currency": existing_currency,
        "ctc_min": existing_ctc_min,
        "ctc_max": existing_ctc_max,
        "work_start_time": existing_start_time,
        "work_end_time": existing_end_time,
        "work_timings": job.work_timings,
        "joining_preference": job.joining_preference,
        "recruiter_ids": [],
        "am_notes": [job.notes_for_recruiter] if job.notes_for_recruiter else [],
        "status": incoming_patch.get("status", job.status),
    }

    merged_payload = {**existing_payload, **incoming_patch}
    normalized, warnings = _validate_and_normalize_job_payload(
        payload=merged_payload,
        db=db,
        editing_job_id=job_id,
        allow_create_client=True,
        creator_user_id=user_id,
    )

    if data.date_created:
        job.date_created = data.date_created
    job.client_id = normalized.get("client_id")
    job.client_name = normalized.get("client_name")
    job.client_ta = normalized.get("client_ta")
    job.title = normalized.get("job_title")
    job.mode = normalized.get("mode")
    job.skills = normalized.get("skills", [])
    job.jd_text = normalized.get("jd_text")
    job.description = normalized.get("jd_text")
    job.min_experience = normalized.get("experience_min")
    job.max_experience = normalized.get("experience_max")
    job.location = normalized.get("location")
    job.duration = normalized.get("duration")
    job.no_of_positions = normalized.get("no_of_positions")
    job.budget = normalized.get("budget")
    job.salary_range = normalized.get("budget")
    job.work_timings = normalized.get("work_timings")
    job.joining_preference = normalized.get("joining_preference")
    job.notes_for_recruiter = normalized.get("am_note")

    if "status" in incoming_patch:
        requested_status = normalized.get("status", "").lower()
        if requested_status == "open":
            requested_status = "active"
        job.status = requested_status

    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)

    return {
        "status": "updated",
        "job_id": job.id,
        "warnings": warnings,
        "message": "Job updated successfully"
    }


@router.delete("/requirements/{job_id}")
def delete_requirement(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a job/requirement (AM only)"""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    user_role = current_user.get("role")
    if user_role not in ["account_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Only AM can delete jobs")
    
    db.delete(job)
    db.commit()
    
    return {"status": "deleted", "message": "Job deleted successfully"}


# ============================================================
# JOB ASSIGNMENT ENDPOINTS
# ============================================================

@router.post("/requirements/{job_id}/assign")
def assign_recruiters(
    job_id: str,
    data: JobAssignmentRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign recruiters to a job (AM only)"""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    user_role = current_user.get("role")
    if user_role not in ["account_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Only AM can assign jobs")
    
    user_id = current_user.get("id")
    notes_list = data.am_notes or [None] * len(data.recruiter_ids)
    
    # Clear existing assignments
    db.query(models.JobAssignment).filter(
        models.JobAssignment.job_id == job_id
    ).update({"status": "reassigned"})
    
    # Create new assignments
    for idx, recruiter_id in enumerate(data.recruiter_ids):
        assignment = models.JobAssignment(
            job_id=job_id,
            recruiter_id=recruiter_id,
            assigned_by=user_id,
            am_notes=notes_list[idx] if idx < len(notes_list) else None,
            status="active"
        )
        db.add(assignment)
    
    db.commit()
    
    return {
        "status": "assigned",
        "message": f"Job assigned to {len(data.recruiter_ids)} recruiter(s)"
    }


@router.get("/requirements/{job_id}/assignments")
def get_assignments(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all assignments for a job"""
    assignments = db.query(models.JobAssignment).filter(
        models.JobAssignment.job_id == job_id,
        models.JobAssignment.status == "active"
    ).all()
    
    return {"assignments": assignments}


# ============================================================
# JOB POSTING ENDPOINTS
# ============================================================

@router.get("/postings")
def get_postings(
    skip: int = Query(0),
    limit: int = Query(20),
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get job postings"""
    query = db.query(models.JobPosting)
    
    if status:
        query = query.filter(models.JobPosting.status == status)
    
    # Recruiters only see their own postings
    user_role = current_user.get("role")
    if user_role == "recruiter":
        query = query.filter(models.JobPosting.created_by == current_user["id"])
    
    # Auto-expire postings where last_date_to_apply has passed
    expired_postings = query.filter(
        models.JobPosting.status == "active",
        models.JobPosting.last_date_to_apply < date.today()
    ).all()
    
    for posting in expired_postings:
        posting.status = "expired"
    
    if expired_postings:
        db.commit()
    
    total = query.count()
    postings = query.order_by(models.JobPosting.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "postings": postings
    }


@router.post("/postings")
def create_posting(
    data: JobPostingRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a job posting"""
    user_id = current_user.get("id")
    
    # If linked to job, validate it exists
    if data.job_id:
        job = db.query(models.Job).filter(models.Job.id == data.job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
    
    posting = models.JobPosting(
        job_id=data.job_id,
        title=data.title,
        client_display_name=data.client_display_name,
        jd_content=data.jd_content,
        ctc=data.ctc,
        location=data.location,
        mode=data.mode,
        experience_required=data.experience_required,
        skills=data.skills,
        last_date_to_apply=data.last_date_to_apply,
        status="draft",
        created_by=user_id,
    )
    
    db.add(posting)
    db.commit()
    db.refresh(posting)
    
    return {
        "status": "created",
        "posting_id": posting.id,
        "message": "Job posting created successfully"
    }


@router.put("/postings/{posting_id}")
def update_posting(
    posting_id: str,
    data: JobPostingRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a job posting"""
    posting = db.query(models.JobPosting).filter(
        models.JobPosting.id == posting_id
    ).first()
    
    if not posting:
        raise HTTPException(status_code=404, detail="Posting not found")
    
    # Only creator can edit
    if posting.created_by != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only edit your own postings")
    
    posting.title = data.title
    posting.client_display_name = data.client_display_name
    posting.jd_content = data.jd_content
    posting.ctc = data.ctc
    posting.location = data.location
    posting.mode = data.mode
    posting.experience_required = data.experience_required
    posting.skills = data.skills
    posting.last_date_to_apply = data.last_date_to_apply
    posting.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(posting)
    
    return {
        "status": "updated",
        "posting_id": posting.id
    }


@router.post("/postings/{posting_id}/publish")
def publish_posting(
    posting_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Publish a job posting (change status to active)"""
    posting = db.query(models.JobPosting).filter(
        models.JobPosting.id == posting_id
    ).first()
    
    if not posting:
        raise HTTPException(status_code=404, detail="Posting not found")
    
    if posting.created_by != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only publish your own postings")
    
    posting.status = "active"
    posting.updated_at = datetime.utcnow()
    db.commit()
    
    return {"status": "published", "message": "Job posting published"}


# ============================================================
# CANDIDATE SEND TEMPLATES
# ============================================================

@router.post("/requirements/{job_id}/send-templates")
def create_send_template(
    job_id: str,
    data: CandidateSendTemplateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a custom send template for which fields to include"""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    template = models.CandidateSendTemplate(
        job_id=job_id,
        created_by=current_user["id"],
        template_name=data.template_name,
        visible_fields=data.visible_fields,
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return {
        "status": "created",
        "template_id": template.id,
        "message": "Template saved successfully"
    }


@router.get("/requirements/{job_id}/send-templates")
def get_send_templates(
    job_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all send templates for a job"""
    templates = db.query(models.CandidateSendTemplate).filter(
        models.CandidateSendTemplate.job_id == job_id,
        models.CandidateSendTemplate.created_by == current_user["id"],
    ).all()
    
    return {"templates": templates}

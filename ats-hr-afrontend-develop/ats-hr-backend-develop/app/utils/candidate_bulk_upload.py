from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
import re
from urllib.parse import urlparse

import pandas as pd
from email_validator import validate_email, EmailNotValidError


ALLOWED_EXTENSION = ".xlsx"
ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_ROWS = 5000

MIN_PHONE_DIGITS = 8
MAX_PHONE_DIGITS = 15

MAX_NAME_LEN = 120
MAX_TEXT_LEN = 1000
MAX_EMAIL_LEN = 255
MAX_URL_LEN = 512


TEMPLATE_HEADERS: List[str] = [
    "Full Name*",
    "Email*",
    "Phone*",
    "Alternate Phone",
    "Date of Birth",
    "Gender",
    "Marital Status",
    "Current Company",
    "Current Job Title",
    "Total Experience (Years)",
    "Relevant Experience (Years)",
    "Current CTC",
    "Expected CTC",
    "Notice Period (Days)",
    "Current Location",
    "Preferred Location",
    "Skills",
    "Primary Skill",
    "Secondary Skill",
    "Qualification",
    "University/College",
    "Year of Graduation",
    "Certifications",
    "Resume URL",
    "LinkedIn URL",
    "GitHub URL",
    "Portfolio URL",
    "Address",
    "City",
    "State",
    "Country",
    "Pincode",
    "Willing to Relocate (Yes/No)",
    "Preferred Employment Type",
    "Availability to Join (Date)",
    "Last Working Day",
    "Recruiter Notes",
    "Source",
]

HEADER_TO_FIELD: Dict[str, str] = {
    "Full Name*": "full_name",
    "Email*": "email",
    "Phone*": "phone",
    "Alternate Phone": "alternate_phone",
    "Date of Birth": "dob",
    "Gender": "gender",
    "Marital Status": "marital_status",
    "Current Company": "current_employer",
    "Current Job Title": "current_job_title",
    "Total Experience (Years)": "experience_years",
    "Relevant Experience (Years)": "relevant_experience_years",
    "Current CTC": "current_ctc",
    "Expected CTC": "expected_ctc",
    "Notice Period (Days)": "notice_period_days",
    "Current Location": "current_location",
    "Preferred Location": "preferred_location",
    "Skills": "skills",
    "Primary Skill": "primary_skill",
    "Secondary Skill": "secondary_skill",
    "Qualification": "qualification",
    "University/College": "university",
    "Year of Graduation": "graduation_year",
    "Certifications": "certifications_text",
    "Resume URL": "resume_url",
    "LinkedIn URL": "linkedin_url",
    "GitHub URL": "github_url",
    "Portfolio URL": "portfolio_url",
    "Address": "current_address",
    "City": "city",
    "State": "state",
    "Country": "country",
    "Pincode": "pincode",
    "Willing to Relocate (Yes/No)": "willing_to_relocate",
    "Preferred Employment Type": "preferred_employment_type",
    "Availability to Join (Date)": "availability_to_join",
    "Last Working Day": "last_working_day",
    "Recruiter Notes": "internal_notes",
    "Source": "source",
}


def sanitize_text(value: Any, max_length: int = MAX_TEXT_LEN) -> Optional[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).replace("\x00", "").strip()
    text = re.sub(r"[\r\n\t]+", " ", text)
    if not text:
        return None
    if len(text) > max_length:
        return text[:max_length]
    return text


def parse_email(value: Any) -> Optional[str]:
    text = sanitize_text(value, MAX_EMAIL_LEN)
    if not text:
        return None
    try:
        return validate_email(text, check_deliverability=False).email.lower()
    except EmailNotValidError:
        return None


def parse_phone(value: Any) -> Optional[str]:
    text = sanitize_text(value, MAX_TEXT_LEN)
    if not text:
        return None
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None
    return digits


def parse_float(value: Any) -> Optional[float]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def parse_int(value: Any) -> Optional[int]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return int(float(str(value).strip()))
    except (TypeError, ValueError):
        return None


def parse_date(value: Any) -> Optional[date]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        parsed = pd.to_datetime(str(value).strip(), errors="coerce")
        if pd.isna(parsed):
            return None
        return parsed.date()
    except Exception:
        return None


def parse_yes_no(value: Any) -> Optional[bool]:
    text = sanitize_text(value, MAX_TEXT_LEN)
    if not text:
        return None
    normalized = text.strip().lower()
    if normalized in {"yes", "y", "true", "1"}:
        return True
    if normalized in {"no", "n", "false", "0"}:
        return False
    return None


def parse_url(value: Any) -> Optional[str]:
    text = sanitize_text(value, MAX_URL_LEN)
    if not text:
        return None
    try:
        parsed = urlparse(text)
        if parsed.scheme not in {"http", "https"}:
            return None
        if not parsed.netloc:
            return None
        return text
    except Exception:
        return None


def parse_skills(value: Any) -> List[str]:
    text = sanitize_text(value, MAX_TEXT_LEN)
    if not text:
        return []
    return [item.strip() for item in text.split(",") if item.strip()]


def validate_headers(actual_headers: List[str]) -> Tuple[bool, List[str], List[str], bool]:
    expected = TEMPLATE_HEADERS
    missing = [h for h in expected if h not in actual_headers]
    extra = [h for h in actual_headers if h not in expected]
    ordered_ok = actual_headers == expected
    return len(missing) == 0 and len(extra) == 0, missing, extra, ordered_ok


@dataclass
class RowValidationResult:
    data: Dict[str, Any]
    errors: List[Dict[str, Any]]


def validate_row(
    row: Dict[str, Any],
    row_number: int,
    existing_emails: set[str],
    seen_emails: set[str],
) -> RowValidationResult:
    errors: List[Dict[str, Any]] = []
    data: Dict[str, Any] = {}

    full_name = sanitize_text(row.get("Full Name*"), MAX_NAME_LEN)
    if not full_name:
        errors.append({"row": row_number, "field": "full_name", "message": "Full Name is required"})
    else:
        data["full_name"] = full_name

    email = parse_email(row.get("Email*"))
    if not email:
        errors.append({"row": row_number, "field": "email", "message": "Invalid email"})
    else:
        if not email.endswith("@gmail.com"):
            errors.append({"row": row_number, "field": "email", "message": "Only Gmail addresses are allowed"})
        if email in seen_emails:
            errors.append({"row": row_number, "field": "email", "message": "Duplicate email in file"})
        if email in existing_emails:
            errors.append({"row": row_number, "field": "email", "message": "Email already exists"})
        if not any(err["field"] == "email" for err in errors):
            data["email"] = email
            seen_emails.add(email)

    phone_digits = parse_phone(row.get("Phone*"))
    if not phone_digits:
        errors.append({"row": row_number, "field": "phone", "message": "Phone is required"})
    elif not (MIN_PHONE_DIGITS <= len(phone_digits) <= MAX_PHONE_DIGITS):
        errors.append({"row": row_number, "field": "phone", "message": "Phone must be 8–15 digits"})
    else:
        data["phone"] = phone_digits

    alt_phone = parse_phone(row.get("Alternate Phone"))
    if alt_phone:
        data["alternate_phone"] = alt_phone

    dob = parse_date(row.get("Date of Birth"))
    if row.get("Date of Birth") not in (None, "", float("nan")) and dob is None:
        errors.append({"row": row_number, "field": "dob", "message": "Invalid date"})
    else:
        if dob:
            data["dob"] = dob

    data["gender"] = sanitize_text(row.get("Gender"))
    data["marital_status"] = sanitize_text(row.get("Marital Status"))
    data["current_employer"] = sanitize_text(row.get("Current Company"))
    data["current_job_title"] = sanitize_text(row.get("Current Job Title"))

    total_exp = parse_float(row.get("Total Experience (Years)"))
    if total_exp is not None and total_exp < 0:
        errors.append({"row": row_number, "field": "experience_years", "message": "Experience must be >= 0"})
    else:
        if total_exp is not None:
            data["experience_years"] = total_exp

    rel_exp = parse_float(row.get("Relevant Experience (Years)"))
    if rel_exp is not None and rel_exp < 0:
        errors.append({"row": row_number, "field": "relevant_experience_years", "message": "Experience must be >= 0"})
    else:
        if rel_exp is not None:
            data["relevant_experience_years"] = rel_exp

    current_ctc = parse_float(row.get("Current CTC"))
    if current_ctc is not None and current_ctc < 0:
        errors.append({"row": row_number, "field": "current_ctc", "message": "CTC must be >= 0"})
    else:
        if current_ctc is not None:
            data["current_ctc"] = current_ctc

    expected_ctc = parse_float(row.get("Expected CTC"))
    if expected_ctc is not None and expected_ctc < 0:
        errors.append({"row": row_number, "field": "expected_ctc", "message": "CTC must be >= 0"})
    else:
        if expected_ctc is not None:
            data["expected_ctc"] = str(expected_ctc)

    notice_days = parse_int(row.get("Notice Period (Days)"))
    if notice_days is not None and notice_days < 0:
        errors.append({"row": row_number, "field": "notice_period_days", "message": "Notice period must be >= 0"})
    else:
        if notice_days is not None:
            data["notice_period_days"] = notice_days

    data["current_location"] = sanitize_text(row.get("Current Location"))
    data["preferred_location"] = sanitize_text(row.get("Preferred Location"))

    skills = parse_skills(row.get("Skills"))
    if skills:
        data["skills"] = skills

    data["primary_skill"] = sanitize_text(row.get("Primary Skill"))
    data["secondary_skill"] = sanitize_text(row.get("Secondary Skill"))

    data["qualification"] = sanitize_text(row.get("Qualification"))
    data["university"] = sanitize_text(row.get("University/College"))

    grad_year = parse_int(row.get("Year of Graduation"))
    if grad_year is not None and grad_year < 0:
        errors.append({"row": row_number, "field": "graduation_year", "message": "Invalid graduation year"})
    else:
        if grad_year is not None:
            data["graduation_year"] = grad_year

    data["certifications_text"] = sanitize_text(row.get("Certifications"))

    resume_url = parse_url(row.get("Resume URL"))
    if row.get("Resume URL") not in (None, "", float("nan")) and resume_url is None:
        errors.append({"row": row_number, "field": "resume_url", "message": "Invalid URL"})
    else:
        if resume_url:
            data["resume_url"] = resume_url

    linkedin_url = parse_url(row.get("LinkedIn URL"))
    if row.get("LinkedIn URL") not in (None, "", float("nan")) and linkedin_url is None:
        errors.append({"row": row_number, "field": "linkedin_url", "message": "Invalid URL"})
    else:
        if linkedin_url:
            data["linkedin_url"] = linkedin_url

    github_url = parse_url(row.get("GitHub URL"))
    if row.get("GitHub URL") not in (None, "", float("nan")) and github_url is None:
        errors.append({"row": row_number, "field": "github_url", "message": "Invalid URL"})
    else:
        if github_url:
            data["github_url"] = github_url

    portfolio_url = parse_url(row.get("Portfolio URL"))
    if row.get("Portfolio URL") not in (None, "", float("nan")) and portfolio_url is None:
        errors.append({"row": row_number, "field": "portfolio_url", "message": "Invalid URL"})
    else:
        if portfolio_url:
            data["portfolio_url"] = portfolio_url

    data["current_address"] = sanitize_text(row.get("Address"))
    data["city"] = sanitize_text(row.get("City"))
    data["state"] = sanitize_text(row.get("State"))
    data["country"] = sanitize_text(row.get("Country"))
    data["pincode"] = sanitize_text(row.get("Pincode"))

    relocate = parse_yes_no(row.get("Willing to Relocate (Yes/No)"))
    if row.get("Willing to Relocate (Yes/No)") not in (None, "", float("nan")) and relocate is None:
        errors.append({"row": row_number, "field": "willing_to_relocate", "message": "Must be Yes/No"})
    else:
        if relocate is not None:
            data["willing_to_relocate"] = relocate

    data["preferred_employment_type"] = sanitize_text(row.get("Preferred Employment Type"))

    availability = parse_date(row.get("Availability to Join (Date)"))
    if row.get("Availability to Join (Date)") not in (None, "", float("nan")) and availability is None:
        errors.append({"row": row_number, "field": "availability_to_join", "message": "Invalid date"})
    else:
        if availability:
            data["availability_to_join"] = availability

    last_day = parse_date(row.get("Last Working Day"))
    if row.get("Last Working Day") not in (None, "", float("nan")) and last_day is None:
        errors.append({"row": row_number, "field": "last_working_day", "message": "Invalid date"})
    else:
        if last_day:
            data["last_working_day"] = last_day

    data["internal_notes"] = sanitize_text(row.get("Recruiter Notes"))
    data["source"] = sanitize_text(row.get("Source"))

    return RowValidationResult(data=data, errors=errors)

"""Resume parser package entry points."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

try:
    from loguru import logger
except Exception:  # pragma: no cover
    import logging

    logger = logging.getLogger(__name__)

from .models import (
    CertificationEntry,
    EducationEntry,
    ParsedResume,
    ProjectEntry,
    WorkExperienceEntry,
)
from .rule_based_parser import parse_resume_file_rule_based


def _to_bool(value: Any):
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    if text in {"yes", "y", "true", "1"}:
        return True
    if text in {"no", "n", "false", "0"}:
        return False
    return None


def _safe_float(value: Any):
    try:
        return float(value)
    except Exception:
        return None


def _map_to_flat_payload(parsed: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
    personal = parsed.get("personal") or {}
    professional = parsed.get("professional") or {}
    skills_obj = parsed.get("skills") or {}
    skills = skills_obj.get("all") if isinstance(skills_obj, dict) else (skills_obj or [])
    education_list = parsed.get("education") or []
    education = education_list[0] if isinstance(education_list, list) and education_list else {}
    certifications = parsed.get("certifications") or []
    experience = parsed.get("experience") or []

    certifications_text = ", ".join(
        c.get("name", "").strip() for c in certifications if c.get("name")
    )

    work_history = []
    for exp in experience:
        work_history.append(
            {
                "company": exp.get("company"),
                "company_worked_for": exp.get("company"),
                "designation": exp.get("designation"),
                "role": exp.get("designation"),
                "start_date": exp.get("start_date"),
                "end_date": exp.get("end_date"),
                "is_current": bool(exp.get("is_current")) or str(exp.get("end_date", "")).lower() == "present",
                "years": exp.get("duration_text"),
                "duration": exp.get("duration_text"),
                "project_done": exp.get("summary", ""),
                "skills_learned": exp.get("tech_stack", []) if isinstance(exp.get("tech_stack"), list) else [],
            }
        )

    education_history = []
    if education.get("degree") or education.get("institution") or education.get("score"):
        education_history.append(
            {
                "degree": education.get("degree"),
                "institution": education.get("institution"),
                "college": education.get("institution"),
                "cgpa": education.get("score"),
                "year": education.get("year_end"),
            }
        )

    return {
        "full_name": personal.get("full_name") or "Unknown",
        "name": personal.get("full_name") or "Unknown",
        "email": personal.get("email"),
        "phone": personal.get("phone"),
        "phone_number": personal.get("phone"),
        "gender": personal.get("gender"),
        "dob": personal.get("dob"),
        "date_of_birth": personal.get("dob"),
        "state": personal.get("state"),
        "country": personal.get("country"),
        "current_address": personal.get("current_address"),
        "permanent_address": personal.get("permanent_address"),
        "city": personal.get("city"),
        "pincode": personal.get("pincode"),
        "ready_to_relocate": _to_bool(professional.get("ready_to_relocate")),
        "willing_to_relocate": _to_bool(professional.get("ready_to_relocate")),
        "preferred_location": professional.get("preferred_location"),
        "current_designation": professional.get("current_designation"),
        "current_role": professional.get("primary_role") or professional.get("current_designation"),
        "designation": professional.get("current_designation"),
        "current_company": professional.get("current_company"),
        "current_employer": professional.get("current_company"),
        "professional_headline": professional.get("headline"),
        "current_ctc": professional.get("current_ctc"),
        "expected_ctc": professional.get("expected_ctc"),
        "notice_period": str(professional.get("notice_period_days")) if professional.get("notice_period_days") is not None else "",
        "notice_period_days": professional.get("notice_period_days"),
        "skills": skills,
        "primary_skills": skills_obj.get("primary", []) if isinstance(skills_obj, dict) else [],
        "secondary_skills": skills_obj.get("secondary", []) if isinstance(skills_obj, dict) else [],
        "certifications": certifications,
        "certifications_text": certifications_text,
        "education": {
            "degree": education.get("degree"),
            "institution": education.get("institution"),
            "cgpa": education.get("score"),
        },
        "highest_degree": education.get("degree"),
        "college_name": education.get("institution"),
        "cgpa": education.get("score"),
        "education_history": education_history,
        "work_experience": work_history,
        "work_history": work_history,
        "experience_years": professional.get("total_experience_years"),
        "resume_text": (parsed.get("raw_text") or raw_text or "")[:8000],
        "summary": parsed.get("summary"),
        "match_score": parsed.get("match_score", 0),
        "parser_version": parsed.get("parser_version", "v1"),
        "extraction_method": parsed.get("extraction_method", ""),
        "confidence": parsed.get("confidence", {}),
        "linkedin_url": personal.get("linkedin"),
        "portfolio_url": personal.get("portfolio"),
        "parsed_json": parsed,
        "parsed_json_v2": parsed,
        "parsed_at": datetime.utcnow().isoformat(),
    }


def _to_parsed_resume_model(flat: Dict[str, Any]) -> ParsedResume:
    education_entries: List[EducationEntry] = []
    for edu in flat.get("education_history") or []:
        try:
            education_entries.append(
                EducationEntry(
                    degree=edu.get("degree") or "Unknown",
                    institution=edu.get("institution") or "Unknown",
                    cgpa=_safe_float(edu.get("cgpa")),
                )
            )
        except Exception:
            continue

    work_entries: List[WorkExperienceEntry] = []
    for exp in flat.get("work_history") or []:
        try:
            work_entries.append(
                WorkExperienceEntry(
                    company=exp.get("company") or "Unknown",
                    designation=exp.get("designation") or "Professional",
                    start_date=exp.get("start_date"),
                    end_date=exp.get("end_date"),
                    is_current=bool(exp.get("is_current")),
                    duration=exp.get("duration"),
                    years=exp.get("years"),
                )
            )
        except Exception:
            continue

    cert_entries: List[CertificationEntry] = []
    for cert in flat.get("certifications") or []:
        try:
            cert_entries.append(
                CertificationEntry(
                    name=cert.get("name") or "Certification",
                    issuer=cert.get("issuer"),
                )
            )
        except Exception:
            continue

    return ParsedResume(
        full_name=flat.get("full_name") or "Unknown",
        email=flat.get("email"),
        phone=flat.get("phone"),
        current_designation=flat.get("current_designation"),
        current_location=flat.get("city"),
        preferred_location=flat.get("preferred_location"),
        notice_period=flat.get("notice_period"),
        ready_to_relocate=flat.get("ready_to_relocate"),
        current_ctc=flat.get("current_ctc"),
        expected_ctc=flat.get("expected_ctc"),
        work_experience=work_entries,
        education=education_entries,
        skills=flat.get("skills") or [],
        certifications=cert_entries,
        projects=[ProjectEntry(name="")][:0],
        gender=flat.get("gender"),
        current_address=flat.get("current_address"),
        permanent_address=flat.get("permanent_address"),
        city=flat.get("city"),
        pincode=flat.get("pincode"),
    )


def parse_resume(file_path: str) -> dict:
    """Rule-based parsing with MiniLM only for skill normalization/match score."""
    result = parse_resume_file_rule_based(file_path)
    if not result.get("success"):
        return {"success": False, "data": {}}

    parsed_json = result.get("data") or {}
    raw_text = result.get("raw_text") or ""
    flat_data = _map_to_flat_payload(parsed_json, raw_text=raw_text)
    return {"success": True, "data": flat_data}


def parse_resume_structured(file_path: str):
    """Return ParsedResume model for strict endpoint compatibility."""
    try:
        parsed = parse_resume(file_path) or {}
        data = parsed.get("data") if isinstance(parsed, dict) else {}
        if not isinstance(data, dict):
            return None
        return _to_parsed_resume_model(data)
    except Exception:
        logger.exception("parse_resume_structured failed for {}", file_path)
        return None


__all__ = ["parse_resume", "parse_resume_structured", "ParsedResume"]

"""
Resume Parsing Service
Extracts structured data from resume files using pyresparser
"""

import os
import tempfile
from typing import Dict, Any
from fastapi import UploadFile

# Reuse the enriched parser to keep schema consistent everywhere
from app.resume_parser import parse_resume as parse_resume_file

def parse_resume(file: UploadFile) -> Dict[str, Any]:
    """
    Parse resume file and extract structured data using the production parser.
    """
    suffix = os.path.splitext(file.filename or "")[1] or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name

    try:
        result = parse_resume_file(tmp_path) or {}
        # parse_resume_file already returns {"success": True, "data": {...}}
        data = result.get("data", {}) if result.get("success") else result
        # Keep legacy fields for the response model
        education_list = data.get("education", [])
        if isinstance(education_list, list):
            education_out = ", ".join(str(e) for e in education_list if e)
        else:
            education_out = str(education_list or "")

        return {
            "full_name": data.get("full_name", ""),
            "email": data.get("email", ""),
            "phone": data.get("phone", ""),
            "skills": data.get("skills", []),
            "experience_years": data.get("experience_years", 0),
            "education": education_out,
            "location": data.get("location", ""),
            "resume_text": data.get("resume_text", ""),
            "confidence_score": data.get("confidences", {}).get("full_name", 0.7),
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _calculate_experience_years(experiences: list) -> int:
    """Calculate total years of experience from parsed data."""
    if not experiences:
        return 0
    return min(len(experiences) * 2, 50)  # Rough estimate


def _format_education(education: list) -> str:
    """Format education data into string."""
    if not education:
        return ""
    return ", ".join([str(e) for e in education])


def _basic_parse_fallback(file: UploadFile) -> Dict[str, Any]:
    """
    Fallback parsing when pyresparser is not available.
    Extracts basic info from file text.
    """
    return {
        "full_name": "",
        "email": "",
        "phone": "",
        "skills": [],
        "experience_years": 0,
        "education": "",
        "location": "",
        "resume_text": "",
        "confidence_score": 0.5
    }

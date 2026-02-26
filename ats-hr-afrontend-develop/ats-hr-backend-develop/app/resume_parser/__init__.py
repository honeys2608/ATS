"""Resume Parser Module"""

import os
import re
from .models import (
    ParsedResume,
    ParsingMetadata,
    ResumeParseResponse,
    WorkExperienceEntry,
    EducationEntry,
    CertificationEntry,
    ProjectEntry,
)
from .parser import ResumeParser
from .name_extractor import NameExtractor
from .position_extractor import CurrentPositionExtractor
from .text_extractor import extract_text_from_file, clean_extracted_text
from .cleaners.text_cleaner import extract_contact_info
from .entity_extractor.enrichment import enrich_with_optional_ai
from .section_detector.detector import detect_sections_with_trace
from .entity_extractor import (
    extract_entities_spacy,
    extract_entities_hf,
    extract_entities_pyresparser,
    extract_skills_cogito,
    merge_entity_sources,
)


def _as_iso_date(value):
    if not value:
        return None
    try:
        return value.isoformat()
    except Exception:
        return str(value)


def _experience_to_years(value):
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if not match:
        return None
    years = float(match.group(1))
    if "month" in text and "year" not in text:
        years = round(years / 12.0, 1)
    return years


def _parse_notice_period_days(value):
    text = str(value or "").strip().lower()
    if not text:
        return None
    m = re.search(r"(\d+)", text)
    if not m:
        return None
    qty = int(m.group(1))
    if "month" in text:
        return qty * 30
    if "week" in text:
        return qty * 7
    return qty


def parse_resume(file_path: str) -> dict:
    """
    Parse a resume file and return extracted information.
    
    Args:
        file_path: Path to the resume file (PDF, DOCX, DOC, or TXT)
        
    Returns:
        Dictionary with format: {'data': {parsed_fields...}}
    """
    try:
        # Extract file extension
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Extract text from file
        raw_text = extract_text_from_file(file_path, file_ext)
        if not raw_text:
            print(f"Error: Could not extract text from {file_path}")
            return {'success': False, 'data': {}}

        # Parse the extracted text
        parser = ResumeParser()
        result = parser.parse(raw_text, filename=file_path)
        
        if result and result.parsed_data:
            education_history = [
                {
                    'degree': edu.degree,
                    'institution': edu.institution,
                    'college': edu.institution,
                    'field_of_study': edu.field_of_study,
                    'year': getattr(edu, 'end_year', None) or getattr(edu, 'start_year', None),
                    'start_year': getattr(edu, 'start_year', None),
                    'end_year': getattr(edu, 'end_year', None),
                    'cgpa': getattr(edu, 'cgpa', None),
                    'percentage': getattr(edu, 'percentage', None),
                }
                for edu in (result.parsed_data.education or [])
            ]

            work_history = [
                {
                    'company': exp.company,
                    'company_worked_for': exp.company,
                    'designation': exp.designation,
                    'role': exp.designation,
                    'start_date': exp.start_date,
                    'end_date': exp.end_date,
                    'is_current': exp.is_current,
                    'project_done': getattr(exp, 'project_done', None),
                    'project': getattr(exp, 'project_done', None),
                    'skills_learned': getattr(exp, 'skills_learned', None) or getattr(exp, 'technologies', None) or [],
                    'skills_learnt': getattr(exp, 'skills_learned', None) or getattr(exp, 'technologies', None) or [],
                    'technologies': getattr(exp, 'technologies', None) or [],
                    'years': getattr(exp, 'years', None),
                    'duration': getattr(exp, 'duration', None),
                    'ctc': getattr(exp, 'ctc', None),
                }
                for exp in (result.parsed_data.work_experience or [])
            ]

            certifications = [
                {
                    'name': cert.name,
                    'issuer': cert.issuer,
                    'issue_date': getattr(cert, 'issue_date', None),
                    'expiry_date': getattr(cert, 'expiry_date', None),
                    'credential_id': getattr(cert, 'credential_id', None),
                    'credential_url': getattr(cert, 'credential_url', None),
                }
                for cert in (result.parsed_data.certifications or [])
            ]

            primary_education = education_history[0] if education_history else {}
            total_experience = result.parsed_data.total_experience
            experience_years = _experience_to_years(total_experience)
            certifications_text = ", ".join(
                cert.get("name", "").strip()
                for cert in certifications
                if cert.get("name")
            )

            data = {
                'full_name': result.parsed_data.full_name,
                'name': result.parsed_data.full_name,
                'email': result.parsed_data.email,
                'phone': result.parsed_data.phone,
                'phone_number': result.parsed_data.phone,
                'alternate_phone': result.parsed_data.alternate_phone,
                'gender': result.parsed_data.gender,
                'date_of_birth': _as_iso_date(result.parsed_data.date_of_birth),
                'dob': _as_iso_date(result.parsed_data.date_of_birth),
                'current_designation': result.parsed_data.current_designation,
                'current_role': result.parsed_data.current_designation,
                'designation': result.parsed_data.current_designation,
                'current_company': result.parsed_data.current_company,
                'current_employer': result.parsed_data.current_company,
                'total_experience': total_experience,
                'experience_years': experience_years,
                'location': result.parsed_data.current_location or result.parsed_data.preferred_location,
                'current_location': result.parsed_data.current_location,
                'preferred_location': result.parsed_data.preferred_location,
                'notice_period': result.parsed_data.notice_period,
                'notice_period_days': _parse_notice_period_days(result.parsed_data.notice_period),
                'current_ctc': result.parsed_data.current_ctc,
                'expected_ctc': result.parsed_data.expected_ctc,
                'professional_summary': result.parsed_data.professional_summary,
                'current_address': result.parsed_data.current_address,
                'permanent_address': result.parsed_data.permanent_address,
                'city': result.parsed_data.city,
                'pincode': result.parsed_data.pincode,
                'ready_to_relocate': result.parsed_data.ready_to_relocate,
                'willing_to_relocate': result.parsed_data.ready_to_relocate,
                'languages': result.parsed_data.languages or [],
                'skills': result.parsed_data.skills or [],
                'education': primary_education,
                'highest_degree': primary_education.get('degree') if isinstance(primary_education, dict) else None,
                'college_name': primary_education.get('institution') if isinstance(primary_education, dict) else None,
                'cgpa': primary_education.get('cgpa') if isinstance(primary_education, dict) else None,
                'cgpa_percentage': primary_education.get('percentage') if isinstance(primary_education, dict) else None,
                'education_history': education_history,
                'work_experience': work_history,
                'work_history': work_history,
                'certifications': certifications,
                'certifications_text': certifications_text,
                'projects': [
                    {
                        'name': project.name,
                        'description': project.description,
                        'technologies': project.technologies,
                        'url': project.url,
                    }
                    for project in (result.parsed_data.projects or [])
                ],
                'linkedin_url': result.parsed_data.linkedin_url,
                'github_url': result.parsed_data.github_url,
                'portfolio_url': result.parsed_data.portfolio_url,
                'resume_text': clean_extracted_text(raw_text)[:8000],
            }

            contact = extract_contact_info(raw_text)
            if not data.get("email") and contact.get("email"):
                data["email"] = contact.get("email")
            if not data.get("phone") and contact.get("phone"):
                data["phone"] = contact.get("phone")
            if not data.get("linkedin_url") and contact.get("linkedin_url"):
                data["linkedin_url"] = contact.get("linkedin_url")
            if not data.get("github_url") and contact.get("github_url"):
                data["github_url"] = contact.get("github_url")

            sections, section_trace = detect_sections_with_trace(raw_text)
            spacy_entities = extract_entities_spacy(raw_text)
            hf_entities = extract_entities_hf(raw_text)
            pyres_entities = extract_entities_pyresparser(file_path)
            skill_entities = extract_skills_cogito(
                f"{sections.get('SKILLS', '')}\n{sections.get('EXPERIENCE', '')}"
            )

            data = merge_entity_sources(
                base_data=data,
                spacy_entities=spacy_entities,
                hf_entities=hf_entities,
                pyres_data=pyres_entities,
                skill_entities=skill_entities,
            )

            data = enrich_with_optional_ai(
                text=raw_text,
                file_path=file_path,
                parsed_data=data,
            )
            data["sections"] = sections
            data["section_trace"] = section_trace
             
            if result.metadata:
                data['parsing_metadata'] = {
                    'overall_confidence': result.metadata.overall_confidence,
                    'fields_extracted': result.metadata.fields_extracted,
                    'fields_failed': result.metadata.fields_failed,
                }
            data["parser_version"] = "phase2-sections-entities-v1"
            
            return {'success': True, 'data': data}
        
        return {'success': False, 'data': {}}
    except Exception as e:
        print(f"Error parsing resume: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'success': False, 'data': {}}


def parse_resume_structured(file_path: str):
    """
    Parse a resume file and return complete ParsedResume object (structured).
    
    Args:
        file_path: Path to the resume file (PDF, DOCX, DOC, or TXT)
        
    Returns:
        ParsedResume object with all extracted data
    """
    try:
        # Extract file extension
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Extract text from file
        raw_text = extract_text_from_file(file_path, file_ext)
        if not raw_text:
            print(f"Error: Could not extract text from {file_path}")
            return None
        
        # Parse the extracted text
        parser = ResumeParser()
        result = parser.parse(raw_text, filename=file_path)
        
        if result:
            return result.parsed_data
        return None
    except Exception as e:
        print(f"Error parsing resume: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


__all__ = [
    'ParsedResume',
    'ParsingMetadata',
    'ResumeParseResponse',
    'ResumeParser',
    'NameExtractor',
    'CurrentPositionExtractor',
    'extract_text_from_file',
    'clean_extracted_text',
    'parse_resume',
    'parse_resume_structured',
]

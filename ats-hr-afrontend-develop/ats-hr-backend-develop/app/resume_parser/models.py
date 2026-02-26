"""
Pydantic models for resume parsing.
Defines complete data structures for parsed resume data.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import date
from enum import Enum


class EmploymentType(str, Enum):
    """Employment contract types"""
    FULL_TIME = "Full-time"
    PART_TIME = "Part-time"
    CONTRACT = "Contract"
    INTERNSHIP = "Internship"
    FREELANCE = "Freelance"
    TEMPORARY = "Temporary"


class WorkExperienceEntry(BaseModel):
    """Single work experience entry"""
    company: str = Field(..., description="Company name")
    designation: str = Field(..., description="Job title/role - CRITICAL FIELD")
    location: Optional[str] = None
    employment_type: Optional[EmploymentType] = None
    start_date: Optional[str] = None  # "Oct 2024" or "2024-10"
    end_date: Optional[str] = None  # "Present", "Dec 2024", etc.
    is_current: bool = False
    duration: Optional[str] = None  # "1 year 2 months"
    responsibilities: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    project_done: Optional[str] = None
    skills_learned: List[str] = Field(default_factory=list)
    years: Optional[str] = None
    ctc: Optional[str] = None


class EducationEntry(BaseModel):
    """Single education entry"""
    degree: str = Field(..., description="B.Tech, BE, Bachelor of Engineering, etc.")
    field_of_study: Optional[str] = None  # Computer Science, ECE
    institution: str = Field(..., description="University/School name")
    location: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    cgpa: Optional[float] = None
    percentage: Optional[float] = None
    grade: Optional[str] = None


class CertificationEntry(BaseModel):
    """Single certification"""
    name: str = Field(..., description="Certification name")
    issuer: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None
    credential_url: Optional[str] = None


class ProjectEntry(BaseModel):
    """Single project entry"""
    name: str = Field(..., description="Project name")
    description: Optional[str] = None
    role: Optional[str] = None
    technologies: List[str] = Field(default_factory=list)
    duration: Optional[str] = None
    url: Optional[str] = None


class ParsedResume(BaseModel):
    """Complete parsed resume data"""
    
    # === CRITICAL FIELDS (Must be on candidate card) ===
    full_name: str = Field(..., description="REQUIRED: Candidate's full name")
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    
    # === CURRENT POSITION (Show on card) ===
    current_company: Optional[str] = Field(
        None, 
        description="Current employer name, 'N/A' if unemployed"
    )
    current_designation: Optional[str] = Field(
        None,
        description="Current job title/role - MUST show on card"
    )
    
    # === EXPERIENCE ===
    total_experience: Optional[str] = Field(
        None,
        description="e.g., '7 years', '2y 3m', '6 months'"
    )
    
    # === LOCATION & AVAILABILITY ===
    current_location: Optional[str] = None
    preferred_location: Optional[str] = None
    notice_period: Optional[str] = None
    ready_to_relocate: Optional[bool] = None
    
    # === COMPENSATION ===
    current_ctc: Optional[str] = None
    expected_ctc: Optional[str] = None
    
    # === PROFESSIONAL DETAILS ===
    professional_summary: Optional[str] = None
    work_experience: List[WorkExperienceEntry] = Field(default_factory=list)
    education: List[EducationEntry] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    certifications: List[CertificationEntry] = Field(default_factory=list)
    projects: List[ProjectEntry] = Field(default_factory=list)
    
    # === ADDITIONAL INFO ===
    languages: List[str] = Field(default_factory=list)
    achievements: List[str] = Field(default_factory=list)
    publications: List[str] = Field(default_factory=list)
    
    # === PERSONAL (Optional) ===
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    marital_status: Optional[str] = None
    current_address: Optional[str] = None
    permanent_address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    
    # === METADATA ===
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None


class ParsingMetadata(BaseModel):
    """Confidence scores and parsing info"""
    name_confidence: float = Field(ge=0.0, le=1.0, description="Name extraction confidence")
    overall_confidence: float = Field(ge=0.0, le=1.0, description="Overall parsing confidence")
    parsing_method: str = Field(..., description="Name extraction method used")
    fields_extracted: List[str] = Field(default_factory=list, description="Successfully extracted fields")
    fields_failed: List[str] = Field(default_factory=list, description="Fields that failed to extract")
    warnings: List[str] = Field(default_factory=list, description="Parsing warnings")


class ResumeParseResponse(BaseModel):
    """API response for resume parsing"""
    status: str = Field(..., description="'success', 'partial', or 'failed'")
    parsed_data: ParsedResume
    metadata: ParsingMetadata
    file_info: dict = Field(default_factory=dict)

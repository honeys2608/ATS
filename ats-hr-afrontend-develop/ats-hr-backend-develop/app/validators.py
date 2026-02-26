# app/validators.py
"""
Backend Validation Utilities (Market-Standard)
Following OWASP and industry best practices
"""

import re
from typing import Optional, List, Tuple
from datetime import datetime, date

# ============================================================
# EMAIL VALIDATION (RFC 5322)
# ============================================================
def validate_email(email: str) -> Tuple[bool, Optional[str]]:
    """
    Validate email address using RFC 5322 simplified regex
    Returns: (is_valid, error_message)
    """
    if not email or not isinstance(email, str):
        return False, "Email is required"
    
    email = email.strip().lower()
    
    # Practical RFC 5322 regex
    pattern = r'^[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
    
    if not re.match(pattern, email):
        return False, "Invalid email format"
    
    if len(email) > 255:
        return False, "Email is too long"
    
    return True, None


# ============================================================
# PHONE VALIDATION (International Format)
# ============================================================
def validate_phone(phone: str) -> Tuple[bool, Optional[str]]:
    """
    Validate phone number (international format support)
    Supports: +1 (234) 567-8900, +91 9876543210, etc.
    Returns: (is_valid, error_message)
    """
    if not phone or not isinstance(phone, str):
        return False, "Phone number is required"
    
    phone = phone.strip()
    cleaned = re.sub(r'\D', '', phone)
    
    # Check length (international standard: 10-15 digits)
    if len(cleaned) < 10:
        return False, "Phone number must be at least 10 digits"
    
    if len(cleaned) > 15:
        return False, "Phone number is invalid"
    
    return True, None


# ============================================================
# NAME VALIDATION (Unicode Support)
# ============================================================
def validate_name(name: str, field_name: str = "Name") -> Tuple[bool, Optional[str]]:
    """
    Validate name field (supports Unicode characters)
    Allows: letters, spaces, hyphens, apostrophes, periods
    Returns: (is_valid, error_message)
    """
    if not name or not isinstance(name, str):
        return False, f"{field_name} is required"
    
    name = name.strip()
    
    if len(name) < 2:
        return False, f"{field_name} must be at least 2 characters"
    
    if len(name) > 100:
        return False, f"{field_name} cannot exceed 100 characters"
    
    # Unicode-aware regex for international names
    if not re.match(r"^[\p{L}\s'-\.]+$", name, re.UNICODE):
        return False, f"{field_name} contains invalid characters"
    
    return True, None


# ============================================================
# PASSWORD VALIDATION (NIST SP 800-63B)
# ============================================================
def validate_password(password: str) -> Tuple[bool, Optional[str]]:
    """
    Validate password using NIST SP 800-63B guidelines
    - Minimum 8 characters
    - Uppercase, lowercase, number, special character
    Returns: (is_valid, error_message)
    """
    if not password:
        return False, "Password is required"
    
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    
    if len(password) > 128:
        return False, "Password is too long"
    
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number"
    
    if not re.search(r"[@$!%*?&#^()\-_=\[\]{};':\"\\|,.<>/?]", password):
        return False, "Password must contain at least one special character"
    
    return True, None


# ============================================================
# TEXT VALIDATION
# ============================================================
def validate_text(
    text: str,
    field_name: str = "Text",
    min_length: int = 1,
    max_length: int = 1000,
    allow_html: bool = False
) -> Tuple[bool, Optional[str]]:
    """
    Generic text validation with XSS prevention
    Returns: (is_valid, error_message)
    """
    if min_length > 0 and (not text or not text.strip()):
        return False, f"{field_name} is required"
    
    if text and len(text.strip()) < min_length:
        return False, f"{field_name} must be at least {min_length} characters"
    
    if text and len(text.strip()) > max_length:
        return False, f"{field_name} cannot exceed {max_length} characters"
    
    # XSS prevention: check for suspicious patterns
    if not allow_html and text:
        dangerous_patterns = [
            r'<script',
            r'javascript:',
            r'onerror\s*=',
            r'onload\s*=',
            r'onclick\s*=',
        ]
        for pattern in dangerous_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return False, f"{field_name} contains invalid content"
    
    return True, None


# ============================================================
# NUMBER VALIDATION
# ============================================================
def validate_number(
    value,
    field_name: str = "Value",
    min_val: float = 0,
    max_val: float = 999999999,
    integer_only: bool = False,
    required: bool = True
) -> Tuple[bool, Optional[str]]:
    """
    Validate numeric input
    Returns: (is_valid, error_message)
    """
    if required and (value is None or value == ''):
        return False, f"{field_name} is required"
    
    if not required and (value is None or value == ''):
        return True, None
    
    try:
        num = float(value)
    except (ValueError, TypeError):
        return False, f"{field_name} must be a valid number"
    
    if integer_only and num != int(num):
        return False, f"{field_name} must be a whole number"
    
    if num < min_val:
        return False, f"{field_name} cannot be less than {min_val}"
    
    if num > max_val:
        return False, f"{field_name} cannot exceed {max_val}"
    
    return True, None


# ============================================================
# EXPERIENCE VALIDATION
# ============================================================
def validate_experience(value) -> Tuple[bool, Optional[str]]:
    """
    Validate years of experience (0-70 years)
    """
    return validate_number(
        value,
        "Experience",
        min_val=0,
        max_val=70,
        integer_only=True
    )


# ============================================================
# SALARY VALIDATION
# ============================================================
def validate_salary(value, field_name: str = "Salary") -> Tuple[bool, Optional[str]]:
    """
    Validate salary amount
    """
    return validate_number(
        value,
        field_name,
        min_val=0,
        max_val=100000000,  # 100 million
        integer_only=False
    )


# ============================================================
# DATE VALIDATION
# ============================================================
def validate_date_format(date_string: str, field_name: str = "Date") -> Tuple[bool, Optional[str]]:
    """
    Validate date format (YYYY-MM-DD)
    Returns: (is_valid, error_message)
    """
    if not date_string:
        return False, f"{field_name} is required"
    
    try:
        datetime.strptime(date_string, "%Y-%m-%d")
        return True, None
    except ValueError:
        return False, f"{field_name} must be in YYYY-MM-DD format"


def validate_future_date(date_string: str, field_name: str = "Date") -> Tuple[bool, Optional[str]]:
    """
    Validate that date is in the future
    """
    is_valid, error = validate_date_format(date_string, field_name)
    if not is_valid:
        return is_valid, error
    
    date_obj = datetime.strptime(date_string, "%Y-%m-%d").date()
    if date_obj <= date.today():
        return False, f"{field_name} must be in the future"
    
    return True, None


def validate_past_date(date_string: str, field_name: str = "Date") -> Tuple[bool, Optional[str]]:
    """
    Validate that date is in the past
    """
    is_valid, error = validate_date_format(date_string, field_name)
    if not is_valid:
        return is_valid, error
    
    date_obj = datetime.strptime(date_string, "%Y-%m-%d").date()
    if date_obj >= date.today():
        return False, f"{field_name} must be in the past"
    
    return True, None


def validate_date_range(
    start_date: str,
    end_date: str,
    field_name: str = "Date Range"
) -> Tuple[bool, Optional[str]]:
    """
    Validate date range (start before end)
    """
    is_valid, error = validate_date_format(start_date, f"Start {field_name}")
    if not is_valid:
        return is_valid, error
    
    is_valid, error = validate_date_format(end_date, f"End {field_name}")
    if not is_valid:
        return is_valid, error
    
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
    if start > end:
        return False, f"Start {field_name} cannot be after end {field_name}"
    
    return True, None


# ============================================================
# URL VALIDATION
# ============================================================
def validate_url(url: str, field_name: str = "URL") -> Tuple[bool, Optional[str]]:
    """
    Validate URL format
    """
    if not url:
        return True, None  # Optional field
    
    url = url.strip()
    
    url_pattern = r'^https?://(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&/=]*)$'
    
    if not re.match(url_pattern, url):
        return False, f"{field_name} must be a valid URL starting with http:// or https://"
    
    if len(url) > 2048:
        return False, f"{field_name} is too long"
    
    return True, None


# ============================================================
# ARRAY/LIST VALIDATION
# ============================================================
def validate_array(
    arr: List,
    field_name: str = "Items",
    min_length: int = 1,
    max_length: int = None
) -> Tuple[bool, Optional[str]]:
    """
    Validate array/list
    """
    if not isinstance(arr, list):
        return False, f"{field_name} must be an array"
    
    if len(arr) < min_length:
        return False, f"At least {min_length} {field_name} required"
    
    if max_length and len(arr) > max_length:
        return False, f"Cannot have more than {max_length} {field_name}"
    
    return True, None


# ============================================================
# SKILLS VALIDATION
# ============================================================
def validate_skills(skills: List[str]) -> Tuple[bool, Optional[str]]:
    """
    Validate skills list
    - 1-100 skills
    - 2-50 characters each
    """
    is_valid, error = validate_array(skills, "Skills", 1, 100)
    if not is_valid:
        return is_valid, error
    
    for skill in skills:
        if not isinstance(skill, str) or len(skill.strip()) < 2:
            return False, "Each skill must be at least 2 characters"
        
        if len(skill.strip()) > 50:
            return False, "Each skill cannot exceed 50 characters"
    
    return True, None


# ============================================================
# USERNAME VALIDATION
# ============================================================
def validate_username(username: str) -> Tuple[bool, Optional[str]]:
    """
    Validate username (alphanumeric, underscore, hyphen)
    """
    if not username:
        return False, "Username is required"
    
    username = username.strip()
    
    if len(username) < 3:
        return False, "Username must be at least 3 characters"
    
    if len(username) > 50:
        return False, "Username cannot exceed 50 characters"
    
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False, "Username can only contain letters, numbers, underscores, and hyphens"
    
    if re.match(r'^\d', username):
        return False, "Username cannot start with a number"
    
    return True, None


# ============================================================
# SANITIZATION FUNCTIONS
# ============================================================
def sanitize_text(text: str) -> str:
    """Remove leading/trailing spaces and HTML tags"""
    if not isinstance(text, str):
        return ""
    return text.strip().replace('<', '').replace('>', '')


def sanitize_email(email: str) -> str:
    """Normalize email"""
    if not isinstance(email, str):
        return ""
    return email.strip().lower()


def sanitize_number(value) -> float:
    """Convert to number, default to 0"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return 0


# ============================================================
# XSS PREVENTION
# ============================================================
def contains_xss_payload(text: str) -> bool:
    """
    Check if text contains XSS payload patterns
    """
    if not isinstance(text, str):
        return False
    
    dangerous_patterns = [
        r'<script',
        r'javascript:',
        r'onerror\s*=',
        r'onload\s*=',
        r'onclick\s*=',
        r'<iframe',
        r'<embed',
        r'<object',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    
    return False


# ============================================================
# LOCATION VALIDATION
# ============================================================
def validate_location(location: str, field_name: str = "Location") -> Tuple[bool, Optional[str]]:
    """
    Validate location field (current location or city)
    Allows: letters, spaces, hyphens, commas, periods
    Returns: (is_valid, error_message)
    """
    if not location or not isinstance(location, str):
        return False, f"{field_name} is required"
    
    location = location.strip()
    
    if len(location) < 2:
        return False, f"{field_name} must be at least 2 characters"
    
    if len(location) > 100:
        return False, f"{field_name} cannot exceed 100 characters"
    
    # Allow letters (including Unicode), spaces, hyphens, commas, periods
    # Using [a-zA-Z\u00C0-\u024F\u1E00-\u1EFF] for Unicode letters (Python re doesn't support \p{L})
    if not re.match(r"^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s\-,.]+$", location):
        return False, f"{field_name} contains invalid characters"
    
    return True, None


# ============================================================
# PINCODE VALIDATION
# ============================================================
def validate_pincode(pincode: str) -> Tuple[bool, Optional[str]]:
    """
    Validate pincode (postal code)
    - Exactly 6 digits
    Returns: (is_valid, error_message)
    """
    if not pincode or not isinstance(pincode, str):
        return False, "Pincode is required"
    
    pincode = pincode.strip().replace(" ", "").replace("-", "")
    
    if not pincode.isdigit():
        return False, "Pincode must contain only numbers"
    
    if len(pincode) != 6:
        return False, "Pincode must be exactly 6 digits"
    
    return True, None


# ============================================================
# SKILLS VALIDATION
# ============================================================
def validate_skills(skills: List[str]) -> Tuple[bool, Optional[str]]:
    """
    Validate skills array
    - 1-100 skills
    - Each skill 2-50 characters
    Returns: (is_valid, error_message)
    """
    if not skills or not isinstance(skills, list):
        return False, "Skills are required"
    
    if len(skills) > 100:
        return False, "Cannot have more than 100 skills"
    
    for skill in skills:
        if not isinstance(skill, str):
            return False, "Each skill must be a string"
        
        skill = skill.strip()
        
        if len(skill) < 2:
            return False, "Each skill must be at least 2 characters"
        
        if len(skill) > 50:
            return False, "Each skill cannot exceed 50 characters"
    
    return True, None


# ============================================================
# INTERNATIONAL PHONE VALIDATION (BY COUNTRY CODE)
# ============================================================
COUNTRY_DIGIT_MAP = {
    "+1": 10,      # USA/Canada
    "+44": 10,     # UK
    "+91": 10,     # India
    "+86": 11,     # China
    "+81": 10,     # Japan
    "+61": 9,      # Australia
    "+33": 9,      # France
    "+49": 11,     # Germany
    "+39": 10,     # Italy
    "+34": 9,      # Spain
    "+31": 9,      # Netherlands
    "+46": 9,      # Sweden
    "+47": 8,      # Norway
    "+41": 9,      # Switzerland
    "+43": 10,     # Austria
    "+32": 9,      # Belgium
    "+45": 8,      # Denmark
    "+358": 9,     # Finland
    "+353": 9,     # Ireland
    "+48": 9,      # Poland
    "+40": 9,      # Romania
    "+30": 10,     # Greece
    "+90": 10,     # Turkey
    "+55": 11,     # Brazil
    "+54": 10,     # Argentina
    "+52": 10,     # Mexico
    "+56": 9,      # Chile
    "+57": 10,     # Colombia
    "+64": 9,      # New Zealand
    "+65": 8,      # Singapore
    "+60": 10,     # Malaysia
    "+66": 9,      # Thailand
    "+62": 10,     # Indonesia
    "+63": 10,     # Philippines
    "+82": 10,     # South Korea
    "+84": 9,      # Vietnam
    "+27": 9,      # South Africa
    "+20": 10,     # Egypt
    "+234": 10,    # Nigeria
    "+971": 9,     # UAE
    "+966": 9,     # Saudi Arabia
}


def validate_phone_by_country(country_code: str, phone_digits: str) -> Tuple[bool, Optional[str]]:
    """
    Validate phone number for specific country code
    Returns: (is_valid, error_message)
    """
    if country_code not in COUNTRY_DIGIT_MAP:
        return False, "Invalid country code"
    
    cleaned = re.sub(r'\D', '', phone_digits)
    required_digits = COUNTRY_DIGIT_MAP[country_code]
    
    if len(cleaned) != required_digits:
        return False, f"{country_code} requires exactly {required_digits} digits"
    
    return True, None

from __future__ import annotations

import re
import secrets
import string
from typing import Optional


EMAIL_MAX_LENGTH = 254
EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def normalize_email(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def validate_email_address(email: Optional[str]) -> tuple[bool, str]:
    normalized = normalize_email(email)
    if not normalized:
        return False, "Email is required"
    if len(normalized) > EMAIL_MAX_LENGTH:
        return False, "Enter a valid email address"
    if " " in normalized or ".." in normalized:
        return False, "Enter a valid email address"
    if normalized.count("@") != 1:
        return False, "Enter a valid email address"
    local_part, domain = normalized.split("@", 1)
    if not local_part or not domain or "." not in domain:
        return False, "Enter a valid email address"
    if domain.startswith(".") or domain.endswith("."):
        return False, "Enter a valid email address"
    if not EMAIL_PATTERN.match(normalized):
        return False, "Enter a valid email address"
    return True, ""


def validate_password_strength(password: Optional[str]) -> tuple[bool, str]:
    raw = str(password or "")
    if not raw:
        return False, "Password is required"
    if len(raw) < 8 or len(raw) > 128:
        return False, "Password must be 8 to 128 characters"
    return True, ""


def validate_first_name(first_name: Optional[str]) -> tuple[bool, str]:
    value = str(first_name or "").strip()
    if not value:
        return False, "First name is required"
    if len(value) < 2:
        return False, "First name must be at least 2 characters"
    return True, ""


def generate_temp_password(length: int = 12) -> str:
    length = max(8, min(length, 32))
    charset = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(charset) for _ in range(length))

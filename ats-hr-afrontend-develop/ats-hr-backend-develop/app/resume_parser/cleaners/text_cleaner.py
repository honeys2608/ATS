import re
import unicodedata
from typing import Dict, List, Optional

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(
    r"(?:(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,6})"
)
LINKEDIN_RE = re.compile(r"(https?://)?(www\.)?linkedin\.com/in/[A-Za-z0-9\-_%/]+", re.I)
GITHUB_RE = re.compile(r"(https?://)?(www\.)?github\.com/[A-Za-z0-9\-_%/]+", re.I)


def normalize_unicode_text(text: str) -> str:
    value = unicodedata.normalize("NFKC", str(text or ""))
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = value.replace("\u00a0", " ")
    return value


def _fix_common_ocr_patterns(text: str) -> str:
    def _fix_email(match: re.Match) -> str:
        token = match.group(0)
        token = token.replace(" ", "")
        token = token.replace("(at)", "@").replace("[at]", "@")
        token = token.replace("(dot)", ".").replace("[dot]", ".")
        token = token.replace("|", "l")
        token = token.replace("O", "o")
        return token

    text = re.sub(
        r"[A-Za-z0-9._%+\-\s\(\)\[\]|]+(?:@|\(at\)|\[at\])[A-Za-z0-9.\-\s\(\)\[\]|]+",
        _fix_email,
        text,
        flags=re.I,
    )

    # Tighten phone separators from OCR noise.
    text = re.sub(r"(?<=\d)[\s_.]{2,}(?=\d)", " ", text)
    return text


def clean_resume_text(text: str) -> str:
    value = normalize_unicode_text(text)
    value = _fix_common_ocr_patterns(value)
    lines: List[str] = []
    for raw in value.split("\n"):
        line = re.sub(r"[ \t]+", " ", raw).strip()
        if line:
            lines.append(line)
    return "\n".join(lines).strip()


def _normalize_url(url: str) -> str:
    u = str(url or "").strip()
    if not u:
        return ""
    if not u.lower().startswith("http"):
        u = f"https://{u}"
    return u


def extract_contact_info(text: str) -> Dict[str, Optional[str]]:
    value = clean_resume_text(text)

    email = None
    email_match = EMAIL_RE.search(value)
    if email_match:
        email = email_match.group(0).strip().lower()

    phone = None
    for m in PHONE_RE.finditer(value):
        token = re.sub(r"[^\d+]", "", m.group(0))
        digits = re.sub(r"\D", "", token)
        if 10 <= len(digits) <= 15:
            phone = token
            break

    linkedin = None
    lm = LINKEDIN_RE.search(value)
    if lm:
        linkedin = _normalize_url(lm.group(0))

    github = None
    gm = GITHUB_RE.search(value)
    if gm:
        github = _normalize_url(gm.group(0))

    return {
        "email": email,
        "phone": phone,
        "linkedin_url": linkedin,
        "github_url": github,
    }


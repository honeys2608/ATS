"""
Rule-based resume parser with MiniLM used only for:
1) Skill normalization
2) Resume-job match scoring
"""

from __future__ import annotations

import re
from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

try:
    from loguru import logger
except Exception:  # pragma: no cover
    import logging

    logger = logging.getLogger(__name__)

try:
    import magic  # python-magic
except Exception:  # pragma: no cover
    magic = None

from .extractors.docx_extractor import extract_docx_text
from .extractors.ocr_extractor import extract_pdf_with_ocr
from .extractors.pdf_extractor import extract_pdf_text
from .text_extractor import clean_extracted_text, extract_text_from_file


EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?<!\d)(\+?\d{1,3}[\s-]?)?[6-9]\d{9}(?!\d)")
DOB_RE = re.compile(r"\b(0?[1-9]|[12][0-9]|3[01])[-/](0?[1-9]|1[0-2])[-/](19|20)\d{2}\b")
GENDER_RE = re.compile(r"\b(male|female|other)\b", re.IGNORECASE)
PINCODE_RE = re.compile(r"\b[1-9][0-9]{5}\b")
CTC_RE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:lpa|lakhs?|lacs?|inr|rs\.?|₹)\b", re.IGNORECASE)
YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")

DATE_RANGE_RE = re.compile(
    r"(?P<start>(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)?\s*[-/]?\s*(?:19|20)\d{2})\s*(?:-|–|to)\s*(?P<end>(?:present|current|till date|now|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)?\s*[-/]?\s*(?:19|20)\d{2}))",
    re.IGNORECASE,
)

NOTICE_PATTERNS = [
    re.compile(r"notice\s*period\s*[:\-]?\s*([^\n]{1,60})", re.IGNORECASE),
    re.compile(r"\b(immediate\s+joiner|immediate\s+joining|join\s+immediately)\b", re.IGNORECASE),
    re.compile(r"\b(\d{1,3})\s*(day|days|month|months|week|weeks)\s*notice\b", re.IGNORECASE),
    re.compile(r"\bnp\s*[:\-]?\s*(\d{1,3})\s*(day|days|month|months|week|weeks)\b", re.IGNORECASE),
]

READY_TO_RELOCATE_RE = re.compile(
    r"(ready to relocate|willing to relocate|open to relocation|ready for relocation)",
    re.IGNORECASE,
)
PREFERRED_LOCATION_RE = re.compile(
    r"preferred\s+location\s*[:\-]?\s*([^\n]{2,120})",
    re.IGNORECASE,
)
ADDRESS_RE = re.compile(
    r"(current address|permanent address)\s*[:\-]?\s*([^\n]{3,220})",
    re.IGNORECASE,
)
LINKEDIN_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/[^\s,]+", re.IGNORECASE)
PORTFOLIO_RE = re.compile(r"(?:https?://)?(?:www\.)?(?:github\.com|behance\.net|dribbble\.com|portfolio|personal\s*site)[^\s,]*", re.IGNORECASE)

SECTION_HEADERS = {
    "summary": ("summary", "objective", "profile", "professional summary"),
    "skills": ("skills", "technical skills", "core skills", "skill set", "technologies", "tools"),
    "experience": ("experience", "work experience", "professional experience", "employment", "work history"),
    "education": ("education", "qualification", "academics", "academic details"),
    "certifications": ("certifications", "certificates", "courses", "licenses"),
}

TITLE_KEYWORDS = {
    "engineer",
    "developer",
    "manager",
    "analyst",
    "consultant",
    "architect",
    "lead",
    "specialist",
    "designer",
    "administrator",
    "accountant",
    "qa",
    "tester",
    "recruiter",
    "sdet",
}

CITY_LIST = {
    "bengaluru",
    "bangalore",
    "mumbai",
    "delhi",
    "hyderabad",
    "chennai",
    "pune",
    "noida",
    "gurgaon",
    "mysore",
    "kolkata",
    "ahmedabad",
    "kochi",
    "bengalore",
}

DEGREE_HINTS = {
    "b.tech",
    "btech",
    "be",
    "b.e",
    "bachelor",
    "m.tech",
    "mtech",
    "mba",
    "mca",
    "bca",
    "bsc",
    "msc",
    "phd",
    "pgdm",
    "diploma",
}

SKILL_LIST = [
    "Python",
    "Java",
    "JavaScript",
    "TypeScript",
    "Node.js",
    "React",
    "HTML",
    "CSS",
    "SQL",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "FastAPI",
    "Django",
    "Flask",
    "REST API",
    "Git",
    "Docker",
    "Kubernetes",
    "AWS",
    "Azure",
    "GCP",
    "Power BI",
    "Tableau",
    "Excel",
    "ABAP",
    "SAP",
    "SAP HCM",
    "SAP FICO",
    "Payroll Processing",
    "Recruitment",
    "Talent Acquisition",
]
SKILL_ALIASES = {
    "nodejs": "Node.js",
    "reactjs": "React",
    "js": "JavaScript",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "powerbi": "Power BI",
    "sap fico": "SAP FICO",
}
TOOLS_SET = {"Git", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Power BI", "Tableau", "Excel"}
DOMAIN_SET = {"Recruitment", "Talent Acquisition", "Payroll Processing", "SAP", "SAP HCM", "SAP FICO", "ABAP"}

ALLOWED_MIME_PREFIXES = (
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
)


@lru_cache(maxsize=1)
def _get_minilm():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer("all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def _skill_embeddings():
    model = _get_minilm()
    return model.encode(SKILL_LIST, convert_to_tensor=True)


def _detect_mime(file_path: str) -> str:
    if magic is None:
        return ""
    try:
        return str(magic.from_file(file_path, mime=True) or "").lower()
    except Exception:
        return ""


def _validate_mime(file_path: str) -> None:
    mime_type = _detect_mime(file_path)
    if mime_type and not any(mime_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
        raise ValueError(f"Unsupported resume MIME type: {mime_type}")


def _split_lines(text: str) -> List[str]:
    return [line.strip() for line in str(text or "").splitlines() if line.strip()]


def _is_heading(line: str) -> Optional[str]:
    clean = re.sub(r"[^a-zA-Z ]", " ", line).strip().lower()
    if not clean or len(clean.split()) > 5:
        return None
    for key, options in SECTION_HEADERS.items():
        if any(clean == o or clean.startswith(f"{o} ") for o in options):
            return key
    return None


def _detect_sections(lines: List[str]) -> Dict[str, str]:
    sections: Dict[str, List[str]] = {k: [] for k in SECTION_HEADERS.keys()}
    current: Optional[str] = None

    for line in lines:
        heading = _is_heading(line)
        if heading:
            current = heading
            continue
        if current:
            sections[current].append(line)

    return {k: "\n".join(v).strip() for k, v in sections.items()}


def _choose_best_text(primary: str, secondary: str) -> str:
    p = (primary or "").strip()
    s = (secondary or "").strip()
    if len(s) > len(p) * 1.1:
        return s
    return p or s


def _text_quality_score(text: str) -> float:
    if not text:
        return 0.0
    printable = sum(1 for ch in text if ch.isprintable())
    alpha = sum(1 for ch in text if ch.isalpha())
    ratio_print = printable / max(1, len(text))
    ratio_alpha = alpha / max(1, len(text))
    return (ratio_print * 0.6) + (ratio_alpha * 0.4)


def _extract_text_with_method(file_path: str) -> Tuple[str, str]:
    lower = file_path.lower()
    if lower.endswith(".docx"):
        txt = extract_docx_text(file_path)
        return txt, "docx_text"

    if lower.endswith(".pdf"):
        pdf_text = extract_pdf_text(file_path)
        if len(pdf_text.strip()) >= 80 and _text_quality_score(pdf_text) >= 0.50:
            return pdf_text, "pdf_text"
        ocr = extract_pdf_with_ocr(file_path)
        best = _choose_best_text(pdf_text, ocr)
        method = "pdf_ocr" if best == ocr and len(ocr.strip()) > 0 else "pdf_text"
        return best, method

    txt = extract_text_from_file(file_path, "." + lower.rsplit(".", 1)[-1] if "." in lower else "")
    return txt, "docx_text" if lower.endswith(".doc") else "pdf_text"


def _extract_name(lines: List[str]) -> str:
    noise = {"resume", "cv", "curriculum vitae", "profile", "summary"}
    for line in lines[:8]:
        raw = (line or "").strip()
        if len(raw) < 3 or len(raw) > 60:
            continue
        if any(n in raw.lower() for n in noise):
            continue
        cleaned = re.sub(r"[^A-Za-z\s]", " ", raw)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if not cleaned:
            continue
        parts = cleaned.split()
        if 2 <= len(parts) <= 5:
            return " ".join(p.capitalize() for p in parts)
    return ""


def _pick_best_email(text: str) -> str:
    def sanitize(candidate: str) -> str:
        value = (candidate or "").strip(" ,;|")
        if value.count("@") != 1:
            return ""
        local, domain = value.split("@", 1)
        local = re.sub(r"^(india|indial|mobile|phone|contact)[^a-z0-9]*", "", local, flags=re.IGNORECASE)
        local = re.sub(r"^\+?\d{8,}", "", local)
        local = re.sub(r"\+?\d{8,}", "", local)
        tail = re.search(r"([a-z][a-z0-9._%+-]{1,40})$", local, re.IGNORECASE)
        if tail:
            local = tail.group(1)
        local = local.strip("._+-")
        if not local:
            return ""
        return f"{local}@{domain.lower()}"

    candidates = []
    for m in EMAIL_RE.finditer(text or ""):
        value = sanitize(m.group(0))
        if value.count("@") != 1:
            continue
        local, domain = value.split("@", 1)
        if len(local) > 40 or len(domain) > 120:
            continue
        if "." not in domain:
            continue
        score = 0
        if len(local) <= 24:
            score += 2
        if re.search(r"[A-Za-z]", local):
            score += 2
        if local.lower().startswith(("india", "mobile", "phone")):
            score -= 2
        if "+" in local and len(local) > 20:
            score -= 1
        candidates.append((score, value))
    if not candidates:
        return ""
    candidates.sort(key=lambda x: (-x[0], len(x[1])))
    return candidates[0][1]


def _extract_personal(lines: List[str], text: str) -> Tuple[Dict[str, Any], float]:
    header_text = "\n".join(lines[:20])

    full_name = _extract_name(lines)
    first_name = full_name.split()[0] if full_name else ""
    last_name = " ".join(full_name.split()[1:]) if len(full_name.split()) > 1 else ""

    email = _pick_best_email(text)

    phone = ""
    for match in PHONE_RE.finditer(text):
        candidate_phone = match.group(0).strip()
        if len(re.sub(r"\D", "", candidate_phone)) >= 10:
            phone = candidate_phone
            break

    dob = DOB_RE.search(text).group(0) if DOB_RE.search(text) else ""
    gender = GENDER_RE.search(text).group(1).capitalize() if GENDER_RE.search(text) else ""
    pincode = PINCODE_RE.search(text).group(0) if PINCODE_RE.search(text) else ""

    city = ""
    low = text.lower()
    for c in CITY_LIST:
        if re.search(rf"\b{re.escape(c)}\b", low):
            city = c.title()
            break

    state = ""
    country = ""
    location_line = ""
    for line in lines[:25]:
        if any(x in line.lower() for x in ["address", "location", "city", "state", "country"]):
            location_line = line
            break
    if location_line:
        parts = [p.strip() for p in re.split(r"[,|]", location_line) if p.strip()]
        if len(parts) >= 2:
            state = parts[-2]
            country = parts[-1]

    current_address = ""
    permanent_address = ""
    for m in ADDRESS_RE.finditer(text):
        label = m.group(1).lower()
        value = m.group(2).strip()
        if "current" in label:
            current_address = value
        elif "permanent" in label:
            permanent_address = value

    linkedin = LINKEDIN_RE.search(text).group(0) if LINKEDIN_RE.search(text) else ""
    portfolio = PORTFOLIO_RE.search(text).group(0) if PORTFOLIO_RE.search(text) else ""

    confidence = 0.3
    hits = sum(bool(x) for x in [full_name, email, phone, city])
    if hits >= 3:
        confidence = 0.7
    if hits >= 4 and ("personal" in low or "contact" in low):
        confidence = 1.0

    return (
        {
            "full_name": full_name,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "city": city,
            "state": state,
            "country": country,
            "current_address": current_address,
            "permanent_address": permanent_address,
            "pincode": pincode,
            "dob": dob,
            "gender": gender,
            "linkedin": linkedin,
            "portfolio": portfolio,
        },
        confidence,
    )


def _normalize_notice_days(value: str) -> Optional[int]:
    txt = (value or "").lower()
    if not txt:
        return None
    if "immediate" in txt:
        return 0
    m = re.search(r"(\d{1,3})", txt)
    if not m:
        return None
    qty = int(m.group(1))
    if "month" in txt:
        return qty * 30
    if "week" in txt:
        return qty * 7
    return qty


def _extract_notice_period(text: str) -> Tuple[str, Optional[int]]:
    for p in NOTICE_PATTERNS:
        m = p.search(text)
        if not m:
            continue
        raw = m.group(0).strip()
        if "immediate" in raw.lower():
            return "Immediate", 0
        days = _normalize_notice_days(raw)
        return raw, days
    return "", None


def _parse_ctc_amount(value: str) -> Optional[float]:
    txt = (value or "").lower().strip()
    if not txt:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)", txt)
    if not m:
        return None
    qty = float(m.group(1))
    if "lpa" in txt or "lakh" in txt or "lac" in txt:
        return qty * 100000
    return qty


def _extract_professional(lines: List[str], text: str, sections: Dict[str, str]) -> Tuple[Dict[str, Any], float]:
    top = "\n".join(lines[:30])
    exp_text = sections.get("experience") or text

    headline = ""
    primary_role = ""
    for line in lines[:15]:
        low = line.lower()
        if low.startswith(("career objective", "objective", "seeking", "summary")):
            continue
        if len(line.strip()) > 90:
            continue
        if any(k in low for k in TITLE_KEYWORDS):
            headline = line[:140]
            primary_role = line[:140]
            break

    current_designation = ""
    if sections.get("experience"):
        for line in _split_lines(sections["experience"])[:30]:
            if any(k in line.lower() for k in TITLE_KEYWORDS):
                current_designation = line[:140]
                break
    if not current_designation:
        current_designation = primary_role

    current_company = ""
    for line in _split_lines(exp_text)[:35]:
        if len(line.split()) > 12:
            continue
        if re.search(r"\b(private|limited|ltd|inc|llp|solutions|technologies|systems|corp)\b", line, re.IGNORECASE):
            current_company = line[:140]
            break

    explicit_exp = re.search(r"(\d+)\s*\+?\s*(?:years|yrs?)(?:\s*(\d+)\s*(?:months|mos?))?", text, re.IGNORECASE)
    exp_years: Optional[float] = None
    exp_months: Optional[int] = None
    if explicit_exp:
        y = int(explicit_exp.group(1))
        m = int(explicit_exp.group(2)) if explicit_exp.group(2) else 0
        exp_years = round(y + (m / 12.0), 2)
        exp_months = y * 12 + m

    notice_raw, notice_days = _extract_notice_period(text)

    current_ctc = ""
    expected_ctc = ""
    for line in lines:
        low = line.lower()
        if "current" in low and ("ctc" in low or "salary" in low):
            mm = CTC_RE.search(line)
            if mm:
                current_ctc = mm.group(0)
        if "expected" in low and ("ctc" in low or "salary" in low):
            mm = CTC_RE.search(line)
            if mm:
                expected_ctc = mm.group(0)
    if not current_ctc:
        mm = CTC_RE.search(text)
        if mm:
            current_ctc = mm.group(0)

    preferred_location = PREFERRED_LOCATION_RE.search(text)
    preferred_location_value = preferred_location.group(1).strip() if preferred_location else ""

    confidence = 0.3
    hits = sum(bool(x) for x in [headline, current_designation, current_company, notice_raw])
    if hits >= 2:
        confidence = 0.7
    if sections.get("experience"):
        confidence = 1.0

    return (
        {
            "headline": headline,
            "primary_role": primary_role,
            "current_company": current_company,
            "current_designation": current_designation,
            "total_experience_years": exp_years,
            "total_experience_months": exp_months,
            "current_ctc": _parse_ctc_amount(current_ctc),
            "expected_ctc": _parse_ctc_amount(expected_ctc),
            "notice_period_days": notice_days,
            "ready_to_relocate": (True if READY_TO_RELOCATE_RE.search(text) else None),
            "preferred_location": preferred_location_value,
        },
        confidence,
    )


def _extract_skill_candidates(text: str, section_text: str) -> Tuple[List[str], List[str]]:
    found: List[str] = []
    primary: List[str] = []

    scope = f"{section_text}\n{text}".lower()
    for skill in SKILL_LIST:
        if re.search(rf"\b{re.escape(skill.lower())}\b", scope):
            found.append(skill)

    for token in re.split(r"[,;\n|•\u2022]", section_text or ""):
        t = token.strip()
        if not t:
            continue
        k = t.lower()
        normalized = SKILL_ALIASES.get(k, t)
        found.append(normalized)
        primary.append(normalized)

    def dedupe(items: List[str]) -> List[str]:
        seen = set()
        out = []
        for i in items:
            key = i.lower().strip()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(i)
        return out

    return dedupe(found), dedupe(primary)


def _normalize_skills_semantic(candidates: List[str], threshold: float = 0.75) -> List[str]:
    if not candidates:
        return []

    try:
        model = _get_minilm()
        from sentence_transformers import util

        skill_embeds = _skill_embeddings()
        cand_embeds = model.encode(candidates, convert_to_tensor=True)
        cos = util.cos_sim(cand_embeds, skill_embeds)

        normalized: List[str] = []
        for idx, candidate in enumerate(candidates):
            row = cos[idx]
            best_idx = int(row.argmax().item())
            best_score = float(row[best_idx].item())
            if best_score >= threshold:
                normalized.append(SKILL_LIST[best_idx])
                continue
            alias = SKILL_ALIASES.get(candidate.lower().strip())
            if alias:
                normalized.append(alias)

        return list(dict.fromkeys(normalized))
    except Exception:
        fallback = []
        for c in candidates:
            alias = SKILL_ALIASES.get(c.lower().strip(), c if c in SKILL_LIST else "")
            if alias:
                fallback.append(alias)
        return list(dict.fromkeys(fallback))


def _classify_skills(skills: List[str], primary_candidates: List[str]) -> Dict[str, List[str]]:
    primary = []
    for p in primary_candidates:
        for s in skills:
            if p.lower() == s.lower() and s not in primary:
                primary.append(s)

    secondary = [s for s in skills if s not in primary]
    tools = [s for s in skills if s in TOOLS_SET]
    domains = [s for s in skills if s in DOMAIN_SET]

    return {
        "all": skills,
        "primary": primary,
        "secondary": secondary,
        "tools": tools,
        "domains": domains,
    }


def _extract_education(text: str, sections: Dict[str, str]) -> Tuple[List[Dict[str, Any]], float]:
    source = sections.get("education") or text
    lines = _split_lines(source)

    items: List[Dict[str, Any]] = []
    for i, line in enumerate(lines[:120]):
        low = line.lower()
        if not any(k in low for k in DEGREE_HINTS):
            continue

        institution = ""
        branch = ""
        score = ""
        year_start = None
        year_end = None

        if i + 1 < len(lines) and re.search(r"\b(university|college|institute)\b", lines[i + 1], re.IGNORECASE):
            institution = lines[i + 1][:160]
        else:
            if re.search(r"\b(university|college|institute)\b", line, re.IGNORECASE):
                institution = line[:160]

        year_tokens = re.findall(r"\b(?:19|20)\d{2}\b", line)
        if year_tokens:
            y = [int(tok) for tok in year_tokens]
            year_start = min(y)
            year_end = max(y)

        score_match = re.search(r"(\d(?:\.\d{1,2})?\s*(?:cgpa|/10|%))", line, re.IGNORECASE)
        if score_match:
            score = score_match.group(1)

        parts = [p.strip() for p in re.split(r"[-|,]", line) if p.strip()]
        degree = parts[0][:100] if parts else line[:100]
        if len(parts) >= 2:
            branch = parts[1][:100]

        items.append(
            {
                "degree": degree,
                "branch": branch,
                "institution": institution,
                "year_start": year_start,
                "year_end": year_end,
                "score": score,
            }
        )

    if not items:
        return [], 0.3
    return items[:10], (1.0 if sections.get("education") else 0.7)


def _extract_certifications(text: str, sections: Dict[str, str]) -> Tuple[List[Dict[str, Any]], float]:
    source = sections.get("certifications") or ""
    if not source:
        # inline fallback
        source = "\n".join([ln for ln in _split_lines(text) if "certif" in ln.lower() or "certified" in ln.lower()])

    certs: List[Dict[str, Any]] = []
    for line in _split_lines(source)[:80]:
        name = re.sub(r"^(certifications?|certificates?)\s*[:\-]?\s*", "", line, flags=re.IGNORECASE).strip()
        if not name:
            continue
        issuer_match = re.search(r"(?:issued\s+by|by)\s+([A-Za-z0-9 .,&\-]{2,80})", line, re.IGNORECASE)
        year_match = re.search(r"\b(19|20)\d{2}\b", line)
        certs.append(
            {
                "name": name[:180],
                "issuer": issuer_match.group(1).strip() if issuer_match else "",
                "year": int(year_match.group(0)) if year_match else None,
            }
        )

    # dedupe by name
    dedup: Dict[str, Dict[str, Any]] = {}
    for c in certs:
        key = c["name"].lower().strip()
        if key and key not in dedup:
            dedup[key] = c

    out = list(dedup.values())
    if not out:
        return [], 0.3
    return out[:20], (1.0 if sections.get("certifications") else 0.7)


def _guess_title_or_company(lines: List[str], idx: int) -> Tuple[str, str]:
    prev_line = lines[idx - 1] if idx > 0 else ""
    next_line = lines[idx + 1] if idx + 1 < len(lines) else ""

    title = ""
    company = ""

    if any(k in prev_line.lower() for k in TITLE_KEYWORDS):
        title = prev_line[:140]
        company = next_line[:140]
    elif any(k in next_line.lower() for k in TITLE_KEYWORDS):
        title = next_line[:140]
        company = prev_line[:140]
    else:
        company = prev_line[:140]

    return title, company


def _extract_experience(text: str, sections: Dict[str, str]) -> Tuple[List[Dict[str, Any]], float]:
    source = sections.get("experience") or text
    lines = _split_lines(source)

    idx_matches = [(i, DATE_RANGE_RE.search(line)) for i, line in enumerate(lines) if DATE_RANGE_RE.search(line)]
    if not idx_matches and not sections.get("experience"):
        return [], 0.3

    entries: List[Dict[str, Any]] = []
    for idx, m in idx_matches[:30]:
        start = m.group("start").strip()
        end_raw = m.group("end").strip()
        end = "Present" if end_raw.lower() in {"present", "current", "till date", "now"} else end_raw

        title, company = _guess_title_or_company(lines, idx)

        block_end = len(lines)
        for j in range(idx + 1, len(lines)):
            if DATE_RANGE_RE.search(lines[j]):
                block_end = j
                break
        block_lines = lines[idx + 1 : block_end]

        responsibilities = []
        details = []
        projects = []
        for bl in block_lines:
            b = bl.strip()
            if not b:
                continue
            if re.match(r"^[•\-\*]", b):
                responsibilities.append(re.sub(r"^[•\-\*]\s*", "", b))
            else:
                details.append(b)
            if "project" in b.lower():
                projects.append(
                    {
                        "name": b[:120],
                        "role": title,
                        "tech_stack": [],
                        "details": [],
                    }
                )

        start_year_match = re.search(r"(19|20)\d{2}", start)
        end_year_match = re.search(r"(19|20)\d{2}", end)
        duration_text = ""
        if start_year_match:
            s_year = int(start_year_match.group(0))
            e_year = datetime.utcnow().year if end.lower() == "present" else int(end_year_match.group(0)) if end_year_match else s_year
            duration_text = f"{max(0, e_year - s_year)} years"

        entries.append(
            {
                "company": company,
                "designation": title,
                "client": "",
                "location": "",
                "start_date": start,
                "end_date": end,
                "is_current": end.lower() == "present",
                "duration_text": duration_text,
                "summary": " ".join(details)[:600],
                "responsibilities": responsibilities[:40],
                "projects": projects[:10],
            }
        )

    return entries[:20], (1.0 if sections.get("experience") else 0.7)


def _semantic_match_score(resume_text: str, job_description: str) -> float:
    if not resume_text or not job_description:
        return 0.0
    try:
        model = _get_minilm()
        from sentence_transformers import util

        emb = model.encode([resume_text, job_description], convert_to_tensor=True)
        return float(util.cos_sim(emb[0], emb[1]).item())
    except Exception:
        return 0.0


def _build_canonical_payload(text: str, extraction_method: str, job_description: str = "") -> Dict[str, Any]:
    lines = _split_lines(text)
    sections = _detect_sections(lines)

    personal, c_personal = _extract_personal(lines, text)
    professional, c_prof = _extract_professional(lines, text, sections)

    skill_candidates, primary_candidates = _extract_skill_candidates(text, sections.get("skills") or "")
    normalized_skills = _normalize_skills_semantic(skill_candidates, threshold=0.75)
    skills = _classify_skills(normalized_skills, primary_candidates)
    c_skills = 1.0 if sections.get("skills") else (0.7 if normalized_skills else 0.3)

    education, c_edu = _extract_education(text, sections)
    certifications, c_cert = _extract_certifications(text, sections)
    experience, c_exp = _extract_experience(text, sections)

    # Derive experience if explicit missing
    if professional.get("total_experience_years") is None and experience:
        years = []
        for e in experience:
            sy = re.search(r"(19|20)\d{2}", str(e.get("start_date") or ""))
            if sy:
                years.append(int(sy.group(0)))
        if years:
            total_years = max(0, datetime.utcnow().year - min(years))
            professional["total_experience_years"] = float(total_years)
            professional["total_experience_months"] = int(total_years * 12)

    # Sync current role/company from latest experience
    if experience:
        latest = experience[0]
        professional["current_designation"] = professional.get("current_designation") or latest.get("designation") or ""
        professional["current_company"] = professional.get("current_company") or latest.get("company") or ""

    summary_source = sections.get("summary") or ""
    summary = " ".join(_split_lines(summary_source)[:5])[:600]

    match_score = _semantic_match_score(text, job_description) if job_description else 0.0

    return {
        "personal": personal,
        "professional": professional,
        "skills": skills,
        "education": education,
        "certifications": certifications,
        "experience": experience,
        "summary": summary,
        "raw_text": text,
        "extraction_method": extraction_method,
        "parser_version": "v1",
        "confidence": {
            "personal": round(c_personal, 2),
            "professional": round(c_prof, 2),
            "skills": round(c_skills, 2),
            "education": round(c_edu, 2),
            "experience": round(c_exp, 2),
            "certifications": round(c_cert, 2),
        },
        "match_score": round(max(0.0, min(1.0, match_score)) * 100.0, 2),
    }


def parse_resume_file_rule_based(file_path: str, job_description: str = "") -> Dict[str, Any]:
    """
    Parse resume using rule-based extraction only.
    MiniLM is used only for skill normalization + match score.
    """
    try:
        _validate_mime(file_path)
        raw_text, extraction_method = _extract_text_with_method(file_path)
        cleaned = clean_extracted_text(raw_text)
        payload = _build_canonical_payload(cleaned, extraction_method=extraction_method, job_description=job_description)
        return {
            "success": True,
            "data": payload,
            "raw_text": cleaned,
            "extraction_method": extraction_method,
            "parser_version": payload.get("parser_version", "v1"),
        }
    except Exception as exc:
        logger.exception("Rule-based resume parsing failed for {}", file_path)
        return {"success": False, "data": {}, "error": str(exc)}

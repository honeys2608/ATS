import os
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

try:
    import fitz  # pymupdf
except Exception:
    fitz = None

try:
    import pdfplumber
except Exception:
    pdfplumber = None

try:
    import docx2txt
except Exception:
    docx2txt = None

try:
    from docx import Document
except Exception:
    Document = None

try:
    import spacy
except Exception:
    spacy = None

try:
    import phonenumbers
except Exception:
    phonenumbers = None

_NLP = None

def _get_nlp():
    global _NLP
    if _NLP is not None:
        return _NLP
    if spacy is None:
        _NLP = None
        return _NLP
    try:
        _NLP = spacy.load("en_core_web_sm")
    except Exception:
        _NLP = None
    return _NLP

# ---------------------------
# TEXT EXTRACTION
# ---------------------------
def clean_text_block(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\u2022", "- ").replace("\uf0b7", "- ").replace("•", "- ")
    text = re.sub(r"[ \t]+", " ", text)
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines)

def extract_text(file_path: str) -> str:
    file_path_lower = file_path.lower()
    text = ""

    if file_path.lower().endswith(".pdf"):
        if fitz:
            try:
                doc = fitz.open(file_path)
                text = "\n".join(page.get_text() for page in doc)
                if text.strip():
                    return text
            except Exception:
                pass
        if pdfplumber:
            try:
                with pdfplumber.open(file_path) as pdf:
                    text = "\n".join(page.extract_text() or "" for page in pdf.pages)
                    if text.strip():
                        return text
            except Exception:
                pass

    if file_path_lower.endswith(".docx"):
        if docx2txt:
            try:
                text = docx2txt.process(file_path)
                if text.strip():
                    return text
            except Exception:
                pass
        if Document:
            try:
                doc = Document(file_path)
                text = "\n".join(p.text for p in doc.paragraphs)
                if text.strip():
                    return text
            except Exception:
                pass

    return text or ""

# ---------------------------
# NAME (spaCy NER)
# ---------------------------
def extract_name(text: str, email: Optional[str] = None) -> str:
    email_local = None
    if email and isinstance(email, str) and "@" in email:
        try:
            email_local = (email.split("@", 1)[0] or "").lower()
        except Exception:
            email_local = None

    def is_probably_not_a_name(value: str) -> bool:
        if not value:
            return True

        value = value.strip()
        if not value:
            return True

        lower = value.lower()
        if lower.startswith('experience') or lower.startswith('work experience') or lower.startswith('experience in'):
            return True
        if lower.startswith("experience") or lower.startswith("work experience") or lower.startswith("experience in"):
            return True
        if lower in {"work experience", "experience", "professional experience", "profile summary", "summary", "skills", "professional skill"}:
            return True
        if "@" in lower or "http" in lower or 'email' in lower or 'phone' in lower or 'contact' in lower:
            return True
        if "&" in value or "|" in value or "/" in value:
            return True
        if any(ch.isdigit() for ch in value):
            return True

        # Remove non-name punctuation for token analysis
        cleaned = re.sub(r"[^A-Za-z .'-]", " ", value)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if not cleaned:
            return True

        words = cleaned.split()
        if len(words) > 5 and ("-" in value or "–" in value or "—" in value or "|" in value):
            left = re.split(r"[\\-|–—|]", value, 1)[0]
            left_clean = re.sub(r"[^A-Za-z .'-]", " ", left)
            left_clean = re.sub(r"\s+", " ", left_clean).strip()
            if left_clean:
                words = left_clean.split()
        if not (1 <= len(words) <= 5):
            return True

        resume_words = {"resume", "curriculum", "vitae", "cv", "profile", "summary"}
        job_title_words = {"developer","engineer","analyst","consultant","manager","architect","programmer","specialist","intern","lead","associate","designer","tester","admin","administrator","devops","fullstack","frontend","backend","software","data","scientist","design","development","linux","sap","abap","expertise","technical","skill","skills","professional","experience"}

        lower_words = [w.lower() for w in words]
        joined = " ".join(lower_words)
        if 'experience' in lower and (' in ' in lower or ' of ' in lower):
            return True
        if "experience" in lower and re.search(r"\d+\s*(yrs?|years?)", lower):
            return True
        if '@' in joined or re.search(r"\d{6,}", joined):
            return True

        if any(w in resume_words for w in lower_words):
            return True

        # Avoid selecting a single skill (e.g., "Java") as the person's name.
        if len(lower_words) == 1 and lower_words[0] in SKILLS:
            return True

        # If we have an email, reject single-word "names" that don't match the email local-part.
        if email_local and len(lower_words) == 1:
            token = lower_words[0]
            if len(token) >= 3 and token not in email_local:
                return True

        # Avoid selecting job titles like "Java Developer" or "SAP ABAP Technical Expertise"
        if any(w in job_title_words for w in lower_words) and len(lower_words) >= 2:
            return True

        # If the line is made only of skills/tech keywords, it's not a name.
        if all((w in SKILLS) for w in lower_words):
            return True

        project_like = {'project','projects','portfolio','objective','summary','generator','story','comic','book','capstone','profile'}
        if any(tok in project_like for tok in lower_words):
            return True

        return False

    # Quick top-of-resume heuristic: first non-empty line if it passes name check
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if lines:
        first = re.sub(r"[^A-Za-z .'-]", " ", lines[0]).strip()
        if first and not is_probably_not_a_name(first):
            return first
    nlp = _get_nlp()
    if nlp:
        try:
            doc = nlp(text[:1000])
            for ent in doc.ents:
                if ent.label_ == "PERSON":
                    candidate = (ent.text or "").strip()
                    if candidate and not is_probably_not_a_name(candidate):
                        return candidate
        except Exception:
            pass

    # Fallback: scan header lines and pick first plausible name-like line.
    for line in text.splitlines()[:20]:
        line = (line or "").strip()
        if not line:
            continue
        # strip trailing role after dash / pipe
        line_head = re.split(r"[\\|–-]", line)[0].strip()
        if is_probably_not_a_name(line_head):
            continue
        cleaned = re.sub(r"[^A-Za-z .'-]", " ", line_head)
        cleaned = re.sub(r"\\s+", " ", cleaned).strip()
        if cleaned:
            return cleaned

    # Last fallback: derive from email local-part if available.
    if email:
        local = (email.split("@")[0] or "").strip()
        local = re.sub(r"[^A-Za-z]+", " ", local)
        local = re.sub(r"\s+", " ", local).strip()
        if local:
            parts = local.split()
            if 1 <= len(parts) <= 4 and not all(p.lower() in SKILLS for p in parts):
                candidate = " ".join(p.capitalize() for p in parts)
                if '@' not in candidate and not re.search(r"\d{6,}", candidate):
                    return candidate
    return None

# ---------------------------
def extract_email(text: str):
    patterns = [
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        r"[A-Za-z0-9._%+-]+\s*\[at\]\s*[A-Za-z0-9.-]+\s*\[dot\]\s*[A-Za-z]{2,}",
    ]

    for p in patterns:
        match = re.search(p, text, re.IGNORECASE)
        if match:
            email = match.group(0)
            email = email.replace("[at]", "@").replace("[dot]", ".").replace(" ", "")
            return email.lower()

    return None


# ---------------------------
# PHONE
# ---------------------------
def extract_phone(text: str):
    if phonenumbers:
        try:
            for match in phonenumbers.PhoneNumberMatcher(text, "IN"):
                return phonenumbers.format_number(
                    match.number, phonenumbers.PhoneNumberFormat.E164
                )
        except Exception:
            pass

    # Fallback regex
    match = re.search(r"(\+?\d[\d\s\-\(\)]{8,}\d)", text)
    if match:
        return re.sub(r"[^\d+]", "", match.group(1))
    return None

# ---------------------------
# EXPERIENCE (years)
# ---------------------------
def extract_experience_years(text: str) -> float:
    matches = re.findall(r"(\d+)\+?\s*(years|yrs)", text.lower())
    if matches:
        return float(max(int(m[0]) for m in matches))
    return 0.0

# ---------------------------
# SKILLS
# ---------------------------
SKILLS = {
    "python","java","react","fastapi","django","sql","aws","docker",
    "kubernetes","javascript","typescript","nodejs"
}

def extract_skills(text: str) -> List[str]:
    found = set()
    for s in SKILLS:
        if re.search(rf"\b{s}\b", text.lower()):
            found.add(s.capitalize())
    return sorted(found)

# Extended skill taxonomy for categorization
TECH_SKILLS = {
    "python","fastapi","react","javascript","typescript","node","sql","postgres","mysql","mongodb",
    "docker","kubernetes","aws","gcp","azure","linux","git"
}
SAP_SKILLS = {"abap","alv","bapi","badi","bdc","idoc","fi","mm","sd","hcm","sap"}
BMS_SKILLS = {
    "siemens desigo cc","siemens desigo","plc","scada","autocad","autocad electrical","bms","bms engineering",
    "bms design","boq","cost estimation","dcim","twincat","beckhoff"
}

def categorize_skills(text: str) -> Dict[str,List[str]]:
    found = {"technical": set(), "tools": set(), "domain": set()}
    tokens = re.split(r"[,\n;]", text)
    for tok in tokens:
        t = tok.strip()
        if not t or len(t) > 40:
            continue
        lt = t.lower()
        if lt in TECH_SKILLS:
            found["technical"].add(t)
        elif lt in SAP_SKILLS or "sap" == lt:
            found["domain"].add(t.upper() if lt == "sap" else t)
        elif lt in BMS_SKILLS:
            found["domain"].add(t)
        elif re.search(r"\b(sap|erp)\b", lt):
            found["domain"].add("SAP")
    return {k: sorted(v) for k,v in found.items()}

# ---------------------------
# EDUCATION
# ---------------------------
def extract_education(text: str):
    edu = []
    for line in text.splitlines():
        if re.search(r"(b\.?tech|bachelor|master|m\.?tech|phd)", line.lower()):
            edu.append(line.strip())
    return edu

# ---------------------------
# MAIN
# ---------------------------
def parse_resume(file_path: str) -> Dict[str, Any]:
    """
    Production-grade resume parser used by CandidateProfileAdmin.jsx.
    Returns ATS-ready structured data + confidence scores while keeping legacy keys.
    """
    text = extract_text(file_path) or ""
    cleaned = "\n".join(line.strip() for line in text.splitlines() if line.strip())

    email = extract_email(cleaned)
    phone = extract_phone(cleaned)
    name = extract_name(cleaned, email=email)
    skills_list = extract_skills(cleaned)
    education_list = extract_education(cleaned)
    experience_years = extract_experience_years(cleaned)

    experience_entries = extract_experience_entries(cleaned)
    projects = extract_projects(cleaned)
    certifications = extract_certifications(cleaned)
    location = extract_location(cleaned)

    education_str = ", ".join(str(e) for e in education_list if e) if education_list else ""

    current_role = ""
    current_company = ""
    if experience_entries:
        # Sort by start date (desc) so most recent/current first
        def sort_key(entry):
            dt = _parse_date(entry.get("start_date", ""))
            return dt or datetime.min
        experience_entries = sorted(experience_entries, key=sort_key, reverse=True)
        # Prefer an entry whose end_date is Present/Current
        present_entry = next(
            (e for e in experience_entries if str(e.get("end_date", "")).lower() in {"present", "current"}),
            experience_entries[0],
        )
        current_role = present_entry.get("role", "") or ""
        current_company = present_entry.get("company", "") or ""

    industry = infer_industry(skills_list, cleaned)

    total_exp_display = format_experience_years(experience_years)

    # Confidence heuristics
    conf = {
        "full_name": 0.92 if name else 0.4,
        "email": 0.97 if email else 0.3,
        "phone": 0.9 if phone else 0.35,
        "location": 0.65 if location else 0.3,
        "skills": 0.88 if skills_list else 0.4,
        "experience": 0.75 if experience_entries else 0.35,
        "education": 0.7 if education_list else 0.3,
        "projects": 0.55 if projects else 0.3,
        "certifications": 0.55 if certifications else 0.3,
        "industry": 0.8 if industry else 0.3,
    }

    data = {
        "full_name": name,
        "email": email,
        "phone": phone,
        "location": location,
        "industry": industry,
        "total_experience": total_exp_display,
        "experience_years": experience_years,
        "skills": skills_list,
        "experience": experience_entries,
        "education": education_str,
        "education_list": education_list,
        "projects": projects,
        "certifications": certifications,
        "current_role": current_role,
        "current_company": current_company,
        "resume_text": cleaned[:4000],
        "confidences": conf,
    }

    return {"success": True, "data": data}


# ---------------------------------------------------------------------------
# Additional extraction helpers tuned for ATS fields
# ---------------------------------------------------------------------------

DATE_PATTERN = re.compile(
    r"(?P<start>(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})"
    r"\s*[-–to]+\s*"
    r"(?P<end>(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}|Present|Current)",
    re.IGNORECASE,
)

SAP_SKILLS = {
    "ABAP",
    "ALV",
    "BAPI",
    "BADI",
    "BDC",
    "WebDynpro",
    "SmartForms",
    "SAP Script",
    "Adobe Forms",
    "IDOC",
    "FI",
    "MM",
    "SD",
    "HCM",
}


def format_experience_years(years: float) -> str:
    if years is None:
        return ""
    if years >= 0:
        return f"{years:.1f} yrs" if years % 1 else f"{int(years)} yrs"
    return ""


def extract_location(text: str) -> str:
    # very lightweight heuristic: pick first occurrence of City, State pattern
    match = re.search(r"\b([A-Z][a-zA-Z]+[, ]+(?:[A-Z][a-zA-Z]+))(?:,?\s+[A-Z]{2})?", text)
    return match.group(1).strip() if match else ""


def extract_projects(text: str) -> List[Dict[str, Any]]:
    projects = []
    for line in text.splitlines():
        if line.lower().startswith("project") or line.lower().startswith("proj:"):
            projects.append({"name": line.strip(), "description": ""})
    return projects


def extract_certifications(text: str) -> List[Dict[str, Any]]:
    certs = []
    for line in text.splitlines():
        if re.search(r"certification|certified|certificate", line, re.IGNORECASE):
            certs.append({"name": line.strip()})
    return certs


def extract_experience_entries(text: str) -> List[Dict[str, Any]]:
    entries = []
    lines = text.splitlines()
    for i, line in enumerate(lines):
        date_match = DATE_PATTERN.search(line)
        if date_match:
            start = date_match.group("start")
            end = date_match.group("end")
            # Heuristic: role typically 1-2 lines above the date, company just above the date
            role = ""
            company = ""
            if i >= 2:
                role = lines[i - 2].strip()
                company = lines[i - 1].strip()
            elif i >= 1:
                role = lines[i - 1].strip()
            if "|" in company:
                company = company.split("|", 1)[0].strip()
            desc_lines = []
            for j in range(i + 2, min(i + 8, len(lines))):
                if DATE_PATTERN.search(lines[j]):
                    break
                desc_lines.append(lines[j].strip())
            entries.append(
                {
                    "company": company,
                    "role": role,
                    "start_date": start,
                    "end_date": end,
                    "description": " ".join(desc_lines).strip(),
                }
            )
    return entries

def _parse_date(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        value = value.replace("Sept", "Sep").replace("sept", "Sep")
        return datetime.strptime(value.strip(), "%b %Y")
    except Exception:
        try:
            return datetime.strptime(value.strip(), "%Y")
        except Exception:
            return None

def _parse_date(value: str) -> Optional[datetime]:
    try:
        value = value.replace("Sept", "Sep").replace("sept", "Sep")
        return datetime.strptime(value.strip(), "%b %Y")
    except Exception:
        try:
            return datetime.strptime(value.strip(), "%Y")
        except Exception:
            return None


def infer_industry(skills: List[str], text: str) -> str:
    text_lower = text.lower()
    if any("sap" in s.lower() for s in skills) or any(k.lower() in text_lower for k in ["sap", "erp", "abap"]):
        return "ERP / Enterprise Software"
    return ""


# Extend skills extraction to include SAP taxonomy labels
def extract_skills(text: str) -> List[str]:
    base = set()
    # simple comma/line based
    EXTRA = {
        "bms", "bms design", "bms engineering", "autocad", "autocad electrical",
        "ms excel", "siemens desigo cc", "boq", "cost estimation",
        "plc", "scada", "beckhoff", "twincat", "dcim", "sap"
    }

    for token in re.split(r"[,\n;]", text):
        tok = token.strip()
        if 2 <= len(tok) <= 40 and re.search(r"[A-Za-z]", tok):
            if tok.upper() in SAP_SKILLS:
                base.add(tok.upper())
            else:
                low = tok.lower()
                if low in {"python", "java", "javascript", "react", "node", "sql", "aws", "docker"} or low in EXTRA:
                    base.add(tok)
    # also add SAP taxonomy if mentioned
    for sap_skill in SAP_SKILLS:
        if re.search(rf"\b{re.escape(sap_skill)}\b", text, re.IGNORECASE):
            base.add(sap_skill)
    return sorted(base)

# ----------------------------------------------------------
# Strict ATS schema parser (wrapper + confidences)
# ----------------------------------------------------------
def months_between(start: Optional[datetime], end: Optional[datetime]) -> int:
    if not start or not end:
        return 0
    return max(0, (end.year - start.year) * 12 + (end.month - start.month))

def compute_total_experience_years(entries: List[Dict[str, Any]]) -> float:
    months = 0
    for e in entries:
        s = _parse_date(e.get("start_date", ""))
        end_raw = e.get("end_date", "")
        end_dt = datetime.utcnow() if str(end_raw).lower() in {"present", "current"} else _parse_date(end_raw)
        months += months_between(s, end_dt)
    return round(months / 12.0, 1) if months else 0.0

def infer_industry_from_skills(skills: Dict[str,List[str]], text: str) -> str:
    t = text.lower()
    all_sk = {s.lower() for v in skills.values() for s in v}
    if any(s in all_sk for s in SAP_SKILLS) or "sap" in t or "erp" in t:
        return "ERP / Enterprise Software"
    if any(k in t for k in ["plc","scada","bms","siemens desigo","autocad"]):
        return "Industrial / Automation"
    if any(k in t for k in ["fastapi","react","node","postgres","mysql","kubernetes","docker"]):
        return "Software / IT"
    return ""

def wrap(value, conf):
    return {"value": value, "confidence": round(conf, 2)}

def parse_resume_structured(file_path: str) -> Dict[str, Any]:
    text = extract_text(file_path) or ""
    cleaned = clean_text_block(text)

    email = extract_email(cleaned)
    phone = extract_phone(cleaned)
    name = extract_name(cleaned, email=email)
    location = extract_location(cleaned)

    skills_cat = categorize_skills(cleaned)
    legacy_sk = extract_skills(cleaned)
    if legacy_sk:
        skills_cat["technical"] = sorted(set(skills_cat["technical"] + legacy_sk))

    experience_entries = extract_experience_entries(cleaned)
    total_years = compute_total_experience_years(experience_entries)

    education_list = extract_education(cleaned)
    projects = extract_projects(cleaned)
    certifications = extract_certifications(cleaned)

    current_role = ""
    current_company = ""
    if experience_entries:
        present = next(
            (e for e in experience_entries if str(e.get("end_date","")).lower() in {"present","current"}),
            experience_entries[0],
        )
        current_role = present.get("role","") or ""
        current_company = present.get("company","") or ""

    industry = infer_industry_from_skills(skills_cat, cleaned)

    return {
        "full_name": wrap(name, 0.9 if name else 0.4),
        "email": wrap(email, 0.98 if email else 0.3),
        "phone": wrap(phone, 0.9 if phone else 0.4),
        "location": wrap(location, 0.65 if location else 0.3),
        "industry": wrap(industry, 0.8 if industry else 0.3),
        "total_experience_years": wrap(total_years, 0.85 if total_years else 0.4),
        "skills": wrap(skills_cat, 0.85 if any(skills_cat.values()) else 0.4),
        "experience": wrap(experience_entries, 0.78 if experience_entries else 0.35),
        "education": wrap(education_list, 0.7 if education_list else 0.3),
        "projects": wrap(projects, 0.5 if projects else 0.3),
        "certifications": wrap(certifications, 0.5 if certifications else 0.3),
    }









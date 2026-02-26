"""
Utility extractors for contact info, education, skills, and experience.
"""

import re
from typing import Dict, List, Optional, Set, Tuple
import logging

logger = logging.getLogger(__name__)


class ContactExtractor:
    """Extract email, phone, location, and other contact information."""
    LOCATION_HINT_WORDS = {
        "india",
        "karnataka",
        "maharashtra",
        "tamil",
        "nadu",
        "andhra",
        "telangana",
        "delhi",
        "bangalore",
        "bengaluru",
        "mumbai",
        "pune",
        "hyderabad",
        "chennai",
        "noida",
        "gurgaon",
        "kolkata",
        "kochi",
        "mysore",
        "remote",
        "onsite",
        "hybrid",
        "dubai",
        "london",
        "singapore",
        "usa",
        "uk",
    }

    LOCATION_NOISE_WORDS = {
        "worked",
        "working",
        "experience",
        "knowledge",
        "responsible",
        "responsibilities",
        "project",
        "projects",
        "college",
        "university",
        "clarification",
        "issues",
        "ticket",
        "tickets",
        "candidate",
        "payroll",
        "involved",
        "support",
    }
    
    def extract(self, text: str) -> Dict:
        """
        Extract contact information from resume.
        
        Returns:
            {
                'email': str or None,
                'phone': str or None,
                'alternate_phone': str or None,
                'location': str or None,
            }
        """
        return {
            'email': self._extract_email(text),
            'phone': self._extract_phone(text),
            'alternate_phone': self._extract_alternate_phone(text),
            'location': self._extract_location(text),
        }
    
    def _extract_email(self, text: str) -> Optional[str]:
        """Extract email address."""
        pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        match = re.search(pattern, text)
        return match.group(0) if match else None
    
    def _extract_phone(self, text: str) -> Optional[str]:
        """Extract primary phone number."""
        # Indian phone patterns
        patterns = [
            r'\+91[- ]?[789]\d{9}',  # +91-9876543210
            r'0[789]\d{9}',  # 09876543210
            r'[789]\d{9}(?![0-9])',  # 9876543210
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                phone = match.group(0)
                # Format: +91-9876543210
                if not phone.startswith('+'):
                    if phone.startswith('0'):
                        phone = '+91-' + phone[1:]
                    else:
                        phone = '+91-' + phone
                return phone
        
        # International patterns
        pattern = r'\+\d{1,3}[- ]?\d{1,14}'
        match = re.search(pattern, text)
        return match.group(0) if match else None
    
    def _extract_alternate_phone(self, text: str) -> Optional[str]:
        """Extract alternate phone number (second occurrence)."""
        patterns = [
            r'\+91[- ]?[789]\d{9}',
            r'0[789]\d{9}',
            r'[789]\d{9}(?![0-9])',
        ]
        
        found_phones = []
        for pattern in patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                phone = match.group(0)
                if not phone.startswith('+'):
                    if phone.startswith('0'):
                        phone = '+91-' + phone[1:]
                    else:
                        phone = '+91-' + phone
                found_phones.append(phone)
        
        # Return second phone if exists
        if len(found_phones) > 1:
            return found_phones[1]
        
        return None
    
    def _extract_location(self, text: str) -> Optional[str]:
        """Extract location/city from resume."""
        lines = [line.strip() for line in text.splitlines() if line and line.strip()]
        header_lines = lines[:25]

        # Prefer header lines where contact info usually appears.
        for line in header_lines:
            candidate = self._extract_location_from_line(line)
            if candidate:
                return candidate

        # Fallback to explicit labels anywhere in resume.
        labeled_match = re.search(
            r"(?:current\s+location|location|city)\s*[:\-]\s*([^\n]{2,80})",
            text,
            re.IGNORECASE,
        )
        if labeled_match:
            candidate = self._clean_location_candidate(labeled_match.group(1))
            if candidate:
                return candidate

        return None

    def _extract_location_from_line(self, line: str) -> Optional[str]:
        text = line.strip()
        if not text:
            return None
        if "@" in text or "http://" in text.lower() or "https://" in text.lower():
            return None

        # Labeled patterns like "Location: Bengaluru, Karnataka"
        label_match = re.match(
            r"^(?:current\s+location|location|city)\s*[:\-]\s*(.+)$",
            text,
            re.IGNORECASE,
        )
        if label_match:
            return self._clean_location_candidate(label_match.group(1))

        # Typical "City, State[, Country]" line.
        csv_match = re.match(
            r"^([A-Za-z][A-Za-z\s]{1,30})(?:,\s*([A-Za-z][A-Za-z\s]{1,30}))(?:,\s*([A-Za-z][A-Za-z\s]{1,30}))?$",
            text,
        )
        if csv_match:
            parts = [part.strip() for part in csv_match.groups() if part and part.strip()]
            return self._clean_location_candidate(", ".join(parts))

        # Single location word if it is a known city/state/country hint.
        low = text.lower()
        if low in self.LOCATION_HINT_WORDS:
            return self._clean_location_candidate(text)

        return None

    def _clean_location_candidate(self, value: str) -> Optional[str]:
        if not value:
            return None

        text = str(value).strip()
        text = re.sub(r"^[\-\*\u2022\.,\s]+", "", text)
        text = re.sub(r"[\-\*\u2022\.,\s]+$", "", text)
        text = re.sub(r"\s+", " ", text)
        if not text:
            return None

        # Keep only primary location segment.
        for sep in (" | ", " - ", " / "):
            if sep in text:
                text = text.split(sep, 1)[0].strip()
                break

        if len(text) < 2 or len(text) > 60:
            return None
        if "@" in text or "http://" in text.lower() or "https://" in text.lower():
            return None

        # Reject likely non-location narrative phrases.
        words = [w for w in re.split(r"[\s,]+", text.lower()) if w]
        if not words or len(words) > 6:
            return None
        if any(word in self.LOCATION_NOISE_WORDS for word in words):
            return None

        digit_count = sum(1 for ch in text if ch.isdigit())
        if digit_count > 3:
            return None

        has_hint = any(word in self.LOCATION_HINT_WORDS for word in words)
        has_comma = "," in text
        if not has_hint and not has_comma and len(words) > 3:
            return None

        return text


class EducationExtractor:
    """Extract education details from resume."""
    
    DEGREE_PATTERNS = {
        'Bachelor': ['B.Tech', 'B.E', 'B.Sc', 'BS', 'Bachelor', 'B Engr'],
        'Master': ['M.Tech', 'M.E', 'M.Sc', 'MS', 'Master', 'MBA'],
        'Diploma': ['Diploma', 'Dip'],
        'PhD': ['PhD', 'Ph.D', 'Doctorate'],
        'High School': ['12th', 'HSC', 'High School', 'Secondary'],
    }
    
    def extract(self, text: str) -> List[Dict]:
        """Extract education entries."""
        education_section = self._find_education_section(text)
        
        if not education_section:
            return []
        
        entries = []
        blocks = re.split(r'\n\s*\n', education_section)
        
        for block in blocks:
            entry = self._parse_education_entry(block)
            if entry:
                entries.append(entry)
        
        return entries
    
    def _find_education_section(self, text: str) -> Optional[str]:
        """Find education section."""
        pattern = r'(?:education|academic|qualifications)[\s\n:]+(.+?)(?=\n\s*(?:skills|experience|projects|certifications|\Z))'
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        return match.group(1) if match else None
    
    def _parse_education_entry(self, block: str) -> Optional[Dict]:
        """Parse single education entry."""
        if len(block.strip()) < 10:
            return None
        
        degree = None
        institution = None
        field = None
        year = None
        
        # Try to find degree
        for full_name, abbreviations in self.DEGREE_PATTERNS.items():
            for abbr in abbreviations:
                if re.search(r'\b' + re.escape(abbr) + r'\b', block, re.IGNORECASE):
                    degree = full_name
                    break
            if degree:
                break
        
        # Find year
        year_match = re.search(r'(\d{4})', block)
        if year_match:
            year = int(year_match.group(1))
        
        # Try to find institution (usually capitalized multi-word term)
        lines = block.split('\n')
        for line in lines:
            if degree and degree in line:
                continue
            if len(line.strip()) > 5 and line.strip()[0].isupper():
                institution = line.strip()
                break
        
        if degree and institution:
            return {
                'degree': degree,
                'institution': institution,
                'field_of_study': field,
                'start_year': None,
                'end_year': year,
            }
        
        return None


class SkillsExtractor:
    """Extract only recruiter-searchable professional skills."""

    SKILL_SECTION_HEADERS = {
        "skills",
        "technical skills",
        "core skills",
        "core competencies",
        "competencies",
        "key skills",
        "skill set",
        "tools",
        "technologies",
        "expertise",
    }

    STOP_SECTION_HEADERS = {
        "experience",
        "work experience",
        "professional experience",
        "employment history",
        "education",
        "certifications",
        "projects",
        "languages",
        "summary",
        "profile summary",
        "objective",
        "declaration",
        "references",
        "personal information",
    }

    SOURCE_CONFIDENCE = {
        "skills_section": 95,
        "experience_section": 82,
        "full_text": 74,
    }

    SKILL_CATALOG = {
        "erp_tools": [
            "SAP",
            "SAP HCM",
            "SAP SuccessFactors",
            "SAP Payroll",
            "SAP Fiori",
            "SAP ONB",
            "SAP RCM",
            "SAP Time Management",
            "SAP ESS/MSS",
            "SAP OM",
            "SAP PA",
            "SAP CATS",
            "SAP RMK",
            "SAP FICO",
            "SAP MM",
            "SAP SD",
            "SAP Configuration",
            "SAP Implementation",
            "SuccessFactors LMS",
            "SuccessFactors BizX",
            "FieldGlass",
            "ADP",
            "ADP Payroll",
            "Workday",
            "Oracle HCM",
            "Zoho People",
            "Darwinbox",
            "PeopleStrong",
            "GreytHR",
            "Keka",
            "PMGK",
            "Tally ERP",
            "Tally Prime",
        ],
        "hr_payroll_domain": [
            "Payroll Processing",
            "Payroll Management",
            "End-to-End Payroll",
            "Salary Processing",
            "Compensation & Benefits",
            "Benefits Administration",
            "Leave Management",
            "Attendance Management",
            "Employee Onboarding",
            "Talent Acquisition",
            "Recruitment",
            "Talent Management",
            "Performance Management",
            "KRA/KPI Setting",
            "HR Operations",
            "HRIS Management",
            "HR Analytics",
            "Employee Relations",
            "HR Compliance",
            "HR Policies",
            "Organizational Development",
            "Workforce Planning",
            "Learning & Development",
            "Training & Development",
            "Statutory Compliance",
            "Labor Laws",
            "PF Compliance",
            "ESI Compliance",
            "PT Compliance",
            "TDS Management",
            "Gratuity Management",
            "Bonus Calculation",
            "Form 16",
            "IT Declaration",
            "Exit Management",
            "Full & Final Settlement",
            "F&F Processing",
            "Offer Letter Generation",
            "Appointment Letters",
            "Background Verification",
            "HRMS Implementation",
            "Workflow Management",
            "UAT",
        ],
        "finance_accounting": [
            "Accounts Payable",
            "Accounts Receivable",
            "Bank Reconciliation",
            "Financial Reporting",
            "MIS Reporting",
            "Balance Sheet",
            "P&L Statement",
            "GST Filing",
            "TDS Returns",
            "Tax Compliance",
            "Audit Support",
            "Budgeting",
            "Forecasting",
            "Cash Flow Management",
            "Cost Center Accounting",
            "Fixed Assets Accounting",
            "General Ledger",
        ],
        "technical": [
            "Python",
            "Java",
            "JavaScript",
            "TypeScript",
            "C++",
            "C#",
            "ABAP",
            "SQL",
            "PL/SQL",
            "HTML",
            "CSS",
            "React",
            "Node.js",
            "FastAPI",
            "Django",
            "Flask",
            "Express",
            "Spring Boot",
            "REST API",
            "Git",
            "GitHub",
            "Docker",
            "Kubernetes",
            "AWS",
            "Azure",
            "GCP",
            "MongoDB",
            "MySQL",
            "PostgreSQL",
            "Oracle Database",
            "Power BI",
            "Tableau",
            "Advanced Excel",
            "Excel",
            "Postman",
            "API Testing",
        ],
        "compliance_regulatory": [
            "GDPR Compliance",
            "SOX Compliance",
            "PF & ESI Compliance",
            "Labor Law Compliance",
        ],
        "soft_skills": [
            "Communication",
            "Team Leadership",
            "Problem Solving",
            "Time Management",
            "Stakeholder Management",
            "Conflict Resolution",
            "Analytical Thinking",
        ],
    }

    ALIAS_SEED = {
        "SAP SuccessFactors": {"successfactors", "success factors", "sap success factors", "sap successfactor"},
        "SAP Fiori": {"fiori", "sap fiori"},
        "FieldGlass": {"field glass", "fieldglass"},
        "SAP ONB": {"onb", "sap onb", "onboarding 2.0"},
        "SAP RCM": {"rcm", "sap rcm"},
        "SAP CATS": {"cats", "sap cats"},
        "SAP RMK": {"rmk", "sap rmk"},
        "SAP ESS/MSS": {"ess", "mss", "ess/mss", "sap ess", "sap mss"},
        "SAP FICO": {"fico", "sap fico"},
        "ADP Payroll": {"adp payroll"},
        "Payroll Processing": {"payroll", "salary processing", "end to end payroll", "end-to-end payroll"},
        "Attendance Management": {"attendance"},
        "Compensation & Benefits": {"compensation", "benefits", "compensation and benefits"},
        "Workflow Management": {"workflow"},
        "Training & Development": {"training and development", "learning and development"},
        "PF Compliance": {"pf"},
        "ESI Compliance": {"esi"},
        "PT Compliance": {"pt"},
        "Background Verification": {"bgv"},
        "Full & Final Settlement": {"full and final settlement", "full & final settlement", "f&f settlement"},
        "F&F Processing": {"f and f processing", "f&f processing"},
        "Advanced Excel": {"advanced excel"},
        "REST API": {"rest api", "rest apis"},
        "Oracle Database": {"oracle"},
        "SAP Implementation": {"sap implementation"},
        "SAP Configuration": {"sap configuration"},
    }

    REJECT_TOKENS = {
        "and", "or", "the", "of", "in", "for", "to", "at", "by", "with", "on", "from",
        "as", "into", "via", "per", "about", "between", "across", "within", "through",
        "during", "after", "before", "until", "while", "although", "other", "identifying",
        "travel", "ensure", "time", "public", "involvement", "involved", "team", "enhancements",
        "correction", "personal", "good", "defined", "executed", "changes", "responsible",
        "productivity", "user", "upgrade", "smart", "preparing", "post", "functional", "prepared",
        "organizational", "implementation", "knowledge", "groups", "role", "actively", "go",
        "suggestion", "positive", "provide", "escalating", "handle", "requirement", "standards",
        "handling", "preparation", "screen", "end", "medical", "configuring", "assist", "info",
        "providing", "testing", "coordinating", "working", "client", "supporting", "problem",
        "cross", "having", "define", "lead", "managing", "worked", "writing", "area", "day",
        "unit", "modules", "applications", "module", "project", "projects", "resume", "candidate",
        "profile", "summary", "experience", "professional", "technical", "component", "clarification",
        "issues", "tickets", "ticket", "support", "college", "university", "school", "company",
        "location", "region", "country", "south", "north", "east", "west",
    }

    REJECT_LOCATION_TOKENS = {
        "india", "germany", "netherlands", "uae", "qatar", "oman", "bangalore", "bengaluru",
        "hyderabad", "mumbai", "delhi", "pune", "chennai", "mysore", "chittoor", "supaul",
    }

    MONTH_TOKENS = {
        "jan", "january", "feb", "february", "mar", "march", "apr", "april", "may",
        "jun", "june", "jul", "july", "aug", "august", "sep", "sept", "september",
        "oct", "october", "nov", "november", "dec", "december", "q1", "q2", "q3", "q4",
        "fy", "fy2022", "fy2023", "fy2024", "fy2025", "fy2026",
    }

    COMPOUND_HINT_SUFFIXES = {
        "management",
        "processing",
        "compliance",
        "reporting",
        "reconciliation",
        "development",
        "administration",
        "verification",
        "settlement",
        "acquisition",
        "onboarding",
        "analytics",
        "operations",
        "testing",
    }

    def __init__(self):
        self._all_canonical_skills = self._build_canonical_skills()
        self._alias_to_skill = self._build_alias_map()
        self._alias_patterns = self._build_alias_patterns()

    def extract(self, text: str) -> List[str]:
        """Extract strict, industry-recognized skills with confidence threshold."""
        clean_text = self._normalize_text(text)
        if not clean_text:
            return []

        scored: Dict[str, int] = {}

        for section in self._find_sections(clean_text, self.SKILL_SECTION_HEADERS):
            self._collect_skills(section, "skills_section", scored)
            for candidate in self._tokenize_section_items(section):
                canonical = self._canonicalize_token(candidate)
                if canonical:
                    scored[canonical] = max(scored.get(canonical, 0), self.SOURCE_CONFIDENCE["skills_section"])

        for section in self._find_sections(clean_text, {"experience", "work experience", "professional experience"}):
            self._collect_skills(section, "experience_section", scored)

        self._collect_skills(clean_text, "full_text", scored)

        return self._finalize(scored)

    def _normalize_text(self, text: str) -> str:
        cleaned = str(text or "")
        cleaned = cleaned.replace("•", "\n").replace("\u2022", "\n")
        cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        return cleaned

    def _build_canonical_skills(self) -> Set[str]:
        skills: Set[str] = set()
        for items in self.SKILL_CATALOG.values():
            skills.update(items)
        return skills

    def _build_alias_map(self) -> Dict[str, str]:
        alias_map: Dict[str, str] = {}

        for canonical in self._all_canonical_skills:
            alias_map[self._normalize_skill_key(canonical)] = canonical

        for canonical, aliases in self.ALIAS_SEED.items():
            if canonical not in self._all_canonical_skills:
                continue
            for alias in aliases:
                alias_map[self._normalize_skill_key(alias)] = canonical

        return alias_map

    def _build_alias_patterns(self) -> List[Tuple[str, re.Pattern]]:
        patterns: List[Tuple[str, re.Pattern]] = []
        seen: Set[Tuple[str, str]] = set()
        for alias_key, canonical in self._alias_to_skill.items():
            if not alias_key or (canonical, alias_key) in seen:
                continue
            seen.add((canonical, alias_key))
            token = re.escape(alias_key).replace(r"\ ", r"\s+")
            pattern = re.compile(rf"(?<![A-Za-z0-9]){token}(?![A-Za-z0-9])", re.IGNORECASE)
            patterns.append((canonical, pattern))
        return patterns

    def _find_sections(self, text: str, headers: Set[str]) -> List[str]:
        if not text:
            return []
        header_re = "|".join(re.escape(header) for header in sorted(headers))
        stop_re = "|".join(re.escape(header) for header in sorted(self.STOP_SECTION_HEADERS))
        pattern = re.compile(
            rf"(?:^|\n)\s*(?:{header_re})\s*:?\s*(?:\n|$)(.+?)(?=\n\s*(?:{stop_re})\s*:?\s*(?:\n|$)|\Z)",
            re.IGNORECASE | re.DOTALL,
        )
        return [m.group(1) for m in pattern.finditer(text)]

    def _collect_skills(self, text: str, source: str, scored: Dict[str, int]) -> None:
        confidence = self.SOURCE_CONFIDENCE.get(source, 70)
        lowered = self._normalize_skill_key(text)
        for canonical, pattern in self._alias_patterns:
            if pattern.search(lowered):
                scored[canonical] = max(scored.get(canonical, 0), confidence)

    def _tokenize_section_items(self, text: str) -> List[str]:
        candidates: List[str] = []
        for raw_line in text.splitlines():
            line = re.sub(r"^[\-\*\u2022\s]+", "", raw_line).strip()
            if not line:
                continue
            if ":" in line:
                left, right = line.split(":", 1)
                if len(left.split()) <= 3:
                    line = right.strip()
            parts = re.split(r"[,\n;|]+", line)
            for part in parts:
                token = part.strip(" .:-\t")
                if token:
                    candidates.append(token)
        return candidates

    def _canonicalize_token(self, token: str) -> Optional[str]:
        if self._is_rejected_token(token):
            return None

        norm = self._normalize_skill_key(token)
        if not norm:
            return None

        canonical = self._alias_to_skill.get(norm)
        if canonical:
            return canonical

        # Accept only structured compound phrases that look like real skill labels.
        words = [w for w in norm.split() if w]
        if 2 <= len(words) <= 4 and words[-1] in self.COMPOUND_HINT_SUFFIXES:
            phrase = " ".join(word.capitalize() if word.isalpha() else word for word in words)
            if not self._is_rejected_token(phrase):
                return phrase

        return None

    def _normalize_skill_key(self, value: str) -> str:
        text = str(value or "").strip().lower()
        text = text.replace("&", " and ")
        text = re.sub(r"[^\w#+/.\- ]+", " ", text)
        text = text.replace("/", " / ")
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _is_rejected_token(self, token: str) -> bool:
        raw = str(token or "").strip()
        if not raw:
            return True
        if "@" in raw or "http://" in raw.lower() or "https://" in raw.lower():
            return True

        words = [w for w in re.split(r"[\s/,&\-]+", raw.lower()) if w]
        if not words or len(words) > 6:
            return True

        if any(re.fullmatch(r"(19|20)\d{2}", w) for w in words):
            return True
        if any(re.fullmatch(r"\d+", w) for w in words):
            return True
        if any(w in self.MONTH_TOKENS for w in words):
            return True
        if any(w in self.REJECT_LOCATION_TOKENS for w in words):
            return True

        # Reject if all words are stop/noise words.
        if all(w in self.REJECT_TOKENS for w in words):
            return True

        # Reject single generic filler words.
        if len(words) == 1 and words[0] in self.REJECT_TOKENS:
            return True

        return False

    def _finalize(self, scored: Dict[str, int]) -> List[str]:
        filtered = {
            skill: confidence
            for skill, confidence in scored.items()
            if confidence >= 70 and not self._is_rejected_token(skill)
        }
        ordered = sorted(filtered.keys(), key=lambda skill: (-filtered[skill], -len(skill), skill.lower()))

        deduped: List[str] = []
        for skill in ordered:
            key = self._normalize_skill_key(skill)
            replaced = False
            for idx, existing in enumerate(deduped):
                existing_key = self._normalize_skill_key(existing)
                if key == existing_key:
                    replaced = True
                    break
                if re.search(rf"\b{re.escape(existing_key)}\b", key) and len(key) > len(existing_key):
                    deduped[idx] = skill
                    replaced = True
                    break
                if re.search(rf"\b{re.escape(key)}\b", existing_key) and len(existing_key) >= len(key):
                    replaced = True
                    break
            if not replaced:
                deduped.append(skill)

        return deduped[:60]


class ExperienceCalculator:
    """Calculate total experience from work history."""
    
    def calculate(self, text: str, work_entries: Optional[List[Dict]] = None) -> Optional[str]:
        """
        Calculate total experience in years/months.
        
        Tries multiple approaches:
        1. Explicit statement in text ("7 years experience")
        2. Calculate from work entries dates
        3. Naukri format in filename (e.g., "6y_0m")
        """
        # Approach 1: Look for explicit statement
        explicit = self._extract_explicit_experience(text)
        if explicit:
            return explicit
        
        # Approach 2: Calculate from work entries
        if work_entries:
            calculated = self._calculate_from_entries(work_entries)
            if calculated:
                return calculated
        
        return None
    
    def _extract_explicit_experience(self, text: str) -> Optional[str]:
        """Extract explicit experience statements."""
        patterns = [
            r'(\d+)\s*(?:\+)?\s*years?\s+of\s+(?:professional\s+)?experience',
            r'experience\s*:\s*(\d+)\s*(?:\+)?\s*years?',
            r'(\d+)\s*(?:\+)?\s*years?\s+(\d+)\s*months?',
            r'(\d+)y\s+(\d+)m',  # Naukri format: 6y 0m
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 1:
                    return f"{groups[0]}+ years" if '+' in match.group(0) else f"{groups[0]} years"
                elif len(groups) == 2:
                    years, months = groups[0], groups[1]
                    return f"{years}y {months}m"
        
        return None
    
    def _calculate_from_entries(self, entries: List[Dict]) -> Optional[str]:
        """Calculate experience from work entries."""
        if not entries:
            return None
        
        # This would require parsing dates from entries
        # For now, simplified version
        return None


"""Resume parser orchestrator with semantic field extraction."""

import logging
import re
from datetime import date, datetime
from typing import Dict, List, Optional, Tuple

from .models import (
    CertificationEntry,
    EducationEntry,
    ParsedResume,
    ParsingMetadata,
    ProjectEntry,
    ResumeParseResponse,
    WorkExperienceEntry,
)
from .name_extractor import NameExtractor
from .position_extractor import CurrentPositionExtractor
from .utility_extractors import ContactExtractor, EducationExtractor, ExperienceCalculator, SkillsExtractor

logger = logging.getLogger(__name__)

DATE_RANGE_RE = re.compile(
    r"(?P<start>(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{2,4}|\d{4})"
    r"\s*(?:-|to)\s*"
    r"(?P<end>(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{2,4}|\d{4}|present|current|ongoing)",
    re.IGNORECASE,
)

ROLE_TITLE_KEYWORDS = {
    "engineer",
    "developer",
    "manager",
    "analyst",
    "consultant",
    "architect",
    "lead",
    "specialist",
    "executive",
    "officer",
    "intern",
    "designer",
    "administrator",
    "devops",
    "qa",
    "tester",
    "associate",
    "director",
    "head",
    "coordinator",
    "principal",
    "staff",
    "recruiter",
    "accountant",
    "moderator",
    "moderation",
}

ROLE_NOISE_KEYWORDS = {
    "worked",
    "working",
    "experience",
    "knowledge",
    "responsible",
    "responsibilities",
    "project",
    "projects",
    "ticket",
    "tickets",
    "clarification",
    "issues",
    "resolution",
    "candidate",
    "college",
    "university",
    "payroll",
    "involved",
    "support",
}


class ResumeParser:
    """Main parser."""

    def __init__(self):
        self.name_extractor = NameExtractor()
        self.position_extractor = CurrentPositionExtractor()
        self.contact_extractor = ContactExtractor()
        self.education_extractor = EducationExtractor()
        self.skills_extractor = SkillsExtractor()
        self.experience_calculator = ExperienceCalculator()

    def parse(self, raw_text: str, filename: str = "") -> ResumeParseResponse:
        text = self._normalize_text(raw_text)
        if len(text) < 10:
            return self._error_response(filename, "Extracted text is too short to parse")

        try:
            name_result = self.name_extractor.extract_name(text)
            full_name = name_result.get("name") or "Unknown"
            contact = self.contact_extractor.extract(text)
            try:
                position = self.position_extractor.extract_current_position(text) or {}
            except Exception as pos_exc:
                logger.debug("Current position extraction failed: %s", pos_exc)
                position = {}

            skills = [
                skill
                for skill in self.skills_extractor.extract(text)
                if str(skill or "").strip().lower() not in {"present", "current", "experience", "work"}
            ]
            education_raw = self.education_extractor.extract(text)
            education = self._to_education_entries(text, education_raw)
            work = self._extract_work_entries(text, skills, position)
            certs = self._extract_certifications(text)
            projects = self._extract_projects(text, skills)

            notice = self._extract_notice_period(text)
            current_ctc, expected_ctc = self._extract_ctc(text)
            preferred_location = self._clean_location_value(
                self._extract_label(text, "preferred location")
            )
            ready_to_relocate = self._extract_yes_no(text, "(?:willing|ready)\\s+to\\s+relocate")
            professional_summary = self._extract_summary(text)
            gender = self._extract_label(text, "gender")
            dob = self._extract_dob(text)
            current_address = self._extract_label(text, "current address")
            permanent_address = self._extract_label(text, "permanent address")
            city = self._clean_location_value(self._extract_label(text, "city"))
            pincode = self._extract_pincode(text)
            languages = self._extract_languages(text)
            current_location = self._pick_best_location(
                contact.get("location"),
                city,
                preferred_location,
            )

            current_company = (work[0].company if work else None) or position.get("current_company")
            current_designation = (work[0].designation if work else None) or position.get("current_designation")
            if self._is_section_label(current_company):
                current_company = work[0].company if work else None
            if self._is_section_label(current_designation) or not self._looks_like_designation(current_designation or ""):
                fallback_designation = work[0].designation if work else None
                current_designation = (
                    fallback_designation
                    if self._looks_like_designation(fallback_designation or "")
                    else None
                )

            total_experience = self.experience_calculator.calculate(
                text,
                [entry.model_dump() for entry in work],
            ) or self._derive_experience_from_work(work)

            parsed = ParsedResume(
                full_name=full_name if full_name and full_name != "Name Not Found" else "Unknown",
                email=contact.get("email"),
                phone=contact.get("phone"),
                alternate_phone=contact.get("alternate_phone"),
                current_company=current_company,
                current_designation=current_designation,
                current_location=current_location,
                preferred_location=preferred_location,
                notice_period=notice,
                ready_to_relocate=ready_to_relocate,
                current_ctc=current_ctc,
                expected_ctc=expected_ctc,
                professional_summary=professional_summary,
                work_experience=work,
                education=education,
                skills=skills,
                certifications=certs,
                projects=projects,
                languages=languages,
                date_of_birth=dob,
                gender=self._clean_gender(gender),
                current_address=current_address,
                permanent_address=permanent_address,
                city=city or current_location,
                pincode=pincode,
                total_experience=total_experience,
            )

            fields = {
                "full_name": bool(parsed.full_name and parsed.full_name != "Unknown"),
                "email": bool(parsed.email),
                "phone": bool(parsed.phone),
                "current_designation": bool(parsed.current_designation),
                "current_company": bool(parsed.current_company),
                "skills": bool(parsed.skills),
                "education": bool(parsed.education),
                "work_experience": bool(parsed.work_experience),
                "certifications": bool(parsed.certifications),
                "notice_period": bool(parsed.notice_period),
            }
            extracted = [k for k, ok in fields.items() if ok]
            failed = [k for k, ok in fields.items() if not ok]
            confidence = self._overall_confidence(parsed)
            status = "success" if confidence >= 0.75 else "partial" if confidence >= 0.4 else "failed"

            return ResumeParseResponse(
                status=status,
                parsed_data=parsed,
                metadata=ParsingMetadata(
                    name_confidence=float(name_result.get("confidence") or 0.0),
                    overall_confidence=confidence,
                    parsing_method=name_result.get("method") or "heuristic",
                    fields_extracted=extracted,
                    fields_failed=failed,
                    warnings=[] if extracted else ["Very low extraction coverage"],
                ),
                file_info={
                    "filename": filename,
                    "parsed_at": datetime.utcnow().isoformat(),
                    "text_length": len(text),
                },
            )
        except Exception as exc:
            logger.error("Resume parsing failed: %s", exc, exc_info=True)
            return self._error_response(filename, str(exc))

    def _error_response(self, filename: str, message: str) -> ResumeParseResponse:
        return ResumeParseResponse(
            status="failed",
            parsed_data=ParsedResume(full_name="Error Processing Resume"),
            metadata=ParsingMetadata(
                name_confidence=0.0,
                overall_confidence=0.0,
                parsing_method="error",
                fields_extracted=[],
                fields_failed=[],
                warnings=[message],
            ),
            file_info={"filename": filename, "error": message},
        )

    def _normalize_text(self, text: str) -> str:
        text = (text or "").replace("\uf0b7", "- ").replace("\u2022", "- ")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
        return "\n".join([line for line in lines if line])

    def _to_education_entries(self, text: str, entries: List[Dict]) -> List[EducationEntry]:
        out: List[EducationEntry] = []
        for edu in entries or []:
            try:
                out.append(
                    EducationEntry(
                        degree=edu.get("degree") or "Unknown",
                        institution=edu.get("institution") or "Unknown",
                        field_of_study=edu.get("field_of_study"),
                        start_year=edu.get("start_year"),
                        end_year=edu.get("end_year"),
                        cgpa=self._to_float(edu.get("cgpa")),
                        percentage=self._to_float(edu.get("percentage")),
                    )
                )
            except Exception:
                continue
        if out:
            return out

        section = self._extract_section(text, ["education", "academic", "qualifications"])
        for line in section.splitlines():
            if not re.search(r"\b(b\.?tech|b\.?e|bachelor|m\.?tech|m\.?e|master|mba|phd|diploma)\b", line, re.IGNORECASE):
                continue
            year = re.search(r"\b((?:19|20)\d{2})\b", line)
            parts = [part.strip() for part in re.split(r"[-|,]", line) if part.strip()]
            try:
                out.append(
                    EducationEntry(
                        degree=parts[0] if parts else "Unknown",
                        institution=parts[1] if len(parts) > 1 else "Unknown",
                        end_year=int(year.group(1)) if year else None,
                    )
                )
            except Exception:
                continue
        return out[:10]

    def _extract_work_entries(self, text: str, skills: List[str], position: Dict) -> List[WorkExperienceEntry]:
        section = self._extract_section(text, ["work experience", "professional experience", "employment history", "experience"]) or text
        blocks = re.split(r"\n\s*\n", section)
        entries: List[WorkExperienceEntry] = []

        for block in blocks:
            lines = [re.sub(r"^[\-\*\u2022]+\s*", "", line).strip() for line in block.splitlines() if line.strip()]
            if len(lines) < 2:
                continue

            company = next((line for line in lines[:5] if self._looks_like_company(line)), lines[0])
            designation = next((line for line in lines[:5] if self._looks_like_designation(line) and line != company), "")
            if not designation:
                designation = next(
                    (
                        line
                        for line in lines[1:6]
                        if line != company and self._looks_like_designation(line)
                    ),
                    "",
                )
            if not designation:
                for line in lines[:8]:
                    match = re.search(
                        r"\bas\s+(?:an?\s+)?([A-Za-z][A-Za-z/&\-\s]{2,60})\s+(?:from|at|in|for)\b",
                        line,
                        re.IGNORECASE,
                    )
                    if not match:
                        continue
                    candidate_designation = match.group(1).strip()
                    if self._looks_like_designation(candidate_designation):
                        designation = candidate_designation
                        break
            if not designation:
                continue

            date_line = next((line for line in lines[:8] if DATE_RANGE_RE.search(line)), "")
            start_date = end_date = None
            is_current = False
            if date_line:
                match = DATE_RANGE_RE.search(date_line)
                if match:
                    start_date = match.group("start").title()
                    end_raw = match.group("end")
                    is_current = end_raw.lower() in {"present", "current", "ongoing"}
                    end_date = "Present" if is_current else end_raw.title()

            technologies = sorted(
                set(
                    skill for skill in skills if re.search(rf"\b{re.escape(skill)}\b", block, re.IGNORECASE)
                )
            )
            project = next((line for line in lines if re.search(r"\bproject\b", line, re.IGNORECASE)), None)
            years = self._years_from_dates(start_date, end_date, is_current)

            try:
                entries.append(
                    WorkExperienceEntry(
                        company=company[:140],
                        designation=designation[:140],
                        start_date=start_date,
                        end_date=end_date,
                        is_current=is_current,
                        technologies=technologies,
                        skills_learned=technologies,
                        project_done=project,
                        years=years,
                    )
                )
            except Exception:
                continue

        if entries:
            return entries[:20]

        fallback_entries = self._extract_work_entries_from_patterns(text, skills)
        if fallback_entries:
            return fallback_entries[:20]

        fallback_company = position.get("current_company")
        fallback_desig = position.get("current_designation")
        if fallback_company or fallback_desig:
            try:
                return [
                    WorkExperienceEntry(
                        company=fallback_company or "Unknown",
                        designation=fallback_desig or "Professional",
                        is_current=True,
                    )
                ]
            except Exception:
                return []
        return []

    def _extract_work_entries_from_patterns(self, text: str, skills: List[str]) -> List[WorkExperienceEntry]:
        lines = [re.sub(r"^[\-\*\u2022]+\s*", "", line).strip() for line in text.splitlines() if line.strip()]
        entries: List[WorkExperienceEntry] = []
        seen = set()

        def _add_entry(company: str, designation: str, source_text: str, is_current_hint: Optional[bool] = None):
            company = str(company or "").strip(" -,:;.")
            designation = str(designation or "").strip(" -,:;.")
            if not company or not designation:
                return
            if not self._looks_like_designation(designation):
                return

            start_date, end_date, is_current = self._parse_date_range_from_text(source_text)
            if is_current_hint is not None:
                is_current = bool(is_current_hint)
                if is_current and not end_date:
                    end_date = "Present"

            technologies = sorted(
                set(skill for skill in (skills or []) if re.search(rf"\b{re.escape(skill)}\b", source_text, re.IGNORECASE))
            )
            years = self._years_from_dates(start_date, end_date, is_current)
            key = (
                company.lower(),
                designation.lower(),
                (start_date or "").lower(),
                (end_date or "").lower(),
            )
            if key in seen:
                return
            seen.add(key)
            try:
                entries.append(
                    WorkExperienceEntry(
                        company=company[:140],
                        designation=designation[:140],
                        start_date=start_date,
                        end_date=end_date,
                        is_current=is_current,
                        technologies=technologies,
                        skills_learned=technologies,
                        years=years,
                    )
                )
            except Exception:
                return

        worked_with_pattern = re.compile(
            r"(?:currently\s+associated\s+with|associated\s+with|worked\s+with)\s+(.+?)\s*,?\s+as\s+(?:an?\s+)?(.+?)(?:\(|$)",
            re.IGNORECASE,
        )

        for idx, line in enumerate(lines):
            m = worked_with_pattern.search(line)
            if m:
                company = re.sub(r"\s{2,}", " ", m.group(1)).strip()
                designation = re.sub(r"\s{2,}", " ", m.group(2)).strip(" .,-")
                designation = re.split(r"\s+for\s+", designation, maxsplit=1, flags=re.IGNORECASE)[0].strip()
                _add_entry(company, designation, line)
                continue

            m_client = re.match(r"(?:client|project)\s*:\s*(.+?)(?:\s*\(([^)]*)\))?$", line, re.IGNORECASE)
            if not m_client:
                continue

            company = m_client.group(1).strip(" -,:;.")
            date_hint = m_client.group(2) or line
            designation = ""
            for look_ahead in lines[idx + 1 : idx + 9]:
                m_role = re.search(
                    r"\b(?:working|worked)\s+as\s+(?:an?\s+)?([A-Za-z][A-Za-z/&\-\s]{2,90})",
                    look_ahead,
                    re.IGNORECASE,
                )
                if not m_role:
                    continue
                designation = m_role.group(1).strip(" .,-")
                designation = re.split(r"\s+(?:focusing|specializing|on|for)\b", designation, maxsplit=1, flags=re.IGNORECASE)[0].strip()
                break
            if designation:
                source = f"{line} {date_hint}"
                _add_entry(company, designation, source)

        return entries[:20]

    def _parse_date_range_from_text(self, value: str) -> Tuple[Optional[str], Optional[str], bool]:
        text = str(value or "")
        match = DATE_RANGE_RE.search(text)
        if match:
            start = match.group("start").title()
            end_raw = match.group("end")
            end_low = end_raw.lower()
            is_current = end_low in {"present", "current", "ongoing"}
            end = "Present" if is_current else end_raw.title()
            return start, end, is_current

        alt = re.search(
            r"(?P<start>(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{2,4}|\d{4})\s*[–-]\s*(?P<end>till(?:\s+the)?\s+date|till\s+date|present|current|ongoing|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{2,4}|\d{4})",
            text,
            re.IGNORECASE,
        )
        if not alt:
            return None, None, False

        start = alt.group("start").title()
        end_raw = alt.group("end")
        end_low = end_raw.lower().strip()
        is_current = end_low in {"present", "current", "ongoing", "till date", "till the date"}
        end = "Present" if is_current else end_raw.title()
        return start, end, is_current

    def _extract_certifications(self, text: str) -> List[CertificationEntry]:
        section = self._extract_section(text, ["certifications", "certification", "licenses", "license"]) or text
        certs: List[CertificationEntry] = []
        seen = set()
        for line in section.splitlines():
            if not re.search(r"\b(certification|certified|certificate|license|credential)\b", line, re.IGNORECASE):
                continue
            name = re.sub(r"^(certification|certified|certificate|credential)\s*[:\-]?\s*", "", line, flags=re.IGNORECASE).strip()
            if not name:
                continue
            if name.lower() in seen:
                continue
            seen.add(name.lower())
            url = None
            uid = None
            m_url = re.search(r"(https?://[^\s)]+)", line, re.IGNORECASE)
            if m_url:
                url = m_url.group(1)
            m_id = re.search(r"(?:credential\s*id|id)\s*[:#]?\s*([A-Za-z0-9\-_/.]+)", line, re.IGNORECASE)
            if m_id:
                uid = m_id.group(1)
            try:
                certs.append(CertificationEntry(name=name[:160], credential_id=uid, credential_url=url))
            except Exception:
                continue
        return certs[:20]

    def _extract_projects(self, text: str, skills: List[str]) -> List[ProjectEntry]:
        section = self._extract_section(text, ["projects", "project portfolio", "key projects"])
        if not section:
            return []
        out: List[ProjectEntry] = []
        for block in re.split(r"\n\s*\n", section):
            lines = [line.strip() for line in block.splitlines() if line.strip()]
            if not lines:
                continue
            name = re.sub(r"^(project|proj)\s*[:\-]?\s*", "", lines[0], flags=re.IGNORECASE).strip()
            if not name:
                continue
            description = " ".join(lines[1:3]).strip() if len(lines) > 1 else None
            tech = [skill for skill in skills if re.search(rf"\b{re.escape(skill)}\b", block, re.IGNORECASE)]
            try:
                out.append(ProjectEntry(name=name[:160], description=description, technologies=sorted(set(tech))))
            except Exception:
                continue
        return out[:20]

    def _extract_notice_period(self, text: str) -> Optional[str]:
        if re.search(r"\b(immediate joiner|immediate joining|available immediately)\b", text, re.IGNORECASE):
            return "Immediate"
        m = re.search(r"(?:notice period|notice)\s*[:\-]?\s*(\d{1,3})\s*(day|days|month|months)", text, re.IGNORECASE)
        if not m:
            return None
        return f"{m.group(1)} {'months' if m.group(2).startswith('month') else 'days'}"

    def _extract_ctc(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        cur = re.search(r"(?:current ctc|current salary|present ctc)\s*[:\-]?\s*([^\n,;]{1,40})", text, re.IGNORECASE)
        exp = re.search(r"(?:expected ctc|expected salary|expected compensation)\s*[:\-]?\s*([^\n,;]{1,40})", text, re.IGNORECASE)
        return (cur.group(1).strip() if cur else None, exp.group(1).strip() if exp else None)

    def _extract_dob(self, text: str) -> Optional[date]:
        m = re.search(r"(?:dob|date of birth|birth date)\s*[:\-]?\s*([0-3]?\d[\/\-][01]?\d[\/\-](?:19|20)\d{2})", text, re.IGNORECASE)
        if not m:
            return None
        val = m.group(1)
        for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%m-%d-%Y"):
            try:
                return datetime.strptime(val, fmt).date()
            except Exception:
                continue
        return None

    def _extract_languages(self, text: str) -> List[str]:
        section = self._extract_section(text, ["languages", "language proficiency"])
        if not section:
            return []
        parts = [p.strip() for p in re.split(r"[,\n;|]", section) if p.strip()]
        return sorted(set(p.title() for p in parts if len(p) <= 40))[:20]

    def _extract_label(self, text: str, label: str) -> Optional[str]:
        m = re.search(rf"(?:{label})\s*[:\-]?\s*([^\n]{{2,180}})", text, re.IGNORECASE)
        return m.group(1).strip() if m else None

    def _extract_yes_no(self, text: str, label: str) -> Optional[bool]:
        m = re.search(rf"(?:{label})\s*[:\-]?\s*(yes|no|y|n|true|false)", text, re.IGNORECASE)
        if not m:
            return True if re.search(label, text, re.IGNORECASE) else None
        return m.group(1).lower() in {"yes", "y", "true"}

    def _extract_pincode(self, text: str) -> Optional[str]:
        m = re.search(r"(?:pincode|pin code|zip code|postal code)\s*[:\-]?\s*(\d{5,6})", text, re.IGNORECASE)
        if m:
            return m.group(1)
        m = re.search(r"\b\d{6}\b", text)
        return m.group(0) if m else None

    def _clean_location_value(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        text = str(value).strip()
        text = re.sub(r"^[\-\*\u2022\.,\s]+", "", text)
        text = re.sub(r"[\-\*\u2022\.,\s]+$", "", text)
        text = re.sub(r"\s+", " ", text)
        if not text:
            return None

        for sep in (" | ", " - ", " / "):
            if sep in text:
                text = text.split(sep, 1)[0].strip()
                break

        if len(text) < 2 or len(text) > 60:
            return None
        if "@" in text or "http://" in text.lower() or "https://" in text.lower():
            return None

        words = [w for w in re.split(r"[\s,]+", text.lower()) if w]
        if not words or len(words) > 6:
            return None

        location_noise = {
            "worked",
            "working",
            "experience",
            "knowledge",
            "responsible",
            "responsibilities",
            "project",
            "projects",
            "ticket",
            "tickets",
            "clarification",
            "issues",
            "resolution",
            "candidate",
            "college",
            "university",
            "payroll",
            "involved",
            "support",
        }
        if any(word in location_noise for word in words):
            return None

        digit_count = sum(1 for ch in text if ch.isdigit())
        if digit_count > 3:
            return None

        location_hints = {
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
        has_hint = any(word in location_hints for word in words)
        has_comma = "," in text
        if not has_hint and not has_comma and len(words) > 3:
            return None

        return text

    def _pick_best_location(self, *values: Optional[str]) -> Optional[str]:
        for value in values:
            cleaned = self._clean_location_value(value)
            if cleaned:
                return cleaned
        return None

    def _clean_gender(self, gender: Optional[str]) -> Optional[str]:
        if not gender:
            return None
        val = gender.strip().lower()
        if val.startswith("m"):
            return "Male"
        if val.startswith("f"):
            return "Female"
        if "non" in val:
            return "Non-binary"
        if val in {"other", "o"}:
            return "Other"
        return None

    def _extract_summary(self, text: str) -> Optional[str]:
        section = self._extract_section(text, ["professional summary", "summary", "profile summary", "objective"])
        if not section:
            return None
        return " ".join(section.splitlines()[:5])[:800]

    def _extract_section(self, text: str, headers: List[str]) -> str:
        lines = text.splitlines()
        start = -1
        for i, line in enumerate(lines):
            low = re.sub(r"[^a-z ]", " ", line.lower())
            low = re.sub(r"\s+", " ", low).strip()
            if any(low == header or low.startswith(f"{header} ") for header in headers):
                start = i + 1
                break
        if start < 0:
            return ""
        end_headers = ["education", "skills", "certifications", "projects", "languages", "declaration", "references"]
        end = len(lines)
        for i in range(start, len(lines)):
            low = re.sub(r"[^a-z ]", " ", lines[i].lower())
            low = re.sub(r"\s+", " ", low).strip()
            if any(low == header or low.startswith(f"{header} ") for header in end_headers):
                end = i
                break
        return "\n".join(lines[start:end]).strip()

    def _derive_experience_from_work(self, work: List[WorkExperienceEntry]) -> Optional[str]:
        nums = [self._to_float(item.years) for item in work if item.years]
        nums = [num for num in nums if num is not None]
        if not nums:
            return None
        years = round(max(nums), 1)
        return f"{int(years)} years" if years.is_integer() else f"{years} years"

    def _years_from_dates(self, start: Optional[str], end: Optional[str], current: bool) -> Optional[str]:
        if not start:
            return None
        sdt = self._parse_month_year(start)
        edt = datetime.utcnow() if current else self._parse_month_year(end or "")
        if not sdt or not edt:
            return None
        months = max(0, (edt.year - sdt.year) * 12 + (edt.month - sdt.month))
        return str(round(months / 12, 1))

    def _parse_month_year(self, value: str) -> Optional[datetime]:
        for fmt in ("%b %Y", "%B %Y", "%Y"):
            try:
                return datetime.strptime((value or "").strip(), fmt)
            except Exception:
                continue
        return None

    def _to_float(self, value) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(str(value).strip())
        except Exception:
            return None

    def _looks_like_company(self, text: str) -> bool:
        low = text.lower()
        suffixes = ("ltd", "limited", "pvt", "inc", "llc", "technologies", "solutions", "services", "systems", "corp", "company")
        return any(token in low for token in suffixes) or (len(text.split()) >= 2 and text[:1].isupper())

    def _looks_like_designation(self, text: str) -> bool:
        raw = (text or "").strip()
        if len(raw) < 3 or len(raw) > 100:
            return False

        low = raw.lower()
        company_tokens = ("ltd", "limited", "pvt", "inc", "llc", "solutions", "technologies", "services", "company")
        if any(token in low for token in company_tokens):
            return False

        if "@" in low or "http://" in low or "https://" in low:
            return False
        if re.search(r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b", low):
            return False
        if re.search(r"\b(19|20)\d{2}\b", low):
            return False
        if re.search(r"\d{4,}", low):
            return False

        words = [w for w in re.split(r"[\s,/|()\-]+", low) if w]
        if not words or len(words) > 8:
            return False
        if any(word in ROLE_NOISE_KEYWORDS for word in words):
            return False
        if "." in raw and len(words) > 4:
            return False

        has_role_keyword = any(word in ROLE_TITLE_KEYWORDS for word in words)
        if not has_role_keyword:
            return False

        return True

    def _is_section_label(self, value: Optional[str]) -> bool:
        if not value:
            return True
        low = str(value).strip().lower()
        section_words = {
            "work experience",
            "experience",
            "employment history",
            "professional experience",
            "skills",
            "education",
            "projects",
            "certifications",
        }
        return low in section_words

    def _overall_confidence(self, parsed: ParsedResume) -> float:
        weights = {
            "full_name": (0.2, bool(parsed.full_name and parsed.full_name != "Unknown")),
            "email": (0.12, bool(parsed.email)),
            "phone": (0.12, bool(parsed.phone)),
            "designation": (0.14, bool(parsed.current_designation)),
            "company": (0.1, bool(parsed.current_company)),
            "skills": (0.1, bool(parsed.skills)),
            "education": (0.08, bool(parsed.education)),
            "work": (0.08, bool(parsed.work_experience)),
            "notice": (0.03, bool(parsed.notice_period)),
            "location": (0.03, bool(parsed.preferred_location or parsed.current_location)),
        }
        return min(sum(weight for weight, present in weights.values() if present), 1.0)

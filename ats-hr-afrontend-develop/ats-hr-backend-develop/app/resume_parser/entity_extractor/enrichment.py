import os
import re
from functools import lru_cache
from typing import Any, Dict, List, Optional


@lru_cache(maxsize=1)
def _get_spacy_nlp():
    try:
        import spacy
    except Exception:
        return None

    for model_name in ("en_core_web_trf", "en_core_web_lg", "en_core_web_sm"):
        try:
            return spacy.load(model_name)
        except Exception:
            continue
    return None


@lru_cache(maxsize=1)
def _get_hf_ner():
    if str(os.getenv("ENABLE_HF_NER", "")).strip().lower() not in {"1", "true", "yes", "on"}:
        return None
    try:
        from transformers import pipeline
    except Exception:
        return None
    try:
        return pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
    except Exception:
        return None


@lru_cache(maxsize=1)
def _get_hf_zero_shot():
    if str(os.getenv("ENABLE_HF_ZERO_SHOT", "")).strip().lower() not in {"1", "true", "yes", "on"}:
        return None
    try:
        from transformers import pipeline
    except Exception:
        return None
    try:
        return pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
    except Exception:
        return None


@lru_cache(maxsize=1)
def _get_pyresparser():
    try:
        from pyresparser import ResumeParser

        return ResumeParser
    except Exception:
        return None


@lru_cache(maxsize=1)
def _get_skill_extractor():
    try:
        from skillextractor.named_entity_recognition_scorer import SkillExtractor
        from skillextractor.base import SKILL_DB
        from spacy.matcher import PhraseMatcher
    except Exception:
        return None

    nlp = _get_spacy_nlp()
    if nlp is None:
        return None
    try:
        return SkillExtractor(nlp, SKILL_DB, PhraseMatcher)
    except Exception:
        return None


def _normalize_skills(skills: List[Any]) -> List[str]:
    out: List[str] = []
    seen = set()
    for item in skills or []:
        token = str(item or "").strip()
        if not token:
            continue
        low = token.lower()
        if low in seen:
            continue
        seen.add(low)
        out.append(token)
    return out


def _merge_skills(existing: List[str], additions: List[str]) -> List[str]:
    return _normalize_skills([*(existing or []), *(additions or [])])


def _looks_like_designation(value: str) -> bool:
    raw = str(value or "").strip()
    if not raw or len(raw) < 3 or len(raw) > 90:
        return False
    low = raw.lower()
    if "@" in low or "http://" in low or "https://" in low:
        return False
    if any(token in low for token in ("project", "projects", "address", "education", "college", "university")):
        return False

    role_words = {
        "engineer", "developer", "manager", "analyst", "consultant", "architect",
        "lead", "specialist", "executive", "officer", "intern", "designer",
        "administrator", "devops", "qa", "tester", "associate", "director",
        "head", "coordinator", "principal", "staff", "recruiter",
    }
    words = [w for w in re.split(r"[\s,/|()\-]+", low) if w]
    if not words or len(words) > 8:
        return False
    return any(w in role_words for w in words)


def _extract_candidate_lines(text: str) -> List[str]:
    lines = []
    for line in str(text or "").splitlines():
        cleaned = " ".join(line.strip().split())
        if not cleaned:
            continue
        if len(cleaned) < 3 or len(cleaned) > 120:
            continue
        lines.append(cleaned)
    return lines[:300]


def _extract_designation_zero_shot(text: str) -> Optional[str]:
    classifier = _get_hf_zero_shot()
    if classifier is None:
        return None

    candidate_labels = [
        "job title",
        "company name",
        "responsibility sentence",
        "location/address",
        "education detail",
    ]
    hypothesis = "This text is a {}."

    best_line = None
    best_score = 0.0
    for line in _extract_candidate_lines(text):
        if not _looks_like_designation(line):
            continue
        try:
            result = classifier(
                line,
                candidate_labels=candidate_labels,
                hypothesis_template=hypothesis,
                multi_label=True,
            )
        except Exception:
            continue

        labels = result.get("labels") or []
        scores = result.get("scores") or []
        score_map = {str(label).lower(): float(score) for label, score in zip(labels, scores)}
        job_title_score = score_map.get("job title", 0.0)
        if job_title_score > best_score:
            best_score = job_title_score
            best_line = line

    if best_line and best_score >= 0.45:
        return best_line
    return None


def enrich_with_optional_ai(
    *,
    text: str,
    file_path: str,
    parsed_data: Dict[str, Any],
) -> Dict[str, Any]:
    data = dict(parsed_data or {})
    working_text = str(text or "")

    # pyresparser (resume specific extraction)
    resume_parser_cls = _get_pyresparser()
    if resume_parser_cls is not None and os.path.exists(file_path):
        try:
            rr = resume_parser_cls(file_path).get_extracted_data() or {}
            if not data.get("full_name"):
                data["full_name"] = rr.get("name") or data.get("full_name")
            if not data.get("email"):
                data["email"] = rr.get("email") or data.get("email")
            if not data.get("phone"):
                data["phone"] = rr.get("mobile_number") or data.get("phone")
            if rr.get("skills"):
                data["skills"] = _merge_skills(data.get("skills") or [], rr.get("skills") or [])
            if not data.get("experience_years") and rr.get("total_experience") is not None:
                data["experience_years"] = rr.get("total_experience")
            if not data.get("current_designation"):
                designation = rr.get("designation")
                if isinstance(designation, list):
                    designation = designation[0] if designation else None
                if designation and _looks_like_designation(str(designation)):
                    data["current_designation"] = str(designation).strip()
                    data["current_role"] = str(designation).strip()
        except Exception:
            pass

    # spaCy entities
    nlp = _get_spacy_nlp()
    if nlp is not None and working_text:
        try:
            doc = nlp(working_text[:200000])
            persons = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
            orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
            locations = [ent.text for ent in doc.ents if ent.label_ in {"GPE", "LOC"}]
            if not data.get("full_name") and persons:
                data["full_name"] = persons[0]
            if not data.get("current_company") and orgs:
                data["current_company"] = orgs[0]
            if not data.get("current_location") and locations:
                data["current_location"] = locations[0]
        except Exception:
            pass

    # HuggingFace NER fallback signal
    hf_ner = _get_hf_ner()
    if hf_ner is not None and working_text:
        try:
            ents = hf_ner(working_text[:5000]) or []
            if not data.get("full_name"):
                for ent in ents:
                    if ent.get("entity_group") == "PER":
                        data["full_name"] = ent.get("word")
                        break
        except Exception:
            pass

    # zero-shot fallback for job title/designation
    if not data.get("current_designation") and working_text:
        designation = _extract_designation_zero_shot(working_text)
        if designation:
            data["current_designation"] = designation
            data["current_role"] = designation
            data["designation"] = designation

    # skill-extractor-cogito (if present)
    skill_extractor = _get_skill_extractor()
    if skill_extractor is not None and working_text:
        try:
            annotations = skill_extractor.annotate(working_text)
            skill_names = []
            for match in ((annotations or {}).get("results") or {}).get("full_matches") or []:
                name = match.get("skill_name") or match.get("doc_node_value")
                if name:
                    skill_names.append(str(name))
            if skill_names:
                data["skills"] = _merge_skills(data.get("skills") or [], skill_names)
        except Exception:
            pass

    return data

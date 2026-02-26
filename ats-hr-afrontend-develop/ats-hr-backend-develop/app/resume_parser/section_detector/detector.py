from functools import lru_cache
from typing import Dict, List, Tuple

SECTION_KEYWORDS = {
    "PERSONAL_INFO": ["contact", "personal", "about", "profile", "details"],
    "SUMMARY": ["summary", "objective", "overview", "about me"],
    "EXPERIENCE": ["experience", "employment", "work history", "career"],
    "EDUCATION": ["education", "qualification", "academic", "degree"],
    "SKILLS": ["skills", "technical skills", "competencies", "expertise"],
    "CERTIFICATIONS": ["certification", "certificate", "license"],
    "PROJECTS": ["projects", "portfolio", "works"],
    "LANGUAGES": ["languages", "linguistic"],
}


@lru_cache(maxsize=1)
def _get_zero_shot_classifier():
    try:
        from transformers import pipeline
    except Exception:
        return None
    try:
        return pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
    except Exception:
        return None


def _split_blocks(text: str) -> List[str]:
    value = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    blocks = [b.strip() for b in value.split("\n\n") if b.strip()]
    if blocks:
        return blocks
    return [ln.strip() for ln in value.split("\n") if ln.strip()]


def _keyword_match(line: str) -> str:
    low = str(line or "").strip().lower()
    for section, keywords in SECTION_KEYWORDS.items():
        for token in keywords:
            if token in low:
                return section
    return ""


def _classify_unknown_block(block: str) -> str:
    classifier = _get_zero_shot_classifier()
    if classifier is None:
        return "SUMMARY"
    labels = [
        "work experience",
        "education",
        "skills",
        "certifications",
        "personal information",
        "projects",
        "summary",
        "languages",
    ]
    try:
        result = classifier(block[:1500], labels, multi_label=False)
        top = (result.get("labels") or ["summary"])[0].lower()
    except Exception:
        top = "summary"

    mapping = {
        "work experience": "EXPERIENCE",
        "education": "EDUCATION",
        "skills": "SKILLS",
        "certifications": "CERTIFICATIONS",
        "personal information": "PERSONAL_INFO",
        "projects": "PROJECTS",
        "summary": "SUMMARY",
        "languages": "LANGUAGES",
    }
    return mapping.get(top, "SUMMARY")


def detect_sections(text: str) -> Dict[str, str]:
    blocks = _split_blocks(text)
    sections: Dict[str, List[str]] = {key: [] for key in SECTION_KEYWORDS}

    current = "SUMMARY"
    for block in blocks:
        first_line = block.split("\n", 1)[0].strip()
        matched = _keyword_match(first_line) or _keyword_match(block[:140])
        if matched:
            current = matched
            sections[current].append(block)
            continue

        if current == "SUMMARY":
            current = _classify_unknown_block(block)
        sections[current].append(block)

    return {key: "\n\n".join(parts).strip() for key, parts in sections.items() if parts}


def detect_sections_with_trace(text: str) -> Tuple[Dict[str, str], Dict[str, int]]:
    sections = detect_sections(text)
    trace = {k: len(v.split()) for k, v in sections.items()}
    return sections, trace


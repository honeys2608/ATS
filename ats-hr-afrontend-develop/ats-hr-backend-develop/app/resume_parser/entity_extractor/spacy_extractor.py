from functools import lru_cache
from typing import Dict, List


@lru_cache(maxsize=1)
def _get_nlp():
    try:
        import spacy
    except Exception:
        return None
    for model in ("en_core_web_trf", "en_core_web_lg", "en_core_web_sm"):
        try:
            return spacy.load(model)
        except Exception:
            continue
    return None


def extract_entities_spacy(text: str) -> Dict[str, List[str]]:
    nlp = _get_nlp()
    if nlp is None:
        return {
            "persons": [],
            "organizations": [],
            "locations": [],
            "dates": [],
            "skills": [],
        }
    try:
        doc = nlp(str(text or "")[:200000])
    except Exception:
        return {
            "persons": [],
            "organizations": [],
            "locations": [],
            "dates": [],
            "skills": [],
        }
    return {
        "persons": [e.text for e in doc.ents if e.label_ == "PERSON"],
        "organizations": [e.text for e in doc.ents if e.label_ == "ORG"],
        "locations": [e.text for e in doc.ents if e.label_ in {"GPE", "LOC"}],
        "dates": [e.text for e in doc.ents if e.label_ == "DATE"],
        "skills": [e.text for e in doc.ents if e.label_ == "SKILL"],
    }


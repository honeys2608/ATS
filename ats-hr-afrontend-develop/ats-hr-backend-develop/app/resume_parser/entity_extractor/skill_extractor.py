from functools import lru_cache
from typing import Dict, List


@lru_cache(maxsize=1)
def _get_skill_extractor():
    try:
        from skillextractor.named_entity_recognition_scorer import SkillExtractor
        from skillextractor.base import SKILL_DB
        from spacy.matcher import PhraseMatcher
        import spacy
    except Exception:
        return None
    for model in ("en_core_web_lg", "en_core_web_sm"):
        try:
            nlp = spacy.load(model)
            return SkillExtractor(nlp, SKILL_DB, PhraseMatcher)
        except Exception:
            continue
    return None


def extract_skills_cogito(text: str) -> List[Dict]:
    extractor = _get_skill_extractor()
    if extractor is None:
        return []
    try:
        annotations = extractor.annotate(str(text or ""))
    except Exception:
        return []
    out = []
    for match in ((annotations or {}).get("results") or {}).get("full_matches") or []:
        out.append(
            {
                "skill_id": match.get("skill_id"),
                "skill_name": match.get("doc_node_value"),
                "normalized": match.get("skill_name"),
                "confidence": float(match.get("score") or 1.0),
            }
        )
    return out


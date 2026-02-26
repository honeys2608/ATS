from functools import lru_cache
import os
from typing import Dict, List


@lru_cache(maxsize=1)
def _get_ner():
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


def extract_entities_hf(text: str) -> List[Dict]:
    ner = _get_ner()
    if ner is None:
        return []
    try:
        entities = ner(str(text or "")[:5000]) or []
    except Exception:
        return []
    out = []
    for e in entities:
        out.append(
            {
                "text": e.get("word"),
                "label": e.get("entity_group"),
                "score": float(e.get("score") or 0.0),
            }
        )
    return out

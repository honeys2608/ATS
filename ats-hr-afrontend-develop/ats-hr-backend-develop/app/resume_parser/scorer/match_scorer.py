import math
import re
from functools import lru_cache
from typing import Any, Dict, Iterable, List, Set


def _as_text(value: Any) -> str:
    return str(value or "").strip()


def _tokenize(text: str) -> Set[str]:
    return {t for t in re.findall(r"[a-zA-Z0-9+#.]+", _as_text(text).lower()) if t}


def _normalize_skill_set(skills: Any) -> Set[str]:
    if isinstance(skills, str):
        parts = re.split(r"[,/|;]", skills)
        return {_as_text(p).lower() for p in parts if _as_text(p)}
    if isinstance(skills, Iterable):
        out = set()
        for item in skills:
            token = _as_text(item).lower()
            if token:
                out.add(token)
        return out
    return set()


def _extract_years(value: Any) -> float:
    text = _as_text(value).lower()
    if not text:
        return 0.0
    m = re.search(r"(\d+(?:\.\d+)?)", text)
    if not m:
        return 0.0
    years = float(m.group(1))
    if "month" in text and "year" not in text:
        years = years / 12.0
    return max(0.0, years)


def _education_level(value: Any) -> int:
    v = _as_text(value).lower()
    if not v:
        return 0
    if any(k in v for k in ("phd", "doctorate")):
        return 5
    if any(k in v for k in ("master", "m.tech", "mtech", "mba", "ms", "m.sc")):
        return 4
    if any(k in v for k in ("bachelor", "b.tech", "btech", "be", "b.e", "b.sc")):
        return 3
    if any(k in v for k in ("diploma", "associate")):
        return 2
    if any(k in v for k in ("12th", "high school", "secondary")):
        return 1
    return 0


@lru_cache(maxsize=1)
def _get_sentence_transformer():
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def _semantic_score(resume_text: str, job_text: str) -> float:
    model = _get_sentence_transformer()
    if model is not None:
        try:
            from sentence_transformers import util

            embeddings = model.encode([resume_text, job_text], convert_to_tensor=True)
            score = float(util.cos_sim(embeddings[0], embeddings[1]).item())
            return max(0.0, min(1.0, score))
        except Exception:
            pass

    # Fallback lexical cosine-like similarity.
    a = _tokenize(resume_text)
    b = _tokenize(job_text)
    if not a or not b:
        return 0.0
    overlap = len(a.intersection(b))
    denom = math.sqrt(len(a) * len(b))
    if denom <= 0:
        return 0.0
    return max(0.0, min(1.0, overlap / denom))


def score_candidate_match(parsed_resume: Dict[str, Any], job_payload: Dict[str, Any]) -> Dict[str, Any]:
    resume_text = _as_text(parsed_resume.get("resume_text"))
    if not resume_text:
        resume_text = "\n".join(
            [
                _as_text(parsed_resume.get("professional_summary")),
                _as_text(parsed_resume.get("current_designation")),
                _as_text(parsed_resume.get("current_company")),
                ", ".join(parsed_resume.get("skills") or []),
            ]
        ).strip()

    job_description = _as_text(job_payload.get("job_description") or job_payload.get("description"))
    semantic = _semantic_score(resume_text, job_description) if job_description else 0.0

    resume_skills = _normalize_skill_set(parsed_resume.get("skills") or [])
    job_skills = _normalize_skill_set(
        job_payload.get("required_skills")
        or job_payload.get("skills")
        or job_payload.get("must_have_skills")
        or []
    )
    if job_skills:
        matched = sorted(resume_skills.intersection(job_skills))
        missing = sorted(job_skills - resume_skills)
        skill_score = len(matched) / max(len(job_skills), 1)
    else:
        matched = sorted(resume_skills)
        missing = []
        skill_score = 1.0 if resume_skills else 0.0

    required_exp = _extract_years(
        job_payload.get("min_experience_years")
        or job_payload.get("required_experience")
        or job_payload.get("experience_years")
    )
    candidate_exp = _extract_years(parsed_resume.get("experience_years") or parsed_resume.get("total_experience"))
    if required_exp > 0:
        experience_score = min(1.0, candidate_exp / required_exp)
    else:
        experience_score = 1.0 if candidate_exp > 0 else 0.0

    required_edu_level = _education_level(job_payload.get("required_education") or job_payload.get("education"))
    candidate_edu_level = _education_level(
        parsed_resume.get("education", {}).get("degree")
        if isinstance(parsed_resume.get("education"), dict)
        else parsed_resume.get("education")
    )
    if not candidate_edu_level and parsed_resume.get("education_history"):
        first = parsed_resume["education_history"][0] if parsed_resume["education_history"] else {}
        candidate_edu_level = _education_level(first.get("degree"))
    if required_edu_level > 0:
        education_score = min(1.0, candidate_edu_level / required_edu_level)
    else:
        education_score = 1.0 if candidate_edu_level > 0 else 0.0

    total = (
        semantic * 0.40
        + skill_score * 0.30
        + experience_score * 0.20
        + education_score * 0.10
    ) * 100.0

    return {
        "total_score": round(total, 2),
        "semantic_score": round(semantic * 100.0, 2),
        "skill_score": round(skill_score * 100.0, 2),
        "experience_score": round(experience_score * 100.0, 2),
        "education_score": round(education_score * 100.0, 2),
        "matched_skills": matched,
        "missing_skills": missing,
        "weights": {
            "semantic": 40,
            "skills": 30,
            "experience": 20,
            "education": 10,
        },
    }


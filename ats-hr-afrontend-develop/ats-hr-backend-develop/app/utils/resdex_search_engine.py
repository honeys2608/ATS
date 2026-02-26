from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta
from difflib import get_close_matches
from typing import Any, Dict, List, Optional, Tuple
import json
import re

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "based",
    "by",
    "can",
    "candidate",
    "candidates",
    "developers",
    "developer",
    "engineer",
    "for",
    "from",
    "in",
    "is",
    "job",
    "looking",
    "of",
    "on",
    "or",
    "remote",
    "role",
    "senior",
    "junior",
    "mid",
    "with",
    "years",
    "year",
    "yr",
    "yrs",
    "experience",
}

ROLE_KEYWORDS = {
    "frontend",
    "backend",
    "fullstack",
    "devops",
    "data",
    "ml",
    "ai",
    "mobile",
    "android",
    "ios",
    "qa",
    "test",
    "tester",
    "analyst",
    "architect",
    "manager",
    "lead",
    "principal",
    "designer",
}

SYNONYMS = {
    "js": "javascript",
    "reactjs": "react",
    "nodejs": "node.js",
    "node": "node.js",
    "ts": "typescript",
    "py": "python",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "k8s": "kubernetes",
    "k8": "kubernetes",
    "postgres": "postgresql",
    "postgre": "postgresql",
    "dockerized": "docker",
    "nextjs": "next.js",
}


def split_csv(value: Optional[str]) -> List[str]:
    if not value or not isinstance(value, str):
        return []
    items = [v.strip() for v in value.split(",")]
    return [v for v in items if v]


def safe_lower(value: Any) -> str:
    return str(value or "").strip().lower()


def tokenize(text: str) -> List[str]:
    if not text:
        return []
    # Keep common tech tokens like c++, .net, node.js
    tokens = re.findall(r"[a-zA-Z0-9][a-zA-Z0-9+.#_-]*", text.lower())
    out: List[str] = []
    for t in tokens:
        t = t.strip("._-")
        if not t or t in STOPWORDS:
            continue
        out.append(t)
    return out


def apply_synonyms(tokens: List[str]) -> List[str]:
    out: List[str] = []
    for t in tokens:
        mapped = SYNONYMS.get(t, t)
        if not mapped:
            continue
        out.extend(tokenize(mapped))
    return out


def extract_experience_range(text: str) -> Tuple[Optional[float], Optional[float]]:
    if not text:
        return (None, None)

    t = text.lower()

    # "3-5 years", "3 to 5 yrs"
    m = re.search(
        r"(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)",
        t,
    )
    if m:
        return (float(m.group(1)), float(m.group(2)))

    # "5+ years", "5 years"
    m = re.search(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)", t)
    if m:
        return (float(m.group(1)), None)

    return (None, None)


def candidate_document(c: models.Candidate) -> str:
    parts: List[str] = []

    parts.append(getattr(c, "full_name", "") or "")
    parts.append(getattr(c, "email", "") or "")
    parts.append(getattr(c, "current_employer", "") or "")
    parts.append(getattr(c, "current_job_title", "") or "")
    parts.append(getattr(c, "experience", "") or "")
    parts.append(getattr(c, "current_location", "") or "")
    parts.append(getattr(c, "preferred_location", "") or "")
    parts.append(getattr(c, "notice_period", "") or "")
    parts.append(getattr(c, "internal_notes", "") or "")

    skills = getattr(c, "skills", None)
    if isinstance(skills, list):
        parts.append(" ".join(str(s) for s in skills))
    elif skills:
        parts.append(str(skills))

    parsed_resume = getattr(c, "parsed_resume", None)
    if parsed_resume:
        try:
            parts.append(json.dumps(parsed_resume)[:5000])
        except Exception:
            parts.append(str(parsed_resume)[:5000])

    certs = getattr(c, "certifications", None)
    if isinstance(certs, list) and certs:
        parts.append(" ".join(getattr(cc, "name", "") or "" for cc in certs))

    certifications_text = getattr(c, "certifications_text", None)
    if certifications_text:
        parts.append(str(certifications_text))

    tags = getattr(c, "tags", None)
    if tags:
        try:
            parts.append(json.dumps(tags)[:2000])
        except Exception:
            parts.append(str(tags)[:2000])

    return " ".join(p for p in parts if p).lower()


def keyword_score(query_tokens: List[str], doc: str) -> float:
    if not query_tokens:
        return 50.0
    if not doc:
        return 0.0

    unique = list(dict.fromkeys(query_tokens))
    hits = 0
    for t in unique:
        if t and t in doc:
            hits += 1

    base = (hits / max(1, len(unique))) * 100.0
    if hits >= 5:
        base += 5.0
    if hits >= 8:
        base += 5.0

    return float(min(100.0, max(0.0, base)))


def _normalize_skill_list(skills: List[str]) -> List[str]:
    out: List[str] = []
    for s in skills or []:
        ns = safe_lower(s)
        if ns:
            out.append(ns)
    return out


def _fuzzy_skill_match_count(required: List[str], candidate: List[str]) -> int:
    if not required or not candidate:
        return 0
    cand = list(dict.fromkeys(candidate))
    fuzzy = 0
    for r in required:
        if not r or r in cand:
            continue
        if any((r in c or c in r) and (len(r) >= 4 or len(c) >= 4) for c in cand):
            fuzzy += 1
    return fuzzy


def skills_score(required_skills: List[str], candidate_skills: List[str]) -> float:
    if not required_skills:
        return 50.0

    req = list(dict.fromkeys(_normalize_skill_list(required_skills)))
    cand = list(dict.fromkeys(_normalize_skill_list(candidate_skills)))

    exact = len(set(req) & set(cand))
    fuzzy = _fuzzy_skill_match_count(req, cand)

    score = (exact * 15.0) + (fuzzy * 8.0)
    return float(min(100.0, max(0.0, score)))


def _experience_range_score(
    candidate_years: float,
    min_exp: Optional[float],
    max_exp: Optional[float],
) -> float:
    if min_exp is None and max_exp is None:
        return 50.0

    cy = float(candidate_years or 0.0)
    if min_exp is not None and cy < min_exp:
        if min_exp <= 0:
            return 0.0
        return float(max(0.0, min(100.0, (cy / min_exp) * 100.0)))

    if max_exp is not None and cy > max_exp:
        over = cy - max_exp
        return float(max(0.0, 100.0 - (over * 5.0)))

    return 100.0


def _role_relevance_score(query_tokens: List[str], c: models.Candidate) -> float:
    if not query_tokens:
        return 50.0

    role_doc = " ".join(
        [
            getattr(c, "current_job_title", "") or "",
            getattr(c, "experience", "") or "",
        ]
    ).lower()

    if not role_doc:
        return 50.0

    role_terms = [t for t in query_tokens if t in ROLE_KEYWORDS]
    if not role_terms:
        return 50.0

    hits = sum(1 for t in set(role_terms) if t in role_doc)
    return float(min(100.0, max(0.0, (hits / max(1, len(set(role_terms)))) * 100.0)))


def experience_score(
    query_tokens: List[str],
    min_exp: Optional[float],
    max_exp: Optional[float],
    c: models.Candidate,
) -> float:
    years = float(getattr(c, "experience_years", 0) or 0.0)
    years_match = _experience_range_score(years, min_exp, max_exp)
    role_rel = _role_relevance_score(query_tokens, c)
    return float((years_match * 0.5) + (role_rel * 0.5))


def location_score(location_filter: Optional[str], c: models.Candidate) -> float:
    if not location_filter:
        return 100.0

    lf = safe_lower(location_filter)
    cand_loc = safe_lower(getattr(c, "current_location", None)) + " " + safe_lower(
        getattr(c, "preferred_location", None)
    )

    if "remote" in lf:
        if "remote" in cand_loc:
            return 100.0
        return 60.0

    if lf and lf in cand_loc:
        return 100.0

    if getattr(c, "willing_to_relocate", False):
        return 80.0

    return 0.0


def availability_bucket(c: models.Candidate) -> Optional[str]:
    today = date.today()

    join_date = getattr(c, "availability_to_join", None)
    if isinstance(join_date, (datetime, date)):
        jd = join_date.date() if isinstance(join_date, datetime) else join_date
        days_until = (jd - today).days
        if days_until <= 0:
            return "immediate"
        if days_until <= 14:
            return "2weeks"
        if days_until <= 30:
            return "1month"
        return "not_available"

    np_days = getattr(c, "notice_period_days", None)
    if isinstance(np_days, int):
        if np_days <= 7:
            return "immediate"
        if np_days <= 14:
            return "2weeks"
        if np_days <= 30:
            return "1month"
        return "not_available"

    np_str = safe_lower(getattr(c, "notice_period", None))
    if "immediate" in np_str:
        return "immediate"
    if "15" in np_str or "2 week" in np_str or "two week" in np_str:
        return "2weeks"
    if "30" in np_str or "1 month" in np_str or "one month" in np_str:
        return "1month"

    return None


def availability_score(c: models.Candidate) -> float:
    weights = {
        "immediate": 100.0,
        "2weeks": 85.0,
        "1month": 70.0,
        "not_available": 20.0,
    }
    bucket = availability_bucket(c)
    return float(weights.get(bucket, 50.0))


def certification_score(required: List[str], c: models.Candidate) -> float:
    cert_names: List[str] = []
    certs = getattr(c, "certifications", None)
    if isinstance(certs, list):
        cert_names.extend([getattr(cc, "name", "") or "" for cc in certs])

    certifications_text = getattr(c, "certifications_text", None)
    if certifications_text:
        cert_names.append(str(certifications_text))

    cand = [safe_lower(x) for x in cert_names if x]
    cand_set = set([x for x in cand if x])

    if not required:
        return float(min(100.0, 50.0 + (len(cand_set) * 5.0)))

    req = [safe_lower(r) for r in required if r]
    req_set = set([r for r in req if r])
    if not req_set:
        return float(min(100.0, 50.0 + (len(cand_set) * 5.0)))

    matches = 0
    for r in req_set:
        if any(r in ccn for ccn in cand_set):
            matches += 1

    ratio = matches / max(1, len(req_set))
    return float(min(100.0, (ratio * 80.0) + (min(4, len(cand_set)) * 5.0)))


def recency_score(c: models.Candidate) -> float:
    now = datetime.utcnow()
    updated = getattr(c, "last_activity_at", None) or getattr(c, "created_at", None)
    if not updated:
        return 50.0
    if isinstance(updated, date) and not isinstance(updated, datetime):
        updated = datetime.combine(updated, datetime.min.time())
    days = max(0, (now - updated).days)
    return float(max(0.0, 100.0 - (days * 0.5)))


def structured_score(filters_used: Dict[str, Any], c: models.Candidate) -> float:
    checks: List[bool] = []

    min_exp = filters_used.get("min_exp")
    max_exp = filters_used.get("max_exp")
    if min_exp is not None or max_exp is not None:
        years = float(getattr(c, "experience_years", 0) or 0.0)
        ok = True
        if min_exp is not None and years < float(min_exp):
            ok = False
        if max_exp is not None and years > float(max_exp):
            ok = False
        checks.append(ok)

    location = filters_used.get("location")
    if location:
        cand_loc = safe_lower(getattr(c, "current_location", None)) + " " + safe_lower(
            getattr(c, "preferred_location", None)
        )
        checks.append(safe_lower(location) in cand_loc if cand_loc else False)

    required_skills = filters_used.get("skills") or []
    skills_logic = safe_lower(filters_used.get("skills_logic") or "and")
    if required_skills:
        cand_skills = _normalize_skill_list(getattr(c, "skills", []) or [])
        req = _normalize_skill_list(required_skills)
        if skills_logic == "or":
            checks.append(any(r in cand_skills for r in req))
        else:
            checks.append(all(r in cand_skills for r in req))

    salary_min = filters_used.get("salary_min")
    salary_max = filters_used.get("salary_max")
    if salary_min is not None or salary_max is not None:
        sal = getattr(c, "expected_salary", None)
        ok = True
        if salary_min is not None and (sal is None or float(sal) < float(salary_min)):
            ok = False
        if salary_max is not None and (sal is None or float(sal) > float(salary_max)):
            ok = False
        checks.append(ok)

    profile_min = filters_used.get("profile_min")
    if profile_min is not None:
        pc = int(getattr(c, "profile_completion", 0) or 0)
        checks.append(pc >= int(profile_min))

    tags = filters_used.get("tags") or []
    tags_logic = safe_lower(filters_used.get("tags_logic") or "and")
    if tags:
        cand_tags_raw = getattr(c, "tags", None) or []
        cand_tags: List[str] = []
        if isinstance(cand_tags_raw, list):
            cand_tags = [safe_lower(t) for t in cand_tags_raw if t]
        elif isinstance(cand_tags_raw, dict):
            for _, v in cand_tags_raw.items():
                if isinstance(v, list):
                    cand_tags.extend([safe_lower(x) for x in v if x])
        else:
            cand_tags = tokenize(str(cand_tags_raw))

        req_tags = [safe_lower(t) for t in tags if t]
        if tags_logic == "or":
            checks.append(any(t in cand_tags for t in req_tags))
        else:
            checks.append(all(t in cand_tags for t in req_tags))

    last_active = safe_lower(filters_used.get("last_active"))
    if last_active and last_active != "any":
        updated = getattr(c, "last_activity_at", None)
        if not updated:
            checks.append(False)
        else:
            now = datetime.utcnow()
            if last_active == "24h":
                checks.append(updated >= (now - timedelta(hours=24)))
            elif last_active == "7days":
                checks.append(updated >= (now - timedelta(days=7)))
            elif last_active == "30days":
                checks.append(updated >= (now - timedelta(days=30)))
            elif last_active == "90days":
                checks.append(updated >= (now - timedelta(days=90)))

    availability = filters_used.get("availability") or []
    if availability:
        bucket = availability_bucket(c)
        checks.append(bucket in set([safe_lower(a) for a in availability]))

    wtr = filters_used.get("willing_to_relocate")
    if wtr is True:
        checks.append(bool(getattr(c, "willing_to_relocate", False)))

    if not checks:
        return 100.0
    return float((sum(1 for x in checks if x) / len(checks)) * 100.0)


def confidence(scores: Dict[str, float]) -> str:
    final = scores.get("final_score", 0.0)
    if final >= 80 and scores.get("skills", 0.0) >= 70 and scores.get("experience", 0.0) >= 60:
        return "high"
    if final >= 60:
        return "medium"
    return "low"


def facets(scored_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    window = scored_results[:300]

    skills_counter: Counter = Counter()
    locations_counter: Counter = Counter()
    certifications_counter: Counter = Counter()
    availability_counter: Counter = Counter()
    education_counter: Counter = Counter()
    exp_ranges = {"0-2": 0, "2-5": 0, "5-10": 0, "10+": 0}

    for r in window:
        c = r.get("_candidate_obj")
        if not c:
            continue

        for s in getattr(c, "skills", []) or []:
            if s:
                skills_counter[str(s).strip()] += 1

        loc = getattr(c, "current_location", None) or ""
        if loc:
            locations_counter[str(loc).strip()] += 1

        years = float(getattr(c, "experience_years", 0) or 0.0)
        if years < 2:
            exp_ranges["0-2"] += 1
        elif years < 5:
            exp_ranges["2-5"] += 1
        elif years < 10:
            exp_ranges["5-10"] += 1
        else:
            exp_ranges["10+"] += 1

        certs = getattr(c, "certifications", None)
        if isinstance(certs, list):
            for cc in certs:
                name = getattr(cc, "name", None)
                if name:
                    certifications_counter[str(name).strip()] += 1

        bucket = availability_bucket(c) or "unknown"
        availability_counter[bucket] += 1

        qual = getattr(c, "qualification", None)
        if qual:
            education_counter[str(qual).strip()] += 1
        else:
            edu = getattr(c, "education", None)
            if isinstance(edu, list) and edu:
                education_counter[str(edu[0]).strip()] += 1
            elif isinstance(edu, dict) and edu:
                education_counter[
                    str(
                        edu.get("degree") or edu.get("qualification") or "Other"
                    ).strip()
                ] += 1

    def _top(counter: Counter, limit: int) -> List[Dict[str, Any]]:
        return [{"value": k, "count": v} for k, v in counter.most_common(limit)]

    return {
        "skills": _top(skills_counter, 20),
        "locations": _top(locations_counter, 15),
        "experience_ranges": exp_ranges,
        "certifications": _top(certifications_counter, 10),
        "availability": dict(availability_counter),
        "education_levels": _top(education_counter, 10),
    }


def spell_check_query(db: Session, query: str) -> Optional[str]:
    if not query or not query.strip():
        return None

    tokens = apply_synonyms(tokenize(query))
    if not tokens:
        return None

    skills = db.query(models.Skill.normalized_name).limit(5000).all()
    vocab = [s[0] for s in skills if s and s[0]]
    vocab_set = set(vocab)

    corrected: List[str] = []
    changed = False
    for t in tokens:
        if t in vocab_set or len(t) < 4 or t.isdigit():
            corrected.append(t)
            continue
        match = get_close_matches(t, vocab, n=1, cutoff=0.88)
        if match:
            corrected.append(match[0])
            changed = True
        else:
            corrected.append(t)

    if not changed:
        return None
    return " ".join(corrected)


def search_suggestions(db: Session, query: str, current_user: Dict[str, Any]) -> List[str]:
    q = (query or "").strip()
    if not q:
        return []

    out: List[str] = []

    # 1) Trending saved searches (global)
    try:
        trending = (
            db.query(models.SavedSearch.query, func.count(models.SavedSearch.id).label("c"))
            .filter(models.SavedSearch.is_active == True)
            .group_by(models.SavedSearch.query)
            .order_by(func.count(models.SavedSearch.id).desc())
            .limit(5)
            .all()
        )
        out.extend([t[0] for t in trending if t and t[0]])
    except Exception:
        pass

    # 2) Personal recent saved searches
    try:
        uid = current_user.get("id") if isinstance(current_user, dict) else None
        if uid:
            recent = (
                db.query(models.SavedSearch.query)
                .filter(
                    models.SavedSearch.user_id == uid,
                    models.SavedSearch.is_active == True,
                )
                .order_by(models.SavedSearch.updated_at.desc())
                .limit(3)
                .all()
            )
            out.extend([r[0] for r in recent if r and r[0]])
    except Exception:
        pass

    # 3) Skill-based expansions
    try:
        toks = tokenize(q)
        keyword = toks[-1] if toks else ""
        if keyword:
            skills = (
                db.query(models.Skill.name)
                .filter(models.Skill.normalized_name.ilike(f"%{keyword.lower()}%"))
                .order_by(models.Skill.name.asc())
                .limit(5)
                .all()
            )
            out.extend([f"{q} {s[0]}" for s in skills if s and s[0]])
    except Exception:
        pass

    # 4) Role-based suggestions (lightweight)
    roles = [
        "frontend developer",
        "backend developer",
        "fullstack engineer",
        "devops engineer",
        "data analyst",
        "data scientist",
    ]
    for r in roles:
        if r.startswith(q.lower()):
            out.append(r)

    # Rank unique: startswith first, then shorter strings
    seen = set()
    ranked = []
    ql = q.lower()
    for s in out:
        if not s or s in seen:
            continue
        seen.add(s)
        ranked.append((0 if s.lower().startswith(ql) else 1, s))
    ranked.sort(key=lambda x: (x[0], len(x[1])))
    return [s for _, s in ranked[:8]]


def related_searches(original_query: str, scored_results: List[Dict[str, Any]]) -> List[str]:
    q = (original_query or "").strip()
    if not q:
        return []

    related: List[str] = []

    skills_counter: Counter = Counter()
    for r in scored_results[:10]:
        c = r.get("_candidate_obj")
        if not c:
            continue
        for s in getattr(c, "skills", []) or []:
            if s:
                skills_counter[str(s).strip()] += 1

    for skill, _ in skills_counter.most_common(3):
        related.append(f"{q} {skill}")

    ql = q.lower()
    if "senior" in ql:
        related.append(re.sub(r"\\bsenior\\b", "lead", q, flags=re.IGNORECASE))
        related.append(re.sub(r"\\bsenior\\b", "principal", q, flags=re.IGNORECASE))

    if "remote" not in ql:
        related.append(f"{q} remote")

    out: List[str] = []
    seen = set()
    for s in related:
        if s and s not in seen and s.lower() != ql:
            seen.add(s)
            out.append(s)
    return out[:8]


"""
Skill Matching Engine
Calculates candidate-job fit scores and recommendations
"""

import json
import math
from typing import Dict, List, Tuple, Optional
from collections import Counter

# Skill categories for better matching
SKILL_CATEGORIES = {
    "backend": ["python", "java", "nodejs", "golang", "rust", "csharp", "php", "fastapi", "django", "flask"],
    "frontend": ["javascript", "typescript", "react", "vue", "angular", "html", "css"],
    "database": ["sql", "mongodb", "redis", "elasticsearch", "postgresql", "mysql"],
    "devops": ["docker", "kubernetes", "aws", "gcp", "azure", "jenkins", "git"],
    "data": ["python", "r", "spark", "hadoop", "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn"],
    "mobile": ["swift", "kotlin", "react-native", "flutter"],
    "cloud": ["aws", "gcp", "azure"],
}

# Skill difficulty levels (higher = more valuable)
SKILL_VALUE = {
    "python": 8,
    "javascript": 7,
    "react": 8,
    "kubernetes": 9,
    "tensorflow": 9,
    "aws": 8,
    "docker": 7,
    "sql": 6,
    "html": 4,
    "css": 4,
    "git": 5,
    "linux": 6,
    "nodejs": 7,
    "fastapi": 8,
    "django": 7,
    "graphql": 7,
    "mongodb": 6,
    "redis": 6,
}

# Complementary skills that boost match when both present
COMPLEMENTARY_SKILLS = [
    ("python", "django"),
    ("python", "flask"),
    ("python", "fastapi"),
    ("javascript", "react"),
    ("javascript", "nodejs"),
    ("typescript", "react"),
    ("docker", "kubernetes"),
    ("aws", "docker"),
    ("sql", "mongodb"),
    ("tensorflow", "python"),
    ("react", "nodejs"),
]


def normalize_skill(skill: str) -> str:
    """Normalize skill name for comparison."""
    return skill.lower().strip().replace("_", "-")


def calculate_skill_match(
    candidate_skills: List[str], 
    required_skills: List[str]
) -> Tuple[float, Dict[str, any]]:
    """
    Calculate skill match percentage between candidate and job.
    Returns (match_percentage, details)
    """
    if not required_skills:
        return 0.0, {}

    candidate_skills_norm = [normalize_skill(s) for s in candidate_skills]
    required_skills_norm = [normalize_skill(s) for s in required_skills]

    # Exact matches
    exact_matches = sum(1 for req in required_skills_norm if req in candidate_skills_norm)

    # Partial matches (similar but not exact)
    partial_matches = 0
    for req in required_skills_norm:
        if req not in candidate_skills_norm:
            # Check for category matches
            for category, skills in SKILL_CATEGORIES.items():
                req_in_cat = any(normalize_skill(s) == req for s in skills)
                candidate_in_cat = any(normalize_skill(cand) in [normalize_skill(s) for s in skills] 
                                      for cand in candidate_skills_norm)
                if req_in_cat and candidate_in_cat:
                    partial_matches += 0.5
                    break

    # Calculate base match score
    total_possible = len(required_skills_norm)
    match_score = (exact_matches + partial_matches) / total_possible if total_possible > 0 else 0

    # Bonus for complementary skills
    complementary_bonus = 0
    for skill1, skill2 in COMPLEMENTARY_SKILLS:
        if (normalize_skill(skill1) in candidate_skills_norm and 
            normalize_skill(skill2) in candidate_skills_norm):
            complementary_bonus += 0.05

    match_score = min(1.0, match_score + complementary_bonus)

    # Convert to percentage
    match_percentage = match_score * 100

    details = {
        "exact_matches": exact_matches,
        "partial_matches": int(partial_matches),
        "required_skills": required_skills_norm,
        "candidate_skills": candidate_skills_norm,
        "missing_skills": [s for s in required_skills_norm if s not in candidate_skills_norm],
        "bonus_skills": [s for s in candidate_skills_norm if s not in required_skills_norm],
    }

    return match_percentage, details


def calculate_experience_match(
    candidate_years: int,
    min_years: int,
    max_years: Optional[int] = None
) -> Tuple[float, str]:
    """
    Calculate experience match.
    Returns (match_percentage, rating)
    """
    if max_years is None:
        max_years = min_years + 10

    if candidate_years < min_years:
        # Under-qualified
        match = (candidate_years / min_years) * 100
        rating = "under-qualified"
    elif candidate_years > max_years:
        # Over-qualified
        match = 100 - ((candidate_years - max_years) / max_years) * 20
        match = max(80, min(100, match))
        rating = "over-qualified"
    else:
        # Perfect fit
        match = 100
        rating = "perfect-fit"

    return match, rating


def calculate_education_match(
    candidate_education: List[Dict],
    required_degree: Optional[str] = None
) -> Tuple[float, bool]:
    """
    Calculate education match.
    Returns (match_percentage, has_required_degree)
    """
    if not required_degree:
        return 100.0, True

    # Extract highest degree from candidate
    degree_hierarchy = {"diploma": 1, "bachelor": 2, "master": 3, "phd": 4}
    candidate_highest = 0

    for edu in candidate_education:
        degree_key = edu.get("degree", "").lower()
        for key, value in degree_hierarchy.items():
            if key in degree_key:
                candidate_highest = max(candidate_highest, value)
                break

    required_level = degree_hierarchy.get(required_degree.lower(), 0)

    if candidate_highest >= required_level:
        return 100.0, True
    else:
        # Give partial credit
        match = (candidate_highest / required_level) * 100 if required_level > 0 else 50
        return match, False


def calculate_location_match(
    candidate_location: str,
    job_locations: List[str],
    remote_friendly: bool = False
) -> Tuple[float, str]:
    """
    Calculate location match.
    Returns (match_percentage, status)
    """
    if not job_locations:
        return 100.0, "no-preference"

    candidate_loc_norm = normalize_skill(candidate_location)

    for job_loc in job_locations:
        if normalize_skill(job_loc) == candidate_loc_norm:
            return 100.0, "local"

    if remote_friendly:
        return 80.0, "remote"

    return 50.0, "relocation-needed"


def calculate_overall_fit_score(
    candidate: Dict,
    job: Dict
) -> Dict[str, any]:
    """
    Calculate overall fit score for candidate-job match.
    Returns comprehensive scoring data.
    """
    weights = {
        "skills": 0.35,
        "experience": 0.30,
        "education": 0.15,
        "location": 0.10,
        "cultural_fit": 0.10,
    }

    # Calculate component scores
    skill_match, skill_details = calculate_skill_match(
        candidate.get("skills", []),
        job.get("required_skills", [])
    )

    exp_match, exp_rating = calculate_experience_match(
        candidate.get("experience_years", 0),
        job.get("min_experience", 0),
        job.get("max_experience")
    )

    edu_match, has_degree = calculate_education_match(
        candidate.get("education", []),
        job.get("required_education")
    )

    loc_match, loc_status = calculate_location_match(
        candidate.get("current_location", ""),
        job.get("locations", []),
        job.get("remote_friendly", False)
    )

    # Cultural fit (rough estimation based on industry alignment)
    cultural_match = 75.0  # Default neutral

    # Calculate weighted overall score
    overall_score = (
        skill_match * weights["skills"] +
        exp_match * weights["experience"] +
        edu_match * weights["education"] +
        loc_match * weights["location"] +
        cultural_match * weights["cultural_fit"]
    )

    # Determine recommendation
    if overall_score >= 85:
        recommendation = "strong-recommend"
        color = "green"
    elif overall_score >= 70:
        recommendation = "recommend"
        color = "yellow"
    elif overall_score >= 55:
        recommendation = "consider"
        color = "orange"
    else:
        recommendation = "not-recommended"
        color = "red"

    return {
        "overall_score": round(overall_score, 1),
        "recommendation": recommendation,
        "color": color,
        "component_scores": {
            "skills": round(skill_match, 1),
            "experience": round(exp_match, 1),
            "education": round(edu_match, 1),
            "location": round(loc_match, 1),
            "cultural_fit": round(cultural_match, 1),
        },
        "details": {
            "skills": skill_details,
            "experience": {
                "rating": exp_rating,
                "candidate_years": candidate.get("experience_years", 0),
                "required_min": job.get("min_experience", 0),
            },
            "education": {
                "has_required": has_degree,
                "required": job.get("required_education", "Not specified"),
            },
            "location": {
                "status": loc_status,
                "candidate": candidate.get("current_location", "Unknown"),
            },
        },
        "missing_requirements": [
            "Must have " + ", ".join(skill_details["missing_skills"]) if skill_detail["missing_skills"] else None,
            f"Requires {job.get('min_experience', 0)}+ years experience" if exp_rating == "under-qualified" else None,
            f"Requires {job.get('required_education', 'Bachelor')} degree" if not has_degree else None,
        ],
        "strengths": [
            f"{len(skill_details['bonus_skills'])} bonus skills" if skill_detail["bonus_skills"] else None,
            f"{exp_years} years of experience" if candidate.get("experience_years", 0) > job.get("min_experience", 0) else None,
        ],
    }


def get_candidate_recommendations(
    candidate: Dict,
    jobs: List[Dict],
    top_n: int = 5
) -> List[Dict]:
    """
    Get top N job recommendations for a candidate.
    """
    scores = []

    for job in jobs:
        fit = calculate_overall_fit_score(candidate, job)
        scores.append({
            "job_id": job.get("id"),
            "job_title": job.get("title"),
            "company": job.get("company"),
            "fit_score": fit["overall_score"],
            "recommendation": fit["recommendation"],
            "details": fit,
        })

    # Sort by fit score descending
    scores.sort(key=lambda x: x["fit_score"], reverse=True)
    return scores[:top_n]


def get_job_recommendations(
    job: Dict,
    candidates: List[Dict],
    top_n: int = 10
) -> List[Dict]:
    """
    Get top N candidate recommendations for a job.
    """
    scores = []

    for candidate in candidates:
        fit = calculate_overall_fit_score(candidate, job)
        scores.append({
            "candidate_id": candidate.get("id"),
            "candidate_name": candidate.get("full_name"),
            "email": candidate.get("email"),
            "fit_score": fit["overall_score"],
            "recommendation": fit["recommendation"],
            "details": fit,
        })

    # Sort by fit score descending
    scores.sort(key=lambda x: x["fit_score"], reverse=True)
    return scores[:top_n]


if __name__ == "__main__":
    # Test
    candidate = {
        "skills": ["Python", "React", "Docker", "AWS"],
        "experience_years": 5,
        "current_location": "San Francisco",
        "education": [{"degree": "Bachelor"}],
    }

    job = {
        "title": "Senior Python Developer",
        "required_skills": ["Python", "Django", "PostgreSQL"],
        "min_experience": 3,
        "max_experience": 8,
        "locations": ["San Francisco", "Remote"],
        "remote_friendly": True,
    }

    result = calculate_overall_fit_score(candidate, job)
    print(json.dumps(result, indent=2))

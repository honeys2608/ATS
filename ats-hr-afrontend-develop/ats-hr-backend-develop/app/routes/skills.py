from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Skill

router = APIRouter(
    prefix="/v1/skills",
    tags=["Skills"]
)


@router.get("/search")
def search_skills(
    q: str = Query(..., min_length=1, description="Skill search keyword"),
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    REAL-WORLD SKILL SEARCH / AUTOCOMPLETE

    - Case insensitive
    - Partial match
    - Returns standardized skill names
    - Used by Job, Candidate, Consultant forms
    """

    keyword = q.strip().lower()

    skills = (
        db.query(Skill)
        .filter(Skill.normalized_name.ilike(f"%{keyword}%"))
        .order_by(Skill.name.asc())
        .limit(limit)
        .all()
    )

    return {
        "query": q,
        "count": len(skills),
        "results": [skill.name for skill in skills]
    }

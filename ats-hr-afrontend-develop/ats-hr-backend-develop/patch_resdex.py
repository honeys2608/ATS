
import os

file_path = r'c:\Users\asus\Downloads\ats-hr-afrontend-develop\ats-hr-backend-develop\app\routes\resdex.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
old_imports = """from app.permissions import require_permission
from app.utils.role_check import allow_user"""

new_imports = """from app.permissions import require_permission
from app.utils.role_check import allow_user
from app.ai_core import generate_embedding
from app.utils.search_utils import cosine_similarity, calculate_weighted_score"""

content = content.replace(old_imports, new_imports)

# The search function is complex to replace with simple string replace if there are hidden chars.
# I'll use a more robust way: find the function start and end.

search_func_start = '@router.get("/search")'
# Find the next function or end of file
next_func_start = '# ============================================================\n# SAVED SEARCHES'

start_idx = content.find(search_func_start)
end_idx = content.find(next_func_start)

if start_idx != -1 and end_idx != -1:
    new_func = """@router.get("/search")
@require_permission("candidates", "view")
async def resdex_search(
    q: Optional[str] = None,
    min_exp: Optional[float] = None,
    max_exp: Optional[float] = None,
    location: Optional[str] = None,
    skills: Optional[str] = None,  # comma-separated
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    \"\"\"
    Live search across all candidate data (Intake, Profile, Pool)
    Aggregates and de-duplicates results
    \"\"\"
    allow_user(current_user)
    
    try:
        # Base query - only non-merged candidates
        query = db.query(models.Candidate)
        
        # Filter out merged candidates
        if hasattr(models.Candidate, 'merged_into_id'):
            query = query.filter(models.Candidate.merged_into_id.is_(None))
        
        # 1. Structured Filters (Explicitly set filters)
        if min_exp is not None:
            query = query.filter(models.Candidate.experience_years >= min_exp)
        if max_exp is not None:
            query = query.filter(models.Candidate.experience_years <= max_exp)
        if location:
            query = query.filter(models.Candidate.current_location.ilike(f"%{location}%"))
        if skills:
            skill_list = [s.strip() for s in skills.split(",") if s.strip()]
            for s in skill_list:
                query = query.filter(cast(models.Candidate.skills, String).ilike(f"%{s}%"))

        # 2. Keyword/Semantic Search
        query_embedding = None
        if q and q.strip():
            # Keyword conditions
            search_term = f"%{q.strip()}%"
            search_conditions = [
                models.Candidate.full_name.ilike(search_term),
                models.Candidate.email.ilike(search_term),
                models.Candidate.current_employer.ilike(search_term),
                cast(models.Candidate.skills, String).ilike(search_term),
                cast(models.Candidate.experience, String).ilike(search_term),
                cast(models.Candidate.parsed_resume, String).ilike(search_term),
                models.Candidate.internal_notes.ilike(search_term),
            ]
            
            # We filter by keyword but we'll also rank semantically
            query = query.filter(or_(*search_conditions))
            
            # Generate embedding for semantic ranking
            query_embedding = generate_embedding(q.strip())

        # Get candidates
        candidates = query.all()
        
        # 3. Semantic Ranking & Scoring
        results = []
        for c in candidates:
            # Calculate component scores
            scores = {
                "semantic": 0.0,
                "recency": 100.0, # Default full score
                "completeness": (c.profile_completion or 0)
            }
            
            if query_embedding and c.embedding_vector:
                sim = cosine_similarity(query_embedding, c.embedding_vector)
                scores["semantic"] = max(0, sim) * 100
                
            # Final ranking score
            weights = {"semantic": 0.7, "recency": 0.2, "completeness": 0.1}
            final_score = calculate_weighted_score(scores, weights)
            
            result = {
                "id": c.id,
                "name": c.full_name or "N/A",
                "email": c.email or "N/A",
                "phone": c.phone or "N/A",
                "skills": c.skills if isinstance(c.skills, list) else [],
                "experience": c.experience_years or 0,
                "location": c.current_location or "N/A",
                "city": c.city or "N/A",
                "employer": c.current_employer or "N/A",
                "designation": c.experience or "N/A",
                "salary": c.expected_salary or 0,
                "status": str(c.status) if c.status else "N/A",
                "resume_url": c.resume_url,
                "source": c.source or "N/A",
                "match_score": final_score,
                "score_breakdown": scores
            }
            results.append(result)
        
        # Sort results by match score
        results.sort(key=lambda x: x["match_score"], reverse=True)
        
        # Total before pagination
        total_count = len(results)
        
        # Apply pagination
        paginated_results = results[offset : offset + limit]
        
        return {
            "total": total_count,
            "count": len(paginated_results),
            "limit": limit,
            "offset": offset,
            "results": paginated_results,
        }
    
    except Exception as e:
        print(f"Resdex search error: {str(e)}")
        return {
            "total": 0,
            "count": 0,
            "limit": limit,
            "offset": offset,
            "results": [],
            "error": str(e),
        }

"""
    content = content[:start_idx] + new_func + content[end_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully patched resdex.py")

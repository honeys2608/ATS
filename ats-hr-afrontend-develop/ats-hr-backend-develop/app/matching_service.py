"""
Candidate-Job Matching Service using Sentence-BERT
Implements hybrid matching: Rule-based (70%) + Semantic similarity (30%)
"""

import logging
from typing import Dict, List, Tuple
from sentence_transformers import SentenceTransformer
import numpy as np

logger = logging.getLogger(__name__)


class MatchingService:
    """
    Hybrid matching service combining rule-based scoring with semantic similarity.
    
    Match Score = (Rule-based score * 0.7) + (Semantic similarity * 0.3)
    """
    
    def __init__(self):
        """Initialize the SBERT model (all-MiniLM-L6-v2)"""
        try:
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("SBERT model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load SBERT model: {e}")
            raise
        
        self.embedding_cache = {}  # Cache embeddings to optimize performance
    
    def _get_embedding(self, text: str) -> np.ndarray:
        """Get or create embedding for text with caching"""
        if not text:
            return np.array([])
        
        text_lower = text.lower()
        if text_lower in self.embedding_cache:
            return self.embedding_cache[text_lower]
        
        embedding = self.model.encode(text, convert_to_tensor=False)
        self.embedding_cache[text_lower] = embedding
        return embedding
    
    def _calculate_skill_match(
        self, 
        candidate_skills: List[str], 
        required_skills: List[str],
        preferred_skills: List[str] = None
    ) -> Tuple[float, List[str], List[str]]:
        """
        Calculate skill match percentage.
        
        Returns: (match_percentage, matched_skills, missing_skills)
        """
        if not required_skills:
            return 100.0, candidate_skills, []
        
        candidate_skills_lower = [s.lower().strip() for s in candidate_skills]
        required_skills_lower = [s.lower().strip() for s in required_skills]
        preferred_skills_lower = [s.lower().strip() for s in (preferred_skills or [])]
        
        # Calculate required skills match
        matched_required = set(candidate_skills_lower) & set(required_skills_lower)
        required_match_pct = (len(matched_required) / len(required_skills_lower)) * 100 if required_skills_lower else 100
        
        # Calculate preferred skills bonus (up to 30% bonus)
        preferred_bonus = 0
        if preferred_skills_lower:
            matched_preferred = set(candidate_skills_lower) & set(preferred_skills_lower)
            preferred_pct = len(matched_preferred) / len(preferred_skills_lower)
            preferred_bonus = preferred_pct * 30  # Up to 30% bonus for preferred skills
        
        # Required skills are mandatory (weighted 70% of skill score)
        required_weight = 0.7
        preferred_weight = 0.3
        
        skill_match = (required_match_pct * required_weight) + (preferred_bonus * preferred_weight)
        skill_match = min(100, skill_match)  # Cap at 100%
        
        # Identify matched and missing skills
        matched_skills = list(matched_required)
        missing_skills = [s for s in required_skills_lower if s not in candidate_skills_lower]
        
        return skill_match, matched_skills, missing_skills
    
    def _calculate_experience_match(
        self,
        candidate_experience_years: float,
        required_experience_years: float
    ) -> float:
        """
        Calculate experience match score.
        
        Scoring:
        - Exact match or more: 100%
        - Close match (±1 year): 90%
        - Within range (±2 years): 80%
        - Below required: penalize proportionally
        """
        if required_experience_years == 0:
            return 100.0
        
        diff = candidate_experience_years - required_experience_years
        
        if diff >= 0:  # Candidate has equal or more experience
            if diff == 0:
                return 100.0
            elif diff <= 1:
                return 95.0
            else:
                return 100.0  # More experience is perfect
        else:  # Candidate has less experience
            # Penalize based on how much experience is missing
            shortage_pct = (abs(diff) / required_experience_years) * 100
            score = max(20, 100 - shortage_pct)
            return score
    
    def _calculate_semantic_similarity(
        self,
        job_description: str,
        candidate_summary: str
    ) -> float:
        """
        Calculate semantic similarity between job description and candidate profile
        using SBERT embeddings.
        
        Returns: similarity score (0-100)
        """
        if not job_description or not candidate_summary:
            return 0.0
        
        # Get embeddings
        job_embedding = self._get_embedding(job_description)
        candidate_embedding = self._get_embedding(candidate_summary)
        
        if len(job_embedding) == 0 or len(candidate_embedding) == 0:
            return 0.0
        
        # Calculate cosine similarity
        similarity = np.dot(job_embedding, candidate_embedding) / (
            np.linalg.norm(job_embedding) * np.linalg.norm(candidate_embedding) + 1e-8
        )
        
        # Convert to 0-100 scale
        similarity_pct = float(similarity) * 100
        return max(0, min(100, similarity_pct))
    
    def calculate_match_score(
        self,
        candidate_skills: List[str],
        required_skills: List[str],
        preferred_skills: List[str] = None,
        candidate_experience_years: float = 0,
        required_experience_years: float = 0,
        job_description: str = "",
        candidate_summary: str = ""
    ) -> Dict:
        """
        Calculate comprehensive match score using hybrid approach.
        
        Match Score = (Rule-based score * 0.7) + (Semantic similarity * 0.3)
        
        Returns dict with:
        - match_score: Final score (0-100)
        - fit_label: Excellent/Good/Partial/Poor
        - skill_match: Skill match percentage
        - matched_skills: List of matched skills
        - missing_skills: List of missing required skills
        - experience_match: Experience comparison
        - experience_score: Experience match score
        - semantic_score: SBERT similarity score
        """
        
        # Calculate rule-based components
        skill_match, matched_skills, missing_skills = self._calculate_skill_match(
            candidate_skills, required_skills, preferred_skills
        )
        
        experience_score = self._calculate_experience_match(
            candidate_experience_years, required_experience_years
        )
        
        # Rule-based score: average of skills and experience
        rule_based_score = (skill_match + experience_score) / 2
        
        # Calculate semantic similarity
        semantic_score = self._calculate_semantic_similarity(
            job_description, candidate_summary
        )
        
        # Final hybrid score
        final_score = (rule_based_score * 0.7) + (semantic_score * 0.3)
        
        # Determine fit label
        if final_score >= 80:
            fit_label = "Excellent Fit"
        elif final_score >= 60:
            fit_label = "Good Fit"
        elif final_score >= 40:
            fit_label = "Partial Fit"
        else:
            fit_label = "Poor Fit"
        
        # Format experience comparison
        experience_match = f"{candidate_experience_years}y vs {required_experience_years}y required"
        
        return {
            "match_score": round(final_score, 1),
            "fit_label": fit_label,
            "skill_match": round(skill_match, 1),
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "experience_match": experience_match,
            "experience_score": round(experience_score, 1),
            "semantic_score": round(semantic_score, 1),
            "rule_based_score": round(rule_based_score, 1),
        }
    
    def clear_cache(self):
        """Clear embedding cache to free memory"""
        self.embedding_cache.clear()
        logger.info("Embedding cache cleared")


# Global instance
_matching_service = None


def get_matching_service() -> MatchingService:
    """Get or create the global matching service instance"""
    global _matching_service
    if _matching_service is None:
        _matching_service = MatchingService()
    return _matching_service

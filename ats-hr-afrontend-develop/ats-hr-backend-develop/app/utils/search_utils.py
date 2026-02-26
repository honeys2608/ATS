import numpy as np
from typing import List, Dict, Any
import math

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    
    a = np.array(v1)
    b = np.array(v2)
    
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
        
    return float(np.dot(a, b) / (norm_a * norm_b))

def calculate_weighted_score(scores: Dict[str, float], weights: Dict[str, float]) -> float:
    """Calculate a weighted final score from multiple component scores."""
    final_score = 0.0
    for key, weight in weights.items():
        final_score += scores.get(key, 0.0) * weight
    return round(final_score, 2)

def parse_search_query(query: str) -> Dict[str, Any]:
    """
    Rudimentary query parser to extract potential entities from natural language.
    In a real system, this would use an LLM or specialized NER.
    """
    if not query:
        return {"text": "", "keywords": []}
        
    # Clean and tokenize
    clean_query = query.lower().strip()
    keywords = [k.strip() for k in clean_query.split() if len(k.strip()) > 2]
    
    return {
        "text": clean_query,
        "keywords": keywords
    }

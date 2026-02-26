
import os
import sys

# Add current directory to path so we can import app
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from app.db import SessionLocal
from app import models
from app.ai_core import generate_candidate_embedding

def reindex_all():
    db: Session = SessionLocal()
    try:
        candidates = db.query(models.Candidate).filter(models.Candidate.embedding_vector.is_(None)).all()
        print(f"Found {len(candidates)} candidates needing re-indexing.")
        
        for i, c in enumerate(candidates):
            try:
                # Prepare data for embedding
                candidate_data = {
                    "name": c.full_name,
                    "skills": c.skills,
                    "experience": c.experience_years,
                    "internal_notes": c.internal_notes
                }
                
                embedding = generate_candidate_embedding(candidate_data)
                c.embedding_vector = embedding
                
                if (i + 1) % 10 == 0:
                    db.commit()
                    print(f"Processed {i + 1}/{len(candidates)}...")
            except Exception as e:
                print(f"Error indexing candidate {c.id}: {e}")
        
        db.commit()
        print("Re-indexing complete.")
    finally:
        db.close()

if __name__ == "__main__":
    reindex_all()

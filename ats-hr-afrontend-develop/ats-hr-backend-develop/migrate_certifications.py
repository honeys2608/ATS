# Migration script to add certifications table
# Run this script to create the certifications table in the database

from app.db import Base, engine
from app.models import Certification

def migrate_certifications():
    """Create the certifications table"""
    print("Creating certifications table...")
    
    # Create the table
    Certification.__table__.create(engine, checkfirst=True)
    
    print("✅ Certifications table created successfully!")

if __name__ == "__main__":
    migrate_certifications()

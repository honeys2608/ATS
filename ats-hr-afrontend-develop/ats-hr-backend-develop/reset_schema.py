#!/usr/bin/env python3
"""
Reset database schema - drop all tables and recreate with new schema
"""
from app.db import Base, engine
from app import models

def reset_schema():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables with new schema...")
    Base.metadata.create_all(bind=engine)
    print("✅ Schema reset complete!")

if __name__ == "__main__":
    reset_schema()

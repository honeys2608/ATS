"""
One-time migration script to initialize PostgreSQL database with tables
Run this after deploying to production to create all tables
"""
import os
import sys

# Ensure we're using PostgreSQL
if not os.getenv("DATABASE_URL"):
    print("ERROR: DATABASE_URL environment variable not set")
    print("This script should only be run in production with PostgreSQL")
    sys.exit(1)

if "sqlite" in os.getenv("DATABASE_URL", ""):
    print("ERROR: DATABASE_URL points to SQLite, not PostgreSQL")
    print("This script is for PostgreSQL migration only")
    sys.exit(1)

from app.db import engine, Base
from app import models

print("🔄 Initializing PostgreSQL database...")
print(f"Database URL: {os.getenv('DATABASE_URL', '').split('@')[1] if '@' in os.getenv('DATABASE_URL', '') else 'hidden'}")

try:
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully in PostgreSQL!")
    
    # List created tables
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"\n📊 Created {len(tables)} tables:")
    for table in sorted(tables):
        print(f"  - {table}")
    
    print("\n✅ PostgreSQL database is ready!")
    print("\n💡 Next steps:")
    print("  1. Run the seed script to populate test data: python backend/seed_database.py")
    print("  2. Test your deployment endpoints")
    
except Exception as e:
    print(f"❌ Error creating tables: {e}")
    sys.exit(1)

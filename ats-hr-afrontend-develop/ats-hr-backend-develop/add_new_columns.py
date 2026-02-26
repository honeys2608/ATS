"""
Add new columns to candidates table: education_history, projects, references
Run this script to update the database schema.
"""
import psycopg2

def add_columns():
    conn = psycopg2.connect("postgresql://postgres:honey%402620@localhost:5432/ats-hr-backend")
    cur = conn.cursor()
    
    try:
        cur.execute('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS education_history JSONB')
        print("✅ Added column: education_history")
    except Exception as e:
        print(f"⚠️ education_history: {e}")
        conn.rollback()
    
    try:
        cur.execute('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS projects JSONB')
        print("✅ Added column: projects")
    except Exception as e:
        print(f"⚠️ projects: {e}")
        conn.rollback()
    
    try:
        cur.execute('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "references" JSONB')
        print('✅ Added column: references')
    except Exception as e:
        print(f"⚠️ references: {e}")
        conn.rollback()
    
    conn.commit()
    cur.close()
    conn.close()
    print("\n✅ Database schema updated successfully!")

if __name__ == "__main__":
    add_columns()

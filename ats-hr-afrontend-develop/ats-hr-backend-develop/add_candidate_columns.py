from sqlalchemy import create_engine, text
import os

engine = create_engine(os.environ.get('DATABASE_URL', 'postgresql://postgres:honey%402620@localhost:5432/ats-hr-backend'))

columns_to_add = [
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "current_role" VARCHAR',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS professional_headline VARCHAR',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS employment_status VARCHAR',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS career_summary TEXT',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_history JSON',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS minimum_ctc FLOAT',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_negotiable BOOLEAN',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ready_to_relocate VARCHAR',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS preferred_work_mode VARCHAR',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS availability_status VARCHAR',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS travel_availability VARCHAR',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_authorization VARCHAR',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS requires_sponsorship BOOLEAN',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS available_from DATE',
    'ALTER TABLE candidates ADD COLUMN IF NOT EXISTS time_zone VARCHAR',
]

for sql in columns_to_add:
    try:
        with engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
            print(f'✅ {sql}')
    except Exception as e:
        print(f'❌ Error: {str(e)[:80]}')

print('\n✅ Done!')

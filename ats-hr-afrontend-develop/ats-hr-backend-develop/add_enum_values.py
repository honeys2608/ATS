from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:honey%402620@localhost:5432/ats-hr-backend')
engine = create_engine(DATABASE_URL)

# Add new enum values to candidatestatus
new_values = ['sent_to_am', 'hold_revisit', 'called']

with engine.connect() as conn:
    for value in new_values:
        try:
            sql = f"ALTER TYPE candidatestatus ADD VALUE IF NOT EXISTS '{value}'"
            conn.execute(text(sql))
            conn.commit()
            print(f'Added: {value}')
        except Exception as e:
            print(f'Error adding {value}: {e}')

print('Done!')

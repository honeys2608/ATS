#!/usr/bin/env python3
from app.db import SessionLocal
from sqlalchemy import text

def fix_candidate_statuses():
    db = SessionLocal()
    try:
        # Find candidates with invalid statuses
        result = db.execute(text('SELECT status, COUNT(*) FROM candidates GROUP BY status'))
        all_statuses = result.fetchall()
        
        print('All statuses in database:')
        for status, count in all_statuses:
            print(f'  {status}: {count} candidates')
        
        # Valid statuses
        valid_statuses = [
            'applied', 'sourced', 'new', 'screening', 'screened', 'submitted',
            'interview_scheduled', 'interview_completed', 'interview', 
            'offer_extended', 'offer_accepted', 'offer', 'hired', 'joined', 
            'rejected', 'active', 'shortlisted', 'verified', 'converted'
        ]
        
        # Update invalid statuses to 'new'
        print('\nUpdating invalid statuses...')
        update_query = '''
            UPDATE candidates 
            SET status = 'new' 
            WHERE status NOT IN ('applied', 'sourced', 'new', 'screening', 'screened', 'submitted', 'interview_scheduled', 'interview_completed', 'interview', 'offer_extended', 'offer_accepted', 'offer', 'hired', 'joined', 'rejected', 'active', 'shortlisted', 'verified', 'converted')
        '''
        
        result = db.execute(text(update_query))
        updated_count = result.rowcount
        db.commit()
        print(f'Updated {updated_count} candidates with invalid statuses')
        
        # Show updated counts
        result = db.execute(text('SELECT status, COUNT(*) FROM candidates GROUP BY status'))
        all_statuses = result.fetchall()
        
        print('\nUpdated statuses in database:')
        for status, count in all_statuses:
            print(f'  {status}: {count} candidates')
            
    except Exception as e:
        print(f'Error: {e}')
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_candidate_statuses()
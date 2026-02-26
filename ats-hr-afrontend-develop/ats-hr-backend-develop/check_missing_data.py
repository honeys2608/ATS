#!/usr/bin/env python3
from app.db import SessionLocal
from app.models import Candidate

def check_missing_data():
    db = SessionLocal()
    try:
        # Check candidates with missing data
        total = db.query(Candidate).count()
        with_names = db.query(Candidate).filter(Candidate.full_name.isnot(None), Candidate.full_name != '').count()
        with_emails = db.query(Candidate).filter(Candidate.email.isnot(None), Candidate.email != '').count()
        
        print(f'Total candidates: {total}')
        print(f'Candidates with names: {with_names}')
        print(f'Candidates with emails: {with_emails}')
        print(f'Missing names: {total - with_names}')
        print(f'Missing emails: {total - with_emails}')
        
        # Show sample of candidates missing data
        print('\nSample candidates missing names:')
        missing_names = db.query(Candidate).filter(
            (Candidate.full_name.is_(None)) | (Candidate.full_name == '')
        ).limit(5).all()
        
        for i, c in enumerate(missing_names):
            print(f'{i+1}. ID: {str(c.id)[:8]}...')
            print(f'   Full Name: "{c.full_name}"')
            print(f'   Email: "{c.email}"') 
            print(f'   Phone: "{c.phone}"')
            print(f'   Source: {c.source}')
            print(f'   Status: {c.status}')
            print('   ---')
            
    except Exception as e:
        print('Error:', e)
    finally:
        db.close()

if __name__ == "__main__":
    check_missing_data()
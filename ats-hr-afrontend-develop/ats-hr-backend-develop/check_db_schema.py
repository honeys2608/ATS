import psycopg2
from urllib.parse import unquote
import os

# Get database URL
db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:honey%402620@localhost:5432/ats-hr-backend')
print('Connecting to:', db_url)

# Parse connection details
url_parts = db_url.replace('postgresql://', '').split('@')
user_pass = url_parts[0].split(':')
host_db = url_parts[1].split('/')
username = user_pass[0] 
password = unquote(user_pass[1])  # Decode URL-encoded password
host_port = host_db[0].split(':')
host = host_port[0]
port = host_port[1] if len(host_port) > 1 else '5432'
database = host_db[1]

# Connect and check tables
try:
    conn = psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=username,
        password=password
    )
    cur = conn.cursor()
    
    # Check jobs table columns
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'jobs'
        ORDER BY ordinal_position;
    """)
    
    print('\nJobs table columns:')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]}')
    
    # Check if activities table exists
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'activities';
    """)
    
    activities_exists = cur.fetchone()
    print(f'\nActivities table exists: {bool(activities_exists)}')
    
    if activities_exists:
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'activities'
            ORDER BY ordinal_position;
        """)
        
        print('\nActivities table columns:')
        for row in cur.fetchall():
            print(f'  {row[0]}: {row[1]}')
    
    # Check candidates table
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'candidates'
        ORDER BY ordinal_position;
    """)
    
    print('\nCandidates table columns:')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]}')
    
    conn.close()
    print('\n✅ Database inspection complete')
    
except Exception as e:
    print(f'❌ Database connection error: {e}')
from sqlalchemy import create_engine, text

engine = create_engine('postgresql://postgres:honey%402620@localhost:5432/ats-hr-backend')
conn = engine.connect()

# Update existing jobs with client_name based on client_id
updates = [
    ('cookieman', 'CookieMan'),
    ('itc_infotech', 'ITC Infotech'),
    ('itc_ltd', 'ITC Ltd'),
    ('tcl', 'TCL'),
    ('tctsl', 'TCTSL'),
]

for client_id, client_name in updates:
    sql = text("UPDATE jobs SET client_name = :client_name WHERE client_id = :client_id AND (client_name IS NULL OR client_name = '')")
    conn.execute(sql, {"client_id": client_id, "client_name": client_name})
    print(f"Updated jobs with client_id={client_id} to have client_name={client_name}")
    
conn.commit()
print('\nUpdated existing jobs with client_name')

# Verify
result = conn.execute(text('SELECT id, title, client_id, client_name FROM jobs WHERE client_id IS NOT NULL LIMIT 10'))
print('\nJobs after update:')
for row in result:
    print(row)

conn.close()

from app import models
import sys
# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')
print("Job Table Column Keys:")
print(list(models.Job.__table__.columns.keys()))
print("Foreign Keys on Job table:")
for fk in models.Job.__table__.foreign_keys:
    print(f" - {fk}")

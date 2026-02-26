from app import models
from sqlalchemy import inspect
import sqlalchemy
print(f"SQLAlchemy Version: {sqlalchemy.__version__}")
job_table = models.Job.__table__
print(f"Table Name: {job_table.name}")
print("Columns:")
for col in job_table.columns:
    print(f" - {col.name}")
print("Foreign Keys:")
for fk in job_table.foreign_keys:
    print(f" - {fk}")

from app.db import SessionLocal
from app import models
import sys
try:
    db = SessionLocal()
    print("Attempting to query Job...")
    job = db.query(models.Job).first()
    print("Success!")
except Exception as e:
    print(f"ERROR_MESSAGE: {str(e)}")
    sys.exit(1)

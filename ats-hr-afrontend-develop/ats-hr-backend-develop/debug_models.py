from app.db import SessionLocal
from app import models
try:
    db = SessionLocal()
    print("Attempting to query Job...")
    db.query(models.Job).first()
    print("Success!")
except Exception as e:
    import traceback
    traceback.print_exc()

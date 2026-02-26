from app import models
print("Job Table Column Keys:")
print(list(models.Job.__table__.columns.keys()))

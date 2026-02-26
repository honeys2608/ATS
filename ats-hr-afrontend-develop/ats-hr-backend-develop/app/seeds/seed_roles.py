from app.db import SessionLocal, engine
from app import models


def seed_roles():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # FINAL ROLE LIST (Manager Requirement)
    roles = [
        "super_admin",
        "admin",
        "recruiter",
        "account_manager",
        "internal_hr",
        "consultant",
        "employee",
        "accounts",
        "consultant_support",
        "candidate",
        "vendor",          # Hidden role
        "partner"          # Hidden role
    ]

    for role in roles:
        exists = db.query(models.Role).filter(models.Role.name == role).first()
        if not exists:
            db.add(models.Role(name=role))
            print(f"+ Added Role: {role}")

    db.commit()
    db.close()

    print("\nAll roles seeded successfully.\n")


if __name__ == "__main__":
    seed_roles()

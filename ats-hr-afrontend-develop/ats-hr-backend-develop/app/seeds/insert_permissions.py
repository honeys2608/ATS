from app import models
from app.db import SessionLocal
from app.permissions import ROLE_PERMISSIONS

db = SessionLocal()

def seed_permissions():
    count = 0
    for role, modules in ROLE_PERMISSIONS.items():
        for module, actions in modules.items():
            for action in actions:

                exists = db.query(models.Permission).filter(
                    models.Permission.role_name == role,
                    models.Permission.module_name == module,
                    models.Permission.action_name == action,
                ).first()

                if not exists:
                    perm = models.Permission(
                        role_name=role,
                        module_name=module,
                        action_name=action
                    )
                    db.add(perm)
                    count += 1

    db.commit()
    print(f"Inserted {count} permissions")

if __name__ == "__main__":
    seed_permissions()
"""
Auto Insert RBAC Permissions into Database
Run once:  python insert_permissions.py
"""

from app.db import SessionLocal
from app.models import Permission
from app.permissions import ROLE_PERMISSIONS
from datetime import datetime
import uuid


def generate_uuid():
    return str(uuid.uuid4())


def insert_permissions():
    db = SessionLocal()

    print("\n🔄 Clearing old permissions...")
    db.query(Permission).delete()
    db.commit()

    print("🟢 Inserting fresh permissions...\n")

    count = 0

    for role, modules in ROLE_PERMISSIONS.items():
        for module_name, actions in modules.items():
            for action in actions:
                perm = Permission(
                    id=generate_uuid(),
                    role_name=role,
                    module_name=module_name,
                    action_name=action,
                    created_at=datetime.utcnow()
                )
                db.add(perm)
                count += 1

    db.commit()
    db.close()

    print(f"✅ Inserted {count} permissions successfully!")


if __name__ == "__main__":
    insert_permissions()
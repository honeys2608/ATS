"""
Role-Based Access Control (RBAC)
Fixed + Stable Version
"""

from fastapi import HTTPException
from functools import wraps
import inspect
from sqlalchemy import func

# ---------------------------------------------------------
# MODULE NAME MAPPING
# ---------------------------------------------------------
MODULE_NAMES = {
    "jobs": "Job Management",
    "candidates": "Candidates",
    "interviews": "Interviews",
    "employees": "Employees",
    "onboarding": "Onboarding",
    "leaves": "Leave Management",
    "performance": "Performance Reviews",
    "finance": "Finance",
    "alumni": "Alumni",
    "campaigns": "Campaign Tracking",
    "leads": "Lead Management",
    "settings": "System Settings",
    "users": "User Management",
    "communications": "Communication Manager",
    "job_applications": "Job Applications",
    "dashboard": "Dashboard",
    "folders": "Folders",
    "searches": "Saved Searches",
    "requirements": "Requirements",
    "submissions": "Submissions",
    "notes": "Candidate Notes",
    "notifications": "Notifications",

    # Client / Recruitment
    "client": "Client Management",
    "recruitment": "Recruitment",

    # Super Admin Governance
    "super_admin_dashboard": "Super Admin Dashboard",
    "business_setup": "Business Setup",
    "clients_tenants": "Clients & Tenants",
    "admin_management": "Admin Management",
    "roles_permissions": "Roles & Permissions",
    "operations_analytics": "Operations Analytics",
    "finance_billing": "Finance & Billing",
    "compliance_security": "Compliance & Security",
    "audit_logs": "Audit Logs",
    "system_settings": "System Settings",
    "feature_flags": "Feature Flags",
    "maintenance": "Maintenance",
    "org_structure": "Organization Structure",
    "job_settings": "Job Settings",
    "company_profile": "Company Profile",
    "email_templates": "Email Templates",
    "approval_workflows": "Approval Workflows",
    "integrations": "Integrations",
}

# ---------------------------------------------------------
# ROLE PERMISSIONS
# ---------------------------------------------------------
ROLE_PERMISSIONS = {
    "admin": {
        "dashboard": ["view"],
        "jobs": ["create", "view", "update", "delete"],
        "candidates": ["create", "view", "update", "delete"],
        "interviews": ["create", "view", "update", "delete", "schedule"],
        "employees": ["create", "view", "update", "delete"],
        "onboarding": ["create", "view", "update", "delete"],
        "leaves": ["create", "view", "update", "delete", "approve"],
        "performance": ["create", "view", "update", "delete"],
        "finance": ["create", "view", "update", "delete"],
        "alumni": ["create", "view", "update", "delete"],
        "settings": ["view", "update"],
        "users": ["create", "view", "update", "delete"],
        "campaigns": ["create", "view", "update", "delete"],
        "leads": ["create", "view", "update", "delete"],
        "communications": ["send", "view"],
        "recruitment": ["use_ai", "submit_candidates", "view_reports"],  # ⭐ AI Recruiter
        "job_applications": ["create", "view", "update", "delete"],
        "documents": ["create", "view", "delete"],
        "folders": ["create", "view", "update", "delete"],
        "searches": ["create", "view", "update", "delete"],
        "requirements": ["create", "view", "update", "delete", "assign"],
        "submissions": ["create", "view", "update", "delete"],
        "notes": ["create", "view", "update", "delete"],
        "notifications": ["view", "update"],

        # ⭐ NEW
        "client": ["create", "view", "update", "delete"]
    },

    "super_admin": {
        # All admin permissions
        "dashboard": ["view"],
        "jobs": ["create", "view", "update", "delete"],
        "candidates": ["create", "view", "update", "delete"],
        "interviews": ["create", "view", "update", "delete", "schedule"],
        "employees": ["create", "view", "update", "delete"],
        "onboarding": ["create", "view", "update", "delete"],
        "leaves": ["create", "view", "update", "delete", "approve"],
        "performance": ["create", "view", "update", "delete"],
        "finance": ["create", "view", "update", "delete"],
        "alumni": ["create", "view", "update", "delete"],
        "settings": ["view", "update"],
        "users": ["create", "view", "update", "delete"],
        "campaigns": ["create", "view", "update", "delete"],
        "leads": ["create", "view", "update", "delete"],
        "communications": ["send", "view"],
        "recruitment": ["use_ai", "submit_candidates", "view_reports"],
        "job_applications": ["create", "view", "update", "delete"],
        "documents": ["create", "view", "delete"],
        "folders": ["create", "view", "update", "delete"],
        "searches": ["create", "view", "update", "delete"],
        "client": ["create", "view", "update", "delete"],
        "requirements": ["create", "view", "update", "delete", "assign"],
        "submissions": ["create", "view", "update", "delete"],
        "notes": ["create", "view", "update", "delete"],
        "notifications": ["view", "update"],

        # Super Admin governance modules
        "super_admin_dashboard": ["view"],
        "business_setup": ["view", "manage", "update"],
        "org_structure": ["manage", "view"],
        "job_settings": ["manage", "view"],
        "company_profile": ["manage", "view"],
        "email_templates": ["manage", "view"],
        "approval_workflows": ["manage", "view"],
        "integrations": ["manage", "view"],
        "clients_tenants": ["create", "view", "update", "suspend"],
        "admin_management": ["create", "view", "update", "suspend"],
        "roles_permissions": ["view", "update", "lock"],
        "operations_analytics": ["view"],
        "finance_billing": ["view", "update", "export"],
        "compliance_security": ["view", "export"],
        "audit_logs": ["view", "export"],
        "system_settings": ["view", "update", "manage"],
        "feature_flags": ["view", "update", "manage"],
        "maintenance": ["view", "update", "manage"],
    },

    "recruiter": {
        "dashboard": ["view"],
        "jobs": ["create", "view", "update"],
        "candidates": ["create", "view", "update"],
        "interviews": ["create", "view", "update", "schedule"],
        "employees": ["view"],
        "onboarding": ["view", "update"],
        "leaves": ["view"],
        "performance": ["view"],
        "campaigns": ["create", "view", "update"],
        "leads": ["create", "view", "update"],
        "communications": ["send", "view"],
        "job_applications": ["view"],
        "client": ["view"],
        "recruitment": ["use_ai", "submit_candidates", "view_reports"],  # ⭐ AI Recruiter
        "folders": ["create", "view", "update", "delete"],
        "searches": ["create", "view", "update", "delete"],
        "requirements": ["view"],
        "submissions": ["create", "view", "update"],
        "notes": ["create", "view", "update"],
        "notifications": ["view", "update"]
    },

    "account_manager": {
        "jobs": ["view"],
        "candidates": ["view", "update"],
        "performance": ["view"],
        "finance": ["create", "view", "update"],
        "leads": ["create", "view", "update"],
        "job_applications": ["view"],
        "interviews": ["view", "update"],
        "client": ["create", "view", "update"],
        "recruitment": ["use_ai", "view_reports"],  # ⭐ AI Recruiter
        "requirements": ["create", "view", "update", "assign"],
        "submissions": ["view", "update"],
        "notes": ["create", "view", "update"],
        "notifications": ["view", "update"],
    },

    "internal_hr": {
        "dashboard": ["view"],
        "employees": ["create", "view", "update"],
        "onboarding": ["create", "view", "update"],
        "performance": ["create", "view"],
        "leaves": ["approve", "view"],
        "alumni": ["view"],
        "interviews": ["view", "update"]
    },

    "consultant": {
        "dashboard": ["view"],
        "candidates": ["create", "view"],
        "jobs": ["view"],
        "interviews": ["view"],
        "leads": ["view"]
    },

    "employee": {
        "dashboard": ["view"],
        "employees": ["view_self"],
        "onboarding": ["view_self"],
        "leaves": ["create", "view_self"],
        "performance": ["view_self"],
        "alumni": ["view"],
        "documents": ["upload_self", "view_self"]
    },

    "accounts": {
        "dashboard": ["view"],
        "finance": ["create", "view", "update"],
        "employees": ["view"],
        "payroll": ["view", "update"]
    },

    "consultant_support": {
        "dashboard": ["view"],
        "candidates": ["view"],
        "communications": ["send", "view"],
        "jobs": ["view"]
    },

    "candidate": {
        "dashboard": ["view"],
        "jobs": ["view"],
        "candidates": ["create", "view", "upload_resume"],
        "job_applications": ["create"]
    },


    "client": {
        "client": ["create", "view", "update"],
        "jobs": ["view"],
        "job_applications": ["view"],
    },
    "vendor": {
        "dashboard": ["view"],
        "candidates": ["create", "view"],
        "documents": ["create", "view"],
    },


}

# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------
def _normalize_token(value: str) -> str:
    return str(value or "").strip().lower()


def _token_variants(value: str):
    token = _normalize_token(value)
    if not token:
        return set()
    underscored = " ".join(token.replace("_", " ").split()).replace(" ", "_")
    spaced = underscored.replace("_", " ")
    return {token, underscored, spaced}


def has_permission(role: str, module: str, action: str) -> bool:
    role_key = _normalize_token(role)
    module_key = _normalize_token(module)
    action_key = _normalize_token(action)

    if role_key == "super_admin":
        return True

    # 1) Fast-path static permissions
    static_modules = ROLE_PERMISSIONS.get(role_key, {})
    static_actions = [
        _normalize_token(a) for a in static_modules.get(module_key, [])
    ]
    if action_key in static_actions:
        return True

    # 2) Runtime DB permissions (custom roles/modules/actions)
    try:
        from app.db import SessionLocal
        from app import models

        db = SessionLocal()
        try:
            role_vals = list(_token_variants(role_key))
            module_vals = list(_token_variants(module_key))
            action_vals = list(_token_variants(action_key))
            if not role_vals or not module_vals or not action_vals:
                return False

            row = (
                db.query(models.Permission.id)
                .filter(func.lower(models.Permission.role_name).in_(role_vals))
                .filter(func.lower(models.Permission.module_name).in_(module_vals))
                .filter(func.lower(models.Permission.action_name).in_(action_vals))
                .first()
            )
            return row is not None
        finally:
            db.close()
    except Exception:
        return False


def get_user_permissions(role: str):
    role_key = _normalize_token(role)
    static = ROLE_PERMISSIONS.get(role_key)
    if static:
        return static

    try:
        from app.db import SessionLocal
        from app import models

        out = {}
        db = SessionLocal()
        try:
            role_vals = list(_token_variants(role_key))
            if not role_vals:
                return {}
            rows = (
                db.query(models.Permission.module_name, models.Permission.action_name)
                .filter(func.lower(models.Permission.role_name).in_(role_vals))
                .all()
            )
            for module_name, action_name in rows:
                module_key = _normalize_token(module_name)
                action_key = _normalize_token(action_name)
                if not module_key or not action_key:
                    continue
                out.setdefault(module_key, [])
                if action_key not in out[module_key]:
                    out[module_key].append(action_key)
            return out
        finally:
            db.close()
    except Exception:
        return {}


def get_all_roles_summary():
    summary = {}
    for role, modules in ROLE_PERMISSIONS.items():
        summary[role] = {
            "role": role,
            "total_modules": len(modules),
            "total_permissions": sum(len(actions) for actions in modules.values()),
            "modules": modules,
        }
    return summary



# ---------------------------------------------------------
# EXACT PERMISSION DECORATOR
# ---------------------------------------------------------
def require_permission(module: str, action: str):
    def decorator(func):
        is_async = inspect.iscoroutinefunction(func)

        @wraps(func)
        async def async_wrapper(*args, current_user=None, **kwargs):
            if not current_user:
                raise HTTPException(401, "Authentication required")

            role = current_user.get("role")

            if not has_permission(role, module, action):
                raise HTTPException(
                    403,
                    f"Role '{role}' does NOT have permission '{action}' on module '{module}'."
                )

            return await func(*args, current_user=current_user, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, current_user=None, **kwargs):
            if not current_user:
                raise HTTPException(401, "Authentication required")

            role = current_user.get("role")

            if not has_permission(role, module, action):
                raise HTTPException(
                    403,
                    f"Role '{role}' does NOT have permission '{action}' on module '{module}'."
                )

            return func(*args, current_user=current_user, **kwargs)

        return async_wrapper if is_async else sync_wrapper

    return decorator


# ---------------------------------------------------------
# ANY PERMISSION DECORATOR
# ---------------------------------------------------------
def require_any_permission(module: str, actions: list):
    def decorator(func):

        is_async = inspect.iscoroutinefunction(func)

        @wraps(func)
        async def async_wrapper(*args, current_user=None, **kwargs):

            if not current_user:
                raise HTTPException(401, "Authentication required")

            role = current_user.get("role")

            if not any(has_permission(role, module, a) for a in actions):
                raise HTTPException(
                    403,
                    f"Role '{role}' lacks required permissions {actions}"
                )

            return await func(*args, current_user=current_user, **kwargs)

        @wraps(func)
        def sync_wrapper(*args, current_user=None, **kwargs):

            if not current_user:
                raise HTTPException(401, "Authentication required")

            role = current_user.get("role")

            if not any(has_permission(role, module, a) for a in actions):
                raise HTTPException(
                    403,
                    f"Role '{role}' lacks required permissions {actions}"
                )

            return func(*args, current_user=current_user, **kwargs)

        return async_wrapper if is_async else sync_wrapper

    return decorator

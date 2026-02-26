from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import SystemSettings
from app.auth import get_current_user
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, validator
from sqlalchemy import text

router = APIRouter(prefix="/v1/settings", tags=["settings"])


# -----------------------------
# Setting Update Schema
# -----------------------------
class SettingUpdate(BaseModel):
    module_name: str
    setting_key: str
    setting_value: dict
    description: Optional[str] = None

    @validator("setting_value")
    def validate_org_code(cls, v, values):
        """
        Validate only when setting_key == organization_code
        """
        key = values.get("setting_key")

        if key == "organization_code":
            if "code" not in v:
                raise ValueError("organization_code must contain {'code': 'ABC'}")

            code = v["code"]

            if not (len(code) == 3 and code.isalpha() and code.isupper()):
                raise ValueError("Organization code must be exactly 3 uppercase letters (e.g., 'ABC')")

        return v


# ------------------------------------------------------
# ⭐ UNIVERSAL UNIQUE ID GENERATOR (Candidate / Job / Employee)
# ------------------------------------------------------
def generate_unique_id(db: Session, prefix_key: str, default_prefix: str, table_name: str, column_name: str):
    """
    Generates IDs like:

    ORG-C-0001
    ORG-E-0001
    ORG-J-0001

    Based on Settings values.
    """

    # 1️⃣ Fetch organization code
    org_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.module_name == "organization",
                SystemSettings.setting_key == "organization_code")
        .first()
    )

    org_code = "ORG"
    if org_setting and "code" in org_setting.setting_value:
        org_code = org_setting.setting_value["code"].upper()

    # 2️⃣ Fetch prefix (Candidate / Employee / Job)
    prefix_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.module_name == "organization",
                SystemSettings.setting_key == prefix_key)
        .first()
    )

    prefix = default_prefix
    if prefix_setting and "prefix" in prefix_setting.setting_value:
        prefix = prefix_setting.setting_value["prefix"].upper()

    # 3️⃣ Build prefix pattern
    base_prefix = f"{org_code}-{prefix}-"

    # 4️⃣ Fetch all existing IDs matching prefix
    query = text(f"SELECT {column_name} FROM {table_name} WHERE {column_name} LIKE '{base_prefix}%'")
    rows = db.execute(query).fetchall()

    max_num = 0
    for row in rows:
        existing_id = row[0]
        try:
            number = int(existing_id.split("-")[-1])
            max_num = max(max_num, number)
        except:
            continue

    # 5️⃣ Assign next ID
    new_number = max_num + 1
    new_id = f"{base_prefix}{new_number:04d}"
    return new_id


# -----------------------------
# GET ALL SETTINGS
# -----------------------------
@router.get("")
def get_all_settings(
    module_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    query = db.query(SystemSettings)

    if module_name:
        query = query.filter(SystemSettings.module_name == module_name)

    settings = query.all()

    result = {}
    for setting in settings:
        if setting.module_name not in result:
            result[setting.module_name] = {}

        result[setting.module_name][setting.setting_key] = {
            "value": setting.setting_value,
            "description": setting.description,
            "updated_at": setting.updated_at.isoformat() if setting.updated_at else None,
        }

    return result


# -----------------------------
# UPDATE / CREATE SETTING
# -----------------------------
@router.put("")
def update_setting(
    setting_data: SettingUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    existing = db.query(SystemSettings).filter(
        SystemSettings.module_name == setting_data.module_name,
        SystemSettings.setting_key == setting_data.setting_key
    ).first()

    if existing:
        existing.setting_value = setting_data.setting_value
        existing.description = setting_data.description
        existing.updated_by = current_user["id"]
        existing.updated_at = datetime.utcnow()
    else:
        new_setting = SystemSettings(
            module_name=setting_data.module_name,
            setting_key=setting_data.setting_key,
            setting_value=setting_data.setting_value,
            description=setting_data.description,
            updated_by=current_user["id"],
        )
        db.add(new_setting)

    db.commit()
    return {"message": "Setting updated successfully"}


# -----------------------------
# INITIALIZE DEFAULT SETTINGS
# -----------------------------
@router.post("/initialize")
def initialize_default_settings(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    default_settings = [
        {
            "module_name": "organization",
            "setting_key": "organization_code",
            "setting_value": {"code": "ABC"},
            "description": "3-letter organization code used in IDs"
        },

        # ⭐ NEW PREFIX KEYS ADDED:
        {
            "module_name": "organization",
            "setting_key": "candidate_prefix",
            "setting_value": {"prefix": "C"},
            "description": "Prefix for Candidate IDs"
        },
        {
            "module_name": "organization",
            "setting_key": "employee_prefix",
            "setting_value": {"prefix": "E"},
            "description": "Prefix for Employee IDs"
        },
        {
            "module_name": "organization",
            "setting_key": "job_prefix",
            "setting_value": {"prefix": "J"},
            "description": "Prefix for Job IDs"
        },

        # Existing settings ↓
        {
            "module_name": "recruitment",
            "setting_key": "auto_screening_enabled",
            "setting_value": {"enabled": True, "threshold": 70},
            "description": "Enable automatic candidate screening with AI"
        },
        {
            "module_name": "recruitment",
            "setting_key": "interview_modes",
            "setting_value": {"text": True, "video": False},
            "description": "Enabled interview modes"
        },
        {
            "module_name": "leaves",
            "setting_key": "leave_policy",
            "setting_value": {
                "casual": 12,
                "sick": 12,
                "earned": 15,
                "maternity": 180,
                "paternity": 15,
                "auto_approve_threshold": 2
            },
            "description": "Leave allocation per year"
        },
        {
            "module_name": "leaves",
            "setting_key": "approval_workflow",
            "setting_value": {
                "requires_manager_approval": True,
                "requires_hr_approval": False,
                "auto_approve_days": 2
            },
            "description": "Leave approval workflow configuration"
        },
        {
            "module_name": "onboarding",
            "setting_key": "default_tasks",
            "setting_value": {
                "tasks": [
                    "Submit ID proof",
                    "Submit address proof",
                    "Complete compliance training",
                    "IT asset allocation",
                    "Team introduction"
                ]
            },
            "description": "Default onboarding tasks"
        },
        {
            "module_name": "performance",
            "setting_key": "review_cycle",
            "setting_value": {
                "frequency": "quarterly",
                "rating_scale": 5,
                "self_review_enabled": True
            },
            "description": "Performance review cycle"
        },
        {
            "module_name": "ai",
            "setting_key": "models",
            "setting_value": {
                "resume_parser": "local-nlp-v1",
                "interview_bot": "local-llm-v1",
                "bias_detection": "enabled"
            },
            "description": "AI model configuration"
        }
    ]

    for setting_data in default_settings:
        existing = db.query(SystemSettings).filter(
            SystemSettings.module_name == setting_data["module_name"],
            SystemSettings.setting_key == setting_data["setting_key"]
        ).first()

        if not existing:
            new_setting = SystemSettings(
                **setting_data,
                updated_by=current_user["id"]
            )
            db.add(new_setting)

    db.commit()
    return {"message": "Default settings initialized"}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
from app.routes import documents
from app.db import init_db
from app.routes import chat
# ---------------- ROUTERS ----------------
from app.auth import router as auth_router
from app.routes.jobs import router as jobs_router
from app.routes.candidates import router as candidates_router
from app.routes.interviews import router as interviews_router
from app.routes.onboarding import router as onboarding_router
from app.routes.employees import router as employees_router
from app.routes.invoices import router as invoices_router
from app.routes.alumni import router as alumni_router
from app.routes.leaves import router as leaves_router
from app.routes.settings import router as settings_router
from app.routes.careers import router as careers_router
from app.routes.leads import router as leads_router
from app.routes.communications import router as communications_router
from app.routes.performance import router as performance_router
from app.routes.users import router as users_router
from app.routes.payroll import router as payroll_router
from app.routes.submissions import router as submissions_router

from app.routes.campaigns import router as campaigns_router
from app.routes import matching

# ⭐ RBAC
from app.routes.roles_router import router as roles_router
from app.routes.permissions_router import router as permissions_router
from app.routes.permissions_matrix_router import router as permissions_matrix_router

# ⭐ Candidate Portal (NEW)
from app.routes.candidate_portal import router as candidate_portal_router

# -----------------------------------------
from app.routes.dashboard import router as dashboard_router
from app.routes.consultants import router as consultant_router
from app.routes.consultant_deployments import router as consultant_deployments_router
from app.routes.consultant_dashboard import router as consultant_dashboard_router
from app.routes.timesheets import router as timesheets_router


from app.routes.ai_video_interviews import router as ai_video_interview_router
from app.routes.live_interviews import router as live_interview_router
from app.routes.activities import router as activities_router
from app.routes.activity import router as activity_router


from app.routes.interview_summary import router as interview_summary_router
from app.routes.account_manager import (
    router as account_manager_router,
    dashboard_alias_router as account_manager_dashboard_alias_router,
)
from app.routes.client import router as client_router
from app.routes.recruiter import router as recruiter_router
from app.routes.notifications import router as notifications_router
from app.routes.vendor import router as vendor_router
from app.routes.bgv import router as bgv_router
from app.routes.client_admin import router as client_admin_router
from app.routes.skills import router as skills_router
from app.routes.super_admin import router as super_admin_router
from app.routes.super_admin_business_setup import router as super_admin_business_setup_router
from app.routes.superadmin_alias import router as superadmin_alias_router
from app.routes.super_admin_tracker import router as super_admin_tracker_router
from app.routes.config import router as config_router
from app.routes.nomenclature import router as nomenclature_router
from app.routes.audit_logs import router as audit_logs_router
from app.routes.super_admin_workflow import router as super_admin_workflow_router
from app.routes.super_admin_tasks import router as super_admin_tasks_router

# ⭐ Resume & Candidate Intake
from app.routes.resume_intake import router as resume_intake_router

# ⭐ Job Management (Requirements & Postings)
from app.routes.job_management import router as job_management_router

# ⭐ Resdex - Advanced Search & Invites
from app.routes.resdex import router as resdex_router
from app.routes.searches import router as searches_router
from app.routes.nvite import router as nvite_router
from app.routes.reports import router as reports_router
from app.routes.folders import router as folders_router

# ⭐ Passive Requirement Monitoring
from app.passive_requirement_monitor import setup_background_scheduler

# ⭐ NEW WORKFLOW ROUTERS
from app.routes.recruiter_workflows import router as recruiter_workflows_router
from app.routes.am_workflows import router as am_workflows_router
from app.routes.client_workflows import router as client_workflows_router
from app.routes.requirement_workflow import router as requirement_workflow_router
from app.routes.candidate_workflow import router as candidate_workflow_router

from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.permissions import ROLE_PERMISSIONS
from app import models
from app.services.audit_service import register_audit_middleware
from app.events.audit_listeners import register_audit_listeners
from app.middleware.maintenance_mode import register_maintenance_middleware


def seed_permissions_to_db():
    db: Session = SessionLocal()

    print("Seeding ROLE_PERMISSIONS into DB (upsert missing)...")

    existing = db.query(models.Permission).all()
    existing_keys = {(p.role_name, p.module_name, p.action_name) for p in existing}

    added = 0
    for role, modules in ROLE_PERMISSIONS.items():
        for module_name, actions in modules.items():
            for action in actions:
                key = (role, module_name, action)
                if key in existing_keys:
                    continue
                perm = models.Permission(
                    role_name=role,
                    module_name=module_name,
                    action_name=action
                )
                db.add(perm)
                added += 1

    db.commit()
    db.close()
    print(f"Permissions upsert complete. Added: {added}")

# ---------------- FASTAPI APP ----------------
FASTAPI_ROOT_PATH = os.getenv(
    "FASTAPI_ROOT_PATH",
    "/ats-ats-hr-afrontend-develop-at2",
).strip()
if FASTAPI_ROOT_PATH == "/":
    FASTAPI_ROOT_PATH = ""

app = FastAPI(
    title="Akshu HR Platform",
    description="AI-Powered End-to-End HR Automation Platform",
    version="1.0.0",
    root_path=FASTAPI_ROOT_PATH,
    docs_url="/docs",
    openapi_url="/openapi.json",
)
register_audit_middleware(app)
register_maintenance_middleware(app)


# ---------------- CORS ----------------
default_origins = [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:5001",
    "http://localhost:5002",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5001",
    "http://127.0.0.1:5002",
    "http://127.0.0.1:5173",
    "https://hammerhead-app-2ndu8.ondigitalocean.app",
]

cors_origins_env = os.getenv("BACKEND_CORS_ORIGINS", "").strip()
if cors_origins_env:
    origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    origins = default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.ondigitalocean\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- STATIC FILES (Resume, Documents, Images) ----------------
if not os.path.exists("uploads"):
    os.makedirs("uploads")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ---------------- INCLUDE ROUTERS ----------------
public_routers = [
    auth_router,
    careers_router,
    candidate_portal_router,   # ⭐ Candidate Self-Service APIs
]

protected_routers = [
    jobs_router,
    job_management_router,  # ⭐ Job Management (Requirements & Postings)
    skills_router,  
    candidates_router,
    interviews_router,
    onboarding_router,
    employees_router,
    documents.router,
    invoices_router,
    alumni_router,
    leaves_router,
    settings_router,
    leads_router,
    communications_router,
    performance_router,
    users_router,
    payroll_router,
    campaigns_router,
    roles_router,
    permissions_router,
    permissions_matrix_router,
    activities_router,
    activity_router,
    dashboard_router,
    matching.router,
    submissions_router,
    chat.router,
    consultant_router,
    consultant_deployments_router,
    consultant_dashboard_router,
    ai_video_interview_router,
    live_interview_router,
    interview_summary_router,
    account_manager_router,
    account_manager_dashboard_alias_router,
    client_admin_router,
    client_router,
    recruiter_router,
    notifications_router,
    vendor_router,
    bgv_router,
    timesheets_router,
    recruiter_workflows_router,
    am_workflows_router,
    client_workflows_router,
    requirement_workflow_router,
    candidate_workflow_router,  # ⭐ Candidate Workflow
    resume_intake_router,
    resdex_router,  # ⭐ Resdex routes
    searches_router,
    nvite_router,
    reports_router,
    folders_router,
    super_admin_router,
    super_admin_business_setup_router,
    superadmin_alias_router,
    super_admin_tracker_router,
    super_admin_workflow_router,
    super_admin_tasks_router,
    audit_logs_router,
    config_router,
    nomenclature_router,
]


# Add Public Routers First
for r in public_routers:
    app.include_router(r)

# Add Protected Routers After
for r in protected_routers:
    app.include_router(r)


# ---------------- STARTUP ----------------
@app.on_event("startup")
async def startup_event():
    init_db()
    seed_permissions_to_db()
    register_audit_listeners()
    
    # ⭐ Initialize Passive Requirement Monitoring
    try:
        scheduler = setup_background_scheduler()
        if scheduler:
            print("Background scheduler started for passive requirement monitoring")
        else:
            print("Background scheduler not available - install APScheduler for production")
    except Exception as e:
        print(f"Failed to start background scheduler: {e}")

# ---------------- BASIC ENDPOINTS ----------------
@app.get("/api")
def read_root():
    return {
        "message": "Welcome to Akshu HR Platform",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": "Akshu HR Platform"}


# ---------------- FRONTEND STATIC SERVE ----------------
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")

if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
else:
    @app.get("/")
    def frontend_placeholder():
        return {"status": "ok", "message": "Frontend not built yet"}


# ---------------- RUN APP ----------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)


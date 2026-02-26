from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# -------------------------------------------
# GET DATABASE URL FROM .env
# -------------------------------------------
print("DATABASE_URL from ENV:", os.getenv("DATABASE_URL"))

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise Exception("DATABASE_URL not found in .env file")

# SQLite ke liye extra config (only if URL startswith sqlite)
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Engine
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base model
Base = declarative_base()

# DB session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables without Alembic
def init_db():
    from app import models
    Base.metadata.create_all(bind=engine)
    ensure_user_columns()
    ensure_candidate_bulk_columns()
    ensure_candidate_status_enum_values()
    ensure_candidate_resume_columns()
    ensure_saved_search_columns()
    ensure_interview_columns()
    ensure_candidate_submission_columns()
    ensure_job_application_interview_ready_columns()
    ensure_requirement_columns()
    ensure_requirement_assignment_table()
    ensure_candidate_notes_columns()
    ensure_interview_workflow_columns()
    ensure_system_notification_columns()
    ensure_activity_log_indexes()
    ensure_enterprise_audit_log_columns()


def ensure_user_columns():
    """
    Ensure critical columns exist in the users table for PostgreSQL.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_manager_id VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP NULL",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_candidate_bulk_columns():
    """
    Ensure candidate bulk upload columns exist in Postgres without requiring Alembic.
    This is a safe no-op for SQLite and for columns that already exist.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS gender VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS marital_status VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS state VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS country VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_job_title VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS relevant_experience_years DOUBLE PRECISION",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS qualification VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS university VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS graduation_year INTEGER",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS certifications_text TEXT",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS notice_period_days INTEGER",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS primary_skill VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS secondary_skill VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_ctc DOUBLE PRECISION",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS willing_to_relocate BOOLEAN",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS preferred_employment_type VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS availability_to_join DATE",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_working_day DATE",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL",
        """
CREATE TABLE IF NOT EXISTS candidate_bulk_upload_logs (
    id VARCHAR PRIMARY KEY,
    uploaded_by VARCHAR NULL,
    filename VARCHAR NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    error_csv_path VARCHAR NULL,
    created_at TIMESTAMP NULL
)
""",
        """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_candidate_bulk_upload_logs_uploaded_by'
    ) THEN
        ALTER TABLE candidate_bulk_upload_logs
        ADD CONSTRAINT fk_candidate_bulk_upload_logs_uploaded_by
        FOREIGN KEY (uploaded_by) REFERENCES users(id);
    END IF;
END $$;
""",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_saved_search_columns():
    """
    Ensure saved_searches columns exist for ATS search storage without Alembic.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS filters JSONB",
        "ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS result_count INTEGER DEFAULT 0",
        "ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS folder_id VARCHAR",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_interview_columns():
    """
    Ensure interview columns exist without destructive migrations.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS location TEXT",
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS contact_person VARCHAR",
        "ALTER TABLE interview_answers ADD COLUMN IF NOT EXISTS session_id VARCHAR",
        """
CREATE TABLE IF NOT EXISTS interview_sessions (
    id VARCHAR PRIMARY KEY,
    interview_id VARCHAR NOT NULL,
    candidate_id VARCHAR NULL,
    status VARCHAR DEFAULT 'in_progress',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    questions JSONB,
    current_index INTEGER DEFAULT 0,
    last_question TEXT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
)
""",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_candidate_submission_columns():
    """
    Ensure candidate submission columns exist without destructive migrations.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE candidate_submissions ADD COLUMN IF NOT EXISTS source VARCHAR",
        "ALTER TABLE candidate_submissions ADD COLUMN IF NOT EXISTS requirement_id VARCHAR",
        "ALTER TABLE candidate_submissions ADD COLUMN IF NOT EXISTS stage VARCHAR",
        "ALTER TABLE candidate_submissions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE",
        "ALTER TABLE candidate_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_job_application_interview_ready_columns():
    """
    Ensure interview scheduling handoff columns exist on job_applications.
    Supports PostgreSQL and SQLite legacy databases.
    """
    if not DATABASE_URL:
        return

    dialect = engine.dialect.name

    if DATABASE_URL.startswith("postgres"):
        ddl = [
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS interview_scheduling_ready BOOLEAN DEFAULT FALSE",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS interview_scheduling_note TEXT",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS interview_scheduling_ready_at TIMESTAMP NULL",
            "ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS interview_scheduling_ready_by VARCHAR",
        ]
        with engine.begin() as conn:
            for statement in ddl:
                conn.execute(text(statement))
        return

    if dialect == "sqlite":
        with engine.begin() as conn:
            columns = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(job_applications)")).fetchall()
            }
            ddl = []
            if "interview_scheduling_ready" not in columns:
                ddl.append(
                    "ALTER TABLE job_applications ADD COLUMN interview_scheduling_ready BOOLEAN DEFAULT 0"
                )
            if "interview_scheduling_note" not in columns:
                ddl.append(
                    "ALTER TABLE job_applications ADD COLUMN interview_scheduling_note TEXT"
                )
            if "interview_scheduling_ready_at" not in columns:
                ddl.append(
                    "ALTER TABLE job_applications ADD COLUMN interview_scheduling_ready_at TIMESTAMP"
                )
            if "interview_scheduling_ready_by" not in columns:
                ddl.append(
                    "ALTER TABLE job_applications ADD COLUMN interview_scheduling_ready_by VARCHAR"
                )
            for statement in ddl:
                conn.execute(text(statement))


def ensure_enterprise_audit_log_columns():
    """
    Ensure enterprise audit columns/indexes exist without destructive migrations.
    """
    if not DATABASE_URL:
        return

    dialect = engine.dialect.name

    if DATABASE_URL.startswith("postgres"):
        ddl = [
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS log_id VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_email VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_label VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_name VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'success'",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS failure_reason TEXT",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value JSONB",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS browser VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS os VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS location VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS endpoint VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS http_method VARCHAR",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS response_code INTEGER",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR DEFAULT 'INFO'",
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_system_action BOOLEAN DEFAULT FALSE",
            "UPDATE audit_logs SET created_at = COALESCE(created_at, timestamp, CURRENT_TIMESTAMP)",
            "UPDATE audit_logs SET log_id = COALESCE(log_id, id)",
            "UPDATE audit_logs SET action_label = COALESCE(action_label, REPLACE(INITCAP(REPLACE(action, '_', ' ')), ' Api ', ' API '))",
            "UPDATE audit_logs SET status = COALESCE(NULLIF(LOWER(status), ''), CASE WHEN COALESCE(response_code, 200) >= 400 OR failure_reason IS NOT NULL THEN 'failed' ELSE 'success' END)",
            "UPDATE audit_logs SET old_value = COALESCE(old_value, old_values)",
            "UPDATE audit_logs SET new_value = COALESCE(new_value, new_values)",
            "ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL",
            "ALTER TABLE audit_logs ALTER COLUMN entity_type DROP NOT NULL",
            "ALTER TABLE audit_logs ALTER COLUMN entity_id DROP NOT NULL",
            "ALTER TABLE audit_logs ALTER COLUMN new_state DROP NOT NULL",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs (tenant_id)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs (status)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs (severity)",
            "CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs (module)",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_log_id ON audit_logs (log_id)",
        ]

        with engine.begin() as conn:
            for statement in ddl:
                try:
                    conn.execute(text(statement))
                except Exception:
                    # Keep startup resilient even if schema is already partially migrated.
                    continue
        return

    if dialect == "sqlite":
        with engine.begin() as conn:
            try:
                columns = {
                    row[1]
                    for row in conn.execute(text("PRAGMA table_info(audit_logs)")).fetchall()
                }
            except Exception:
                return

            ddl = []
            if "actor_id" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN actor_id VARCHAR")
            if "log_id" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN log_id VARCHAR")
            if "created_at" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN created_at TIMESTAMP")
            if "actor_name" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN actor_name VARCHAR")
            if "actor_email" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN actor_email VARCHAR")
            if "actor_role" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN actor_role VARCHAR")
            if "tenant_id" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN tenant_id VARCHAR")
            if "module" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN module VARCHAR")
            if "action_label" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN action_label VARCHAR")
            if "description" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN description TEXT")
            if "entity_name" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN entity_name VARCHAR")
            if "status" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN status VARCHAR DEFAULT 'success'")
            if "failure_reason" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN failure_reason TEXT")
            if "old_value" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN old_value JSON")
            if "new_value" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN new_value JSON")
            if "old_values" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN old_values JSON")
            if "new_values" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN new_values JSON")
            if "ip_address" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR")
            if "user_agent" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN user_agent TEXT")
            if "device" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN device VARCHAR")
            if "browser" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN browser VARCHAR")
            if "os" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN os VARCHAR")
            if "location" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN location VARCHAR")
            if "endpoint" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN endpoint VARCHAR")
            if "http_method" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN http_method VARCHAR")
            if "response_code" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN response_code INTEGER")
            if "severity" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN severity VARCHAR DEFAULT 'INFO'")
            if "is_system_action" not in columns:
                ddl.append("ALTER TABLE audit_logs ADD COLUMN is_system_action BOOLEAN DEFAULT 0")
            ddl.extend(
                [
                    "UPDATE audit_logs SET created_at = COALESCE(created_at, timestamp, CURRENT_TIMESTAMP)",
                    "UPDATE audit_logs SET log_id = COALESCE(log_id, id)",
                    "UPDATE audit_logs SET action_label = COALESCE(action_label, action)",
                    "UPDATE audit_logs SET status = COALESCE(NULLIF(LOWER(status), ''), CASE WHEN failure_reason IS NOT NULL THEN 'failed' ELSE 'success' END)",
                    "UPDATE audit_logs SET old_value = COALESCE(old_value, old_values)",
                    "UPDATE audit_logs SET new_value = COALESCE(new_value, new_values)",
                ]
            )

            for statement in ddl:
                try:
                    conn.execute(text(statement))
                except Exception:
                    continue

            # Indexes
            for statement in [
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity)",
                "CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module)",
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_log_id ON audit_logs(log_id)",
            ]:
                try:
                    conn.execute(text(statement))
                except Exception:
                    continue
        return

    ddl = [
        # Unknown DB dialect fallback: no-op
    ]

    _ = ddl


def ensure_candidate_status_enum_values():
    """
    Ensure PostgreSQL candidate status enums include all workflow states.
    Handles both legacy enum name `candidatestatus` and newer `candidate_status`.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    # Local import to avoid circular imports during module load.
    from app.models import CandidateStatus

    required_values = [status.value for status in CandidateStatus]

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        existing_types = {
            row[0]
            for row in conn.execute(
                text(
                    """
                    SELECT typname
                    FROM pg_type
                    WHERE typname IN ('candidate_status', 'candidatestatus')
                    """
                )
            ).fetchall()
        }

        for enum_type in ("candidate_status", "candidatestatus"):
            if enum_type not in existing_types:
                continue

            for value in required_values:
                safe_value = value.replace("'", "''")
                conn.execute(
                    text(f"ALTER TYPE {enum_type} ADD VALUE IF NOT EXISTS '{safe_value}'")
                )


def ensure_requirement_columns():
    """
    Ensure requirement columns exist for workflow module.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS requirement_code VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS client_id VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS client_name VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS client_contact VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS title VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS description TEXT",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS entry_method VARCHAR DEFAULT 'manual'",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS raw_email_content TEXT",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS skills_mandatory JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS skills_good_to_have JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS experience_min DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS experience_max DOUBLE PRECISION",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS ctc_min DOUBLE PRECISION",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS ctc_max DOUBLE PRECISION",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS location_details JSONB",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]'::jsonb",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS positions_count INTEGER DEFAULT 1",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS interview_stages JSONB",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS urgency VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS target_start_date DATE",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS department VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS reporting_manager VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS priority VARCHAR DEFAULT 'Medium'",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP NULL",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS job_id VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'new'",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS metadata_json JSONB",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP NULL",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS activity_status VARCHAR DEFAULT 'active'",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS passive_notification_sent BOOLEAN DEFAULT FALSE",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS last_passive_alert_at TIMESTAMP NULL",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NULL",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS created_by_id VARCHAR",
        "ALTER TABLE requirements ADD COLUMN IF NOT EXISTS account_manager_id VARCHAR",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_requirement_assignment_table():
    """
    Ensure requirement_assignments table exists for AM → Recruiter assignment tracking.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        """
CREATE TABLE IF NOT EXISTS requirement_assignments (
    id VARCHAR PRIMARY KEY,
    requirement_id VARCHAR NOT NULL,
    recruiter_id VARCHAR NOT NULL,
    assigned_by VARCHAR NOT NULL,
    assigned_at TIMESTAMP NULL,
    status VARCHAR DEFAULT 'active',
    notes TEXT NULL
)
""",
        """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_requirement_assignments_requirement'
    ) THEN
        ALTER TABLE requirement_assignments
        ADD CONSTRAINT fk_requirement_assignments_requirement
        FOREIGN KEY (requirement_id) REFERENCES requirements(id);
    END IF;
END $$;
""",
        """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_requirement_assignments_recruiter'
    ) THEN
        ALTER TABLE requirement_assignments
        ADD CONSTRAINT fk_requirement_assignments_recruiter
        FOREIGN KEY (recruiter_id) REFERENCES users(id);
    END IF;
END $$;
""",
        """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_requirement_assignments_assigner'
    ) THEN
        ALTER TABLE requirement_assignments
        ADD CONSTRAINT fk_requirement_assignments_assigner
        FOREIGN KEY (assigned_by) REFERENCES users(id);
    END IF;
END $$;
""",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_candidate_notes_columns():
    """
    Ensure structured candidate note columns exist.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS submission_id VARCHAR",
        "ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS note_stage VARCHAR",
        "ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS rating INTEGER",
        "ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS strengths TEXT",
        "ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS concerns TEXT",
        "ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS free_text TEXT",
        "ALTER TABLE candidate_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_interview_workflow_columns():
    """
    Ensure interview workflow columns exist.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interview_date DATE",
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interview_time VARCHAR",
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interviewer_name VARCHAR",
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS location_or_link VARCHAR",
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS am_informed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS client_informed BOOLEAN DEFAULT FALSE",
        "ALTER TABLE interviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_system_notification_columns():
    """
    Ensure system notification workflow columns exist.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS reference_id VARCHAR",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_candidate_resume_columns():
    """
    Ensure candidate resume intake columns exist without Alembic.
    """
    if not DATABASE_URL or not DATABASE_URL.startswith("postgres"):
        return

    ddl = [
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_path TEXT",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS intake_status VARCHAR",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS parsed_data_json JSONB",
        "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS uploaded_by_recruiter_id VARCHAR",
    ]

    with engine.begin() as conn:
        for statement in ddl:
            conn.execute(text(statement))


def ensure_activity_log_indexes():
    """
    Ensure activity_logs indexes exist for query-heavy feed endpoints.
    """
    if not DATABASE_URL:
        return

    dialect = engine.dialect.name
    statements = []

    if DATABASE_URL.startswith("postgres"):
        statements = [
            "CREATE INDEX IF NOT EXISTS idx_al_created_at ON activity_logs(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_al_actor_id ON activity_logs(actor_id)",
            "CREATE INDEX IF NOT EXISTS idx_al_actor_role ON activity_logs(actor_role)",
            "CREATE INDEX IF NOT EXISTS idx_al_resource ON activity_logs(resource_type, resource_id)",
            "CREATE INDEX IF NOT EXISTS idx_al_target_user ON activity_logs(target_user_id)",
            "CREATE INDEX IF NOT EXISTS idx_al_job_id ON activity_logs(job_id)",
            "CREATE INDEX IF NOT EXISTS idx_al_recruiter_id ON activity_logs(recruiter_id)",
        ]
    elif dialect == "sqlite":
        statements = [
            "CREATE INDEX IF NOT EXISTS idx_al_created_at ON activity_logs(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_al_actor_id ON activity_logs(actor_id)",
            "CREATE INDEX IF NOT EXISTS idx_al_actor_role ON activity_logs(actor_role)",
            "CREATE INDEX IF NOT EXISTS idx_al_resource ON activity_logs(resource_type, resource_id)",
            "CREATE INDEX IF NOT EXISTS idx_al_target_user ON activity_logs(target_user_id)",
            "CREATE INDEX IF NOT EXISTS idx_al_job_id ON activity_logs(job_id)",
            "CREATE INDEX IF NOT EXISTS idx_al_recruiter_id ON activity_logs(recruiter_id)",
        ]

    if not statements:
        return

    with engine.begin() as conn:
        for statement in statements:
            try:
                conn.execute(text(statement))
            except Exception:
                # Keep startup non-blocking for partially-migrated environments.
                pass

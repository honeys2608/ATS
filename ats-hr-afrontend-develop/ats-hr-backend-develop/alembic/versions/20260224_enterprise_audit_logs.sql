-- Enterprise Audit Logging Migration (PostgreSQL)
-- Safe for existing deployments with legacy audit_logs table.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_id UUID NULL,
    actor_email VARCHAR(255) NULL,
    actor_role VARCHAR(100) NULL,
    tenant_id UUID NULL,
    action VARCHAR(255) NOT NULL,
    module VARCHAR(150) NULL,
    entity_type VARCHAR(150) NULL,
    entity_id UUID NULL,
    description TEXT NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    ip_address VARCHAR(64) NULL,
    user_agent TEXT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'INFO',
    is_system_action BOOLEAN NOT NULL DEFAULT FALSE
);

-- Upgrade existing legacy table in place
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_email VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(150);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(16) DEFAULT 'INFO';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_system_action BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
    BEGIN
        ALTER TABLE audit_logs ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
END $$;

-- Backfill from legacy fields when present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'user_id'
    ) THEN
        EXECUTE 'UPDATE audit_logs SET actor_id = user_id::uuid
                 WHERE actor_id IS NULL AND user_id IS NOT NULL
                 AND user_id ~* ''^[0-9a-f-]{36}$''';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'old_state'
    ) THEN
        EXECUTE 'UPDATE audit_logs
                 SET old_values = COALESCE(old_values, jsonb_build_object(''legacy_old_state'', old_state))
                 WHERE old_state IS NOT NULL';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'new_state'
    ) THEN
        EXECUTE 'UPDATE audit_logs
                 SET new_values = COALESCE(new_values, jsonb_build_object(''legacy_new_state'', new_state))
                 WHERE new_state IS NOT NULL';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs (severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs (module);

COMMIT;


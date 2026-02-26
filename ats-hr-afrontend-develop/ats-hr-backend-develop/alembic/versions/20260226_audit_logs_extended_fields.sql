-- Extend audit_logs with richer event metadata.
-- Non-destructive and safe for existing environments.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS log_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_label VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_name VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'success';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device VARCHAR(120);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS browser VARCHAR(120);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS os VARCHAR(120);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS endpoint TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS http_method VARCHAR(16);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS response_code INTEGER;

UPDATE audit_logs
SET
    created_at = COALESCE(created_at, "timestamp", CURRENT_TIMESTAMP),
    action_label = COALESCE(action_label, REPLACE(INITCAP(REPLACE(action, '_', ' ')), ' Api ', ' API ')),
    status = COALESCE(NULLIF(LOWER(status), ''), CASE WHEN COALESCE(response_code, 200) >= 400 OR failure_reason IS NOT NULL THEN 'failed' ELSE 'success' END),
    old_value = COALESCE(old_value, old_values),
    new_value = COALESCE(new_value, new_values);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'id'
    ) THEN
        EXECUTE '
            UPDATE audit_logs
            SET log_id = COALESCE(log_id, NULLIF(id, '''')::uuid)
            WHERE id ~* ''^[0-9a-fA-F-]{36}$''
        ';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Keep migration resilient in case legacy id values are non-UUID.
        NULL;
END $$;

UPDATE audit_logs
SET log_id = COALESCE(
    log_id,
    (
        SUBSTRING(md5(random()::text || clock_timestamp()::text), 1, 8)
        || '-'
        || SUBSTRING(md5(random()::text || clock_timestamp()::text), 1, 4)
        || '-4'
        || SUBSTRING(md5(random()::text || clock_timestamp()::text), 1, 3)
        || '-a'
        || SUBSTRING(md5(random()::text || clock_timestamp()::text), 1, 3)
        || '-'
        || SUBSTRING(md5(random()::text || clock_timestamp()::text), 1, 12)
    )::uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_log_id ON audit_logs (log_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs (module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs (severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs (status);

-- Super Admin user management standard SaaS fields and indexes.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_invalid_after TIMESTAMP NULL;

UPDATE users
SET
    email = LOWER(TRIM(COALESCE(email, ''))),
    tenant_id = COALESCE(tenant_id, client_id),
    status = CASE
        WHEN COALESCE(TRIM(status), '') = '' THEN
            CASE WHEN COALESCE(is_active, TRUE) = TRUE THEN 'active' ELSE 'inactive' END
        ELSE LOWER(TRIM(status))
    END;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

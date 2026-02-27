-- Ensure UA-derived metadata columns exist and backfill from user_agent.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS device VARCHAR(120);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS browser VARCHAR(120);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS os VARCHAR(120);

UPDATE audit_logs
SET
    device = COALESCE(
        NULLIF(device, ''),
        CASE
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%android%'
              OR LOWER(COALESCE(user_agent, '')) LIKE '%iphone%'
              OR LOWER(COALESCE(user_agent, '')) LIKE '%ipad%'
            THEN 'Mobile'
            WHEN NULLIF(COALESCE(user_agent, ''), '') IS NOT NULL
            THEN 'Desktop'
            ELSE NULL
        END
    ),
    os = COALESCE(
        NULLIF(os, ''),
        CASE
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%windows nt%' THEN 'Windows'
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%mac os x%'
              OR LOWER(COALESCE(user_agent, '')) LIKE '%macintosh%' THEN 'macOS'
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%android%' THEN 'Android'
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%iphone%'
              OR LOWER(COALESCE(user_agent, '')) LIKE '%ipad%' THEN 'iOS'
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%linux%' THEN 'Linux'
            ELSE NULL
        END
    ),
    browser = COALESCE(
        NULLIF(browser, ''),
        CASE
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%edg/%' THEN 'Edge'
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%chrome/%' THEN 'Chrome'
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%firefox/%' THEN 'Firefox'
            WHEN LOWER(COALESCE(user_agent, '')) LIKE '%safari/%'
              AND LOWER(COALESCE(user_agent, '')) NOT LIKE '%chrome/%' THEN 'Safari'
            ELSE NULL
        END
    )
WHERE NULLIF(COALESCE(user_agent, ''), '') IS NOT NULL
  AND (
      NULLIF(device, '') IS NULL
      OR NULLIF(browser, '') IS NULL
      OR NULLIF(os, '') IS NULL
  );

-- Corrective: AD-0 full-automation lock — remove pending_review / insufficient_evidence
-- from airdrop_pipeline_status + airdrop_publish_path; use hold_recheck only.
-- Guarded by migration_flags.flag_name = 'airdrop_intelligence_v1_enums_fix'
-- Safe when AD-0 tables exist with zero/low row usage of pipeline columns.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM migration_flags
        WHERE flag_name = 'airdrop_intelligence_v1_enums_fix'
    ) THEN
        RAISE NOTICE 'airdrop_intelligence_v1_enums_fix already executed. Skipping.';
        RETURN;
    END IF;

    -- Only run if base AD-0 flag exists (schema present) or enums exist with old labels
    IF NOT EXISTS (
        SELECT 1 FROM migration_flags WHERE flag_name = 'airdrop_intelligence_v1'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'airdrop_pipeline_status'
    ) THEN
        INSERT INTO migration_flags (flag_name, executed_at)
        VALUES ('airdrop_intelligence_v1_enums_fix', NOW());
        RAISE NOTICE 'No airdrop_intelligence_v1 schema yet — fix flag recorded as no-op.';
        RETURN;
    END IF;

    -- Drop dependent columns so enums can be recreated cleanly
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'airdrop_projects' AND column_name = 'pipeline_status'
    ) THEN
        ALTER TABLE airdrop_projects DROP COLUMN pipeline_status;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'airdrop_projects' AND column_name = 'publish_path'
    ) THEN
        ALTER TABLE airdrop_projects DROP COLUMN publish_path;
    END IF;

    DROP TYPE IF EXISTS airdrop_pipeline_status;
    DROP TYPE IF EXISTS airdrop_publish_path;

    CREATE TYPE airdrop_pipeline_status AS ENUM (
        'discovering',
        'hold_recheck',
        'rejected',
        'active',
        'archived'
    );

    CREATE TYPE airdrop_publish_path AS ENUM (
        'none',
        'auto_publish',
        'hold_recheck',
        'reject',
        'admin_force'
    );

    ALTER TABLE airdrop_projects
        ADD COLUMN pipeline_status airdrop_pipeline_status NOT NULL DEFAULT 'discovering';

    ALTER TABLE airdrop_projects
        ADD COLUMN publish_path airdrop_publish_path NOT NULL DEFAULT 'none';

    CREATE INDEX IF NOT EXISTS idx_airdrop_projects_pipeline_status
        ON airdrop_projects (pipeline_status);
    CREATE INDEX IF NOT EXISTS idx_airdrop_projects_publish_path
        ON airdrop_projects (publish_path);

    INSERT INTO migration_flags (flag_name, executed_at)
    VALUES ('airdrop_intelligence_v1_enums_fix', NOW());
END $$;

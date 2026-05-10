-- Migration: T-V2-9A — Airdrop Schema Redesign
-- Drops legacy tables (airdrop_tasks, user_progress) and adds quality scoring columns to airdrop_projects

INSERT INTO migration_flags VALUES ('airdrop_redesign_schema') ON CONFLICT DO NOTHING;

-- Drop legacy tables (no foreign key dependencies from other tables besides self-referential)
DROP TABLE IF EXISTS user_progress;
DROP TABLE IF EXISTS airdrop_tasks;

-- Add new quality scoring columns to airdrop_projects
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'airdrop_projects' AND column_name = 'ecosystem') THEN
        ALTER TABLE airdrop_projects ADD COLUMN ecosystem VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'airdrop_projects' AND column_name = 'effort_level') THEN
        ALTER TABLE airdrop_projects ADD COLUMN effort_level VARCHAR(10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'airdrop_projects' AND column_name = 'reward_confidence') THEN
        ALTER TABLE airdrop_projects ADD COLUMN reward_confidence VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'airdrop_projects' AND column_name = 'quality_score') THEN
        ALTER TABLE airdrop_projects ADD COLUMN quality_score INT DEFAULT 0;
    END IF;
END $$;
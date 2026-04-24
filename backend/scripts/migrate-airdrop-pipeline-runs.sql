-- Phase 16: Airdrop Pipeline Health Monitoring
-- Run this migration BEFORE deploying the pipeline logging code

CREATE TABLE IF NOT EXISTS airdrop_pipeline_runs (
    id SERIAL PRIMARY KEY,
    run_type VARCHAR(20) NOT NULL,
    run_at TIMESTAMP DEFAULT NOW() NOT NULL,
    articles_found INTEGER DEFAULT 0,
    articles_processed INTEGER DEFAULT 0,
    projects_inserted INTEGER DEFAULT 0,
    projects_rejected INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type ON airdrop_pipeline_runs(run_type);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_at ON airdrop_pipeline_runs(run_at);

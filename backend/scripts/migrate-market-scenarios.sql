-- Migration: Add Market Scenarios Tables
-- Phase 4: Multi-Horizon Scenario Tracker

-- Create enum types
CREATE TYPE source_type AS ENUM ('signal', 'radar', 'manual', 'event');
CREATE TYPE scenario_type AS ENUM ('speculation', 'swing', 'investment');
CREATE TYPE bias_type AS ENUM ('bullish', 'bearish', 'neutral');
CREATE TYPE scenario_status AS ENUM ('pending', 'active', 'completed', 'expired', 'invalidated');
CREATE TYPE horizon_type AS ENUM ('1h','4h','24h','3d','7d','14d','30d','90d','180d','365d','730d');
CREATE TYPE horizon_group AS ENUM ('speculation', 'swing', 'investment');
CREATE TYPE outcome_classification AS ENUM ('favorable', 'unfavorable', 'neutral', 'invalidated', 'insufficient_data');
CREATE TYPE outcome_status AS ENUM ('pending', 'captured', 'failed', 'skipped');

-- Create market_scenarios table
CREATE TABLE market_scenarios (
    scenarioId UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dedupeKey VARCHAR(255) NOT NULL UNIQUE,
    sourceType source_type NOT NULL,
    sourceId VARCHAR(128),
    coinSymbol VARCHAR(32) NOT NULL,
    scenarioType scenario_type NOT NULL,
    bias bias_type NOT NULL,
    eventType VARCHAR(50),
    eventSeverity VARCHAR(20),
    eventScope VARCHAR(20),
    referencePrice NUMERIC(24,12) NOT NULL,
    referencePriceSource VARCHAR(50) NOT NULL,
    referencePriceAt TIMESTAMP NOT NULL,
    targetZoneLow NUMERIC(24,12),
    targetZoneHigh NUMERIC(24,12),
    riskZoneLow NUMERIC(24,12),
    riskZoneHigh NUMERIC(24,12),
    invalidationPrice NUMERIC(24,12),
    thesis TEXT,
    dataContext JSONB,
    historicalStatsSnapshot JSONB,
    levelContextSnapshot JSONB,
    status scenario_status NOT NULL DEFAULT 'pending',
    publicSafeSummary TEXT,
    createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
    updatedAt TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create scenario_horizon_outcomes table
CREATE TABLE scenario_horizon_outcomes (
    scenarioId UUID REFERENCES market_scenarios(scenarioId) ON DELETE CASCADE,
    coinSymbol VARCHAR(32) NOT NULL,
    horizon horizon_type NOT NULL,
    horizonGroup horizon_group NOT NULL,
    dueAt TIMESTAMP NOT NULL,
    priceAtStart NUMERIC(24,12) NOT NULL,
    priceAtHorizon NUMERIC(24,12),
    changePercent NUMERIC(10,4),
    maxUpsidePercent NUMERIC(10,4),
    maxDrawdownPercent NUMERIC(10,4),
    timeToPeakMinutes INTEGER,
    timeToBottomMinutes INTEGER,
    outcomeClassification outcome_classification,
    status outcome_status NOT NULL DEFAULT 'pending',
    capturedAt TIMESTAMP,
    errorMessage TEXT,
    createdAt TIMESTAMP DEFAULT NOW() NOT NULL,
    updatedAt TIMESTAMP DEFAULT NOW() NOT NULL,
    PRIMARY KEY (scenarioId, horizon)
);

-- Create scenario_status_history table (optional)
CREATE TABLE scenario_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenarioId UUID REFERENCES market_scenarios(scenarioId) ON DELETE CASCADE,
    oldStatus scenario_status,
    newStatus scenario_status NOT NULL,
    changedAt TIMESTAMP DEFAULT NOW() NOT NULL,
    reason TEXT
);

-- Create indexes
CREATE INDEX market_scenarios_sourceId_idx ON market_scenarios (sourceId);
CREATE INDEX market_scenarios_status_idx ON market_scenarios (status);
CREATE INDEX market_scenarios_coinSymbol_idx ON market_scenarios (coinSymbol);
CREATE INDEX market_scenarios_scenarioType_idx ON market_scenarios (scenarioType);
CREATE INDEX scenario_horizon_outcomes_dueAt_idx ON scenario_horizon_outcomes (dueAt);
CREATE INDEX scenario_horizon_outcomes_status_idx ON scenario_horizon_outcomes (status);
CREATE INDEX scenario_horizon_outcomes_scenarioId_idx ON scenario_horizon_outcomes (scenarioId);
CREATE INDEX scenario_status_history_scenarioId_idx ON scenario_status_history (scenarioId);
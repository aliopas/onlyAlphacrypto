-- Migration: Add classification_confidence to event_impacts
-- Phase 2 — Full Event Impact Engine
-- Run after Phase 1 migration

ALTER TABLE event_impacts ADD COLUMN IF NOT EXISTS classification_confidence REAL;
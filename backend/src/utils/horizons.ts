/**
 * Single source of truth for time-horizon → milliseconds conversions.
 *
 * Previously this map was duplicated in 4 places (eventOutcomeChecker, eventImpactOutcomeChecker,
 * scenarioOutcomeChecker, scenarioTracker.service) with overlapping-but-divergent sets of
 * horizons. Any change to a horizon value had to be made in all 4 — and they had already drifted.
 * This module unifies them so the values can never diverge again.
 */

export const HORIZON_MS: Readonly<Record<string, number>> = Object.freeze({
    '1h':   1 * 60 * 60 * 1000,
    '4h':   4 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '3d':   3 * 24 * 60 * 60 * 1000,
    '7d':   7 * 24 * 60 * 60 * 1000,
    '14d': 14 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000,
    '180d': 180 * 24 * 60 * 60 * 1000,
    '365d': 365 * 24 * 60 * 60 * 1000,
    '730d': 730 * 24 * 60 * 60 * 1000,
});

/**
 * Returns the duration in milliseconds for a horizon key (e.g. '1h', '7d').
 * Falls back to interpreting the key as hours if it is not a known shorthand
 * (mirrors the eventImpactOutcomeChecker's `horizonHours * 3_600_000` fallback).
 * Returns 0 for unknown / empty keys.
 */
export function getHorizonMs(horizon: string, fallbackHours?: number): number {
    const known = HORIZON_MS[horizon];
    if (known !== undefined) return known;
    if (fallbackHours != null && fallbackHours > 0) {
        return fallbackHours * 60 * 60 * 1000;
    }
    return 0;
}

/**
 * Returns the target date = reference + horizon duration.
 */
export function getHorizonDate(referenceAt: Date, horizon: string, fallbackHours?: number): Date {
    return new Date(referenceAt.getTime() + getHorizonMs(horizon, fallbackHours));
}

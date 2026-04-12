import { db } from '../config/db';
import { coinTimelineUpdates } from '../models/index';
import { eq, gte, and, lte, asc } from 'drizzle-orm';

export type Posture = 'strong_accumulate' | 'accumulate' | 'neutral' | 'distribute' | 'strong_distribute';
export type Trend = 'rising' | 'falling' | 'stable';

export interface ConvictionResult {
    score: number;
    posture: Posture;
    trend: Trend;
}

interface TimelineEvent {
    impactScore: number | null;
    severity: string;
    sentiment: string | null;
    convictionDelta: number | null;
    createdAt: Date;
}

const BULLISH_SENTIMENTS: ReadonlySet<string> = new Set([
    'STRONG_BUY', 'BUY', 'POSITIVE', 'BULLISH',
]);

const BEARISH_SENTIMENTS: ReadonlySet<string> = new Set([
    'STRONG_SELL', 'SELL', 'NEGATIVE', 'BEARISH',
]);

const SEVERITY_MULTIPLIER: Record<string, number> = {
    'MAJOR': 3.0,
    'MINOR': 1.0,
};

const TIME_DECAY_FACTOR = 0.99;
const BEARISH_PENALTY = 1.4;
const IMPACT_NORMALIZER = 20;
const TREND_THRESHOLD = 2;

function isBullish(sentiment: string | null): boolean {
    if (sentiment === null) return false;
    return BULLISH_SENTIMENTS.has(sentiment.toUpperCase());
}

function isBearish(sentiment: string | null): boolean {
    if (sentiment === null) return false;
    return BEARISH_SENTIMENTS.has(sentiment.toUpperCase());
}

export function computeEventDelta(event: TimelineEvent): number {
    const normalizedImpact = (event.impactScore ?? 50) / IMPACT_NORMALIZER;
    const severityMult = SEVERITY_MULTIPLIER[event.severity.toUpperCase()] ?? 1.0;

    let delta = 0;

    if (isBearish(event.sentiment)) {
        delta = -normalizedImpact * severityMult * BEARISH_PENALTY;
    } else if (isBullish(event.sentiment)) {
        delta = normalizedImpact * severityMult;
    }

    if (event.convictionDelta !== null && event.convictionDelta !== undefined) {
        delta += event.convictionDelta;
    }

    return delta;
}

export function applyTimeDecay(currentScore: number): number {
    return 50 + (currentScore - 50) * TIME_DECAY_FACTOR;
}

export function derivePosture(score: number): Posture {
    if (score >= 80) return 'strong_accumulate';
    if (score >= 60) return 'accumulate';
    if (score >= 40) return 'neutral';
    if (score >= 20) return 'distribute';
    return 'strong_distribute';
}

export function clampScore(score: number): number {
    return Math.max(0, Math.min(100, score));
}

export async function calculateIncrementalConviction(
    masterArticleId: number,
    currentScore: number,
    sinceTimestamp: Date
): Promise<ConvictionResult> {
    const newEvents = await db
        .select({
            impactScore: coinTimelineUpdates.impactScore,
            severity: coinTimelineUpdates.severity,
            sentiment: coinTimelineUpdates.sentiment,
            convictionDelta: coinTimelineUpdates.convictionDelta,
            createdAt: coinTimelineUpdates.createdAt,
        })
        .from(coinTimelineUpdates)
        .where(
            and(
                eq(coinTimelineUpdates.masterArticleId, masterArticleId),
                gte(coinTimelineUpdates.createdAt, sinceTimestamp)
            )
        )
        .orderBy(asc(coinTimelineUpdates.createdAt));

    let deltaSum = 0;
    for (const event of newEvents) {
        deltaSum += computeEventDelta(event);
    }

    const decayedScore = applyTimeDecay(currentScore);
    const newScore = clampScore(decayedScore + deltaSum);
    const posture = derivePosture(newScore);
    const trend = await calculateTrend(masterArticleId);

    return { score: newScore, posture, trend };
}

export async function calculateAbsoluteConviction(
    masterArticleId: number
): Promise<ConvictionResult> {
    const allEvents = await db
        .select({
            impactScore: coinTimelineUpdates.impactScore,
            severity: coinTimelineUpdates.severity,
            sentiment: coinTimelineUpdates.sentiment,
            convictionDelta: coinTimelineUpdates.convictionDelta,
            createdAt: coinTimelineUpdates.createdAt,
        })
        .from(coinTimelineUpdates)
        .where(eq(coinTimelineUpdates.masterArticleId, masterArticleId))
        .orderBy(asc(coinTimelineUpdates.createdAt));

    let score = 50;

    for (const event of allEvents) {
        const delta = computeEventDelta(event);
        score = clampScore(score + delta);
    }

    const posture = derivePosture(score);
    const trend = await calculateTrend(masterArticleId);

    return { score, posture, trend };
}

async function calculateTrend(masterArticleId: number): Promise<Trend> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const recentEvents = await db
        .select({
            impactScore: coinTimelineUpdates.impactScore,
            severity: coinTimelineUpdates.severity,
            sentiment: coinTimelineUpdates.sentiment,
            convictionDelta: coinTimelineUpdates.convictionDelta,
        })
        .from(coinTimelineUpdates)
        .where(
            and(
                eq(coinTimelineUpdates.masterArticleId, masterArticleId),
                gte(coinTimelineUpdates.createdAt, sevenDaysAgo)
            )
        );

    const previousEvents = await db
        .select({
            impactScore: coinTimelineUpdates.impactScore,
            severity: coinTimelineUpdates.severity,
            sentiment: coinTimelineUpdates.sentiment,
            convictionDelta: coinTimelineUpdates.convictionDelta,
        })
        .from(coinTimelineUpdates)
        .where(
            and(
                eq(coinTimelineUpdates.masterArticleId, masterArticleId),
                gte(coinTimelineUpdates.createdAt, fourteenDaysAgo),
                lte(coinTimelineUpdates.createdAt, sevenDaysAgo)
            )
        );

    const recentSum = recentEvents.reduce((sum, e) => sum + computeEventDelta(e as TimelineEvent), 0);
    const previousSum = previousEvents.reduce((sum, e) => sum + computeEventDelta(e as TimelineEvent), 0);

    if (recentSum > previousSum + TREND_THRESHOLD) return 'rising';
    if (recentSum < previousSum - TREND_THRESHOLD) return 'falling';
    return 'stable';
}

import { db } from '../config/db';
import { marketScenarios, scenarioHorizonOutcomes, scenarioStatusHistory } from '../models/market.model';
import { eq, and } from 'drizzle-orm';

// Types
type SourceType = 'signal' | 'radar' | 'manual' | 'event';
type ScenarioType = 'speculation' | 'swing' | 'investment';
type Bias = 'bullish' | 'bearish' | 'neutral';
type ScenarioStatus = 'pending' | 'active' | 'completed' | 'expired';
type Horizon = '1h' | '4h' | '24h' | '3d' | '7d' | '14d' | '30d' | '90d' | '180d' | '365d' | '730d';
type HorizonGroup = 'speculation' | 'swing' | 'investment';
type OutcomeClassification = 'favorable' | 'unfavorable' | 'neutral' | 'invalidated' | 'insufficient_data';
type OutcomeStatus = 'pending' | 'captured' | 'failed' | 'skipped';

// Interfaces
interface CreateScenarioInput {
    sourceType: SourceType;
    sourceId?: string;
    coinSymbol: string;
    scenarioType: ScenarioType;
    bias: Bias;
    eventType?: string;
    eventSeverity?: string;
    eventScope?: string;
    referencePrice: number;
    referencePriceSource: string;
    referencePriceAt: Date;
    targetZoneLow?: number;
    targetZoneHigh?: number;
    riskZoneLow?: number;
    riskZoneHigh?: number;
    invalidationPrice?: number;
    thesis?: string;
    dataContext?: Record<string, unknown>;
    historicalStatsSnapshot?: Record<string, unknown>;
    levelContextSnapshot?: Record<string, unknown>;
    publicSafeSummary?: string;
}

// Horizons mapping
const horizonsByGroup: Record<ScenarioType, Horizon[]> = {
    speculation: ['1h', '4h', '24h'],
    swing: ['3d', '7d', '14d'],
    investment: ['30d', '90d', '180d', '365d', '730d']
};

const horizonToGroup: Record<Horizon, HorizonGroup> = {
    '1h': 'speculation',
    '4h': 'speculation',
    '24h': 'speculation',
    '3d': 'swing',
    '7d': 'swing',
    '14d': 'swing',
    '30d': 'investment',
    '90d': 'investment',
    '180d': 'investment',
    '365d': 'investment',
    '730d': 'investment'
};

// Helper function to calculate due date
function getDueDate(referencePriceAt: Date, horizon: Horizon): Date {
    const multipliers: Record<Horizon, number> = {
        '1h': 1 * 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '3d': 3 * 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '14d': 14 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '90d': 90 * 24 * 60 * 60 * 1000,
        '180d': 180 * 24 * 60 * 60 * 1000,
        '365d': 365 * 24 * 60 * 60 * 1000,
        '730d': 730 * 24 * 60 * 60 * 1000
    };
    return new Date(referencePriceAt.getTime() + multipliers[horizon]);
}

export class ScenarioTrackerService {
    static async createScenario(input: CreateScenarioInput): Promise<string | null> {
        const dedupeKey = `${input.sourceType}:${input.sourceId || 'none'}:${input.coinSymbol}:${input.scenarioType}:${input.bias}`;

        // Check for duplicates using dedupeKey
        const existing = await db.select()
            .from(marketScenarios)
            .where(eq(marketScenarios.dedupeKey, dedupeKey))
            .limit(1);

        if (existing.length > 0) {
            throw new Error(`Scenario already exists for dedupeKey ${dedupeKey}`);
        }

        // Insert scenario
        const inserted = await db.insert(marketScenarios).values({
            dedupeKey,
            sourceType: input.sourceType,
            sourceId: input.sourceId || null,
            coinSymbol: input.coinSymbol,
            scenarioType: input.scenarioType,
            bias: input.bias,
            eventType: input.eventType || null,
            eventSeverity: input.eventSeverity || null,
            eventScope: input.eventScope || null,
            referencePrice: input.referencePrice.toString(),
            referencePriceSource: input.referencePriceSource,
            referencePriceAt: input.referencePriceAt,
            targetZoneLow: input.targetZoneLow ? input.targetZoneLow.toString() : null,
            targetZoneHigh: input.targetZoneHigh ? input.targetZoneHigh.toString() : null,
            riskZoneLow: input.riskZoneLow ? input.riskZoneLow.toString() : null,
            riskZoneHigh: input.riskZoneHigh ? input.riskZoneHigh.toString() : null,
            invalidationPrice: input.invalidationPrice ? input.invalidationPrice.toString() : null,
            thesis: input.thesis || null,
            dataContext: input.dataContext || null,
            historicalStatsSnapshot: input.historicalStatsSnapshot || null,
            levelContextSnapshot: input.levelContextSnapshot || null,
            status: 'active',
            publicSafeSummary: input.publicSafeSummary || null,
            updatedAt: new Date()
        }).returning({ scenarioId: marketScenarios.scenarioId });

        if (inserted.length === 0) {
            throw new Error('Failed to create scenario');
        }

        const scenarioId = inserted[0].scenarioId;

        // Create horizon outcomes
        await this.createHorizonOutcomesForScenario(scenarioId, input.coinSymbol, input.scenarioType, input.referencePrice, input.referencePriceAt);

        return scenarioId;
    }

    static async createHorizonOutcomesForScenario(scenarioId: string, coinSymbol: string, scenarioType: ScenarioType, referencePrice: number, referencePriceAt: Date): Promise<void> {
        const horizons = horizonsByGroup[scenarioType];

        const outcomes = horizons.map(horizon => ({
            scenarioId,
            coinSymbol,
            horizon,
            horizonGroup: horizonToGroup[horizon],
            dueAt: getDueDate(referencePriceAt, horizon),
            priceAtStart: referencePrice.toString(),
            status: 'pending' as const,
            createdAt: new Date(),
            updatedAt: new Date()
        }));

        await db.insert(scenarioHorizonOutcomes).values(outcomes);
    }

    static async getActiveScenarios(): Promise<any[]> {  // TODO: Define proper type
        return await db.select()
            .from(marketScenarios)
            .where(eq(marketScenarios.status, 'active'));
    }

    static async updateScenarioStatus(scenarioId: string, newStatus: ScenarioStatus, reason?: string): Promise<void> {
        // Get current status
        const current = await db.select({ status: marketScenarios.status })
            .from(marketScenarios)
            .where(eq(marketScenarios.scenarioId, scenarioId))
            .limit(1);

        if (current.length === 0) {
            throw new Error(`Scenario ${scenarioId} not found`);
        }

        const oldStatus = current[0].status;

        // Update status
        await db.update(marketScenarios)
            .set({
                status: newStatus,
                updatedAt: new Date()
            })
            .where(eq(marketScenarios.scenarioId, scenarioId));

        // Log to history if enabled (optional table exists)
        try {
            await db.insert(scenarioStatusHistory).values({
                scenarioId,
                oldStatus: oldStatus as ScenarioStatus,
                newStatus,
                reason: reason || null
            });
        } catch (error) {
            // Non-blocking
            console.warn(`Failed to log status change for scenario ${scenarioId}:`, error);
        }
    }
}
import { db } from '../config/db';
import { coinStrategicOutlook, smartEventResponses, coinNewsHistory } from '../models/market.model';
import { eq, and, isNotNull, desc, sql } from 'drizzle-orm';
import type { DeepAnalysisResult } from './openai.service';

interface OutlookTriggerInput {
    classification: string;
    eventType: string;
    impactScore: number;
    eventSeverity: number;
    priceChange24h?: number;
}

export function shouldUpdateOutlook(input: OutlookTriggerInput): boolean {
    if (input.classification !== 'MAJOR') return false;
    if (input.impactScore < 70) return false;
    const structuralEvents = ['Regulatory', 'ETF', 'Hack', 'Exploit', 'Listing', 'Delisting'];
    const isStructural = structuralEvents.includes(input.eventType);
    const isLargePriceMove = Math.abs(input.priceChange24h ?? 0) > 10;
    return isStructural || isLargePriceMove || input.eventSeverity >= 3;
}

type StrategicOutlook = NonNullable<DeepAnalysisResult['strategicOutlook']>;

function formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
    return `$${value.toLocaleString('en-US')}`;
}

/** Convert structured strategicOutlook into prose for article sections (never raw JSON). */
export function formatStrategicImpactProse(outlook: StrategicOutlook): string {
    const st = outlook.shortTerm ?? {
        direction: 'neutral',
        target: null,
        invalidation: null,
        catalysts: [],
        confidence: 0,
    };
    const lt = outlook.longTerm ?? {
        marketPhase: 'accumulation',
        bullRunProbability: 0,
        majorSupport: null,
        majorResistance: null,
        isBottomIn: false,
        isTopIn: false,
        bullEvidence: [],
        bearEvidence: [],
    };
    const action = outlook.action ?? {
        recommendation: 'watch',
        rationale: 'Insufficient structured outlook data.',
        riskManagement: 'Monitor key levels before acting on this scenario.',
    };

    const catalysts = Array.isArray(st.catalysts) && st.catalysts.length > 0
        ? st.catalysts.join('; ')
        : 'no major near-term catalysts listed';
    const bullEvidence = Array.isArray(lt.bullEvidence) && lt.bullEvidence.length > 0
        ? lt.bullEvidence.join('; ')
        : 'limited bullish evidence listed';
    const bearEvidence = Array.isArray(lt.bearEvidence) && lt.bearEvidence.length > 0
        ? lt.bearEvidence.join('; ')
        : 'limited bearish evidence listed';

    const shortTermBlock =
        `Short-term outlook is ${st.direction} with ${st.confidence}% confidence. ` +
        `Upside target zone sits near ${formatPrice(st.target)}; risk zone / invalidation is ${formatPrice(st.invalidation)}. ` +
        `Near-term catalysts: ${catalysts}.`;

    const longTermBlock =
        `Long-term market phase is ${lt.marketPhase} with a ${lt.bullRunProbability}% bull-run probability reading. ` +
        `Major support is ${formatPrice(lt.majorSupport)}; major resistance is ${formatPrice(lt.majorResistance)}. ` +
        `Bottom-in flag: ${lt.isBottomIn ? 'yes' : 'no'}; top-in flag: ${lt.isTopIn ? 'yes' : 'no'}. ` +
        `Bull evidence: ${bullEvidence}. Bear evidence: ${bearEvidence}.`;

    const actionBlock =
        `Market stance leans ${action.recommendation}. ${action.rationale} ` +
        `Risk management: ${action.riskManagement}`;

    return `${shortTermBlock}\n\n${longTermBlock}\n\n${actionBlock}`.trim();
}

/** If a section stored raw strategicOutlook JSON (or object), convert to prose. */
export function sanitizeStrategicImpactText(value: unknown, fallbackOutlook?: StrategicOutlook | null): string | null {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        if (obj.shortTerm || obj.longTerm || obj.action) {
            return formatStrategicImpactProse(value as StrategicOutlook);
        }
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return fallbackOutlook ? formatStrategicImpactProse(fallbackOutlook) : null;
        }
        if (trimmed.startsWith('{') && (trimmed.includes('"shortTerm"') || trimmed.includes('"longTerm"'))) {
            try {
                const parsed: unknown = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    const obj = parsed as Record<string, unknown>;
                    if (obj.shortTerm || obj.longTerm || obj.action) {
                        return formatStrategicImpactProse(parsed as StrategicOutlook);
                    }
                }
            } catch {
                // keep original string if not valid JSON
            }
        }
        return trimmed;
    }

    if (fallbackOutlook) return formatStrategicImpactProse(fallbackOutlook);
    return null;
}

export async function saveStrategicOutlook(
    coinSymbol: string,
    outlook: NonNullable<DeepAnalysisResult['strategicOutlook']>,
    triggerEventTitle: string
): Promise<void> {
    const values = {
        coinSymbol,
        shortTermDirection: outlook.shortTerm.direction,
        shortTermTarget: outlook.shortTerm.target,
        shortTermInvalidation: outlook.shortTerm.invalidation,
        shortTermCatalysts: outlook.shortTerm.catalysts,
        shortTermConfidence: outlook.shortTerm.confidence,
        marketPhase: outlook.longTerm.marketPhase,
        bullRunProbability: outlook.longTerm.bullRunProbability,
        majorSupport: outlook.longTerm.majorSupport,
        majorResistance: outlook.longTerm.majorResistance,
        isBottomIn: outlook.longTerm.isBottomIn,
        isTopIn: outlook.longTerm.isTopIn,
        longTermBullEvidence: outlook.longTerm.bullEvidence,
        longTermBearEvidence: outlook.longTerm.bearEvidence,
        recommendedAction: outlook.action.recommendation,
        actionRationale: outlook.action.rationale,
        riskManagement: outlook.action.riskManagement,
        lastUpdatedByEvent: triggerEventTitle,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    await db.insert(coinStrategicOutlook)
        .values(values)
        .onConflictDoUpdate({
            target: coinStrategicOutlook.coinSymbol,
            set: {
                ...values,
                updatedAt: sql`NOW()`,
            },
        });

    console.log(`[StrategicOutlook] Saved outlook for ${coinSymbol}: ${outlook.shortTerm.direction} -> $${outlook.shortTerm.target}`);
}

interface HistoricalParallel {
    event: string;
    date: string;
    initialDrop: number;
    recoveryDays: number | null;
    finalOutcome: string;
}

export async function buildSmartEventResponse(
    coinSymbol: string,
    eventType: string,
    eventTitle: string,
    currentPrice: number
): Promise<void> {
    const similarEvents = await db.select()
        .from(coinNewsHistory)
        .where(and(
            eq(coinNewsHistory.eventType, eventType),
            isNotNull(coinNewsHistory.priceChange7d),
            isNotNull(coinNewsHistory.priceAtTime)
        ))
        .orderBy(desc(coinNewsHistory.publishedAt))
        .limit(10);

    if (similarEvents.length === 0) {
        console.log(`[SmartEventResponse] No historical parallels found for ${eventType}`);
        return;
    }

    const parallels: HistoricalParallel[] = similarEvents.map(e => ({
        event: `${e.coinSymbol}: ${e.title.slice(0, 80)}`,
        date: e.publishedAt.toISOString().split('T')[0],
        initialDrop: Number(e.priceChange7d ?? 0),
        recoveryDays: null,
        finalOutcome: e.isRugPull
            ? 'Total loss - rug pull confirmed'
            : `${Number(e.priceChange7d ?? 0) > 0 ? '+' : ''}${Number(e.priceChange7d ?? 0).toFixed(1)}% in 7 days`,
    }));

    const avgDrop = parallels.reduce((sum, p) => sum + p.initialDrop, 0) / parallels.length;
    const recoveryRate = parallels.filter(p => p.initialDrop > -5).length / parallels.length;

    const isBearish = avgDrop < -5;
    const immediateImpact = isBearish
        ? `Historical data shows ${eventType} events cause an average ${avgDrop.toFixed(1)}% price movement within 7 days. Recovery rate: ${(recoveryRate * 100).toFixed(0)}%.`
        : `Historical data shows ${eventType} events have limited price impact (avg ${avgDrop.toFixed(1)}% over 7 days).`;

    const recommendedAction = isBearish
        ? `Short-term (1-2 weeks): Data suggests elevated risk - monitor for contagion. Medium-term (30-60 days): Historical recovery rate is ${(recoveryRate * 100).toFixed(0)}%. Watch key support levels for confirmation of stabilization.`
        : `Data suggests limited direct price impact from this event type. Monitor for secondary effects.`;

    await db.update(smartEventResponses)
        .set({ isActive: false })
        .where(and(
            eq(smartEventResponses.coinSymbol, coinSymbol),
            eq(smartEventResponses.eventType, eventType),
            eq(smartEventResponses.isActive, true)
        ));

    await db.insert(smartEventResponses).values({
        coinSymbol,
        eventType,
        eventTitle,
        immediateImpact,
        historicalParallels: parallels,
        recommendedAction,
        watchLevels: { support: currentPrice * 0.9, exitTrigger: currentPrice * 0.85 },
        timeHorizon: isBearish ? '1month' : '1week',
        isActive: true,
    });

    console.log(`[SmartEventResponse] Generated action plan for ${coinSymbol} - ${eventType} (${parallels.length} parallels, avg impact: ${avgDrop.toFixed(1)}%)`);
}

export async function getStrategicOutlook(coinSymbol: string) {
    const result = await db.select()
        .from(coinStrategicOutlook)
        .where(eq(coinStrategicOutlook.coinSymbol, coinSymbol))
        .limit(1);
    return result[0] ?? null;
}

export async function getActiveEventResponses(coinSymbol: string) {
    return await db.select()
        .from(smartEventResponses)
        .where(and(
            eq(smartEventResponses.coinSymbol, coinSymbol),
            eq(smartEventResponses.isActive, true)
        ))
        .orderBy(desc(smartEventResponses.createdAt))
        .limit(5);
}

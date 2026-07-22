import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import {
    airdropPipelineRuns,
    airdropProjects,
    airdropSignals,
    type AirdropPipelineStatus,
    type AirdropPublishPath,
} from '../models/airdrop.model';
import { calculateAirdropQuality } from './airdropQuality.service';
import { buildEvidencePack, type EvidencePack } from './airdropEvidence.service';
import { runGate1OnCorpus } from './airdropGate1.service';
import { runGate2, type Gate2Result } from './airdropGate2.service';
import { deleteCache, deleteCachePattern } from '../config/redis';
import { logger } from '../utils/logger';

export type AlgorithmicOutcome = 'auto_publish' | 'hold_recheck' | 'reject';

export interface PublishRuleEvaluation {
    outcome: AlgorithmicOutcome;
    reasons: string[];
    qualityScore: number;
    qualityEligible: boolean;
    evidenceBarMet: boolean;
    gate1Pass: boolean;
    gate2Pass: boolean;
}

export interface EntityGateRunResult {
    entityId: number;
    entityName: string;
    outcome: AlgorithmicOutcome;
    projectId: number | null;
    rules: PublishRuleEvaluation;
    skipped?: string;
}

export interface GatePipelineRunResult {
    enabled: boolean;
    processed: number;
    autoPublish: number;
    holdRecheck: number;
    reject: number;
    errors: number;
    durationMs: number;
    results: EntityGateRunResult[];
}

const MAX_ENTITIES_PER_RUN = 8;

/**
 * Publish Rule Set v1 (DEC-041 G2) — all required for auto_publish.
 */
export function evaluatePublishRules(params: {
    pack: EvidencePack;
    gate1Pass: boolean;
    gate2: Gate2Result;
    qualityScore: number;
    qualityEligible: boolean;
}): PublishRuleEvaluation {
    const reasons: string[] = [];
    const { pack, gate1Pass, gate2, qualityScore, qualityEligible } = params;

    if (!gate1Pass) {
        reasons.push('gate1_fail');
        return {
            outcome: 'reject',
            reasons,
            qualityScore,
            qualityEligible,
            evidenceBarMet: false,
            gate1Pass,
            gate2Pass: gate2.gate2Pass,
        };
    }

    if (gate2.riskVerdict === 'SCAM' || gate2.outcomeHint === 'reject' || !gate2.isLegitimate) {
        reasons.push('gate2_reject');
        return {
            outcome: 'reject',
            reasons: [...reasons, ...gate2.reasons],
            qualityScore,
            qualityEligible,
            evidenceBarMet: false,
            gate1Pass,
            gate2Pass: false,
        };
    }

    if (gate2.hardContradiction) {
        reasons.push('hard_contradiction');
        return {
            outcome: 'hold_recheck',
            reasons,
            qualityScore,
            qualityEligible,
            evidenceBarMet: false,
            gate1Pass,
            gate2Pass: false,
        };
    }

    if (pack.controversyFlag) {
        reasons.push('mood_controversy');
    }

    // Evidence bar
    const strong = pack.independentDiscoveryCount >= 2 && !gate2.hardContradiction && !pack.controversyFlag;
    const strongPlus =
        pack.independentDiscoveryCount >= 1 &&
        pack.defillama.matched &&
        !gate2.hardContradiction &&
        !pack.controversyFlag;
    const evidenceBarMet = strong || strongPlus;

    if (pack.communityOnly) {
        reasons.push('community_only');
    }
    if (!evidenceBarMet) {
        reasons.push('evidence_bar_not_met');
    }

    const gate2Pass = gate2.gate2Pass === true;

    if (!gate2Pass) {
        reasons.push('gate2_not_pass');
        return {
            outcome: 'hold_recheck',
            reasons: reasons.filter(Boolean),
            qualityScore,
            qualityEligible,
            evidenceBarMet,
            gate1Pass,
            gate2Pass: false,
        };
    }

    if (!qualityEligible) {
        reasons.push(`quality_below_threshold:${qualityScore}`);
        return {
            outcome: 'hold_recheck',
            reasons: reasons.filter(Boolean),
            qualityScore,
            qualityEligible,
            evidenceBarMet,
            gate1Pass,
            gate2Pass: true,
        };
    }

    if (!evidenceBarMet || pack.communityOnly) {
        reasons.push('insufficient_evidence');
        return {
            outcome: 'hold_recheck',
            reasons: reasons.filter(Boolean),
            qualityScore,
            qualityEligible,
            evidenceBarMet: false,
            gate1Pass,
            gate2Pass: true,
        };
    }

    if (pack.controversyFlag) {
        reasons.push('controversy_blocks_publish');
        return {
            outcome: 'hold_recheck',
            reasons: reasons.filter(Boolean),
            qualityScore,
            qualityEligible,
            evidenceBarMet,
            gate1Pass,
            gate2Pass: true,
        };
    }

    return {
        outcome: 'auto_publish',
        reasons: ['publish_rule_set_v1'],
        qualityScore,
        qualityEligible,
        evidenceBarMet: true,
        gate1Pass: true,
        gate2Pass: true,
    };
}

function mapOutcomeToStatus(outcome: AlgorithmicOutcome): {
    pipelineStatus: AirdropPipelineStatus;
    publishPath: AirdropPublishPath;
    isActive: boolean;
} {
    if (outcome === 'auto_publish') {
        return {
            pipelineStatus: 'active',
            publishPath: 'auto_publish',
            isActive: true,
        };
    }
    if (outcome === 'reject') {
        return {
            pipelineStatus: 'rejected',
            publishPath: 'reject',
            isActive: false,
        };
    }
    return {
        pipelineStatus: 'hold_recheck',
        publishPath: 'hold_recheck',
        isActive: false,
    };
}

async function upsertProjectFromGate(params: {
    pack: EvidencePack;
    gate2: Gate2Result;
    rules: PublishRuleEvaluation;
}): Promise<number> {
    const { pack, gate2, rules } = params;
    const status = mapOutcomeToStatus(rules.outcome);
    const name = pack.entity.canonicalName.slice(0, 100);
    const network = (gate2.network || 'Unknown').slice(0, 50);

    const quality = calculateAirdropQuality({
        name,
        network,
        websiteUrl: gate2.websiteUrl || pack.defillama.url,
        twitterUrl: gate2.twitterUrl || pack.defillama.twitter,
        riskVerdict: gate2.riskVerdict,
        estValue: gate2.estValue,
        fundingRound: pack.defillama.matched && pack.defillama.tvl
            ? `TVL ~$${Math.round((pack.defillama.tvl ?? 0) / 1_000_000)}M`
            : null,
    });

    const provenanceSummary: Record<string, unknown> = {
        independentDiscoveryCount: pack.independentDiscoveryCount,
        discoverySourceIds: pack.discoverySourceIds,
        communitySourceIds: pack.communitySourceIds,
        defillamaMatched: pack.defillama.matched,
        evidenceBarMet: rules.evidenceBarMet,
        gate1Pass: rules.gate1Pass,
        gate2Pass: rules.gate2Pass,
        outcome: rules.outcome,
        reasons: rules.reasons,
        citedFetchCount: pack.citedFetches.filter((f) => f.fetchStatus === 'ok').length,
        evaluatedAt: new Date().toISOString(),
    };

    const existingByEntity = await db
        .select()
        .from(airdropProjects)
        .where(eq(airdropProjects.entityId, pack.entity.id))
        .limit(1);

    const existingByName = existingByEntity[0]
        ? []
        : await db
              .select()
              .from(airdropProjects)
              .where(eq(airdropProjects.name, name))
              .limit(1);

    const existing = existingByEntity[0] ?? existingByName[0];

    // Never downgrade auto_publish → hold via lower-quality re-run unless reject
    let finalOutcome = rules.outcome;
    if (
        existing &&
        existing.publishPath === 'auto_publish' &&
        existing.pipelineStatus === 'active' &&
        rules.outcome === 'hold_recheck'
    ) {
        finalOutcome = 'auto_publish';
        provenanceSummary.preservedAutoPublish = true;
    }
    if (rules.outcome === 'reject') {
        finalOutcome = 'reject';
    }

    const finalStatus = mapOutcomeToStatus(finalOutcome);
    const values = {
        name,
        network,
        estValue: gate2.estValue.slice(0, 255),
        aiReport: gate2.aiReport || null,
        riskVerdict: gate2.riskVerdict,
        websiteUrl: (gate2.websiteUrl || pack.defillama.url || null)?.slice(0, 300) ?? null,
        twitterUrl: (() => {
            const tw = gate2.twitterUrl || pack.defillama.twitter;
            if (!tw) return null;
            const normalized = tw.startsWith('http')
                ? tw
                : `https://twitter.com/${tw.replace(/^@/, '')}`;
            return normalized.slice(0, 300);
        })(),
        logoUrl: null as string | null,
        ecosystem: quality.ecosystem,
        effortLevel: quality.effortLevel,
        rewardConfidence: quality.rewardConfidence,
        qualityScore: quality.qualityScore,
        entityId: pack.entity.id,
        pipelineStatus: finalStatus.pipelineStatus,
        publishPath: finalStatus.publishPath,
        provenanceSummary,
        isActive: finalStatus.isActive,
        updatedAt: new Date(),
    };

    if (existing) {
        await db
            .update(airdropProjects)
            .set(values)
            .where(eq(airdropProjects.id, existing.id));
        return existing.id;
    }

    const inserted = await db
        .insert(airdropProjects)
        .values(values)
        .returning({ id: airdropProjects.id });

    return inserted[0].id;
}

export async function processEntityGates(entityId: number): Promise<EntityGateRunResult> {
    const pack = await buildEvidencePack(entityId);
    if (!pack) {
        return {
            entityId,
            entityName: String(entityId),
            outcome: 'hold_recheck',
            projectId: null,
            rules: {
                outcome: 'hold_recheck',
                reasons: ['no_evidence_pack'],
                qualityScore: 0,
                qualityEligible: false,
                evidenceBarMet: false,
                gate1Pass: false,
                gate2Pass: false,
            },
            skipped: 'no_pack',
        };
    }

    const gate1 = runGate1OnCorpus(
        pack.signals.map((s) => ({
            title: s.title,
            body: s.body,
            urls: s.extractedUrls ?? undefined,
        }))
    );

    // Gate-1 hard fail → reject without AI cost
    if (!gate1.pass && gate1.reasons.includes('hard_scam_pattern')) {
        const fakeGate2: Gate2Result = {
            gate2Pass: false,
            outcomeHint: 'reject',
            riskVerdict: 'SCAM',
            isLegitimate: false,
            hardContradiction: false,
            missingDocs: false,
            teamSubstance: 'none',
            docsPresent: false,
            fundingOrTvlSignal: false,
            claimConsistency: 'mixed',
            network: 'Unknown',
            estValue: 'Unknown',
            aiReport: 'Rejected by Gate-1 scam patterns.',
            websiteUrl: '',
            twitterUrl: '',
            reasons: gate1.reasons,
        };
        const rules = evaluatePublishRules({
            pack,
            gate1Pass: false,
            gate2: fakeGate2,
            qualityScore: 0,
            qualityEligible: false,
        });
        const projectId = await upsertProjectFromGate({ pack, gate2: fakeGate2, rules });
        return {
            entityId,
            entityName: pack.entity.canonicalName,
            outcome: rules.outcome,
            projectId,
            rules,
        };
    }

    const gate2 = await runGate2(pack);

    const quality = calculateAirdropQuality({
        name: pack.entity.canonicalName,
        network: gate2.network || 'Unknown',
        websiteUrl: gate2.websiteUrl || pack.defillama.url,
        twitterUrl: gate2.twitterUrl || pack.defillama.twitter,
        riskVerdict: gate2.riskVerdict,
        estValue: gate2.estValue,
    });

    const rules = evaluatePublishRules({
        pack,
        gate1Pass: gate1.pass,
        gate2,
        qualityScore: quality.qualityScore,
        qualityEligible: quality.isEligible,
    });

    const projectId = await upsertProjectFromGate({ pack, gate2, rules });

    return {
        entityId,
        entityName: pack.entity.canonicalName,
        outcome: rules.outcome,
        projectId,
        rules,
    };
}

async function selectEntityIdsForGate(): Promise<number[]> {
    // Entities with recent signals that are new or still on hold
    const recent = await db
        .selectDistinct({ entityId: airdropSignals.entityId })
        .from(airdropSignals)
        .where(
            and(
                isNotNull(airdropSignals.entityId),
                sql`${airdropSignals.createdAt} > NOW() - INTERVAL '14 days'`
            )
        );

    const ids = recent
        .map((r) => r.entityId)
        .filter((id): id is number => typeof id === 'number');

    if (ids.length === 0) return [];

    // Prefer entities without active auto_publish project, or hold_recheck
    const projects = await db
        .select({
            entityId: airdropProjects.entityId,
            pipelineStatus: airdropProjects.pipelineStatus,
            publishPath: airdropProjects.publishPath,
        })
        .from(airdropProjects)
        .where(
            and(
                isNotNull(airdropProjects.entityId),
                inArray(airdropProjects.entityId, ids)
            )
        );

    const activeAuto = new Set(
        projects
            .filter((p) => p.publishPath === 'auto_publish' && p.pipelineStatus === 'active')
            .map((p) => p.entityId as number)
    );
    const rejected = new Set(
        projects
            .filter((p) => p.pipelineStatus === 'rejected')
            .map((p) => p.entityId as number)
    );

    const prioritized = ids.filter((id) => !activeAuto.has(id) && !rejected.has(id));
    const fallback = ids.filter((id) => !rejected.has(id) && activeAuto.has(id));

    return [...prioritized, ...fallback].slice(0, MAX_ENTITIES_PER_RUN);
}

/**
 * AD-3 orchestrator: Gate-1 → Evidence Pack → Gate-2 → Publish Rule Set → airdrop_projects.
 */
export async function runAirdropGatePipeline(): Promise<GatePipelineRunResult> {
    const start = Date.now();

    if (!env.AIRDROP_INTELLIGENCE_ENABLED) {
        logger.info('[AirdropGatePipeline] disabled (AIRDROP_INTELLIGENCE_ENABLED=false)');
        return {
            enabled: false,
            processed: 0,
            autoPublish: 0,
            holdRecheck: 0,
            reject: 0,
            errors: 0,
            durationMs: Date.now() - start,
            results: [],
        };
    }

    const entityIds = await selectEntityIdsForGate();
    const results: EntityGateRunResult[] = [];
    let autoPublish = 0;
    let holdRecheck = 0;
    let reject = 0;
    let errors = 0;

    for (const entityId of entityIds) {
        try {
            const r = await processEntityGates(entityId);
            results.push(r);
            if (r.outcome === 'auto_publish') autoPublish += 1;
            else if (r.outcome === 'reject') reject += 1;
            else holdRecheck += 1;
        } catch (err) {
            errors += 1;
            logger.error(
                '[AirdropGatePipeline] entity=%d failed: %s',
                entityId,
                err instanceof Error ? err.message : String(err)
            );
        }
    }

    if (autoPublish > 0) {
        try {
            await deleteCache('airdrop:projects');
            await deleteCache('airdrop:projects:portfolio:v1');
            await deleteCache('airdrop:deadlines');
            await deleteCache('airdrop:deadlines:v1');
            await deleteCache('airdrop:urgent:v1');
            await deleteCachePattern('airdrop:project:*');
        } catch {
            // non-blocking
        }
    }

    const durationMs = Date.now() - start;

    try {
        await db.insert(airdropPipelineRuns).values({
            runType: 'gate_pipeline',
            articlesFound: entityIds.length,
            articlesProcessed: results.length,
            projectsInserted: autoPublish,
            projectsRejected: reject + holdRecheck,
            errors,
            durationMs,
            notes: JSON.stringify({
                autoPublish,
                holdRecheck,
                reject,
                results: results.map((r) => ({
                    entityId: r.entityId,
                    outcome: r.outcome,
                    reasons: r.rules.reasons,
                })),
            }),
        });
    } catch (err) {
        logger.error(
            '[AirdropGatePipeline] log failed: %s',
            err instanceof Error ? err.message : String(err)
        );
    }

    logger.info(
        '[AirdropGatePipeline] done processed=%d auto=%d hold=%d reject=%d errors=%d %dms',
        results.length,
        autoPublish,
        holdRecheck,
        reject,
        errors,
        durationMs
    );

    return {
        enabled: true,
        processed: results.length,
        autoPublish,
        holdRecheck,
        reject,
        errors,
        durationMs,
        results,
    };
}

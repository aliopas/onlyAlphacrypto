import cron from 'node-cron';
import { db } from '../config/db';
import { airdropPipelineRuns, airdropProjects } from '../models/index';
import { validateAirdrop } from '../services/openai.service';
import { insertProjectWithQuality } from '../controllers/airdrop.controller';
import { deleteCache, deleteCachePattern } from '../config/redis';
import {
    fetchTokenlessProtocols,
    buildAirdropCandidates,
    buildCandidateContext,
    type AirdropCandidate,
} from '../services/defillama.service';
import { resolveOrCreateEntity } from '../services/entityResolve.service';
import { env } from '../config/env';
import { eq } from 'drizzle-orm';

const CONFIDENCE_THRESHOLD = 40;
const MAX_AI_CALLS_PER_RUN = 5;

/**
 * DeFiLlama-only discovery (DEC-041 AD-3).
 * GLM/Z.ai web search discovery removed from airdrop backbone.
 */
async function runAirdropDiscovery(): Promise<void> {
    const startTime = Date.now();
    console.log('[AirdropDiscovery] Run started — DeFiLlama only (no GLM)');

    let totalCandidates = 0;
    let projectsInserted = 0;
    let rejections = 0;
    let errors = 0;

    const existingProjectNames = new Set(
        (await db.select({ name: airdropProjects.name }).from(airdropProjects)).map((p) =>
            p.name.toLowerCase()
        )
    );

    let defillamaCandidates: AirdropCandidate[] = [];
    try {
        const tokenlessProtocols = await fetchTokenlessProtocols();
        defillamaCandidates = await buildAirdropCandidates(tokenlessProtocols, 15);
        console.log(`[AirdropDiscovery] DeFiLlama: ${defillamaCandidates.length} candidates`);
    } catch (err) {
        console.error(
            '[AirdropDiscovery] DeFiLlama fetch failed:',
            err instanceof Error ? err.message : String(err)
        );
        errors++;
    }

    const prioritizedCandidates = defillamaCandidates
        .filter((c) => c.confidenceScore >= CONFIDENCE_THRESHOLD)
        .map((c) => ({
            name: c.name,
            context: buildCandidateContext(c),
            source: 'defillama' as const,
            confidence: c.confidenceScore,
            candidate: c,
        }))
        .sort((a, b) => b.confidence - a.confidence);

    totalCandidates = prioritizedCandidates.length;

    const toProcess = prioritizedCandidates
        .filter((c) => !existingProjectNames.has(c.name.toLowerCase()))
        .slice(0, MAX_AI_CALLS_PER_RUN);

    console.log(
        `[AirdropDiscovery] ${totalCandidates} candidates, ${toProcess.length} to process (no Z.ai)`
    );

    for (const candidate of toProcess) {
        try {
            // Context is DeFiLlama structured data only — no GLM enrichment
            const context = candidate.context;
            const validation = await validateAirdrop(context);

            if (!validation.isLegitimate || validation.riskVerdict === 'SCAM') {
                console.log(
                    `[AirdropDiscovery] Rejected: "${candidate.name}" — legitimate=${validation.isLegitimate}, risk=${validation.riskVerdict}`
                );
                rejections++;
                continue;
            }

            const projectName = candidate.name;
            if (existingProjectNames.has(projectName.toLowerCase())) {
                rejections++;
                continue;
            }

            const resolved = await resolveOrCreateEntity(projectName, 'ingest');
            const entityId = resolved?.entity.id ?? null;

            // When intelligence pipeline is on, stage as hold until Gate pipeline evaluates
            if (env.AIRDROP_INTELLIGENCE_ENABLED && entityId) {
                const qualityEligible = true; // insertProjectWithQuality still enforces threshold
                try {
                    const id = await insertProjectWithQuality({
                        name: projectName,
                        network: candidate.candidate.chains[0] ?? 'Multi-chain',
                        estValue: validation.estValue,
                        aiReport: validation.aiReport,
                        riskVerdict: validation.riskVerdict,
                        websiteUrl: candidate.candidate.url ?? undefined,
                        twitterUrl: candidate.candidate.twitter
                            ? candidate.candidate.twitter.startsWith('http')
                                ? candidate.candidate.twitter
                                : `https://twitter.com/${candidate.candidate.twitter.replace(/^@/, '')}`
                            : undefined,
                        fundingRound: candidate.candidate.latestRound ?? undefined,
                    });
                    await db
                        .update(airdropProjects)
                        .set({
                            entityId,
                            pipelineStatus: 'hold_recheck',
                            publishPath: 'hold_recheck',
                            isActive: false,
                            provenanceSummary: {
                                source: 'defillama_discovery',
                                defillamaMatched: true,
                                stagedForGate: true,
                            },
                            updatedAt: new Date(),
                        })
                        .where(eq(airdropProjects.id, id));
                    existingProjectNames.add(projectName.toLowerCase());
                    projectsInserted++;
                    console.log(
                        `[AirdropDiscovery] Staged hold_recheck: "${projectName}" (entity=${entityId}) qualityEligible=${qualityEligible}`
                    );
                } catch (err) {
                    if (err instanceof Error && err.message.includes('quality threshold')) {
                        console.log(
                            `[AirdropDiscovery] Rejected by quality filter: "${projectName}"`
                        );
                        rejections++;
                    } else {
                        throw err;
                    }
                }
            } else {
                try {
                    await insertProjectWithQuality({
                        name: projectName,
                        network: candidate.candidate.chains[0] ?? 'Multi-chain',
                        estValue: validation.estValue,
                        aiReport: validation.aiReport,
                        riskVerdict: validation.riskVerdict,
                        websiteUrl: candidate.candidate.url ?? undefined,
                        twitterUrl: candidate.candidate.twitter
                            ? candidate.candidate.twitter.startsWith('http')
                                ? candidate.candidate.twitter
                                : `https://twitter.com/${candidate.candidate.twitter.replace(/^@/, '')}`
                            : undefined,
                        fundingRound: candidate.candidate.latestRound ?? undefined,
                    });
                    existingProjectNames.add(projectName.toLowerCase());
                    projectsInserted++;
                    console.log(`[AirdropDiscovery] Inserted: "${projectName}" (legacy path)`);
                } catch (err) {
                    if (err instanceof Error && err.message.includes('quality threshold')) {
                        console.log(
                            `[AirdropDiscovery] Rejected by quality filter: "${projectName}"`
                        );
                        rejections++;
                    } else {
                        throw err;
                    }
                }
            }
        } catch (err) {
            errors++;
            console.error(
                `[AirdropDiscovery] Error processing "${candidate.name}":`,
                err instanceof Error ? err.message : String(err)
            );
        }
    }

    try {
        await deleteCache('airdrop:projects');
        await deleteCache('airdrop:deadlines');
        await deleteCachePattern('airdrop:project:*');
    } catch (err) {
        console.error(
            '[AirdropDiscovery] Cache invalidation failed:',
            err instanceof Error ? err.message : String(err)
        );
    }

    const durationMs = Date.now() - startTime;
    try {
        await db.insert(airdropPipelineRuns).values({
            runType: 'defillama_discovery',
            articlesFound: totalCandidates,
            articlesProcessed: toProcess.length,
            projectsInserted,
            projectsRejected: rejections,
            errors,
            durationMs,
            notes: `sources: defillama_only (GLM stripped AD-3), candidates_dl=${defillamaCandidates.length}`,
        });
    } catch (logErr) {
        console.error(
            '[AirdropDiscovery] Failed to log pipeline run:',
            logErr instanceof Error ? logErr.message : String(logErr)
        );
    }

    console.log(
        `[AirdropDiscovery] Complete — candidates: ${totalCandidates}, inserted: ${projectsInserted}, rejected: ${rejections}, errors: ${errors}, duration: ${durationMs}ms`
    );
}

export function startAirdropDiscoveryCron(): void {
    cron.schedule('0 */6 * * *', runAirdropDiscovery);
    console.log('[AirdropDiscovery] Cron scheduled — DeFiLlama only: every 6 hours');
}

export { runAirdropDiscovery };

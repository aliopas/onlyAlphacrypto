import cron from 'node-cron';
import { db } from '../config/db';
import { airdropProjects, airdropPipelineRuns } from '../models/index';
import { validateAirdrop } from '../services/openai.service';
import { deleteCache, deleteCachePattern } from '../config/redis';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import { processEntityGates } from '../services/airdropGatePipeline.service';

/**
 * Routine sync of active projects (DEC-041 AD-3).
 * GLM/Z.ai enrichment removed — validate from local project fields only.
 * When intelligence enabled, re-run gate pipeline for entity-linked projects.
 */
async function runRoutineSync(): Promise<void> {
    const startTime = Date.now();
    console.log('[AirdropHunter] Routine sync of active projects (no GLM)...');

    const activeProjects = await db
        .select()
        .from(airdropProjects)
        .where(eq(airdropProjects.isActive, true));

    if (activeProjects.length === 0) {
        console.log('[AirdropHunter] No active projects to sync.');
        return;
    }

    let syncErrors = 0;
    for (const project of activeProjects) {
        try {
            if (env.AIRDROP_INTELLIGENCE_ENABLED && project.entityId) {
                await processEntityGates(project.entityId);
                console.log(`[AirdropHunter] Gate re-eval: ${project.name} (entity=${project.entityId})`);
                continue;
            }

            const raw = [
                `PROJECT NAME: ${project.name}`,
                `Network: ${project.network}`,
                project.fundingRound ? `Funding: ${project.fundingRound}` : '',
                project.websiteUrl ? `Website: ${project.websiteUrl}` : '',
                project.twitterUrl ? `Twitter: ${project.twitterUrl}` : '',
                project.aiReport ? `Prior report: ${project.aiReport.slice(0, 400)}` : '',
            ]
                .filter(Boolean)
                .join('\n');

            const validation = await validateAirdrop(raw);

            await db
                .update(airdropProjects)
                .set({
                    riskVerdict: validation.riskVerdict,
                    estValue: validation.estValue,
                    aiReport: validation.aiReport,
                    isActive: validation.isLegitimate && validation.riskVerdict !== 'SCAM',
                    updatedAt: new Date(),
                })
                .where(eq(airdropProjects.id, project.id));

            console.log(
                `[AirdropHunter] Synced: ${project.name} — risk=${validation.riskVerdict}, legitimate=${validation.isLegitimate}`
            );
        } catch (err) {
            syncErrors++;
            console.error(
                `[AirdropHunter] Sync error for ${project.name}:`,
                err instanceof Error ? err.message : String(err)
            );
        }
    }

    await deleteCache('airdrop:projects');
    await deleteCache('airdrop:deadlines');
    await deleteCachePattern('airdrop:project:*');

    const durationMs = Date.now() - startTime;
    try {
        await db.insert(airdropPipelineRuns).values({
            runType: 'routine_sync',
            articlesFound: 0,
            articlesProcessed: activeProjects.length,
            projectsInserted: 0,
            projectsRejected: 0,
            errors: syncErrors,
            durationMs,
            notes: 'GLM enrichment stripped (AD-3)',
        });
    } catch (logErr) {
        console.error(
            '[AirdropHunter] Failed to log pipeline run:',
            logErr instanceof Error ? logErr.message : String(logErr)
        );
    }

    console.log(
        `[AirdropHunter] Routine sync complete — ${activeProjects.length} projects processed`
    );
}

export function startAirdropHunterCron(): void {
    cron.schedule('0 */12 * * *', runRoutineSync);
    console.log('[AirdropHunter] Cron scheduled — Routine Sync: every 12 hours');
}

export { runRoutineSync };

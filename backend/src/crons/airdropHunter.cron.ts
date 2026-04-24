import cron from 'node-cron';
import { db } from '../config/db';
import { airdropProjects, airdropTasks, airdropPipelineRuns } from '../models/index';
import { validateAirdrop } from '../services/openai.service';
import { deleteCache, deleteCachePattern } from '../config/redis';
import { eq } from 'drizzle-orm';

async function runRoutineSync(): Promise<void> {
    const startTime = Date.now();
    console.log('[AirdropHunter] Routine sync of active projects...');

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
            const raw = `Project: ${project.name}\nNetwork: ${project.network}${project.fundingRound ? `\nFunding: ${project.fundingRound}` : ''}`;
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

            if (validation.tasks.length > 0) {
                await db
                    .delete(airdropTasks)
                    .where(eq(airdropTasks.projectId, project.id));

                const taskValues = validation.tasks.map((task, index) => ({
                    projectId: project.id,
                    description: task.description,
                    contractAddress: task.contractAddress ?? null,
                    minAmount: task.minAmount ?? null,
                    tokenSymbol: task.tokenSymbol ?? null,
                    chain: task.chain ?? null,
                    isAutoVerifiable: task.isAutoVerifiable,
                    orderIndex: index,
                }));

                await db.insert(airdropTasks).values(taskValues);
            }

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
        });
    } catch (logErr) {
        console.error('[AirdropHunter] Failed to log pipeline run:', logErr instanceof Error ? logErr.message : String(logErr));
    }

    console.log(`[AirdropHunter] Routine sync complete — ${activeProjects.length} projects processed`);
}

export function startAirdropHunterCron(): void {
    cron.schedule('0 */12 * * *', runRoutineSync);
    console.log('[AirdropHunter] Cron scheduled — Routine Sync: every 12 hours');
}

export { runRoutineSync };

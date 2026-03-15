import cron from 'node-cron';
import axios from 'axios';
import { db } from '../config/db';
import { airdropProjects, airdropTasks } from '../models/index';
import { validateAirdrop } from '../services/openai.service';
import { deleteCache } from '../config/redis';
import { eq } from 'drizzle-orm';

// ─── Scrape potential airdrops from public sources ─────────────────────────────

async function scrapePotentialAirdrops(): Promise<Array<{ name: string; description: string; network: string }>> {
    console.log('[AirdropHunter] Using placeholder daily scrape data...');
    return [
        {
            name: 'LayerZero',
            description: 'Omnichain interoperability protocol connecting multiple blockchains. Users who interact with dApps built on LayerZero may qualify for an airdrop.',
            network: 'Omnichain'
        },
        {
            name: 'ZkSync Era',
            description: 'A zkEVM rollup solution for Ethereum scaling. Users bridging assets and interacting with the ecosystem may receive tokens.',
            network: 'zkSync Era'
        }
    ];
}

// ─── Discovery Job: Every 24 hours (midnight UTC) ─────────────────────────────

export async function runDiscovery(): Promise<void> {
    console.log('🔍 [AirdropHunter] Running daily discovery sweep...');

    const potentialProjects = await scrapePotentialAirdrops();
    if (!potentialProjects.length) {
        console.log('[AirdropHunter] No new potential projects found.');
        return;
    }

    for (const project of potentialProjects) {
        try {
            const raw = `Project: ${project.name}\nNetwork: ${project.network}\nDescription: ${project.description}`;
            const validation = await validateAirdrop(raw);

            if (!validation.isLegitimate || validation.riskVerdict === 'SCAM') {
                console.log(`❌ [AirdropHunter] Rejected: ${project.name} (${validation.riskVerdict})`);
                continue;
            }

            const [saved] = await db.insert(airdropProjects).values({
                name: project.name,
                network: project.network,
                estValue: validation.estValue,
                aiReport: validation.aiReport,
                riskVerdict: validation.riskVerdict,
                isActive: true,
            }).returning({ id: airdropProjects.id });

            // Insert tasks
            for (let i = 0; i < validation.tasks.length; i++) {
                const task = validation.tasks[i];
                await db.insert(airdropTasks).values({
                    projectId: saved.id,
                    description: task.description,
                    contractAddress: task.contractAddress,
                    minAmount: task.minAmount,
                    tokenSymbol: task.tokenSymbol,
                    chain: task.chain,
                    isAutoVerifiable: task.isAutoVerifiable,
                    orderIndex: i,
                });
            }

            console.log(`✅ [AirdropHunter] Added: ${project.name} with ${validation.tasks.length} tasks`);
        } catch (err) {
            console.error(`[AirdropHunter] Error processing ${project.name}:`, err);
        }
    }

    await deleteCache('airdrop:projects');
}

// ─── Routine Sync: Every 12 hours ─────────────────────────────────────────────

export async function runRoutineSync(): Promise<void> {
    console.log('🔄 [AirdropHunter] Routine sync of active projects...');

    const activeProjects = await db
        .select()
        .from(airdropProjects)
        .where(eq(airdropProjects.isActive, true));

    for (const project of activeProjects) {
        try {
            // Re-validate to check for deadline changes or new tasks
            const raw = `Project update check for: ${project.name} (${project.network})`;
            const validation = await validateAirdrop(raw);

            await db.update(airdropProjects)
                .set({ updatedAt: new Date() })
                .where(eq(airdropProjects.id, project.id));

        } catch (err) {
            console.error(`[AirdropHunter] Sync error for ${project.name}:`, err);
        }
    }

    await deleteCache('airdrop:projects');
    await deleteCache('airdrop:deadlines');
}

// ─── Schedule Both Jobs ────────────────────────────────────────────────────────

export function startAirdropHunterCron(): void {
    // Daily discovery — midnight UTC
    cron.schedule('0 0 * * *', runDiscovery, { timezone: 'UTC' });

    // Routine sync — every 12 hours
    cron.schedule('0 */12 * * *', runRoutineSync);

    console.log('⏰ Airdrop Hunter cron scheduled — Discovery: daily 00:00 UTC | Sync: every 12h');
}

// ─── Callable from webhook (emergency update) ────────────────────────────────

export async function triggerEmergencyUpdate(projectName: string): Promise<void> {
    console.log(`🚨 [AirdropHunter] Emergency update triggered for: ${projectName}`);
    // Re-analyze the specific project
    const [project] = await db
        .select()
        .from(airdropProjects)
        .where(eq(airdropProjects.name, projectName));

    if (project) {
        await deleteCache(`airdrop:project:${project.id}`);
        await deleteCache('airdrop:deadlines');
    }
}

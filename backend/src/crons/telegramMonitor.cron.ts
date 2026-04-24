import cron from 'node-cron';
import { db } from '../config/db';
import { rawNewsBuffer } from '../models/market.model';
import { airdropProjects, airdropTasks } from '../models/index';
import { fetchNewsFromTelegram, fetchAirdropsFromTelegram } from '../services/telegram.service';
import { filterAirdropRelevant, getExistingProjectNames } from '../services/airdropRss.service';
import { validateAirdropFromArticle } from '../services/openai.service';
import { deleteCache, deleteCachePattern } from '../config/redis';
import { env } from '../config/env';

const MAX_AIRDROP_AI_CALLS = 3;

async function telegramNewsJob(): Promise<void> {
    if (!env.TELEGRAM_SESSION_STRING) return;
    console.log('[TelegramMonitor] News scan started');

    try {
        const items = await fetchNewsFromTelegram(30);
        if (items.length === 0) {
            console.log('[TelegramMonitor] No new news items');
            return;
        }

        let inserted = 0;
        for (const item of items) {
            try {
                await db.insert(rawNewsBuffer).values({
                    title: item.title,
                    source: item.source,
                    sourceHash: item.sourceHash,
                    retrievedAt: item.publishedAt,
                }).onConflictDoNothing();
                inserted++;
            } catch {
                // Duplicate hash — expected, skip silently
            }
        }

        console.log(`[TelegramMonitor] Inserted ${inserted}/${items.length} news items into rawNewsBuffer`);
    } catch (err) {
        console.error('[TelegramMonitor] News job failed:', err instanceof Error ? err.message : String(err));
    }
}

async function telegramAirdropJob(): Promise<void> {
    if (!env.TELEGRAM_SESSION_STRING) return;
    console.log('[TelegramMonitor] Airdrop scan started');

    try {
        const items = await fetchAirdropsFromTelegram(6);
        const airdropItems = items.filter(item => filterAirdropRelevant(`${item.title} ${item.content}`));

        if (airdropItems.length === 0) {
            console.log('[TelegramMonitor] No airdrop-relevant messages found');
            return;
        }

        const existingNames = await getExistingProjectNames();
        const candidates = airdropItems.slice(0, MAX_AIRDROP_AI_CALLS);
        let inserted = 0;

        for (const item of candidates) {
            try {
                const context = [
                    `ARTICLE TITLE: ${item.title}`,
                    `SOURCE: ${item.source}`,
                    `PUBLISHED: ${item.pubDate}`,
                    `LINK: ${item.link}`,
                    '',
                    '--- ARTICLE CONTENT ---',
                    item.content.slice(0, 3200),
                ].join('\n');

                const validation = await validateAirdropFromArticle(context);

                if (!validation.isLegitimate || validation.riskVerdict === 'SCAM') continue;
                if (existingNames.has(validation.projectName.toLowerCase())) continue;

                const [proj] = await db.insert(airdropProjects).values({
                    name: validation.projectName.slice(0, 100),
                    network: validation.network.slice(0, 50),
                    estValue: validation.estValue.slice(0, 255),
                    aiReport: validation.aiReport,
                    riskVerdict: validation.riskVerdict,
                    isActive: true,
                }).onConflictDoNothing({ target: airdropProjects.name }).returning();

                if (proj && validation.tasks.length > 0) {
                    const taskValues = validation.tasks.map((task, index) => ({
                        projectId: proj.id,
                        description: task.description,
                        contractAddress: task.contractAddress?.slice(0, 100) ?? null,
                        minAmount: task.minAmount ?? null,
                        tokenSymbol: task.tokenSymbol?.slice(0, 20) ?? null,
                        chain: task.chain?.slice(0, 50) ?? null,
                        isAutoVerifiable: task.isAutoVerifiable,
                        orderIndex: index,
                    }));
                    await db.insert(airdropTasks).values(taskValues);
                }

                existingNames.add(validation.projectName.toLowerCase());
                inserted++;
                console.log(`[TelegramMonitor] Inserted airdrop: ${validation.projectName}`);
            } catch (err) {
                console.error(`[TelegramMonitor] Error processing airdrop:`, err instanceof Error ? err.message : String(err));
            }
        }

        if (inserted > 0) {
            await deleteCache('airdrop:projects');
            await deleteCache('airdrop:deadlines');
            await deleteCachePattern('airdrop:project:*');
        }

        console.log(`[TelegramMonitor] Airdrop scan complete — ${inserted} new projects`);
    } catch (err) {
        console.error('[TelegramMonitor] Airdrop job failed:', err instanceof Error ? err.message : String(err));
    }
}

export function startTelegramMonitorCron(): void {
    if (!env.TELEGRAM_SESSION_STRING) {
        console.warn('[TelegramMonitor] No TELEGRAM_SESSION_STRING — cron disabled');
        return;
    }
    cron.schedule('*/30 * * * *', telegramNewsJob);
    cron.schedule('0 */4 * * *', telegramAirdropJob);
    console.log('[TelegramMonitor] Crons scheduled — News: every 30min, Airdrops: every 4h');
}

import cron from 'node-cron';
import { db } from '../config/db';
import { airdropProjects, airdropTasks } from '../models/index';
import { validateAirdropFromArticle } from '../services/openai.service';
import {
    fetchAirdropRSSFeeds,
    buildProjectContextFromArticle,
    getExistingProjectNames,
    type AirdropRSSArticle,
} from '../services/airdropRss.service';
import { deleteCache, deleteCachePattern } from '../config/redis';

const MAX_AI_CALLS_PER_RUN = 5;
const PROCESSED_HASHES_MAX = 1000;

const processedHashes: Set<string> = new Set();

function parseOptionalDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
}

async function runAirdropRSSDiscovery(): Promise<void> {
    console.log('[AirdropRSS] Discovery run started');

    let articles: AirdropRSSArticle[];
    try {
        articles = await fetchAirdropRSSFeeds();
    } catch (error) {
        console.error(
            '[AirdropRSS] Failed to fetch RSS feeds:',
            error instanceof Error ? error.message : String(error)
        );
        return;
    }

    console.log(`[AirdropRSS] Articles after keyword filter: ${articles.length}`);

    const unprocessedArticles = articles.filter(a => !processedHashes.has(a.hash));
    const candidates = unprocessedArticles.slice(0, MAX_AI_CALLS_PER_RUN);

    console.log(
        `[AirdropRSS] After dedup — ${unprocessedArticles.length} new, ${candidates.length} AI calls to make`
    );

    if (candidates.length === 0) {
        console.log('[AirdropRSS] No new articles to process');
        return;
    }

    const existingProjectNames = await getExistingProjectNames();
    let projectsInserted = 0;
    let rejections = 0;

    for (const article of candidates) {
        try {
            const context = buildProjectContextFromArticle(article);
            const validation = await validateAirdropFromArticle(context);

            if (!validation.isLegitimate || validation.riskVerdict === 'SCAM') {
                console.log(
                    `[AirdropRSS] Rejected: "${article.title}" — legitimate=${validation.isLegitimate}, risk=${validation.riskVerdict}`
                );
                rejections++;
                processedHashes.add(article.hash);
                continue;
            }

            const normalizedName = validation.projectName.toLowerCase();
            if (existingProjectNames.has(normalizedName)) {
                console.log(
                    `[AirdropRSS] Duplicate project skipped: "${validation.projectName}"`
                );
                rejections++;
                processedHashes.add(article.hash);
                continue;
            }

            const snapshotAt = parseOptionalDate(validation.snapshotDate);
            const tgeAt = parseOptionalDate(validation.tgeDate);

            const [insertedProject] = await db
                .insert(airdropProjects)
                .values({
                    name: validation.projectName.slice(0, 100),
                    network: validation.network.slice(0, 50),
                    estValue: validation.estValue.slice(0, 255),
                    aiReport: validation.aiReport,
                    riskVerdict: validation.riskVerdict,
                    snapshotAt,
                    tgeAt,
                    isActive: true,
                })
                .onConflictDoNothing({ target: airdropProjects.name })
                .returning();

            if (insertedProject && validation.tasks.length > 0) {
                const taskValues = validation.tasks.map((task, index) => ({
                    projectId: insertedProject.id,
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

            existingProjectNames.add(normalizedName);
            processedHashes.add(article.hash);
            projectsInserted++;

            console.log(
                `[AirdropRSS] Inserted project: "${validation.projectName}" (${validation.network}) with ${validation.tasks.length} tasks`
            );
        } catch (error) {
            console.error(
                `[AirdropRSS] Error processing article "${article.title}":`,
                error instanceof Error ? error.message : String(error)
            );
            processedHashes.add(article.hash);
        }
    }

    if (processedHashes.size > PROCESSED_HASHES_MAX) {
        const hashArray = Array.from(processedHashes);
        const trimmed = hashArray.slice(hashArray.length - PROCESSED_HASHES_MAX);
        processedHashes.clear();
        for (const h of trimmed) {
            processedHashes.add(h);
        }
    }

    try {
        await deleteCache('airdrop:projects');
        await deleteCache('airdrop:deadlines');
        await deleteCachePattern('airdrop:project:*');
    } catch (error) {
        console.error(
            '[AirdropRSS] Redis cache invalidation failed:',
            error instanceof Error ? error.message : String(error)
        );
    }

    console.log(
        `[AirdropRSS] Discovery run complete — inserted: ${projectsInserted}, rejected: ${rejections}, processed hashes: ${processedHashes.size}`
    );
}

export function startAirdropRSSCron(): void {
    cron.schedule('0 */6 * * *', runAirdropRSSDiscovery);
    console.log('[AirdropRSS] Cron scheduled — Discovery: every 6 hours');
}

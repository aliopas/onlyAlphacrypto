import cron from 'node-cron';
import { db } from '../config/db';
import { airdropProjects, airdropTasks, airdropPipelineRuns } from '../models/index';
import { validateAirdropFromArticle } from '../services/openai.service';
import {
    fetchAirdropRSSFeeds,
    buildProjectContextFromArticle,
    getExistingProjectNames,
    type AirdropRSSArticle,
} from '../services/airdropRss.service';
import { deleteCache, deleteCachePattern, redis } from '../config/redis';

const MAX_AI_CALLS_PER_RUN = 5;
const PROCESSED_HASHES_MAX = 1000;

const REDIS_HASH_KEY = 'airdrop:processed_hashes';

const localHashes: Set<string> = new Set();

async function isHashProcessed(hash: string): Promise<boolean> {
    if (!redis) return localHashes.has(hash);
    try {
        const result = await redis.sismember(REDIS_HASH_KEY, hash);
        return result === 1;
    } catch {
        return localHashes.has(hash);
    }
}

async function addProcessedHash(hash: string): Promise<void> {
    localHashes.add(hash);
    if (!redis) return;
    try {
        await redis.sadd(REDIS_HASH_KEY, hash);
        await redis.expire(REDIS_HASH_KEY, 7 * 24 * 60 * 60);
    } catch {
        // Redis unavailable — local fallback sufficient
    }
}

function parseOptionalDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
}

async function runAirdropRSSDiscovery(): Promise<void> {
    const startTime = Date.now();
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

    const unprocessedArticles = [];
    for (const article of articles) {
        const seen = await isHashProcessed(article.hash);
        if (!seen) unprocessedArticles.push(article);
    }
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
                await addProcessedHash(article.hash);
                continue;
            }

            const normalizedName = validation.projectName.toLowerCase();
            if (existingProjectNames.has(normalizedName)) {
                console.log(
                    `[AirdropRSS] Duplicate project skipped: "${validation.projectName}"`
                );
                rejections++;
                await addProcessedHash(article.hash);
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
            await addProcessedHash(article.hash);
            projectsInserted++;

            console.log(
                `[AirdropRSS] Inserted project: "${validation.projectName}" (${validation.network}) with ${validation.tasks.length} tasks`
            );
        } catch (error) {
            console.error(
                `[AirdropRSS] Error processing article "${article.title}":`,
                error instanceof Error ? error.message : String(error)
            );
            await addProcessedHash(article.hash);
        }
    }

    if (localHashes.size > PROCESSED_HASHES_MAX) {
        const hashArray = Array.from(localHashes);
        const trimmed = hashArray.slice(hashArray.length - PROCESSED_HASHES_MAX);
        localHashes.clear();
        for (const h of trimmed) {
            localHashes.add(h);
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

    const durationMs = Date.now() - startTime;
    try {
        await db.insert(airdropPipelineRuns).values({
            runType: 'rss_discovery',
            articlesFound: articles.length,
            articlesProcessed: candidates.length,
            projectsInserted,
            projectsRejected: rejections,
            errors: 0,
            durationMs,
        });
    } catch (logErr) {
        console.error('[AirdropRSS] Failed to log pipeline run:', logErr instanceof Error ? logErr.message : String(logErr));
    }

    console.log(
        `[AirdropRSS] Discovery run complete — inserted: ${projectsInserted}, rejected: ${rejections}, processed hashes: ${localHashes.size}`
    );
}

export function startAirdropRSSCron(): void {
    cron.schedule('0 */6 * * *', runAirdropRSSDiscovery);
    console.log('[AirdropRSS] Cron scheduled — Discovery: every 6 hours');
}

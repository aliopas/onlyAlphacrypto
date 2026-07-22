import cron from 'node-cron';
import { db } from '../config/db';
import { airdropPipelineRuns } from '../models/index';
import { fetchAirdropRSSFeeds, type AirdropRSSArticle } from '../services/airdropRss.service';
import { env } from '../config/env';
import { runAirdropSignalIngest } from '../services/airdropSignalIngest.service';
import { runAirdropGatePipeline } from '../services/airdropGatePipeline.service';

/**
 * RSS hunter (DEC-041 AD-3).
 * Legacy path that validated+inserted via GLM enrichment is removed.
 * When intelligence flags are on: signal ingest already covers RSS; this cron
 * triggers ingest+gates. When off: fetch-only health check (no GLM, no auto-insert).
 */
async function runAirdropRSSDiscovery(): Promise<void> {
    const startTime = Date.now();
    console.log('[AirdropRSS] Discovery run started (no GLM)');

    if (env.AIRDROP_INTELLIGENCE_ENABLED && env.AIRDROP_INTELLIGENCE_INGEST_ENABLED) {
        try {
            const ingest = await runAirdropSignalIngest();
            let gates = {
                autoPublish: 0,
                holdRecheck: 0,
                reject: 0,
                processed: 0,
            };
            if (env.AIRDROP_INTELLIGENCE_ENABLED) {
                const g = await runAirdropGatePipeline();
                gates = {
                    autoPublish: g.autoPublish,
                    holdRecheck: g.holdRecheck,
                    reject: g.reject,
                    processed: g.processed,
                };
            }

            const durationMs = Date.now() - startTime;
            await db.insert(airdropPipelineRuns).values({
                runType: 'rss_discovery',
                articlesFound:
                    ingest.telegramAlpha.attempted +
                    ingest.telegramCommunity.attempted +
                    ingest.rssAlpha.attempted,
                articlesProcessed:
                    ingest.telegramAlpha.inserted +
                    ingest.telegramCommunity.inserted +
                    ingest.rssAlpha.inserted,
                projectsInserted: gates.autoPublish,
                projectsRejected: gates.holdRecheck + gates.reject,
                errors: 0,
                durationMs,
                notes: JSON.stringify({ path: 'intelligence_ingest_gates', gates, ingest }),
            });

            console.log(
                `[AirdropRSS] Intelligence path complete — signals inserted, gates auto=${gates.autoPublish} hold=${gates.holdRecheck} reject=${gates.reject}`
            );
            return;
        } catch (error) {
            console.error(
                '[AirdropRSS] Intelligence path failed:',
                error instanceof Error ? error.message : String(error)
            );
            return;
        }
    }

    // Legacy health: fetch only, do not AI-insert (GLM stripped; avoid single-source auto-publish)
    let articles: AirdropRSSArticle[] = [];
    try {
        articles = await fetchAirdropRSSFeeds();
    } catch (error) {
        console.error(
            '[AirdropRSS] Failed to fetch RSS feeds:',
            error instanceof Error ? error.message : String(error)
        );
        return;
    }

    const durationMs = Date.now() - startTime;
    try {
        await db.insert(airdropPipelineRuns).values({
            runType: 'rss_discovery',
            articlesFound: articles.length,
            articlesProcessed: 0,
            projectsInserted: 0,
            projectsRejected: 0,
            errors: 0,
            durationMs,
            notes: 'legacy_fetch_only — enable AIRDROP_INTELLIGENCE_* for gate pipeline; GLM stripped',
        });
    } catch (logErr) {
        console.error(
            '[AirdropRSS] Failed to log pipeline run:',
            logErr instanceof Error ? logErr.message : String(logErr)
        );
    }

    console.log(
        `[AirdropRSS] Fetch-only complete — ${articles.length} articles (no auto-insert without intelligence flags)`
    );
}

export function startAirdropRSSCron(): void {
    cron.schedule('0 */6 * * *', runAirdropRSSDiscovery);
    console.log('[AirdropRSS] Cron scheduled — Discovery: every 6 hours (no GLM)');
}

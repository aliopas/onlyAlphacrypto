import cron from 'node-cron';
import { db } from '../config/db';
import { rawNewsBuffer } from '../models/market.model';
import { fetchNewsFromTelegram } from '../services/telegram.service';
import { env } from '../config/env';
import { guardedCronRun, guardCron } from '../utils/cronGuard';
import { logger } from '../utils/logger';
import { runAirdropSignalIngest } from '../services/airdropSignalIngest.service';
import { runAirdropGatePipeline } from '../services/airdropGatePipeline.service';

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
                    // Match terminalEngine's 48h TTL so bufferCleanup can reclaim these rows.
                    // Previously omitted, which left Telegram-originated rows unbounded.
                    ttlExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
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

/**
 * Airdrop TG path (DEC-041 AD-3): unified signal ingest + gates.
 * Legacy single-pass validateAirdropFromArticle + insert removed (no GLM, no single-source publish).
 */
async function telegramAirdropJob(): Promise<void> {
    if (!env.TELEGRAM_SESSION_STRING) return;
    console.log('[TelegramMonitor] Airdrop scan started (intelligence path)');

    try {
        if (!env.AIRDROP_INTELLIGENCE_ENABLED || !env.AIRDROP_INTELLIGENCE_INGEST_ENABLED) {
            console.log(
                '[TelegramMonitor] Airdrop intelligence flags off — skip TG airdrop auto-insert (AD-3)'
            );
            return;
        }

        const ingest = await runAirdropSignalIngest();
        const gates = await runAirdropGatePipeline();
        console.log(
            `[TelegramMonitor] Airdrop scan complete — signals tgAlpha=${ingest.telegramAlpha.inserted} community=${ingest.telegramCommunity.inserted} gates auto=${gates.autoPublish} hold=${gates.holdRecheck} reject=${gates.reject}`
        );
    } catch (err) {
        console.error(
            '[TelegramMonitor] Airdrop job failed:',
            err instanceof Error ? err.message : String(err)
        );
    }
}

export function startTelegramMonitorCron(): void {
    if (!env.TELEGRAM_SESSION_STRING) {
        logger.warn('[TelegramMonitor] No TELEGRAM_SESSION_STRING — cron disabled');
        return;
    }
    // News: every 30min. Redis mutex (10 min TTL) — the news job writes into the shared
    // raw_news_buffer table, so two instances must not scrape the same Telegram channel
    // concurrently (would race on dedup + double-insert).
    cron.schedule('*/30 * * * *', () => { void guardedCronRun('TelegramNews', 600, telegramNewsJob); });
    // Airdrops: every 4h. In-process guard only — airdrop insertion is idempotent via the
    // quality filter + dedup, and the Telegram airdrop channels are low-volume.
    cron.schedule('0 */4 * * *', guardCron('TelegramAirdrop', telegramAirdropJob));
    logger.info('[TelegramMonitor] Crons scheduled — News: every 30min, Airdrops: every 4h');
}

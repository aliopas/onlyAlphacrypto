/**
 * Airdrop Pipeline Health Check
 * Tests all 3 discovery sources + DB state + Redis dedup + missing cron
 *
 * Usage: npx ts-node src/test-airdrop-pipeline.ts
 */

import dotenv from 'dotenv';
dotenv.config();

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';
const DIVIDER = '─'.repeat(60);

let totalChecks = 0;
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail: string): void {
    totalChecks++;
    const icon = ok ? PASS : FAIL;
    if (ok) passed++; else failed++;
    console.log(`  ${icon} ${name}`);
    if (detail) console.log(`      ${detail}`);
}

function section(title: string): void {
    console.log(`\n${DIVIDER}`);
    console.log(`  ${title}`);
    console.log(DIVIDER);
}

async function main(): Promise<void> {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║       ONLYALPHA — AIRDROP PIPELINE HEALTH CHECK        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    // ── 1. ENV KEYS ──────────────────────────────────────────────────
    section('1. ENVIRONMENT KEYS');

    const telegramSession = process.env.TELEGRAM_SESSION_STRING ?? '';
    check('TELEGRAM_SESSION_STRING', telegramSession.length > 0,
        telegramSession.length > 0
            ? `Present (${telegramSession.length} chars)`
            : 'EMPTY — Telegram airdrop pipeline is DISABLED');

    const telegramApiId = process.env.TELEGRAM_API_ID ?? '';
    check('TELEGRAM_API_ID', telegramApiId.length > 0,
        telegramApiId.length > 0 ? `Present (${telegramApiId.length} chars)` : 'EMPTY');

    const telegramApiHash = process.env.TELEGRAM_API_HASH ?? '';
    check('TELEGRAM_API_HASH', telegramApiHash.length > 0,
        telegramApiHash.length > 0 ? `Present (${telegramApiHash.length} chars)` : 'EMPTY');

    const glmKey = process.env.GLM_API_KEY ?? '';
    check('GLM_API_KEY (Z.ai enrichment)', glmKey.length > 0,
        glmKey.length > 0 ? `Present (${glmKey.length} chars)` : 'EMPTY — Z.ai discovery + enrichment will fail');

    const openrouterKey = process.env.OPENROUTER_API_KEY ?? '';
    check('OPENROUTER_API_KEY (AI validation)', openrouterKey.length > 0,
        openrouterKey.length > 0 ? `Present (${openrouterKey.length} chars)` : 'EMPTY — AI validation will fail');

    const redisUrl = process.env.REDIS_URL ?? '';
    check('REDIS_URL', redisUrl.length > 0,
        redisUrl.length > 0 ? 'Present' : 'EMPTY — dedup hash tracking will use in-memory only (lost on restart)');

    const dbUrl = process.env.DATABASE_URL ?? '';
    check('DATABASE_URL', dbUrl.length > 0,
        dbUrl.length > 0 ? 'Present' : 'EMPTY — pipeline cannot run without DB');

    const telegramEnabled = telegramSession.length > 0 && telegramApiId.length > 0 && telegramApiHash.length > 0;
    console.log(`  ${WARN} Telegram pipeline: ${telegramEnabled ? 'ENABLED' : 'DISABLED (1/3 of discovery sources offline)'}`);

    // ── 2. RSS FEEDS ─────────────────────────────────────────────────
    section('2. RSS FEED SOURCES');

    const RSS_SOURCES = [
        { name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
        { name: 'Decrypt', url: 'https://decrypt.co/feed' },
        { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
        { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss' },
        { name: 'BeInCrypto', url: 'https://beincrypto.com/feed' },
    ];

    const AIRDROP_KEYWORDS = [
        'airdrop', 'airdrops', 'snapshot', 'tge', 'token generation',
        'claim', 'retrodrop', 'retroactive', 'testnet reward',
        'incentivized testnet', 'free token', 'token claim',
    ];

    let rssTotalItems = 0;
    let rssAirdropMatches = 0;

    for (const source of RSS_SOURCES) {
        try {
            const res = await fetch(source.url, {
                signal: AbortSignal.timeout(15000),
                headers: {
                    'User-Agent': 'OnlyAlpha-Bot/1.0',
                    'Accept': 'application/rss+xml, application/xml, text/xml',
                },
            });

            check(`${source.name} — HTTP ${res.status}`, res.ok,
                `URL: ${source.url}`);

            if (res.ok) {
                const text = await res.text();
                const itemMatches = text.match(/<item[\s>]/gi);
                const itemCount = itemMatches ? itemMatches.length : 0;
                rssTotalItems += itemCount;

                const lowerText = text.toLowerCase();
                const hasAirdropContent = AIRDROP_KEYWORDS.some(kw => lowerText.includes(kw));
                if (hasAirdropContent) rssAirdropMatches++;

                check(`${source.name} — parsed ${itemCount} items, airdrop keywords: ${hasAirdropContent ? 'YES' : 'NO'}`,
                    itemCount > 0,
                    `${itemCount} RSS items found`);
            }
        } catch (err) {
            check(`${source.name} — FETCH FAILED`, false,
                err instanceof Error ? err.message : String(err));
        }
    }

    console.log(`  ${WARN} RSS Summary: ${rssTotalItems} total items across ${RSS_SOURCES.length} feeds, ${rssAirdropMatches} feeds contain airdrop keywords`);

    // ── 3. DeFiLlama API ─────────────────────────────────────────────
    section('3. DeFiLlama API (tokenless protocols)');

    try {
        const dlRes = await fetch('https://api.llama.fi/protocols', {
            signal: AbortSignal.timeout(20000),
            headers: { 'Accept': 'application/json' },
        });

        check('DeFiLlama /protocols — HTTP', dlRes.ok, `Status: ${dlRes.status}`);

        if (dlRes.ok) {
            const protocols: Array<Record<string, unknown>> = await dlRes.json();
            const tokenless = protocols.filter(p =>
                !p.gecko_id && !p.symbol && (p.tvl as number) > 0 && p.name && (p.name as string).length > 1
            );

            check(`DeFiLlama total protocols`, protocols.length > 0, `${protocols.length} protocols`);
            check(`DeFiLlama tokenless (airdrop candidates)`, tokenless.length > 0, `${tokenless.length} tokenless protocols`);
            check(`Top 5 tokenless by TVL`, tokenless.length >= 5,
                tokenless.slice(0, 5).map(p => `${p.name} ($${Math.round((p.tvl as number) / 1_000_000)}M)`).join(', '));
        }
    } catch (err) {
        check('DeFiLlama API — FETCH FAILED', false, err instanceof Error ? err.message : String(err));
    }

    // ── 4. GLM / Z.AI WEB SEARCH ─────────────────────────────────────
    section('4. GLM / Z.AI WEB SEARCH (enrichment + discovery)');

    if (glmKey.length > 0) {
        try {
            const glmRes = await fetch(`${process.env.GLM_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4'}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${glmKey}`,
                },
                body: JSON.stringify({
                    model: process.env.GLM_PLANNER_MODEL ?? 'glm-4-plus',
                    messages: [{ role: 'user', content: 'Search the web for: crypto airdrop 2026 upcoming. Return factual information only.' }],
                    tools: [{ type: 'web_search', web_search: { enable: true } }],
                }),
                signal: AbortSignal.timeout(15000),
            });

            check('GLM API — HTTP', glmRes.ok, `Status: ${glmRes.status}`);

            if (glmRes.ok) {
                const data = await glmRes.json() as {
                    choices?: Array<{ message?: { content?: string } }>;
                };
                const content = data?.choices?.[0]?.message?.content ?? '';
                check('GLM API — returned content', content.length > 0, `${content.length} chars of content`);
            }
        } catch (err) {
            check('GLM API — REQUEST FAILED', false, err instanceof Error ? err.message : String(err));
        }
    } else {
        check('GLM API — SKIPPED', false, 'No GLM_API_KEY set');
    }

    // ── 5. REDIS DEDUP SET ───────────────────────────────────────────
    section('5. REDIS DEDUP SET (airdrop:processed_hashes)');

    if (redisUrl.length > 0) {
        try {
            const Redis = (await import('ioredis')).default;
            const client = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true });
            await client.connect();

            const setSize = await client.scard('airdrop:processed_hashes');
            check('Redis processed_hashes set size', true, `${setSize} hashes stored (7-day TTL)`);
            check('Dedup blockage risk', setSize < 500,
                setSize >= 500 ? 'HIGH — large set may be blocking new articles' : 'LOW — set size is healthy');

            const ttl = await client.ttl('airdrop:processed_hashes');
            check('Redis processed_hashes TTL', ttl > 0 || setSize === 0,
                ttl > 0 ? `${Math.round(ttl / 3600)}h remaining` : setSize === 0 ? 'Empty set' : 'NO TTL set (keys will persist forever)');

            await client.disconnect();
        } catch (err) {
            check('Redis connection — FAILED', false, err instanceof Error ? err.message : String(err));
        }
    } else {
        check('Redis — SKIPPED', false, 'No REDIS_URL, using in-memory dedup only');
    }

    // ── 6. DATABASE — ACTIVE PROJECTS + PIPELINE RUNS ────────────────
    section('6. DATABASE STATE');

    if (dbUrl.length > 0) {
        try {
            const { Pool } = await import('pg');
            const pool = new Pool({ connectionString: dbUrl });

            const projectRes = await pool.query(
                "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM airdrop_projects"
            );
            const { total, active } = projectRes.rows[0];
            check('DB airdrop_projects', true, `Total: ${total}, Active: ${active}`);

            const recentProjects = await pool.query(
                "SELECT name, created_at, is_active FROM airdrop_projects ORDER BY created_at DESC LIMIT 5"
            );
            if (recentProjects.rows.length > 0) {
                console.log('      Latest 5 projects:');
                for (const row of recentProjects.rows) {
                    const age = Math.round((Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60));
                    console.log(`        • ${row.name} — ${age}h ago [${row.is_active ? 'active' : 'inactive'}]`);
                }
            } else {
                check('DB latest projects', false, 'No projects found in database');
            }

            const pipelineRes = await pool.query(
                "SELECT run_type, run_at, articles_found, articles_processed, projects_inserted, projects_rejected, errors, duration_ms FROM airdrop_pipeline_runs ORDER BY run_at DESC LIMIT 10"
            );
            check('DB pipeline_runs', pipelineRes.rows.length > 0, `${pipelineRes.rows.length} runs recorded`);

            if (pipelineRes.rows.length > 0) {
                console.log('      Latest 10 pipeline runs:');
                for (const row of pipelineRes.rows) {
                    const age = Math.round((Date.now() - new Date(row.run_at).getTime()) / (1000 * 60 * 60));
                    const status = row.projects_inserted > 0 ? PASS : (row.errors > 0 ? FAIL : WARN);
                    console.log(
                        `        ${status} [${row.run_type}] ${age}h ago — articles: ${row.articles_found}, ` +
                        `processed: ${row.articles_processed}, inserted: ${row.projects_inserted}, ` +
                        `rejected: ${row.projects_rejected}, errors: ${row.errors}, ${row.duration_ms}ms`
                    );
                }

                const lastRunAge = Math.round((Date.now() - new Date(pipelineRes.rows[0].run_at).getTime()) / (1000 * 60 * 60));
                const lastRunInserted = parseInt(pipelineRes.rows[0].projects_inserted, 10);
                const lastRunFound = parseInt(pipelineRes.rows[0].articles_found, 10);

                if (lastRunAge > 48) {
                    check('Pipeline freshness', false, `Last run was ${lastRunAge}h ago — cron may not be running`);
                } else {
                    check('Pipeline freshness', true, `Last run was ${lastRunAge}h ago`);
                }

                if (lastRunFound === 0 && lastRunInserted === 0) {
                    console.log(`  ${FAIL} Last pipeline run found 0 articles and inserted 0 projects — pipeline is effectively dead`);
                }
            }

            const lastInsert = await pool.query(
                "SELECT name, created_at FROM airdrop_projects ORDER BY created_at DESC LIMIT 1"
            );
            if (lastInsert.rows.length > 0) {
                const ageHours = Math.round((Date.now() - new Date(lastInsert.rows[0].created_at).getTime()) / (1000 * 60 * 60));
                check('Last project inserted', ageHours <= 48,
                    `"${lastInsert.rows[0].name}" — ${ageHours}h ago`);
                if (ageHours > 48) {
                    console.log(`  ${FAIL} No new airdrop project inserted in ${ageHours} hours — confirms the bug`);
                }
            }

            await pool.end();
        } catch (err) {
            check('Database connection — FAILED', false, err instanceof Error ? err.message : String(err));
        }
    } else {
        check('Database — SKIPPED', false, 'No DATABASE_URL');
    }

    // ── 7. MISSING CRON DETECTION ────────────────────────────────────
    section('7. CRON REGISTRATION CHECK (server.ts)');

    try {
        const fs = await import('fs');
        const path = await import('path');
        const serverContent = fs.readFileSync(
            path.resolve(__dirname, 'server.ts'),
            'utf-8'
        );

        check('startAirdropHunterCron', serverContent.includes('startAirdropHunterCron'), 'Routine sync — every 12h');
        check('startAirdropRSSCron', serverContent.includes('startAirdropRSSCron'), 'RSS discovery — every 6h');
        check('startAirdropDiscoveryCron', serverContent.includes('startAirdropDiscoveryCron'),
            'DeFiLlama+Z.ai discovery — every 6h');
        check('startTelegramMonitorCron', serverContent.includes('startTelegramMonitorCron'),
            telegramEnabled ? 'Telegram scanning — every 4h' : 'Telegram scanning — BLOCKED (no credentials)');

        if (!serverContent.includes('startAirdropDiscoveryCron')) {
            console.log(`  ${FAIL} startAirdropDiscoveryCron is NOT registered in server.ts — DeFiLlama+Z.ai pipeline is DEAD`);
            console.log(`      FIX: Add import { startAirdropDiscoveryCron } from './crons/airdropDiscovery.cron';`);
            console.log(`           Add { name: 'AirdropDiscovery', fn: startAirdropDiscoveryCron } to crons array`);
        }
    } catch (err) {
        check('server.ts read — FAILED', false, err instanceof Error ? err.message : String(err));
    }

    // ── SUMMARY ──────────────────────────────────────────────────────
    console.log(`\n${DIVIDER}`);
    console.log(`  RESULTS: ${passed}/${totalChecks} passed, ${failed} failed`);
    console.log(DIVIDER);

    if (failed > 0) {
        console.log(`\n  ${FAIL} ACTION ITEMS:`);
        if (!telegramEnabled) console.log('      1. Set TELEGRAM_SESSION_STRING, TELEGRAM_API_ID, TELEGRAM_API_HASH in .env');
        if (redisUrl.length === 0) console.log('      2. Set REDIS_URL for persistent dedup (optional but recommended)');
        console.log('      3. Check if airdropDiscoveryCron is registered in server.ts (FIX REQUIRED)');
        console.log('      4. Review pipeline_runs in DB for zero-insertion patterns');
        console.log('      5. Check if RSS feeds are returning airdrop-relevant content');
    }

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

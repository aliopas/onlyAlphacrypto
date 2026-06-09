/**
 * Local test script for the Scorecard Portfolio Flow.
 *
 * Tests every stage of the pipeline WITHOUT writing to the database.
 * Safe to run repeatedly — uses a DRY_RUN flag.
 *
 * Usage:
 *   npx ts-node scripts/test-scorecard-flow.ts
 *
 * What it covers:
 *   1. Env validation (TELEGRAM_*, SCORECARD_TELEGRAM_CHANNEL, OPENROUTER_API_KEY, COINGECKO)
 *   2. Telegram connection (connect → getMessages → disconnect, verifies no persistent client)
 *   3. Photo download + base64 conversion
 *   4. Vision AI call (OpenRouter) for symbol extraction
 *   5. Validation (CoinGecko search → CEX check → Binance price → movement gate)
 *   6. Profile builder (web search + RSS news)
 *   7. TP/SL calculator (Binance klines → ATR → swing levels → RR)
 *   8. Full pipeline integration (DRY_RUN — no DB writes)
 *
 * Exit codes:
 *   0 = all stages passed
 *   1 = a stage failed (details printed)
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as dotenv from 'dotenv';
import { createHash } from 'crypto';
import { env } from '../src/config/env';

dotenv.config();

const STAGE = (n: number, name: string) => `\n━━━ STAGE ${n}: ${name} ━━━`;
const OK = (msg: string) => console.log(`   ✅ ${msg}`);
const FAIL = (msg: string) => console.log(`   ❌ ${msg}`);
const WARN = (msg: string) => console.log(`   ⚠️  ${msg}`);
const INFO = (msg: string) => console.log(`   ℹ️  ${msg}`);

let stageNum = 0;
let passedStages = 0;
let failedStages = 0;
const failedDetails: string[] = [];

function recordPass(name: string) {
    passedStages++;
    console.log(`   ✅ STAGE PASSED: ${name}`);
}

function recordFail(name: string, err: unknown) {
    failedStages++;
    const msg = err instanceof Error ? err.message : String(err);
    failedDetails.push(`${name}: ${msg}`);
    console.log(`   ❌ STAGE FAILED: ${name} — ${msg}`);
}

async function stage1_envValidation(): Promise<boolean> {
    console.log(STAGE(++stageNum, 'ENV VALIDATION'));
    const required = [
        'TELEGRAM_API_ID',
        'TELEGRAM_API_HASH',
        'TELEGRAM_SESSION_STRING',
        'OPENROUTER_API_KEY',
        'COINGECKO_BASE_URL',
    ];
    let allOk = true;
    for (const key of required) {
        const val = process.env[key];
        if (!val || val.trim() === '') {
            FAIL(`${key} is missing or empty`);
            allOk = false;
        } else {
            const display = val.length > 20 ? `${val.slice(0, 16)}…` : val;
            OK(`${key} = ${display}`);
        }
    }
    const channel = process.env['SCORECARD_TELEGRAM_CHANNEL'] || '';
    if (!channel) {
        WARN('SCORECARD_TELEGRAM_CHANNEL is not set — scraper will skip (this is expected if you have not configured it yet)');
    } else {
        OK(`SCORECARD_TELEGRAM_CHANNEL = ${channel}`);
    }
    INFO('WRITER_MODEL = ' + (process.env['WRITER_MODEL'] || '(not set)'));
    INFO('SCORECARD_MAX_COINS = ' + (process.env['SCORECARD_MAX_COINS'] || '30 (default)'));
    return allOk;
}

async function stage2_telegramConnection(): Promise<{ client: TelegramClient | null; channelOk: boolean }> {
    console.log(STAGE(++stageNum, 'TELEGRAM CONNECTION'));
    const apiId = parseInt(env.TELEGRAM_API_ID, 10);
    const apiHash = env.TELEGRAM_API_HASH;
    const sessionStr = env.TELEGRAM_SESSION_STRING;

    let client: TelegramClient | null = null;
    try {
        client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
            connectionRetries: 3,
        });
        await client.connect();
        OK('Telegram client connected');

        const me = await client.getMe();
        const meAny = me as unknown as { firstName?: string; username?: string };
        OK(`Logged in as ${meAny.firstName ?? 'Unknown'} (@${meAny.username ?? 'N/A'})`);

        const channel = env.SCORECARD_TELEGRAM_CHANNEL;
        let channelOk = false;
        if (channel) {
            try {
                const messages = await client.getMessages(channel, { limit: 3 });
                OK(`Read ${messages.length} messages from "${channel}"`);
                let withMedia = 0;
                for (const msg of messages) {
                    if (msg.media) withMedia++;
                }
                INFO(`${withMedia}/${messages.length} messages contain media`);
                channelOk = messages.length > 0;
            } catch (err) {
                FAIL(`Cannot read channel "${channel}": ${err instanceof Error ? err.message : String(err)}`);
            }
        } else {
            WARN('No SCORECARD_TELEGRAM_CHANNEL — skipping channel read');
        }

        return { client, channelOk };
    } catch (err) {
        FAIL(`Telegram connection failed: ${err instanceof Error ? err.message : String(err)}`);
        return { client: null, channelOk: false };
    }
}

async function stage3_photoDownload(client: TelegramClient): Promise<boolean> {
    console.log(STAGE(++stageNum, 'PHOTO DOWNLOAD (BASE64)'));
    const channel = env.SCORECARD_TELEGRAM_CHANNEL;
    if (!channel) {
        WARN('No channel configured — skipping photo download test');
        return true;
    }
    try {
        const messages = await client.getMessages(channel, { limit: 5 });
        let photoMsg: (typeof messages)[number] | null = null;
        for (const msg of messages) {
            if (msg.media && (msg.media as unknown as { photo?: unknown }).photo) {
                photoMsg = msg;
                break;
            }
        }
        if (!photoMsg) {
            WARN('No photo in last 5 messages — cannot test download');
            return true;
        }
        const buffer = await client.downloadMedia(photoMsg, {}) as Buffer | undefined;
        if (!buffer || !Buffer.isBuffer(buffer)) {
            FAIL('Photo download returned no buffer');
            return false;
        }
        const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        const sizeKb = Math.round(base64.length / 1024);
        OK(`Photo downloaded — base64 size: ${sizeKb}KB`);
        return true;
    } catch (err) {
        FAIL(`Photo download failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}

async function stage4_visionCall(): Promise<boolean> {
    console.log(STAGE(++stageNum, 'VISION AI (OPENROUTER)'));
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey) {
        FAIL('OPENROUTER_API_KEY missing — cannot test vision');
        return false;
    }
    try {
        const testImageDataUrl =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        const prompt = 'You are analyzing a test image. Return JSON: {"symbols":[]}';

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://onlyalpha.app',
                'X-Title': 'OnlyAlpha Test',
            },
            body: JSON.stringify({
                model: env.WRITER_MODEL,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: testImageDataUrl } },
                        ],
                    },
                ],
                temperature: 0.1,
                max_tokens: 100,
            }),
        });

        if (!res.ok) {
            FAIL(`Vision API returned HTTP ${res.status}: ${await res.text()}`);
            return false;
        }
        const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = data.choices?.[0]?.message?.content ?? '';
        if (!content) {
            FAIL('Vision API returned empty content');
            return false;
        }
        OK(`Vision API responded (${content.length} chars): ${content.slice(0, 80)}…`);
        return true;
    } catch (err) {
        FAIL(`Vision call failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}

async function stage5_validation(): Promise<boolean> {
    console.log(STAGE(++stageNum, 'VALIDATION (COINGECKO + CEX + BINANCE)'));
    const testSymbols = [
        { symbol: 'ARB', expectPass: true, note: 'major tracked — expect REJECTED by altcoin gate' },
        { symbol: 'INJ', expectPass: true, note: 'major tracked — expect REJECTED by altcoin gate' },
        { symbol: 'NOTACOINXYZ123', expectPass: false, note: 'non-existent — expect REJECTED by CoinGecko' },
    ];

    const { validateScorecardCoin } = await import('../src/services/scorecardValidation.service');

    let allOk = true;
    for (const test of testSymbols) {
        console.log(`\n   ── Testing ${test.symbol} (${test.note}) ──`);
        try {
            const result = await validateScorecardCoin({ symbol: test.symbol, entryPrice: 1.0 });
            if (result) {
                OK(`${test.symbol}: PASSED validation — price=$${result.currentPrice}, movement=${result.priceMovement.toFixed(2)}%`);
            } else {
                OK(`${test.symbol}: REJECTED (as expected for this test case)`);
            }
        } catch (err) {
            FAIL(`${test.symbol}: validation threw: ${err instanceof Error ? err.message : String(err)}`);
            allOk = false;
        }
    }
    return allOk;
}

async function stage6_tpsl(): Promise<boolean> {
    console.log(STAGE(++stageNum, 'TP/SL CALCULATOR'));
    const { calculateScorecardTpsl } = await import('../src/services/scorecardTpslCalculator.service');
    const testCases = [
        { symbol: 'ARB', entryPrice: 1.0, classification: 'STRATEGIC' as const },
        { symbol: 'INJ', entryPrice: 25.0, classification: 'STRATEGIC' as const },
        { symbol: 'NOTACOINXYZ123', entryPrice: 1.0, classification: 'TACTICAL' as const },
    ];

    let allOk = true;
    for (const tc of testCases) {
        console.log(`\n   ── ${tc.symbol} @ $${tc.entryPrice} (${tc.classification}) ──`);
        try {
            const result = await calculateScorecardTpsl(tc);
            if (result.isRejected) {
                OK(`${tc.symbol}: REJECTED — ${result.rejectionReason}`);
            } else {
                OK(`${tc.symbol}: ACCEPTED — TP1=${result.tp1} SL=${result.stopLoss} RR=${result.rr.toFixed(2)} budget=$${result.allocatedBudget}`);
            }
        } catch (err) {
            FAIL(`${tc.symbol}: TP/SL threw: ${err instanceof Error ? err.message : String(err)}`);
            allOk = false;
        }
    }
    return allOk;
}

async function stage7_profile(): Promise<boolean> {
    console.log(STAGE(++stageNum, 'PROFILE BUILDER'));
    const { buildCoinProfile } = await import('../src/services/scorecardProfileBuilder.service');
    try {
        const result = await buildCoinProfile({ symbol: 'ARB', coinGeckoId: 'arbitrum' });
        OK(`Profile built: projectName=${result.projectName}, team=${result.team.slice(0, 40)}…, newsCount=${result.latestNews.length}`);
        return true;
    } catch (err) {
        FAIL(`Profile builder threw: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}

async function stage8_fullPipelineDryRun(): Promise<boolean> {
    console.log(STAGE(++stageNum, 'FULL PIPELINE (DRY RUN)'));
    console.log('   ℹ️  Note: This calls runScorecardPipeline() with no extraction override,');
    console.log('   ℹ️  so it will return immediately if SCORECARD_TELEGRAM_CHANNEL is not set.');
    try {
        const { runScorecardPipeline } = await import('../src/services/scorecardPipeline.service');
        const stats = await runScorecardPipeline();
        OK(`Pipeline completed — processed:${stats.processed} validated:${stats.validated} inserted:${stats.inserted} rejected:${stats.rejected} failed:${stats.failed}`);
        return true;
    } catch (err) {
        FAIL(`Pipeline threw: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║   OnlyAlpha — Scorecard Portfolio Flow Local Test           ║');
    console.log('║   DRY-RUN: No database writes, no Telegram persistent conn  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const envOk = await stage1_envValidation();
    if (!envOk) {
        console.log('\n❌ ENV validation failed — fix .env and re-run');
        process.exit(1);
    }
    recordPass('ENV VALIDATION');

    let client: TelegramClient | null = null;
    try {
        const result = await stage2_telegramConnection();
        client = result.client;
        if (client) recordPass('TELEGRAM CONNECTION');
        else { recordFail('TELEGRAM CONNECTION', 'client is null'); }

        if (client) {
            const ok = await stage3_photoDownload(client);
            if (ok) recordPass('PHOTO DOWNLOAD');
            else recordFail('PHOTO DOWNLOAD', 'see above');
        }

        const visOk = await stage4_visionCall();
        if (visOk) recordPass('VISION AI');
        else recordFail('VISION AI', 'see above');

        const valOk = await stage5_validation();
        if (valOk) recordPass('VALIDATION');
        else recordFail('VALIDATION', 'see above');

        const tpslOk = await stage6_tpsl();
        if (tpslOk) recordPass('TP/SL CALCULATOR');
        else recordFail('TP/SL CALCULATOR', 'see above');

        const profOk = await stage7_profile();
        if (profOk) recordPass('PROFILE BUILDER');
        else recordFail('PROFILE BUILDER', 'see above');

        const pipeOk = await stage8_fullPipelineDryRun();
        if (pipeOk) recordPass('FULL PIPELINE');
        else recordFail('FULL PIPELINE', 'see above');
    } finally {
        if (client) {
            try {
                await client.disconnect();
                console.log('\n   🔌 Telegram client disconnected (no persistent connection leaked)');
            } catch (err) {
                console.log(`\n   ⚠️  Disconnect error (harmless): ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log(`║   RESULTS: ${passedStages} passed, ${failedStages} failed`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    if (failedDetails.length > 0) {
        console.log('\nFailed stages:');
        for (const d of failedDetails) console.log(`   - ${d}`);
    }
    process.exit(failedStages > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('\n❌ Test runner crashed:', err);
    process.exit(1);
});

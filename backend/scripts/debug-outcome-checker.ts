/**
 * Debug Script: EventOutcomeChecker Diagnosis
 *
 * Isolated script to reproduce Binance 400 errors seen in production logs.
 * This script is READ-ONLY - it does NOT modify any data.
 *
 * Run with: npx ts-node scripts/debug-outcome-checker.ts
 */

import axios from 'axios';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env file - point to parent directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ─── Config ───────────────────────────────────────────────────────────────────

const BINANCE_BASE = 'https://api.binance.com/api/v3';

const TRACKED_COINS = [
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP',
    'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'TON',
] as const;

const TRACKED_COIN_SET: ReadonlySet<string> = new Set(TRACKED_COINS);

const HORIZONS = {
    '1h': 3600000,
    '4h': 14400000,
    '24h': 86400000,
    '3d': 259200000,
    '7d': 604800000,
} as const;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('   Please set DATABASE_URL in .env file or environment');
    process.exit(1);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BinanceKline {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
}

// ─── Binance API (exact copy from binance.service.ts) ─────────────────────────

async function getCoinKlinesRange(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number
): Promise<BinanceKline[]> {
    if (startTime >= endTime) return [];
    if (!symbol || typeof symbol !== 'string') return [];

    const pair = symbol.toUpperCase() + 'USDT';
    const maxCandles = 1500;
    const limitPerRequest = 1000;
    let allCandles: BinanceKline[] = [];
    let currentStartTime = startTime;

    try {
        while (allCandles.length < maxCandles && currentStartTime < endTime) {
            const { data } = await axios.get(`${BINANCE_BASE}/klines`, {
                params: {
                    symbol: pair,
                    interval,
                    startTime: currentStartTime,
                    endTime,
                    limit: limitPerRequest,
                },
                timeout: 5000,
            });

            if (!Array.isArray(data) || data.length === 0) break;

            const candles = data.map((k: unknown[]) => ({
                open: parseFloat(k[1] as string),
                high: parseFloat(k[2] as string),
                low: parseFloat(k[3] as string),
                close: parseFloat(k[4] as string),
                volume: parseFloat(k[5] as string),
                closeTime: k[6] as number,
            }));

            allCandles.push(...candles);

            const lastCandle = candles[candles.length - 1];
            if (lastCandle && lastCandle.closeTime < endTime) {
                currentStartTime = lastCandle.closeTime + 1;
            } else {
                break;
            }

            if (allCandles.length >= maxCandles) {
                allCandles = allCandles.slice(0, maxCandles);
                break;
            }
        }

        return allCandles;
    } catch (error) {
        // Return partial results if any candles were fetched
        if (allCandles.length > 0) {
            console.warn(`  ⚠️ Partial failure for ${symbol}: ${error instanceof Error ? error.message : String(error)}, returning ${allCandles.length} candles`);
            return allCandles;
        }
        throw error;
    }
}

// ─── Test Binance API for problematic coins ────────────────────────────────────

interface TestResult {
    symbol: string;
    isTracked: boolean;
    status: 'success' | 'error' | 'no_data';
    candleCount: number;
    errorMessage?: string;
    errorStatus?: number;
}

async function testBinanceApi(): Promise<TestResult[]> {
    console.log('🧪 Testing Binance API for known problematic coins...');
    console.log('─'.repeat(60));

    const testCoins = [
        // Untracked (should fail with 400)
        { symbol: 'STRC', isTracked: false },
        { symbol: 'COIN', isTracked: false },
        { symbol: 'DRIFT', isTracked: false },
        { symbol: 'KELP', isTracked: false },
        { symbol: 'KRAKEN', isTracked: false },
        { symbol: 'WETH', isTracked: false },
        // Tracked (should work)
        { symbol: 'BTC', isTracked: true },
        { symbol: 'ETH', isTracked: true },
        { symbol: 'SOL', isTracked: true },
        { symbol: 'XRP', isTracked: true },
        { symbol: 'LINK', isTracked: true },
    ];

    const results: TestResult[] = [];
    const now = Date.now();
    const startTime = now - 86400000; // 24h ago
    const endTime = now;

    for (const { symbol, isTracked } of testCoins) {
        const result: TestResult = { symbol, isTracked, status: 'error', candleCount: 0 };

        console.log(`\n  ${symbol.padEnd(8)} (${isTracked ? 'TRACKED ✅' : 'UNTRACKED ❌'})`);

        try {
            const candles = await getCoinKlinesRange(symbol, '1h', startTime, endTime);
            result.candleCount = candles.length;

            if (candles.length === 0) {
                result.status = 'no_data';
                console.log(`    → ⚠️  No candles returned`);
            } else {
                result.status = 'success';
                console.log(`    → ✅ Success: ${candles.length} candles`);
                console.log(`       Price: $${candles[0].close.toFixed(2)} → $${candles[candles.length-1].close.toFixed(2)}`);
            }
        } catch (error) {
            const err = error as { response?: { status?: number }; message?: string };
            result.errorStatus = err.response?.status;
            result.errorMessage = err.message || String(error);
            console.log(`    → ❌ HTTP ${result.errorStatus}: ${result.errorMessage}`);
        }

        results.push(result);
    }

    return results;
}

// ─── Query Database ───────────────────────────────────────────────────────────

async function queryDatabase(): Promise<{ pool: Pool; rawRows: { id: number; coin_symbol: string; published_at: Date; price_at_time: number | null }[] }> {
    console.log('\n\n📡 Connecting to database...');
    const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });

    try {
        await pool.query('SELECT 1');
        console.log('✅ Database connected\n');
    } catch (err) {
        console.warn('⚠️  Database connection failed (will skip DB checks):', err instanceof Error ? err.message : String(err));
        throw err;
    }

    const rawRows = await pool.query<{
        id: number;
        coin_symbol: string;
        published_at: Date;
        price_at_time: number | null;
    }>(
        `SELECT id, coin_symbol, published_at, price_at_time
         FROM coin_news_history
         WHERE price_at_time IS NOT NULL
         ORDER BY published_at ASC
         LIMIT 20`,
        []
    );

    console.log(`📊 Found ${rawRows.rows.length} eligible rows (limit 20)\n`);

    if (rawRows.rows.length === 0) {
        console.log('⚠️  coin_news_history is empty. This script needs data to debug properly.');
        console.log('   The production system has data in this table that we can\'t see locally.');
        console.log('\n   However, the Binance API tests above confirm which coins fail.');
    }

    return { pool, rawRows: rawRows.rows };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   EventOutcomeChecker Debug Script');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Test Binance API
    const binanceResults = await testBinanceApi();

    // 2. Try to query database
    let pool: Pool | null = null;
    let rawRows: { id: number; coin_symbol: string; published_at: Date; price_at_time: number | null }[] = [];

    try {
        const result = await queryDatabase();
        pool = result.pool;
        rawRows = result.rawRows;
    } catch {
        // DB connection failed - continue with Binance results only
    }

    // 3. Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📋 SUMMARY');
    console.log('═'.repeat(60));

    const untrackedResults = binanceResults.filter(r => !r.isTracked);
    const trackedResults = binanceResults.filter(r => r.isTracked);

    console.log('\n  Binance API Test Results:');
    console.log('  ─────────────────────────');

    const failedUntracked = untrackedResults.filter(r => r.status === 'error' && r.errorStatus === 400);
    const workingTracked = trackedResults.filter(r => r.status === 'success');

    console.log(`\n  Untracked coins (expected 400 errors):`);
    for (const r of untrackedResults) {
        const status = r.status === 'error' && r.errorStatus === 400 ? '❌ 400' :
                       r.status === 'error' ? `❌ ${r.errorStatus}` :
                       r.status === 'no_data' ? '⚠️  no data' : '✅';
        console.log(`    ${r.symbol.padEnd(10)} ${status}`);
    }

    console.log(`\n  Tracked coins (should work):`);
    for (const r of trackedResults) {
        const status = r.status === 'success' ? `✅ ${r.candleCount} candles` :
                       r.status === 'error' ? `❌ ${r.errorStatus}` :
                       '⚠️  no data';
        console.log(`    ${r.symbol.padEnd(10)} ${status}`);
    }

    console.log('\n  🔴 ROOT CAUSE:');
    console.log('     EventOutcomeChecker queries ALL eligible rows without checking');
    console.log('     if the coin is in TRACKED_COINS. When it tries to fetch candles');
    console.log('     for untracked coins (STRC, COIN, DRIFT, KELP, KRAKEN, WETH),');
    console.log('     Binance returns 400 because these symbols don\'t exist as USDT pairs.');

    console.log('\n  ✅ RECOMMENDED FIX:');
    console.log('     Add coin symbol filter in eventOutcomeChecker.cron.ts query:');
    console.log(`     AND coin_symbol IN ('${TRACKED_COINS.join("','")}')`);

    if (pool) {
        await pool.end();
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
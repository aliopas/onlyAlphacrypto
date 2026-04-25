/**
 * Fetches sample messages from all channels to evaluate data quality.
 *
 * Usage:
 *   npx ts-node scripts/check-channels.ts
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as dotenv from 'dotenv';

dotenv.config();

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION = process.env.TELEGRAM_SESSION_STRING || '';

const NEWS_CHANNELS = [
    'whale_alert_io',
    'cointelegraph',
    'CoinDesk',
    'decrypt',
    'BlockworksResearch',
    'bankless',
    'zaborona_crypto',
    'tier1bot',
    'DeFiNexus',
    'ARBwhalealert',
    'unusual_whales',
    'blockchain',
];

const AIRDROP_CHANNELS = [
    'airdrops_io',
    'defi_airdrops',
    'airdropofficial',
    'cryptoclub_airdrop',
    'airdropbob',
    'freeairdropcoin',
    'airdropstastation',
    'drops_tab',
    'coinmarketcap_airdrop',
];

const ALL_CHANNELS = [
    ...NEWS_CHANNELS.map(c => ({ name: c, type: 'NEWS' })),
    ...AIRDROP_CHANNELS.map(c => ({ name: c, type: 'AIRDROP' })),
];

async function main() {
    console.log('\n=== OnlyAlpha — Channel Data Quality Check ===\n');

    if (!API_ID || !API_HASH || !SESSION) {
        console.error('Missing env vars.');
        process.exit(1);
    }

    const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
        connectionRetries: 3,
    });

    await client.connect();
    console.log('Connected to Telegram.\n');

    for (const ch of ALL_CHANNELS) {
        console.log('══════════════════════════════════════════════════');
        console.log(`📡 @${ch.name} (${ch.type})`);
        console.log('──────────────────────────────────────────────────');
        try {
            const msgs = await client.getMessages(ch.name, { limit: 5 });
            if (!msgs || msgs.length === 0) {
                console.log('   ⚠️  No messages found.\n');
                continue;
            }
            for (let i = 0; i < msgs.length; i++) {
                const msg = msgs[i];
                const text = (msg.message || '').slice(0, 300);
                const date = msg.date ? new Date(msg.date * 1000).toLocaleString() : 'N/A';
                console.log(`   📩 [${i + 1}] ${date}`);
                console.log(`      ${text}${text.length >= 300 ? '...' : ''}`);
                console.log('');
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.log(`   ❌ FAILED: ${errMsg}\n`);
        }
    }

    console.log('══════════════════════════════════════════════════');
    console.log('Done.\n');
    await client.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});

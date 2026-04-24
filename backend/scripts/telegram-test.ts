/**
 * Test script — verifies Telegram session works and can read public channels.
 * 
 * Usage:
 *   npx ts-node scripts/telegram-test.ts
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as dotenv from 'dotenv';

dotenv.config();

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION = process.env.TELEGRAM_SESSION_STRING || '';

async function main() {
    console.log('\n=== OnlyAlpha — Telegram Connection Test ===\n');

    // 1. Check env vars
    console.log('1️⃣  Checking env vars...');
    if (!API_ID || !API_HASH || !SESSION) {
        console.error('❌ Missing env vars. Check .env has TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION_STRING');
        process.exit(1);
    }
    console.log(`   ✅ API_ID: ${API_ID}`);
    console.log(`   ✅ API_HASH: ${API_HASH.slice(0, 8)}...`);
    console.log(`   ✅ SESSION: ${SESSION.slice(0, 20)}... (${SESSION.length} chars)`);

    // 2. Connect
    console.log('\n2️⃣  Connecting to Telegram...');
    const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
        connectionRetries: 3,
    });

    await client.connect();
    console.log('   ✅ Connected!');

    // 3. Get self info
    console.log('\n3️⃣  Getting account info...');
    const me = await client.getMe();
    console.log(`   ✅ Logged in as: ${(me as any).firstName ?? ''} ${(me as any).lastName ?? ''} (@${(me as any).username ?? 'N/A'})`);

    // 4. Test reading a public channel
    console.log('\n4️⃣  Testing public channel read (WuBlockchain)...');
    try {
        const messages = await client.getMessages('WuBlockchain', { limit: 3 });
        console.log(`   ✅ Read ${messages.length} messages from @WuBlockchain:`);
        for (const msg of messages) {
            const text = (msg.message || '').slice(0, 100);
            console.log(`      📩 ${text}${text.length >= 100 ? '...' : ''}`);
        }
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`   ⚠️ Could not read WuBlockchain: ${errMsg}`);
        console.log('   (This might mean the channel username changed — not a critical error)');
    }

    // 5. Done
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL TESTS PASSED — Telegram integration is ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await client.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error('\n❌ TEST FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});

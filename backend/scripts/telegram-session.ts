/**
 * One-time script to generate Telegram session string.
 * 
 * Usage:
 *   npx ts-node scripts/telegram-session.ts
 * 
 * It will ask for your phone number → send OTP to Telegram → you enter the code → it prints the session string.
 * Copy the session string and paste it in .env as TELEGRAM_SESSION_STRING=...
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';

const API_ID = 38263390;
const API_HASH = '44aee1638e7112a2d502a40b06085c8e';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function ask(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}

async function main() {
    console.log('\n=== OnlyAlpha — Telegram Session Generator ===\n');

    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, {
        connectionRetries: 3,
    });

    await client.start({
        phoneNumber: async () => await ask('📱 Enter your phone number (with country code, e.g. +201234567890): '),
        password: async () => await ask('🔑 Enter 2FA password (if you have one, otherwise press Enter): '),
        phoneCode: async () => await ask('📩 Enter the OTP code sent to your Telegram: '),
        onError: (err) => console.error('❌ Error:', err.message),
    });

    console.log('\n✅ Connected successfully!\n');

    const sessionString = client.session.save() as unknown as string;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Copy this ENTIRE string and paste it in your .env:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\nTELEGRAM_SESSION_STRING=${sessionString}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await client.disconnect();
    rl.close();
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    rl.close();
    process.exit(1);
});

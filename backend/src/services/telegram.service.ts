import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { createHash } from 'crypto';
import { env } from '../config/env';

const NEWS_CHANNELS: string[] = [
    'whale_alert_io',
    'cointelegraph',
];

const AIRDROP_CHANNELS: string[] = [
    'airdrops_io',
    'airdropofficial',
];

const SPAM_PATTERNS: RegExp[] = [
    /join.*group/i, /click.*link/i, /send.*dm/i,
    /guaranteed.*profit/i, /100x/i, /pump.*signal/i,
    /t\.me\/joinchat/i, /💰.*free.*money/i,
];

function isSpam(text: string): boolean {
    return SPAM_PATTERNS.some(p => p.test(text));
}

export interface TelegramNewsItem {
    title: string;
    source: string;
    sourceHash: string;
    link: string;
    publishedAt: Date;
    rawContent: string;
}

export interface TelegramAirdropItem {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet: string;
    source: string;
    content: string;
    hash: string;
}

async function createClient(): Promise<TelegramClient | null> {
    const apiId = parseInt(env.TELEGRAM_API_ID, 10);
    const apiHash = env.TELEGRAM_API_HASH;
    const sessionStr = env.TELEGRAM_SESSION_STRING;

    if (!apiId || !apiHash || !sessionStr) {
        console.warn('[Telegram] Missing credentials — Telegram source disabled');
        return null;
    }

    try {
        const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
            connectionRetries: 3,
        });
        await client.connect();
        return client;
    } catch (err) {
        console.error('[Telegram] Connection failed:', err instanceof Error ? err.message : String(err));
        return null;
    }
}

async function withClient<T>(fn: (client: TelegramClient) => Promise<T>): Promise<T | null> {
    const client = await createClient();
    if (!client) return null;
    try {
        return await fn(client);
    } finally {
        try {
            await client.disconnect();
        } catch {
        }
    }
}

export async function fetchNewsFromTelegram(minutesBack: number = 30): Promise<TelegramNewsItem[]> {
    const cutoff = new Date(Date.now() - minutesBack * 60 * 1000);

    const results = await withClient(async (client) => {
        const items: TelegramNewsItem[] = [];
        for (const channel of NEWS_CHANNELS) {
            try {
                const messages = await client.getMessages(channel, { limit: 10 });
                for (const msg of messages) {
                    if (!msg.message || msg.message.length < 20) continue;
                    const msgDate = new Date((msg.date ?? 0) * 1000);
                    if (msgDate < cutoff) continue;
                    if (isSpam(msg.message)) continue;

                    items.push({
                        title: msg.message.slice(0, 200),
                        source: `telegram:${channel}`,
                        sourceHash: createHash('sha256').update(msg.message).digest('hex'),
                        link: `https://t.me/${channel}/${msg.id}`,
                        publishedAt: msgDate,
                        rawContent: msg.message,
                    });
                }
            } catch (err) {
                console.error(`[Telegram] Error reading ${channel}:`, err instanceof Error ? err.message : String(err));
            }
        }
        return items;
    });

    console.log(`[Telegram] Fetched ${results?.length ?? 0} news items from ${NEWS_CHANNELS.length} channels`);
    return results ?? [];
}

export async function fetchAirdropsFromTelegram(hoursBack: number = 6): Promise<TelegramAirdropItem[]> {
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const results = await withClient(async (client) => {
        const items: TelegramAirdropItem[] = [];
        for (const channel of AIRDROP_CHANNELS) {
            try {
                const messages = await client.getMessages(channel, { limit: 15 });
                for (const msg of messages) {
                    if (!msg.message || msg.message.length < 30) continue;
                    const msgDate = new Date((msg.date ?? 0) * 1000);
                    if (msgDate < cutoff) continue;
                    if (isSpam(msg.message)) continue;

                    const hash = createHash('sha256').update(`${msg.message}||https://t.me/${channel}/${msg.id}`).digest('hex');
                    items.push({
                        title: msg.message.slice(0, 200),
                        link: `https://t.me/${channel}/${msg.id}`,
                        pubDate: msgDate.toISOString(),
                        contentSnippet: msg.message.slice(0, 300),
                        source: `telegram:${channel}`,
                        content: msg.message,
                        hash,
                    });
                }
            } catch (err) {
                console.error(`[Telegram] Error reading airdrop channel ${channel}:`, err instanceof Error ? err.message : String(err));
            }
        }
        return items;
    });

    console.log(`[Telegram] Fetched ${results?.length ?? 0} airdrop items from ${AIRDROP_CHANNELS.length} channels`);
    return results ?? [];
}

export async function disconnectTelegram(): Promise<void> {
}

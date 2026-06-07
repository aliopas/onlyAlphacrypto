import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { createHash } from 'crypto';
import { db } from '../config/db';
import { env } from '../config/env';
import { telegramPortfolioPosts, portfolioCoins } from '../models/scorecard.model';
import { eq, isNull, and } from 'drizzle-orm';
import { TRACKED_COIN_SET } from '../config/coins';
import { AIGateway } from './ai/ai-gateway';

const writerGateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 90000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    },
});

export interface VisionExtractionResult {
    symbol: string;
    entryPrice: number;
}

export interface VisionResponse {
    symbols: VisionExtractionResult[];
}

export interface ScraperResult {
    extracted: VisionExtractionResult[];
    totalProcessed: number;
    postsAnalyzed: number;
}

async function getTelegramClient(): Promise<TelegramClient | null> {
    const apiId = parseInt(env.TELEGRAM_API_ID, 10);
    const apiHash = env.TELEGRAM_API_HASH;
    const sessionStr = env.TELEGRAM_SESSION_STRING;

    if (!apiId || !apiHash || !sessionStr) {
        console.warn('[TelegramPortfolioScraper] Missing credentials');
        return null;
    }

    try {
        const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
            connectionRetries: 3,
        });
        await client.connect();
        return client;
    } catch (err) {
        console.error('[TelegramPortfolioScraper] Connection failed:', err instanceof Error ? err.message : String(err));
        return null;
    }
}

async function callVisionForSymbolExtraction(imageUrl: string): Promise<VisionResponse | null> {
    const visionPrompt = `You are analyzing a cryptocurrency tweet/post image.
Extract ONLY the cryptocurrency ticker symbols and their entry prices mentioned.
Return a JSON object with a "symbols" array. Each entry must have:
- "symbol": the coin ticker (e.g. "ARB", "OP", "INJ")
- "entryPrice": the price in USD at which the coin was mentioned

Rules:
- ONLY return symbol + entryPrice. No TP, no SL, no direction, no narrative.
- If the image shows multiple coins, extract all of them.
- Symbol must be a valid ticker (1-10 uppercase letters).
- entryPrice must be a number > 0.
- If you see ANY extra data beyond symbol and entryPrice (TP, SL, direction, thesis, etc.), still return only symbol+entryPrice.
- If no coin prices are found, return {"symbols": []}
- If the image is unclear or not a crypto-related post, return {"symbols": []}

Respond with ONLY the JSON object, no preamble.`;

    try {
        const raw = await writerGateway.chatRaw({
            model: env.WRITER_MODEL,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: visionPrompt,
                        },
                        {
                            type: 'image_url',
                            image_url: { url: imageUrl },
                        },
                    ],
                },
            ],
            temperature: 0.1,
            maxTokens: 512,
        });

        const parsed = JSON.parse(raw.trim()) as VisionResponse;
        return parsed;
    } catch (err) {
        console.error('[TelegramPortfolioScraper] Vision call failed:', err instanceof Error ? err.message : String(err));
        return null;
    }
}

function validateExtraction(extraction: VisionExtractionResult): boolean {
    if (!extraction.symbol || typeof extraction.symbol !== 'string') return false;
    const symbol = extraction.symbol.toUpperCase().trim();
    if (!/^[A-Z]{1,10}$/.test(symbol)) return false;
    if (typeof extraction.entryPrice !== 'number' || extraction.entryPrice <= 0) return false;
    return true;
}

export async function runScorecardScraper(): Promise<ScraperResult> {
    const client = await getTelegramClient();
    if (!client) {
        console.warn('[TelegramPortfolioScraper] No client — skipping');
        return { extracted: [], totalProcessed: 0, postsAnalyzed: 0 };
    }

    const channel = env.SCORECARD_TELEGRAM_CHANNEL;
    if (!channel) {
        console.warn('[TelegramPortfolioScraper] SCORECARD_TELEGRAM_CHANNEL not set');
        return { extracted: [], totalProcessed: 0, postsAnalyzed: 0 };
    }

    const maxCoins = env.SCORECARD_MAX_COINS;
    const extracted: VisionExtractionResult[] = [];
    let totalProcessed = 0;
    let postsAnalyzed = 0;
    let offsetId = 0;

    const existingSymbols = new Set<string>();
    const existingCoins = await db
        .select({ symbol: portfolioCoins.symbol })
        .from(portfolioCoins);
    for (const coin of existingCoins) {
        existingSymbols.add(coin.symbol.toUpperCase());
    }

    while (extracted.length < maxCoins) {
        const messages = await client.getMessages(channel, {
            limit: 5,
            offsetId,
        });

        if (messages.length === 0) break;

        for (const msg of messages) {
            if (extracted.length >= maxCoins) break;
            if (!msg.media) continue;
            if (!msg.id) continue;

            offsetId = msg.id;

            const messageHash = createHash('sha256')
                .update(`${channel}:${msg.id}`)
                .digest('hex');

            const [existingPost] = await db
                .select({ id: telegramPortfolioPosts.id })
                .from(telegramPortfolioPosts)
                .where(eq(telegramPortfolioPosts.messageId, String(msg.id)))
                .limit(1);

            if (existingPost) continue;

            const hasImage =
                'photo' in msg.media ||
                'webPreview' in msg.media ||
                'document' in msg.media;

            let imageUrl: string | null = null;
            if (hasImage) {
                try {
                    const media = msg.media as unknown as Record<string, unknown>;
                    if (media.photo) {
                        imageUrl = `https://t.me/${channel}/${msg.id}`;
                    } else if (media.webPreview) {
                        const webPreview = media.webPreview as { url?: string };
                        imageUrl = webPreview.url ?? null;
                    }
                } catch {
                    imageUrl = null;
                }
            }

            let postSymbols: string[] = [];
            let analyzed = false;

            if (imageUrl) {
                const visionResult = await callVisionForSymbolExtraction(imageUrl);
                if (visionResult && visionResult.symbols && Array.isArray(visionResult.symbols)) {
                    for (const item of visionResult.symbols) {
                        if (!validateExtraction(item)) continue;
                        const symbol = item.symbol.toUpperCase().trim();
                        if (TRACKED_COIN_SET.has(symbol)) continue;
                        if (existingSymbols.has(symbol)) continue;
                        if (extracted.some(e => e.symbol === symbol)) continue;

                        extracted.push({ symbol, entryPrice: item.entryPrice });
                        existingSymbols.add(symbol);
                        postSymbols.push(symbol);
                    }
                    analyzed = true;
                }
            }

            const contentText = typeof msg.message === 'string' ? msg.message : null;

            await db.insert(telegramPortfolioPosts).values({
                messageId: String(msg.id),
                content: contentText,
                imageUrl: imageUrl ?? null,
                isAnalyzed: analyzed,
                extractedSymbols: postSymbols.length > 0 ? postSymbols.join(',') : null,
                analyzedAt: analyzed ? new Date() : null,
            });

            postsAnalyzed++;
        }
    }

    await client.disconnect();

    return { extracted, totalProcessed, postsAnalyzed };
}
import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../config/env';
import { CacheManager } from './ai/cache-manager';
import { AIGateway } from './ai/ai-gateway';
import { PromptFactory, DeepAnalysisInput } from './ai/prompt-factory';
import { coinMasterArticles } from '../models/market.model';

// Define interfaces locally to avoid circular imports

export interface AirdropValidationResult {
    isLegitimate: boolean;
    riskVerdict: 'LOW' | 'MEDIUM' | 'HIGH' | 'SCAM';
    tasks: Array<{
        description: string;
        contractAddress?: string;
        minAmount?: number;
        tokenSymbol?: string;
        chain?: string;
        isAutoVerifiable: boolean;
    }>;
    estValue: string;
    aiReport: string;
}



export interface DeepAnalysisResult {
    sentiment: 'bullish' | 'bearish' | 'neutral';
    impactScore: number;
    isBreaking: boolean;
    coinSymbol: string;
    eventType: string;
    eventSeverity: number;
    analysis: {
        mainDriver: string;
        priceImplication: string;
        temporalContext: string | null;
        riskNote: string;
    };
    keyFacts: string[];
    supportLevels: number[];
    resistanceLevels: number[];
    signalText: string;
    verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    confidenceScore: number;
}

export interface ArticleWriterResult {
    headline: string;
    hook: string;
    fullArticle: string;
    metaTitle: string;
    metaDescription: string;
    seoKeywords: string[];
}

const ArticleSchema = z.object({
    headline: z.string().max(120),
    hook: z.string(),
    fullArticle: z.string().min(1500),
    metaTitle: z.string().max(60),
    metaDescription: z.string().max(160),
    seoKeywords: z.array(z.string()).min(3).max(7),
});

// Instantiate the modular components
const cache = new CacheManager();

// OpenRouter gateway (fallback)
const gateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 90000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    }
});

// DeepSeek Direct gateway (primary for analysis)
const deepseekGateway = env.DEEPSEEK_API_KEY ? new AIGateway({
    apiKey: env.DEEPSEEK_API_KEY,
    baseURL: env.DEEPSEEK_BASE_URL,
    timeoutMs: 90000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    }
}) : null;

const prompts = new PromptFactory();



// ─── Lightweight Triage Function (Phase 1B) ───────────────────────────────────
/**
 * Generate lightweight triage scores for news batches
 * Uses cheap/fast model (GPT-5-nano equivalent) to score relevance (0-100)
 */
interface TriageResult {
    title: string;
    source?: string;
    relevanceScore: number;
    sentimentHint: string | null;
    symbolMentions: string[];
    eventType: string;
    eventSeverity: number;
    classification: 'MAJOR' | 'MINOR' | 'NOISE';
}

export async function generateLightweightTriage(
    newsBatch: Array<{ title: string; source?: string }>
): Promise<TriageResult[]> {
    // Check cache first
    const cacheKey = cache.generateKey('lightweightTriage', newsBatch);
    const cached = cache.get<TriageResult[]>(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        const messages = prompts.buildTriageMessages(newsBatch);
        // Use DeepSeek Direct for triage if available, otherwise fallback to OpenRouter
        const targetGateway = deepseekGateway || gateway;
        const targetModel = deepseekGateway ? env.DEEPSEEK_MODEL_DIRECT : env.SEO_MODEL;

        const parsed = await targetGateway.chat<{
            results?: Array<{
                relevanceScore: number;
                sentimentHint: string | null;
                symbolMentions?: string[];
                eventType?: string;
                eventSeverity?: number;
                classification?: string;
            }>;
            triageScores?: Array<{
                relevanceScore: number;
                sentimentHint: string | null;
                symbolMentions?: string[];
                eventType?: string;
                eventSeverity?: number;
                classification?: string;
            }>;
        }>({
            model: targetModel,
            temperature: 0.2, // Low temperature for consistent scoring
            responseFormat: { type: 'json_object' },
            messages
        });

        // Handle both array format and object format
        const resultsArray = Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> :
            (parsed.results || parsed.triageScores || []);

        // Map results back to original news items
        const triagedNews: TriageResult[] = newsBatch.map((item, index) => {
            const scoreObj = resultsArray[index] || {};
            return {
                ...item,
                relevanceScore: Math.max(0, Math.min(100, Number(scoreObj.relevanceScore) || 50)),
                sentimentHint: scoreObj.sentimentHint !== undefined && scoreObj.sentimentHint !== null ? String(scoreObj.sentimentHint) : null,
                symbolMentions: Array.isArray(scoreObj.symbolMentions)
                    ? scoreObj.symbolMentions.map((s: string) => s.toUpperCase())
                    : [],
                eventType: typeof scoreObj.eventType === 'string' ? scoreObj.eventType : 'Other',
                eventSeverity: typeof scoreObj.eventSeverity === 'number'
                    ? Math.max(1, Math.min(3, Math.round(scoreObj.eventSeverity)))
                    : 1,
                classification: (typeof scoreObj.classification === 'string' &&
                    ['MAJOR', 'MINOR', 'NOISE'].includes(scoreObj.classification))
                    ? scoreObj.classification as 'MAJOR' | 'MINOR' | 'NOISE'
                    : 'MINOR' as const,
            };
        });

        // Store in cache
        cache.set(cacheKey, triagedNews);
        return triagedNews;
    } catch (error) {
        console.error('[OpenAI Service] Error in lightweight triage:', error);
        // Fallback: return neutral scores for all items
        const fallbackResults: TriageResult[] = newsBatch.map(item => ({
            ...item,
            relevanceScore: 50, // Neutral score
            sentimentHint: null,
            symbolMentions: [],
            eventType: 'Other',
            eventSeverity: 1,
            classification: 'MINOR' as const,
        }));

        // Cache fallback results briefly (5 minutes) to prevent repeated failures on same batch
        const fallbackCacheKey = cache.generateKey('lightweightTriage_fallback', newsBatch);
        cache.set(fallbackCacheKey, fallbackResults);
        // Note: We're not setting a shorter TTL here as the CacheManager doesn't support per-entry TTL
        // In a production app, we might want to enhance CacheManager to support this

        return fallbackResults;
    }
}



// ─── Dual News Output: 2-Step Pipeline ───────────────────────────────────────
// Step 1: DeepSeek-R1 analyzes the raw news and extracts structured data
// Step 2: GPT-5-nano formats the analysis into SEO-optimized article output



// ─── Airdrop Validation (DeepSeek-R1 — deep analysis) ──────────────────────────────

export async function validateAirdrop(
    projectData: string
): Promise<AirdropValidationResult> {
    // Check cache first
    const cacheKey = cache.generateKey('airdropValidation', projectData);
    const cached = cache.get<AirdropValidationResult>(cacheKey);
    if (cached) {
        return cached;
    }

    const messages = prompts.buildAirdropValidationMessages(projectData);
    const result = await gateway.chat<AirdropValidationResult>({
        model: env.DEEPSEEK_MODEL, // DeepSeek-R1
        temperature: 0.2,
        responseFormat: { type: 'json_object' },
        messages
    });

    // Store in cache
    cache.set(cacheKey, result);
    return result;
}

export async function callDeepSeekAnalysis(input: DeepAnalysisInput, attempt: number = 1): Promise<DeepAnalysisResult> {
    const MAX_ATTEMPTS = 3;

    try {
        const messages = prompts.buildDeepAnalysisMessages(input);
        // Use DeepSeek Direct if available, otherwise fallback to OpenRouter
        const targetGateway = deepseekGateway || gateway;
        const targetModel = deepseekGateway ? env.DEEPSEEK_MODEL_DIRECT : env.DEEPSEEK_MODEL;

        const result = await targetGateway.chat<DeepAnalysisResult>({
            model: targetModel,
            temperature: 0.2,
            responseFormat: { type: 'json_object' },
            messages,
        });
        if (typeof result.analysis?.temporalContext === 'string' && result.analysis.temporalContext === 'null') {
            result.analysis.temporalContext = null;
        }
        return result;
    } catch (error) {
        if (attempt < MAX_ATTEMPTS) {
            console.warn(`callDeepSeekAnalysis failed (attempt ${attempt}/${MAX_ATTEMPTS}), retrying...`, error);
            return callDeepSeekAnalysis(input, attempt + 1);
        }
        throw error;
    }
}

export async function callGptNanoWriter(analysisJson: string, tone?: string, attempt: number = 1): Promise<ArticleWriterResult> {
    const MAX_ATTEMPTS = 3;

    const messages = prompts.buildArticleWriterMessages(analysisJson, tone);
    const raw = await gateway.chatRaw({
        model: env.SEO_MODEL,
        temperature: 0.5,
        responseFormat: { type: 'json_object' },
        messages,
    });

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.warn(`[GPT-nano] JSON parse failed (attempt ${attempt}). Raw: ${raw.slice(0, 200)}`);
        if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, tone, attempt + 1);
        throw new Error('GPT-nano returned invalid JSON after 3 attempts');
    }

    const result = ArticleSchema.safeParse(parsed);
    if (!result.success) {
        console.warn(`[GPT-nano] Schema validation failed (attempt ${attempt}):`, result.error.issues);
        if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, tone, attempt + 1);
        throw new Error('GPT-nano response failed schema validation after 3 attempts');
    }

    return result.data;
}

// ─── AI Chat Stream (GPT-5-nano — SEO optimized, user-facing) ────────────────

export async function streamChatResponse(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    coinContext: { symbol: string; price: number; newsSummary: string },
    mode?: 'general' | 'context'
): Promise<AsyncIterable<OpenAI.ChatCompletionChunk>> {
    const chatMessages = prompts.buildChatMessages(messages, coinContext, mode);
    return gateway.chatStream({
        model: env.CHAT_MODEL,
        temperature: 0.6,
        messages: chatMessages
    });
}

export async function callGptNanoMinorUpdate(newsTitle: string, existingHeadline: string): Promise<string> {
    const messages = [
        {
            role: 'system' as const,
            content: 'You are a crypto news update writer. Write factual, concise updates.'
        },
        {
            role: 'user' as const,
            content: `Given this new development: ${newsTitle}, in context of the existing story: ${existingHeadline}, write a concise 1-2 paragraph timeline update. Factual, no filler.`
        }
    ];

    const raw = await gateway.chatRaw({
        model: env.SEO_MODEL,
        temperature: 0.3,
        messages,
    });

    return raw.trim();
}

export async function callGptNanoMasterUpdate(analysisResult: DeepAnalysisResult, existingArticle: Record<string, unknown>): Promise<Partial<typeof coinMasterArticles.$inferInsert>> {
    const sections = [
        'coreCatalyst',
        'marketContext',
        'strategicImpact',
        'historicalContext',
        'technicalLevels',
        'riskAssessment',
        'bottomLine'
    ];

    const existingSections = sections.map(section => `${section}: ${existingArticle[section] || 'N/A'}`).join('\n\n');

    const messages = [
        {
            role: 'system' as const,
            content: 'You are a crypto article updater. Output ONLY JSON with updated sections.'
        },
        {
            role: 'user' as const,
            content: `Update the following living article sections based on this new analysis: ${JSON.stringify(analysisResult)}\n\nExisting sections:\n${existingSections}\n\nOutput ONLY the sections that need updating as JSON.`
        }
    ];

    const raw = await gateway.chatRaw({
        model: env.SEO_MODEL,
        temperature: 0.3,
        responseFormat: { type: 'json_object' },
        messages,
    });

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.warn('[callGptNanoMasterUpdate] JSON parse failed. Raw:', raw.slice(0, 200));
        return {};
    }

    if (typeof parsed !== 'object' || parsed === null) return {};

    const ALLOWED_SECTIONS = [
        'coreCatalyst', 'marketContext', 'strategicImpact',
        'historicalContext', 'technicalLevels', 'riskAssessment', 'bottomLine',
        'headline', 'hook', 'metaTitle', 'metaDescription', 'seoKeywords',
        'sentiment', 'verdict', 'confidenceScore', 'riskTags',
    ];
    const filtered: Record<string, unknown> = {};
    const parsedObj = parsed as Record<string, unknown>;
    for (const key of Object.keys(parsedObj)) {
        if (ALLOWED_SECTIONS.includes(key)) {
            filtered[key] = parsedObj[key];
        }
    }
    return filtered;
}

export function extractSection(fullArticle: string, sectionTag: string): string | null {
    const regex = new RegExp(`\\[(${sectionTag}\\??)\\]([\\s\\S]*?)(?=\\[|$)`, 'i');
    const match = fullArticle.match(regex);
    return match ? match[2].trim() : null;
}

export { gateway };
export { deepseekGateway };
export { prompts };
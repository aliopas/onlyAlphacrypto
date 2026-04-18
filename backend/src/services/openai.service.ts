import OpenAI from 'openai';
type ChatCompletionMessageParam = OpenAI.ChatCompletionMessageParam;
import { z } from 'zod';
import { env } from '../config/env';
import { CacheManager } from './ai/cache-manager';
import { AIGateway, AITruncationError, LONG_RESPONSE_MAX_TOKENS } from './ai/ai-gateway';
import { PromptFactory, DeepAnalysisInput, MasterUpdateInput, MinorUpdateInput } from './ai/prompt-factory';
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

export interface ArticleStage2AResult {
    headline: string;
    hook: string;
    metaTitle: string;
    metaDescription: string;
    seoKeywords: string[];
    sections: {
        HOOK: string;
        'WHAT HAPPENED': string;
        'WHY IT MATTERS': string;
        'HISTORY REPEATS?': string;
    };
}

export interface ArticleStage2BResult {
    sections: {
        'PRICE PICTURE': string;
        'RISK CHECK': string;
        'BOTTOM LINE': string;
    };
}

export interface Stage2AContext {
    headline: string;
    hook: string;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    verdict: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
}

const REQUIRED_SECTION_TAGS = [
    '[HOOK]',
    '[WHAT HAPPENED]',
    '[WHY IT MATTERS]',
    '[HISTORY REPEATS?]',
    '[PRICE PICTURE]',
    '[RISK CHECK]',
    '[BOTTOM LINE]',
] as const;

function validateSectionTags(fullArticle: string): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const tag of REQUIRED_SECTION_TAGS) {
        if (!fullArticle.includes(tag)) {
            missing.push(tag);
        }
    }
    return { valid: missing.length === 0, missing };
}

function stripSectionTags(text: string): string {
    return text.replace(/\[\w+(?:\s+\w+)*\??\]/g, '').trim();
}

function truncateMetaField(value: unknown, maxLength: number): unknown {
    if (typeof value === 'string') {
        return value.length > maxLength ? value.slice(0, maxLength).trim() : value;
    }
    return value;
}

const ArticleSchema = z.object({
    headline: z.string().max(120),
    hook: z.string().min(20),
    fullArticle: z.string().min(3500),
    metaTitle: z.string().max(60),
    metaDescription: z.string().max(160),
    seoKeywords: z.array(z.string()).min(3).max(7),
});

const Stage2ASchema = z.object({
    headline: z.string().max(120),
    hook: z.string().min(20),
    metaTitle: z.string().max(60),
    metaDescription: z.string().max(160),
    seoKeywords: z.array(z.string()).min(3).max(7),
    sections: z.object({
        HOOK: z.string().min(100),
        'WHAT HAPPENED': z.string().min(100),
        'WHY IT MATTERS': z.string().min(100),
        'HISTORY REPEATS?': z.string().min(100),
    }),
});

const Stage2BSchema = z.object({
    sections: z.object({
        'PRICE PICTURE': z.string().min(100),
        'RISK CHECK': z.string().min(100),
        'BOTTOM LINE': z.string().min(80),
    }),
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

// Writer gateway — always OpenRouter (Gemini 2.5 Flash or any writer model)
const writerGateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 120000,
    defaultHeaders: { 'HTTP-Referer': 'https://onlyalpha.app', 'X-Title': 'OnlyAlpha' }
});

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
        cache.set(fallbackCacheKey, fallbackResults, 300000); // 5 minutes TTL

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

/** @deprecated Use callWriterStage2A + callWriterStage2B + mergeArticleStages instead */
export async function callGptNanoWriter(analysisJson: string, tone?: string, attempt: number = 1): Promise<ArticleWriterResult> {
    const MAX_ATTEMPTS = 3;

    const messages = prompts.buildArticleWriterMessages(analysisJson, tone);

    let raw: string;
    try {
        raw = await writerGateway.chatRaw({
            model: env.WRITER_MODEL,
            temperature: 0.5,
            responseFormat: { type: 'json_object' },
            messages,
            maxTokens: LONG_RESPONSE_MAX_TOKENS,
        });
    } catch (error) {
        if (error instanceof AITruncationError) {
            console.warn(`[GPT-nano] Response truncated (attempt ${attempt}/${MAX_ATTEMPTS}) for model "${error.model}" — retrying with fallback.`);
            if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, tone, attempt + 1);
            console.warn('[GPT-nano] All retries exhausted due to truncation — generating fallback article.');
            return buildFallbackArticle(analysisJson);
        }
        throw error;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.warn(`[GPT-nano] JSON parse failed (attempt ${attempt}). Raw: ${raw.slice(0, 200)}`);
        if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, tone, attempt + 1);
        throw new Error('GPT-nano returned invalid JSON after 3 attempts');
    }

    if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        obj.metaTitle = truncateMetaField(obj.metaTitle, 60);
        obj.metaDescription = truncateMetaField(obj.metaDescription, 160);
    }

    const result = ArticleSchema.safeParse(parsed);
    if (!result.success) {
        console.warn(`[GPT-nano] Schema validation failed (attempt ${attempt}):`, result.error.issues);
        const isOnlyLengthIssue = result.error.issues.every(
            issue => issue.code === 'too_small' && (issue.path as string[]).includes('fullArticle')
        );
        if (isOnlyLengthIssue && typeof (parsed as Record<string, unknown>)?.fullArticle === 'string') {
            const partial = parsed as Record<string, unknown>;
            console.warn('[GPT-nano] Length-only failure — publishing partial article with fallback padding.');
            const tagCheck = validateSectionTags(String(partial.fullArticle));
            if (tagCheck.valid || tagCheck.missing.length <= 5) {
                const existingArticle = String(partial.fullArticle);
                const missingSections = tagCheck.missing;
                const appendedSections = missingSections.map(tag => {
                    return `${tag} Additional analysis pending. See the full breakdown in the living article for this coin.`;
                }).join('\n\n');
                const fullArticle = existingArticle + '\n\n' + appendedSections;
                return {
                    headline: typeof partial.headline === 'string' ? partial.headline : 'Market Analysis Update',
                    hook: typeof partial.hook === 'string' ? partial.hook : 'Analysis in progress.',
                    fullArticle,
                    metaTitle: typeof partial.metaTitle === 'string' ? partial.metaTitle : 'Analysis | OnlyAlpha',
                    metaDescription: typeof partial.metaDescription === 'string' ? partial.metaDescription : 'Read the analysis on OnlyAlpha.',
                    seoKeywords: Array.isArray(partial.seoKeywords) ? partial.seoKeywords as string[] : ['crypto', 'market'],
                };
            }
        }
        if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, tone, attempt + 1);
        console.warn('[GPT-nano] All retries exhausted — generating raw fallback article from analysis JSON.');
        return buildFallbackArticle(analysisJson);
    }

    const tagCheck = validateSectionTags(result.data.fullArticle);
    if (!tagCheck.valid) {
        console.warn(`[GPT-nano] Missing section tags (attempt ${attempt}/${MAX_ATTEMPTS}): ${tagCheck.missing.join(', ')}`);
        if (attempt < MAX_ATTEMPTS) return callGptNanoWriter(analysisJson, tone, attempt + 1);
        console.warn(`[GPT-nano] All retries exhausted — generating fallback article (missing: ${tagCheck.missing.join(', ')})`);
        return buildFallbackArticle(analysisJson);
    }

    return result.data;
}

export async function callWriterStage2A(analysisJson: string, tone: string, attempt: number = 1): Promise<ArticleStage2AResult | null> {
    const MAX_ATTEMPTS = 3;

    const messages = prompts.buildArticleStage2AMessages(analysisJson, tone);
    const messageArray: ChatCompletionMessageParam[] = [
        { role: 'system', content: messages.system },
        { role: 'user', content: messages.user }
    ];

    let raw: string;
    try {
        raw = await writerGateway.chatRaw({
            model: env.WRITER_MODEL,
            temperature: 0.5,
            responseFormat: { type: 'json_object' },
            messages: messageArray,
            maxTokens: LONG_RESPONSE_MAX_TOKENS,
        });
    } catch (error) {
        if (error instanceof AITruncationError) {
            console.warn(`[Stage2A] Response truncated (attempt ${attempt}/${MAX_ATTEMPTS}) for model "${error.model}" — retrying with fallback.`);
            if (attempt < MAX_ATTEMPTS) return callWriterStage2A(analysisJson, tone, attempt + 1);
            console.warn('[Stage2A] All retries exhausted due to truncation — returning null.');
            return null;
        }
        if (attempt < MAX_ATTEMPTS) {
            console.warn(`[Stage2A] Gateway error (attempt ${attempt}/${MAX_ATTEMPTS}), retrying...`, error);
            return callWriterStage2A(analysisJson, tone, attempt + 1);
        }
        console.warn('[Stage2A] All retries exhausted — returning null.');
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.warn(`[Stage2A] JSON parse failed (attempt ${attempt}). Raw: ${raw.slice(0, 200)}`);
        if (attempt < MAX_ATTEMPTS) return callWriterStage2A(analysisJson, tone, attempt + 1);
        console.warn('[Stage2A] All retries exhausted — returning null.');
        return null;
    }

    if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        obj.metaTitle = truncateMetaField(obj.metaTitle, 60);
        obj.metaDescription = truncateMetaField(obj.metaDescription, 160);
    }

    const result = Stage2ASchema.safeParse(parsed);
    if (!result.success) {
        console.warn(`[Stage2A] Schema validation failed (attempt ${attempt}):`, result.error.issues);
        if (attempt < MAX_ATTEMPTS) return callWriterStage2A(analysisJson, tone, attempt + 1);
        console.warn('[Stage2A] All retries exhausted — returning null.');
        return null;
    }

    return result.data;
}

export async function callWriterStage2B(analysisJson: string, stage2AContext: Stage2AContext, tone: string, attempt: number = 1): Promise<ArticleStage2BResult | null> {
    const MAX_ATTEMPTS = 3;

    const messages = prompts.buildArticleStage2BMessages(analysisJson, stage2AContext, tone);
    const messageArray: ChatCompletionMessageParam[] = [
        { role: 'system', content: messages.system },
        { role: 'user', content: messages.user }
    ];

    let raw: string;
    try {
        raw = await writerGateway.chatRaw({
            model: env.WRITER_MODEL,
            temperature: 0.5,
            responseFormat: { type: 'json_object' },
            messages: messageArray,
            maxTokens: LONG_RESPONSE_MAX_TOKENS,
        });
    } catch (error) {
        if (error instanceof AITruncationError) {
            console.warn(`[Stage2B] Response truncated (attempt ${attempt}/${MAX_ATTEMPTS}) for model "${error.model}" — retrying with fallback.`);
            if (attempt < MAX_ATTEMPTS) return callWriterStage2B(analysisJson, stage2AContext, tone, attempt + 1);
            console.warn('[Stage2B] All retries exhausted due to truncation — returning null.');
            return null;
        }
        if (attempt < MAX_ATTEMPTS) {
            console.warn(`[Stage2B] Gateway error (attempt ${attempt}/${MAX_ATTEMPTS}), retrying...`, error);
            return callWriterStage2B(analysisJson, stage2AContext, tone, attempt + 1);
        }
        console.warn('[Stage2B] All retries exhausted — returning null.');
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        console.warn(`[Stage2B] JSON parse failed (attempt ${attempt}). Raw: ${raw.slice(0, 200)}`);
        if (attempt < MAX_ATTEMPTS) return callWriterStage2B(analysisJson, stage2AContext, tone, attempt + 1);
        console.warn('[Stage2B] All retries exhausted — returning null.');
        return null;
    }

    const result = Stage2BSchema.safeParse(parsed);
    if (!result.success) {
        console.warn(`[Stage2B] Schema validation failed (attempt ${attempt}):`, result.error.issues);
        if (attempt < MAX_ATTEMPTS) return callWriterStage2B(analysisJson, stage2AContext, tone, attempt + 1);
        console.warn('[Stage2B] All retries exhausted — returning null.');
        return null;
    }

    return result.data;
}

export function mergeArticleStages(stage2A: ArticleStage2AResult, stage2B: ArticleStage2BResult | null): ArticleWriterResult {
    const sections = {
        ...stage2A.sections,
        ...(stage2B ? stage2B.sections : {
            'PRICE PICTURE': null,
            'RISK CHECK': null,
            'BOTTOM LINE': null,
        }),
    };

    const fullArticle = [
        '[HOOK]',
        sections.HOOK,
        '[WHAT HAPPENED]',
        sections['WHAT HAPPENED'],
        '[WHY IT MATTERS]',
        sections['WHY IT MATTERS'],
        '[HISTORY REPEATS?]',
        sections['HISTORY REPEATS?'],
        '[PRICE PICTURE]',
        sections['PRICE PICTURE'],
        '[RISK CHECK]',
        sections['RISK CHECK'],
        '[BOTTOM LINE]',
        sections['BOTTOM LINE'],
    ].join('\n\n');

    return {
        headline: stage2A.headline,
        hook: stage2A.hook,
        fullArticle,
        metaTitle: stage2A.metaTitle,
        metaDescription: stage2A.metaDescription,
        seoKeywords: stage2A.seoKeywords,
    };
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
    const messages = prompts.buildMinorUpdateMessages({ newsTitle, existingHeadline });

    const raw = await gateway.chatRaw({
        model: env.SEO_MODEL,
        temperature: 0.3,
        messages,
    });

    return stripSectionTags(raw.trim());
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

    const nullSections = sections.filter(s => !existingArticle[s] || String(existingArticle[s]).length < 50);
    const existingSections = sections.map(section => `${section}: ${existingArticle[section] || 'N/A'}`).join('\n\n');
    const sectionDirective = nullSections.length > 0
        ? `\n\nIMPORTANT: The following sections are currently empty and MUST be generated: ${nullSections.join(', ')}. Do NOT skip them.`
        : '';

    const messages = prompts.buildMasterUpdateMessages({
        analysisResult,
        existingSections,
        sectionDirective
    });

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
    filtered.metaTitle = truncateMetaField(filtered.metaTitle, 60);
    filtered.metaDescription = truncateMetaField(filtered.metaDescription, 160);
    return filtered;
}

function buildFallbackArticle(analysisJson: string): ArticleWriterResult {
    let analysis: Record<string, unknown> = {};
    try {
        analysis = JSON.parse(analysisJson);
    } catch {
        analysis = { analysis: { mainDriver: analysisJson.slice(0, 200) } };
    }
    const a = analysis.analysis as Record<string, unknown> | undefined;
    const verdict = String(analysis.verdict || 'NEUTRAL');
    const confidence = Number(analysis.confidenceScore) || 50;
    const coin = String(analysis.coinSymbol || 'CRYPTO');
    const sentiment = String(analysis.sentiment || 'neutral');
    const keyFacts = Array.isArray(analysis.keyFacts) ? analysis.keyFacts as string[] : [];
    const supports = Array.isArray(analysis.supportLevels) ? analysis.supportLevels as number[] : [];
    const resists = Array.isArray(analysis.resistanceLevels) ? analysis.resistanceLevels as number[] : [];

    const fullArticle = [
        `[HOOK] ${String(a?.mainDriver || 'Market analysis update')} for ${coin}. Data indicates a ${sentiment} outlook with ${confidence}% confidence.`,
        `[WHAT HAPPENED] ${keyFacts.length > 0 ? keyFacts.join('. ') : 'Multiple market factors are currently influencing ' + coin + ' price action.'} The current analysis reflects the latest available data.`,
        `[WHY IT MATTERS] ${String(a?.priceImplication || 'This development has significant implications for ' + coin + ' traders and investors.')} Market participants should monitor the situation closely for further developments.`,
        `[HISTORY REPEATS?] ${String(a?.temporalContext || 'Historical patterns for ' + coin + ' suggest monitoring similar past events for potential price trajectories.')}`,
        `[PRICE PICTURE] ${supports.length > 0 ? 'Key support levels at ' + supports.join(', ') + '.' : ''} ${resists.length > 0 ? 'Resistance levels at ' + resists.join(', ') + '.' : ''} Current sentiment reads ${sentiment}.`,
        `[RISK CHECK] ${String(a?.riskNote || 'Standard risk management practices are advised.')} Always consider position sizing and stop-loss strategies in volatile market conditions.`,
        `[BOTTOM LINE] Analysis rates this as ${verdict} with ${confidence}% confidence. ${String(a?.mainDriver || 'Monitor the situation for updates.')}`,
    ].join('\n\n');

    return {
        headline: `${coin} Market Analysis — ${sentiment.toUpperCase()} Signal Detected`,
        hook: `${coin} is showing ${sentiment} signals with a ${verdict} rating at ${confidence}% confidence.`,
        fullArticle,
        metaTitle: `${coin} Analysis | OnlyAlpha`,
        metaDescription: `${coin} market analysis: ${verdict} at ${confidence}% confidence. Read the analysis on OnlyAlpha.`,
        seoKeywords: [coin.toLowerCase(), coin.toLowerCase() + '-price', 'market-analysis', sentiment, 'crypto'],
    };
}

export function extractSection(fullArticle: string, sectionTag: string): string | null {
    const regex = new RegExp(`\\[(${sectionTag}\\??)\\]([\\s\\S]*?)(?=\\[|$)`, 'i');
    const match = fullArticle.match(regex);
    return match ? match[2].trim() : null;
}

export { gateway };
export { deepseekGateway };
export { prompts };
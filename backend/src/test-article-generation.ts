import { z } from 'zod';
import { env } from './config/env';
import { AIGateway, LONG_RESPONSE_MAX_TOKENS } from './services/ai/ai-gateway';
import { PromptFactory } from './services/ai/prompt-factory';
import { extractSection } from './services/openai.service';

// ─── EXACT SAME VALIDATION SCHEMAS FROM PRODUCTION CODE ────────────────────────

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
        HOOK: z.string().min(200),
        'WHAT HAPPENED': z.string().min(200),
        'WHY IT MATTERS': z.string().min(200),
        'HISTORY REPEATS?': z.string().min(200),
    }),
});

const Stage2BSchema = z.object({
    sections: z.object({
        'PRICE PICTURE': z.string().min(200),
        'RISK CHECK': z.string().min(200),
        'BOTTOM LINE': z.string().min(150),
    }),
});

// ─── GATEWAYS ─────────────────────────────────────────────────────────────────

const nanoGateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 120000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    }
});

const deepseekGateway = env.DEEPSEEK_API_KEY ? new AIGateway({
    apiKey: env.DEEPSEEK_API_KEY,
    baseURL: env.DEEPSEEK_BASE_URL,
    timeoutMs: 120000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    }
}) : null;

const prompts = new PromptFactory();

// ─── FAKE ANALYSIS INPUT (realistic BTC ETF scenario) ─────────────────────────

const MOCK_ANALYSIS = {
    sentiment: 'bullish',
    impactScore: 88,
    isBreaking: true,
    coinSymbol: 'BTC',
    eventType: 'ETF',
    eventSeverity: 3,
    analysis: {
        mainDriver: 'BlackRock Bitcoin ETF records $2.4B single-day inflow, surpassing all previous records since January 2024 launch, signaling unprecedented institutional demand for Bitcoin exposure.',
        priceImplication: 'Such massive institutional accumulation typically precedes a supply squeeze. With daily mining output at ~900 BTC and ETF inflows exceeding 38,000 BTC in a single day, the demand-to-supply ratio has reached historic extremes, suggesting upward price pressure in the near term.',
        temporalContext: 'Previous comparable institutional accumulation events occurred in Q4 2020 when MicroStrategy accumulated 40,000 BTC over multiple weeks, preceding a 300% rally from $16,000 to $64,000. The current single-day inflow exceeds that entire 6-week accumulation by volume.',
        riskNote: 'The primary risk is a reversal of institutional sentiment due to macroeconomic factors such as Fed rate decisions, CPI data releases, or geopolitical tensions. Additionally, historical ETF inflow spikes have occasionally preceded short-term corrections of 15-25% before the underlying trend resumes.',
    },
    keyFacts: [
        'BlackRock iShares Bitcoin Trust (IBIT) recorded $2.4B in single-day net inflows',
        'Total Bitcoin ETF daily inflows across all issuers exceeded $3.1B',
        'BTC price surged 8.3% within 24 hours of the inflow announcement',
        'Trading volume on Binance reached $48.2B, the highest since March 2024',
        'Grayscale GBTC saw $340M in outflows, continuing its conversion trend',
        'Fidelity FBTC recorded $620M in inflows, second highest after BlackRock',
    ],
    supportLevels: [82400, 79800, 76500],
    resistanceLevels: [91200, 95800, 105000],
    signalText: 'INSTITUTIONAL ACCUMULATION ALERT: BlackRock BTC ETF records $2.4B daily inflow — unprecedented institutional demand signal.',
    verdict: 'STRONG_BUY',
    confidenceScore: 82,
};

const analysisJson = JSON.stringify(MOCK_ANALYSIS);
const tone = 'exciting';

// ─── SECTION EXTRACTION ───────────────────────────────────────────────────────

const SECTION_TAG_MAP = {
    coreCatalyst: 'HOOK',
    marketContext: 'WHAT HAPPENED',
    strategicImpact: 'WHY IT MATTERS',
    historicalContext: 'HISTORY REPEATS?',
    technicalLevels: 'PRICE PICTURE',
    riskAssessment: 'RISK CHECK',
    bottomLine: 'BOTTOM LINE',
} as const;

function extractAndMeasure(fullArticle: string) {
    const results: Record<string, { content: string | null; chars: number; pass: boolean }> = {};
    for (const [col, tag] of Object.entries(SECTION_TAG_MAP)) {
        const content = extractSection(fullArticle, tag);
        const chars = content ? content.length : 0;
        const minChars = tag === 'BOTTOM LINE' ? 150 : 200;
        results[col] = { content, chars, pass: chars >= minChars };
    }
    return results;
}

// ─── TEST RUNNERS ─────────────────────────────────────────────────────────────

interface TestResult {
    model: string;
    path: string;
    success: boolean;
    totalDurationMs: number;
    headline: string | null;
    hook: string | null;
    fullArticleLength: number | null;
    schemaPass: boolean;
    schemaErrors: string[];
    sections: Record<string, { content: string | null; chars: number; pass: boolean }>;
    totalSectionsPassed: number;
    totalSectionsFailed: number;
    rawJson: string | null;
}

async function testSingleCall(gw: AIGateway, modelName: string): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
        model: modelName,
        path: 'SINGLE-CALL (all 7 sections)',
        success: false,
        totalDurationMs: 0,
        headline: null,
        hook: null,
        fullArticleLength: null,
        schemaPass: false,
        schemaErrors: [],
        sections: {},
        totalSectionsPassed: 0,
        totalSectionsFailed: 0,
        rawJson: null,
    };

    try {
        const messages = prompts.buildArticleWriterMessages(analysisJson, tone);
        const raw = await gw.chatRaw({
            model: modelName,
            temperature: 0.5,
            responseFormat: { type: 'json_object' },
            messages,
            maxTokens: LONG_RESPONSE_MAX_TOKENS,
        });
        result.rawJson = raw;

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            result.schemaErrors.push(`JSON parse failed. Raw: ${raw.slice(0, 300)}`);
            return result;
        }

        const validation = ArticleSchema.safeParse(parsed);
        if (!validation.success) {
            result.schemaErrors = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
            const partial = parsed as Record<string, unknown>;
            if (typeof partial.fullArticle === 'string') {
                result.fullArticleLength = partial.fullArticle.length;
                result.headline = typeof partial.headline === 'string' ? partial.headline : null;
                result.hook = typeof partial.hook === 'string' ? partial.hook : null;
                result.sections = extractAndMeasure(partial.fullArticle);
                result.totalSectionsPassed = Object.values(result.sections).filter(s => s.pass).length;
                result.totalSectionsFailed = Object.values(result.sections).filter(s => !s.pass).length;
            }
            return result;
        }

        result.schemaPass = true;
        result.success = true;
        result.fullArticleLength = validation.data.fullArticle.length;
        result.headline = validation.data.headline;
        result.hook = validation.data.hook;
        result.sections = extractAndMeasure(validation.data.fullArticle);
        result.totalSectionsPassed = Object.values(result.sections).filter(s => s.pass).length;
        result.totalSectionsFailed = Object.values(result.sections).filter(s => !s.pass).length;

    } catch (err) {
        result.schemaErrors.push(`API Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    result.totalDurationMs = Date.now() - start;
    return result;
}

async function test2StageSplit(gw: AIGateway, modelName: string): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
        model: modelName,
        path: '2-STAGE SPLIT (Stage2A + Stage2B)',
        success: false,
        totalDurationMs: 0,
        headline: null,
        hook: null,
        fullArticleLength: null,
        schemaPass: false,
        schemaErrors: [],
        sections: {},
        totalSectionsPassed: 0,
        totalSectionsFailed: 0,
        rawJson: null,
    };

    const stage2AMessages = prompts.buildArticleStage2AMessages(analysisJson, tone);
    const stage2BContext = {
        headline: 'placeholder',
        hook: 'placeholder',
        sentiment: 'bullish',
        verdict: 'STRONG_BUY' as const,
    };

    try {
        console.log(`    [Stage2A] Calling ${modelName}...`);
        const raw2A = await gw.chatRaw({
            model: modelName,
            temperature: 0.5,
            responseFormat: { type: 'json_object' },
            messages: [
                { role: 'system' as const, content: stage2AMessages.system },
                { role: 'user' as const, content: stage2AMessages.user },
            ],
            maxTokens: LONG_RESPONSE_MAX_TOKENS,
        });

        let parsed2A: unknown;
        try {
            parsed2A = JSON.parse(raw2A);
        } catch {
            result.schemaErrors.push(`Stage2A JSON parse failed. Raw: ${raw2A.slice(0, 300)}`);
            return result;
        }

        const val2A = Stage2ASchema.safeParse(parsed2A);
        if (!val2A.success) {
            result.schemaErrors = val2A.error.issues.map(i => `[Stage2A] ${i.path.join('.')}: ${i.message}`);
            result.rawJson = raw2A;
            return result;
        }

        result.headline = val2A.data.headline;
        result.hook = val2A.data.hook;

        stage2BContext.headline = val2A.data.headline;
        stage2BContext.hook = val2A.data.hook;

        const sectionsA = val2A.data.sections;

        console.log(`    [Stage2B] Calling ${modelName}...`);
        const stage2BMessages = prompts.buildArticleStage2BMessages(analysisJson, stage2BContext, tone);
        const raw2B = await gw.chatRaw({
            model: modelName,
            temperature: 0.5,
            responseFormat: { type: 'json_object' },
            messages: [
                { role: 'system' as const, content: stage2BMessages.system },
                { role: 'user' as const, content: stage2BMessages.user },
            ],
            maxTokens: LONG_RESPONSE_MAX_TOKENS,
        });

        let parsed2B: unknown;
        try {
            parsed2B = JSON.parse(raw2B);
        } catch {
            result.schemaErrors.push(`Stage2B JSON parse failed. Raw: ${raw2B.slice(0, 300)}`);
            result.sections = extractFromStageSections(sectionsA, null);
            result.totalSectionsPassed = Object.values(result.sections).filter(s => s.pass).length;
            result.totalSectionsFailed = Object.values(result.sections).filter(s => !s.pass).length;
            return result;
        }

        const val2B = Stage2BSchema.safeParse(parsed2B);
        if (!val2B.success) {
            const existing2AErrors = result.schemaErrors;
            result.schemaErrors = val2B.error.issues.map(i => `[Stage2B] ${i.path.join('.')}: ${i.message}`);
            result.sections = extractFromStageSections(sectionsA, null);
            result.totalSectionsPassed = Object.values(result.sections).filter(s => s.pass).length;
            result.totalSectionsFailed = Object.values(result.sections).filter(s => !s.pass).length;
            return result;
        }

        result.schemaPass = true;
        result.success = true;
        result.sections = extractFromStageSections(sectionsA, val2B.data.sections);
        result.totalSectionsPassed = Object.values(result.sections).filter(s => s.pass).length;
        result.totalSectionsFailed = Object.values(result.sections).filter(s => !s.pass).length;

    } catch (err) {
        result.schemaErrors.push(`API Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    result.totalDurationMs = Date.now() - start;
    return result;
}

function extractFromStageSections(
    sectionsA: { HOOK: string; 'WHAT HAPPENED': string; 'WHY IT MATTERS': string; 'HISTORY REPEATS?': string },
    sectionsB: { 'PRICE PICTURE': string; 'RISK CHECK': string; 'BOTTOM LINE': string } | null,
): Record<string, { content: string | null; chars: number; pass: boolean }> {
    return {
        coreCatalyst:     { content: sectionsA.HOOK,                  chars: sectionsA.HOOK.length,                  pass: sectionsA.HOOK.length >= 200 },
        marketContext:    { content: sectionsA['WHAT HAPPENED'],      chars: sectionsA['WHAT HAPPENED'].length,      pass: sectionsA['WHAT HAPPENED'].length >= 200 },
        strategicImpact:  { content: sectionsA['WHY IT MATTERS'],    chars: sectionsA['WHY IT MATTERS'].length,    pass: sectionsA['WHY IT MATTERS'].length >= 200 },
        historicalContext:{ content: sectionsA['HISTORY REPEATS?'],   chars: sectionsA['HISTORY REPEATS?'].length,   pass: sectionsA['HISTORY REPEATS?'].length >= 200 },
        technicalLevels:  {
            content: sectionsB?.['PRICE PICTURE'] ?? null,
            chars: sectionsB?.['PRICE PICTURE']?.length ?? 0,
            pass: (sectionsB?.['PRICE PICTURE']?.length ?? 0) >= 200,
        },
        riskAssessment:   {
            content: sectionsB?.['RISK CHECK'] ?? null,
            chars: sectionsB?.['RISK CHECK']?.length ?? 0,
            pass: (sectionsB?.['RISK CHECK']?.length ?? 0) >= 200,
        },
        bottomLine:       {
            content: sectionsB?.['BOTTOM LINE'] ?? null,
            chars: sectionsB?.['BOTTOM LINE']?.length ?? 0,
            pass: (sectionsB?.['BOTTOM LINE']?.length ?? 0) >= 150,
        },
    };
}

// ─── REPORTER ─────────────────────────────────────────────────────────────────

function printResult(result: TestResult): void {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  MODEL:  ${result.model}`);
    console.log(`  PATH:   ${result.path}`);
    console.log(`  TIME:   ${result.totalDurationMs}ms`);
    console.log(`${'═'.repeat(70)}`);

    if (result.schemaPass) {
        console.log(`  ✅ SCHEMA VALIDATION: PASSED`);
    } else {
        console.log(`  ❌ SCHEMA VALIDATION: FAILED`);
        for (const err of result.schemaErrors) {
            console.log(`     ⚠️  ${err}`);
        }
    }

    if (result.headline) {
        console.log(`\n  📰 Headline: ${result.headline}`);
    }
    if (result.fullArticleLength !== null) {
        console.log(`  📝 fullArticle length: ${result.fullArticleLength} chars (min: 3500)`);
    }

    console.log(`\n  ┌─────────────────────┬───────────┬──────────┐`);
    console.log(`  │ Section             │ Chars     │ Pass?    │`);
    console.log(`  ├─────────────────────┼───────────┼──────────┤`);

    const sectionLabels: Record<string, string> = {
        coreCatalyst:      'Core Catalyst',
        marketContext:     'Market Context',
        strategicImpact:   'Strategic Impact',
        historicalContext: 'Historical Context',
        technicalLevels:   'Technical Levels',
        riskAssessment:    'Risk Assessment',
        bottomLine:        'Executive Summary',
    };

    for (const [key, label] of Object.entries(sectionLabels)) {
        const section = result.sections[key];
        if (!section) continue;
        const icon = section.pass ? '✅' : '❌';
        const content = section.content
            ? (section.content.length > 80 ? section.content.slice(0, 77) + '...' : section.content)
            : '(null)';
        console.log(`  │ ${label.padEnd(19)} │ ${String(section.chars).padStart(7)} │ ${icon.padEnd(8)} │`);
        console.log(`  │   "${content}"`);
    }

    console.log(`  ├─────────────────────┼───────────┼──────────┤`);
    const totalIcon = result.totalSectionsFailed === 0 ? '✅' : '❌';
    console.log(`  │ ${'TOTAL'.padEnd(19)} │           │ ${`${result.totalSectionsPassed}/7 ${totalIcon}`.padEnd(8)} │`);
    console.log(`  └─────────────────────┴───────────┴──────────┘`);

    if (result.rawJson && !result.schemaPass) {
        console.log(`\n  📄 Raw JSON (first 500 chars):\n  ${result.rawJson.slice(0, 500)}`);
    }
}

function printComparison(results: TestResult[]): void {
    console.log(`\n\n${'█'.repeat(70)}`);
    console.log(`  ████  COMPARISON SUMMARY  ████`);
    console.log(`${'█'.repeat(70)}`);

    console.log(`\n  ┌───────────────────────────────────┬─────────┬─────────┬──────────┬──────────────┐`);
    console.log(`  │ Model                            │ Path    │ Time    │ Schema   │ Sections     │`);
    console.log(`  │                                  │         │         │          │ Passed/Total │`);
    console.log(`  ├───────────────────────────────────┼─────────┼─────────┼──────────┼──────────────┤`);

    for (const r of results) {
        const pathShort = r.path.includes('2-STAGE') ? '2-Stage' : 'Single';
        const schemaIcon = r.schemaPass ? '✅' : '❌';
        const sectionStr = `${r.totalSectionsPassed}/7`;
        console.log(`  │ ${r.model.padEnd(33)} │ ${pathShort.padEnd(7)} │ ${(r.totalDurationMs + 'ms').padEnd(7)} │ ${schemaIcon.padEnd(8)} │ ${sectionStr.padEnd(12)} │`);
    }

    console.log(`  └───────────────────────────────────┴─────────┴─────────┴──────────┴──────────────┘`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log('═'.repeat(70));
    console.log('  ARTICLE GENERATION TEST — DeepSeek vs GPT-5-nano');
    console.log('═'.repeat(70));
    console.log(`\n  Input: ${MOCK_ANALYSIS.coinSymbol} — ${MOCK_ANALYSIS.analysis.mainDriver.slice(0, 80)}...`);
    console.log(`  Verdict: ${MOCK_ANALYSIS.verdict} | Confidence: ${MOCK_ANALYSIS.confidenceScore}%`);
    console.log(`  Tone: ${tone}`);

    const nanoModel = env.SEO_MODEL;
    const dsModel = env.DEEPSEEK_MODEL_DIRECT;

    console.log(`\n  GPT-5-nano model:  ${nanoModel}`);
    console.log(`  DeepSeek model:    ${dsModel}`);
    console.log(`  DeepSeek gateway:  ${deepseekGateway ? '✅ Available' : '❌ Not configured (no DEEPSEEK_API_KEY)'}`);

    const results: TestResult[] = [];

    const geminiModel = 'google/gemini-2.5-flash';

    // Test 1: Gemini Single-Call
    console.log(`\n\n━━━ TEST 1: ${geminiModel} — SINGLE-CALL ━━━`);
    const r1 = await testSingleCall(nanoGateway, geminiModel);
    printResult(r1);
    results.push(r1);

    // Test 2: Gemini 2-Stage Split
    console.log(`\n\n━━━ TEST 2: ${geminiModel} — 2-STAGE SPLIT ━━━`);
    const r2 = await test2StageSplit(nanoGateway, geminiModel);
    printResult(r2);
    results.push(r2);

    printComparison(results);
}

main().catch(console.error);

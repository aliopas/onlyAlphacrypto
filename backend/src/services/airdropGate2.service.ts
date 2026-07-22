import { env } from '../config/env';
import { AIGateway, LONG_RESPONSE_MAX_TOKENS } from './ai/ai-gateway';
import { PromptFactory } from './ai/prompt-factory';
import {
    buildCitedFetchSummariesJson,
    buildStructuredFactsJson,
    buildUntrustedSourcesBlock,
    type EvidencePack,
} from './airdropEvidence.service';
import { logger } from '../utils/logger';

export type Gate2OutcomeHint = 'auto_publish' | 'hold_recheck' | 'reject';
export type Gate2Risk = 'LOW' | 'MEDIUM' | 'HIGH' | 'SCAM';

export interface Gate2Result {
    gate2Pass: boolean;
    outcomeHint: Gate2OutcomeHint;
    riskVerdict: Gate2Risk;
    isLegitimate: boolean;
    hardContradiction: boolean;
    missingDocs: boolean;
    teamSubstance: 'none' | 'weak' | 'ok' | 'strong';
    docsPresent: boolean;
    fundingOrTvlSignal: boolean;
    claimConsistency: 'consistent' | 'mixed' | 'contradictory';
    network: string;
    estValue: string;
    aiReport: string;
    websiteUrl: string;
    twitterUrl: string;
    reasons: string[];
}

const prompts = new PromptFactory();

const gateway = new AIGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeoutMs: 90000,
    defaultHeaders: {
        'HTTP-Referer': 'https://onlyalpha.app',
        'X-Title': 'OnlyAlpha',
    },
});

const deepseekGateway = env.DEEPSEEK_API_KEY
    ? new AIGateway({
          apiKey: env.DEEPSEEK_API_KEY,
          baseURL: env.DEEPSEEK_BASE_URL,
          timeoutMs: 90000,
          defaultHeaders: {
              'HTTP-Referer': 'https://onlyalpha.app',
              'X-Title': 'OnlyAlpha',
          },
      })
    : null;

function clampStr(value: unknown, max: number, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    const t = value.trim();
    if (!t) return fallback;
    return t.length > max ? t.slice(0, max) : t;
}

function asBool(value: unknown, fallback = false): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function parseOutcomeHint(value: unknown): Gate2OutcomeHint {
    if (value === 'auto_publish' || value === 'hold_recheck' || value === 'reject') {
        return value;
    }
    return 'hold_recheck';
}

function parseRisk(value: unknown): Gate2Risk {
    if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'SCAM') {
        return value;
    }
    return 'HIGH';
}

function parseTeam(value: unknown): Gate2Result['teamSubstance'] {
    if (value === 'none' || value === 'weak' || value === 'ok' || value === 'strong') {
        return value;
    }
    return 'none';
}

function parseConsistency(value: unknown): Gate2Result['claimConsistency'] {
    if (value === 'consistent' || value === 'mixed' || value === 'contradictory') {
        return value;
    }
    return 'mixed';
}

function normalizeGate2Raw(raw: Record<string, unknown>): Gate2Result {
    const reasonsRaw = raw.reasons;
    const reasons = Array.isArray(reasonsRaw)
        ? reasonsRaw
              .filter((r): r is string => typeof r === 'string')
              .map((r) => r.slice(0, 80))
              .slice(0, 8)
        : [];

    let result: Gate2Result = {
        gate2Pass: asBool(raw.gate2Pass, false),
        outcomeHint: parseOutcomeHint(raw.outcomeHint),
        riskVerdict: parseRisk(raw.riskVerdict),
        isLegitimate: asBool(raw.isLegitimate, false),
        hardContradiction: asBool(raw.hardContradiction, false),
        missingDocs: asBool(raw.missingDocs, false),
        teamSubstance: parseTeam(raw.teamSubstance),
        docsPresent: asBool(raw.docsPresent, false),
        fundingOrTvlSignal: asBool(raw.fundingOrTvlSignal, false),
        claimConsistency: parseConsistency(raw.claimConsistency),
        network: clampStr(raw.network, 64, 'Unknown'),
        estValue: clampStr(raw.estValue, 64, 'Unknown'),
        aiReport: clampStr(raw.aiReport, 500, ''),
        websiteUrl: clampStr(raw.websiteUrl, 300, ''),
        twitterUrl: clampStr(raw.twitterUrl, 300, ''),
        reasons,
    };

    // Safety: SCAM / hard contradiction cannot pass
    if (result.riskVerdict === 'SCAM' || !result.isLegitimate) {
        result = {
            ...result,
            gate2Pass: false,
            outcomeHint: result.riskVerdict === 'SCAM' || !result.isLegitimate ? 'reject' : result.outcomeHint,
        };
    }
    if (result.hardContradiction || result.claimConsistency === 'contradictory') {
        result = {
            ...result,
            gate2Pass: false,
            outcomeHint: result.outcomeHint === 'reject' ? 'reject' : 'hold_recheck',
        };
    }
    // G5: missing docs alone must not force reject
    if (result.missingDocs && result.outcomeHint === 'reject' && result.riskVerdict !== 'SCAM' && result.isLegitimate) {
        result = { ...result, outcomeHint: 'hold_recheck', gate2Pass: false };
    }

    return result;
}

/**
 * Gate-2 AI structural validate on Evidence Pack only (G1 isolation).
 */
export async function runGate2(pack: EvidencePack): Promise<Gate2Result> {
    const structuredFactsJson = buildStructuredFactsJson(pack);
    const untrustedSourcesBlock = buildUntrustedSourcesBlock(pack.signals);
    const citedFetchSummariesJson = buildCitedFetchSummariesJson(pack);
    const defillamaJson = pack.defillama.matched
        ? JSON.stringify({
              name: pack.defillama.name,
              tvl: pack.defillama.tvl,
              url: pack.defillama.url,
              twitter: pack.defillama.twitter,
              category: pack.defillama.category,
              description: pack.defillama.description,
          })
        : null;

    const messages = prompts.buildAirdropGate2Messages({
        entityName: pack.entity.canonicalName,
        structuredFactsJson,
        untrustedSourcesBlock,
        citedFetchSummariesJson,
        defillamaJson,
    });

    const targetGateway = deepseekGateway || gateway;
    const targetModel = deepseekGateway ? env.DEEPSEEK_MODEL_DIRECT : env.DEEPSEEK_MODEL;

    try {
        const raw = await targetGateway.chat<Record<string, unknown>>({
            model: targetModel,
            temperature: 0.15,
            responseFormat: { type: 'json_object' },
            messages,
            maxTokens: LONG_RESPONSE_MAX_TOKENS,
            maxRetries: 2,
        });

        return normalizeGate2Raw(raw);
    } catch (err) {
        logger.error(
            '[Gate2] AI call failed for entity=%s: %s',
            pack.entity.canonicalName,
            err instanceof Error ? err.message : String(err)
        );
        // Fail closed to hold (not reject) — G5 thin evidence path
        return {
            gate2Pass: false,
            outcomeHint: 'hold_recheck',
            riskVerdict: 'HIGH',
            isLegitimate: true,
            hardContradiction: false,
            missingDocs: true,
            teamSubstance: 'none',
            docsPresent: false,
            fundingOrTvlSignal: pack.defillama.matched,
            claimConsistency: 'mixed',
            network: 'Unknown',
            estValue: 'Unknown',
            aiReport: 'Gate-2 unavailable; held for automatic recheck.',
            websiteUrl: pack.defillama.url ?? '',
            twitterUrl: pack.defillama.twitter
                ? pack.defillama.twitter.startsWith('http')
                    ? pack.defillama.twitter
                    : `https://twitter.com/${pack.defillama.twitter.replace(/^@/, '')}`
                : '',
            reasons: ['gate2_ai_error'],
        };
    }
}

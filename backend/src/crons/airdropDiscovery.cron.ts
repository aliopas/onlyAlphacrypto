import cron from 'node-cron';
import { db } from '../config/db';
import { airdropProjects, airdropPipelineRuns } from '../models/index';
import { validateAirdrop } from '../services/openai.service';
import { enrichAirdropContext } from '../services/zhipuWebSearch.service';
import { insertProjectWithQuality } from '../controllers/airdrop.controller';
import { deleteCache, deleteCachePattern } from '../config/redis';
import {
    fetchTokenlessProtocols,
    buildAirdropCandidates,
    buildCandidateContext,
    type AirdropCandidate,
} from '../services/defillama.service';
import { searchWeb } from '../services/zhipuWebSearch.service';

const CONFIDENCE_THRESHOLD = 40;
const MAX_AI_CALLS_PER_RUN = 5;

const ZAI_DISCOVERY_QUERIES = [
    'crypto airdrop claim eligible 2026',
    'token generation event TGE confirmed upcoming',
    'airdrop snapshot retroactive crypto new',
    'testnet airdrop rewards incentivized',
    'new crypto airdrop upcoming 2026',
];

interface ZAISearchCandidate {
    projectName: string;
    context: string;
    source: string;
}

const EXTRACT_EXCLUDE = new Set(['airdrop', 'the', 'new', 'how', 'what', 'this', 'claim', 'token', 'snapshot', 'tge', 'crypto']);

function extractProjectNameFromSearchResult(content: string): string | null {
    const patterns = [
        /^([A-Z][a-zA-Z0-9]+)\s+(?:airdrop|token|TGE|snapshot|claim)/im,
        /(?:airdrop|claim|snapshot|TGE).*?(?:from|by|on)\s+([A-Z][a-zA-Z0-9]+)/im,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match?.[1] && match[1].length > 2 && match[1].length < 40) {
            const name = match[1].trim();
            if (!EXTRACT_EXCLUDE.has(name.toLowerCase())) {
                return name;
            }
        }
    }
    return null;
}

async function runZAIDiscovery(): Promise<ZAISearchCandidate[]> {
    const candidates: ZAISearchCandidate[] = [];

    for (const query of ZAI_DISCOVERY_QUERIES) {
        try {
            const results = await searchWeb(query);
            for (const result of results) {
                const projectName = extractProjectNameFromSearchResult(result.content);
                if (projectName) {
                    candidates.push({
                        projectName,
                        context: result.content.slice(0, 1500),
                        source: 'zai_web_search',
                    });
                }
            }
        } catch (err) {
            console.error('[AirdropDiscovery] Z.ai search failed:', err instanceof Error ? err.message : String(err));
        }
    }

    const seen = new Set<string>();
    return candidates.filter(c => {
        const key = c.projectName.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function parseOptionalDate(dateStr: string | null): Date | null {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
}

async function runAirdropDiscovery(): Promise<void> {
    const startTime = Date.now();
    console.log('[AirdropDiscovery] Run started — DeFiLlama + Z.ai pipeline');

    let totalCandidates = 0;
    let projectsInserted = 0;
    let rejections = 0;
    let errors = 0;

    const existingProjectNames = new Set(
        (await db.select({ name: airdropProjects.name }).from(airdropProjects))
            .map(p => p.name.toLowerCase())
    );

    // Layer 1: DeFiLlama tokenless protocols
    let defillamaCandidates: AirdropCandidate[] = [];
    try {
        const tokenlessProtocols = await fetchTokenlessProtocols();
        defillamaCandidates = await buildAirdropCandidates(tokenlessProtocols, 15);
        console.log(`[AirdropDiscovery] DeFiLlama: ${defillamaCandidates.length} candidates`);
    } catch (err) {
        console.error('[AirdropDiscovery] DeFiLlama fetch failed:', err instanceof Error ? err.message : String(err));
        errors++;
    }

    // Layer 2: Z.ai web search discovery
    let zaiCandidates: ZAISearchCandidate[] = [];
    try {
        zaiCandidates = await runZAIDiscovery();
        console.log(`[AirdropDiscovery] Z.ai: ${zaiCandidates.length} candidates`);
    } catch (err) {
        console.error('[AirdropDiscovery] Z.ai discovery failed:', err instanceof Error ? err.message : String(err));
        errors++;
    }

    // Merge & deduplicate candidates
    const allCandidateNames = new Set<string>();
    const prioritizedCandidates: Array<{
        name: string;
        context: string;
        source: string;
        confidence: number;
    }> = [];

    for (const c of defillamaCandidates) {
        if (!allCandidateNames.has(c.name.toLowerCase()) && c.confidenceScore >= CONFIDENCE_THRESHOLD) {
            allCandidateNames.add(c.name.toLowerCase());
            prioritizedCandidates.push({
                name: c.name,
                context: buildCandidateContext(c),
                source: 'defillama',
                confidence: c.confidenceScore,
            });
        }
    }

    for (const c of zaiCandidates) {
        if (!allCandidateNames.has(c.projectName.toLowerCase())) {
            allCandidateNames.add(c.projectName.toLowerCase());
            prioritizedCandidates.push({
                name: c.projectName,
                context: c.context,
                source: c.source,
                confidence: 30,
            });
        }
    }

    prioritizedCandidates.sort((a, b) => b.confidence - a.confidence);
    totalCandidates = prioritizedCandidates.length;

    const toProcess = prioritizedCandidates.filter(c => !existingProjectNames.has(c.name.toLowerCase()))
        .slice(0, MAX_AI_CALLS_PER_RUN);

    console.log(`[AirdropDiscovery] ${totalCandidates} unique candidates, ${toProcess.length} to process (after dedup + threshold)`);

    for (const candidate of toProcess) {
        try {
            let context = candidate.context;
            context = await enrichAirdropContext(candidate.name, context);

            const validation = await validateAirdrop(context);

            if (!validation.isLegitimate || validation.riskVerdict === 'SCAM') {
                console.log(`[AirdropDiscovery] Rejected: "${candidate.name}" — legitimate=${validation.isLegitimate}, risk=${validation.riskVerdict}`);
                rejections++;
                continue;
            }
            const projectName = candidate.name;
            const network = candidate.source === 'defillama'
                ? 'Multi-chain'
                : 'Unknown';

            if (existingProjectNames.has(projectName.toLowerCase())) {
                console.log(`[AirdropDiscovery] Duplicate skipped: "${projectName}"`);
                rejections++;
                continue;
            }

            try {
                await insertProjectWithQuality({
                    name: projectName,
                    network,
                    estValue: validation.estValue,
                    aiReport: validation.aiReport,
                    riskVerdict: validation.riskVerdict,
                    fundingRound: undefined,
                    twitterUrl: undefined,
                    discordUrl: undefined,
                    websiteUrl: undefined,
                });
                existingProjectNames.add(projectName.toLowerCase());
                projectsInserted++;
            } catch (err) {
                if (err instanceof Error && err.message.includes('quality threshold')) {
                    console.log(`[AirdropDiscovery] Rejected by quality filter: "${projectName}"`);
                    rejections++;
                } else {
                    throw err;
                }
            }

            console.log(`[AirdropDiscovery] Inserted: "${projectName}" (${candidate.source})`);
        } catch (err) {
            errors++;
            console.error(`[AirdropDiscovery] Error processing "${candidate.name}":`, err instanceof Error ? err.message : String(err));
        }
    }

    try {
        await deleteCache('airdrop:projects');
        await deleteCache('airdrop:deadlines');
        await deleteCachePattern('airdrop:project:*');
    } catch (err) {
        console.error('[AirdropDiscovery] Cache invalidation failed:', err instanceof Error ? err.message : String(err));
    }

    const durationMs = Date.now() - startTime;
    try {
        await db.insert(airdropPipelineRuns).values({
            runType: 'defillama_discovery',
            articlesFound: totalCandidates,
            articlesProcessed: toProcess.length,
            projectsInserted,
            projectsRejected: rejections,
            errors,
            durationMs,
            notes: `sources: defillama+zai, candidates_dl=${defillamaCandidates.length}, candidates_zai=${zaiCandidates.length}`,
        });
    } catch (logErr) {
        console.error('[AirdropDiscovery] Failed to log pipeline run:', logErr instanceof Error ? logErr.message : String(logErr));
    }

    console.log(
        `[AirdropDiscovery] Complete — candidates: ${totalCandidates}, inserted: ${projectsInserted}, rejected: ${rejections}, errors: ${errors}, duration: ${durationMs}ms`
    );
}

export function startAirdropDiscoveryCron(): void {
    cron.schedule('0 */6 * * *', runAirdropDiscovery);
    console.log('[AirdropDiscovery] Cron scheduled — DeFiLlama+Z.ai discovery: every 6 hours');
}

export { runAirdropDiscovery, extractProjectNameFromSearchResult };

import { db } from '../config/db';
import { airdropProjects } from '../models/index';

export interface DefiLlamaProtocol {
    id: string;
    name: string;
    symbol: string | null;
    chain: string;
    chains: string[];
    tvl: number;
    url: string | null;
    logo: string | null;
    gecko_id: string | null;
    category: string | null;
    description: string | null;
    twitter: string | null;
}

export interface DefiLlamaRaise {
    date: number;
    name: string;
    round: string | null;
    amount: number | null;
    chains: string[];
    leadInvestors: string[];
    valuation: string | null;
}

export interface DefiLlamaProtocolDetail extends DefiLlamaProtocol {
    raises: DefiLlamaRaise[];
    mcap: number | null;
}

export interface AirdropCandidate {
    name: string;
    chains: string[];
    tvl: number;
    category: string | null;
    logo: string | null;
    url: string | null;
    twitter: string | null;
    description: string | null;
    totalRaised: number | null;
    latestRound: string | null;
    leadInvestors: string[];
    confidenceScore: number;
}

const BASE_URL = 'https://api.llama.fi';
const REQUEST_TIMEOUT = 20000;

async function fetchJSON<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`DeFiLlama API ${res.status}: ${url}`);
    return res.json() as Promise<T>;
}

export async function fetchTokenlessProtocols(): Promise<DefiLlamaProtocol[]> {
    const protocols = await fetchJSON<DefiLlamaProtocol[]>(`${BASE_URL}/protocols`);

    const tokenless = protocols.filter(p =>
        !p.gecko_id &&
        !p.symbol &&
        p.tvl > 0 &&
        p.name &&
        p.name.length > 1
    );

    tokenless.sort((a, b) => b.tvl - a.tvl);

    console.log(`[DeFiLlama] Found ${tokenless.length} tokenless protocols from ${protocols.length} total`);
    return tokenless;
}

export async function fetchProtocolDetail(name: string): Promise<DefiLlamaProtocolDetail | null> {
    try {
        const slug = name.toLowerCase().replace(/\s+/g, '-');
        return await fetchJSON<DefiLlamaProtocolDetail>(`${BASE_URL}/protocol/${slug}`);
    } catch (err) {
        console.error(`[DeFiLlama] Failed to fetch detail for "${name}":`, err instanceof Error ? err.message : String(err));
        return null;
    }
}

export function calculateConfidenceScore(
    protocol: DefiLlamaProtocol,
    detail: DefiLlamaProtocolDetail | null,
    existingCount: number
): number {
    let score = 0;

    if (protocol.tvl > 10_000_000) score += 30;
    else if (protocol.tvl > 1_000_000) score += 20;
    else if (protocol.tvl > 100_000) score += 10;

    if (protocol.chains.length > 1) score += 10;

    if (detail?.raises && detail.raises.length > 0) {
        score += 15;
        const totalRaised = detail.raises.reduce((sum, r) => sum + (r.amount ?? 0), 0);
        if (totalRaised > 10) score += 10;
    }

    if (protocol.twitter) score += 5;
    if (protocol.url) score += 5;
    if (protocol.category === 'Bridge' || protocol.category === 'DEX') score += 10;
    if (protocol.category === 'Lending') score += 5;

    if (existingCount > 0) score -= 20;

    return Math.max(0, Math.min(100, score));
}

export async function buildAirdropCandidates(
    tokenlessProtocols: DefiLlamaProtocol[],
    limit: number = 20
): Promise<AirdropCandidate[]> {
    const existingProjects = await db
        .select({ name: airdropProjects.name })
        .from(airdropProjects);
    const existingNames = new Set(existingProjects.map(p => p.name.toLowerCase()));

    const candidates: AirdropCandidate[] = [];

    const topProtocols = tokenlessProtocols
        .filter(p => !existingNames.has(p.name.toLowerCase()))
        .slice(0, limit);

    for (const protocol of topProtocols) {
        const detail = await fetchProtocolDetail(protocol.name);

        let totalRaised: number | null = null;
        let latestRound: string | null = null;
        let leadInvestors: string[] = [];

        if (detail?.raises && detail.raises.length > 0) {
            totalRaised = detail.raises.reduce((sum, r) => sum + (r.amount ?? 0), 0);
            const sorted = [...detail.raises].sort((a, b) => b.date - a.date);
            latestRound = sorted[0].round ?? null;
            leadInvestors = [...new Set(detail.raises.flatMap(r => r.leadInvestors ?? []))];
        }

        const confidenceScore = calculateConfidenceScore(protocol, detail, 0);

        candidates.push({
            name: protocol.name,
            chains: protocol.chains,
            tvl: protocol.tvl,
            category: protocol.category,
            logo: protocol.logo,
            url: protocol.url,
            twitter: protocol.twitter,
            description: protocol.description ?? detail?.description ?? null,
            totalRaised,
            latestRound,
            leadInvestors,
            confidenceScore,
        });
    }

    candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);

    console.log(`[DeFiLlama] Built ${candidates.length} airdrop candidates (top score: ${candidates[0]?.confidenceScore ?? 0})`);
    return candidates;
}

export function buildCandidateContext(candidate: AirdropCandidate): string {
    const parts = [
        `PROJECT NAME: ${candidate.name}`,
        `CATEGORY: ${candidate.category ?? 'Unknown'}`,
        `CHAINS: ${candidate.chains.join(', ')}`,
        `TVL: $${(candidate.tvl / 1_000_000).toFixed(2)}M`,
    ];

    if (candidate.totalRaised) parts.push(`TOTAL FUNDING: $${candidate.totalRaised}M`);
    if (candidate.latestRound) parts.push(`LATEST ROUND: ${candidate.latestRound}`);
    if (candidate.leadInvestors.length > 0) parts.push(`LEAD INVESTORS: ${candidate.leadInvestors.join(', ')}`);
    if (candidate.description) parts.push(`\nDESCRIPTION: ${candidate.description.slice(0, 500)}`);
    if (candidate.twitter) parts.push(`TWITTER: ${candidate.twitter}`);
    if (candidate.url) parts.push(`WEBSITE: ${candidate.url}`);

    parts.push(`\nCONFIDENCE SCORE: ${candidate.confidenceScore}/100`);
    parts.push('\nThis is a tokenless DeFi protocol. Analyze whether it has a confirmed or highly probable airdrop opportunity.');

    return parts.join('\n');
}

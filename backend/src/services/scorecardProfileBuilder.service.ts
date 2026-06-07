import { searchWeb } from './zhipuWebSearch.service';
import { fetchAllRSSNews } from './rssNews.service';

export interface CoinProfile {
    projectName: string;
    team: string;
    tokenomics: {
        totalSupply: number;
        circulatingSupply: number;
        distribution: string;
        vestingSchedule: string;
    };
    latestNews: Array<{
        title: string;
        date: string;
        source: string;
    }>;
    enrichedAt: string;
}

function extractNumeric(value: string, fallback: number): number {
    const match = value.match(/[\d,.]+(?:[eE][+-]?\d+)?/);
    if (!match) return fallback;
    const cleaned = match[0].replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : parsed;
}

function parseProfileFromText(text: string, symbol: string): Partial<CoinProfile> {
    const result: Partial<CoinProfile> = {};

    const projectMatch = text.match(/(?:project\s+name|name|project)[:\s]+([A-Za-z0-9\s]+?)(?:\n|,|team|supply)/i);
    if (projectMatch) {
        result.projectName = projectMatch[1].trim();
    }

    const teamMatch = text.match(/(?:team|founder|developer|backed\s+by)[:\s]+([^\n]{10,200})/i);
    if (teamMatch) {
        result.team = teamMatch[1].trim();
    }

    const totalSupplyMatch = text.match(/(?:total\s+supply|totalSupply|max\s+supply)[:\s]*([\d,.]+\s*[BMK]?)/i);
    if (totalSupplyMatch) {
        result.tokenomics = result.tokenomics ?? {} as CoinProfile['tokenomics'];
        result.tokenomics.totalSupply = extractNumeric(totalSupplyMatch[1], 0);
    }

    const circSupplyMatch = text.match(/(?:circulating\s+supply|circSupply|current\s+supply)[:\s]*([\d,.]+\s*[BMK]?)/i);
    if (circSupplyMatch) {
        result.tokenomics = result.tokenomics ?? {} as CoinProfile['tokenomics'];
        result.tokenomics.circulatingSupply = extractNumeric(circSupplyMatch[1], 0);
    }

    const distMatch = text.match(/(?:distribution|allocated|allocation)[:\s]+([^\n]{20,300})/i);
    if (distMatch) {
        result.tokenomics = result.tokenomics ?? {} as CoinProfile['tokenomics'];
        result.tokenomics.distribution = distMatch[1].trim();
    }

    const vestMatch = text.match(/(?:vesting|unlock|cliff|linear)[:\s]+([^\n]{10,200})/i);
    if (vestMatch) {
        result.tokenomics = result.tokenomics ?? {} as CoinProfile['tokenomics'];
        result.tokenomics.vestingSchedule = vestMatch[1].trim();
    }

    return result;
}

export async function buildCoinProfile(
    validatedCoin: { symbol: string; coinGeckoId: string }
): Promise<CoinProfile> {
    const { symbol, coinGeckoId } = validatedCoin;
    const now = new Date().toISOString();

    const partial: Partial<CoinProfile> = {
        projectName: symbol,
        team: 'Unknown',
        tokenomics: {
            totalSupply: 0,
            circulatingSupply: 0,
            distribution: 'Unknown',
            vestingSchedule: 'Unknown',
        },
        latestNews: [],
        enrichedAt: now,
    };

    try {
        const query = `Provide project name, core team, tokenomics (total supply, circulating supply, distribution, vesting schedule) for ${symbol} (${coinGeckoId}). Return structured data only. Focus on verifiable facts.`;
        const results = await searchWeb(query);

        if (results.length > 0) {
            const parsed = parseProfileFromText(results[0].content, symbol);

            if (parsed.projectName) partial.projectName = parsed.projectName;
            if (parsed.team) partial.team = parsed.team;
            if (parsed.tokenomics) {
                if (!partial.tokenomics) {
                    partial.tokenomics = { totalSupply: 0, circulatingSupply: 0, distribution: 'Unknown', vestingSchedule: 'Unknown' };
                }
                partial.tokenomics!.totalSupply = parsed.tokenomics.totalSupply ?? partial.tokenomics!.totalSupply;
                partial.tokenomics!.circulatingSupply = parsed.tokenomics.circulatingSupply ?? partial.tokenomics!.circulatingSupply;
                partial.tokenomics!.distribution = parsed.tokenomics.distribution ?? partial.tokenomics!.distribution;
                partial.tokenomics!.vestingSchedule = parsed.tokenomics.vestingSchedule ?? partial.tokenomics!.vestingSchedule;
            }
        }
    } catch (err) {
        console.warn(`[ScorecardProfileBuilder] Web search failed for ${symbol}:`, err instanceof Error ? err.message : String(err));
    }

    try {
        const allNews = await fetchAllRSSNews();
        const coinNews = allNews
            .filter(n => n.title.toUpperCase().includes(symbol.toUpperCase()))
            .slice(0, 5);

        partial.latestNews = coinNews.map(n => ({
            title: n.title,
            date: n.pubDate,
            source: n.source,
        }));
    } catch (err) {
        console.warn(`[ScorecardProfileBuilder] RSS fetch failed for ${symbol}:`, err instanceof Error ? err.message : String(err));
    }

    return {
        projectName: partial.projectName ?? symbol,
        team: partial.team ?? 'Unknown',
        tokenomics: partial.tokenomics ?? {
            totalSupply: 0,
            circulatingSupply: 0,
            distribution: 'Unknown',
            vestingSchedule: 'Unknown',
        },
        latestNews: partial.latestNews ?? [],
        enrichedAt: partial.enrichedAt ?? now,
    };
}
import { env } from '../config/env';

interface WebSearchResult {
    title: string;
    url: string;
    content: string;
}

const WEB_SEARCH_MODEL = 'glm-4.5-air';

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
    if (!env.GLM_API_KEY) return [];

    try {
        const res = await fetch(`${env.GLM_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.GLM_API_KEY}`,
            },
            body: JSON.stringify({
                model: WEB_SEARCH_MODEL,
                messages: [{ role: 'user', content: query }],
                tools: [{
                    type: 'web_search',
                    web_search: {
                        enable: true,
                        search_engine: 'search-prime',
                    },
                }],
                max_tokens: 2000,
            }),
            signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
            console.error(`[ZhipuWebSearch] API error: ${res.status}`);
            return [];
        }

        const data = await res.json() as {
            choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
        };

        const choice = data?.choices?.[0]?.message;
        if (!choice) return [];

        const rawContent = choice.content || choice.reasoning_content || '';
        if (!rawContent) return [];

        return [{
            title: query,
            url: 'zai-web-search',
            content: rawContent.slice(0, 1500),
        }];
    } catch (err) {
        console.error('[ZhipuWebSearch] Error:', err instanceof Error ? err.message : String(err));
        return [];
    }
}

export async function enrichAirdropContext(
    projectName: string,
    existingContent: string
): Promise<string> {
    if (existingContent.length > 500) return existingContent;

    console.log(`[ZhipuWebSearch] Enriching context for "${projectName}" (${existingContent.length} chars)`);

    const results = await searchWeb(`${projectName} crypto airdrop eligibility criteria tokenomics 2025`);

    if (results.length === 0) return existingContent;

    const enrichment = results
        .map(r => r.content.slice(0, 800))
        .join('\n\n');

    console.log(`[ZhipuWebSearch] Enriched "${projectName}" with ${enrichment.length} chars from web search`);
    return `${existingContent}\n\n--- WEB RESEARCH (via Z.ai) ---\n${enrichment}`;
}

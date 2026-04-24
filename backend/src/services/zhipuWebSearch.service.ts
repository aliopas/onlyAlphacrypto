import { env } from '../config/env';

interface WebSearchResult {
    title: string;
    url: string;
    content: string;
}

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
                model: env.GLM_PLANNER_MODEL,
                messages: [{ role: 'user', content: `Search the web for: ${query}. Return factual information only.` }],
                tools: [{ type: 'web_search', web_search: { enable: true } }],
            }),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) return [];

        const data = await res.json() as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data?.choices?.[0]?.message?.content ?? '';

        if (!content) return [];

        return [{
            title: query,
            url: 'glm-web-search',
            content: typeof content === 'string' ? content.slice(0, 1500) : '',
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

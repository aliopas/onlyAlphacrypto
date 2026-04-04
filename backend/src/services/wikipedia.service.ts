interface WikipediaSummaryResponse {
    extract?: string;
}

export async function getWikipediaBackground(coinName: string): Promise<string | null> {
    const variants = [
        `${coinName}_(blockchain)`,
        `${coinName}_(cryptocurrency)`,
        coinName,
    ];

    for (const variant of variants) {
        try {
            const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(variant)}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(4000) });

            if (!res.ok) {
                continue;
            }

            const data: WikipediaSummaryResponse = await res.json() as WikipediaSummaryResponse;

            if (data.extract) {
                const sentences = data.extract.split('. ').slice(0, 3).join('. ') + '.';
                return sentences;
            }
        } catch (error) {
            console.warn('[wikipedia] Variant failed:', variant, error instanceof Error ? error.message : String(error));
            continue;
        }
    }

    return null;
}

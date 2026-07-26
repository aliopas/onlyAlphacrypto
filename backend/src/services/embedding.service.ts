import { env } from '../config/env';
import OpenAI from 'openai';
import { pool } from '../config/db';

const DEFAULT_SIMILARITY_THRESHOLD = 0.88;

interface EmbeddingResult {
    isDuplicate: boolean;
    duplicateId: number | null;
    similarity: number;
}

function getOpenRouterClient(): OpenAI {
    return new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        timeout: 30000,
    });
}

async function generateEmbeddingOpenRouter(text: string): Promise<number[]> {
    const client = getOpenRouterClient();
    const response = await client.embeddings.create({
        model: env.EMBEDDING_MODEL,
        input: text,
    });
    return response.data[0].embedding;
}

async function generateEmbeddingOllama(text: string): Promise<number[]> {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: env.OLLAMA_EMBEDDING_MODEL, prompt: text }),
    });
    if (!response.ok) {
        throw new Error(`Ollama embedding failed: ${response.status}`);
    }
    const data = await response.json() as { embedding: number[] };
    return data.embedding;
}

export async function generateEmbedding(text: string): Promise<number[]> {
    if (env.EMBEDDING_PROVIDER === 'ollama') {
        return generateEmbeddingOllama(text);
    }
    return generateEmbeddingOpenRouter(text);
}

export async function findSemanticDuplicate(
    text: string,
    symbol: string,
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): Promise<EmbeddingResult> {
    const defaultResult: EmbeddingResult = { isDuplicate: false, duplicateId: null, similarity: 0 };

    try {
        const embedding = await generateEmbedding(text);
        const embeddingStr = `[${embedding.join(',')}]`;

        const query = `
            SELECT id, 1 - (embedding <=> $1::vector) AS similarity
            FROM raw_news_buffer
            WHERE symbol_mentions @> $2::jsonb
              AND embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT 1
        `;

        const result = await pool.query(query, [embeddingStr, JSON.stringify([symbol])]);

        if (result.rows.length === 0) {
            return defaultResult;
        }

        const row = result.rows[0] as { id: number; similarity: number };

        if (row.similarity >= threshold) {
            return {
                isDuplicate: true,
                duplicateId: row.id,
                similarity: row.similarity,
            };
        }

        return defaultResult;
    } catch (error) {
        console.error('[Embedding] findSemanticDuplicate failed:', error);
        return defaultResult;
    }
}

export async function storeEmbedding(id: number, text: string): Promise<void> {
    try {
        const embedding = await generateEmbedding(text);
        const embeddingStr = `[${embedding.join(',')}]`;
        await pool.query(
            'UPDATE raw_news_buffer SET embedding = $1::vector WHERE id = $2',
            [embeddingStr, id]
        );
    } catch (error) {
        console.error(`[Embedding] storeEmbedding failed for id=${id}:`, error);
    }
}

/**
 * Semantic duplicate check against market_news_items (DEC-043 B2).
 * Reuses generateEmbedding + pgvector cosine; does not touch raw_news_buffer path.
 */
export async function findMarketNewsSemanticDuplicate(
    text: string,
    excludeId?: number,
    threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): Promise<EmbeddingResult> {
    const defaultResult: EmbeddingResult = { isDuplicate: false, duplicateId: null, similarity: 0 };

    try {
        const embedding = await generateEmbedding(text);
        const embeddingStr = `[${embedding.join(',')}]`;

        const query = excludeId
            ? `
                SELECT id, 1 - (embedding <=> $1::vector) AS similarity
                FROM market_news_items
                WHERE embedding IS NOT NULL
                  AND id <> $2
                ORDER BY embedding <=> $1::vector
                LIMIT 1
            `
            : `
                SELECT id, 1 - (embedding <=> $1::vector) AS similarity
                FROM market_news_items
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> $1::vector
                LIMIT 1
            `;

        const params: Array<string | number> = excludeId
            ? [embeddingStr, excludeId]
            : [embeddingStr];
        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return defaultResult;
        }

        const row = result.rows[0] as { id: number; similarity: number };

        if (row.similarity >= threshold) {
            return {
                isDuplicate: true,
                duplicateId: row.id,
                similarity: row.similarity,
            };
        }

        return { ...defaultResult, similarity: row.similarity };
    } catch (error) {
        console.error('[Embedding] findMarketNewsSemanticDuplicate failed:', error);
        return defaultResult;
    }
}

export async function storeMarketNewsEmbedding(id: number, text: string): Promise<number[] | null> {
    try {
        const embedding = await generateEmbedding(text);
        const embeddingStr = `[${embedding.join(',')}]`;
        await pool.query(
            'UPDATE market_news_items SET embedding = $1::vector, updated_at = NOW() WHERE id = $2',
            [embeddingStr, id]
        );
        return embedding;
    } catch (error) {
        console.error(`[Embedding] storeMarketNewsEmbedding failed for id=${id}:`, error);
        return null;
    }
}
import OpenAI from 'openai';
type ChatCompletionChunk = OpenAI.ChatCompletionChunk;

export class AIRateLimitError extends Error {
    readonly retryAfterMs: number;
    constructor(retryAfterMs: number) {
        super(`AI rate limited. Retry after ${retryAfterMs}ms`);
        this.name = 'AIRateLimitError';
        this.retryAfterMs = retryAfterMs;
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Stream chunk timeout after ${ms}ms`)), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

function stripThinkingBlocks(content: string): string {
    const marker = '<' + '/think';
    const thinkEnd = content.lastIndexOf(marker);
    if (thinkEnd === -1) return content;
    return content.slice(thinkEnd + marker.length).trim();
}

export class AIGateway {
    private _client: OpenAI;
    private _defaultHeaders: Record<string, string>;

    constructor(config: {
        apiKey: string;
        baseURL: string;
        timeoutMs?: number;
        defaultHeaders?: Record<string, string>;
    }) {
        this._defaultHeaders = config.defaultHeaders ?? {};
        this._client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            timeout: config.timeoutMs ?? 90000,
            defaultHeaders: this._defaultHeaders,
        });
    }

    private _throwIfRateLimited(error: unknown): void {
        if (error instanceof OpenAI.APIError && error.status === 429) {
            const retryAfterStr = error.headers?.get?.('retry-after');
            const retryAfterSec = parseInt(retryAfterStr ?? '5', 10) || 5;
            throw new AIRateLimitError(Math.min(retryAfterSec * 1000, 60000));
        }
    }

    async chat<T>(params: {
        model: string;
        messages: OpenAI.ChatCompletionMessageParam[];
        temperature?: number;
        responseFormat?: { type: 'json_object' };
        maxRetries?: number;
    }): Promise<T> {
        const maxRetries = params.maxRetries ?? 0;
        let messages = [...params.messages];

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            let content: string;

            try {
                const response = await this._client.chat.completions.create({
                    model: params.model,
                    messages,
                    temperature: params.temperature,
                    response_format: params.responseFormat,
                });
                content = stripThinkingBlocks(response.choices[0].message.content ?? '');
            } catch (error) {
                this._throwIfRateLimited(error);
                if (attempt === maxRetries) throw error;
                continue;
            }

            if (!content) {
                throw new Error('Empty response from AI gateway');
            }

            try {
                return JSON.parse(content) as T;
            } catch (parseError) {
                if (attempt === maxRetries) {
                    throw new Error(
                        `Failed to parse AI response as JSON after ${maxRetries + 1} attempts. Last error: ${(parseError as Error).message}. Content: ${content.substring(0, 500)}`
                    );
                }
                messages = [
                    ...params.messages,
                    {
                        role: 'assistant' as const,
                        content,
                    },
                    {
                        role: 'user' as const,
                        content: `Your previous response was not valid JSON. Parse error: ${(parseError as Error).message}\n\nPlease fix the JSON and return ONLY the valid JSON object, no preamble or explanation.`,
                    },
                ];
            }
        }

        throw new Error('Unreachable code in AIGateway.chat');
    }

    async chatRaw(params: {
        model: string;
        messages: OpenAI.ChatCompletionMessageParam[];
        temperature?: number;
        responseFormat?: { type: 'json_object' };
    }): Promise<string> {
        try {
            const response = await this._client.chat.completions.create({
                model: params.model,
                messages: params.messages,
                temperature: params.temperature,
                response_format: params.responseFormat,
            });

            const content = stripThinkingBlocks(response.choices[0].message.content ?? '');
            if (!content) {
                throw new Error('Empty response from AI gateway');
            }

            return content;
        } catch (error) {
            this._throwIfRateLimited(error);
            throw error;
        }
    }

    async *chatStream(params: {
        model: string;
        messages: OpenAI.ChatCompletionMessageParam[];
        temperature?: number;
        chunkTimeoutMs?: number;
    }): AsyncIterable<ChatCompletionChunk> {
        const chunkTimeoutMs = params.chunkTimeoutMs ?? 30000;

        const stream = await this._client.chat.completions.create({
            model: params.model,
            messages: params.messages,
            temperature: params.temperature,
            stream: true,
        });

        const iterator = stream[Symbol.asyncIterator]();

        try {
            while (true) {
                const result = await withTimeout(iterator.next(), chunkTimeoutMs);
                if (result.done) break;
                yield result.value;
            }
        } finally {
            if (iterator.return) {
                await iterator.return();
            }
        }
    }
}

export function createOpenRouterGateway(config: {
    apiKey: string;
    timeoutMs?: number;
}): AIGateway {
    return new AIGateway({
        apiKey: config.apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        timeoutMs: config.timeoutMs ?? 90000,
        defaultHeaders: {
            'HTTP-Referer': 'https://onlyalpha.app',
            'X-Title': 'OnlyAlpha',
        }
    });
}

export function createGLMGateway(config: {
    apiKey: string;
    baseURL?: string;
    timeoutMs?: number;
}): AIGateway {
    return new AIGateway({
        apiKey: config.apiKey,
        baseURL: config.baseURL ?? 'https://open.bigmodel.cn/api/paas/v4',
        timeoutMs: config.timeoutMs ?? 90000,
        defaultHeaders: {}
    });
}

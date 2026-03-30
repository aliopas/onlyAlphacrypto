import OpenAI from 'openai';
type ChatCompletionChunk = OpenAI.ChatCompletionChunk;

export class AIGateway {
    private _client: OpenAI;

    constructor(config: {
        apiKey: string;
        baseURL: string;
        timeoutMs?: number;
        defaultHeaders?: Record<string, string>;
    }) {
        this._client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            timeout: config.timeoutMs ?? 90000,
            defaultHeaders: config.defaultHeaders ?? {},
        });
    }

    async chat<T>(params: {
        model: string;
        messages: OpenAI.ChatCompletionMessageParam[];
        temperature?: number;
        responseFormat?: { type: 'json_object' };
    }): Promise<T> {
        const response = await this._client.chat.completions.create({
            model: params.model,
            messages: params.messages,
            temperature: params.temperature,
            response_format: params.responseFormat,
        });

        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error('Empty response from AI gateway');
        }

        return JSON.parse(content) as T;
    }

    async *chatStream(params: {
        model: string;
        messages: OpenAI.ChatCompletionMessageParam[];
        temperature?: number;
    }): AsyncIterable<ChatCompletionChunk> {
        const stream = await this._client.chat.completions.create({
            model: params.model,
            messages: params.messages,
            temperature: params.temperature,
            stream: true,
        });

        for await (const chunk of stream) {
            yield chunk;
        }
    }
}
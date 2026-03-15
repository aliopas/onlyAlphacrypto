import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('5000'),

    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // Redis
    REDIS_URL: z.string().optional(),

    // Auth
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    // OpenRouter (OpenAI-compatible API)
    OPENROUTER_API_KEY: z.string().min(10, 'OPENROUTER_API_KEY is required'),
    ANALYSIS_MODEL: z.string().default('z-ai/glm-5'),
    SEO_MODEL: z.string().default('openai/gpt-5-nano'),

    // Binance
    BINANCE_API_KEY: z.string().optional(),
    BINANCE_SECRET: z.string().optional(),

    // Moralis
    MORALIS_API_KEY: z.string().min(1, 'MORALIS_API_KEY is required'),

    // Alternative.me (no key needed, public API)
    ALTERNATIVE_ME_URL: z.string().url().default('https://api.alternative.me/fng/'),

    // Next.js revalidation
    NEXTJS_REVALIDATE_SECRET: z.string().optional(),
    NEXTJS_BASE_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    parsed.error.issues.forEach((issue) => {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

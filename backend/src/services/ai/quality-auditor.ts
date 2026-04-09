import type { AIGateway } from './ai-gateway';
import type { ArticleWriterResult } from '../openai.service';
import { env } from '../../config/env';

export interface QualityAuditResult {
    passed: boolean;
    score: number;
    issues: string[];
    suggestion: string | null;
}

const AUDITOR_MODEL = env.DEEPSEEK_MODEL_DIRECT;

export async function auditArticleQuality(
    gateway: AIGateway,
    analysisJson: string,
    article: ArticleWriterResult
): Promise<QualityAuditResult> {
    const messages = [
        {
            role: 'system' as const,
            content: `You are a strict quality auditor for crypto news articles. You receive the original AI analysis and the article written from it.

Audit the article against the analysis. Return STRICT JSON:
{
  "passed": <true if score >= 70>,
  "score": <0-100>,
  "issues": ["<issue description>", ...],
  "suggestion": "<how to fix, or null if passed>"
}

Check:
1. ACCURACY: Does the article faithfully represent the analysis verdict, sentiment, and impact score?
2. COMPLETENESS: Are all key facts from the analysis included?
3. VERDICT: Is the final verdict stated correctly (matches analysis)?
4. PRICE DATA: Are support/resistance levels mentioned accurately?
5. RISK: Is the risk note honestly included?
6. SEO: Are metaTitle ≤60 chars, metaDescription ≤160 chars, exactly 5 keywords?
7. LENGTH: Is the fullArticle ≥ 800 words (approximately)?
8. TONE: Is it professional without giving financial advice?`
        },
        {
            role: 'user' as const,
            content: `ORIGINAL ANALYSIS:\n${analysisJson}\n\nGENERATED ARTICLE:\n${JSON.stringify(article, null, 2)}`
        }
    ];

    try {
        const result = await gateway.chat<QualityAuditResult>({
            model: AUDITOR_MODEL,
            temperature: 0.1,
            responseFormat: { type: 'json_object' },
            messages,
        });
        return result;
    } catch (error) {
        console.error('[QualityAuditor] Audit failed:', error instanceof Error ? error.message : String(error));
        return { passed: true, score: 60, issues: ['Audit service unavailable — auto-passed'], suggestion: null };
    }
}

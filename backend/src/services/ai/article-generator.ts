import { gatherCoinContext, CoinContext } from './data-augmenter';
import { generateDeepSynthesis, DeepSynthesisResult } from '../openai.service';
import { saveMemory } from '../coin-memory.service';
import { createHash } from 'crypto';

export async function generateArticle(coinSymbol: string, newsArticles: string[]): Promise<DeepSynthesisResult> {
  console.log(`[ArticleGenerator] Gathering context for ${coinSymbol}`);
  let context: CoinContext;
  try {
    context = await gatherCoinContext(coinSymbol);
  } catch (error) {
    console.error(`[ArticleGenerator] Error gathering context for ${coinSymbol}:`, error);
    throw error;
  }

  console.log(`[ArticleGenerator] Generating deep synthesis for ${coinSymbol}`);
  let synthesisResult: DeepSynthesisResult;
  try {
    synthesisResult = await generateDeepSynthesis(
      coinSymbol,
      newsArticles,
      context.marketData as Record<string, number | string>,
      context.onchainData as Record<string, unknown>,
      context.tavilyContext
    );
  } catch (error) {
    console.error(`[ArticleGenerator] Error generating deep synthesis for ${coinSymbol}:`, error);
    throw error;
  }

  console.log(`[ArticleGenerator] Saving memory for ${coinSymbol}`);
  try {
    await saveMemory({
      coinSymbol,
      eventType: 'news_burst',
      eventSummary: synthesisResult.executiveSummary,
      priceAtEvent: context.marketData?.priceUsd ? Number(context.marketData.priceUsd) : undefined,
      verdict: synthesisResult.riskAssessment === 'HIGH' ? 'SELL' : synthesisResult.riskAssessment === 'LOW' ? 'BUY' : 'NEUTRAL',
      confidenceScore: synthesisResult.confidenceScore,
      riskVerdict: synthesisResult.riskAssessment,
      keyDrivers: synthesisResult.keyDrivers,
      redFlags: synthesisResult.redFlags,
      sourceNewsHashes: newsArticles.map(article => createHash('sha256').update(article).digest('hex'))
    });
  } catch (error) {
    console.error(`[ArticleGenerator] Error saving memory for ${coinSymbol}:`, error);
  }

  return synthesisResult;
}
import 'dotenv/config';
import { db } from '../src/config/db';
import { coinMasterArticles } from '../src/models/market.model';
import { getCoinIntelligence } from '../src/services/coinIntelligence.service';
import { buildTemporalPattern } from '../src/services/temporalIntelligence.service';
import { getPriceWithFallback } from '../src/services/priceService';
import { callDeepSeekAnalysis } from '../src/services/openai.service';
import { validateFactualGrounding } from '../src/services/ai/factual-grounding';
import { saveStrategicOutlook } from '../src/services/strategicOutlook.service';
import { deleteCache } from '../src/config/redis';

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

async function backfillStrategicOutlook(): Promise<void> {
    console.log('=== Phase 15: Strategic Outlook Backfill ===');
    console.log('Fetching all coins with master articles...');

    const masters = await db.select({
        coinSymbol: coinMasterArticles.coinSymbol,
        headline: coinMasterArticles.headline,
        triggerType: coinMasterArticles.triggerType,
    }).from(coinMasterArticles);

    if (masters.length === 0) {
        console.log('No master articles found. Nothing to backfill.');
        return;
    }

    console.log(`Found ${masters.length} coins. Starting backfill...\n`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const master of masters) {
        const symbol = master.coinSymbol;
        console.log(`--- Processing ${symbol} ---`);

        try {
            const [intelligence, price, pattern] = await Promise.all([
                getCoinIntelligence(symbol),
                getPriceWithFallback(symbol),
                buildTemporalPattern(symbol, 'ETF', 3),
            ]);

            const headline = master.headline || `${symbol} latest market update`;

            console.log(`  Price: $${price?.price ?? 'N/A'} | Intelligence: ${intelligence.ath ? 'cached' : 'fetched'}`);

            const analysisResult = await callDeepSeekAnalysis({
                headline,
                intelligence,
                pattern,
                price,
            });

            console.log(`  Sentiment: ${analysisResult.sentiment} | Verdict: ${analysisResult.verdict} | StrategicOutlook: ${analysisResult.strategicOutlook ? 'YES' : 'NO'}`);

            const currentPrice = price?.price ?? 0;
            if (currentPrice > 0) {
                const grounding = validateFactualGrounding(
                    analysisResult.supportLevels,
                    analysisResult.resistanceLevels,
                    currentPrice,
                );
                if (grounding.removedLevels.length > 0) {
                    console.log(`  Factual grounding: removed ${grounding.removedLevels.length} hallucinated levels`);
                }
            }

            if (analysisResult.strategicOutlook) {
                await saveStrategicOutlook(symbol, analysisResult.strategicOutlook, headline);
                await deleteCache(`outlook:${symbol}`);
                console.log(`  Strategic outlook SAVED for ${symbol}`);
                successCount++;
            } else {
                console.log(`  SKIP: DeepSeek did not return strategicOutlook for ${symbol}`);
                skipCount++;
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`  FAILED for ${symbol}: ${message}`);
            failCount++;
        }

        sleep(3000);
    }

    console.log('\n=== Backfill Complete ===');
    console.log(`Success: ${successCount} | Skipped (no outlook): ${skipCount} | Failed: ${failCount} | Total: ${masters.length}`);
}

backfillStrategicOutlook()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Backfill crashed:', err);
        process.exit(1);
    });

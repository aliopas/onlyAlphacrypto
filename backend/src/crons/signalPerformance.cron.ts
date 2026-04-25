import cron from 'node-cron';
import { db } from '../config/db';
import { signalPerformance } from '../models/market.model';
import { eq, isNull, lte, and, sql } from 'drizzle-orm';
import { getPriceWithFallback } from '../services/priceService';

async function updateSignalPerformance(): Promise<void> {
    console.log('[SignalPerf] Update run started');

    const need24h = await db.select()
        .from(signalPerformance)
        .where(and(
            isNull(signalPerformance.price24h),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '24 hours'`)
        ))
        .limit(50);

    for (const row of need24h) {
        const priceResult = await getPriceWithFallback(row.coinSymbol);
        if (!priceResult) continue;
        const pricePnl = ((priceResult.price - row.entryPrice) / row.entryPrice) * 100;
        const isBearish = ['SELL', 'STRONG_SELL'].includes(row.verdict);
        const tradePnl = isBearish ? -pricePnl : pricePnl;
        
        await db.update(signalPerformance).set({
            price24h: priceResult.price,
            pnl24h: tradePnl,
        }).where(eq(signalPerformance.id, row.id));
    }

    const need7d = await db.select()
        .from(signalPerformance)
        .where(and(
            isNull(signalPerformance.price7d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '7 days'`)
        ))
        .limit(50);

    for (const row of need7d) {
        const priceResult = await getPriceWithFallback(row.coinSymbol);
        if (!priceResult) continue;
        const pricePnl = ((priceResult.price - row.entryPrice) / row.entryPrice) * 100;
        const isBullish = ['BUY', 'STRONG_BUY'].includes(row.verdict);
        const isBearish = ['SELL', 'STRONG_SELL'].includes(row.verdict);
        const tradePnl = isBearish ? -pricePnl : pricePnl;
        const isWin = (isBullish || isBearish) ? tradePnl > 0 : null;

        await db.update(signalPerformance).set({
            price7d: priceResult.price,
            pnl7d: tradePnl,
            isWin7d: isWin,
        }).where(eq(signalPerformance.id, row.id));
    }

    const need30d = await db.select()
        .from(signalPerformance)
        .where(and(
            isNull(signalPerformance.price30d),
            lte(signalPerformance.entryAt, sql`NOW() - INTERVAL '30 days'`)
        ))
        .limit(50);

    for (const row of need30d) {
        const priceResult = await getPriceWithFallback(row.coinSymbol);
        if (!priceResult) continue;
        const pricePnl = ((priceResult.price - row.entryPrice) / row.entryPrice) * 100;
        const isBullish = ['BUY', 'STRONG_BUY'].includes(row.verdict);
        const isBearish = ['SELL', 'STRONG_SELL'].includes(row.verdict);
        const tradePnl = isBearish ? -pricePnl : pricePnl;
        const isWin = (isBullish || isBearish) ? tradePnl > 0 : null;

        await db.update(signalPerformance).set({
            price30d: priceResult.price,
            pnl30d: tradePnl,
            isWin30d: isWin,
        }).where(eq(signalPerformance.id, row.id));
    }

    console.log(`[SignalPerf] Updated: ${need24h.length} (24h), ${need7d.length} (7d), ${need30d.length} (30d)`);
}

export function startSignalPerformanceCron(): void {
    cron.schedule('0 */6 * * *', updateSignalPerformance);
    console.log('[SignalPerf] Cron scheduled — every 6 hours');
}

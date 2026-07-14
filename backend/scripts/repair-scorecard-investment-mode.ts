// backend/scripts/repair-scorecard-investment-mode.ts
// One-shot ops repair for Model Portfolio Rebuild (T9)
// Run: npx ts-node backend/scripts/repair-scorecard-investment-mode.ts

import { db } from '../src/config/db';
import { portfolioCoins } from '../src/models/scorecard.model';
import { eq } from 'drizzle-orm';
import { calculateInvestmentTpsl } from '../src/services/scorecardTpslCalculator.service';
import { env } from '../src/config/env';

async function main() {
    console.log('[T9-Repair] Starting investment-mode repair...');

    const allCoins = await db.select().from(portfolioCoins);

    let fixed = 0;
    for (const coin of allCoins) {
        const updates: Record<string, unknown> = {};
        const avg = parseFloat(coin.averageEntryPrice || coin.entryPrice || '0');

        // 1. Ensure direction + posted/avg entry
        if (!coin.direction) updates.direction = 'LONG';
        if (!coin.postedEntryPrice) updates.postedEntryPrice = String(avg);
        if (!coin.averageEntryPrice) updates.averageEntryPrice = String(avg);

        // 2. Always recompute TP/SL ladder for non-exited rows
        if (avg > 0 && coin.status !== 'exited') {
            const tpsl = calculateInvestmentTpsl(avg, 'LONG');
            updates.tp1 = String(tpsl.tp1);
            updates.tp2 = String(tpsl.tp2);
            updates.tp3 = String(tpsl.tp3);
            updates.stopLoss = String(tpsl.stopLoss);
        }

        // 3. Ensure investment sizing + flags
        const initial = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_INITIAL_ENTRY_PCT;
        const dca = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_DCA_ENTRY_PCT;
        if (!coin.initialBudget) updates.initialBudget = String(initial);
        if (!coin.dcaBudget) updates.dcaBudget = String(dca);
        if (coin.remainingSizeFrac == null) updates.remainingSizeFrac = '1';
        if (coin.dcaFilled == null) updates.dcaFilled = false;
        if (coin.tp1Hit == null) updates.tp1Hit = false;
        if (coin.tp2Hit == null) updates.tp2Hit = false;
        if (coin.tp3Hit == null) updates.tp3Hit = false;
        if (coin.realizedPnl == null) updates.realizedPnl = '0';

        if (Object.keys(updates).length > 0) {
            await db.update(portfolioCoins).set(updates).where(eq(portfolioCoins.id, coin.id));
            fixed++;
        }
    }

    console.log(`[T9-Repair] Done. Fixed ${fixed} rows.`);
    process.exit(0);
}

main().catch((e) => {
    console.error('[T9-Repair] Failed:', e);
    process.exit(1);
});
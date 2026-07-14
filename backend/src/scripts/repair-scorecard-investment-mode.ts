import { db } from '../config/db';
import { env } from '../config/env';
import { migrationFlags } from '../models/market.model';
import { portfolioCoins } from '../models/scorecard.model';
import { calculateInvestmentTpsl } from '../services/scorecardTpslCalculator.service';
import { eq } from 'drizzle-orm';

const FLAG_NAME = 'scorecard_investment_mode_repair_v1';

export async function runScorecardInvestmentModeRepair(): Promise<{ fixed: number; skipped: boolean }> {
    try {
        const existing = await db
            .select({ id: migrationFlags.id })
            .from(migrationFlags)
            .where(eq(migrationFlags.flagName, FLAG_NAME))
            .limit(1);

        if (existing.length > 0) {
            console.log(`[ScorecardInvestmentRepair] Already completed (${FLAG_NAME}). Skipping.`);
            return { fixed: 0, skipped: true };
        }
    } catch {
        // migration_flags may not exist on first boot
    }

    console.log('[ScorecardInvestmentRepair] Starting investment-mode repair...');

    const allCoins = await db.select().from(portfolioCoins);
    let fixed = 0;

    const initial = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_INITIAL_ENTRY_PCT;
    const dca = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_DCA_ENTRY_PCT;

    for (const coin of allCoins) {
        const updates: Partial<typeof portfolioCoins.$inferInsert> = {};
        const avg = parseFloat(coin.averageEntryPrice || coin.entryPrice || '0');

        if (!coin.direction) updates.direction = 'LONG';
        if (!coin.postedEntryPrice) updates.postedEntryPrice = String(avg || coin.entryPrice || '0');
        if (!coin.averageEntryPrice) updates.averageEntryPrice = String(avg || coin.entryPrice || '0');

        if (avg > 0 && coin.status !== 'exited') {
            const tpsl = calculateInvestmentTpsl(avg, 'LONG');
            updates.tp1 = String(tpsl.tp1);
            updates.tp2 = String(tpsl.tp2);
            updates.tp3 = String(tpsl.tp3);
            updates.stopLoss = String(tpsl.stopLoss);
        }

        if (!coin.initialBudget) updates.initialBudget = String(initial);
        if (!coin.dcaBudget || coin.dcaBudget === '0') {
            if (!coin.dcaFilled) updates.dcaBudget = String(dca);
        }
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

    try {
        await db.insert(migrationFlags).values({ flagName: FLAG_NAME, executedAt: new Date() }).onConflictDoNothing();
    } catch {
        // non-fatal if flag insert races
    }

    console.log(`[ScorecardInvestmentRepair] Done. Fixed ${fixed} rows.`);
    return { fixed, skipped: false };
}

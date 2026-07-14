// Manual CLI wrapper — boot also runs this once via migration_flags.
// Run: npx ts-node backend/scripts/repair-scorecard-investment-mode.ts

import { pool } from '../src/config/db';
import { runScorecardInvestmentModeRepair } from '../src/scripts/repair-scorecard-investment-mode';

async function main() {
    const result = await runScorecardInvestmentModeRepair();
    console.log('[T9-Repair CLI]', result);
    await pool.end();
    process.exit(0);
}

main().catch(async (e) => {
    console.error('[T9-Repair] Failed:', e);
    try {
        await pool.end();
    } catch {
        // ignore
    }
    process.exit(1);
});

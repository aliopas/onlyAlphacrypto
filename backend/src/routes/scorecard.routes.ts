import { Router } from 'express';
import {
    getScorecardSummary,
    getScorecardCoinBySymbol,
    getScorecardTransactions,
    getScorecardSnapshots,
} from '../controllers/scorecard.controller';
import { runScorecardPipeline } from '../services/scorecardPipeline.service';

const router = Router();

router.get('/', getScorecardSummary);
router.get('/transactions', getScorecardTransactions);
router.get('/snapshots', getScorecardSnapshots);
router.get('/:symbol', getScorecardCoinBySymbol);

router.post('/test-pipeline', async (_req, res) => {
    try {
        console.log('[ScorecardTest] Manual pipeline trigger');
        const stats = await runScorecardPipeline();
        res.json({ ok: true, stats });
    } catch (err) {
        console.error('[ScorecardTest] Pipeline failed:', err instanceof Error ? err.message : String(err));
        res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
});

export default router;
import { Router } from 'express';
import {
    getScorecardSummary,
    getScorecardCoinBySymbol,
    getScorecardTransactions,
    getScorecardSnapshots,
} from '../controllers/scorecard.controller';

const router = Router();

router.get('/', getScorecardSummary);
router.get('/transactions', getScorecardTransactions);
router.get('/snapshots', getScorecardSnapshots);
router.get('/:symbol', getScorecardCoinBySymbol);

export default router;
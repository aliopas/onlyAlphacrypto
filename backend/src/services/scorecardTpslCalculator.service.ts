import { env } from '../config/env';

export interface TpslResult {
    tp1: number;
    tp2: number;
    tp3: number;
    tp4: number;
    stopLoss: number;
    initialBudget: number;
    dcaBudget: number;
    isRejected?: boolean;
    rejectionReason?: string;
    rr?: number;
    tpSource?: string;
    slSource?: string;
    allocatedBudget?: number;
}

export function calculateInvestmentTpsl(
    entryPrice: number,
    direction: 'LONG'
): TpslResult {
    if (direction !== 'LONG') {
        throw new Error('Only LONG direction supported in investment mode');
    }
    if (!(entryPrice > 0) || !Number.isFinite(entryPrice)) {
        throw new Error('entryPrice must be a positive finite number');
    }

    const tp1 = entryPrice * (1 + env.SCORECARD_TP1_PCT);
    const tp2 = entryPrice * (1 + env.SCORECARD_TP2_PCT);
    const tp3 = entryPrice * (1 + env.SCORECARD_TP3_PCT);
    const tp4 = entryPrice * (1 + env.SCORECARD_TP4_PCT);

    const stopLoss = entryPrice * (1 + env.SCORECARD_SL_PCT);

    const initialBudget = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_INITIAL_ENTRY_PCT;
    const dcaBudget = env.SCORECARD_TOTAL_BUDGET * env.SCORECARD_DCA_ENTRY_PCT;

    return {
        tp1: Number(tp1.toFixed(8)),
        tp2: Number(tp2.toFixed(8)),
        tp3: Number(tp3.toFixed(8)),
        tp4: Number(tp4.toFixed(8)),
        stopLoss: Number(stopLoss.toFixed(8)),
        initialBudget: Number(initialBudget.toFixed(2)),
        dcaBudget: Number(dcaBudget.toFixed(2)),
    };
}

// Backward-compatible wrapper for admin + old pipeline callers
export async function calculateScorecardTpsl(params: {
    symbol: string;
    entryPrice: number;
    classification?: 'STRATEGIC' | 'TACTICAL';
}): Promise<TpslResult & {
    isRejected: false;
    rr: number;
    allocatedBudget: number;
    tpSource: string;
    slSource: string;
}> {
    const result = calculateInvestmentTpsl(params.entryPrice, 'LONG');
    const rr = (result.tp1 - params.entryPrice) / Math.max(params.entryPrice - result.stopLoss, 1e-12);
    return {
        ...result,
        isRejected: false,
        rejectionReason: undefined,
        rr: Number(rr.toFixed(2)),
        tpSource: 'investment',
        slSource: 'investment',
        allocatedBudget: result.initialBudget,
    };
}
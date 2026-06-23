import { env } from './env';
import { logger } from '../utils/logger';

/**
 * Flow-based isolation layer.
 *
 * The system is organized into 5 independent flows. Each flow owns a set of crons +
 * services + DB tables and can be enabled/disabled as a unit via a master env flag.
 *
 *   FLOW_NEWS_ENABLED     — News intelligence pipeline (RSS/Telegram → triage → AiWorkflow)
 *   FLOW_SIGNALS_ENABLED  — Signal generation, lifecycle, TP/SL, P&L tracking
 *   FLOW_MARKET_ENABLED   — Market data foundation (price/OHLCV/regime/levels/trend)
 *   FLOW_PORTFOLIO_ENABLED — Scorecard portfolio simulation (Telegram scrape → monitor)
 *   FLOW_AIRDROP_ENABLED  — Airdrop discovery (RSS/DeFiLlama/Z.ai → validation)
 *
 * Sub-feature flags (e.g. SIGNAL_LIFECYCLE_ENABLED, SHADOW_MODE_ENABLED) remain
 * individually controllable — a flow being enabled only means its core crons run;
 * the sub-flags gate the opt-in advanced behavior within a flow.
 *
 * This is the single source of truth consulted by the cron registry (server.ts) to
 * decide which crons to start.
 */

export type FlowId = 'news' | 'signals' | 'market' | 'portfolio' | 'airdrop';

export interface FlowConfig {
    id: FlowId;
    name: string;
    /** Master on/off for the entire flow. */
    enabled: boolean;
    /** Human-readable description of what this flow does. */
    description: string;
}

export const FLOWS: Record<FlowId, FlowConfig> = {
    news: {
        id: 'news',
        name: 'News Intelligence',
        enabled: env.FLOW_NEWS_ENABLED,
        description: 'RSS + Telegram gathering → triage → AI analysis → articles/radar/memory',
    },
    signals: {
        id: 'signals',
        name: 'Signal & Trading',
        enabled: env.FLOW_SIGNALS_ENABLED,
        description: 'Signal generation, lifecycle, TP/SL monitoring, P&L tracking, scenario outcomes',
    },
    market: {
        id: 'market',
        name: 'Market Data',
        enabled: env.FLOW_MARKET_ENABLED,
        description: 'Price/OHLCV/regime/levels/trend foundation that feeds signal decisions',
    },
    portfolio: {
        id: 'portfolio',
        name: 'Scorecard Portfolio',
        enabled: env.FLOW_PORTFOLIO_ENABLED,
        description: 'Telegram-scraped educational portfolio simulation with TP/SL monitor',
    },
    airdrop: {
        id: 'airdrop',
        name: 'Airdrop Discovery',
        enabled: env.FLOW_AIRDROP_ENABLED,
        description: 'RSS/DeFiLlama/Z.ai discovery → AI validation → project registry',
    },
};

/**
 * Log the flow state at boot so operators can see at a glance which flows are active.
 */
export function logFlowStatus(): void {
    logger.info('┌─────────────────────────────────────────────┐');
    logger.info('│           [FLOW ISOLATION] Boot State        │');
    logger.info('├─────────────────────────────────────────────┤');
    for (const flow of Object.values(FLOWS)) {
        const status = flow.enabled ? 'ENABLED ' : 'DISABLED';
        logger.info('│ %-14s %s  │', flow.name, status);
    }
    logger.info('└─────────────────────────────────────────────┘');
}

/**
 * Returns true if all of the given flows are enabled. Used by crons that span flows
 * (e.g. aiWorkflow produces both news articles AND signals — it needs both flows on).
 */
export function allFlowsEnabled(...flowIds: FlowId[]): boolean {
    return flowIds.every(id => FLOWS[id].enabled);
}

/**
 * Returns true if any of the given flows are enabled.
 */
export function anyFlowEnabled(...flowIds: FlowId[]): boolean {
    return flowIds.some(id => FLOWS[id].enabled);
}

import type { FlowId } from '../config/flows';
import { FLOWS } from '../config/flows';
import { logger } from '../utils/logger';

/**
 * Cron registration metadata. Each cron declares:
 *   - name:       human-readable identifier (also used as the cronGuard key)
 *   - start:      the start* function that schedules the cron internally
 *   - flow:       which flow owns this cron
 *   - subFlag:    optional env flag that ALSO must be true (e.g. SIGNAL_LIFECYCLE_ENABLED)
 *   - subFlagName: human-readable name of the sub-flag for logging
 *
 * The registry consults FLOWS[flow].enabled AND subFlag to decide whether to start the cron.
 * This replaces the ad-hoc setTimeout-staggered blocks in server.ts with a single declarative
 * source of truth, making it trivial to see which crons belong to which flow.
 */
export interface CronRegistration {
    name: string;
    start: () => void;
    flow: FlowId;
    subFlag?: boolean;
    subFlagName?: string;
    /** If true, this cron also requires another flow to be enabled (cross-flow dependency). */
    alsoRequiresFlow?: FlowId;
}

/**
 * Start a batch of crons with a staggered delay between each to avoid thundering-herd at boot.
 * Returns the number of crons actually started.
 */
export function startCrons(registrations: CronRegistration[], staggerMs = 5000): number {
    let started = 0;
    let skipped = 0;

    registrations.forEach((reg, index) => {
        const flowEnabled = FLOWS[reg.flow].enabled;
        const crossFlowEnabled = reg.alsoRequiresFlow ? FLOWS[reg.alsoRequiresFlow].enabled : true;
        const subFlagEnabled = reg.subFlag === undefined ? true : reg.subFlag;

        const shouldStart = flowEnabled && crossFlowEnabled && subFlagEnabled;

        setTimeout(() => {
            if (!shouldStart) {
                const reasons: string[] = [];
                if (!flowEnabled) reasons.push(`flow '${reg.flow}' disabled`);
                if (!crossFlowEnabled) reasons.push(`cross-flow '${reg.alsoRequiresFlow}' disabled`);
                if (!subFlagEnabled && reg.subFlagName) reasons.push(`${reg.subFlagName}=false`);
                logger.info('[CronRegistry] Skipping %s (%s)', reg.name, reasons.join(', '));
                return;
            }
            try {
                reg.start();
                logger.info('[CronRegistry] Started %s [flow=%s]', reg.name, reg.flow);
                started++;
            } catch (error) {
                logger.error('[CronRegistry] Failed to start %s: %s', reg.name, error instanceof Error ? error.message : String(error));
            }
        }, index * staggerMs);
    });

    skipped = registrations.length - started;
    logger.info('[CronRegistry] Registration complete: %d crons queued (%d may be skipped based on flow/sub-flags).', registrations.length, skipped);
    return started;
}

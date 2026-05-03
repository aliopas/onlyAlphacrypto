import cron from 'node-cron';
import { logger } from '../utils/logger';

export async function runLevelIntelligenceCron(): Promise<void> {
    logger.info('[LevelIntelligenceCron] Running...');
    // TODO: Implement level intelligence cron
}

export function startLevelIntelligenceCron(): void {
    cron.schedule('0 */6 * * *', () => runLevelIntelligenceCron()); // Every 6 hours
    console.log('⏰ LevelIntelligence scheduled — every 6 hours');
}
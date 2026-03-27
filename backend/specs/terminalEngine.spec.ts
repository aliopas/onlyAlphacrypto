import cron from 'node-cron';
import { startTerminalEngineCron } from '../src/crons/terminalEngine.cron';

jest.mock('node-cron', () => ({
    schedule: jest.fn()
}));

describe('Terminal Engine Cron', () => {
    it('should be a defined function', () => {
        expect(typeof startTerminalEngineCron).toBe('function');
    });

    it('should register a cron job to run every 5 minutes', () => {
        startTerminalEngineCron();
        
        expect(cron.schedule).toHaveBeenCalledWith(
            '*/5 * * * *',
            expect.any(Function)
        );
    });
});

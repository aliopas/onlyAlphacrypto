export class CircuitBreaker {
    private failures: number = 0;
    private openUntil: Date | null = null;
    private readonly maxFailures: number;
    private readonly cooldownMs: number;

    constructor(config: { maxFailures?: number; cooldownMs?: number } = {}) {
        this.maxFailures = config.maxFailures ?? 5;
        this.cooldownMs = config.cooldownMs ?? 30 * 60 * 1000;
    }

    isOpen(): boolean {
        if (!this.openUntil) return false;
        if (new Date() > this.openUntil) {
            this.failures = 0;
            this.openUntil = null;
            return false;
        }
        return true;
    }

    recordFailure(service: string): void {
        this.failures++;
        console.error(`[CircuitBreaker] ${service} failure ${this.failures}/${this.maxFailures}`);
        if (this.failures >= this.maxFailures) {
            this.openUntil = new Date(Date.now() + this.cooldownMs);
            console.error(`[CircuitBreaker] ${service} OPEN until ${this.openUntil.toISOString()}`);
        }
    }

    recordSuccess(): void {
        this.failures = 0;
    }
}

export const binanceBreaker = new CircuitBreaker();
export const dexscreenerBreaker = new CircuitBreaker();
export const deepseekBreaker = new CircuitBreaker();
export const gptNanoBreaker = new CircuitBreaker();
import { createHash } from 'crypto';

export interface CacheEntry<T> {
    result: T;
    timestamp: number;
    ttlMs?: number;
}

export class CacheManager {
    private cache: Map<string, CacheEntry<unknown>>;
    private readonly ttlMs: number;
    private readonly maxSize: number;
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor(config: { ttlMs?: number; maxSize?: number } = {}) {
        this.ttlMs = config.ttlMs ?? 3600000;
        this.maxSize = config.maxSize ?? 1000;
        this.cache = new Map<string, CacheEntry<unknown>>();
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    cleanup(): void {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            const effectiveTtl = value.ttlMs ?? this.ttlMs;
            if (now - value.timestamp > effectiveTtl) {
                this.cache.delete(key);
            }
        }
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }

        const now = Date.now();
        const effectiveTtl = entry.ttlMs ?? this.ttlMs;
        if (now - entry.timestamp > effectiveTtl) {
            this.cache.delete(key);
            return null;
        }

        return entry.result as T;
    }

    set<T>(key: string, result: T, ttlMs?: number): void {
        this.cache.set(key, { result, timestamp: Date.now(), ttlMs } as CacheEntry<unknown>);
        this._cleanup();
    }

    private _cleanup(): void {
        // Only handle maxSize eviction; TTL is checked in periodic cleanup()
        if (this.cache.size > this.maxSize) {
            const sortedEntries = Array.from(this.cache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);

            const removeCount = Math.ceil(sortedEntries.length * 0.2);
            for (let i = 0; i < removeCount; i++) {
                this.cache.delete(sortedEntries[i][0]);
            }
        }
    }

    generateKey(prefix: string, ...args: unknown[]): string {
        const keyData = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join('||');
        const hash = createHash('sha256').update(keyData).digest('hex');
        return `${prefix}:${hash}`;
    }
}
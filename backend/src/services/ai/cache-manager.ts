import { createHash } from 'crypto';

export interface CacheEntry<T> {
    result: T;
    timestamp: number;
}

export class CacheManager {
    private cache: Map<string, CacheEntry<unknown>>;
    private readonly ttlMs: number;
    private readonly maxSize: number;

    constructor(config: { ttlMs?: number; maxSize?: number } = {}) {
        this.ttlMs = config.ttlMs ?? 3600000; // 1 hour default
        this.maxSize = config.maxSize ?? 1000; // 1000 entries default
        this.cache = new Map<string, CacheEntry<unknown>>();
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }

        const now = Date.now();
        if (now - entry.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }

        return entry.result as T;
    }

    set<T>(key: string, result: T): void {
        this.cache.set(key, { result, timestamp: Date.now() } as CacheEntry<unknown>);
        this._cleanup();
    }

    private _cleanup(): void {
        const now = Date.now();
        // Remove expired entries
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.ttlMs) {
                this.cache.delete(key);
            }
        }

        // If still over maxSize, remove oldest 20%
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
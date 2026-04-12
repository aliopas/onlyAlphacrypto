import { Request, Response } from 'express';
import { pool } from '../config/db';
import { redis } from '../config/redis';
import { env } from '../config/env';

interface HealthComponentStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    latencyMs: number;
    detail?: string;
}

interface SystemHealthReport {
    timestamp: string;
    uptime: number;
    environment: string;
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: {
        database: HealthComponentStatus;
        pgvector: HealthComponentStatus;
        redis: HealthComponentStatus;
        openrouter: HealthComponentStatus;
    };
}

function createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });
}

async function checkDatabase(): Promise<HealthComponentStatus> {
    const start = performance.now();
    try {
        await Promise.race([
            pool.query('SELECT 1'),
            createTimeoutPromise(3000)
        ]);
        const latency = performance.now() - start;
        return { status: 'healthy', latencyMs: latency };
    } catch (error) {
        const latency = performance.now() - start;
        return { status: 'unhealthy', latencyMs: latency, detail: error instanceof Error ? error.message : 'Unknown error' };
    }
}

async function checkPgvector(): Promise<HealthComponentStatus> {
    const start = performance.now();
    try {
        const result = await Promise.race([
            pool.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'"),
            createTimeoutPromise(3000)
        ]);
        const latency = performance.now() - start;
        if (result.rows.length > 0 && result.rows[0].extversion) {
            return { status: 'healthy', latencyMs: latency };
        } else {
            return { status: 'unhealthy', latencyMs: latency, detail: 'pgvector extension not found or no version' };
        }
    } catch (error) {
        const latency = performance.now() - start;
        return { status: 'unhealthy', latencyMs: latency, detail: error instanceof Error ? error.message : 'Unknown error' };
    }
}

async function checkRedis(): Promise<HealthComponentStatus> {
    const start = performance.now();
    if (!redis) {
        return { status: 'degraded', latencyMs: 0, detail: 'Redis not configured' };
    }
    try {
        const result = await Promise.race([
            redis.ping(),
            createTimeoutPromise(3000)
        ]);
        const latency = performance.now() - start;
        if (result === 'PONG') {
            return { status: 'healthy', latencyMs: latency };
        } else {
            return { status: 'unhealthy', latencyMs: latency, detail: 'Unexpected ping response' };
        }
    } catch (error) {
        const latency = performance.now() - start;
        return { status: 'unhealthy', latencyMs: latency, detail: error instanceof Error ? error.message : 'Unknown error' };
    }
}

async function checkOpenRouter(): Promise<HealthComponentStatus> {
    const start = performance.now();
    try {
        const response = await Promise.race([
            fetch('https://openrouter.ai/api/v1/models', {
                method: 'HEAD',
                headers: {
                    'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
                },
            }),
            createTimeoutPromise(5000)
        ]);
        const latency = performance.now() - start;
        if (response.ok) {
            return { status: 'healthy', latencyMs: latency };
        } else {
            return { status: 'unhealthy', latencyMs: latency, detail: `HTTP ${response.status}` };
        }
    } catch (error) {
        const latency = performance.now() - start;
        return { status: 'unhealthy', latencyMs: latency, detail: error instanceof Error ? error.message : 'Unknown error' };
    }
}

function determineOverallStatus(components: SystemHealthReport['components']): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalComponents = ['database', 'openrouter'] as const;
    const hasUnhealthyCritical = criticalComponents.some(comp => components[comp].status === 'unhealthy');
    if (hasUnhealthyCritical) {
        return 'unhealthy';
    }
    const hasAnyUnhealthy = Object.values(components).some(comp => comp.status === 'unhealthy');
    if (hasAnyUnhealthy) {
        return 'degraded';
    }
    const hasDegraded = Object.values(components).some(comp => comp.status === 'degraded');
    if (hasDegraded) {
        return 'degraded';
    }
    return 'healthy';
}

export async function systemHealthCheck(req: Request, res: Response): Promise<void> {
    const [database, pgvector, redisStatus, openrouter] = await Promise.allSettled([
        checkDatabase(),
        checkPgvector(),
        checkRedis(),
        checkOpenRouter(),
    ]);

    const components: SystemHealthReport['components'] = {
        database: database.status === 'fulfilled' ? database.value : { status: 'unhealthy', latencyMs: 0, detail: 'Check failed' },
        pgvector: pgvector.status === 'fulfilled' ? pgvector.value : { status: 'unhealthy', latencyMs: 0, detail: 'Check failed' },
        redis: redisStatus.status === 'fulfilled' ? redisStatus.value : { status: 'unhealthy', latencyMs: 0, detail: 'Check failed' },
        openrouter: openrouter.status === 'fulfilled' ? openrouter.value : { status: 'unhealthy', latencyMs: 0, detail: 'Check failed' },
    };

    const report: SystemHealthReport = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        overall: determineOverallStatus(components),
        components,
    };

    res.json(report);
}
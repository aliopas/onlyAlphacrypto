import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { airdropProjects, airdropPipelineRuns } from '../models/index';
import { desc, asc, sql } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { getCache, setCache } from '../config/redis';
import { logger } from '../utils/logger';
import { calculateAirdropQuality } from '../services/airdropQuality.service';
import {
    buildPortfolioCard,
    getPublicPortfolioCardById,
    listPublicPortfolioCards,
    publicPublishFilter,
    toPortfolioListItem,
} from '../services/airdropPortfolio.service';
import {
    getAirdropPublicStats,
    getResearchBySlug,
    listResearchArchive,
    listSeoEligibleResearchSlugs,
} from '../services/airdropResearch.service';

function parseEstValue(raw: string | null | undefined): number {
    if (!raw) return 0;
    const trimmed = raw.trim();
    if (/^tbd$/i.test(trimmed) || trimmed === '' || trimmed === '-') return 0;
    const nums = trimmed.match(/\d[\d,]*\.?\d*/g);
    if (!nums || nums.length === 0) return 0;
    const parsed = nums.map((n) => parseFloat(n.replace(/,/g, ''))).filter((n) => !isNaN(n) && n > 0);
    if (parsed.length === 0) return 0;
    parsed.sort((a, b) => a - b);
    return parsed[0];
}

export async function getProjects(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'airdrop:projects:portfolio:v1';
        const cached = await getCache<Record<string, unknown>[]>(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        const cards = await listPublicPortfolioCards();
        const payload = cards.map(toPortfolioListItem);
        await setCache(cacheKey, payload, 120);
        res.json(payload);
    } catch (err) {
        next(err);
    }
}

export async function getProjectById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = parseInt(String(req.params['id']), 10);
        if (isNaN(id)) throw new AppError('Invalid project id', 400);

        const cacheKey = `airdrop:project:portfolio:v1:${id}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        const card = await getPublicPortfolioCardById(id);
        if (!card) throw new AppError('Project not found', 404);

        await setCache(cacheKey, card, 120);
        res.json(card);
    } catch (err) {
        next(err);
    }
}

export async function getProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    res.json({ percent: 0, completedCount: 0, totalCount: 0, userProgress: [] });
}

export async function triggerVerification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    res.status(410).json({ error: 'Verification system has been deprecated' });
}

export async function getDeadlines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'airdrop:deadlines:v1';
        const cached = await getCache(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        const projects = await db
            .select({
                id: airdropProjects.id,
                name: airdropProjects.name,
                logoUrl: airdropProjects.logoUrl,
                snapshotAt: airdropProjects.snapshotAt,
                tgeAt: airdropProjects.tgeAt,
            })
            .from(airdropProjects)
            .where(publicPublishFilter);

        const withDeadlines = projects.filter((p) => p.snapshotAt || p.tgeAt);
        await setCache(cacheKey, withDeadlines, 300);
        res.json(withDeadlines);
    } catch (err) {
        next(err);
    }
}

export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const projects = await db
            .select({ estValue: airdropProjects.estValue })
            .from(airdropProjects)
            .where(publicPublishFilter);

        let totalValue = 0;
        for (const p of projects) {
            const lowerBound = parseEstValue(p.estValue);
            if (lowerBound > 0) {
                totalValue += lowerBound;
            }
        }

        // DEC-042: hub trust metrics (same path; legacy farm fields kept)
        const publicStats = await getAirdropPublicStats();

        res.json({
            totalValue: Math.round(totalValue),
            walletCount: 0,
            txCount: 0,
            completedTasks: 0,
            projectsScanned: publicStats.projectsScanned,
            recommended: publicStats.recommended,
            underReview: publicStats.underReview,
            notRecommended: publicStats.notRecommended,
            acceptanceRatePercent: publicStats.acceptanceRatePercent,
            lastPipelineAt: publicStats.lastPipelineAt,
        });
    } catch (error) {
        logger.error('[Airdrop] getStats failed:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}

/** DEC-042 AR-1: pure public trust stats (alias of filter metrics) */
export async function getPublicStatsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const stats = await getAirdropPublicStats();
        res.json(stats);
    } catch (err) {
        next(err);
    }
}

/** DEC-042 AR-1: Research Archive list */
export async function listResearchHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const tierRaw = typeof req.query['tier'] === 'string' ? req.query['tier'] : 'not_recommended';
        const tier =
            tierRaw === 'under_review' || tierRaw === 'under-review'
                ? 'under_review'
                : 'not_recommended';
        const page = parseInt(String(req.query['page'] ?? '1'), 10);
        const limit = parseInt(String(req.query['limit'] ?? '20'), 10);

        const result = await listResearchArchive({
            tier,
            page: Number.isFinite(page) ? page : 1,
            limit: Number.isFinite(limit) ? limit : 20,
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
}

/** DEC-042 AR-1: Research Archive detail by slug */
export async function getResearchBySlugHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const slug = String(req.params['slug'] ?? '').trim();
        if (!slug) throw new AppError('Invalid slug', 400);

        const detail = await getResearchBySlug(slug);
        if (!detail) throw new AppError('Research entry not found', 404);

        res.json(detail);
    } catch (err) {
        next(err);
    }
}

/** DEC-042 AR-3 sitemap helper — seoEligible not_recommended only */
export async function listResearchSeoSlugsHandler(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const slugs = await listSeoEligibleResearchSlugs();
        res.json({ slugs });
    } catch (err) {
        next(err);
    }
}

export async function getActivity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    res.json([]);
}

export async function getUrgentAirdrops(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'airdrop:urgent:v1';
        const cached = await getCache(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }

        const projects = await db
            .select({
                id: airdropProjects.id,
                name: airdropProjects.name,
                logoUrl: airdropProjects.logoUrl,
                network: airdropProjects.network,
                estValue: airdropProjects.estValue,
                riskVerdict: airdropProjects.riskVerdict,
                snapshotAt: airdropProjects.snapshotAt,
                tgeAt: airdropProjects.tgeAt,
                createdAt: airdropProjects.createdAt,
                qualityScore: airdropProjects.qualityScore,
            })
            .from(airdropProjects)
            .where(publicPublishFilter);

        const now = new Date();
        const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        const scored = projects.map((p) => {
            const deadline = p.snapshotAt || p.tgeAt;
            const daysLeft = deadline
                ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                : null;
            const isNew = p.createdAt >= fortyEightHoursAgo;

            let urgencyScore = 0;
            if (daysLeft !== null && daysLeft <= 3) urgencyScore += 100;
            if (isNew) urgencyScore += 30;

            return {
                id: p.id,
                name: p.name,
                logoUrl: p.logoUrl ?? null,
                network: p.network,
                estValue: p.estValue ?? null,
                riskVerdict: p.riskVerdict ?? null,
                snapshotAt: p.snapshotAt ?? null,
                tgeAt: p.tgeAt ?? null,
                createdAt: p.createdAt,
                qualityScore: p.qualityScore ?? 0,
                urgencyScore,
                daysLeft,
                isNew,
                progressPercent: 0,
            };
        });

        scored.sort((a, b) => b.urgencyScore - a.urgencyScore);
        const top3 = scored.slice(0, 3);

        const serialized = top3.map((item) => ({
            ...item,
            snapshotAt: item.snapshotAt ? item.snapshotAt.toISOString() : null,
            tgeAt: item.tgeAt ? item.tgeAt.toISOString() : null,
            createdAt: item.createdAt.toISOString(),
        }));

        await setCache(cacheKey, serialized, 60);
        res.json(serialized);
    } catch (err) {
        next(err);
    }
}

export async function getSidebarDeadlines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const projects = await db
            .select({
                id: airdropProjects.id,
                name: airdropProjects.name,
                snapshotAt: airdropProjects.snapshotAt,
                tgeAt: airdropProjects.tgeAt,
            })
            .from(airdropProjects)
            .where(publicPublishFilter)
            .orderBy(asc(airdropProjects.snapshotAt))
            .limit(5);

        const now = new Date();
        const result = projects
            .filter((p) => p.snapshotAt || p.tgeAt)
            .map((p) => {
                const deadline = p.snapshotAt || p.tgeAt;
                const diffMs = deadline!.getTime() - now.getTime();
                const daysLeft = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
                const hoursLeft = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
                const minutesLeft = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
                return {
                    id: String(p.id),
                    name: p.name,
                    deadline: deadline!.toISOString(),
                    daysLeft,
                    countdown: `${String(daysLeft).padStart(2, '0')}D : ${String(hoursLeft).padStart(2, '0')}H : ${String(minutesLeft).padStart(2, '0')}M`,
                    isCritical: daysLeft <= 7,
                };
            })
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .slice(0, 5);

        res.json(result);
    } catch (error) {
        logger.error('[Airdrop] getSidebarDeadlines failed:', error);
        res.status(500).json({ error: 'Failed to fetch deadlines' });
    }
}

export async function getPipelineStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const [latestRun] = await db
            .select()
            .from(airdropPipelineRuns)
            .where(
                sql`${airdropPipelineRuns.runType} IN ('rss_discovery', 'gate_pipeline', 'signal_ingest', 'defillama_discovery')`
            )
            .orderBy(desc(airdropPipelineRuns.runAt))
            .limit(1);

        if (!latestRun) {
            res.json({ lastScan: null, nextScan: null, sources: 0 });
            return;
        }

        const lastScan = latestRun.runAt.toISOString();
        const nextScan = new Date(new Date(lastScan).getTime() + 6 * 60 * 60 * 1000).toISOString();

        res.json({
            lastScan,
            nextScan,
            sources: 0,
        });
    } catch (err) {
        next(err);
    }
}

export async function insertProjectWithQuality(data: {
    name: string;
    network: string;
    estValue?: string;
    aiReport?: string;
    riskVerdict?: string;
    fundingRound?: string;
    twitterUrl?: string;
    discordUrl?: string;
    websiteUrl?: string;
    snapshotAt?: Date | null;
    tgeAt?: Date | null;
}): Promise<number> {
    const quality = calculateAirdropQuality({
        name: data.name,
        network: data.network,
        fundingRound: data.fundingRound,
        twitterUrl: data.twitterUrl,
        discordUrl: data.discordUrl,
        websiteUrl: data.websiteUrl,
        riskVerdict: data.riskVerdict,
        estValue: data.estValue,
    });

    if (!quality.isEligible) {
        throw new Error(`Project ${data.name} does not meet quality threshold (score: ${quality.qualityScore})`);
    }

    const [inserted] = await db
        .insert(airdropProjects)
        .values({
            name: data.name.slice(0, 100),
            network: data.network.slice(0, 50),
            estValue: data.estValue?.slice(0, 255) ?? null,
            aiReport: data.aiReport ?? null,
            riskVerdict: data.riskVerdict ?? 'MEDIUM',
            fundingRound: data.fundingRound?.slice(0, 100) ?? null,
            twitterUrl: data.twitterUrl?.slice(0, 300) ?? null,
            discordUrl: data.discordUrl?.slice(0, 300) ?? null,
            websiteUrl: data.websiteUrl?.slice(0, 300) ?? null,
            ecosystem: quality.ecosystem,
            effortLevel: quality.effortLevel,
            rewardConfidence: quality.rewardConfidence,
            qualityScore: quality.qualityScore,
            isActive: true,
            snapshotAt: data.snapshotAt ?? null,
            tgeAt: data.tgeAt ?? null,
            // AD-4: inserts are not public until Gate pipeline sets auto_publish
            pipelineStatus: 'discovering',
            publishPath: 'none',
        })
        .returning({ id: airdropProjects.id });

    return inserted.id;
}

// Keep buildPortfolioCard export path used by tests if needed
export { buildPortfolioCard };

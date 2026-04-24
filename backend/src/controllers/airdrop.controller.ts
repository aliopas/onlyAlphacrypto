import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { airdropProjects, airdropTasks, userProgress, userWallets, airdropPipelineRuns } from '../models/index';
import { desc, eq, and, sql, count, gt, asc } from 'drizzle-orm';
import { getProjectProgress, verifyTask } from '../services/verification.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { getCache, setCache, deleteCache } from '../config/redis';
import { logger } from '../utils/logger';

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

// GET /api/airdrop/projects
export async function getProjects(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'airdrop:projects';
        let projects = await getCache<Record<string, unknown>[]>(cacheKey);
        if (!projects) {
            projects = await db
                .select()
                .from(airdropProjects)
                .where(eq(airdropProjects.isActive, true))
                .orderBy(desc(airdropProjects.updatedAt));
            await setCache(cacheKey, projects, 300);
        }

        const userId = req.userId;
        if (userId && projects.length > 0) {
            const enriched = await Promise.all(
                projects.map(async (p) => {
                    try {
                        const progress = await getProjectProgress(userId, Number(p.id));
                        return { ...p, progressPercent: progress.percent };
                    } catch {
                        return { ...p, progressPercent: 0 };
                    }
                })
            );
            res.json(enriched);
            return;
        }

        res.json(projects.map((p) => ({ ...p, progressPercent: 0 })));
    } catch (err) { next(err); }
}

// GET /api/airdrop/projects/:id
export async function getProjectById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = parseInt(String(req.params['id']), 10);
        const cacheKey = `airdrop:project:${id}`;
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const [project] = await db.select().from(airdropProjects).where(eq(airdropProjects.id, id));
        if (!project) throw new AppError('Project not found', 404);

        const tasks = await db.select().from(airdropTasks).where(eq(airdropTasks.projectId, id));
        const result = { ...project, tasks };

        await setCache(cacheKey, result, 300);
        res.json(result);
    } catch (err) { next(err); }
}

// POST /api/airdrop/verify/:taskId  (requires auth)
export async function triggerVerification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const taskId = parseInt(String(req.params['taskId']), 10);
        const userId = req.userId!;

        const result = await verifyTask(userId, taskId);
        res.json(result);
    } catch (err) { next(err); }
}

// GET /api/airdrop/projects/:id/progress  (optional auth — returns empty for guests)
export async function getProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const projectId = parseInt(String(req.params['id']), 10);
        const userId = req.userId;
        if (!userId) {
            res.json({ percent: 0, completedCount: 0, totalCount: 0, userProgress: [] });
            return;
        }

        const progress = await getProjectProgress(userId, projectId);

        const tasks = await db
            .select({ id: airdropTasks.id })
            .from(airdropTasks)
            .where(eq(airdropTasks.projectId, projectId));

        const taskIds = tasks.map((t) => t.id);

        const rows = taskIds.length > 0
            ? await db
                .select()
                .from(userProgress)
                .where(
                    and(
                        eq(userProgress.userId, userId),
                        sql`${userProgress.taskId} = ANY(${taskIds})`
                    )
                )
            : [];

        res.json({
            percent: progress.percent,
            completedCount: progress.completedCount,
            totalCount: progress.totalCount,
            userProgress: rows,
        });
    } catch (err) { next(err); }
}

// GET /api/airdrop/deadlines
export async function getDeadlines(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'airdrop:deadlines';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const projects = await db
            .select({
                id: airdropProjects.id,
                name: airdropProjects.name,
                logoUrl: airdropProjects.logoUrl,
                snapshotAt: airdropProjects.snapshotAt,
                tgeAt: airdropProjects.tgeAt,
            })
            .from(airdropProjects)
            .where(eq(airdropProjects.isActive, true));

        const withDeadlines = projects.filter((p) => p.snapshotAt || p.tgeAt);
        await setCache(cacheKey, withDeadlines, 300);
        res.json(withDeadlines);
    } catch (err) { next(err); }
}

// GET /api/airdrop/stats (optional auth — returns defaults for guests)
export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            res.json({ totalValue: 0, walletCount: 0, txCount: 0, completedTasks: 0 });
            return;
        }

        const walletCountResult = await db
            .select({ count: count() })
            .from(userWallets)
            .where(eq(userWallets.userId, userId));

        const txCountResult = await db
            .select({ count: count() })
            .from(userProgress)
            .where(eq(userProgress.userId, userId));

        const completedTasksResult = await db
            .select({ count: count() })
            .from(userProgress)
            .where(and(eq(userProgress.userId, userId), eq(userProgress.completed, true)));

        const activeProjects = await db
            .select({
                id: airdropProjects.id,
                estValue: airdropProjects.estValue,
            })
            .from(airdropProjects)
            .where(eq(airdropProjects.isActive, true));

        let totalValue = 0;
        const progressPromises = activeProjects.map(async (p) => {
            const lowerBound = parseEstValue(p.estValue);
            if (lowerBound <= 0) return 0;
            try {
                const progress = await getProjectProgress(userId, p.id);
                return lowerBound * (progress.percent / 100);
            } catch {
                return 0;
            }
        });
        const values = await Promise.all(progressPromises);
        totalValue = values.reduce((sum, v) => sum + v, 0);

        res.json({
            totalValue: Math.round(totalValue),
            walletCount: walletCountResult[0]?.count ?? 0,
            txCount: txCountResult[0]?.count ?? 0,
            completedTasks: completedTasksResult[0]?.count ?? 0,
        });
    } catch (error) {
        logger.error('[Airdrop] getStats failed:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}

// GET /api/airdrop/activity (optional auth — returns empty for guests)
export async function getActivity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            res.json([]);
            return;
        }

        const activity = await db
            .select({
                id: userProgress.id,
                taskId: userProgress.taskId,
                completed: userProgress.completed,
                completedAt: userProgress.completedAt,
                txHash: userProgress.txHash,
            })
            .from(userProgress)
            .where(eq(userProgress.userId, userId))
            .orderBy(desc(userProgress.completedAt))
            .limit(10);

        const tasks = await db
            .select({
                id: airdropTasks.id,
                description: airdropTasks.description,
                projectId: airdropTasks.projectId,
            })
            .from(airdropTasks)
            .where(
                and(
                    gt(airdropTasks.id, 0),
                    sql`${airdropTasks.id} IN (${sql.join(activity.map(a => a.taskId), sql`, `)})`
                )
            );

        const taskMap = new Map(tasks.map(t => [t.id, t]));

        const projects = await db
            .select({
                id: airdropProjects.id,
                name: airdropProjects.name,
            })
            .from(airdropProjects);

        const projectMap = new Map(projects.map(p => [p.id, p]));

        const result = activity.map(a => {
            const task = taskMap.get(a.taskId);
            const project = task ? projectMap.get(task.projectId) : null;
            return {
                id: String(a.id),
                description: task?.description ?? 'Unknown task',
                projectName: project?.name ?? 'Unknown project',
                completed: a.completed,
                completedAt: a.completedAt?.toISOString() ?? null,
                txHash: a.txHash ?? null,
            };
        });

        res.json(result);
    } catch (error) {
        logger.error('[Airdrop] getActivity failed:', error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
}

// GET /api/airdrop/urgent (optional auth — returns top 3 urgent airdrops)
interface UrgentAirdropItem {
    id: number;
    name: string;
    logoUrl: string | null;
    network: string;
    estValue: string | null;
    riskVerdict: string | null;
    snapshotAt: Date | null;
    tgeAt: Date | null;
    createdAt: Date;
    urgencyScore: number;
    daysLeft: number | null;
    isNew: boolean;
    progressPercent: number;
}

export async function getUrgentAirdrops(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'airdrop:urgent';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

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
            })
            .from(airdropProjects)
            .where(eq(airdropProjects.isActive, true));

        const userId = req.userId;

        const now = new Date();
        const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        const scored: UrgentAirdropItem[] = await Promise.all(
            projects.map(async (p) => {
                const deadline = p.snapshotAt || p.tgeAt;
                const daysLeft = deadline
                    ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                    : null;
                const isNew = p.createdAt >= fortyEightHoursAgo;

                let progressPercent = 0;
                if (userId) {
                    try {
                        const progress = await getProjectProgress(userId, p.id);
                        progressPercent = progress.percent;
                    } catch {
                        progressPercent = 0;
                    }
                }

                let urgencyScore = 0;
                if (daysLeft !== null && daysLeft <= 3) urgencyScore += 100;
                if (isNew) urgencyScore += 30;
                if (daysLeft !== null && progressPercent < 50 && deadline && deadline > now) urgencyScore += 20;

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
                    urgencyScore,
                    daysLeft,
                    isNew,
                    progressPercent,
                };
            })
        );

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
    } catch (err) { next(err); }
}

// GET /api/airdrop/sidebar-deadlines (requires auth)
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
            .where(eq(airdropProjects.isActive, true))
            .orderBy(asc(airdropProjects.snapshotAt))
            .limit(5);

        const now = new Date();
        const result = projects
            .filter(p => p.snapshotAt || p.tgeAt)
            .map(p => {
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

// GET /api/airdrop/pipeline-status
export async function getPipelineStatusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const [latestRun] = await db.select()
            .from(airdropPipelineRuns)
            .where(eq(airdropPipelineRuns.runType, 'rss_discovery'))
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
            sources: 5,
        });
    } catch (err) { next(err); }
}

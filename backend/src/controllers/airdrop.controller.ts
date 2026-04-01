import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { airdropProjects, airdropTasks, userProgress, userWallets } from '../models/index';
import { desc, eq, and, sql, count, gt, asc } from 'drizzle-orm';
import { getProjectProgress, verifyTask } from '../services/verification.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { getCache, setCache, deleteCache } from '../config/redis';
import { logger } from '../utils/logger';

// GET /api/airdrop/projects
export async function getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const cacheKey = 'airdrop:projects';
        const cached = await getCache(cacheKey);
        if (cached) { res.json(cached); return; }

        const projects = await db
            .select()
            .from(airdropProjects)
            .where(eq(airdropProjects.isActive, true))
            .orderBy(desc(airdropProjects.updatedAt));

        await setCache(cacheKey, projects, 300);
        res.json(projects);
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

// GET /api/airdrop/projects/:id/progress  (requires auth)
export async function getProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const projectId = parseInt(String(req.params['id']), 10);
        const userId = req.userId!;

        const progress = await getProjectProgress(userId, projectId);
        res.json(progress);
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

// GET /api/airdrop/stats (requires auth)
export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
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

        res.json({
            totalValue: 0,
            walletCount: walletCountResult[0]?.count ?? 0,
            txCount: txCountResult[0]?.count ?? 0,
            completedTasks: completedTasksResult[0]?.count ?? 0,
        });
    } catch (error) {
        logger.error('[Airdrop] getStats failed:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}

// GET /api/airdrop/activity (requires auth)
export async function getActivity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
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

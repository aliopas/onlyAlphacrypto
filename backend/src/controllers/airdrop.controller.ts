import { Request, Response, NextFunction } from 'express';
import { db } from '../config/db';
import { airdropProjects, airdropTasks, userProgress } from '../models/index';
import { desc, eq, and } from 'drizzle-orm';
import { getProjectProgress, verifyTask } from '../services/verification.service';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { getCache, setCache, deleteCache } from '../config/redis';

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

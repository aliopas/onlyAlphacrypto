import { and, count, desc, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../config/db';
import {
    airdropEntities,
    airdropEntityAliases,
    airdropEvidenceArtifacts,
    airdropMoodSnapshots,
    airdropPipelineRuns,
    airdropProjects,
    airdropSignals,
    type AirdropEntity,
} from '../models/airdrop.model';
import { normalizeAlias, normalizeSlug } from './entityResolve.service';
import { deleteCache, deleteCachePattern } from '../config/redis';

export interface PipelineMetrics {
    runsLast7d: number;
    runsByType: Array<{ runType: string; count: number }>;
    recentRuns: Array<{
        id: number;
        runType: string;
        runAt: string;
        articlesFound: number | null;
        articlesProcessed: number | null;
        projectsInserted: number | null;
        projectsRejected: number | null;
        errors: number | null;
        durationMs: number | null;
        notes: string | null;
    }>;
    projectOutcomes: {
        activeAutoPublish: number;
        holdRecheck: number;
        rejected: number;
        discovering: number;
        archived: number;
        inactive: number;
        total: number;
    };
    entityCount: number;
    signalCount7d: number;
}

export async function getAirdropPipelineMetrics(): Promise<PipelineMetrics> {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentRunsRaw = await db
        .select()
        .from(airdropPipelineRuns)
        .orderBy(desc(airdropPipelineRuns.runAt))
        .limit(30);

    const runsLast7d = recentRunsRaw.filter((r) => r.runAt >= since7d).length;

    const byTypeMap = new Map<string, number>();
    for (const r of recentRunsRaw) {
        if (r.runAt < since7d) continue;
        byTypeMap.set(r.runType, (byTypeMap.get(r.runType) ?? 0) + 1);
    }

    const statusRows = await db
        .select({
            pipelineStatus: airdropProjects.pipelineStatus,
            publishPath: airdropProjects.publishPath,
            isActive: airdropProjects.isActive,
            cnt: count(),
        })
        .from(airdropProjects)
        .groupBy(
            airdropProjects.pipelineStatus,
            airdropProjects.publishPath,
            airdropProjects.isActive
        );

    const outcomes = {
        activeAutoPublish: 0,
        holdRecheck: 0,
        rejected: 0,
        discovering: 0,
        archived: 0,
        inactive: 0,
        total: 0,
    };

    for (const row of statusRows) {
        const n = Number(row.cnt);
        outcomes.total += n;
        if (row.isActive === false) outcomes.inactive += n;
        if (row.pipelineStatus === 'active' && row.publishPath === 'auto_publish') {
            outcomes.activeAutoPublish += n;
        } else if (row.pipelineStatus === 'hold_recheck') {
            outcomes.holdRecheck += n;
        } else if (row.pipelineStatus === 'rejected') {
            outcomes.rejected += n;
        } else if (row.pipelineStatus === 'discovering') {
            outcomes.discovering += n;
        } else if (row.pipelineStatus === 'archived') {
            outcomes.archived += n;
        }
    }

    const [entityCountRow] = await db.select({ cnt: count() }).from(airdropEntities);
    const [signalCountRow] = await db
        .select({ cnt: count() })
        .from(airdropSignals)
        .where(gte(airdropSignals.createdAt, since7d));

    return {
        runsLast7d,
        runsByType: Array.from(byTypeMap.entries()).map(([runType, c]) => ({
            runType,
            count: c,
        })),
        recentRuns: recentRunsRaw.slice(0, 20).map((r) => ({
            id: r.id,
            runType: r.runType,
            runAt: r.runAt.toISOString(),
            articlesFound: r.articlesFound,
            articlesProcessed: r.articlesProcessed,
            projectsInserted: r.projectsInserted,
            projectsRejected: r.projectsRejected,
            errors: r.errors,
            durationMs: r.durationMs,
            notes: r.notes,
        })),
        projectOutcomes: outcomes,
        entityCount: Number(entityCountRow?.cnt ?? 0),
        signalCount7d: Number(signalCountRow?.cnt ?? 0),
    };
}

export interface AdminProjectRow {
    id: number;
    name: string;
    network: string;
    isActive: boolean | null;
    pipelineStatus: string;
    publishPath: string;
    qualityScore: number | null;
    riskVerdict: string | null;
    entityId: number | null;
    updatedAt: string;
}

export async function listAdminAirdropProjects(params: {
    pipelineStatus?: string;
    limit?: number;
}): Promise<AdminProjectRow[]> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

    let rows;
    if (params.pipelineStatus) {
        rows = await db
            .select({
                id: airdropProjects.id,
                name: airdropProjects.name,
                network: airdropProjects.network,
                isActive: airdropProjects.isActive,
                pipelineStatus: airdropProjects.pipelineStatus,
                publishPath: airdropProjects.publishPath,
                qualityScore: airdropProjects.qualityScore,
                riskVerdict: airdropProjects.riskVerdict,
                entityId: airdropProjects.entityId,
                updatedAt: airdropProjects.updatedAt,
            })
            .from(airdropProjects)
            .where(
                eq(
                    airdropProjects.pipelineStatus,
                    params.pipelineStatus as
                        | 'discovering'
                        | 'hold_recheck'
                        | 'rejected'
                        | 'active'
                        | 'archived'
                )
            )
            .orderBy(desc(airdropProjects.updatedAt))
            .limit(limit);
    } else {
        rows = await db
            .select({
                id: airdropProjects.id,
                name: airdropProjects.name,
                network: airdropProjects.network,
                isActive: airdropProjects.isActive,
                pipelineStatus: airdropProjects.pipelineStatus,
                publishPath: airdropProjects.publishPath,
                qualityScore: airdropProjects.qualityScore,
                riskVerdict: airdropProjects.riskVerdict,
                entityId: airdropProjects.entityId,
                updatedAt: airdropProjects.updatedAt,
            })
            .from(airdropProjects)
            .orderBy(desc(airdropProjects.updatedAt))
            .limit(limit);
    }

    return rows.map((r) => ({
        ...r,
        updatedAt: r.updatedAt.toISOString(),
    }));
}

async function bustPublicAirdropCache(): Promise<void> {
    try {
        await deleteCache('airdrop:projects');
        await deleteCache('airdrop:projects:portfolio:v1');
        await deleteCache('airdrop:deadlines');
        await deleteCache('airdrop:deadlines:v1');
        await deleteCache('airdrop:urgent:v1');
        await deleteCachePattern('airdrop:project:*');
    } catch {
        // non-blocking
    }
}

/**
 * Kill-switch: deactivate project + archive pipeline (emergency ops, not trust queue).
 */
export async function killSwitchDeactivateProject(projectId: number): Promise<{
    id: number;
    name: string;
    isActive: boolean;
    pipelineStatus: string;
}> {
    const existing = await db
        .select()
        .from(airdropProjects)
        .where(eq(airdropProjects.id, projectId))
        .limit(1);

    if (existing.length === 0) {
        throw new Error('PROJECT_NOT_FOUND');
    }

    const prev = existing[0];
    const provenance =
        prev.provenanceSummary && typeof prev.provenanceSummary === 'object'
            ? { ...prev.provenanceSummary }
            : {};

    const updated = await db
        .update(airdropProjects)
        .set({
            isActive: false,
            pipelineStatus: 'archived',
            // keep publishPath for audit trail; public filter requires isActive+active+auto_publish
            provenanceSummary: {
                ...provenance,
                killSwitchAt: new Date().toISOString(),
                killSwitchPrev: {
                    isActive: prev.isActive,
                    pipelineStatus: prev.pipelineStatus,
                    publishPath: prev.publishPath,
                },
            },
            updatedAt: new Date(),
        })
        .where(eq(airdropProjects.id, projectId))
        .returning();

    await bustPublicAirdropCache();

    const row = updated[0];
    return {
        id: row.id,
        name: row.name,
        isActive: row.isActive ?? false,
        pipelineStatus: row.pipelineStatus,
    };
}

export interface EntityAdminRow {
    id: number;
    canonicalName: string;
    slug: string;
    defillamaSlug: string | null;
    aliasCount: number;
    projectCount: number;
    signalCount: number;
    updatedAt: string;
}

export async function listAdminEntities(limit = 50): Promise<EntityAdminRow[]> {
    const entities = await db
        .select()
        .from(airdropEntities)
        .orderBy(desc(airdropEntities.updatedAt))
        .limit(Math.min(Math.max(limit, 1), 200));

    const result: EntityAdminRow[] = [];
    for (const e of entities) {
        const [aliasCnt] = await db
            .select({ cnt: count() })
            .from(airdropEntityAliases)
            .where(eq(airdropEntityAliases.entityId, e.id));
        const [projCnt] = await db
            .select({ cnt: count() })
            .from(airdropProjects)
            .where(eq(airdropProjects.entityId, e.id));
        const [sigCnt] = await db
            .select({ cnt: count() })
            .from(airdropSignals)
            .where(eq(airdropSignals.entityId, e.id));

        result.push({
            id: e.id,
            canonicalName: e.canonicalName,
            slug: e.slug,
            defillamaSlug: e.defillamaSlug,
            aliasCount: Number(aliasCnt?.cnt ?? 0),
            projectCount: Number(projCnt?.cnt ?? 0),
            signalCount: Number(sigCnt?.cnt ?? 0),
            updatedAt: e.updatedAt.toISOString(),
        });
    }
    return result;
}

export async function getEntityDetail(entityId: number): Promise<{
    entity: AirdropEntity;
    aliases: Array<{
        id: number;
        alias: string;
        normalizedAlias: string;
        source: string;
        createdAt: string;
    }>;
} | null> {
    const rows = await db
        .select()
        .from(airdropEntities)
        .where(eq(airdropEntities.id, entityId))
        .limit(1);
    if (rows.length === 0) return null;

    const aliases = await db
        .select()
        .from(airdropEntityAliases)
        .where(eq(airdropEntityAliases.entityId, entityId))
        .orderBy(desc(airdropEntityAliases.id));

    return {
        entity: rows[0],
        aliases: aliases.map((a) => ({
            id: a.id,
            alias: a.alias,
            normalizedAlias: a.normalizedAlias,
            source: a.source,
            createdAt: a.createdAt.toISOString(),
        })),
    };
}

export async function addEntityAlias(params: {
    entityId: number;
    alias: string;
}): Promise<{ id: number; alias: string; normalizedAlias: string }> {
    const alias = params.alias.trim();
    if (alias.length < 2) throw new Error('ALIAS_TOO_SHORT');

    const entity = await db
        .select()
        .from(airdropEntities)
        .where(eq(airdropEntities.id, params.entityId))
        .limit(1);
    if (entity.length === 0) throw new Error('ENTITY_NOT_FOUND');

    const normalized = normalizeAlias(alias);
    if (!normalized) throw new Error('ALIAS_INVALID');

    try {
        const inserted = await db
            .insert(airdropEntityAliases)
            .values({
                entityId: params.entityId,
                alias: alias.slice(0, 255),
                normalizedAlias: normalized,
                source: 'admin',
            })
            .returning();
        return {
            id: inserted[0].id,
            alias: inserted[0].alias,
            normalizedAlias: inserted[0].normalizedAlias,
        };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('unique') || msg.includes('duplicate')) {
            throw new Error('ALIAS_EXISTS');
        }
        throw err;
    }
}

/**
 * Merge source entity into target: reassign FKs, move aliases, delete source.
 * Never auto — admin only.
 */
export async function mergeEntities(params: {
    targetEntityId: number;
    sourceEntityId: number;
}): Promise<{ targetId: number; sourceId: number; moved: Record<string, number> }> {
    const { targetEntityId, sourceEntityId } = params;
    if (targetEntityId === sourceEntityId) {
        throw new Error('SAME_ENTITY');
    }

    const targets = await db
        .select()
        .from(airdropEntities)
        .where(inArray(airdropEntities.id, [targetEntityId, sourceEntityId]));

    if (targets.length !== 2) {
        throw new Error('ENTITY_NOT_FOUND');
    }

    const target = targets.find((e) => e.id === targetEntityId)!;
    const source = targets.find((e) => e.id === sourceEntityId)!;

    // Reassign FKs
    const sig = await db
        .update(airdropSignals)
        .set({ entityId: targetEntityId, updatedAt: new Date() })
        .where(eq(airdropSignals.entityId, sourceEntityId))
        .returning({ id: airdropSignals.id });

    const proj = await db
        .update(airdropProjects)
        .set({ entityId: targetEntityId, updatedAt: new Date() })
        .where(eq(airdropProjects.entityId, sourceEntityId))
        .returning({ id: airdropProjects.id });

    const art = await db
        .update(airdropEvidenceArtifacts)
        .set({ entityId: targetEntityId, updatedAt: new Date() })
        .where(eq(airdropEvidenceArtifacts.entityId, sourceEntityId))
        .returning({ id: airdropEvidenceArtifacts.id });

    // Mood snapshots: move or drop duplicates — delete source moods (recompute later)
    const moodDel = await db
        .delete(airdropMoodSnapshots)
        .where(eq(airdropMoodSnapshots.entityId, sourceEntityId))
        .returning({ id: airdropMoodSnapshots.id });

    // Move aliases (handle unique conflicts)
    const sourceAliases = await db
        .select()
        .from(airdropEntityAliases)
        .where(eq(airdropEntityAliases.entityId, sourceEntityId));

    let aliasesMoved = 0;
    for (const a of sourceAliases) {
        try {
            await db
                .update(airdropEntityAliases)
                .set({ entityId: targetEntityId })
                .where(eq(airdropEntityAliases.id, a.id));
            aliasesMoved += 1;
        } catch {
            // duplicate normalized on target — drop source alias
            await db.delete(airdropEntityAliases).where(eq(airdropEntityAliases.id, a.id));
        }
    }

    // Keep source canonical name as alias on target
    const srcNorm = normalizeAlias(source.canonicalName);
    if (srcNorm) {
        try {
            await db.insert(airdropEntityAliases).values({
                entityId: targetEntityId,
                alias: source.canonicalName.slice(0, 255),
                normalizedAlias: srcNorm,
                source: 'admin',
            });
            aliasesMoved += 1;
        } catch {
            // already exists
        }
    }

    // Prefer defillama slug from either
    if (!target.defillamaSlug && source.defillamaSlug) {
        await db
            .update(airdropEntities)
            .set({ defillamaSlug: source.defillamaSlug, updatedAt: new Date() })
            .where(eq(airdropEntities.id, targetEntityId));
    }

    await db.delete(airdropEntities).where(eq(airdropEntities.id, sourceEntityId));
    await bustPublicAirdropCache();

    return {
        targetId: targetEntityId,
        sourceId: sourceEntityId,
        moved: {
            signals: sig.length,
            projects: proj.length,
            artifacts: art.length,
            moodsDeleted: moodDel.length,
            aliases: aliasesMoved,
        },
    };
}

/**
 * Split: create new entity from alias string and optionally reassign nothing by default.
 * Admin provides newCanonicalName; optional moveAliasId.
 */
export async function splitEntity(params: {
    sourceEntityId: number;
    newCanonicalName: string;
    moveAliasIds?: number[];
}): Promise<{ newEntityId: number; slug: string }> {
    const name = params.newCanonicalName.trim();
    if (name.length < 2) throw new Error('NAME_TOO_SHORT');

    const source = await db
        .select()
        .from(airdropEntities)
        .where(eq(airdropEntities.id, params.sourceEntityId))
        .limit(1);
    if (source.length === 0) throw new Error('ENTITY_NOT_FOUND');

    let slug = normalizeSlug(name);
    if (!slug) throw new Error('SLUG_INVALID');

    // Ensure unique slug
    const existingSlug = await db
        .select()
        .from(airdropEntities)
        .where(eq(airdropEntities.slug, slug))
        .limit(1);
    if (existingSlug.length > 0) {
        slug = `${slug}-${Date.now().toString(36)}`.slice(0, 255);
    }

    const inserted = await db
        .insert(airdropEntities)
        .values({
            canonicalName: name.slice(0, 255),
            slug,
            updatedAt: new Date(),
        })
        .returning();

    const newEntity = inserted[0];
    const norm = normalizeAlias(name);
    if (norm) {
        try {
            await db.insert(airdropEntityAliases).values({
                entityId: newEntity.id,
                alias: name.slice(0, 255),
                normalizedAlias: norm,
                source: 'admin',
            });
        } catch {
            // ignore
        }
    }

    if (params.moveAliasIds && params.moveAliasIds.length > 0) {
        await db
            .update(airdropEntityAliases)
            .set({ entityId: newEntity.id })
            .where(
                and(
                    eq(airdropEntityAliases.entityId, params.sourceEntityId),
                    inArray(airdropEntityAliases.id, params.moveAliasIds)
                )
            );
    }

    return { newEntityId: newEntity.id, slug: newEntity.slug };
}

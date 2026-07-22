import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import {
    airdropEntities,
    airdropEntityAliases,
    type AirdropAliasSource,
    type AirdropEntity,
} from '../models/airdrop.model';

const STOP_NAMES = new Set([
    'airdrop',
    'airdrops',
    'crypto',
    'token',
    'tokens',
    'claim',
    'snapshot',
    'tge',
    'the',
    'new',
    'free',
    'official',
    'mainnet',
    'testnet',
    'protocol',
    'project',
    'network',
    'layer',
    'bridge',
    'wallet',
    'how',
    'what',
    'this',
    'that',
    'with',
    'from',
    'into',
    'about',
]);

/**
 * Normalize alias/slug for entity resolution (G4).
 * Lowercase, strip diacritics-ish noise, keep alphanumerics.
 */
export function normalizeAlias(raw: string): string {
    return raw
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

export function normalizeSlug(raw: string): string {
    const cleaned = raw
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
    return cleaned.slice(0, 255);
}

export function isUsableEntityName(name: string): boolean {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) return false;
    const norm = normalizeAlias(trimmed);
    if (norm.length < 2) return false;
    if (STOP_NAMES.has(norm)) return false;
    return true;
}

export async function findEntityByNormalizedAlias(
    normalized: string
): Promise<AirdropEntity | null> {
    if (!normalized) return null;

    const aliasHit = await db
        .select({
            id: airdropEntities.id,
            canonicalName: airdropEntities.canonicalName,
            slug: airdropEntities.slug,
            defillamaSlug: airdropEntities.defillamaSlug,
            createdAt: airdropEntities.createdAt,
            updatedAt: airdropEntities.updatedAt,
        })
        .from(airdropEntityAliases)
        .innerJoin(airdropEntities, eq(airdropEntityAliases.entityId, airdropEntities.id))
        .where(eq(airdropEntityAliases.normalizedAlias, normalized))
        .limit(1);

    if (aliasHit.length > 0) {
        return aliasHit[0];
    }

    const slugHit = await db
        .select()
        .from(airdropEntities)
        .where(eq(airdropEntities.slug, normalizeSlug(normalized)))
        .limit(1);

    return slugHit[0] ?? null;
}

export async function findEntityBySlug(slug: string): Promise<AirdropEntity | null> {
    const rows = await db
        .select()
        .from(airdropEntities)
        .where(eq(airdropEntities.slug, slug))
        .limit(1);
    return rows[0] ?? null;
}

export interface ResolveEntityResult {
    entity: AirdropEntity;
    created: boolean;
    /** True when name was weak/ambiguous — caller must not auto-merge elsewhere */
    lowConfidence: boolean;
}

/**
 * Resolve order (G4 v1): exact alias → normalized slug → create entity+alias.
 * Never auto-merges distinct entities (no fuzzy merge).
 */
export async function resolveOrCreateEntity(
    displayName: string,
    aliasSource: AirdropAliasSource = 'ingest'
): Promise<ResolveEntityResult | null> {
    const name = displayName.trim();
    if (!isUsableEntityName(name)) {
        return null;
    }

    const normalized = normalizeAlias(name);
    const existing = await findEntityByNormalizedAlias(normalized);
    if (existing) {
        return { entity: existing, created: false, lowConfidence: false };
    }

    const slug = normalizeSlug(name);
    if (!slug) return null;

    const bySlug = await findEntityBySlug(slug);
    if (bySlug) {
        await ensureAlias(bySlug.id, name, normalized, aliasSource);
        return { entity: bySlug, created: false, lowConfidence: false };
    }

    try {
        const inserted = await db
            .insert(airdropEntities)
            .values({
                canonicalName: name.slice(0, 255),
                slug,
                updatedAt: new Date(),
            })
            .returning();

        const entity = inserted[0];
        await ensureAlias(entity.id, name, normalized, aliasSource);
        return { entity, created: true, lowConfidence: false };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('unique') || msg.includes('duplicate')) {
            const raced = await findEntityBySlug(slug);
            if (raced) {
                await ensureAlias(raced.id, name, normalized, aliasSource);
                return { entity: raced, created: false, lowConfidence: false };
            }
            const byAlias = await findEntityByNormalizedAlias(normalized);
            if (byAlias) {
                return { entity: byAlias, created: false, lowConfidence: false };
            }
        }
        throw err;
    }
}

async function ensureAlias(
    entityId: number,
    alias: string,
    normalizedAlias: string,
    source: AirdropAliasSource
): Promise<void> {
    if (!normalizedAlias) return;

    try {
        await db
            .insert(airdropEntityAliases)
            .values({
                entityId,
                alias: alias.slice(0, 255),
                normalizedAlias,
                source,
            })
            .onConflictDoNothing({ target: airdropEntityAliases.normalizedAlias });
    } catch {
        // Unique race — ignore
    }
}

/**
 * Heuristic candidate names from free text (no AI).
 * Prefers $TICKER and TitleCase tokens near airdrop keywords.
 */
export function extractCandidateNames(text: string): string[] {
    const candidates: string[] = [];
    const seen = new Set<string>();

    const push = (raw: string): void => {
        const cleaned = raw.replace(/[^a-zA-Z0-9 ._-]/g, '').trim();
        if (!isUsableEntityName(cleaned)) return;
        const key = normalizeAlias(cleaned);
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push(cleaned);
    };

    const tickerRe = /\$([A-Z][A-Z0-9]{1,9})\b/g;
    let m: RegExpExecArray | null;
    while ((m = tickerRe.exec(text)) !== null) {
        push(m[1]);
    }

    const nearKeyword =
        /\b([A-Z][a-zA-Z0-9]{2,}(?:\s+[A-Z][a-zA-Z0-9]{1,}){0,2})\s+(?:airdrop|Airdrop|AIRDROP|snapshot|TGE|claim|token)\b/g;
    while ((m = nearKeyword.exec(text)) !== null) {
        push(m[1]);
    }

    const leading =
        /(?:airdrop|Airdrop|claim|snapshot|TGE)\s+(?:for|on|of|from|by)?\s*([A-Z][a-zA-Z0-9]{2,}(?:\s+[A-Z][a-zA-Z0-9]{1,}){0,2})/g;
    while ((m = leading.exec(text)) !== null) {
        push(m[1]);
    }

    return candidates.slice(0, 5);
}

import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { db } from '../config/db';
import {
    contentSources,
    type ContentSource,
    type ContentSourceKind,
    type ContentSourcePurpose,
} from '../models/airdrop.model';

export interface ListContentSourcesFilter {
    kind?: ContentSourceKind;
    purpose?: ContentSourcePurpose;
    enabled?: boolean;
}

export async function listContentSources(
    filter: ListContentSourcesFilter = {}
): Promise<ContentSource[]> {
    const conditions: SQL[] = [];

    if (filter.kind !== undefined) {
        conditions.push(eq(contentSources.kind, filter.kind));
    }
    if (filter.purpose !== undefined) {
        conditions.push(eq(contentSources.purpose, filter.purpose));
    }
    if (filter.enabled !== undefined) {
        conditions.push(eq(contentSources.enabled, filter.enabled));
    }

    if (conditions.length === 0) {
        return db.select().from(contentSources).orderBy(desc(contentSources.id));
    }

    return db
        .select()
        .from(contentSources)
        .where(and(...conditions))
        .orderBy(desc(contentSources.id));
}

export async function listEnabledAirdropSources(params: {
    kind: ContentSourceKind;
    purposes?: ContentSourcePurpose[];
}): Promise<ContentSource[]> {
    const purposes = params.purposes ?? ['airdrop_alpha', 'airdrop_community'];
    const conditions = [
        eq(contentSources.kind, params.kind),
        eq(contentSources.enabled, true),
        inArray(contentSources.purpose, purposes),
    ];

    return db
        .select()
        .from(contentSources)
        .where(and(...conditions))
        .orderBy(desc(contentSources.id));
}

export function serializeContentSource(row: ContentSource): {
    id: number;
    kind: ContentSourceKind;
    purpose: ContentSourcePurpose;
    identifier: string;
    title: string | null;
    enabled: boolean;
    lastCursor: string | null;
    notes: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
} {
    return {
        id: row.id,
        kind: row.kind,
        purpose: row.purpose,
        identifier: row.identifier,
        title: row.title,
        enabled: row.enabled,
        lastCursor: row.lastCursor,
        notes: row.notes,
        metadata: row.metadata ?? null,
        createdAt: row.createdAt ? row.createdAt.toISOString() : '',
        updatedAt: row.updatedAt ? row.updatedAt.toISOString() : '',
    };
}

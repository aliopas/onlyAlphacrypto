import {
    pgTable, serial, varchar, text, timestamp,
    boolean, integer, real, jsonb, pgEnum, unique,
} from 'drizzle-orm/pg-core';
import { users, userWallets } from './user.model';

// ─── DEC-041 AD-0 enums ───────────────────────────────────────────────────────

export const contentSourceKindEnum = pgEnum('content_source_kind', [
    'telegram',
    'rss',
    'system',
]);

export const contentSourcePurposeEnum = pgEnum('content_source_purpose', [
    'airdrop_alpha',
    'airdrop_community',
    'news',
    'market_context',
]);

export const airdropAliasSourceEnum = pgEnum('airdrop_alias_source', [
    'ingest',
    'admin',
    'ai',
]);

export const airdropPipelineStatusEnum = pgEnum('airdrop_pipeline_status', [
    'discovering',
    'hold_recheck',
    'rejected',
    'active',
    'archived',
]);

export const airdropPublishPathEnum = pgEnum('airdrop_publish_path', [
    'none',
    'auto_publish',
    'hold_recheck',
    'reject',
    'admin_force',
]);

export const airdropEvidenceFetchStatusEnum = pgEnum('airdrop_evidence_fetch_status', [
    'pending',
    'ok',
    'failed',
    'skipped',
]);

export const airdropMoodWindowEnum = pgEnum('airdrop_mood_window', [
    '24h',
    '7d',
]);

export const airdropMoodLabelEnum = pgEnum('airdrop_mood_label', [
    'cold',
    'warming',
    'hot',
    'toxic',
]);

// ─── content_sources ──────────────────────────────────────────────────────────

export const contentSources = pgTable('content_sources', {
    id: serial('id').primaryKey(),
    kind: contentSourceKindEnum('kind').notNull(),
    purpose: contentSourcePurposeEnum('purpose').notNull(),
    identifier: varchar('identifier', { length: 500 }).notNull(),
    title: varchar('title', { length: 255 }),
    enabled: boolean('enabled').notNull().default(true),
    lastCursor: varchar('last_cursor', { length: 100 }),
    notes: text('notes'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
    unique('content_sources_kind_identifier_unique').on(t.kind, t.identifier),
]);

// ─── airdrop_entities ─────────────────────────────────────────────────────────

export const airdropEntities = pgTable('airdrop_entities', {
    id: serial('id').primaryKey(),
    canonicalName: varchar('canonical_name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    defillamaSlug: varchar('defillama_slug', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── airdrop_entity_aliases ───────────────────────────────────────────────────

export const airdropEntityAliases = pgTable('airdrop_entity_aliases', {
    id: serial('id').primaryKey(),
    entityId: integer('entity_id').references(() => airdropEntities.id, { onDelete: 'cascade' }).notNull(),
    alias: varchar('alias', { length: 255 }).notNull(),
    normalizedAlias: varchar('normalized_alias', { length: 255 }).notNull().unique(),
    source: airdropAliasSourceEnum('source').notNull().default('ingest'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── AIRDROP PROJECTS ─────────────────────────────────────────────────────────
export const airdropProjects = pgTable('airdrop_projects', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),              // 'ZkSync Era'
    network: varchar('network', { length: 50 }).notNull(),          // 'Mainnet' | 'Testnet'
    logoUrl: varchar('logo_url', { length: 500 }),
    estValue: varchar('est_value', { length: 255 }),                 // '$1,200'
    aiReport: text('ai_report'),                                    // Full AI audit (for Drawer)
    riskVerdict: varchar('risk_verdict', { length: 20 }),           // 'LOW' | 'MEDIUM' | 'HIGH' | 'SCAM'
    fundingRound: varchar('funding_round', { length: 100 }),        // 'Series A – $50M'
    twitterUrl: varchar('twitter_url', { length: 300 }),
    discordUrl: varchar('discord_url', { length: 300 }),
    websiteUrl: varchar('website_url', { length: 300 }),
    snapshotAt: timestamp('snapshot_at'),
    tgeAt: timestamp('tge_at'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    ecosystem: varchar('ecosystem', { length: 20 }),
    effortLevel: varchar('effort_level', { length: 10 }),
    rewardConfidence: varchar('reward_confidence', { length: 20 }),
    qualityScore: integer('quality_score').default(0),
    entityId: integer('entity_id').references(() => airdropEntities.id, { onDelete: 'set null' }),
    pipelineStatus: airdropPipelineStatusEnum('pipeline_status').notNull().default('discovering'),
    publishPath: airdropPublishPathEnum('publish_path').notNull().default('none'),
    provenanceSummary: jsonb('provenance_summary').$type<Record<string, unknown>>().default({}),
});

// ─── airdrop_signals ──────────────────────────────────────────────────────────

export const airdropSignals = pgTable('airdrop_signals', {
    id: serial('id').primaryKey(),
    entityId: integer('entity_id').references(() => airdropEntities.id, { onDelete: 'set null' }),
    sourceId: integer('source_id').references(() => contentSources.id, { onDelete: 'set null' }),
    sourceHash: varchar('source_hash', { length: 64 }).notNull().unique(),
    externalId: varchar('external_id', { length: 255 }),
    title: text('title'),
    body: text('body'),
    url: varchar('url', { length: 1000 }),
    publishedAt: timestamp('published_at'),
    signalKind: varchar('signal_kind', { length: 50 }),
    extractedDates: jsonb('extracted_dates').$type<unknown[]>().default([]),
    extractedUrls: jsonb('extracted_urls').$type<string[]>().default([]),
    claims: jsonb('claims').$type<unknown[]>().default([]),
    rawRef: jsonb('raw_ref').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── airdrop_evidence_artifacts ───────────────────────────────────────────────

export const airdropEvidenceArtifacts = pgTable('airdrop_evidence_artifacts', {
    id: serial('id').primaryKey(),
    entityId: integer('entity_id').references(() => airdropEntities.id, { onDelete: 'set null' }),
    projectId: integer('project_id').references(() => airdropProjects.id, { onDelete: 'set null' }),
    signalId: integer('signal_id').references(() => airdropSignals.id, { onDelete: 'set null' }),
    artifactType: varchar('artifact_type', { length: 50 }).notNull(),
    url: varchar('url', { length: 1000 }),
    title: text('title'),
    contentText: text('content_text'),
    fetchStatus: airdropEvidenceFetchStatusEnum('fetch_status').notNull().default('pending'),
    sourceHash: varchar('source_hash', { length: 64 }),
    provenance: jsonb('provenance').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── airdrop_mood_snapshots ───────────────────────────────────────────────────

export const airdropMoodSnapshots = pgTable('airdrop_mood_snapshots', {
    id: serial('id').primaryKey(),
    entityId: integer('entity_id').references(() => airdropEntities.id, { onDelete: 'cascade' }).notNull(),
    moodWindow: airdropMoodWindowEnum('mood_window').notNull(),
    mentionCount: integer('mention_count').notNull().default(0),
    uniqueSourceCount: integer('unique_source_count').notNull().default(0),
    hypeScore: real('hype_score').notNull().default(0),
    fudScore: real('fud_score').notNull().default(0),
    dateSignals: jsonb('date_signals').$type<unknown[]>().notNull().default([]),
    controversyFlag: boolean('controversy_flag').notNull().default(false),
    moodLabel: airdropMoodLabelEnum('mood_label').notNull().default('cold'),
    computedAt: timestamp('computed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── AIRDROP TASKS ────────────────────────────────────────────────────────────
export const airdropTasks = pgTable('airdrop_tasks', {
    id: serial('id').primaryKey(),
    projectId: integer('project_id').references(() => airdropProjects.id, { onDelete: 'cascade' }).notNull(),
    description: text('description').notNull(),                    // 'Bridge 0.5 ETH to Mainnet'
    contractAddress: varchar('contract_address', { length: 100 }), // For auto-verification
    minAmount: real('min_amount'),                                  // e.g. 0.5 (ETH)
    tokenSymbol: varchar('token_symbol', { length: 20 }),           // 'ETH'
    chain: varchar('chain', { length: 50 }),                        // 'zksync'
    isAutoVerifiable: boolean('is_auto_verifiable').default(false),
    orderIndex: integer('order_index').default(0),
});

// ─── USER PROGRESS ────────────────────────────────────────────────────────────
export const userProgress = pgTable('user_progress', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    taskId: integer('task_id').references(() => airdropTasks.id, { onDelete: 'cascade' }).notNull(),
    walletId: integer('wallet_id').references(() => userWallets.id),
    completed: boolean('completed').default(false),
    completedAt: timestamp('completed_at'),
    verifiedBy: varchar('verified_by', { length: 20 }).default('auto'), // 'auto' | 'manual'
    txHash: varchar('tx_hash', { length: 100 }),
});

// ─── AIRDROP PIPELINE RUNS (Health Monitoring) ────────────────────────────────
export const airdropPipelineRuns = pgTable('airdrop_pipeline_runs', {
    id: serial('id').primaryKey(),
    runType: varchar('run_type', { length: 20 }).notNull(),
    runAt: timestamp('run_at').defaultNow().notNull(),
    articlesFound: integer('articles_found').default(0),
    articlesProcessed: integer('articles_processed').default(0),
    projectsInserted: integer('projects_inserted').default(0),
    projectsRejected: integer('projects_rejected').default(0),
    errors: integer('errors').default(0),
    durationMs: integer('duration_ms').default(0),
    notes: text('notes'),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ContentSourceKind = (typeof contentSourceKindEnum.enumValues)[number];
export type ContentSourcePurpose = (typeof contentSourcePurposeEnum.enumValues)[number];
export type AirdropAliasSource = (typeof airdropAliasSourceEnum.enumValues)[number];
export type AirdropPipelineStatus = (typeof airdropPipelineStatusEnum.enumValues)[number];
export type AirdropPublishPath = (typeof airdropPublishPathEnum.enumValues)[number];
export type AirdropEvidenceFetchStatus = (typeof airdropEvidenceFetchStatusEnum.enumValues)[number];
export type AirdropMoodWindow = (typeof airdropMoodWindowEnum.enumValues)[number];
export type AirdropMoodLabel = (typeof airdropMoodLabelEnum.enumValues)[number];

export type ContentSource = typeof contentSources.$inferSelect;
export type NewContentSource = typeof contentSources.$inferInsert;

export type AirdropEntity = typeof airdropEntities.$inferSelect;
export type NewAirdropEntity = typeof airdropEntities.$inferInsert;

export type AirdropEntityAlias = typeof airdropEntityAliases.$inferSelect;
export type NewAirdropEntityAlias = typeof airdropEntityAliases.$inferInsert;

export type AirdropSignal = typeof airdropSignals.$inferSelect;
export type NewAirdropSignal = typeof airdropSignals.$inferInsert;

export type AirdropEvidenceArtifact = typeof airdropEvidenceArtifacts.$inferSelect;
export type NewAirdropEvidenceArtifact = typeof airdropEvidenceArtifacts.$inferInsert;

export type AirdropMoodSnapshot = typeof airdropMoodSnapshots.$inferSelect;
export type NewAirdropMoodSnapshot = typeof airdropMoodSnapshots.$inferInsert;

export type AirdropProject = typeof airdropProjects.$inferSelect;
export type NewAirdropProject = typeof airdropProjects.$inferInsert;

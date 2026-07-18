import {
    pgTable,
    serial,
    varchar,
    text,
    timestamp,
    boolean,
    jsonb,
    pgEnum,
} from 'drizzle-orm/pg-core';

export const marketNewsSourceTypeEnum = pgEnum('market_news_source_type', [
    'terminal',
    'rss',
    'telegram',
    'manual',
]);

export const marketNewsTrustEnum = pgEnum('market_news_trust', [
    'pending',
    'trusted',
    'rejected',
]);

export const marketNewsItems = pgTable('market_news_items', {
    id: serial('id').primaryKey(),
    sourceType: marketNewsSourceTypeEnum('source_type').notNull(),
    externalId: varchar('external_id', { length: 255 }),
    sourceHash: varchar('source_hash', { length: 64 }).notNull().unique(),
    title: text('title').notNull(),
    body: text('body'),
    url: varchar('url', { length: 1000 }),
    sourceName: varchar('source_name', { length: 255 }),
    publishedAt: timestamp('published_at'),
    symbols: jsonb('symbols').$type<string[]>().default([]),
    trust: marketNewsTrustEnum('trust').notNull().default('pending'),
    trustNote: text('trust_note'),
    rawRef: jsonb('raw_ref').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const marketTelegramChannels = pgTable('market_telegram_channels', {
    id: serial('id').primaryKey(),
    usernameOrId: varchar('username_or_id', { length: 255 }).notNull().unique(),
    title: varchar('title', { length: 255 }),
    enabled: boolean('enabled').notNull().default(true),
    lastCursor: varchar('last_cursor', { length: 100 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type MarketNewsSourceType = (typeof marketNewsSourceTypeEnum.enumValues)[number];
export type MarketNewsTrust = (typeof marketNewsTrustEnum.enumValues)[number];

export type MarketNewsItem = typeof marketNewsItems.$inferSelect;
export type NewMarketNewsItem = typeof marketNewsItems.$inferInsert;

export type MarketTelegramChannel = typeof marketTelegramChannels.$inferSelect;
export type NewMarketTelegramChannel = typeof marketTelegramChannels.$inferInsert;

export const marketContextSnapshotStatusEnum = pgEnum('market_context_snapshot_status', [
    'draft',
    'published',
    'archived',
]);

export type MarketContextSectionKey =
    | 'overview'
    | 'btcCorrelation'
    | 'liquidity'
    | 'newsSensitivity'
    | 'geopolitics'
    | 'thisWeek'
    | 'outlook'
    | 'faq';

export interface MarketContextSection {
    content: string;
    updatedAt: string;
    sourceNewsIds: number[];
}

export type MarketContextSections = Record<MarketContextSectionKey, MarketContextSection>;

export const marketContextSnapshots = pgTable('market_context_snapshots', {
    id: serial('id').primaryKey(),
    snapshotKey: varchar('snapshot_key', { length: 100 }).notNull().unique(),
    kind: varchar('kind', { length: 50 }).notNull().default('weekly'),
    weekLabel: varchar('week_label', { length: 20 }),
    status: marketContextSnapshotStatusEnum('status').notNull().default('draft'),
    sections: jsonb('sections').$type<Partial<MarketContextSections>>().notNull().default({}),
    newsIds: jsonb('news_ids').$type<number[]>().notNull().default([]),
    marketDataVersion: varchar('market_data_version', { length: 100 }),
    generatorVersion: varchar('generator_version', { length: 50 }).notNull().default('MC-v1'),
    generatedAt: timestamp('generated_at'),
    publishedAt: timestamp('published_at'),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type MarketContextSnapshotStatus =
    (typeof marketContextSnapshotStatusEnum.enumValues)[number];

export type MarketContextSnapshot = typeof marketContextSnapshots.$inferSelect;
export type NewMarketContextSnapshot = typeof marketContextSnapshots.$inferInsert;

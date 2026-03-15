import {
    pgTable, serial, varchar, text, timestamp,
    boolean, integer, json
} from 'drizzle-orm/pg-core';

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }).unique(),
    passwordHash: varchar('password_hash', { length: 255 }),
    isOgGenesis: boolean('is_og_genesis').default(false),
    plan: varchar('plan', { length: 20 }).default('free'), // 'free' | 'pro' | 'institutional'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── USER WALLETS ─────────────────────────────────────────────────────────────
export const userWallets = pgTable('user_wallets', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    address: varchar('address', { length: 100 }).notNull(),
    label: varchar('label', { length: 50 }),
    chains: text('chains').array(), // ['ethereum', 'zksync', 'linea']
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── API KEYS ─────────────────────────────────────────────────────────────────
export const apiKeys = pgTable('api_keys', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 100 }),
    lastUsedAt: timestamp('last_used_at'),
    rateLimit: integer('rate_limit').default(100), // requests per hour
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── SESSIONS ─────────────────────────────────────────────────────────────────
export const sessions = pgTable('sessions', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── USER PREFERENCES ─────────────────────────────────────────────────────────
export const userPreferences = pgTable('user_preferences', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
    emailAlerts: boolean('email_alerts').default(true),
    breakingNewsAlerts: boolean('breaking_news_alerts').default(true),
    airdropDeadlineAlerts: boolean('airdrop_deadline_alerts').default(true),
    alphaFocusAlerts: boolean('alpha_focus_alerts').default(true),
    preferredCoins: text('preferred_coins').array(),
});

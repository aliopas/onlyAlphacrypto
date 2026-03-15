import {
    pgTable, serial, varchar, text, timestamp,
    boolean, integer, real
} from 'drizzle-orm/pg-core';
import { users, userWallets } from './user.model';

// ─── AIRDROP PROJECTS ─────────────────────────────────────────────────────────
export const airdropProjects = pgTable('airdrop_projects', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),              // 'ZkSync Era'
    network: varchar('network', { length: 50 }).notNull(),          // 'Mainnet' | 'Testnet'
    logoUrl: varchar('logo_url', { length: 500 }),
    estValue: varchar('est_value', { length: 30 }),                 // '$1,200'
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

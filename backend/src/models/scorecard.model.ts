import {
    pgTable, serial, varchar, text, timestamp,
    integer, numeric, jsonb, boolean, pgEnum, unique
} from 'drizzle-orm/pg-core';

export const portfolioStatusEnum = pgEnum('portfolio_status_enum', ['active', 'watchlist', 'exited']);
export const transactionTypeEnum = pgEnum('transaction_type_enum', [
    'entry', 'tp1_hit', 'tp2_hit', 'tp3_hit', 'sl_hit', 'manual_close', 'dca', 'rebalance'
]);

export const portfolioCoins = pgTable('portfolio_coins', {
    id: serial('id').primaryKey(),
    symbol: varchar('symbol', { length: 20 }).notNull().unique(),
    entryPrice: numeric('entry_price', { precision: 20, scale: 8 }).notNull(),
    currentPrice: numeric('current_price', { precision: 20, scale: 8 }),
    priceMovementAtEntry: numeric('price_movement_at_entry', { precision: 8, scale: 4 }),
    status: portfolioStatusEnum('status').default('watchlist'),
    signalClassification: varchar('signal_classification', { length: 20 }).default('TACTICAL'),
    cexListings: text('cex_listings'),
    allocatedBudget: numeric('allocated_budget', { precision: 12, scale: 2 }).default('0'),
    tp1: numeric('tp1', { precision: 20, scale: 8 }),
    tp2: numeric('tp2', { precision: 20, scale: 8 }),
    tp3: numeric('tp3', { precision: 20, scale: 8 }),
    stopLoss: numeric('stop_loss', { precision: 20, scale: 8 }),
    qualityScore: integer('quality_score').default(0),
    projectProfile: jsonb('project_profile'),
    technicalAnalysis: jsonb('technical_analysis'),
    telegramPostId: varchar('telegram_post_id', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const telegramPortfolioPosts = pgTable('telegram_portfolio_posts', {
    id: serial('id').primaryKey(),
    messageId: varchar('message_id', { length: 50 }).notNull().unique(),
    content: text('content'),
    imageUrl: text('image_url'),
    isAnalyzed: boolean('is_analyzed').default(false),
    extractedSymbols: text('extracted_symbols'),
    analyzedAt: timestamp('analyzed_at'),
    createdAt: timestamp('created_at').defaultNow(),
});

export const portfolioTransactions = pgTable('portfolio_transactions', {
    id: serial('id').primaryKey(),
    coinId: integer('coin_id').references(() => portfolioCoins.id).notNull(),
    type: transactionTypeEnum('type').notNull(),
    price: numeric('price', { precision: 20, scale: 8 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }),
    pnl: numeric('pnl', { precision: 12, scale: 2 }),
    createdAt: timestamp('created_at').defaultNow(),
});

export const portfolioSnapshots = pgTable('portfolio_snapshots', {
    id: serial('id').primaryKey(),
    totalBudget: numeric('total_budget', { precision: 12, scale: 2 }).notNull(),
    currentValue: numeric('current_value', { precision: 12, scale: 2 }).notNull(),
    totalPnl: numeric('total_pnl', { precision: 12, scale: 2 }).notNull(),
    totalPnlPercent: numeric('total_pnl_percent', { precision: 8, scale: 4 }).notNull(),
    activeCoins: integer('active_coins').default(0),
    watchlistCoins: integer('watchlist_coins').default(0),
    maxDrawdownPercent: numeric('max_drawdown_percent', { precision: 8, scale: 4 }).default('0'),
    cashBalance: numeric('cash_balance', { precision: 12, scale: 2 }).default('0'),
    snapshotAt: timestamp('snapshot_at').defaultNow(),
});
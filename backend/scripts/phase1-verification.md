# Phase 1 Verification and Rollback Checklist

## Pre-deployment checks:
- [ ] T-1A-01 migration executed successfully
- [ ] All 18 columns exist in coin_news_history
- [ ] idx_cnh_sourcehash index exists
- [ ] TypeScript compiles with no errors

## Runtime verification:
- [ ] MAJOR events are being inserted into coin_news_history
- [ ] sourceHash dedup is working (no duplicate rows)
- [ ] btcPriceAtEvent/ethPriceAtEvent/fearGreedAtEvent are populated
- [ ] eventOutcomeChecker cron is running every 30 minutes
- [ ] Outcome fields are being filled for rows older than 1h
- [ ] getCoinKlinesRange returns valid candles

## Verification SQL queries:
- Count total Phase 1 rows: `SELECT COUNT(*) FROM coin_news_history WHERE price_at_time IS NOT NULL;`
- Count rows with priceAtTime populated: `SELECT COUNT(*) FROM coin_news_history WHERE price_at_time IS NOT NULL;`
- Count rows with outcome_classification filled: `SELECT COUNT(*) FROM coin_news_history WHERE outcome_classification IS NOT NULL;`
- Count rows still pending outcome check: `SELECT COUNT(*) FROM coin_news_history WHERE price_at_time IS NOT NULL AND outcome_classification IS NULL;`
- Check for any rows with impossible values: `SELECT * FROM coin_news_history WHERE price_at_time <= 0 OR btc_price_at_event <= 0 OR eth_price_at_event <= 0;`

## Rollback procedure:
- Step 1: Disable eventOutcomeChecker cron
- Step 2: Remove cron registration from server.ts
- Step 3: Remove T-1B-01 insert block from aiWorkflow.cron.ts
- Step 4: Run rollback SQL from migrate-coin-news-history-phase1.sql
- Step 5: Revert market.model.ts Phase 1A fields
- Step 6: Verify no Phase 1 columns remain

## Known limitations:
- Outcome tracking starts from deployment, no backfill
- 3d horizon requires 3 days of data collection
- getCoinKlinesRange limited to USDT pairs on Binance
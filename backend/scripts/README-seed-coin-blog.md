# DEC-043 B7 — Coin blog seed

## Run (manual ops only — not on boot)

```bash
cd backend
# required
export MARKET_CONTEXT_ENABLED=true
export OPENROUTER_API_KEY=...
# optional
export DEEPSEEK_API_KEY=...
export FORCE_COIN_SEED=true   # re-run after flag set; still skips published coins

npx ts-node scripts/seed-coin-blog-pages.ts
```

## What it does

1. Idempotent guard: `migration_flags.flag_name = market_context_coin_seed_v1`
2. Per `TRACKED_COINS` (11): backfill trusted news from `coin_news` + `coin_news_history` (~12m) → `market_news_items`
3. If no coin snapshot yet: `generateCoinBlogSnapshot({ autoPublish: false })` → **draft**
4. 3–8s delay between coins

## Publish policy

Seed creates **drafts only**. After editorial review, publish from **Admin → Blog / Insights → Coins**.

Do not enable auto-publish in this script for AdSense-first crawl control.

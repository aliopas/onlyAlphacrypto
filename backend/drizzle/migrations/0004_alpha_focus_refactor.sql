-- Alpha Focus Refactor: Migrate from market_insights to coin_master_articles
-- Step 1: Drop old FK constraint
ALTER TABLE "daily_alpha_focus" DROP CONSTRAINT IF EXISTS "daily_alpha_focus_insight_id_market_insights_id_fk";
--> statement-breakpoint
-- Step 2: Drop old column
ALTER TABLE "daily_alpha_focus" DROP COLUMN IF EXISTS "insight_id";
--> statement-breakpoint
-- Step 3: Add new column as nullable first (handles existing rows)
ALTER TABLE "daily_alpha_focus" ADD COLUMN "master_article_id" integer;
--> statement-breakpoint
-- Step 4: Add new FK constraint
ALTER TABLE "daily_alpha_focus" ADD CONSTRAINT "daily_alpha_focus_master_article_id_coin_master_articles_id_fk" FOREIGN KEY ("master_article_id") REFERENCES "public"."coin_master_articles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Step 5: Remove orphaned rows (no master article reference)
DELETE FROM "daily_alpha_focus" WHERE "master_article_id" IS NULL;
--> statement-breakpoint
-- Step 6: Make column NOT NULL
ALTER TABLE "daily_alpha_focus" ALTER COLUMN "master_article_id" SET NOT NULL;

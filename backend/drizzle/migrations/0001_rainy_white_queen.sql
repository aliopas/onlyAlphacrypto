ALTER TABLE "coin_news" ADD COLUMN "hook" text;--> statement-breakpoint
ALTER TABLE "coin_news" ADD COLUMN "meta_title" varchar(80);--> statement-breakpoint
ALTER TABLE "coin_news" ADD COLUMN "meta_description" varchar(200);--> statement-breakpoint
ALTER TABLE "coin_news" ADD COLUMN "seo_keywords" json;
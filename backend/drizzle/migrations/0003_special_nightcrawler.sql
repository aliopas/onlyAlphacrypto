CREATE TABLE "coin_master_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_symbol" varchar(20) NOT NULL,
	"core_catalyst" text,
	"market_context" text,
	"strategic_impact" text,
	"historical_context" text,
	"technical_levels" text,
	"risk_assessment" text,
	"bottom_line" text,
	"headline" text NOT NULL,
	"hook" text,
	"meta_title" varchar(80),
	"meta_description" varchar(200),
	"seo_keywords" json,
	"sentiment" varchar(20),
	"verdict" varchar(20),
	"confidence_score" real,
	"conviction_score" real,
	"posture" varchar(30),
	"risk_tags" json,
	"trigger_type" varchar(20),
	"major_update_count" integer DEFAULT 0 NOT NULL,
	"minor_update_count" integer DEFAULT 0 NOT NULL,
	"last_major_update" timestamp,
	"last_minor_update" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coin_master_articles_coin_symbol_unique" UNIQUE("coin_symbol")
);
--> statement-breakpoint
CREATE TABLE "coin_timeline_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_symbol" varchar(20) NOT NULL,
	"master_article_id" integer NOT NULL,
	"update_text" text NOT NULL,
	"trigger_type" varchar(20),
	"severity" varchar(10) NOT NULL,
	"source_title" text,
	"source_hash" varchar(64),
	"sentiment" varchar(20),
	"impact_score" real,
	"conviction_delta" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raw_news_buffer" ALTER COLUMN "symbol_mentions" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "airdrop_projects" ALTER COLUMN "est_value" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "raw_news_buffer" ADD COLUMN "classification" varchar(10);--> statement-breakpoint
ALTER TABLE "coin_timeline_updates" ADD CONSTRAINT "coin_timeline_updates_master_article_id_coin_master_articles_id_fk" FOREIGN KEY ("master_article_id") REFERENCES "public"."coin_master_articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_news_history" ADD CONSTRAINT "coin_news_history_unq" UNIQUE("coin_symbol","title","published_at");
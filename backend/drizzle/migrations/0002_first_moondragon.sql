CREATE TABLE "coin_intelligence_cache" (
	"coin_symbol" varchar(20) PRIMARY KEY NOT NULL,
	"ath" real,
	"ath_date" varchar(20),
	"trend_8w" varchar(20),
	"week_52_high" real,
	"week_52_low" real,
	"price_change_30d" real,
	"wiki_background" text,
	"dex_boost_active" boolean DEFAULT false NOT NULL,
	"data_source" varchar(20),
	"cached_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_symbol" varchar(20) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_summary" text NOT NULL,
	"price_at_event" real,
	"verdict" varchar(20),
	"confidence_score" real,
	"risk_verdict" varchar(20),
	"key_drivers" json,
	"red_flags" json,
	"source_news_hashes" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_news_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_symbol" varchar(20) NOT NULL,
	"title" text NOT NULL,
	"source" varchar(100),
	"published_at" timestamp NOT NULL,
	"sentiment" varchar(10),
	"event_type" varchar(50),
	"event_severity" integer DEFAULT 1,
	"price_at_time" real,
	"price_7d_after" real,
	"price_change_7d" real,
	"is_rug_pull" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_news_buffer" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source" varchar(100),
	"retrieved_at" timestamp DEFAULT now() NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"ttl_expires_at" timestamp,
	"processed" boolean DEFAULT false NOT NULL,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"symbol_mentions" json,
	"sentiment_hint" varchar(20),
	"relevance_score" integer,
	"event_type" varchar(50),
	"event_severity" integer,
	CONSTRAINT "raw_news_buffer_source_hash_unique" UNIQUE("source_hash")
);

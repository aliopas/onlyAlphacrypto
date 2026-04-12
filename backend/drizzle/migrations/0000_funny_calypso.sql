CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"name" varchar(100),
	"last_used_at" timestamp,
	"rate_limit" integer DEFAULT 100,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email_alerts" boolean DEFAULT true,
	"breaking_news_alerts" boolean DEFAULT true,
	"airdrop_deadline_alerts" boolean DEFAULT true,
	"alpha_focus_alerts" boolean DEFAULT true,
	"preferred_coins" text[],
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"address" varchar(100) NOT NULL,
	"label" varchar(50),
	"chains" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"password_hash" varchar(255),
	"is_og_genesis" boolean DEFAULT false,
	"plan" varchar(20) DEFAULT 'free',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "coin_news" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_symbol" varchar(20),
	"headline" text NOT NULL,
	"summary" text,
	"source_url" varchar(500),
	"sentiment" varchar(20),
	"impact_score" real,
	"is_breaking" integer DEFAULT 0,
	"source_hash" varchar(64),
	"ai_processed" integer DEFAULT 1,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coin_news_source_hash_unique" UNIQUE("source_hash")
);
--> statement-breakpoint
CREATE TABLE "daily_alpha_focus" (
	"id" serial PRIMARY KEY NOT NULL,
	"insight_id" integer NOT NULL,
	"coin_symbol" varchar(20) NOT NULL,
	"coin_name" varchar(100) NOT NULL,
	"coin_slug" varchar(100) NOT NULL,
	"verdict" varchar(20) NOT NULL,
	"confidence_score" real NOT NULL,
	"executive_summary" text,
	"composite_score" real,
	"selected_at" timestamp DEFAULT now() NOT NULL,
	"valid_for_date" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_market_mood" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_score" real NOT NULL,
	"internal_score" real NOT NULL,
	"final_score" real NOT NULL,
	"label" varchar(30) NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"valid_for_date" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_symbol" varchar(20) NOT NULL,
	"coin_name" varchar(100) NOT NULL,
	"coin_slug" varchar(100) NOT NULL,
	"verdict" varchar(20) NOT NULL,
	"confidence_score" real NOT NULL,
	"executive_summary" text,
	"support_levels" json,
	"resistance_levels" json,
	"rsi_value" real,
	"volume_surge" real,
	"tvl_change" real,
	"social_momentum" real,
	"price_at_analysis" real,
	"risk_level" varchar(20),
	"red_flags" json,
	"key_drivers" json,
	"market_context" text,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_symbol" varchar(20) NOT NULL,
	"price" real NOT NULL,
	"liquidity" real,
	"volume_24h" real,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"coin_symbol" varchar(20),
	"signal_text" text NOT NULL,
	"sentiment" varchar(20),
	"impact_score" real,
	"news_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airdrop_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"network" varchar(50) NOT NULL,
	"logo_url" varchar(500),
	"est_value" varchar(30),
	"ai_report" text,
	"risk_verdict" varchar(20),
	"funding_round" varchar(100),
	"twitter_url" varchar(300),
	"discord_url" varchar(300),
	"website_url" varchar(300),
	"snapshot_at" timestamp,
	"tge_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airdrop_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"description" text NOT NULL,
	"contract_address" varchar(100),
	"min_amount" real,
	"token_symbol" varchar(20),
	"chain" varchar(50),
	"is_auto_verifiable" boolean DEFAULT false,
	"order_index" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"task_id" integer NOT NULL,
	"wallet_id" integer,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"verified_by" varchar(20) DEFAULT 'auto',
	"tx_hash" varchar(100)
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_alpha_focus" ADD CONSTRAINT "daily_alpha_focus_insight_id_market_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."market_insights"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_signals" ADD CONSTRAINT "radar_signals_news_id_coin_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."coin_news"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airdrop_tasks" ADD CONSTRAINT "airdrop_tasks_project_id_airdrop_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."airdrop_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_task_id_airdrop_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."airdrop_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_wallet_id_user_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."user_wallets"("id") ON DELETE no action ON UPDATE no action;
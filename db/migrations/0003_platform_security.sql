-- ─── Platform Security: API key auth, durable rate limits, session
--     revocation, and webhook delivery infrastructure. ─────────────

-- Session revocation cutoff: reject JWTs issued before this per-user timestamp.
ALTER TABLE "users" ADD COLUMN "token_cutoff_at" timestamp with time zone;
--> statement-breakpoint

-- API keys: add last_used_at + prefix index for lookups.
ALTER TABLE "api_keys" ADD COLUMN "last_used_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "idx_api_keys_prefix" ON "api_keys" USING btree ("prefix");
--> statement-breakpoint

-- Revoked sessions (JWT denylist).
CREATE TABLE "revoked_tokens" (
	"jti" varchar(64) PRIMARY KEY NOT NULL,
	"exp" timestamp with time zone NOT NULL,
	"reason" varchar(50) DEFAULT 'logout' NOT NULL,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_by" varchar(200)
);
--> statement-breakpoint
CREATE INDEX "idx_revoked_tokens_exp" ON "revoked_tokens" USING btree ("exp");
--> statement-breakpoint

-- Durable rate limiting counters.
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(50) NOT NULL,
	"key" varchar(500) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"max_requests" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rate_limits_scope_key" ON "rate_limits" USING btree ("scope","key");
--> statement-breakpoint

-- Webhook subscriptions.
CREATE TABLE "webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"url" varchar(2048) NOT NULL,
	"secret" varchar(255) NOT NULL,
	"events" jsonb DEFAULT '[]' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_webhook_subscriptions_org" ON "webhook_subscriptions" USING btree ("org_id");
--> statement-breakpoint

-- Webhook delivery log (one row per attempt).
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event" varchar(50) NOT NULL,
	"case_id" uuid,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"response_status" integer,
	"response_body_preview" varchar(500),
	"error_message" varchar(500),
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_sub" ON "webhook_deliveries" USING btree ("subscription_id");
--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_case" ON "webhook_deliveries" USING btree ("case_id");
--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE no action ON UPDATE no action;
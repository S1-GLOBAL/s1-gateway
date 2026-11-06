CREATE TABLE "atlas_quote_suggestion_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"by" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"proposal_before" jsonb,
	"proposal_after" jsonb,
	"reason" varchar(500),
	CONSTRAINT "atlas_quote_suggestion_events_kind_check" CHECK ("atlas_quote_suggestion_events"."kind" in ('suggested', 'edited', 'withdrawn', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "atlas_quote_suggestions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spec_id" uuid NOT NULL,
	"manufacturer_id" uuid,
	"manufacturer_name" varchar(120),
	"manufacturer_country" varchar(60),
	"item_name" text,
	"fob_per_unit" text NOT NULL,
	"fob_per_case" text,
	"fob_total" text,
	"mold_cost" text,
	"mold_lead_time" text,
	"sample_lead_time" text,
	"production_lead_time" text,
	"state" varchar(16) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"suggested_by" uuid NOT NULL,
	"suggested_at" timestamp with time zone NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"reason" varchar(500),
	"quote_id" uuid,
	CONSTRAINT "atlas_quote_suggestions_manufacturer_check" CHECK (("atlas_quote_suggestions"."manufacturer_id" is not null and "atlas_quote_suggestions"."manufacturer_name" is null and "atlas_quote_suggestions"."manufacturer_country" is null)
        or ("atlas_quote_suggestions"."manufacturer_id" is null and "atlas_quote_suggestions"."manufacturer_name" is not null)),
	CONSTRAINT "atlas_quote_suggestions_state_check" CHECK ("atlas_quote_suggestions"."state" in ('waiting', 'approved', 'rejected', 'withdrawn')),
	CONSTRAINT "atlas_quote_suggestions_decision_check" CHECK (("atlas_quote_suggestions"."state" = 'waiting' and "atlas_quote_suggestions"."decided_by" is null and "atlas_quote_suggestions"."decided_at" is null and "atlas_quote_suggestions"."reason" is null and "atlas_quote_suggestions"."quote_id" is null)
        or ("atlas_quote_suggestions"."state" = 'withdrawn' and "atlas_quote_suggestions"."decided_by" is null and "atlas_quote_suggestions"."decided_at" is not null and "atlas_quote_suggestions"."reason" is null and "atlas_quote_suggestions"."quote_id" is null)
        or ("atlas_quote_suggestions"."state" = 'approved' and "atlas_quote_suggestions"."decided_by" is not null and "atlas_quote_suggestions"."decided_at" is not null and "atlas_quote_suggestions"."reason" is null and "atlas_quote_suggestions"."quote_id" is not null)
        or ("atlas_quote_suggestions"."state" = 'rejected' and "atlas_quote_suggestions"."decided_by" is not null and "atlas_quote_suggestions"."decided_at" is not null and "atlas_quote_suggestions"."reason" is not null and "atlas_quote_suggestions"."quote_id" is null))
);
--> statement-breakpoint
ALTER TABLE "atlas_quotes" ADD COLUMN "suggestion_id" uuid;--> statement-breakpoint
ALTER TABLE "atlas_quote_suggestion_events" ADD CONSTRAINT "atlas_quote_suggestion_events_suggestion_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."atlas_quote_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_quote_suggestion_events" ADD CONSTRAINT "atlas_quote_suggestion_events_by_fk" FOREIGN KEY ("by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_quote_suggestions" ADD CONSTRAINT "atlas_quote_suggestions_spec_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."atlas_spec_ids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_quote_suggestions" ADD CONSTRAINT "atlas_quote_suggestions_manufacturer_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."atlas_manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_quote_suggestions" ADD CONSTRAINT "atlas_quote_suggestions_suggested_by_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_quote_suggestions" ADD CONSTRAINT "atlas_quote_suggestions_decided_by_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atlas_quote_suggestion_events_suggestion_idx" ON "atlas_quote_suggestion_events" USING btree ("suggestion_id","at");--> statement-breakpoint
CREATE INDEX "atlas_quote_suggestions_state_idx" ON "atlas_quote_suggestions" USING btree ("state","suggested_at");--> statement-breakpoint
CREATE INDEX "atlas_quote_suggestions_spec_id_idx" ON "atlas_quote_suggestions" USING btree ("spec_id","state");--> statement-breakpoint
ALTER TABLE "atlas_quotes" ADD CONSTRAINT "atlas_quotes_suggestion_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."atlas_quote_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "atlas_quotes_suggestion_id_unique" ON "atlas_quotes" USING btree ("suggestion_id");
CREATE TABLE "atlas_dictionary_suggestion_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"by" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"proposal_before" jsonb,
	"proposal_after" jsonb,
	"reason" varchar(500),
	CONSTRAINT "atlas_dictionary_suggestion_events_kind_check" CHECK ("atlas_dictionary_suggestion_events"."kind" in ('suggested', 'edited', 'withdrawn', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "atlas_dictionary_suggestions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" varchar(16) NOT NULL,
	"slot" varchar(32) NOT NULL,
	"code" varchar(5) NOT NULL,
	"proposal" jsonb NOT NULL,
	"state" varchar(16) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"suggested_by" uuid NOT NULL,
	"suggested_at" timestamp with time zone NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"reason" varchar(500),
	"change_number" integer,
	CONSTRAINT "atlas_dictionary_suggestions_kind_check" CHECK ("atlas_dictionary_suggestions"."kind" in ('add', 'edit', 'delete', 'rules')),
	CONSTRAINT "atlas_dictionary_suggestions_state_check" CHECK ("atlas_dictionary_suggestions"."state" in ('waiting', 'approved', 'rejected', 'withdrawn')),
	CONSTRAINT "atlas_dictionary_suggestions_decision_check" CHECK (("atlas_dictionary_suggestions"."state" = 'waiting' and "atlas_dictionary_suggestions"."decided_by" is null and "atlas_dictionary_suggestions"."decided_at" is null)
        or ("atlas_dictionary_suggestions"."state" = 'withdrawn' and "atlas_dictionary_suggestions"."decided_by" is null and "atlas_dictionary_suggestions"."decided_at" is not null)
        or ("atlas_dictionary_suggestions"."state" = 'approved' and "atlas_dictionary_suggestions"."decided_by" is not null and "atlas_dictionary_suggestions"."decided_at" is not null and "atlas_dictionary_suggestions"."reason" is null)
        or ("atlas_dictionary_suggestions"."state" = 'rejected' and "atlas_dictionary_suggestions"."decided_by" is not null and "atlas_dictionary_suggestions"."decided_at" is not null and "atlas_dictionary_suggestions"."reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "atlas_dictionary_suggestion_events" ADD CONSTRAINT "atlas_dictionary_suggestion_events_suggestion_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."atlas_dictionary_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_dictionary_suggestion_events" ADD CONSTRAINT "atlas_dictionary_suggestion_events_by_fk" FOREIGN KEY ("by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_dictionary_suggestions" ADD CONSTRAINT "atlas_dictionary_suggestions_suggested_by_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_dictionary_suggestions" ADD CONSTRAINT "atlas_dictionary_suggestions_decided_by_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atlas_dictionary_suggestion_events_suggestion_idx" ON "atlas_dictionary_suggestion_events" USING btree ("suggestion_id","at");--> statement-breakpoint
CREATE INDEX "atlas_dictionary_suggestions_state_idx" ON "atlas_dictionary_suggestions" USING btree ("state","suggested_at");
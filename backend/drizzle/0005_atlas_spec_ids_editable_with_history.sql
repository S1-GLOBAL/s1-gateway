CREATE TABLE "atlas_spec_id_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spec_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"code_before" varchar(74),
	"code_after" varchar(74) NOT NULL,
	"name_before" varchar(120),
	"name_after" varchar(120) NOT NULL,
	CONSTRAINT "atlas_spec_id_changes_kind_check" CHECK ("atlas_spec_id_changes"."kind" in ('created', 'updated'))
);
--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "atlas_spec_id_changes" ADD CONSTRAINT "atlas_spec_id_changes_spec_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."atlas_spec_ids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_spec_id_changes" ADD CONSTRAINT "atlas_spec_id_changes_changed_by_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atlas_spec_id_changes_spec_id_changed_at_idx" ON "atlas_spec_id_changes" USING btree ("spec_id","changed_at");--> statement-breakpoint
CREATE INDEX "atlas_spec_id_changes_code_before_idx" ON "atlas_spec_id_changes" USING btree ("code_before");--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD CONSTRAINT "atlas_spec_ids_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
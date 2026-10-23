CREATE TABLE "atlas_manufacturer_stage_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spec_id" uuid NOT NULL,
	"manufacturer_id" uuid NOT NULL,
	"stage_before" varchar(16),
	"stage_after" varchar(16),
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "atlas_manufacturer_stage_changes_stage_check" CHECK (("atlas_manufacturer_stage_changes"."stage_before" is null or "atlas_manufacturer_stage_changes"."stage_before" in ('sampling', 'in-production')) and ("atlas_manufacturer_stage_changes"."stage_after" is null or "atlas_manufacturer_stage_changes"."stage_after" in ('sampling', 'in-production')))
);
--> statement-breakpoint
ALTER TABLE "atlas_manufacturer_stage_changes" ADD CONSTRAINT "atlas_manufacturer_stage_changes_spec_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."atlas_spec_ids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_manufacturer_stage_changes" ADD CONSTRAINT "atlas_manufacturer_stage_changes_manufacturer_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."atlas_manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_manufacturer_stage_changes" ADD CONSTRAINT "atlas_manufacturer_stage_changes_changed_by_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atlas_stage_changes_spec_manufacturer_idx" ON "atlas_manufacturer_stage_changes" USING btree ("spec_id","manufacturer_id","changed_at");
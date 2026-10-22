CREATE TABLE "atlas_manufacturers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"country" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atlas_quotes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spec_id" uuid NOT NULL,
	"manufacturer_id" uuid NOT NULL,
	"item_name" text,
	"fob_per_unit" text,
	"fob_per_case" text,
	"fob_total" text,
	"mold_cost" text,
	"mold_lead_time" text,
	"sample_lead_time" text,
	"production_lead_time" text,
	"imported_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atlas_quotes" ADD CONSTRAINT "atlas_quotes_spec_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."atlas_spec_ids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_quotes" ADD CONSTRAINT "atlas_quotes_manufacturer_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."atlas_manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "atlas_manufacturers_name_key_unique" ON "atlas_manufacturers" USING btree ("name_key");--> statement-breakpoint
CREATE INDEX "atlas_quotes_spec_id_idx" ON "atlas_quotes" USING btree ("spec_id");--> statement-breakpoint
CREATE INDEX "atlas_quotes_manufacturer_id_idx" ON "atlas_quotes" USING btree ("manufacturer_id");
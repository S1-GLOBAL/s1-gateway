CREATE TABLE "atlas_imported_rows" (
	"row" integer PRIMARY KEY NOT NULL,
	"spec_id" uuid,
	"item_name" text NOT NULL,
	"category" text NOT NULL,
	"material" text NOT NULL,
	"material_type" text NOT NULL,
	"dimension" text NOT NULL,
	"weight" text NOT NULL,
	"printing" text NOT NULL,
	"reading" jsonb NOT NULL,
	"imported_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atlas_imported_rows" ADD CONSTRAINT "atlas_imported_rows_spec_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."atlas_spec_ids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atlas_imported_rows_spec_id_idx" ON "atlas_imported_rows" USING btree ("spec_id");
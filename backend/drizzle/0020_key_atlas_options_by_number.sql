ALTER TABLE "atlas_dictionary_retired_numbers" ADD COLUMN "legacy_code" varchar(5);--> statement-breakpoint
ALTER TABLE "atlas_dictionary_values" ADD COLUMN "legacy_code" varchar(5);--> statement-breakpoint
ALTER TABLE "atlas_dictionary_values" ADD COLUMN "broader_number" integer;
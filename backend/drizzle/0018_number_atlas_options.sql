CREATE TABLE "atlas_dictionary_retired_numbers" (
	"slot" varchar(32) NOT NULL,
	"number" integer NOT NULL,
	"code" varchar(5) NOT NULL,
	"meaning" varchar(120) NOT NULL,
	"change_number" integer,
	CONSTRAINT "atlas_dictionary_retired_numbers_pk" PRIMARY KEY("slot","number")
);
--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ALTER COLUMN "capacity" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "atlas_dictionary_values" ADD COLUMN "number" integer;--> statement-breakpoint
ALTER TABLE "atlas_dictionary_retired_numbers" ADD CONSTRAINT "atlas_dictionary_retired_numbers_change_number_fk" FOREIGN KEY ("change_number") REFERENCES "public"."atlas_dictionary_changes"("number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "atlas_dictionary_values_number_unique" ON "atlas_dictionary_values" USING btree ("release","slot","number");
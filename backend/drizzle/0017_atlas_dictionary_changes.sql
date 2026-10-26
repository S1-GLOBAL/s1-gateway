CREATE TABLE "atlas_dictionary_changes" (
	"number" integer PRIMARY KEY NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"approved_by" uuid NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	"spec_ids_rewritten" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atlas_dictionary_renames" (
	"slot" varchar(32) NOT NULL,
	"old_code" varchar(5) NOT NULL,
	"new_code" varchar(5),
	"change_number" integer NOT NULL,
	CONSTRAINT "atlas_dictionary_renames_pk" PRIMARY KEY("slot","old_code")
);
--> statement-breakpoint
CREATE TABLE "atlas_dictionary_search_words" (
	"slot" varchar(32) NOT NULL,
	"word" varchar(40) NOT NULL,
	"code" varchar(5) NOT NULL,
	"change_number" integer NOT NULL,
	CONSTRAINT "atlas_dictionary_search_words_pk" PRIMARY KEY("slot","word")
);
--> statement-breakpoint
ALTER TABLE "atlas_spec_id_changes" ADD COLUMN "dictionary_change_number" integer;--> statement-breakpoint
ALTER TABLE "atlas_dictionary_changes" ADD CONSTRAINT "atlas_dictionary_changes_suggestion_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."atlas_dictionary_suggestions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_dictionary_changes" ADD CONSTRAINT "atlas_dictionary_changes_approved_by_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_dictionary_renames" ADD CONSTRAINT "atlas_dictionary_renames_change_number_fk" FOREIGN KEY ("change_number") REFERENCES "public"."atlas_dictionary_changes"("number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_dictionary_search_words" ADD CONSTRAINT "atlas_dictionary_search_words_change_number_fk" FOREIGN KEY ("change_number") REFERENCES "public"."atlas_dictionary_changes"("number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "atlas_dictionary_changes_suggestion_id_unique" ON "atlas_dictionary_changes" USING btree ("suggestion_id");--> statement-breakpoint
CREATE INDEX "atlas_dictionary_search_words_option_idx" ON "atlas_dictionary_search_words" USING btree ("slot","code");--> statement-breakpoint
ALTER TABLE "atlas_spec_id_changes" ADD CONSTRAINT "atlas_spec_id_changes_dictionary_change_fk" FOREIGN KEY ("dictionary_change_number") REFERENCES "public"."atlas_dictionary_changes"("number") ON DELETE no action ON UPDATE no action;
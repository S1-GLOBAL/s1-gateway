CREATE TABLE "atlas_dictionary_releases" (
	"release" varchar(16) PRIMARY KEY NOT NULL,
	"approved_on" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "atlas_dictionary_values" (
	"release" varchar(16) NOT NULL,
	"slot" varchar(32) NOT NULL,
	"code" varchar(5) NOT NULL,
	"meaning" varchar(120) NOT NULL,
	CONSTRAINT "atlas_dictionary_values_release_slot_code_pk" PRIMARY KEY("release","slot","code"),
	CONSTRAINT "atlas_dictionary_values_code_not_marker" CHECK ("atlas_dictionary_values"."code" !~ '^(0+|X+)$')
);
--> statement-breakpoint
CREATE TABLE "atlas_slot_rules" (
	"release" varchar(16) NOT NULL,
	"product_type" varchar(3) NOT NULL,
	"slot" varchar(32) NOT NULL,
	"rule" varchar(16) NOT NULL,
	CONSTRAINT "atlas_slot_rules_release_product_type_slot_pk" PRIMARY KEY("release","product_type","slot"),
	CONSTRAINT "atlas_slot_rules_rule_check" CHECK ("atlas_slot_rules"."rule" in ('applies', 'never', 'round_only', 'non_round_only', 'paper_only'))
);
--> statement-breakpoint
ALTER TABLE "atlas_dictionary_values" ADD CONSTRAINT "atlas_dictionary_values_release_fk" FOREIGN KEY ("release") REFERENCES "public"."atlas_dictionary_releases"("release") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_slot_rules" ADD CONSTRAINT "atlas_slot_rules_release_fk" FOREIGN KEY ("release") REFERENCES "public"."atlas_dictionary_releases"("release") ON DELETE no action ON UPDATE no action;
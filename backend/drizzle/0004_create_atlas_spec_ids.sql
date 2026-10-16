CREATE TABLE "atlas_spec_ids" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(74) NOT NULL,
	"product_type" varchar(3) NOT NULL,
	"material" varchar(3) NOT NULL,
	"coating" varchar(2) NOT NULL,
	"colour_clarity" varchar(2) NOT NULL,
	"shape" varchar(2) NOT NULL,
	"profile" varchar(2) NOT NULL,
	"capacity" varchar(5) NOT NULL,
	"top_diameter" varchar(4) NOT NULL,
	"bottom_diameter" varchar(4) NOT NULL,
	"height" varchar(4) NOT NULL,
	"length" varchar(4) NOT NULL,
	"width" varchar(4) NOT NULL,
	"gusset" varchar(4) NOT NULL,
	"unit_weight" varchar(4) NOT NULL,
	"basis_weight" varchar(3) NOT NULL,
	"thickness" varchar(3) NOT NULL,
	"variant" varchar(2) NOT NULL,
	"name" varchar(120) NOT NULL,
	"dictionary_release" varchar(16) NOT NULL,
	"saved_by" uuid NOT NULL,
	"saved_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD CONSTRAINT "atlas_spec_ids_release_fk" FOREIGN KEY ("dictionary_release") REFERENCES "public"."atlas_dictionary_releases"("release") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD CONSTRAINT "atlas_spec_ids_saved_by_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "atlas_spec_ids_code_unique" ON "atlas_spec_ids" USING btree ("code");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_saved_at_idx" ON "atlas_spec_ids" USING btree ("saved_at");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_product_type_idx" ON "atlas_spec_ids" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_material_idx" ON "atlas_spec_ids" USING btree ("material");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_coating_idx" ON "atlas_spec_ids" USING btree ("coating");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_colour_clarity_idx" ON "atlas_spec_ids" USING btree ("colour_clarity");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_shape_idx" ON "atlas_spec_ids" USING btree ("shape");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_profile_idx" ON "atlas_spec_ids" USING btree ("profile");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_capacity_idx" ON "atlas_spec_ids" USING btree ("capacity");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_top_diameter_idx" ON "atlas_spec_ids" USING btree ("top_diameter");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_bottom_diameter_idx" ON "atlas_spec_ids" USING btree ("bottom_diameter");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_height_idx" ON "atlas_spec_ids" USING btree ("height");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_length_idx" ON "atlas_spec_ids" USING btree ("length");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_width_idx" ON "atlas_spec_ids" USING btree ("width");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_gusset_idx" ON "atlas_spec_ids" USING btree ("gusset");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_unit_weight_idx" ON "atlas_spec_ids" USING btree ("unit_weight");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_basis_weight_idx" ON "atlas_spec_ids" USING btree ("basis_weight");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_thickness_idx" ON "atlas_spec_ids" USING btree ("thickness");
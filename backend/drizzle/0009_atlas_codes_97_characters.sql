ALTER TABLE "atlas_spec_id_changes" ALTER COLUMN "code_before" SET DATA TYPE varchar(97);--> statement-breakpoint
ALTER TABLE "atlas_spec_id_changes" ALTER COLUMN "code_after" SET DATA TYPE varchar(97);--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ALTER COLUMN "code" SET DATA TYPE varchar(97);--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "wall" varchar(2);--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "print" varchar(2);--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "compartments" varchar(2);--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "plies" varchar(1);--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "lid_opening" varchar(2);--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "handle" varchar(2);--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "wrap" varchar(2);--> statement-breakpoint
ALTER TABLE "atlas_spec_ids" ADD COLUMN "window" varchar(2);--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_wall_idx" ON "atlas_spec_ids" USING btree ("wall");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_print_idx" ON "atlas_spec_ids" USING btree ("print");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_compartments_idx" ON "atlas_spec_ids" USING btree ("compartments");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_plies_idx" ON "atlas_spec_ids" USING btree ("plies");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_lid_opening_idx" ON "atlas_spec_ids" USING btree ("lid_opening");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_handle_idx" ON "atlas_spec_ids" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_wrap_idx" ON "atlas_spec_ids" USING btree ("wrap");--> statement-breakpoint
CREATE INDEX "atlas_spec_ids_window_idx" ON "atlas_spec_ids" USING btree ("window");
-- Every saved Spec ID and every code in its History to the S2 format (ADR 0024).
-- Slots 1-17 keep their positions, so characters 3-71 of an S1 code are kept;
-- the eight added slots are 0 where S2 0.1.0 applies them to the product type
-- and X where it doesn't, exactly as fromS1 in backend/src/modules/atlas/domain/s1-code.ts
-- writes them. S1 had four product types. Facts do not change, so no History row is added.
WITH "added" ("product_type", "slots") AS (
	VALUES
		('BLD', 'XX.00.XX.X.XX.XX.XX.XX'),
		('CLD', 'XX.00.XX.X.00.XX.XX.XX'),
		('BWL', '00.00.00.X.XX.XX.XX.XX'),
		('SUP', 'XX.00.XX.X.XX.XX.XX.00')
)
UPDATE "atlas_spec_ids" AS "spec"
SET
	"wall" = split_part("added"."slots", '.', 1),
	"print" = split_part("added"."slots", '.', 2),
	"compartments" = split_part("added"."slots", '.', 3),
	"plies" = split_part("added"."slots", '.', 4),
	"lid_opening" = split_part("added"."slots", '.', 5),
	"handle" = split_part("added"."slots", '.', 6),
	"wrap" = split_part("added"."slots", '.', 7),
	"window" = split_part("added"."slots", '.', 8),
	"code" = 'S2' || substr("spec"."code", 3, 69) || '.' || "added"."slots" || '.' || right("spec"."code", 2),
	"dictionary_release" = 'S2 0.1.0'
FROM "added"
WHERE "added"."product_type" = "spec"."product_type" AND "spec"."code" LIKE 'S1.%';
--> statement-breakpoint
WITH "added" ("product_type", "slots") AS (
	VALUES
		('BLD', 'XX.00.XX.X.XX.XX.XX.XX'),
		('CLD', 'XX.00.XX.X.00.XX.XX.XX'),
		('BWL', '00.00.00.X.XX.XX.XX.XX'),
		('SUP', 'XX.00.XX.X.XX.XX.XX.00')
)
UPDATE "atlas_spec_id_changes" AS "change"
SET "code_before" = 'S2' || substr("change"."code_before", 3, 69) || '.' || "added"."slots" || '.' || right("change"."code_before", 2)
FROM "added"
WHERE "added"."product_type" = substr("change"."code_before", 4, 3) AND "change"."code_before" LIKE 'S1.%';
--> statement-breakpoint
WITH "added" ("product_type", "slots") AS (
	VALUES
		('BLD', 'XX.00.XX.X.XX.XX.XX.XX'),
		('CLD', 'XX.00.XX.X.00.XX.XX.XX'),
		('BWL', '00.00.00.X.XX.XX.XX.XX'),
		('SUP', 'XX.00.XX.X.XX.XX.XX.00')
)
UPDATE "atlas_spec_id_changes" AS "change"
SET "code_after" = 'S2' || substr("change"."code_after", 3, 69) || '.' || "added"."slots" || '.' || right("change"."code_after", 2)
FROM "added"
WHERE "added"."product_type" = substr("change"."code_after", 4, 3) AND "change"."code_after" LIKE 'S1.%';

-- Every saved Spec ID and every code in its History to the short form (ADR 0025):
-- the `S2.` tag goes, and a slot written all 0 (not known) or all X (doesn't
-- apply) becomes one letter, Y or X, exactly as toShort in
-- backend/src/modules/atlas/domain/old-codes.ts writes it. First, an S1 code an
-- older API saved during the deploy of 0011 is converted as 0011 converts one.
-- Facts do not change, so no History row is added.
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
--> statement-breakpoint
UPDATE "atlas_spec_ids"
SET
	"code" = (
		SELECT string_agg(regexp_replace(regexp_replace("part", '^0+$', 'Y'), '^X+$', 'X'), '.' ORDER BY "position")
		FROM unnest(string_to_array(substr("code", 4), '.')) WITH ORDINALITY AS "parts" ("part", "position")
	),
	"material" = regexp_replace(regexp_replace("material", '^0+$', 'Y'), '^X+$', 'X'),
	"coating" = regexp_replace(regexp_replace("coating", '^0+$', 'Y'), '^X+$', 'X'),
	"colour_clarity" = regexp_replace(regexp_replace("colour_clarity", '^0+$', 'Y'), '^X+$', 'X'),
	"shape" = regexp_replace(regexp_replace("shape", '^0+$', 'Y'), '^X+$', 'X'),
	"profile" = regexp_replace(regexp_replace("profile", '^0+$', 'Y'), '^X+$', 'X'),
	"capacity" = regexp_replace(regexp_replace("capacity", '^0+$', 'Y'), '^X+$', 'X'),
	"top_diameter" = regexp_replace(regexp_replace("top_diameter", '^0+$', 'Y'), '^X+$', 'X'),
	"bottom_diameter" = regexp_replace(regexp_replace("bottom_diameter", '^0+$', 'Y'), '^X+$', 'X'),
	"height" = regexp_replace(regexp_replace("height", '^0+$', 'Y'), '^X+$', 'X'),
	"length" = regexp_replace(regexp_replace("length", '^0+$', 'Y'), '^X+$', 'X'),
	"width" = regexp_replace(regexp_replace("width", '^0+$', 'Y'), '^X+$', 'X'),
	"gusset" = regexp_replace(regexp_replace("gusset", '^0+$', 'Y'), '^X+$', 'X'),
	"unit_weight" = regexp_replace(regexp_replace("unit_weight", '^0+$', 'Y'), '^X+$', 'X'),
	"basis_weight" = regexp_replace(regexp_replace("basis_weight", '^0+$', 'Y'), '^X+$', 'X'),
	"thickness" = regexp_replace(regexp_replace("thickness", '^0+$', 'Y'), '^X+$', 'X'),
	"wall" = regexp_replace(regexp_replace("wall", '^0+$', 'Y'), '^X+$', 'X'),
	"print" = regexp_replace(regexp_replace("print", '^0+$', 'Y'), '^X+$', 'X'),
	"compartments" = regexp_replace(regexp_replace("compartments", '^0+$', 'Y'), '^X+$', 'X'),
	"plies" = regexp_replace(regexp_replace("plies", '^0+$', 'Y'), '^X+$', 'X'),
	"lid_opening" = regexp_replace(regexp_replace("lid_opening", '^0+$', 'Y'), '^X+$', 'X'),
	"handle" = regexp_replace(regexp_replace("handle", '^0+$', 'Y'), '^X+$', 'X'),
	"wrap" = regexp_replace(regexp_replace("wrap", '^0+$', 'Y'), '^X+$', 'X'),
	"window" = regexp_replace(regexp_replace("window", '^0+$', 'Y'), '^X+$', 'X'),
	"variant" = regexp_replace(regexp_replace("variant", '^0+$', 'Y'), '^X+$', 'X')
WHERE "code" LIKE 'S2.%';
--> statement-breakpoint
UPDATE "atlas_spec_id_changes"
SET "code_before" = (
		SELECT string_agg(regexp_replace(regexp_replace("part", '^0+$', 'Y'), '^X+$', 'X'), '.' ORDER BY "position")
		FROM unnest(string_to_array(substr("code_before", 4), '.')) WITH ORDINALITY AS "parts" ("part", "position")
	)
WHERE "code_before" LIKE 'S2.%';
--> statement-breakpoint
UPDATE "atlas_spec_id_changes"
SET "code_after" = (
		SELECT string_agg(regexp_replace(regexp_replace("part", '^0+$', 'Y'), '^X+$', 'X'), '.' ORDER BY "position")
		FROM unnest(string_to_array(substr("code_after", 4), '.')) WITH ORDINALITY AS "parts" ("part", "position")
	)
WHERE "code_after" LIKE 'S2.%';

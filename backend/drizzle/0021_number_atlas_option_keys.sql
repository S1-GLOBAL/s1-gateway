-- Dictionary options are known by their number, not their letters (ADR 0033,
-- plan 0012). In S2 0.1.0 an option's key becomes its number, as text, and its
-- letters move to legacy_code, read only for a dotted code given out before.
-- Everything that names an option names it by number: the rules, the search
-- words, the retired numbers, suggestions and every saved Spec ID's facts.
-- Codes do not change, so no Spec ID's version or History moves. S1 0.1.0
-- and the renames are left as they are: they are letters, read only for old
-- codes.
--
-- Old keys are letters, or digits with a leading zero (`01` for 1 colour), and
-- new keys are digits without one, so no key is ever both.

UPDATE "atlas_dictionary_values"
SET "legacy_code" = "code", "code" = "number"::text
WHERE "release" = 'S2 0.1.0';
--> statement-breakpoint

UPDATE "atlas_slot_rules" AS "rule"
SET "product_type" = "value"."code"
FROM "atlas_dictionary_values" AS "value"
WHERE "rule"."release" = 'S2 0.1.0'
	AND "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'productType' AND "value"."legacy_code" = "rule"."product_type";
--> statement-breakpoint

UPDATE "atlas_dictionary_search_words" AS "word"
SET "code" = "value"."code"
FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = "word"."slot" AND "value"."legacy_code" = "word"."code";
--> statement-breakpoint

UPDATE "atlas_dictionary_retired_numbers"
SET "legacy_code" = "code", "code" = "number"::text;
--> statement-breakpoint

-- A suggestion names its option by number, through any rename before. One to
-- add an option names none until it is approved, when it is numbered.
UPDATE "atlas_dictionary_suggestions" AS "suggestion"
SET "code" = "value"."code"
FROM "atlas_dictionary_values" AS "value"
LEFT JOIN "atlas_dictionary_renames" AS "rename" ON "rename"."slot" = "value"."slot" AND "rename"."new_code" = "value"."legacy_code"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = "suggestion"."slot"
	AND ("value"."legacy_code" = "suggestion"."code" OR "rename"."old_code" = "suggestion"."code")
	AND NOT ("suggestion"."kind" = 'add' AND "suggestion"."state" <> 'approved');
--> statement-breakpoint

UPDATE "atlas_dictionary_suggestions" AS "suggestion"
SET "code" = "retired"."code"
FROM "atlas_dictionary_retired_numbers" AS "retired"
WHERE "retired"."slot" = "suggestion"."slot" AND "retired"."legacy_code" = "suggestion"."code"
	AND NOT ("suggestion"."kind" = 'add' AND "suggestion"."state" <> 'approved');
--> statement-breakpoint

UPDATE "atlas_dictionary_suggestions"
SET "code" = ''
WHERE "kind" = 'add' AND "state" <> 'approved';
--> statement-breakpoint

UPDATE "atlas_dictionary_suggestions" AS "suggestion"
SET "proposal" = jsonb_set("suggestion"."proposal", '{replacement}', to_jsonb("value"."code"))
FROM "atlas_dictionary_values" AS "value"
WHERE "suggestion"."kind" = 'delete'
	AND "value"."release" = 'S2 0.1.0' AND "value"."slot" = "suggestion"."slot"
	AND "value"."legacy_code" = "suggestion"."proposal" ->> 'replacement';
--> statement-breakpoint

-- Every saved Spec ID's facts, by number. A capacity is its unit's number,
-- then its amount: Z0012 is 10012.
UPDATE "atlas_spec_ids" AS "spec" SET "product_type" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'productType' AND "value"."legacy_code" = "spec"."product_type";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "material" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'material' AND "value"."legacy_code" = "spec"."material";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "coating" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'coating' AND "value"."legacy_code" = "spec"."coating";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "colour_clarity" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'colourClarity' AND "value"."legacy_code" = "spec"."colour_clarity";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "shape" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'shape' AND "value"."legacy_code" = "spec"."shape";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "profile" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'profile' AND "value"."legacy_code" = "spec"."profile";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "capacity" = "value"."code" || substr("spec"."capacity", 2) FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'capacity' AND "spec"."capacity" NOT IN ('Y', 'X')
	AND "value"."legacy_code" = substr("spec"."capacity", 1, 1);
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "wall" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'wall' AND "value"."legacy_code" = "spec"."wall";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "print" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'print' AND "value"."legacy_code" = "spec"."print";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "lid_opening" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'lidOpening' AND "value"."legacy_code" = "spec"."lid_opening";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "handle" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'handle' AND "value"."legacy_code" = "spec"."handle";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "wrap" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'wrap' AND "value"."legacy_code" = "spec"."wrap";
--> statement-breakpoint
UPDATE "atlas_spec_ids" AS "spec" SET "window" = "value"."code" FROM "atlas_dictionary_values" AS "value"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = 'window' AND "value"."legacy_code" = "spec"."window";
--> statement-breakpoint

-- A material's family was its first letter; now it is said. Kraft's grades
-- are grades of kraft, and every other material of a family a grade of the
-- family's material of grade not known. Those four are families themselves.
UPDATE "atlas_dictionary_values" AS "grade"
SET "broader_number" = "family"."number"
FROM "atlas_dictionary_values" AS "family"
WHERE "grade"."release" = 'S2 0.1.0' AND "grade"."slot" = 'material'
	AND "family"."release" = 'S2 0.1.0' AND "family"."slot" = 'material'
	AND "grade"."legacy_code" NOT IN ('A00', 'B00', 'C00', 'D00')
	AND "family"."legacy_code" = CASE
		WHEN "grade"."legacy_code" LIKE 'BK_' AND "grade"."legacy_code" <> 'BKR' THEN 'BKR'
		WHEN "grade"."legacy_code" LIKE 'A%' THEN 'A00'
		WHEN "grade"."legacy_code" LIKE 'B%' THEN 'B00'
		WHEN "grade"."legacy_code" LIKE 'C%' THEN 'C00'
		WHEN "grade"."legacy_code" LIKE 'D%' THEN 'D00'
	END;
--> statement-breakpoint

-- Plan 0011's glove and cup sleeve options, with the numbers options.ts
-- names them by. A database that has them from a suggestion keeps its own.
INSERT INTO "atlas_dictionary_values" ("release", "slot", "code", "meaning", "number", "broader_number")
SELECT 'S2 0.1.0', "new"."slot", "new"."number"::text, "new"."meaning", "new"."number", "family"."number"
FROM (VALUES
	('material', 'HNI', 'Elastomer, nitrile', 35, NULL),
	('material', 'HLT', 'Elastomer, latex', 36, NULL),
	('material', 'AVN', 'Polymer, vinyl (PVC)', 37, 'A00'),
	('material', 'ACP', 'Polymer, CPE', 38, 'A00'),
	('coating', 'PF', 'Powder-free', 12, NULL),
	('coating', 'PW', 'Powdered', 13, NULL),
	('productType', 'GLV', 'Glove', 35, NULL),
	('productType', 'CSL', 'Cup sleeve', 36, NULL)
) AS "new" ("slot", "letters", "meaning", "number", "family_letters")
LEFT JOIN "atlas_dictionary_values" AS "family"
	ON "family"."release" = 'S2 0.1.0' AND "family"."slot" = 'material' AND "family"."legacy_code" = "new"."family_letters"
WHERE NOT EXISTS (
	SELECT 1 FROM "atlas_dictionary_values" AS "held"
	WHERE "held"."release" = 'S2 0.1.0' AND "held"."slot" = "new"."slot"
		AND ("held"."legacy_code" = "new"."letters" OR "held"."meaning" = "new"."meaning")
);
--> statement-breakpoint

INSERT INTO "atlas_slot_rules" ("release", "product_type", "slot", "rule")
SELECT 'S2 0.1.0', "type"."code", "ruled"."slot", coalesce("given"."rule", 'never')
FROM "atlas_dictionary_values" AS "type"
CROSS JOIN (VALUES
	('coating'), ('colourClarity'), ('shape'), ('profile'), ('capacity'), ('topDiameter'), ('bottomDiameter'),
	('height'), ('length'), ('width'), ('gusset'), ('unitWeight'), ('basisWeight'), ('thickness'), ('wall'),
	('print'), ('compartments'), ('plies'), ('lidOpening'), ('handle'), ('wrap'), ('window')
) AS "ruled" ("slot")
LEFT JOIN (VALUES
	('Glove', 'coating', 'applies'),
	('Glove', 'colourClarity', 'applies'),
	('Glove', 'length', 'applies'),
	('Glove', 'thickness', 'applies'),
	('Glove', 'unitWeight', 'applies'),
	('Cup sleeve', 'colourClarity', 'applies'),
	('Cup sleeve', 'capacity', 'applies'),
	('Cup sleeve', 'height', 'applies'),
	('Cup sleeve', 'basisWeight', 'paper_only'),
	('Cup sleeve', 'unitWeight', 'applies'),
	('Cup sleeve', 'print', 'applies')
) AS "given" ("meaning", "slot", "rule") ON "given"."meaning" = "type"."meaning" AND "given"."slot" = "ruled"."slot"
WHERE "type"."release" = 'S2 0.1.0' AND "type"."slot" = 'productType' AND "type"."meaning" IN ('Glove', 'Cup sleeve')
	AND NOT EXISTS (
		SELECT 1 FROM "atlas_slot_rules" AS "held"
		WHERE "held"."release" = 'S2 0.1.0' AND "held"."product_type" = "type"."code"
	);
--> statement-breakpoint

-- The reader names these by number, so a database where they hold others stops here, not misreads.
DO $$
BEGIN
	IF (
		SELECT count(*) FROM "atlas_dictionary_values" AS "value"
		JOIN (VALUES
			('material', 'Elastomer, nitrile', 35),
			('material', 'Elastomer, latex', 36),
			('material', 'Polymer, vinyl (PVC)', 37),
			('material', 'Polymer, CPE', 38),
			('coating', 'Powder-free', 12),
			('coating', 'Powdered', 13),
			('productType', 'Glove', 35),
			('productType', 'Cup sleeve', 36)
		) AS "expected" ("slot", "meaning", "number")
			ON "value"."slot" = "expected"."slot" AND "value"."meaning" = "expected"."meaning" AND "value"."number" = "expected"."number"
		WHERE "value"."release" = 'S2 0.1.0'
	) <> 8 THEN
		RAISE EXCEPTION 'Plan 0012: the glove and cup sleeve options do not have the numbers options.ts names them by';
	END IF;
END $$;

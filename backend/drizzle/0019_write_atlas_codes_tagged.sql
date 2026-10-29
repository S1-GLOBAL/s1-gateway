-- Spec IDs are written tagged (ADR 0032, plan 0011): each known fact is a
-- letter and a number, so every dictionary option gets a number, and every
-- saved code and every code in History is written again. Facts do not change,
-- so no History row is added.
--
-- First, S2 0.1.0's options are numbered in the order the seed issued them
-- (0010), each list on its own. An option an approved change renamed keeps
-- its number under its new letters, and one it deleted keeps its number in
-- atlas_dictionary_retired_numbers, so no new option takes it (ADR 0031).
WITH "issued" ("slot", "code", "number", "meaning") AS (
	VALUES
		('productType', 'BLD', 1, 'Bowl lid'),
		('productType', 'CLD', 2, 'Cup lid'),
		('productType', 'BWL', 3, 'Bowl'),
		('productType', 'SUP', 4, 'Stand-up pouch'),
		('productType', 'CUP', 5, 'Cup'),
		('productType', 'PCP', 6, 'Portion cup'),
		('productType', 'PCL', 7, 'Portion cup lid'),
		('productType', 'CTN', 8, 'Container'),
		('productType', 'CTL', 9, 'Container lid'),
		('productType', 'CWL', 10, 'Container with lid'),
		('productType', 'HCT', 11, 'Hinged container (clamshell)'),
		('productType', 'TKB', 12, 'Takeout box'),
		('productType', 'FRC', 13, 'Fry carton'),
		('productType', 'FCB', 14, 'Folding carton'),
		('productType', 'RSC', 15, 'Shipping box (RSC)'),
		('productType', 'BAG', 16, 'Bag'),
		('productType', 'NPK', 17, 'Napkin'),
		('productType', 'WRP', 18, 'Wrap or sheet'),
		('productType', 'FLM', 19, 'Film or roll'),
		('productType', 'PLT', 20, 'Plate'),
		('productType', 'TRY', 21, 'Tray'),
		('productType', 'PAN', 22, 'Pan'),
		('productType', 'CCR', 23, 'Cup carrier'),
		('productType', 'STW', 24, 'Straw'),
		('productType', 'STR', 25, 'Stirrer'),
		('productType', 'FRK', 26, 'Fork'),
		('productType', 'KNF', 27, 'Knife'),
		('productType', 'SPN', 28, 'Spoon'),
		('productType', 'CKT', 29, 'Cutlery kit'),
		('productType', 'SCH', 30, 'Sachet'),
		('productType', 'LBL', 31, 'Label'),
		('material', 'APT', 1, 'Polymer, PET'),
		('material', 'ARP', 2, 'Polymer, rPET'),
		('material', 'APP', 3, 'Polymer, PP'),
		('material', 'APS', 4, 'Polymer, PS (polystyrene)'),
		('material', 'AEP', 5, 'Polymer, EPS foam'),
		('material', 'AHD', 6, 'Polymer, HDPE'),
		('material', 'ALD', 7, 'Polymer, LDPE'),
		('material', 'ALL', 8, 'Polymer, LLDPE'),
		('material', 'APL', 9, 'Polymer, PLA'),
		('material', 'APM', 10, 'Polymer, PSM (starch blend)'),
		('material', 'A00', 11, 'Polymer, grade not known'),
		('material', 'BKR', 12, 'Paper and paperboard, kraft'),
		('material', 'BKB', 13, 'Paper and paperboard, brown kraft'),
		('material', 'BKW', 14, 'Paper and paperboard, white kraft'),
		('material', 'BKV', 15, 'Paper and paperboard, virgin kraft'),
		('material', 'BKC', 16, 'Paper and paperboard, recycled kraft'),
		('material', 'BCS', 17, 'Paper and paperboard, cup stock'),
		('material', 'BSB', 18, 'Paper and paperboard, SBS'),
		('material', 'BCB', 19, 'Paper and paperboard, corrugated'),
		('material', 'BGP', 20, 'Paper and paperboard, greaseproof'),
		('material', 'BTS', 21, 'Paper and paperboard, tissue'),
		('material', 'BWP', 22, 'Paper and paperboard, wax paper'),
		('material', 'BSG', 23, 'Paper and paperboard, semi-gloss'),
		('material', 'B00', 24, 'Paper and paperboard, grade not known'),
		('material', 'CBG', 25, 'Molded fibre, bagasse'),
		('material', 'CBM', 26, 'Molded fibre, bamboo'),
		('material', 'CGR', 27, 'Molded fibre, grass'),
		('material', 'CSW', 28, 'Molded fibre, seaweed'),
		('material', 'C00', 29, 'Molded fibre, grade not known'),
		('material', 'DAL', 30, 'Metal, aluminium'),
		('material', 'D00', 31, 'Metal, grade not known'),
		('material', 'FBW', 32, 'Wood, birch / hardwood'),
		('material', 'HSI', 33, 'Elastomer, silicone'),
		('material', 'JPP', 34, 'Laminate, paper / polymer'),
		('coating', 'NC', 1, 'No coating, as stated by the source'),
		('coating', 'PI', 2, 'PE inside only'),
		('coating', 'PO', 3, 'PE outside only'),
		('coating', 'PB', 4, 'PE both sides'),
		('coating', 'PU', 5, 'PE, side not stated'),
		('coating', 'PL', 6, 'PLA lined'),
		('coating', 'CP', 7, 'CPET coated'),
		('coating', 'GR', 8, 'Grease-resistant coating'),
		('coating', 'WC', 9, 'Wax coated'),
		('coating', 'LM', 10, 'Film laminated'),
		('coating', 'SC', 11, 'Silicone coated'),
		('colourClarity', 'CL', 1, 'Clear'),
		('colourClarity', 'TL', 2, 'Translucent'),
		('colourClarity', 'WH', 3, 'White'),
		('colourClarity', 'BR', 4, 'Brown'),
		('colourClarity', 'BK', 5, 'Black'),
		('shape', 'RD', 1, 'Round'),
		('shape', 'SQ', 2, 'Square'),
		('shape', 'RC', 3, 'Rectangular'),
		('shape', 'OV', 4, 'Oval'),
		('profile', 'DM', 1, 'Dome'),
		('profile', 'HD', 2, 'Half dome'),
		('profile', 'FL', 3, 'Flat'),
		('capacity', 'Z', 1, 'Ounces, nominal trade size'),
		('capacity', 'M', 2, 'Millilitres'),
		('capacity', 'S', 3, 'Servings'),
		('capacity', 'N', 4, 'Count'),
		('capacity', 'G', 5, 'Grams'),
		('wall', 'SW', 1, 'Single wall'),
		('wall', 'DW', 2, 'Double wall'),
		('wall', 'RW', 3, 'Ripple wall'),
		('print', 'NP', 1, 'No print'),
		('print', '01', 2, '1 colour'),
		('print', '02', 3, '2 colours'),
		('print', '03', 4, '3 colours'),
		('print', '04', 5, '4 colours'),
		('print', '05', 6, '5 colours'),
		('print', '06', 7, '6 colours'),
		('print', '07', 8, '7 colours'),
		('print', '08', 9, '8 colours'),
		('print', 'FC', 10, 'Full colour'),
		('lidOpening', 'CO', 1, 'Closed'),
		('lidOpening', 'SP', 2, 'Sip-through opening'),
		('lidOpening', 'SH', 3, 'Straw hole or slit'),
		('handle', 'NH', 1, 'No handle'),
		('handle', 'TW', 2, 'Twisted paper'),
		('handle', 'FT', 3, 'Flat tape'),
		('handle', 'TS', 4, 'T-shirt (vest)'),
		('wrap', 'NW', 1, 'Not wrapped'),
		('wrap', 'PW', 2, 'Paper-wrapped'),
		('wrap', 'FW', 3, 'Film-wrapped'),
		('window', 'NN', 1, 'No window'),
		('window', 'WN', 2, 'With window')
)
UPDATE "atlas_dictionary_values" AS "value"
SET "number" = "issued"."number"
FROM "issued"
LEFT JOIN "atlas_dictionary_renames" AS "rename"
	ON "rename"."slot" = "issued"."slot" AND "rename"."old_code" = "issued"."code"
WHERE "value"."release" = 'S2 0.1.0'
	AND "value"."number" IS NULL
	AND "value"."slot" = "issued"."slot"
	AND "value"."code" = CASE WHEN "rename"."old_code" IS NULL THEN "issued"."code" ELSE "rename"."new_code" END;
--> statement-breakpoint
WITH "issued" ("slot", "code", "number", "meaning") AS (
	VALUES
		('productType', 'BLD', 1, 'Bowl lid'),
		('productType', 'CLD', 2, 'Cup lid'),
		('productType', 'BWL', 3, 'Bowl'),
		('productType', 'SUP', 4, 'Stand-up pouch'),
		('productType', 'CUP', 5, 'Cup'),
		('productType', 'PCP', 6, 'Portion cup'),
		('productType', 'PCL', 7, 'Portion cup lid'),
		('productType', 'CTN', 8, 'Container'),
		('productType', 'CTL', 9, 'Container lid'),
		('productType', 'CWL', 10, 'Container with lid'),
		('productType', 'HCT', 11, 'Hinged container (clamshell)'),
		('productType', 'TKB', 12, 'Takeout box'),
		('productType', 'FRC', 13, 'Fry carton'),
		('productType', 'FCB', 14, 'Folding carton'),
		('productType', 'RSC', 15, 'Shipping box (RSC)'),
		('productType', 'BAG', 16, 'Bag'),
		('productType', 'NPK', 17, 'Napkin'),
		('productType', 'WRP', 18, 'Wrap or sheet'),
		('productType', 'FLM', 19, 'Film or roll'),
		('productType', 'PLT', 20, 'Plate'),
		('productType', 'TRY', 21, 'Tray'),
		('productType', 'PAN', 22, 'Pan'),
		('productType', 'CCR', 23, 'Cup carrier'),
		('productType', 'STW', 24, 'Straw'),
		('productType', 'STR', 25, 'Stirrer'),
		('productType', 'FRK', 26, 'Fork'),
		('productType', 'KNF', 27, 'Knife'),
		('productType', 'SPN', 28, 'Spoon'),
		('productType', 'CKT', 29, 'Cutlery kit'),
		('productType', 'SCH', 30, 'Sachet'),
		('productType', 'LBL', 31, 'Label'),
		('material', 'APT', 1, 'Polymer, PET'),
		('material', 'ARP', 2, 'Polymer, rPET'),
		('material', 'APP', 3, 'Polymer, PP'),
		('material', 'APS', 4, 'Polymer, PS (polystyrene)'),
		('material', 'AEP', 5, 'Polymer, EPS foam'),
		('material', 'AHD', 6, 'Polymer, HDPE'),
		('material', 'ALD', 7, 'Polymer, LDPE'),
		('material', 'ALL', 8, 'Polymer, LLDPE'),
		('material', 'APL', 9, 'Polymer, PLA'),
		('material', 'APM', 10, 'Polymer, PSM (starch blend)'),
		('material', 'A00', 11, 'Polymer, grade not known'),
		('material', 'BKR', 12, 'Paper and paperboard, kraft'),
		('material', 'BKB', 13, 'Paper and paperboard, brown kraft'),
		('material', 'BKW', 14, 'Paper and paperboard, white kraft'),
		('material', 'BKV', 15, 'Paper and paperboard, virgin kraft'),
		('material', 'BKC', 16, 'Paper and paperboard, recycled kraft'),
		('material', 'BCS', 17, 'Paper and paperboard, cup stock'),
		('material', 'BSB', 18, 'Paper and paperboard, SBS'),
		('material', 'BCB', 19, 'Paper and paperboard, corrugated'),
		('material', 'BGP', 20, 'Paper and paperboard, greaseproof'),
		('material', 'BTS', 21, 'Paper and paperboard, tissue'),
		('material', 'BWP', 22, 'Paper and paperboard, wax paper'),
		('material', 'BSG', 23, 'Paper and paperboard, semi-gloss'),
		('material', 'B00', 24, 'Paper and paperboard, grade not known'),
		('material', 'CBG', 25, 'Molded fibre, bagasse'),
		('material', 'CBM', 26, 'Molded fibre, bamboo'),
		('material', 'CGR', 27, 'Molded fibre, grass'),
		('material', 'CSW', 28, 'Molded fibre, seaweed'),
		('material', 'C00', 29, 'Molded fibre, grade not known'),
		('material', 'DAL', 30, 'Metal, aluminium'),
		('material', 'D00', 31, 'Metal, grade not known'),
		('material', 'FBW', 32, 'Wood, birch / hardwood'),
		('material', 'HSI', 33, 'Elastomer, silicone'),
		('material', 'JPP', 34, 'Laminate, paper / polymer'),
		('coating', 'NC', 1, 'No coating, as stated by the source'),
		('coating', 'PI', 2, 'PE inside only'),
		('coating', 'PO', 3, 'PE outside only'),
		('coating', 'PB', 4, 'PE both sides'),
		('coating', 'PU', 5, 'PE, side not stated'),
		('coating', 'PL', 6, 'PLA lined'),
		('coating', 'CP', 7, 'CPET coated'),
		('coating', 'GR', 8, 'Grease-resistant coating'),
		('coating', 'WC', 9, 'Wax coated'),
		('coating', 'LM', 10, 'Film laminated'),
		('coating', 'SC', 11, 'Silicone coated'),
		('colourClarity', 'CL', 1, 'Clear'),
		('colourClarity', 'TL', 2, 'Translucent'),
		('colourClarity', 'WH', 3, 'White'),
		('colourClarity', 'BR', 4, 'Brown'),
		('colourClarity', 'BK', 5, 'Black'),
		('shape', 'RD', 1, 'Round'),
		('shape', 'SQ', 2, 'Square'),
		('shape', 'RC', 3, 'Rectangular'),
		('shape', 'OV', 4, 'Oval'),
		('profile', 'DM', 1, 'Dome'),
		('profile', 'HD', 2, 'Half dome'),
		('profile', 'FL', 3, 'Flat'),
		('capacity', 'Z', 1, 'Ounces, nominal trade size'),
		('capacity', 'M', 2, 'Millilitres'),
		('capacity', 'S', 3, 'Servings'),
		('capacity', 'N', 4, 'Count'),
		('capacity', 'G', 5, 'Grams'),
		('wall', 'SW', 1, 'Single wall'),
		('wall', 'DW', 2, 'Double wall'),
		('wall', 'RW', 3, 'Ripple wall'),
		('print', 'NP', 1, 'No print'),
		('print', '01', 2, '1 colour'),
		('print', '02', 3, '2 colours'),
		('print', '03', 4, '3 colours'),
		('print', '04', 5, '4 colours'),
		('print', '05', 6, '5 colours'),
		('print', '06', 7, '6 colours'),
		('print', '07', 8, '7 colours'),
		('print', '08', 9, '8 colours'),
		('print', 'FC', 10, 'Full colour'),
		('lidOpening', 'CO', 1, 'Closed'),
		('lidOpening', 'SP', 2, 'Sip-through opening'),
		('lidOpening', 'SH', 3, 'Straw hole or slit'),
		('handle', 'NH', 1, 'No handle'),
		('handle', 'TW', 2, 'Twisted paper'),
		('handle', 'FT', 3, 'Flat tape'),
		('handle', 'TS', 4, 'T-shirt (vest)'),
		('wrap', 'NW', 1, 'Not wrapped'),
		('wrap', 'PW', 2, 'Paper-wrapped'),
		('wrap', 'FW', 3, 'Film-wrapped'),
		('window', 'NN', 1, 'No window'),
		('window', 'WN', 2, 'With window')
)
INSERT INTO "atlas_dictionary_retired_numbers" ("slot", "number", "code", "meaning", "change_number")
SELECT "issued"."slot", "issued"."number", "issued"."code", "issued"."meaning", "rename"."change_number"
FROM "issued"
JOIN "atlas_dictionary_renames" AS "rename"
	ON "rename"."slot" = "issued"."slot" AND "rename"."old_code" = "issued"."code" AND "rename"."new_code" IS NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- A vessel sold with its own lid is one product type, as container with lid
-- already is. Numbered after the seed, so no earlier number moves: A32 to A34.
-- A slot applies when the vessel or its lid has it.
INSERT INTO "atlas_dictionary_values" ("release", "slot", "code", "meaning", "number") VALUES
	('S2 0.1.0', 'productType', 'BWB', 'Bowl with Bowl Lid', 32),
	('S2 0.1.0', 'productType', 'CWC', 'Cup with Cup Lid', 33),
	('S2 0.1.0', 'productType', 'PWC', 'Portion cup with Portion cup lid', 34)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "atlas_slot_rules" ("release", "product_type", "slot", "rule") VALUES
	('S2 0.1.0', 'BWB', 'coating', 'applies'),
	('S2 0.1.0', 'BWB', 'colourClarity', 'applies'),
	('S2 0.1.0', 'BWB', 'shape', 'applies'),
	('S2 0.1.0', 'BWB', 'profile', 'applies'),
	('S2 0.1.0', 'BWB', 'capacity', 'applies'),
	('S2 0.1.0', 'BWB', 'topDiameter', 'round_only'),
	('S2 0.1.0', 'BWB', 'bottomDiameter', 'round_only'),
	('S2 0.1.0', 'BWB', 'height', 'applies'),
	('S2 0.1.0', 'BWB', 'length', 'non_round_only'),
	('S2 0.1.0', 'BWB', 'width', 'non_round_only'),
	('S2 0.1.0', 'BWB', 'gusset', 'never'),
	('S2 0.1.0', 'BWB', 'unitWeight', 'applies'),
	('S2 0.1.0', 'BWB', 'basisWeight', 'paper_only'),
	('S2 0.1.0', 'BWB', 'thickness', 'applies'),
	('S2 0.1.0', 'BWB', 'wall', 'applies'),
	('S2 0.1.0', 'BWB', 'print', 'applies'),
	('S2 0.1.0', 'BWB', 'compartments', 'applies'),
	('S2 0.1.0', 'BWB', 'plies', 'never'),
	('S2 0.1.0', 'BWB', 'lidOpening', 'never'),
	('S2 0.1.0', 'BWB', 'handle', 'never'),
	('S2 0.1.0', 'BWB', 'wrap', 'never'),
	('S2 0.1.0', 'BWB', 'window', 'never'),
	('S2 0.1.0', 'CWC', 'coating', 'applies'),
	('S2 0.1.0', 'CWC', 'colourClarity', 'applies'),
	('S2 0.1.0', 'CWC', 'shape', 'applies'),
	('S2 0.1.0', 'CWC', 'profile', 'applies'),
	('S2 0.1.0', 'CWC', 'capacity', 'applies'),
	('S2 0.1.0', 'CWC', 'topDiameter', 'round_only'),
	('S2 0.1.0', 'CWC', 'bottomDiameter', 'round_only'),
	('S2 0.1.0', 'CWC', 'height', 'applies'),
	('S2 0.1.0', 'CWC', 'length', 'non_round_only'),
	('S2 0.1.0', 'CWC', 'width', 'non_round_only'),
	('S2 0.1.0', 'CWC', 'gusset', 'never'),
	('S2 0.1.0', 'CWC', 'unitWeight', 'applies'),
	('S2 0.1.0', 'CWC', 'basisWeight', 'paper_only'),
	('S2 0.1.0', 'CWC', 'thickness', 'applies'),
	('S2 0.1.0', 'CWC', 'wall', 'applies'),
	('S2 0.1.0', 'CWC', 'print', 'applies'),
	('S2 0.1.0', 'CWC', 'compartments', 'never'),
	('S2 0.1.0', 'CWC', 'plies', 'never'),
	('S2 0.1.0', 'CWC', 'lidOpening', 'applies'),
	('S2 0.1.0', 'CWC', 'handle', 'never'),
	('S2 0.1.0', 'CWC', 'wrap', 'never'),
	('S2 0.1.0', 'CWC', 'window', 'never'),
	('S2 0.1.0', 'PWC', 'coating', 'applies'),
	('S2 0.1.0', 'PWC', 'colourClarity', 'applies'),
	('S2 0.1.0', 'PWC', 'shape', 'applies'),
	('S2 0.1.0', 'PWC', 'profile', 'applies'),
	('S2 0.1.0', 'PWC', 'capacity', 'applies'),
	('S2 0.1.0', 'PWC', 'topDiameter', 'round_only'),
	('S2 0.1.0', 'PWC', 'bottomDiameter', 'round_only'),
	('S2 0.1.0', 'PWC', 'height', 'applies'),
	('S2 0.1.0', 'PWC', 'length', 'non_round_only'),
	('S2 0.1.0', 'PWC', 'width', 'non_round_only'),
	('S2 0.1.0', 'PWC', 'gusset', 'never'),
	('S2 0.1.0', 'PWC', 'unitWeight', 'applies'),
	('S2 0.1.0', 'PWC', 'basisWeight', 'paper_only'),
	('S2 0.1.0', 'PWC', 'thickness', 'applies'),
	('S2 0.1.0', 'PWC', 'wall', 'never'),
	('S2 0.1.0', 'PWC', 'print', 'applies'),
	('S2 0.1.0', 'PWC', 'compartments', 'never'),
	('S2 0.1.0', 'PWC', 'plies', 'never'),
	('S2 0.1.0', 'PWC', 'lidOpening', 'applies'),
	('S2 0.1.0', 'PWC', 'handle', 'never'),
	('S2 0.1.0', 'PWC', 'wrap', 'never'),
	('S2 0.1.0', 'PWC', 'window', 'never')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- An option an approved suggestion added takes the next number in its list,
-- in the order the additions were approved.
WITH "highest" AS (
	SELECT "slot", max("number") AS "number"
	FROM (
		SELECT "slot", "number" FROM "atlas_dictionary_values" WHERE "release" = 'S2 0.1.0' AND "number" IS NOT NULL
		UNION ALL
		SELECT "slot", "number" FROM "atlas_dictionary_retired_numbers"
	) AS "taken"
	GROUP BY "slot"
), "unnumbered" AS (
	SELECT
		"value"."slot",
		"value"."code",
		coalesce("highest"."number", 0) + row_number() OVER (
			PARTITION BY "value"."slot"
			ORDER BY (
				SELECT min("suggestion"."change_number")
				FROM "atlas_dictionary_suggestions" AS "suggestion"
				WHERE "suggestion"."kind" = 'add' AND "suggestion"."slot" = "value"."slot" AND "suggestion"."code" = "value"."code"
			) NULLS LAST,
			"value"."code"
		) AS "number"
	FROM "atlas_dictionary_values" AS "value"
	LEFT JOIN "highest" ON "highest"."slot" = "value"."slot"
	WHERE "value"."release" = 'S2 0.1.0' AND "value"."number" IS NULL
)
UPDATE "atlas_dictionary_values" AS "value"
SET "number" = "unnumbered"."number"
FROM "unnumbered"
WHERE "value"."release" = 'S2 0.1.0' AND "value"."slot" = "unnumbered"."slot" AND "value"."code" = "unnumbered"."code";
--> statement-breakpoint
-- The tagged code for a dotted code's 25 parts, as writeCode in
-- backend/src/modules/atlas/domain/code.ts writes it: facts first, then one
-- hyphen and the sizes; a part not known or that doesn't apply, and the
-- variant, left out. An option in letters an approved change renamed reads
-- as the option it is now, and a deleted one by its retired number. Null
-- when a part has no number: that code is left as it is, and still reads.
CREATE FUNCTION pg_temp.atlas_tagged_code(parts text[]) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
	slots constant text[] := ARRAY['productType', 'material', 'coating', 'colourClarity', 'shape', 'profile', 'capacity',
		'topDiameter', 'bottomDiameter', 'height', 'length', 'width', 'gusset', 'unitWeight', 'basisWeight', 'thickness',
		'wall', 'print', 'compartments', 'plies', 'lidOpening', 'handle', 'wrap', 'window'];
	letters constant text := 'ABCDEFGHIJKLMNOPQRSTUVWX';
	facts text := '';
	sizes text := '';
	part text;
	written text;
	now_written text;
	option_number integer;
BEGIN
	IF array_length(parts, 1) IS DISTINCT FROM 25 THEN
		RETURN NULL;
	END IF;
	FOR i IN 1..24 LOOP
		part := parts[i];
		CONTINUE WHEN part IS NULL OR part ~ '^(0+|X+|Y)$';
		IF i BETWEEN 8 AND 16 OR i IN (19, 20) THEN
			part := substr(letters, i, 1) || regexp_replace(part, '^0+(?=[0-9])', '');
		ELSE
			written := CASE WHEN i = 7 THEN left(part, 1) ELSE part END;
			now_written := written;
			IF NOT EXISTS (
				SELECT 1 FROM "atlas_dictionary_values" WHERE "release" = 'S2 0.1.0' AND "slot" = slots[i] AND "code" = written
			) THEN
				SELECT "new_code" INTO now_written FROM "atlas_dictionary_renames" WHERE "slot" = slots[i] AND "old_code" = written;
			END IF;
			SELECT "number" INTO option_number
			FROM "atlas_dictionary_values"
			WHERE "release" = 'S2 0.1.0' AND "slot" = slots[i] AND "code" = now_written;
			IF option_number IS NULL THEN
				SELECT "number" INTO option_number FROM "atlas_dictionary_retired_numbers" WHERE "slot" = slots[i] AND "code" = written;
			END IF;
			IF option_number IS NULL THEN
				RETURN NULL;
			END IF;
			part := substr(letters, i, 1) || option_number
				|| CASE WHEN i = 7 THEN regexp_replace(substr(part, 2), '^0+(?=[0-9])', '') ELSE '' END;
		END IF;
		IF i BETWEEN 7 AND 16 THEN
			sizes := sizes || part;
		ELSE
			facts := facts || part;
		END IF;
	END LOOP;
	RETURN facts || CASE WHEN sizes = '' THEN '' ELSE '-' || sizes END;
END
$$;
--> statement-breakpoint
-- Every saved code still dotted: a dot not between two digits.
UPDATE "atlas_spec_ids"
SET "code" = coalesce(pg_temp.atlas_tagged_code(ARRAY[
	"product_type", "material", "coating", "colour_clarity", "shape", "profile", "capacity",
	"top_diameter", "bottom_diameter", "height", "length", "width", "gusset", "unit_weight", "basis_weight", "thickness",
	"wall", "print", "compartments", "plies", "lid_opening", "handle", "wrap", "window", "variant"
]::text[]), "code")
WHERE "code" ~ '[^0-9][.]|[.][^0-9]';
--> statement-breakpoint
UPDATE "atlas_spec_id_changes"
SET "code_before" = coalesce(pg_temp.atlas_tagged_code(string_to_array("code_before", '.')), "code_before")
WHERE "code_before" ~ '[^0-9][.]|[.][^0-9]';
--> statement-breakpoint
UPDATE "atlas_spec_id_changes"
SET "code_after" = coalesce(pg_temp.atlas_tagged_code(string_to_array("code_after", '.')), "code_after")
WHERE "code_after" ~ '[^0-9][.]|[.][^0-9]';
--> statement-breakpoint
DROP FUNCTION pg_temp.atlas_tagged_code(text[]);

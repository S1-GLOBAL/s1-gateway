# 0006. S2 Spec IDs, a dictionary from the verified list, and its import

- **Status:** In progress
- **Owner:** Rey Denzo
- **Related:** [#28](https://github.com/S1-GLOBAL/s1-gateway/issues/28) ·
  [plan 0004](./0004-atlas-library-and-editable-spec-ids.md) ·
  [ADR 0005](../decisions/0005-migrations-over-db-push.md) ·
  [ADR 0007](../decisions/0007-one-definition-of-an-api-shape.md) ·
  [ADR 0019](../decisions/0019-the-s1-spec-id-format.md) ·
  [ADR 0021](../decisions/0021-the-atlas-dictionary-changes-only-by-migration.md) ·
  [ADR 0022](../decisions/0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md) ·
  [ADR 0025](../decisions/0025-spec-ids-are-written-short.md) ·
  [ADR 0026](../decisions/0026-raw-text-is-read-by-rules-and-a-public-word-list.md) ·
  [ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md) ·
  [#56](https://github.com/S1-GLOBAL/s1-gateway/issues/56) ·
  [#57](https://github.com/S1-GLOBAL/s1-gateway/issues/57)

## Goal

At the end of this plan every Spec ID is a short code (ADR 0025): 25 parts,
product type first, an empty slot `Y` or `X`. Codes come from release S2 0.1.0, whose 31 product types,
30 materials and other lists come from the verified list. Every Spec ID saved
before the release, and its History, is converted, and every S1 code ever
given out still finds its product. The workspace offers all of it, and
`npm --prefix backend run atlas:import` loads the verified list into the
library. Issue [#28](https://github.com/S1-GLOBAL/s1-gateway/issues/28) is the
specification: its tables are the exact dictionary, rules and copy, and where
this plan and the issue disagree, the issue wins and this plan is corrected.
Since 2026-10-22 the import also records each row's manufacturer and quote
against its Spec ID (phase 4, ADR 0027), so the Manufacturers page (#57) has
its data; [#56](https://github.com/S1-GLOBAL/s1-gateway/issues/56) is the
specification for phases 3 and 4.

## Scope

**In scope**
- ADR 0024 (the S2 format), partly superseding ADR 0019 and ADR 0021
- The S2 slots in the domain, the contract, the code columns and every page that shows a code
- Release S2 0.1.0 by migration, and the conversion of saved codes and History
- The workspace's new controls and group 06
- `atlas:import` and its CSV report. Spellings are `WORD_LIST` (plan 0007)
- Each row's manufacturer, country, FOB prices, mold cost and lead times, recorded against its Spec ID (phase 4, ADR 0027)
- `api.md`, `data-model.md` and `commands.md`

**Out of scope** — and where it is handled instead
- The Manufacturers page and its stages — #57
- Adding or editing manufacturers and quotes in Atlas — #61
- Case packing, case weights and case dimensions — not stored (ADR 0027)
- Editing the dictionary from the app — no issue yet
- Variant numbers and the collision review — no issue yet
- Running the import on production — reyxdz, with the release, after staging

## Prerequisites

- Plan 0004's code is on `main` (#20, #25 and #27 merged). Verify:
  `git grep -n "useSpecIdLibrary" origin/main -- frontend/src` prints a match.
- The last migration is `0008_backfill_person_names`. Verify:
  `git show origin/main:backend/drizzle/meta/_journal.json | grep -c '"tag"'` prints `9`.
- A working local setup: `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit`
  exits 0 on a fresh branch from `main`, and `npm run db:up` then `npm test` passes.
- For phases 3 and 4 only: the verified list workbook (prepared on 2026-10-19) on reyxdz's computer. Never in the repository, and never its rows, names or prices in tests or docs (ADR 0027). Its spelling table's entries, without the `skip` entries, are `WORD_LIST`.

## Progress

Built by following a handoff written for this plan, one phase per pull
request, stopping for the owner after each.

| Phase | Steps | Status |
|---|---|---|
| 1. S2 format, S2 0.1.0 and the conversion | 7 / 7 | Done — on staging, a Spec ID saved before the release opens with its S2 code, and its old S1 code finds it; see #28 |
| 2. Workspace and library for S2 | 4 / 4 | Done — on staging, a 2-colour-print double-wall cup and a 3-compartment bagasse container save with their S2 codes, and an S1 code given out before phase 1 still finds its product; see #28 |
| 3. The verified-list import | 5 / 5 | Done — `atlas:import` reads the verified list and saves its Spec IDs (#63); the staging run waits for phase 4 (Step 4.5) |
| 4. Manufacturers and quotes | 4 / 5 | In progress — `atlas:import` records manufacturers and quotes (#64); step 4.5, the staging run, is reyxdz's |

---

## Design

### Precedents this plan sets

| First | How | Why this way |
|---|---|---|
| A change to the code's format | A new format version, `S2`; slots 1–17 keep their positions and the new slots sit before the variant | Every reader of positions 1–17 keeps working; the variant stays last, as ADR 0019 has it |
| A migration that rewrites saved data | Hand-written SQL that converts by product type, proved equal to the TypeScript conversion for every S1 product type | The conversion is a pure function of the code, so SQL and TypeScript can be compared exactly |
| A command that writes staff data | `src/scripts/atlas-import.ts`, like `create-admin.ts`: composes the module's own use cases, never starts HTTP, saves nothing without `--write` | One path for every save, so the import obeys the same rules as the workspace |
| Commercial data from Source One | Manufacturers and quotes in two tables, behind sign-in, kept as the workbook writes them; tests use invented ones (ADR 0027) | The repository is public; the database is not |

### The S2 layout — `backend/src/modules/atlas/domain/slots.ts`

`SlotKey` gains, in this order after `thickness`: `wall`, `print`,
`compartments`, `plies`, `lidOpening`, `handle`, `wrap`, `window`; then
`variant`. `SLOT_COUNT = 26`, `SPEC_ID_LENGTH = 97`, `FORMAT_VERSION = 'S2'`,
`CURRENT_RELEASE = 'S2 0.1.0'`.

| Key | Name | Width | Kind |
|---|---|---|---|
| `wall` | Wall | 2 | `dictionary` |
| `print` | Print | 2 | `dictionary` |
| `compartments` | Compartments | 2 | `count` (1–12) |
| `plies` | Plies | 1 | `count` (1–4) |
| `lidOpening` | Lid opening | 2 | `dictionary` |
| `handle` | Handle | 2 | `dictionary` |
| `wrap` | Individual wrap | 2 | `dictionary` |
| `window` | Window | 2 | `dictionary` |

- `SlotKind` adds `count`: a whole number, padded to the width, `0`-filled when not known, refused outside its range with "{Name}: {value} is outside 1–{max}." (#28 copy).
- `DICTIONARY_SLOTS` adds the six dictionary keys; `RULED_SLOTS` adds all eight.
- The rules for the new slots use only `applies` and `never`.

### S1 codes — `backend/src/modules/atlas/domain/s1-code.ts`

`fromS1(code: string): string | null` turns a 74-character S1 code into its
S2 code: `S2`, characters 3–71 unchanged, then the eight new slots from the
fixed table below (`0` where the S2 rules apply them to the code's product type,
`X` where they don't), then the variant. S1 had only these four product types,
so the conversion needs no dictionary, and a test proves the table equals S2
0.1.0's rules. Anything that is not 18 slots starting `S1.` returns null.
`SpecId.parse` calls it first, so decoding and `GET /atlas/spec-ids/:code` take
S1 codes; nothing ever issues one.

`toS1(code: string): string | null` is the reverse, and `storedForms(code)`
names both forms. The old API keeps running for a minute or two after the
migration during a deploy, so a row it saves there holds an S1 code and no
added slots (reyxdz, 2026-10-19: convert on every read). The mapper reads its
added slots from the table, History codes are converted as they are read, and
lookups, former holders and the "already saved" check match a code in both forms.

For the four S1 product types the new slots read:

| Type | Wall · Print · Compartments · Plies · Lid opening · Handle · Wrap · Window |
|---|---|
| `BLD` | `XX.00.XX.X.XX.XX.XX.XX` |
| `CLD` | `XX.00.XX.X.00.XX.XX.XX` |
| `BWL` | `00.00.00.X.XX.XX.XX.XX` |
| `SUP` | `XX.00.XX.X.XX.XX.XX.00` |

### Migrations — `backend/drizzle/`

| # | Name | Made by | Does |
|---|---|---|---|
| 0009 | `atlas_codes_97_characters` | `npm --prefix backend run db:generate -- --name atlas_codes_97_characters` | `atlas_spec_ids.code`, `atlas_spec_id_changes.code_before` and `code_after` to `varchar(97)`; the eight slot columns on `atlas_spec_ids` (nullable), each with its index |
| 0010 | `seed_atlas_dictionary_s2_0_1_0` | `npm --prefix backend run db:generate -- --custom --name seed_atlas_dictionary_s2_0_1_0` | Release `S2 0.1.0` (approved `2026-10-19`), every value and every rule in #28's tables |
| 0011 | `convert_atlas_codes_to_s2` | `npm --prefix backend run db:generate -- --custom --name convert_atlas_codes_to_s2` | Every S1 `code`, `code_before` and `code_after` to S2 by the table above; `dictionary_release` to `S2 0.1.0` |

0011's SQL, per row: `'S2' || substr(code, 3, 69) || '.' || <the type's eight slots> || '.' || right(code, 2)`,
with the type read from `substr(code, 4, 3)` and only codes starting `S1.` touched;
it also fills the eight slot columns.

### Contract — `backend/src/contracts/atlas.ts`

`SlotKey` as above. `SpecIdFacts` gains `wall`, `print`, `lidOpening`,
`handle`, `wrap`, `window` (`string | null`, dictionary codes) and
`compartments`, `plies` (`string | null`, whole numbers as text). `DecodedSlot.number`
is 1–26. Nothing else changes shape.

### Frontend

| Name | File | Phase |
|---|---|---|
| `SLOT_NAMES` (26), `SlotKey` | `features/atlas/domain/atlas.ts` | 1 |
| `ILLUSTRATIVE` and fixtures as S2 codes | `features/atlas/application/testing/atlas-fixtures.ts`, page tests | 1 |
| `CODE_SLOTS` adds the six dictionary slots; `COUNT_SLOTS` (`compartments`, `plies`: typed, and refused out of range by the server) | `features/atlas/domain/slot-controls.ts` | 2 |
| `BuildForm.counts`; `toFacts`, `toBuildForm`, `isFormChanged` | `features/atlas/domain/build-facts.ts`, `to-build-form.ts` | 2 |
| Group 06 "Print and features"; the groups of #28 | `features/atlas/presentation/workspace/FactGroups.tsx` | 2 |
| Product type as a `SelectField` listing the dictionary's product types in its order (31 types do not fit a segmented row) | same | 2 |

### The import — phase 3

| Name | File | Shape |
|---|---|---|
| `WORD_LIST` | `backend/src/modules/atlas/domain/reading/word-list.ts` | The spelling table's entries, without its `skip` entries (plan 0007, ADR 0026). Not a JSON file |
| `readSize` | `backend/src/modules/atlas/domain/reading/size-rulings.ts` | Already shipped with plan 0007: #28's ruling table, units by ADR 0019 |
| `readText` | `backend/src/modules/atlas/domain/reading/read-text.ts` | Item names, in place of `item-name.ts`. The keyword table is `KEYWORDS` beside it |
| `readVerifiedRow` | `domain/import/verified-row.ts` | `(row: VerifiedRow) => RowReading` — columns first, the item name through `readText`, sizes through `readSize` |
| `ImportVerifiedList` | `application/import-verified-list.ts` | builds every code, groups rows by code, names each group by its most common item name (first row on a tie), saves through `SaveSpecId` only when writing, returns `ImportReport` |
| `VerifiedListSource`, `ImportReportSink` | `application/ports/` | read rows; write the report |
| `ExcelVerifiedListSource` | `infrastructure/excel-verified-list-source.ts` | `exceljs` (new dependency, MIT): sheet `Main Table`, rows from 4, columns C–G. A merged cell's value applies to every row it spans: the workbook merges item names, dimensions and lead times down some groups of rows, and COMPANY and COUNTRY down every manufacturer's rows |
| `CsvImportReport` | `infrastructure/csv-import-report.ts` | #28's report columns, UTF-8, header row first |
| the command | `backend/src/scripts/atlas-import.ts`; script `"atlas:import": "tsx src/scripts/atlas-import.ts"` | `--workbook`, `--report`, `--as`, `--write`; spellings are `WORD_LIST`; refuses an unknown or disabled `--as` with #28's sentence |

Item-name keywords, also read in the Category and Material cells
(case-insensitive, whole words; a hit sets the fact only where the row's
columns did not). Where two phrases for one slot match, the longer wins
(`half dome` over `dome`, `white kraft` over `kraft`); two different facts
left for one slot leave it not known, flagged in the report:

| Words | Fact |
|---|---|
| `<n> oz`, `<n>oz` | capacity `Z` n |
| `<n> ml` | capacity `M` n |
| `clear`, `transparent` · `white`, `white kraft` · `black` · `brown`, `kraft` (colour only when material is paper) | colour `CL` · `WH` · `BK` · `BR` |
| `round` · `square` · `rectangular` · `oval` | shape `RD` · `SQ` · `RC` · `OV` |
| `dome` · `half dome` · `flat lid` | profile `DM` · `HD` · `FL` |
| `single wall` · `double wall` · `ripple` | wall `SW` · `DW` · `RW` |
| `no print` · `<n> colou?r print` · `full colou?r` | print `NP` · `0n` · `FC` |
| `<n> compartments?`, `<n>-comp` | compartments n |
| `<n> ?ply` | plies n |
| `sip`, `strawless` · `straw hole`, `x cross`, `cross cut` | lid opening `SP` · `SH` |
| `twisted handle` · `flat handle` · `t-shirt`, `vest` · `no handle`, `sos` | handle `TW` · `FT` · `TS` · `NH` |
| `paper wrapped` · `plastic wrapped`, `film wrapped` | wrap `PW` · `FW` |
| `window` | window `WN` |
| `cpet` · `pla lined` · `grease resistant` · `uncoated` | coating `CP` · `PL` · `GR` · `NC` |
| `double pe`, `2pe`, `+2pe`, `+<n>gpe+<n>gpe` · `single pe`, `1pe`, `+1pe`, `+<n>gpe`, `pe coating` | coating `PB` · `PU` |

### Manufacturers and quotes — phase 4

ADR 0027 records why these live in the database and never in the repository.
#56 is the specification.

| Name | File | Shape |
|---|---|---|
| `atlas_manufacturers` | `infrastructure/atlas-manufacturers.table.ts`, by generated migration | `id` uuid, `name` text, `name_key` text unique (the name trimmed and lower-cased), `country` text null, `created_at` |
| `atlas_quotes` | `infrastructure/atlas-quotes.table.ts`, same migration | `id` uuid, `spec_id` → `atlas_spec_ids.id`, `manufacturer_id` → `atlas_manufacturers.id`, and as text, each null when the cell is empty: `item_name`, `fob_per_unit`, `fob_per_case`, `fob_total`, `mold_cost`, `mold_lead_time`, `sample_lead_time`, `production_lead_time`; `imported_at` |
| `Manufacturer`, `Quote` | `domain/sourcing/` | The two records, values as written; a manufacturer's identity is its `name_key` |
| `SourcingRepository` | `domain/sourcing/sourcing-repository.ts`; Drizzle and in-memory adapters | `replaceQuotes(rows)`: in one transaction, finds or adds each manufacturer by `name_key` (updating its country when the row gives one), deletes every quote, inserts the given ones. Manufacturers are never deleted: #57's stages point at them |
| The workbook's other columns | `ExcelVerifiedListSource` | A COMPANY, B COUNTRY (each merged down its manufacturer's rows), O FOB per unit, P FOB per case, Q FOB total, R mold cost, S mold lead time, T sample lead time, U production lead time. A row's country is its own B cell, merged or not |
| The report | `CsvImportReport` | Two more columns: `manufacturer` (`found` or `no manufacturer`) and `quote` (`recorded` or `not recorded`) |

`ImportVerifiedList`, when writing, gathers a quote for every row it saves or
finds already saved (the row's code matches a saved Spec ID) and that has a
manufacturer, then calls `replaceQuotes` once. A dry run calls nothing. A row
with no manufacturer, or one not imported, records no quote. Stages (#57) are
another table, which this phase neither creates nor touches.

### Review Focus

Inputs #28 implies but does not spell out. Each has its test in the step that
owns the code.

1. A pasted S1 code in lower case, or with spaces around it — found, as an S2 code (Step 1.3).
2. A Spec ID edited after an earlier S1 code was given out — the old S1 code still finds it after the conversion (Step 1.5).
3. A workbook cell holding a number, not text (Excel stores `90` as a number) — read like the text `90` (Step 3.2).
4. The same item name with different facts — two Spec IDs, never merged by name (Step 3.3).
5. `--write` run twice — the second run saves nothing and reports every row `already saved` (Step 3.4).

---

## Phase 1 — S2 format, S2 0.1.0 and the conversion

One pull request, "Part of #28". Today's pages keep working: new slots show and
save as not known or doesn't apply until phase 2 adds their controls.

### Step 1.1 — Record the decision

- [x] **Action.** Write `docs/decisions/0024-spec-ids-move-to-the-s2-format.md` from `_template.md`, Accepted, dated the day it is written: the eight slots and their order, 97 characters, saved codes and History converted once, S1 codes still readable and never issued, #28's dictionary as release S2 0.1.0, and rulings R1b, R5 and R6 for reading supplier sizes. Alternatives: product-type splits for print and features (rejected by reyxdz on 2026-10-19: they multiply product types and cannot hold counts); variant numbers (rejected the same day: the code would not say what differs). Add "Partly superseded by 0024" to the status lines of ADR 0019 (the layout and length) and ADR 0021 ("no later migration updates … a saved Spec ID"), each linked. Add 0024 to `docs/decisions/README.md`.
- [x] **Verify.** `npm run docs:check` exits 0.

### Step 1.2 — The S2 slots and S1 codes in the domain

- [x] **Action.** Tests first. Extend `slots.ts` as in the design; add the `count` kind to `SpecId.build`, `SpecId.parse`, `checkSlotValue` and `meaningOf` ("1 compartment", "3 compartments"; "1 ply", "2 plies"); add `s1-code.ts`; change `spec-id.messages.ts`'s length sentence to "A Spec ID is 97 characters. This one has {n}."; replace the S2 test dictionary in `domain/testing/` (#28's rules for every type). Tests: the illustrative S1 bowl lid converts to `S2.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX.00.XX.X.XX.XX.XX.XX.XX`; `fromS1` is null for 17 slots or an `S2` code; compartments `13` and plies `5` are refused with #28's sentences; a value in a slot the rules mark `never` is refused, one test per product type; two fact sets differing only in print (then each new slot) give different codes; `WC` is accepted as a coating and `BWP` as a material, and `WX` refused as a mixed marker (an `X` inside any code reads as a broken marker, so #28's `BWX` is `BWP`).
- [x] **Verify.** `npm --prefix backend run test:unit -- atlas` passes.

### Step 1.3 — Contract, schemas and the use cases

- [x] **Action.** The contract additions; the zod facts schema in `atlas.schemas.ts` (dictionary codes and counts as strings, so the domain refuses a bad count beside its slot); `find-spec-id-by-code.ts` converts an S1 code with `fromS1` before looking it up. HTTP tests: encode with every new fact; decode of an S1 code answers 26 slots; `GET /atlas/spec-ids/<s1 code in lower case, with spaces around it>` finds the converted Spec ID.
- [x] **Verify.** `npm --prefix backend run test:unit` passes; `npm run typecheck` reports only frontend errors from the wider `SlotKey` (Step 1.6 fixes them).

### Step 1.4 — The three migrations

- [x] **Action.** Change `code` in `atlas-spec-ids.table.ts`, and `code_before` and `code_after` in `atlas-spec-id-changes.table.ts`, to `{ length: 97 }`, add the eight slot columns, and generate 0009; write 0010 from #28's tables and 0011 from the design; extend `backend/src/test/database.ts` if a new table appears (none expected). A `*.db.test.ts` saves an S1 Spec ID and History before 0011 is applied, applies it, and proves: the code equals `fromS1` of the old one, the History rows' codes are converted, `dictionary_release` is `S2 0.1.0`, and the number of History rows is unchanged.
- [x] **Verify.** `npm run db:migrate` applies all three; a second `db:generate` prints "No schema changes"; `npm test` passes.

### Step 1.5 — Old codes after an edit

- [x] **Action.** A database test: save A as S1 code C1, edit it to C2, convert, then `GET /atlas/spec-ids/C1` (as S1 text) answers A with `replacedCode` set.
- [x] **Verify.** The test passes in `npm test`.

### Step 1.6 — Keep today's pages working

- [x] **Action.** Frontend `SLOT_NAMES` and `SlotKey` to 26; the fixtures' `ILLUSTRATIVE` and every literal S1 code in tests to its S2 form; `asPastedCode` takes text starting `S2.` as well as `S1.`. No new control yet.
- [x] **Verify.** `npm run typecheck && npm run lint && npm run arch:check && npm --prefix frontend run test -- --no-file-parallelism` exits 0.

### Step 1.7 — Docs, then the pull request

- [x] **Action.** `api.md` (97 characters, the new fact keys, S1 codes accepted on decode and lookup), `data-model.md` (the column lengths, release S2 0.1.0, the conversion); open "Part of #28" with Database, API and Rollout filled in (0011 rewrites every saved code; nothing is dropped).
- [x] **Verify.** CI and `pr-audit` pass. After merge, on staging: a Spec ID saved before the release opens with a 97-character code, and pasting its old S1 code into the library finds it.

---

## Phase 2 — Workspace and library for S2

One pull request, "Part of #28".

### Step 2.1 — Form helpers

- [x] **Action.** The frontend's S2 test dictionary for 31 types beside `s1Dictionary` in `atlas-fixtures.ts`; `slot-controls.ts`, `build-facts.ts` and `to-build-form.ts` for the six dictionary slots and the two counts. Tests: `toBuildForm` round-trips an S2 code with every new slot known; a count typed `03` sends `3`; a count left empty sends nothing.
- [x] **Verify.** `npm --prefix frontend run test -- --no-file-parallelism src/features/atlas/domain` passes.

### Step 2.2 — The workspace

- [x] **Action.** `FactGroups` with #28's six groups; product type as a `SelectField` (label "Product type"); new choices with "Not known" first; compartments and plies as number fields with placeholder "Not known". Tests: for each of the 31 product types, exactly the slots its rules apply are shown (one table-driven test); for each new slot, a value changes the code; the left-out note names the new slots that don't apply.
- [x] **Verify.** The tests pass; `npm run design:check` prints "Design tokens only."

### Step 2.3 — Everywhere a code is shown

- [x] **Action.** Check the code panel, History, library cards, pasted-code result and Dictionary sheet with 26 slots; fix any width or wrap problem at 390 px (`break-all` on codes).
- [x] **Verify.** Page tests pass; at 390 px no page scrolls sideways (browser check in Step 2.4).

### Step 2.4 — Browser check, screenshots, pull request

- [x] **Action.** Locally, build and save a 2-colour-print double-wall paper cup and a 3-compartment bagasse container; light, dark and 390 px; screenshots `atlas-s2-workspace-light.png`, `atlas-s2-workspace-dark.png`, `atlas-s2-workspace-phone-light.png` into `.github/readme/`; open "Part of #28".
- [x] **Verify.** CI and `pr-audit` pass. After merge, on staging: the same two products save, and an S1 code given out before phase 1 still lands on its product.

---

## Phase 3 — The verified-list import

One pull request, "Part of #56". #28 closed after phase 2, so #56 carries this phase and phase 4; the staging run waits for phase 4 (Step 4.5).

Since #36 ([ADR 0025](../decisions/0025-spec-ids-are-written-short.md)), codes are written short: 25 parts, no
`S2.` tag, an empty slot `Y` or `X`. The import creates short codes through `SaveSpecId`; where this
plan's design writes a code in the long form, read its short form.

Since #41 ([ADR 0026](../decisions/0026-raw-text-is-read-by-rules-and-a-public-word-list.md), plan 0007), the import
reads item names with `readText`, sizes with `readSize` and spellings from `WORD_LIST`, all in
`backend/src/modules/atlas/domain/reading/`, instead of building its own `item-name.ts`,
`size-rulings.ts` and `spelling-table.ts`; the spelling table's entries are in the repository.

### Step 3.1 — The spelling table and size rulings

- [x] **Action.** No new spelling table or size rulings. Plan 0007 put them in `backend/src/modules/atlas/domain/reading/`: `WORD_LIST` and `readSize`. Do not add `spelling-table.ts` or another `size-rulings.ts`.
- [x] **Verify.** From `backend/`: `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/reading` passes.

### Step 3.2 — Reading one row

- [x] **Action.** `verified-row.ts` reads the item name with `readText` and sizes with `readSize` (the keyword table is `KEYWORDS`). Tests: swapped Category and Material are read the right way round; a column value wins over the item name; a numeric cell `90` reads as `90`; `3.3g` is unit weight 3.3; `110 gsm` is basis weight 110; a bare `25` and `300+250+18` are not known; a row with no determinable type is `skipped` with its reason; a 130-character name is cut at the last space before 120 and flagged.
- [x] **Verify.** The tests pass.

### Step 3.3 — The use case

- [x] **Action.** `ImportVerifiedList` with in-memory ports. Tests: three rows with one code become one Spec ID named by the most common name; two rows with the same name and different facts become two; a fact `SaveSpecId` refuses is dropped and reported, the row saved; a dry run calls no save; a value read under a ruling is flagged in its report row with the ruling's name; the summary counts rows, new, same-as, already-saved and skipped, and the item-name agreement on rows with both columns.
- [x] **Verify.** The tests pass.

### Step 3.4 — Workbook, report and command

- [x] **Action.** Add `exceljs`; `ExcelVerifiedListSource`, `CsvImportReport`, `src/scripts/atlas-import.ts` and the npm script. A database test runs the command on an invented workbook built in the test: a dry run saves nothing and prints #28's dry-run sentence; `--write` saves and prints #28's sentence; a second `--write` saves nothing and reports every saved row `already saved`; an unknown or disabled `--as` prints #28's refusal and reads nothing; an item name merged down three rows gives all three rows that name.
- [x] **Verify.** `npm test` passes; `npm run arch:check` exits 0.

### Step 3.5 — Docs and the pull request

- [x] **Action.** `commands.md` (`atlas:import`, its options, that the workbook and the report never enter the repository; the spelling table's entries are `WORD_LIST`); open the pull request "Part of #56".
- [x] **Verify.** CI and `pr-audit` pass.

---

## Phase 4 — Manufacturers and quotes

One pull request, "Part of #56". #56 is closed after Step 4.5's staging run.
Every test uses invented manufacturers, items and prices (ADR 0027).

A quote's values are kept as Excel shows them, number format and all (`$0.0350`):
the workbook stores a price as a number and a format, and staff read the two
together. A price that is a formula has a value only if Excel saved one with it.
The verified list prepared on 2026-10-19 has none for its formulas, so those
cells are read empty and flagged in the report; Step 4.5 opens and saves it in
Excel first.

### Step 4.1 — The tables

- [x] **Action.** `atlas_manufacturers` and `atlas_quotes` as the design gives them, added to `database-schema.ts`, and their migration made with `npm run db:generate` (ADR 0005). A database test: two quotes for one manufacturer, then deleting the quotes leaves the manufacturer.
- [x] **Verify.** `npm run db:generate` run again makes no new migration; `npm test` passes.

### Step 4.2 — The sourcing records and repository

- [x] **Action.** `Manufacturer`, `Quote` and `SourcingRepository` in `domain/sourcing/`, with the Drizzle and in-memory adapters. Tests: " Acme Packaging " and "acme packaging" are one manufacturer; `replaceQuotes` twice with the same rows leaves the same quotes, not twice as many; a row giving a country updates the manufacturer's.
- [x] **Verify.** The tests pass; `npm run arch:check` exits 0.

### Step 4.3 — The import records quotes

- [x] **Action.** `ExcelVerifiedListSource` reads columns A, B and O–U; `ImportVerifiedList` gathers quotes and calls `replaceQuotes` when writing; `CsvImportReport` adds the `manufacturer` and `quote` columns. Tests, on an invented workbook with two company blocks: each row records its own block's manufacturer, and a row outside both reports `no manufacturer`; a row whose code is already saved records its quote against that Spec ID and saves no new one; a second `--write` leaves the number of quotes unchanged; a dry run records no manufacturer and no quote.
- [x] **Verify.** `npm test` passes.

### Step 4.4 — Docs and the pull request

- [x] **Action.** `data-model.md` (both tables), `commands.md` (the report's two columns); open the pull request "Part of #56".
- [x] **Verify.** CI and `pr-audit` pass.

### Step 4.5 — The staging run (reyxdz)

- [ ] **Action.** After merge, reyxdz opens the workbook in Excel and saves it, so its price formulas have values, then runs the command against staging as a dry run, reads the report, then runs it with `--write`. The totals, including manufacturers found and quotes recorded, are written as a comment on #56, without any row content; then #56 is closed.
- [ ] **Verify.** Every workbook row with an item name appears once in the report; the library on staging shows the report's "new" total; a second `--write` reports every row `already saved` or `skipped`, and records the same number of quotes.

---

## Acceptance

The plan is complete when every box below is checked.

- [ ] Every item under "Verify" in [#28](https://github.com/S1-GLOBAL/s1-gateway/issues/28) is ticked on the issue.
- [ ] ADR 0024 is Accepted and listed, and ADRs 0019 and 0021 link to it.
- [ ] `api.md`, `data-model.md` and `commands.md` describe S2 and the import.
- [ ] #28 is closed.
- [ ] Every item under "Verify" in [#56](https://github.com/S1-GLOBAL/s1-gateway/issues/56) is ticked on the issue, and #56 is closed.
- [ ] ADR 0027 is Accepted and listed, and `data-model.md` describes `atlas_manufacturers` and `atlas_quotes`.

## Follow-ups

- The Manufacturers page and its stages — #57
- Adding or editing manufacturers and quotes in Atlas — #61
- Reading inches, print colour counts and capacity ranges correctly — #58, best before Step 4.5
- Running the import on production — reyxdz, with the release
- Variant numbers and the collision review — no issue yet
- Editing the dictionary from the app — no issue yet

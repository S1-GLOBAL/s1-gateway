# 0006. S2 Spec IDs, a dictionary from the verified list, and its import

- **Status:** In progress
- **Owner:** Rey Denzo
- **Related:** [#28](https://github.com/S1-GLOBAL/s1-gateway/issues/28) ·
  [plan 0004](./0004-atlas-library-and-editable-spec-ids.md) ·
  [ADR 0005](../decisions/0005-migrations-over-db-push.md) ·
  [ADR 0007](../decisions/0007-one-definition-of-an-api-shape.md) ·
  [ADR 0019](../decisions/0019-the-s1-spec-id-format.md) ·
  [ADR 0021](../decisions/0021-the-atlas-dictionary-changes-only-by-migration.md) ·
  [ADR 0022](../decisions/0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md)

## Goal

At the end of this plan every Spec ID is an S2 code: S1's 18 slots plus Wall,
Print, Compartments, Plies, Lid opening, Handle, Individual wrap and Window,
97 characters long. Codes come from release S2 0.1.0, whose 31 product types,
30 materials and other lists come from the verified list. Every Spec ID saved
before the release, and its History, is converted, and every S1 code ever
given out still finds its product. The workspace offers all of it, and
`npm --prefix backend run atlas:import` loads the verified list into the
library. Issue [#28](https://github.com/S1-GLOBAL/s1-gateway/issues/28) is the
specification: its tables are the exact dictionary, rules and copy, and where
this plan and the issue disagree, the issue wins and this plan is corrected.

## Scope

**In scope**
- ADR 0024 (the S2 format), partly superseding ADR 0019 and ADR 0021
- The S2 slots in the domain, the contract, the code columns and every page that shows a code
- Release S2 0.1.0 by migration, and the conversion of saved codes and History
- The workspace's new controls and group 06
- `atlas:import`, its spelling table and its CSV report
- `api.md`, `data-model.md` and `commands.md`

**Out of scope** — and where it is handled instead
- A product's manufacturers and quotations — no issue yet
- Case packing, prices, lead times, manufacturers and countries — no issue yet
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
- For phase 3 only: the verified list and `verified-list-spellings.json`
  (prepared on 2026-10-19) on reyxdz's computer. Never in the repository.

## Progress

Built by following a handoff written for this plan, one phase per pull
request, stopping for the owner after each.

| Phase | Steps | Status |
|---|---|---|
| 1. S2 format, S2 0.1.0 and the conversion | 7 / 7 | Done — on staging, a Spec ID saved before the release opens with its S2 code, and its old S1 code finds it; see #28 |
| 2. Workspace and library for S2 | 3 / 4 | In progress — step 2.4's staging check remains after merge |
| 3. The verified-list import | 0 / 6 | Not started |

---

## Design

### Precedents this plan sets

| First | How | Why this way |
|---|---|---|
| A change to the code's format | A new format version, `S2`; slots 1–17 keep their positions and the new slots sit before the variant | Every reader of positions 1–17 keeps working; the variant stays last, as ADR 0019 has it |
| A migration that rewrites saved data | Hand-written SQL that converts by product type, proved equal to the TypeScript conversion for every S1 product type | The conversion is a pure function of the code, so SQL and TypeScript can be compared exactly |
| A command that writes staff data | `src/scripts/atlas-import.ts`, like `create-admin.ts`: composes the module's own use cases, never starts HTTP, saves nothing without `--write` | One path for every save, so the import obeys the same rules as the workspace |

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
| `SpellingTable` | `backend/src/modules/atlas/domain/import/spelling-table.ts` | `Map<string, { productType } \| { material } \| { skip: string }>`, keys trimmed, read with zod from the JSON file |
| `readSize` | `domain/import/size-rulings.ts` | `(text: string, productType: string) => { facts; ruling: 'R1' \| 'R1b' \| 'R2' \| 'R3' \| 'R5' \| 'R6' } \| null` — #28's ruling table, units by ADR 0019 |
| `readItemName` | `domain/import/item-name.ts` | `(name: string) => { productType?; material?; facts; read: string[] }` — the keyword table below |
| `readVerifiedRow` | `domain/import/verified-row.ts` | `(row: VerifiedRow, spellings) => RowReading` — columns first, item name second, sizes and weights by ruling |
| `ImportVerifiedList` | `application/import-verified-list.ts` | builds every code, groups rows by code, names each group by its most common item name (first row on a tie), saves through `SaveSpecId` only when writing, returns `ImportReport` |
| `VerifiedListSource`, `ImportReportSink` | `application/ports/` | read rows; write the report |
| `ExcelVerifiedListSource` | `infrastructure/excel-verified-list-source.ts` | `exceljs` (new dependency, MIT): sheet `Main Table`, rows from 4, columns C–G |
| `CsvImportReport` | `infrastructure/csv-import-report.ts` | #28's report columns, UTF-8, header row first |
| the command | `backend/src/scripts/atlas-import.ts`; script `"atlas:import": "tsx src/scripts/atlas-import.ts"` | `--workbook`, `--spellings`, `--report`, `--as`, `--write`; refuses an unknown or disabled `--as` with #28's sentence |

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

- [ ] **Action.** Locally, build and save a 2-colour-print double-wall paper cup and a 3-compartment bagasse container; light, dark and 390 px; screenshots `atlas-s2-workspace-light.png`, `atlas-s2-workspace-dark.png`, `atlas-s2-workspace-phone-light.png` into `.github/readme/`; open "Part of #28".
- [ ] **Verify.** CI and `pr-audit` pass. After merge, on staging: the same two products save, and an S1 code given out before phase 1 still lands on its product.

---

## Phase 3 — The verified-list import

One pull request, "Part of #28". #28 is closed after Step 3.6's staging run.

### Step 3.1 — The spelling table and size rulings

- [ ] **Action.** Tests first, with invented values only. `spelling-table.ts` (refuses a file whose entry names a code not in S2 0.1.0, naming the entry); `size-rulings.ts` with one passing and one near-miss test per ruling: R1 `93 Dia` on a cup → top 93, `RD`; R1b `94 Dia x 115` → top 94, height 115; R2 `90 dia x 60 x 45` → 90 × 60 × 45, and `60 dia x 90 x 45` → null (B not smaller); R3 pouch `200 x 300 x 80` → width 200, height 300, gusset 80; R5 bag `30*12*35 cm` → width 300, gusset 120, height 350; R6 box `8 x 6 x 3 inches` → 203 × 152 × 76; anything else → null.
- [ ] **Verify.** `npm --prefix backend run test:unit -- import` passes.

### Step 3.2 — Reading one row

- [ ] **Action.** `item-name.ts` (the keyword table) and `verified-row.ts`. Tests: swapped Category and Material are read the right way round; a column value wins over the item name; a numeric cell `90` reads as `90`; `3.3g` is unit weight 3.3; `110 gsm` is basis weight 110; a bare `25` and `300+250+18` are not known; a row with no determinable type is `skipped` with its reason; a 130-character name is cut at the last space before 120 and flagged.
- [ ] **Verify.** The tests pass.

### Step 3.3 — The use case

- [ ] **Action.** `ImportVerifiedList` with in-memory ports. Tests: three rows with one code become one Spec ID named by the most common name; two rows with the same name and different facts become two; a fact `SaveSpecId` refuses is dropped and reported, the row saved; a dry run calls no save; a value read under a ruling is flagged in its report row with the ruling's name; the summary counts rows, new, same-as, already-saved and skipped, and the item-name agreement on rows with both columns.
- [ ] **Verify.** The tests pass.

### Step 3.4 — Workbook, report and command

- [ ] **Action.** Add `exceljs`; `ExcelVerifiedListSource`, `CsvImportReport`, `src/scripts/atlas-import.ts` and the npm script. A database test runs the command on an invented workbook built in the test: a dry run saves nothing and prints #28's dry-run sentence; `--write` saves and prints #28's sentence; a second `--write` saves nothing and reports every saved row `already saved`; an unknown or disabled `--as` prints #28's refusal and reads nothing.
- [ ] **Verify.** `npm test` passes; `npm run arch:check` exits 0.

### Step 3.5 — Docs and the pull request

- [ ] **Action.** `commands.md` (`atlas:import`, its options, that the workbook, spelling table and report never enter the repository); open the pull request "Part of #28".
- [ ] **Verify.** CI and `pr-audit` pass.

### Step 3.6 — The staging run (reyxdz)

- [ ] **Action.** After merge, reyxdz runs the command against staging as a dry run, reads the report, then runs it with `--write`. The totals are written as a comment on #28, without any row content.
- [ ] **Verify.** Every workbook row with an item name appears once in the report; the library on staging shows the report's "new" total; a second `--write` reports every row `already saved` or `skipped`.

---

## Acceptance

The plan is complete when every box below is checked.

- [ ] Every item under "Verify" in [#28](https://github.com/S1-GLOBAL/s1-gateway/issues/28) is ticked on the issue.
- [ ] ADR 0024 is Accepted and listed, and ADRs 0019 and 0021 link to it.
- [ ] `api.md`, `data-model.md` and `commands.md` describe S2 and the import.
- [ ] #28 is closed.

## Follow-ups

- A product's manufacturers and quotations — no issue yet
- Running the import on production — reyxdz, with the release
- Variant numbers and the collision review — no issue yet
- Editing the dictionary from the app — no issue yet

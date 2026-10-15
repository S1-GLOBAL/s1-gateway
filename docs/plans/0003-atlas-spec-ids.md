# 0003. Atlas: read, build and save S1 Spec IDs

- **Status:** Ready for phase 1
- **Owner:** Rey Denzo
- **Related:** [#4](https://github.com/S1-GLOBAL/s1-gateway/issues/4) ·
  [#5](https://github.com/S1-GLOBAL/s1-gateway/issues/5) ·
  [ADR 0003](../decisions/0003-clean-architecture-with-layers-inside-modules.md) ·
  [ADR 0005](../decisions/0005-migrations-over-db-push.md) ·
  [ADR 0007](../decisions/0007-one-definition-of-an-api-shape.md) ·
  [ADR 0008](../decisions/0008-testing-strategy.md) ·
  [ADR 0013](../decisions/0013-loading-states-are-page-shaped-skeletons.md)

## Goal

At the end of this plan the Gateway has an **Atlas** page at `/atlas`. Staff
can decode any S1 Spec ID into plain words, browse the approved S1 0.1.0
dictionary, and build a Spec ID from a form. Signed-in staff can save Spec
IDs with a short name, and find saved ones by exact code or by similar slots.
The dictionary lives in Postgres, is loaded by a migration, and nothing in the
app can change it. Issue [#4](https://github.com/S1-GLOBAL/s1-gateway/issues/4)
is the specification; where this plan and the issue disagree, the issue wins
and this plan is corrected.

## Scope

**In scope**
- The S1 encoder and decoder, as pure domain code with exact whole-number arithmetic
- Dictionary tables and their applicability rules, loaded by migration
- Read-only dictionary API; decode and encode endpoints
- Saving Spec IDs, exact lookup and similar lookup (phase 2)
- The Atlas page: decode, dictionary, build, save, lookup
- ADRs for the S1 format, the TypeScript build and the migration-only dictionary
- `api.md` and `data-model.md` updates

**Out of scope** — and where it is handled instead
- Sign-in — [#5](https://github.com/S1-GLOBAL/s1-gateway/issues/5); phase 2 depends on it
- Variant numbers and the reviewer's collision flow — no issue yet
- Factories, supplier products and quotes behind a Spec ID — no issue yet
- Atlas search, intake and review, phrase search — no issue yet
- Reading free-text dimensions from workbooks and importing the workbooks — no issue yet
- A screen for editing the dictionary — not planned; the owner decided it changes only by migration
- Retiring a saved Spec ID — no issue yet

## Prerequisites

- A working local setup, as in [local setup](../getting-started/local-setup.md).
  Verify: `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit`
  exits 0 on a fresh branch from `main`.
- For phase 2 only: #5 is merged, and `GET /api/v1/auth/me` returns the signed-in account.

## Blockers

- **Phase 2** cannot start until [#5](https://github.com/S1-GLOBAL/s1-gateway/issues/5)
  ships. Saving records the signed-in account, and no account exists before
  it. Cleared by: reyxdz merging #5's pull request.

---

## Design

### The format

The full S1 specification becomes ADR 0018 in phase 1. In short: 18 slots,
dot-separated, 74 characters; `0` filling a slot means not known, `X` filling
a slot means doesn't apply. Slots, widths and the 28 dictionary values are in
[#4](https://github.com/S1-GLOBAL/s1-gateway/issues/4).

| # | Slot | Width | Kind |
|---|---|---|---|
| 1 | Format version | 2 | Always `S1` |
| 2–7 | Product type, material, coating, colour / clarity, shape, profile | 3, 3, 2, 2, 2, 2 | Dictionary code |
| 8 | Nominal capacity | 5 | Unit letter + 4 digits |
| 9–14 | Top diameter, bottom diameter, height, length, width, gusset | 4 each | Whole mm |
| 15 | Unit weight | 4 | Tenths of a gram |
| 16 | Basis weight | 3 | Whole gsm |
| 17 | Thickness | 3 | Whole µm |
| 18 | Variant number | 2 | `XX` until variants exist |

### Exact arithmetic

Measurements never pass through a JavaScript `number`. The API takes each
measurement as `{ value: string, unit: string }` (`{ value: "1.375", unit:
"in" }`). The domain parses the decimal string into a whole numerator and a
power-of-ten denominator with `BigInt`, multiplies by the unit's exact factor
(1 in = 254/10 mm, 1 cm = 10 mm), and rounds half up to the slot's unit
(whole mm, tenths of a gram, whole gsm, whole µm). A value with more than 6
decimal places, or a negative or zero value, is rejected.

### Applicability

Which slots are `X` follows from product type, shape and material, using the
rules loaded with the dictionary: `applies`, `never`, `round_only`,
`non_round_only` and `paper_only`. When the shape or material is `0`, a
conditional slot is `0`, not `X`. The encoder computes every `X`; a request
that supplies a value for a slot that doesn't apply fails with that slot's
error, and is never silently cleared.

### Data model

| Table | Phase | Columns | Notes |
|---|---|---|---|
| `atlas_dictionary_releases` | 1 | `release` (pk, e.g. `S1 0.1.0`), `approved_on` | One row: `S1 0.1.0`, approved 2026-10-16 |
| `atlas_dictionary_values` | 1 | `release`, `slot`, `code`, `meaning` | Primary key `(release, slot, code)`; 28 rows |
| `atlas_slot_rules` | 1 | `release`, `product_type`, `slot`, `rule` | Primary key `(release, product_type, slot)` |
| `atlas_spec_ids` | 2 | `id`, `code` (unique), one column per slot 2–18, `name`, `dictionary_release`, `saved_by`, `saved_at` | Slot columns hold the raw slot text, so `0` and `X` keep their meaning; `saved_by` references #5's accounts table |

The three dictionary tables are created by a generated migration
([ADR 0005](../decisions/0005-migrations-over-db-push.md)) and filled by a
second, custom migration (`npm --prefix backend run db:generate -- --custom
--name seed_atlas_dictionary_s1_0_1_0`) holding plain `INSERT` statements. No
repository method, endpoint or later migration updates or deletes a
dictionary row. A new release adds rows under its own `release` key.

### Similar lookup

For each chosen slot `s = v`, a saved Spec ID qualifies when its `s` equals
`v` or is all `0`. It is **Fits** when every chosen slot equals `v`, and
**Might fit** when at least one is `0`. A different known value excludes it.
Nothing compares numbers by closeness. With no slot chosen, every saved
Spec ID is returned. Both groups are newest first.

### Architecture

| Code | Where | Layer |
|---|---|---|
| Slot table, measurement parsing and rounding, `SpecId.parse` / `SpecId.build`, `Dictionary`, errors with stable codes | `backend/src/modules/atlas/domain/` | domain |
| `DictionaryRepository` port (phase 1), `SpecIdRepository` port (phase 2) | `backend/src/modules/atlas/domain/` | domain |
| `GetDictionary`, `DecodeSpecId`, `EncodeSpecId` (phase 1); `SaveSpecId`, `FindSpecIdByCode`, `FindSimilarSpecIds` (phase 2); in-memory fakes in `application/testing/` | `backend/src/modules/atlas/application/` | application |
| Drizzle tables, mappers, repositories | `backend/src/modules/atlas/infrastructure/` | infrastructure |
| zod schemas, `AtlasController`, router mounted at `/atlas` | `backend/src/modules/atlas/presentation/` | presentation |
| Request and response types | `backend/src/contracts/atlas.ts` | contracts |
| Module wiring; tables exported from `backend/src/database-schema.ts` and added to the truncate in `backend/src/test/database.ts` | `backend/src/modules/atlas/index.ts`, `backend/src/compose.ts` | composition |
| Atlas gateway port, hooks, HTTP gateway, components | `frontend/src/features/atlas/` | all four |
| `AtlasPage`, `AtlasPageSkeleton` | `frontend/src/pages/atlas/` | pages |
| Route `atlas`, nav item "Atlas", an animated Atlas icon | `frontend/src/app/routes.tsx`, `frontend/src/app/nav.ts`, `frontend/src/shared/ui/icons/` | composition, shared UI |

`SpecId.parse` collects every problem it finds and returns them together, as
`Tool.create` does, so the page can show each error beside its slot. The API
answers with 400 `INVALID_SPEC_ID`, its `details.fields` keyed by slot name.
The exact wording of every message is the copy table in
[#4](https://github.com/S1-GLOBAL/s1-gateway/issues/4).

### Decisions to record

Take the next three free numbers when phase 1 is written (0018–0020 as of
2026-10-16; #5's sign-in record may claim one first).

- **The S1 Spec ID format** — the specification's full text: slots, markers,
  exact arithmetic and rounding, applicability, rulings R1–R4, the collision
  flow, and what stays out of the code.
- **Atlas is built in TypeScript in the Gateway** — the Python Atlas package
  is an offline reference only; no Python runs in the Gateway.
- **The Atlas dictionary lives in Postgres and changes only by migration** —
  read-only API; meanings are never edited or deleted.

### Testing

- Domain: every slot kind parsed and built; both markers; every error code;
  rounding at the half (`1.375 in` → `0035`, `4.25 in` → `0108`, `3.3 g` →
  `0033`, `4 g` → `0040`); a round trip for every dictionary value in its slot.
- Domain: applicability for each product type, round and non-round shapes,
  paper and non-paper materials, and unknown shape or material.
- Application: each use case over the in-memory fakes; a duplicate save
  returns the existing Spec ID and saves nothing; the similar lookup's Fits,
  Might fit and exclusion, with `0000`, `0090` and `0091`.
- HTTP: every route's success and every error code; `PUT` and `DELETE` on
  every Atlas path return 404; saving without a session returns 401.
- Database: the migration leaves exactly 28 dictionary values; the unique
  code index holds under two simultaneous saves.
- Frontend: the page's skeleton, loaded, empty and error states; each decode
  error shown beside its slot; locked `X` slots in the build form.
- Tests use the specification's illustrative products only. The repository is
  public: no rows, prices or supplier names from Source One's workbooks.

---

## Progress

Built by following a handoff written for this plan, one phase per pull
request, stopping for the owner after each.

| Phase | Steps | Status |
|---|---|---|
| 1. Dictionary, decoder and dictionary browser | 0 / 7 | Not started |
| 2. Build, save and look up | 0 / 5 | Not started — blocked by #5 |

---

## Phase 1 — Dictionary, decoder and dictionary browser

One pull request, "Part of #4". It saves nothing and holds no supplier data.

### Step 1.1 — Record the three decisions

- [ ] **Action.** Write the three ADRs listed under "Decisions to record" and add them to `docs/decisions/README.md`.
- [ ] **Verify.** `npm run docs:check` exits 0.

### Step 1.2 — The domain: slots, measurements, Spec ID

- [ ] **Action.** Write the domain tests first, then the code that passes them, in `backend/src/modules/atlas/domain/`.
- [ ] **Verify.** `npm --prefix backend run test:unit -- atlas` passes, and `npm run arch:check` exits 0.

### Step 1.3 — Dictionary tables and their migrations

- [ ] **Action.** Add the three dictionary tables, generate their migration, then write the custom seed migration with the 28 values and the slot rules.
- [ ] **Verify.** `npm run db:migrate` applies both; `SELECT count(*) FROM atlas_dictionary_values` returns `28`.

### Step 1.4 — The dictionary repository

- [ ] **Action.** Add the mapper, `DrizzleDictionaryRepository` and its `*.db.test.ts`.
- [ ] **Verify.** `npm test` passes, with the database running (`npm run db:up`).

### Step 1.5 — Use cases, contract and routes

- [ ] **Action.** Add `GetDictionary`, `DecodeSpecId` and `EncodeSpecId`, `backend/src/contracts/atlas.ts`, the controller and router, and wire the module in `backend/src/compose.ts`.
- [ ] **Verify.** The HTTP tests pass, and `curl -s localhost:4000/api/v1/atlas/dictionary` returns release `S1 0.1.0` with 28 values.

### Step 1.6 — The Atlas page: decode and dictionary

- [ ] **Action.** Add the frontend feature, `AtlasPage` with its skeleton, the route, the nav item and its animated icon.
- [ ] **Verify.** `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit` exits 0.

### Step 1.7 — Docs, then staging

- [ ] **Action.** Update `docs/reference/api.md` and `docs/reference/data-model.md`, open the pull request, and after it merges check staging.
- [ ] **Verify.** On staging, in light and dark themes and at 390 px width, the illustrative code decodes on `/atlas` and the dictionary lists all 28 values. The result is written as a comment on #4.

---

## Phase 2 — Build, save and look up

One pull request, "Closes #4". Starts only after #5 is merged.

### Step 2.1 — The saved Spec ID table

- [ ] **Action.** Add `atlas_spec_ids` with its unique code index and the reference to #5's accounts table, and generate the migration.
- [ ] **Verify.** `npm run db:migrate` applies it; the migration only adds a table.

### Step 2.2 — Saving and lookups in the domain and application layers

- [ ] **Action.** Add the `SpecIdRepository` port, its in-memory fake, `SaveSpecId`, `FindSpecIdByCode` and `FindSimilarSpecIds`, tests first.
- [ ] **Verify.** `npm --prefix backend run test:unit -- atlas` passes.

### Step 2.3 — The repository and the routes

- [ ] **Action.** Add `DrizzleSpecIdRepository` with its `*.db.test.ts`, and the save, exact and similar routes behind #5's sign-in check.
- [ ] **Verify.** `npm test` passes, including 401 without a session, 409 on a duplicate and the two-simultaneous-saves test.

### Step 2.4 — The Atlas page: build, save and look up

- [ ] **Action.** Add the build form, Save, the exact-code box and the similar lookup to the page, with their states.
- [ ] **Verify.** `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit` exits 0.

### Step 2.5 — Docs, then staging

- [ ] **Action.** Update `docs/reference/api.md` and `docs/reference/data-model.md`, open the pull request, and after it merges check staging.
- [ ] **Verify.** On staging, signed in, a Spec ID is built and saved, saving it again shows the duplicate message, and exact and similar lookups find it. The result is written as a comment on #4.

---

## Acceptance

The plan is complete when every box below is checked.

- [ ] Every item under "Verify" in [#4](https://github.com/S1-GLOBAL/s1-gateway/issues/4) is ticked on the issue.
- [ ] The three ADRs are Accepted and listed in `docs/decisions/README.md`.
- [ ] `api.md` and `data-model.md` describe every Atlas route and table.
- [ ] #4 is closed by phase 2's pull request.

## Follow-ups

- Variant numbers and the reviewer's collision flow — no issue yet
- Factories, supplier products and quotes behind a Spec ID — no issue yet
- Atlas search, intake and review — no issue yet
- Workbook import, including rulings R1–R3 for free-text dimensions — no issue yet
- Retiring a saved Spec ID — no issue yet

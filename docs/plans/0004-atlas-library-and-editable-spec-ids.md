# 0004. Atlas: a library, one workspace, and editable Spec IDs with History

- **Status:** Ready
- **Owner:** Rey Denzo
- **Related:** [#16](https://github.com/S1-GLOBAL/s1-gateway/issues/16) ·
  [plan 0003](./0003-atlas-spec-ids.md) ·
  [ADR 0003](../decisions/0003-clean-architecture-with-layers-inside-modules.md) ·
  [ADR 0005](../decisions/0005-migrations-over-db-push.md) ·
  [ADR 0007](../decisions/0007-one-definition-of-an-api-shape.md) ·
  [ADR 0013](../decisions/0013-loading-states-are-page-shaped-skeletons.md) ·
  [ADR 0019](../decisions/0019-the-s1-spec-id-format.md) ·
  [ADR 0021](../decisions/0021-the-atlas-dictionary-changes-only-by-migration.md)

## Goal

At the end of this plan `/atlas` opens on a library of saved Spec IDs with one
search box that takes a name or a pasted code. `/atlas/new` is a workspace that
asks only for the slots that apply, shows the code as it forms, and says when
that code is already saved. `/atlas/:id` is the same workspace for a saved Spec
ID, whose facts and name any signed-in staff member can change, with every
change listed in a History panel. Issue
[#16](https://github.com/S1-GLOBAL/s1-gateway/issues/16) is the specification:
its copy table is the exact wording of every message, and where this plan and
the issue disagree, the issue wins and this plan is corrected.

## Scope

**In scope**
- Editable saved Spec IDs: `version`, who last changed one and when, and a change row for every save
- The library API (search, product-type filter, 20 per page), one Spec ID by id, its history, and old codes that still find their product
- ADR 0022, superseding the "never updated" lines of ADR 0019 and ADR 0021
- The workspace at `/atlas/new` and `/atlas/:id`, and the History sheet
- The library at `/atlas`, paste-a-code, and the Dictionary sheet; removing the Decode, Build and Look up sections
- `api.md` and `data-model.md` updates

**Out of scope** — and where it is handled instead
- Deleting or retiring a saved Spec ID — no issue yet
- A "put this version back" button — no issue yet
- Edit permissions by role — no issue yet
- A warning before leaving with unsaved changes — no issue yet
- Variant numbers and the collision review — no issue yet
- Merging two saved Spec IDs — no issue yet

## Prerequisites

- Plan 0003's code is on `main` (#12 and #13 merged). Verify:
  `git grep -n "atlas_spec_ids" origin/main -- backend/drizzle` lists
  `0004_create_atlas_spec_ids.sql`.
- A working local setup with the database:
  `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit`
  exits 0 on a fresh branch from `main`, and `npm run db:up` then `npm test`
  passes.

## Progress

Built by following a handoff written for this plan, one phase per pull
request, stopping for the owner after each.

| Phase | Steps | Status |
|---|---|---|
| 1. Server: editable Spec IDs, history, library API | 0 / 7 | Not started |
| 2. Workspace and History | 0 / 6 | Not started |
| 3. Library | 0 / 5 | Not started |

---

## Design

### Precedents this plan sets

| First | How | Why this way |
|---|---|---|
| Database transaction | Inside the repository adapter: `add` and `update` each write the Spec ID and its change row in one `db.transaction`. No unit-of-work port | Atomicity belongs to one aggregate's save; a port for it would serve one caller |
| Paged list | Keyset cursor: base64url of `<lastChangedAt ISO>|<id>`, ordered by `coalesce(updated_at, saved_at) desc, id desc`, 20 per page | Stable while rows are added; offset paging skips rows when someone saves |
| Route with a parameter | `/atlas/:id` in `frontend/src/app/routes.tsx`, read with `useParams` | Spec IDs are addressed by their permanent `id`, never their code, which changes |

### Data model

`atlas_spec_ids` gains three columns (one generated migration):

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `version` | `integer` | no | `1` | Raised by 1 on every saved change |
| `updated_by` | `uuid` | yes | — | FK → `accounts.id`; null until the first change |
| `updated_at` | `timestamptz` | yes | — | Null until the first change |

New table `atlas_spec_id_changes`, defined in
`backend/src/modules/atlas/infrastructure/atlas-spec-id-changes.table.ts`:

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | Primary key |
| `spec_id` | `uuid` | no | FK `atlas_spec_id_changes_spec_id_fk` → `atlas_spec_ids.id` |
| `kind` | `varchar(16)` | no | Check: `created` or `updated` |
| `changed_by` | `uuid` | no | FK `atlas_spec_id_changes_changed_by_fk` → `accounts.id` |
| `changed_at` | `timestamptz` | no | |
| `code_before` | `varchar(74)` | yes | Null for `created` |
| `code_after` | `varchar(74)` | no | |
| `name_before` | `varchar(120)` | yes | Null for `created` |
| `name_after` | `varchar(120)` | no | |

Indexes: `atlas_spec_id_changes_spec_id_changed_at_idx` on
`(spec_id, changed_at)`, `atlas_spec_id_changes_code_before_idx` on
`code_before`. Foreign keys are named explicitly: Drizzle's generated names pass
Postgres's 63-character limit.

A second, custom migration
(`npm --prefix backend run db:generate -- --custom --name backfill_atlas_spec_id_created_changes`)
inserts one `created` row per existing Spec ID:
`INSERT INTO atlas_spec_id_changes (id, spec_id, kind, changed_by, changed_at, code_before, code_after, name_before, name_after) SELECT gen_random_uuid(), id, 'created', saved_by, saved_at, NULL, code, NULL, name FROM atlas_spec_ids;`

`resetTables` in `backend/src/test/database.ts` adds `atlas_spec_id_changes`
before `atlas_spec_ids`.

### Contract additions — `backend/src/contracts/atlas.ts`

Types only (ADR 0007):

- `SavedSpecId` gains `id: string`, `version: number`,
  `updatedBy: SavedBy | null`, `updatedAt: string | null`.
- `SpecIdLibraryPage { items: SavedSpecId[]; nextCursor: string | null }`.
- `UpdateSpecIdRequest { name: string; facts: SpecIdFacts; version: number }`.
- `SlotChange { key: SlotKey; name: string; before: string; after: string; corrected: boolean }`
  — `before`/`after` are meanings as people read them ("Not known", "Doesn't apply", "62 mm").
- `SpecIdChange { kind: 'created' | 'updated'; changedBy: SavedBy; changedAt: string; codeBefore: string | null; codeAfter: string; nameBefore: string | null; nameAfter: string; slots: SlotChange[] }`.
- `FormerHolder { id: string; name: string; code: string; until: string }`.
- `SpecIdLookup extends SavedSpecId { replacedCode: string | null; formerHolders: FormerHolder[] }`
  — the answer of `GET /atlas/spec-ids/:code`.

### Routes — `backend/src/modules/atlas/presentation/atlas.routes.ts`

Exactly the table in #16 "Server". Added: `GET /saved`, `GET /saved/:id`,
`PATCH /saved/:id`, `GET /saved/:id/history`. `:id` that is not a UUID answers
404 `SPEC_ID_NOT_FOUND` before any query. New error
`SpecIdChangedError` (`SPEC_ID_CHANGED`, 409, message "Someone changed this Spec
ID while you were editing. Reload to see their changes, then make yours
again.") in `domain/spec-id.errors.ts`.

### Domain and application — `backend/src/modules/atlas/`

| Name | File | Shape |
|---|---|---|
| `SavedSpecId.revise` | `domain/saved-spec-id.ts` | `revise(change: { specId: SpecId; name: string; by: string; at: Date }): Result<SavedSpecId, InvalidSpecIdError>` — trims and checks the name, returns a copy with `version + 1` |
| `SpecIdChange` | `domain/spec-id-change.ts` | `SpecIdChange.created(saved, id)`, `SpecIdChange.updated(before, after, id)`; `isEmpty` when code and name are unchanged |
| `diffCodes` | `domain/diff-codes.ts` | `diffCodes(before: SpecId, after: SpecId): { key: SlotKey; before: string; after: string; corrected: boolean }[]` — raw values; `corrected` when `before` is neither all `0` nor all `X` and differs |
| `SpecIdRepository` | `domain/spec-id-repository.ts` | adds `findById(id)`, `update(saved, change, expectedVersion): Result<void, SpecIdExistsError \| SpecIdChangedError>`, `list(query: { q?: string; productType?: string; after?: Cursor; limit: number })`, `history(id)`, `formerHolders(code)`; `add(saved, change)` now takes the `created` change |
| `UpdateSpecId` | `application/update-spec-id.ts` | builds, checks name and slots together (as `SaveSpecId`), revises, `update`; an empty change returns the current Spec ID without writing |
| `GetSavedSpecId`, `ListSavedSpecIds`, `GetSpecIdHistory` | `application/*.ts` | history meanings come from `toDecodedSpecIdDto` of each side, so the page never decodes |
| `FindSpecIdByCode` | `application/find-spec-id-by-code.ts` | answers `SpecIdLookup`: current holder plus `formerHolders`; or the newest former holder with `replacedCode` |

Codes are compared upper-cased: the lookup and the library search upper-case a
pasted code before asking.

### Frontend — `frontend/src/features/atlas/` and `frontend/src/pages/atlas/`

| Name | File | Purpose |
|---|---|---|
| `toBuildForm` | `domain/to-build-form.ts` | `DecodedSpecId` → `BuildForm`: `0090` → `{ value: '90', unit: 'mm' }`, `0033` → `'3.3'` g, `Z0016` → unit `Z`, `'16'`; `0`/`X` → `''` |
| `isFormChanged` | `domain/build-facts.ts` | `(a: BuildForm, b: BuildForm, rules) => boolean`, comparing `toFacts` of each — drives **Save changes** |
| `useSavedSpecId`, `useUpdateSpecId`, `useSpecIdHistory`, `useExactMatch`, `useSpecIdLibrary`, `useCodeLookup` | `application/` | `useSpecIdHistory` runs only while the sheet is open; `useSpecIdLibrary` is `useInfiniteQuery`; `useExactMatch(code)` treats 404 as no match |
| `SpecIdWorkspace` | `presentation/workspace/SpecIdWorkspace.tsx` | the two columns; props `{ dictionary; initial: BuildForm; saved?: SavedSpecId }` |
| `FactGroups`, `CodePanel`, `MatchPanel` | `presentation/workspace/` | the five groups; the coded parts, legend, Copy and summary; Already saved and the folded similar list |
| `HistorySheet` | `presentation/HistorySheet.tsx` | the `Sheet`, filters, timeline |
| `LibraryList`, `PastedCodeResult`, `DictionarySheet` | `presentation/library/` | phase 3 |
| `NewSpecIdPage`, `SpecIdPage` (+ skeletons) | `pages/atlas/` | phase 2; `AtlasPage` is rewritten in phase 3 |

Product type and shape are `SegmentedControl`s that wrap at phone width
(`flex-wrap`, never a horizontal scroll). The slots `slotStateFor` marks
`does-not-apply` are not rendered; `not-known` ones render disabled as "Not
known". The search box waits 250 ms after the last keystroke before asking.

### Review Focus

Inputs #16 implies but does not spell out. Each has its test in the step that
owns the code.

1. `/atlas/saved/not-a-uuid` and `/atlas/not-a-uuid` — 404 and the "doesn't exist" page, never a 500 (Step 1.4, Step 2.3).
2. A name search containing `%` or `_` matches those characters literally (Step 1.5).
3. A tampered or foreign `cursor` answers 400 `VALIDATION_FAILED` (Step 1.5).
4. A pasted code in lower case (`s1.bld.aps…`) finds the same Spec ID (Step 1.5, Step 3.3).
5. Changing a fact and changing it back leaves **Save changes** disabled; a rename alone writes one change with no slot rows (Step 1.4, Step 2.4).

---

## Phase 1 — Server: editable Spec IDs, history, library API

One pull request, "Part of #16".

### Step 1.1 — Record the decision

- [ ] **Action.** Write `docs/decisions/0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md` from `_template.md`, Accepted, dated the day it is written: saved Spec IDs are editable by any signed-in staff member, the code follows the facts, every change is a row in `atlas_spec_id_changes`, a corrected-away code is free and still finds its former holder, concurrent saves are refused by `version`. Alternatives: codes permanent with a new Spec ID per correction (rejected by reyxdz on 2026-10-17); last save wins (rejected, same date). Add to ADR 0019's status line "Partly superseded by 0022", linked to the new file, and a sentence saying "A code is permanent once issued" no longer holds for saved Spec IDs; add the same note to ADR 0021 for "or a saved Spec ID". Add 0022 to `docs/decisions/README.md`.
- [ ] **Verify.** `npm run docs:check` exits 0.

### Step 1.2 — Columns, the change table, and the backfill

- [ ] **Action.** Add the three columns to `atlas-spec-ids.table.ts` and the new table file, export it from `backend/src/database-schema.ts`, run `npm --prefix backend run db:generate -- --name atlas_spec_ids_editable_with_history`, then the custom backfill migration above. Extend `resetTables`.
- [ ] **Verify.** `npm run db:migrate` applies both; the generated SQL only adds (no `DROP`, no `ALTER COLUMN … TYPE`); a second `db:generate` prints "No schema changes"; a `*.db.test.ts` proves every Spec ID existing before the backfill has exactly one `created` row.

### Step 1.3 — The domain: revise, change, diff

- [ ] **Action.** Tests first, then `SavedSpecId.revise`, `SpecIdChange`, `diffCodes` and `SpecIdChangedError`. Tests: revise raises `version` by 1 and trims the name; a 121-character name is refused; `diffCodes` of `…0000…` → `…0062…` gives one row, not corrected; `0120` → `0118` corrected; a product-type change from bowl to bowl lid shows capacity `Z0016` → `XXXXX`, corrected; identical codes give no rows.
- [ ] **Verify.** `npm --prefix backend run test:unit -- atlas` passes; `npm run arch:check` exits 0.

### Step 1.4 — Update, get, history, and lookups in the application layer

- [ ] **Action.** Extend the port and its in-memory fake; add `UpdateSpecId`, `GetSavedSpecId`, `GetSpecIdHistory`; make `SaveSpecId` write the `created` change and `FindSpecIdByCode` answer `SpecIdLookup`. Tests over the fakes, one per row: new facts change the code and write one `updated` change; a stale `version` → `SpecIdChangedError`, nothing written; another Spec ID's code → `SpecIdExistsError` with it, nothing written; a rename alone → one change, no slot rows; no change → no row; A corrected C1 → C2, then B saved as C1 → lookup of C1 answers B with A in `formerHolders`; a lookup of C2's old code with no current holder answers A with `replacedCode`.
- [ ] **Verify.** `npm --prefix backend run test:unit -- atlas` passes.

### Step 1.5 — The repository, the library query and the routes

- [ ] **Action.** Implement the port in `drizzle-spec-id-repository.ts` (transactions, the conditional `UPDATE … WHERE id = ? AND version = ?`, the keyset cursor, `ilike` with `%` and `_` escaped). Add the zod schemas (`version` a positive integer; `:id` a UUID or 404; `cursor` decodable or 400), controller methods and routes. Database tests: two concurrent `update`s with one `version` leave one change; the library pages 21 Spec IDs as 20 + 1; `%` matches only a literal `%`; a garbage cursor → 400; a lower-case pasted code is found. HTTP tests: every #16 status, `PATCH` without a session → 401, `PUT`/`DELETE` on every Atlas path → 404.
- [ ] **Verify.** `npm run db:up`, then `npm test` passes, including `backend/src/atlas.db.test.ts`.

### Step 1.6 — Contracts and API docs

- [ ] **Action.** The contract additions above; `docs/reference/api.md` (the four routes, `SPEC_ID_CHANGED`, `formerHolders`/`replacedCode`; remove "Nothing updates or deletes a saved Spec ID" and say what replaces it); `docs/reference/data-model.md` (the columns, the table, its indexes).
- [ ] **Verify.** `npm run typecheck && npm run docs:check` exits 0. The frontend still builds against the wider `SavedSpecId`: `npm --prefix frontend run build` exits 0.

### Step 1.7 — Open the pull request

- [ ] **Action.** Open "Part of #16" with the template; Database, API and Rollout filled in (the migrations are additive; the backfill inserts one row per existing Spec ID).
- [ ] **Verify.** CI and `pr-audit` pass. After merge, on staging: the existing illustrative lid answers `GET /api/v1/atlas/saved/<its id>/history` with one `created` entry.

---

## Phase 2 — Workspace and History

One pull request, "Part of #16". Today's `/atlas` page is untouched; the new
pages are reached by URL until phase 3.

### Step 2.1 — Gateway, hooks and form helpers

- [ ] **Action.** Extend `AtlasGateway` and `HttpAtlasGateway` (`getSaved`, `update`, `history`, `findByCode` now answering `SpecIdLookup`); `SpecIdChangedError` beside `SpecIdExistsError` in `application/`; the hooks above; `toBuildForm` and `isFormChanged`. Tests: `toBuildForm` round-trips the illustrative code through `toFacts` to the same facts; `isFormChanged` is false after a change and its undo; the gateway maps 409 `SPEC_ID_CHANGED` to `SpecIdChangedError`.
- [ ] **Verify.** `npm --prefix frontend run test -- --no-file-parallelism src/features/atlas` passes.

### Step 2.2 — The workspace

- [ ] **Action.** `SpecIdWorkspace`, `FactGroups`, `CodePanel`, `MatchPanel` with #16's copy. Tests: a bowl lid renders no capacity, bottom diameter or gusset field, and the note names them; a pouch renders no shape; top diameter shows "Not known" disabled until a shape is chosen; an exact match disables **Save Spec ID** and shows "This code is already saved. Open it to add or correct facts instead."; on a saved Spec ID its own code is never shown as a match; similar Spec IDs stay folded; **Copy** reads "Copied" and returns after 2 seconds.
- [ ] **Verify.** The tests pass; `npm run design:check` prints "Design tokens only."

### Step 2.3 — `/atlas/new` and `/atlas/:id`

- [ ] **Action.** `NewSpecIdPage`, `SpecIdPage` and their skeletons; the two routes in `routes.tsx` (`atlas/new` before `atlas/:id`). `/atlas/new?code=<code>` seeds the form from that code. `SpecIdPage`'s header: **Atlas** (back), the name, the not-known badge, "Last updated by {who} on {date} · created by {who} on {date}", the History icon button and **Save changes**; the name is an editable `TextField` in the side column. Saving a new Spec ID navigates to `/atlas/<id>` with its saved message; **Save changes** shows "Saved." or "Saved. The code is now {code}."; `SpecIdExistsError` shows the other-product message with **Open**; `SpecIdChangedError` shows the reload message with **Reload**; an unknown or non-UUID id shows "This Spec ID doesn't exist. It may have been typed wrong." with **Back to Atlas**.
- [ ] **Verify.** Route and page tests pass, including each message above.

### Step 2.4 — The History sheet

- [ ] **Action.** The header's History icon button (`aria-label="History"`) opens `HistorySheet`: filters All, Facts, Name with counts; entries newest first with #16's sentences, old → new per slot, the code before and after, "Corrected" badges; "created" last. Tests: entries are newest first; "Corrected" appears only on a replaced known value; Facts hides a rename-only entry; **Save changes** stays disabled after a change and its undo.
- [ ] **Verify.** The tests pass; `npm run typecheck && npm run lint && npm run arch:check` exits 0.

### Step 2.5 — Check it in a browser

- [ ] **Action.** With the database, API and web app running locally, open `/atlas/new`, build and save the illustrative lid, add the height, correct the unit weight, save, and open History. Repeat in light and dark at 1280 px and at 390 px with the sidebar folded and reduced motion on. Take `atlas-workspace-light.png`, `atlas-workspace-dark.png` and `atlas-workspace-phone-light.png` with `scripts/screenshot.mjs` into `.github/readme/`. Stop everything started.
- [ ] **Verify.** Nothing overflows at 390 px (no horizontal scroll); every control is reached by Tab with the focus ring; the three screenshots exist.

### Step 2.6 — Open the pull request

- [ ] **Action.** Open "Part of #16" with the template, the screenshots and every state ticked or marked n/a.
- [ ] **Verify.** CI and `pr-audit` pass. After merge, on staging: `/atlas/new` saves, `/atlas/<id>` updates, History shows both.

---

## Phase 3 — Library

One pull request, "Closes #16".

### Step 3.1 — The library list

- [ ] **Action.** `AtlasPage` rewritten: `PageHeader` with **Dictionary** and **New Spec ID**; the search `TextField` (label "Search"); the product-type `SegmentedControl`; `LibraryList` cards (name, code, summary, "{n} not known" or "Complete", who and when) linking to `/atlas/<id>`; **Show more**; the empty and no-match states from #16's copy table. `AtlasPageSkeleton` redrawn to match.
- [ ] **Verify.** Tests: 20 cards then **Show more** loads the rest; a search waits 250 ms; the empty library shows the `EmptyState`; a search with no match shows its sentence.

### Step 3.2 — The Dictionary sheet

- [ ] **Action.** `DictionarySheet` wraps the existing `DictionaryBrowser` in a `Sheet` titled "Dictionary" with "S1 {release}, approved {date}. It changes only by migration."
- [ ] **Verify.** A test opens and closes it with the button and with Escape.

### Step 3.3 — Paste a code

- [ ] **Action.** Input starting with `S1.` in any case is upper-cased and looked up: current holder card with a note per former holder; "This code was updated. It's now {code}."; "This Spec ID isn't saved yet." with the slots in plain words (doesn't-apply folded) and **Start a Spec ID from it** → `/atlas/new?code=…`; an invalid code shows the decoder's messages.
- [ ] **Verify.** One test per branch, including a lower-case paste.

### Step 3.4 — Remove what the library replaces

- [ ] **Action.** Delete `BuildPanel`, `LookupPanel`, `DecodePanel`, `SavedSpecIdList`, `SavedSpecIdCard`, `lookup-criteria.ts`, `to-slot-text.ts`, `use-similar-spec-ids.ts` only if nothing still imports it, and their tests; drop their exports from `features/atlas/index.ts`. Search for each name with `git grep -n` before deleting.
- [ ] **Verify.** `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit && npm run build` exits 0; `git grep -n "BuildPanel\|LookupPanel\|DecodePanel" frontend/src` prints nothing.

### Step 3.5 — Docs, screenshots, then staging

- [ ] **Action.** Screenshots `atlas-library-light.png`, `atlas-library-dark.png`, `atlas-library-phone-light.png`; open the pull request ("Closes #16"); after merge, run #16's staging check.
- [ ] **Verify.** On staging after merge, signed in, in light and dark and at 390 px: build a Spec ID with three facts and save it; open it, add a fourth and correct one, and save; History shows both; the old code pasted into the library search lands on the product. The result is written as a comment on #16.

---

## Acceptance

The plan is complete when every box below is checked.

- [ ] Every item under "Verify" in [#16](https://github.com/S1-GLOBAL/s1-gateway/issues/16) is ticked on the issue.
- [ ] ADR 0022 is Accepted and listed, and ADRs 0019 and 0021 link to it.
- [ ] `api.md` and `data-model.md` describe every Atlas route and table.
- [ ] #16 is closed by phase 3's pull request.

## Follow-ups

- Deleting or retiring a saved Spec ID — no issue yet
- A "put this version back" button in History — no issue yet
- Edit permissions by role — no issue yet
- A warning before leaving with unsaved changes — no issue yet
- Variant numbers and the collision review — no issue yet
- Merging two saved Spec IDs — no issue yet

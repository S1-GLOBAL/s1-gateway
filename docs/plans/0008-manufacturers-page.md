# 0008. Manufacturers on each Spec ID, with stages admins set

- **Status:** Ready
- **Owner:** Rey Denzo
- **Related:** [#57](https://github.com/S1-GLOBAL/s1-gateway/issues/57) ·
  [ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md) ·
  [ADR 0022](../decisions/0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md) ·
  [ADR 0013](../decisions/0013-loading-states-are-page-shaped-skeletons.md) ·
  [plan 0006](./0006-s2-spec-ids-and-verified-list-import.md)

## Goal

At the end of this plan, clicking a Spec ID in the Atlas library, or in
Search's results, opens `/atlas/<id>/manufacturers`. The page lists every
manufacturer the verified-list import recorded for that product, once each,
with every quote it gave. Manufacturers are grouped by stage, in this order:
"Specifications received", "Quoted", "Sampling", "In production". The quotes
give the first two stages. Only an admin can set Sampling or In production,
and every change is recorded. **Open Spec ID** leads to the Spec ID page as
before. #57 is the specification: where this plan and #57 disagree, #57 wins
and this plan is corrected.

## Scope

**In scope**
- A table of stage changes, by generated migration, and the stage rule
- `GET /api/v1/atlas/saved/:id/manufacturers` (any signed-in staff member)
- `PUT /api/v1/atlas/saved/:id/manufacturers/:manufacturerId/stage` (admins only)
- The Manufacturers page, its skeleton, and the two card links that open it
- `api.md` and `data-model.md`

**Out of scope** — and where it is handled instead
- Importing manufacturers and quotes — #56, done (plan 0006)
- Adding or editing a manufacturer or a quote in Atlas — #61
- Every stage change listed on the page; the last one shows — #59
- Finding Spec IDs by manufacturer — #60
- Any other link to `/atlas/<id>` — unchanged, as #57 decided

## Prerequisites

- `main` has #64: the import records manufacturers and quotes.
  Verify: `git grep -n "export const atlasQuotes" -- backend/src` prints one line.
- The last migration is `0013_atlas_manufacturers_and_quotes`.
  Verify: `git ls-files backend/drizzle | grep -c "\.sql$"` prints `14`.
- Staging has manufacturers and quotes: #56's staging run recorded 1,053 quotes on 2026-10-23.
- A working local setup: `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit`
  exits 0 on a fresh branch from `main`, and `npm run db:up` then `npm test` passes.

## Progress

| Phase | Steps | Status |
|---|---|---|
| 1. Stages and the two routes | 0 / 6 | Not started |
| 2. The Manufacturers page | 0 / 7 | Not started |

Two pull requests, as reyxdz decided on 2026-10-23: phase 1 is "Part of #57",
and phase 2 is "Closes #57". Stop for the owner after each.

---

## Design

### Precedents this plan sets

| First | How | Why this way |
|---|---|---|
| A change in Atlas only admins may make | The route sits in a second router, which the module hands the composition root with `access: 'admin'`, so the existing admin gate refuses everyone else with 403 `NOT_ALLOWED` before any Atlas code runs | One gate for every admin route, as `/accounts` has; ADR 0027 records why stages are admins' |
| A value a person sets over one the data gives | Stage changes are only ever inserted; the current stage is the newest change's `stage_after`, and `null` hands back to the quotes | The same insert-only record as a Spec ID's History (ADR 0022); clearing needs no special case |

### Stages — `backend/src/modules/atlas/domain/sourcing/stage.ts`

| Name | Shape |
|---|---|
| `AdminStage` | `'sampling' \| 'in-production'` |
| `Stage` | `'specifications-received' \| 'quoted' \| AdminStage` |
| `hasPrice(value: string \| null)` | true when the value holds a digit. `N/A`, `-` and `/` are not prices: the verified list writes them in price cells *(technical call)* |
| `stageOf(quotes: readonly QuoteValues[], set: AdminStage \| null): Stage` | `set` when an admin set one; else `quoted` when any quote's `fobPerUnit` or `fobPerCase` has a price; else `specifications-received` |
| `StageChange` | `{ id, specId, manufacturerId, stageBefore: AdminStage \| null, stageAfter: AdminStage \| null, changedBy, changedAt }` |

### The table — `atlas_manufacturer_stage_changes`

Defined in `backend/src/modules/atlas/infrastructure/atlas-manufacturer-stage-changes.table.ts`,
added to `database-schema.ts`, migration `0014` made with
`npm --prefix backend run db:generate -- --name atlas_manufacturer_stage_changes` (ADR 0005).
Rows are only ever inserted.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | Primary key, from the application |
| `spec_id` | `uuid` | no | FK → `atlas_spec_ids.id` |
| `manufacturer_id` | `uuid` | no | FK → `atlas_manufacturers.id` |
| `stage_before` | `varchar(16)` | yes | `sampling`, `in-production`, or null for none |
| `stage_after` | `varchar(16)` | yes | the same; null is a cleared stage |
| `changed_by` | `uuid` | no | FK → `accounts.id` |
| `changed_at` | `timestamptz` | no | the application's clock |

A check constraint keeps both stage columns to the two values or null, and an
index on `(spec_id, manufacturer_id, changed_at)` finds the newest change.
`atlas:import` never touches this table, and never deletes a manufacturer,
so a re-import leaves every stage as it was (#57; the test moved here from #56).

### The repository — `SourcingRepository` gains

| Method | Does |
|---|---|
| `currentStages(specId)` | Each manufacturer's newest change on that Spec ID, with the changer's full name: `{ change: StageChange; changedByName: string }[]` |
| `recordStageChange(input)` | In one transaction: locks the manufacturer's row (`SELECT … FOR UPDATE`), reads its newest change on that Spec ID, and, when `stageAfter` differs from it, inserts a change with that as `stageBefore`. Answers the change, or null when nothing changed *(technical call: two admins at once cannot record a wrong "before")* |
| `quotesOf(specId)` | Already there (#64) |

Both adapters, Drizzle and in-memory, as #64's `replaceQuotes` has them.

### Use cases — `backend/src/modules/atlas/application/`

| Name | Input | Answers |
|---|---|---|
| `GetSpecIdManufacturers` | `{ id }` | `SpecIdNotFoundError` when no Spec ID has the id; else the Spec ID's id, name and code, and each manufacturer once, by name: id, name, country, stage, the last admin change (who and when) if one was made, and every quote |
| `SetManufacturerStage` | `{ id, manufacturerId, stage: AdminStage \| null, by: { id, fullName } }` | `SpecIdNotFoundError`; `ManufacturerNotFoundError` (code `MANUFACTURER_NOT_FOUND`, 404, "This manufacturer has no quote on this Spec ID." *(technical call)*) when the manufacturer has no quote on that Spec ID; else the manufacturer's entry as `GET` shows it. Setting the stage it already has records nothing and answers 200 *(technical call)* |

### Contract — `backend/src/contracts/atlas.ts` (types only, ADR 0007)

```ts
export type ManufacturerStage = 'specifications-received' | 'quoted' | 'sampling' | 'in-production';

/** One verified-list row's quote, each value as the workbook shows it; null when empty. */
export interface ManufacturerQuote {
  itemName: string | null;
  fobPerUnit: string | null;
  fobPerCase: string | null;
  fobTotal: string | null;
  moldCost: string | null;
  moldLeadTime: string | null;
  sampleLeadTime: string | null;
  productionLeadTime: string | null;
}

export interface SpecIdManufacturer {
  id: string;
  name: string;
  country: string | null;
  stage: ManufacturerStage;
  /** The last change an admin made, if any; a cleared stage still shows who cleared it. */
  stageSet: { by: SavedBy; at: string; stage: 'sampling' | 'in-production' | null } | null;
  quotes: ManufacturerQuote[];
}

/** `GET /atlas/saved/:id/manufacturers`. */
export interface SpecIdManufacturers {
  specId: { id: string; name: string; code: string };
  manufacturers: SpecIdManufacturer[];
}

/** `PUT /atlas/saved/:id/manufacturers/:manufacturerId/stage`, admins only. */
export interface SetManufacturerStageRequest {
  stage: 'sampling' | 'in-production' | null;
}
```

### Routes

| Method and path | Who | Answers |
|---|---|---|
| `GET /api/v1/atlas/saved/:id/manufacturers` | any signed-in staff member | 200 `{ data: SpecIdManufacturers }`; 401 without a session; 404 `SPEC_ID_NOT_FOUND` for an id with no Spec ID, or one that is not a UUID (before any query) |
| `PUT /api/v1/atlas/saved/:id/manufacturers/:manufacturerId/stage` | admins (`ACCOUNT_ADMIN_EMAILS`) | 200 `{ data: SpecIdManufacturer }`; 401 without a session; 403 `NOT_ALLOWED` for anyone else, recording nothing; 400 `VALIDATION_FAILED` for any other body; 404 `SPEC_ID_NOT_FOUND` or `MANUFACTURER_NOT_FOUND` |

`buildAtlasModule` returns `HttpModule[]`: today's router with `access: 'session'`,
and `createAtlasAdminRouter` with `access: 'admin'` holding only the `PUT`.
`compose.ts` spreads it as it does `accounts.modules` *(technical call)*.

### Frontend — `frontend/src/`

| Piece | Where | Does |
|---|---|---|
| Types | `features/atlas/domain/atlas.ts` | The contract's shapes, `stageSet.at` a `Date` |
| `manufacturerGroups` | `features/atlas/domain/manufacturer-groups.ts` | The four groups in #57's order with their names and descriptions, each manufacturer in its stage's group; a group with none is left out |
| `shownValue`, `shownLeadTime` | same file | `null` → "—"; a lead time that is a whole number → "{n} days"; anything else as written |
| Gateway | `features/atlas/application/atlas-gateway.ts`, `infrastructure/http-atlas-gateway.ts`, the test fake | `manufacturers(id)`, `setManufacturerStage(id, manufacturerId, stage)` |
| Hooks | `features/atlas/application/use-spec-id-manufacturers.ts`, `use-set-manufacturer-stage.ts` | A suspense query keyed `atlasKeys.manufacturers(id)`; a mutation that refreshes it |
| `ManufacturerGroups` | `features/atlas/presentation/manufacturers/` | The groups, each manufacturer's card and quotes, and, when `isAdmin`, **Mark as sampling**, **Mark as in production** and, once a stage is set, **Clear stage** |
| `ManufacturersPage`, `ManufacturersPageSkeleton` | `pages/atlas/` | Route `atlas/:id/manufacturers` in `app/routes.tsx`, inside `RouteBoundary` (ADR 0013); reads `isAdmin` from `useMe()` |
| Card links | `features/atlas/presentation/library/LibraryList.tsx`, `TextSearchResults.tsx` | `/atlas/${id}/manufacturers` in place of `/atlas/${id}`; every other link to `/atlas/<id>` stays |

Copy is #57's table, word for word. A stage change that fails shows the
error's own message beside the buttons, and the buttons stay usable.

### Review focus

1. A price cell holding `N/A`, `-` or `/` — not a price (Step 1.2).
2. After an admin sets a stage, `replaceQuotes` with the same rows leaves that stage set (Step 1.3). Clearing hands it back to the quotes (Step 1.2).
3. Two admins set different stages at once — each change's "before" is the stage it replaced (Step 1.3).
4. A non-admin calls the `PUT` — 403 before any Atlas code runs, and nothing is recorded (Step 1.5).
5. A manufacturer with quotes on another Spec ID only — 404 `MANUFACTURER_NOT_FOUND` (Step 1.4).

---

## Phase 1 — Stages and the two routes

One pull request, "Part of #57". Every test uses invented manufacturers and prices (ADR 0027).

### Step 1.1 — The table

- [ ] **Action.** `atlas_manufacturer_stage_changes` as the design gives it, in `database-schema.ts`, and migration `0014` from `npm --prefix backend run db:generate -- --name atlas_manufacturer_stage_changes`. Add the table to `resetTables` in `backend/src/test/database.ts` and to the truncate in `backend/src/atlas.db.test.ts`.
- [ ] **Verify.** `npm run db:generate` run again prints "No schema changes, nothing to migrate"; `npm test` passes.

### Step 1.2 — Stages in the domain

- [ ] **Action.** `domain/sourcing/stage.ts` as designed. Tests: a quote with a per-unit price is `quoted`; one with only a per-case price is `quoted`; one with neither is `specifications-received`; `N/A`, `-` and `/` are not prices; an admin-set `sampling` wins over `quoted`; `null` hands back to the quotes.
- [ ] **Verify.** From `backend/`: `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/sourcing` passes.

### Step 1.3 — The repository

- [ ] **Action.** `currentStages` and `recordStageChange` on `SourcingRepository`, with the Drizzle and in-memory adapters. Database tests:
  - a change records who, when, before and after;
  - the same stage twice records one change;
  - clearing records `null` after;
  - after a stage is set, `replaceQuotes` with the same rows leaves `currentStages` unchanged;
  - two changes in a row each record the stage they replaced.
- [ ] **Verify.** `npm test` passes; `npm run arch:check` exits 0.

### Step 1.4 — The use cases

- [ ] **Action.** `GetSpecIdManufacturers` and `SetManufacturerStage`, and `ManufacturerNotFoundError`. Tests with the in-memory adapters:
  - a manufacturer with three quotes on one Spec ID appears once, with three quotes;
  - one with a per-unit price is Quoted, one with none is Specifications received;
  - an admin-set Sampling shows over Quoted, and clearing it shows Quoted again;
  - an unknown id answers `SpecIdNotFoundError`;
  - a manufacturer whose quotes are on another Spec ID answers `ManufacturerNotFoundError`;
  - `stageSet` names who made the last change, and when.
- [ ] **Verify.** The tests pass.

### Step 1.5 — Contract, routes and wiring

- [ ] **Action.**
  - The contract types above.
  - A body schema in `atlas.schemas.ts`, and the two handlers in `atlas.controller.ts`; `MANUFACTURER_NOT_FOUND` maps to 404.
  - `createAtlasAdminRouter` in `atlas.routes.ts`, whose comment changes to "the one PUT sets a manufacturer's stage, admins only".
  - `buildAtlasModule` returns both modules, and `compose.ts` spreads them.

  Database route tests, through `composeApp`:
  - `GET` answers 401 without a session, 404 for an unknown id and for a non-UUID, and 200 with the manufacturers;
  - `PUT` as staff who are not admins answers 403 `NOT_ALLOWED` and records nothing;
  - as an admin it answers 200 and records who, when, before and after;
  - `{ "stage": "quoted" }` answers 400 `VALIDATION_FAILED`.
- [ ] **Verify.** `npm test` passes; `npm run arch:check` exits 0.

### Step 1.6 — Docs and the pull request

- [ ] **Action.** `api.md` documents both routes, their access and statuses; `data-model.md` documents `atlas_manufacturer_stage_changes`. Open the pull request "Part of #57".
- [ ] **Verify.** CI and `pr-audit` pass.

---

## Phase 2 — The Manufacturers page

One pull request, "Closes #57". Screenshots use invented manufacturers and prices only.

### Step 2.1 — Types and the gateway

- [ ] **Action.** The frontend types, both gateway methods, the HTTP adapter and the test fake. Adapter tests: `manufacturers` reads `GET /atlas/saved/<id>/manufacturers` and turns `stageSet.at` into a `Date`; `setManufacturerStage` sends `PUT` with `{ stage }`; a 403 becomes an `AppError` carrying "You are not allowed to do that."
- [ ] **Verify.** `npm --prefix frontend run test` passes.

### Step 2.2 — Groups and values

- [ ] **Action.** `manufacturer-groups.ts`. Tests:
  - the groups come in #57's order with #57's names and descriptions;
  - a group with no manufacturer is left out;
  - `null` shows "—";
  - `30` shows "30 days", and `30-35 days` shows as written.
- [ ] **Verify.** The tests pass.

### Step 2.3 — The hooks

- [ ] **Action.** `useSpecIdManufacturers(id)` (suspense, `atlasKeys.manufacturers(id)`) and `useSetManufacturerStage(id)`, which refreshes that query on success.
- [ ] **Verify.** A hook test: after a successful set, the query is fetched again.

### Step 2.4 — The groups on screen

- [ ] **Action.** `ManufacturerGroups` in `features/atlas/presentation/manufacturers/`, tokens only (`frontend/DESIGN.md`). Tests:
  - each manufacturer shows its name, country, stage and every quote with #57's labels;
  - an admin-set stage shows "Set to {stage} by {name} on {date}";
  - an admin sees **Mark as sampling** and **Mark as in production**, and **Clear stage** only once a stage is set;
  - someone who is not an admin sees none of them;
  - a failed change shows the error's message.
- [ ] **Verify.** The tests pass; `npm run design:check` exits 0.

### Step 2.5 — The page

- [ ] **Action.**
  - `ManufacturersPage` and `ManufacturersPageSkeleton`, shaped like the page, and the route `atlas/:id/manufacturers` in `app/routes.tsx`.
  - The eyebrow "Manufacturers", the name, the code under it, and **Open Spec ID** to `/atlas/<id>`.
  - With no manufacturers: "No manufacturers are recorded for this Spec ID yet. They come from the verified list import." with **Open Spec ID**.

  Page tests:
  - **Open Spec ID** links to `/atlas/<id>`;
  - the empty state shows #57's sentence;
  - an unknown id shows "This Spec ID doesn't exist. It may have been typed wrong.";
  - a failed load shows the error with **Try again**.
- [ ] **Verify.** The tests pass.

### Step 2.6 — The card links, browser check and pull request

- [ ] **Action.**
  - The library's cards (`LibraryList.tsx`) and Search's result cards (`TextSearchResults.tsx`, both Fits and Might fit) link to `/atlas/<id>/manufacturers`. Tests check both links, and that these still go to `/atlas/<id>`: a save (`features/atlas/presentation/NewSpecIdForm.tsx`, `features/atlas/presentation/library/SaveFromSearch.tsx`, `features/atlas/presentation/SaveOutcome.tsx`), the workspace's similar list (`features/atlas/presentation/workspace/MatchPanel.tsx`), and a pasted code's Open (`features/atlas/presentation/library/PastedCodeResult.tsx`). History remains the button on the Spec ID page (`features/atlas/presentation/SpecIdEditor.tsx`).
  - With invented manufacturers in the local database, check the page and take screenshots: light and dark, 390px with the bottom bar, an admin and a non-admin.
  - Open the pull request "Closes #57".
- [ ] **Verify.** CI and `pr-audit` pass.

### Step 2.7 — Staging (reyxdz)

- [ ] **Action.** After merge, on staging:
  1. Open a Spec ID from the library and see its manufacturers grouped by stage, with their quotes.
  2. As an admin, mark one as sampling and see it move with "Set to Sampling by …".
  3. Clear it.
  4. Open the Spec ID page from the button.

  Write what was checked as a comment on #57.
- [ ] **Verify.** The comment is on #57, and every Verify item on #57 is ticked.

---

## Acceptance

The plan is complete when every box below is checked.

- [ ] Every item under "Verify" in [#57](https://github.com/S1-GLOBAL/s1-gateway/issues/57) is ticked, and #57 is closed.
- [ ] `api.md` documents both routes, and `data-model.md` documents `atlas_manufacturer_stage_changes`.
- [ ] A re-import after an admin set a stage leaves it set, by test (Step 1.3).

## Follow-ups

- Every stage change on the page — #59
- Finding Spec IDs by manufacturer — #60
- Adding or editing manufacturers and quotes — #61

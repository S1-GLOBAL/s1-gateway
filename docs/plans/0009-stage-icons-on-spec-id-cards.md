# 0009. Stage icons on every Spec ID card

- **Status:** In progress
- **Owner:** Rey Denzo
- **Related:** [#73](https://github.com/S1-GLOBAL/s1-gateway/issues/73) ·
  [plan 0008](./0008-manufacturers-page.md) ·
  [ADR 0012](../decisions/0012-motion-and-animated-icons.md) ·
  [ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md)

## Goal

At the end of this plan every Spec ID card carries a fixed row of five icons:
- in the library, in Search's Fits and Might fit, and on a pasted code's result;
- one icon each for Specifications received, Quoted, Sampling and In production, lit when any of the Spec ID's manufacturers has reached that stage;
- a fifth, lit when the Spec ID has no manufacturers.

Lit icons draw themselves once when the card appears, and again on hover; nothing loops (ADR 0012). Hovering an icon, or a screen reader, gives the stage and its count. The API answers the counts on every `SavedSpecId`, one query per answer. #73 is the specification: where this plan and #73 disagree, #73 wins and this plan is corrected.

## Scope

**In scope**
- `manufacturerStages` on every `SavedSpecId` the API answers, one query per answer
- Five hand-made animated icons in the design system, and `/theme`
- The icon row on `SpecIdSummary`, the card every Spec ID list uses
- `api.md`

**Out of scope** — and where it is handled instead
- A stage filter in the library — no issue yet
- Every stage change on the Manufacturers page — #59
- Finding Spec IDs by manufacturer — #60
- Looping animation — declined by reyxdz on 2026-10-23 (ADR 0012)

## Prerequisites

- `main` has #69 and #70: manufacturers' stages and their page.
  Verify: `git grep -n "export function stageOf" -- backend/src` prints one line.
- A working local setup: `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit`
  exits 0 on a fresh branch from `main`, and `npm run db:up` then `npm test` passes.

## Progress

| Phase | Steps | Status |
|---|---|---|
| 1. Stage counts in the API | 3 / 4 | In progress — steps 1.1 to 1.3 built; step 1.4 is this phase's pull request |
| 2. Icons on the cards | 0 / 6 | Not started |

Two pull requests, as reyxdz decided on 2026-10-23: phase 1 is "Part of #73",
and phase 2 is "Closes #73". Stop for the owner after each.

---

## Design

### Counts — `backend/src/modules/atlas/domain/sourcing/stage.ts`

| Name | Shape |
|---|---|
| `STAGE_ORDER` | `['specifications-received', 'quoted', 'sampling', 'in-production']` |
| `reachedCounts(stages: readonly Stage[])` | `{ specificationsReceived, quoted, sampling, inProduction }`: for each stage, how many of `stages` are at it or later. One In production and one Quoted give 2, 2, 1, 1; none give 0, 0, 0, 0 |

Each manufacturer's own stage is `stageOf` from #69, unchanged: an admin-set stage, else Quoted when a per-unit or per-case price holds a digit, else Specifications received.

### The read — `SourcingRepository.stagesOf(specIds)`

| Method | Does |
|---|---|
| `stagesOf(specIds: readonly string[])` | In **one** query, each manufacturer with a quote on each of the given Spec IDs: whether any of its quotes there has a price, and its newest admin stage there. Answers `Map<specId, Stage[]>`, one `Stage` per manufacturer; a Spec ID with none is absent. An empty list makes no query |

Drizzle (`DISTINCT ON` for the newest change, `fob_per_unit ~ '[0-9]' or fob_per_case ~ '[0-9]'` for a price) and in-memory adapters *(technical call: one round trip for a page of 20 cards)*.

### Contract — `backend/src/contracts/atlas.ts` (types only, ADR 0007)

```ts
/** How many of a Spec ID's manufacturers have reached each stage, at it or later (#73). */
export interface ManufacturerStageCounts {
  specificationsReceived: number;
  quoted: number;
  sampling: number;
  inProduction: number;
}
```

`SavedSpecId` gains `manufacturerStages: ManufacturerStageCounts`. The field is new, so an older frontend ignores it.

### Where the API builds a `SavedSpecId`

`toSavedSpecIdDto(record, dictionary, counts)` takes the counts. Each use case below reads them with one `stagesOf` call for every Spec ID in its answer:

| Use case | Spec IDs in one call |
|---|---|
| `ListSavedSpecIds` | the page |
| `FindSimilarSpecIds` | fits and might fit together |
| `FindSpecIdByCode` | the holder |
| `GetSavedSpecId` | the one |
| `SaveSpecId` | the one saved, or the existing one in `SPEC_ID_EXISTS` |
| `UpdateSpecId` | the one changed, or the other one in `SPEC_ID_EXISTS` |

The use cases that take a `SourcingRepository` for this get it in `backend/src/modules/atlas/index.ts`, `atlas.routes.test.ts`, the import command (`backend/src/scripts/atlas-import.ts`) and their tests.

### Frontend

| Piece | Where | Does |
|---|---|---|
| Type | `features/atlas/domain/atlas.ts` | `SavedSpecId.manufacturerStages?: ManufacturerStageCounts`: optional, so a card from an older API leaves the row out |
| Five icons | `shared/ui/icons/icons.tsx`, `index.ts`, `icons.test.tsx`, and `/theme`'s Icons section | `SpecsReceivedIcon` (lucide `file-text`), `QuotedIcon` (`receipt`), `SamplingIcon` (`flask-conical`), `InProductionIcon` (`factory`), `NoManufacturersIcon` (`circle-slash`), each stroke its own `m.path` with `rest` and `active` variants, as DESIGN.md "Icons" says |
| Labels | `features/atlas/domain/stage-icons.ts` | The five icons' lit state and hover text from the counts (the copy below) |
| `StageIcons` | `features/atlas/presentation/library/StageIcons.tsx` | The row: lit icons `text-accent-ink`, unlit `text-ink-subtle` at reduced opacity. Lit icons play `active` once on mount and on the card's hover (`iconTrigger`); unlit never move; reduced motion stops all of it |
| The card | `features/atlas/presentation/library/SpecIdSummary.tsx` | Renders `StageIcons` after the facts in words, when `manufacturerStages` is present |

Copy, from #73:

| When | Users see (hover, and screen reader) |
|---|---|
| A stage icon, lit | "{Stage}: {n} manufacturer" / "{Stage}: {n} manufacturers" |
| A stage icon, unlit | "{Stage}: none" |
| The fifth icon, lit | "No manufacturers yet" |
| The fifth icon, unlit | "{n} manufacturer recorded" / "{n} manufacturers recorded" |

### Review focus

1. A manufacturer whose only prices are `N/A` — Specifications received only (Step 1.1).
2. An admin-set Sampling on a manufacturer with no price — lights Specifications received, Quoted and Sampling: "everything reached" (Step 1.1).
3. A library page of 20 Spec IDs — one `stagesOf` call and one query (Steps 1.2, 1.3).
4. `SPEC_ID_EXISTS` on save — the existing Spec ID's counts come with it (Step 1.3).
5. A card with no `manufacturerStages` — no icon row (Step 2.4).

---

## Phase 1 — Stage counts in the API

One pull request, "Part of #73".

### Step 1.1 — Counts in the domain

- [x] **Action.** `STAGE_ORDER` and `reachedCounts` in `domain/sourcing/stage.ts`. Tests:
  - one In production and one Quoted give 2, 2, 1, 1;
  - one Specifications received gives 1, 0, 0, 0;
  - an admin-set Sampling gives 1, 1, 1, 0;
  - none give 0, 0, 0, 0.
- [x] **Verify.** From `backend/`: `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/sourcing` passes.

### Step 1.2 — One read for many Spec IDs

- [x] **Action.** `stagesOf` on `SourcingRepository`, Drizzle and in-memory. Database tests:
  - two Spec IDs with three manufacturers between them answer each manufacturer's stage under its Spec ID;
  - a price of `N/A` is no price;
  - an admin-set stage wins, and a cleared one hands back to the quotes;
  - a Spec ID with none is absent;
  - an empty list answers an empty map.
- [x] **Verify.** `npm test` passes; `npm run arch:check` exits 0.

### Step 1.3 — Every `SavedSpecId` carries its counts

- [x] **Action.** The contract and DTO field, `toSavedSpecIdDto`'s third argument, and the six use cases above, each calling `stagesOf` once.

  Tests with the in-memory adapters:
  - the library page of 20 calls `stagesOf` once, with all 20 ids;
  - Search calls it once for fits and might fit together;
  - a Spec ID with manufacturers answers their counts, and one without answers zeros;
  - `SPEC_ID_EXISTS` carries the existing Spec ID's counts.

  One composed database test: `GET /api/v1/atlas/saved` answers `manufacturerStages` with each item.
- [x] **Verify.** `npm test` passes; `npm run arch:check` exits 0.

### Step 1.4 — Docs and the pull request

- [ ] **Action.** `api.md` describes `manufacturerStages` on `SavedSpecId`. Open the pull request "Part of #73".
- [ ] **Verify.** CI and `pr-audit` pass.

---

## Phase 2 — Icons on the cards

One pull request, "Closes #73". Screenshots use invented data only.

### Step 2.1 — The type and the adapter

- [ ] **Action.** `ManufacturerStageCounts` and the optional `manufacturerStages` in the frontend domain; the HTTP adapter maps it, and leaves it out when the API sends none. Adapter tests for both.
- [ ] **Verify.** `npm --prefix frontend run test` passes.

### Step 2.2 — Five animated icons

- [ ] **Action.** The five icons, made as DESIGN.md "Icons" says, in `icons.tsx` and `icons/index.ts`, with their stroke counts in `icons.test.tsx`, and shown in `/theme`'s Icons section.
- [ ] **Verify.** The icon tests pass; `npm run design:check` exits 0.

### Step 2.3 — Lit state and words

- [ ] **Action.** `stage-icons.ts`. Tests:
  - 2, 2, 1, 1 lights the four stage icons, and the fifth says "2 manufacturers recorded";
  - 1, 0, 0, 0 lights only the first, which says "Specifications received: 1 manufacturer", and the others say "{Stage}: none";
  - 0, 0, 0, 0 lights only the fifth, "No manufacturers yet".
- [ ] **Verify.** The tests pass.

### Step 2.4 — The row on every card

- [ ] **Action.** `StageIcons`, and `SpecIdSummary` rendering it after the facts. Tests:
  - each icon carries its words as its accessible name and hover text;
  - lit and unlit icons differ;
  - with reduced motion no icon animates;
  - a `SavedSpecId` with no `manufacturerStages` shows no row;
  - the library, Search's results and a pasted code's result all show the row.
- [ ] **Verify.** The tests pass; `npm run design:check` exits 0.

### Step 2.5 — Browser check, screenshots and the pull request

- [ ] **Action.**
  - With invented manufacturers in a throwaway local database, as plan 0008's phase 2 did, look at the library and Search: light and dark, 390px with the bottom bar, and the sidebar folded.
  - Take the screenshots, and confirm hover texts and that the lit icons match each Spec ID's Manufacturers page.
  - Open the pull request "Closes #73".
- [ ] **Verify.** CI and `pr-audit` pass.

### Step 2.6 — Staging (reyxdz)

- [ ] **Action.** After merge, on staging:
  1. The library's cards show the five icons, and a Spec ID's lit icons match its Manufacturers page.
  2. Hovering shows the counts.
  3. A Spec ID saved by hand lights only the fifth.

  Write what was checked as a comment on #73.
- [ ] **Verify.** The comment is on #73, and every Verify item on #73 is ticked.

---

## Acceptance

The plan is complete when every box below is checked.

- [ ] Every item under "Verify" in [#73](https://github.com/S1-GLOBAL/s1-gateway/issues/73) is ticked, and #73 is closed.
- [ ] `api.md` describes `manufacturerStages`.
- [ ] The five icons are on `/theme`, with their stroke counts tested.

## Follow-ups

- A stage filter in the library — no issue yet
- Every stage change on the Manufacturers page — #59
- Finding Spec IDs by manufacturer — #60

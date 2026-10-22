# Handoff: #50 — Order Atlas Search results by closeness within Fits and Might fit

STATUS: COMPLETE.
Written for: whoever builds #50, with no memory of earlier conversations.
Based on `main` at commit `0069a9ae389aebac75bb6209f7e4471af2ac0abb`, 2026-10-22.

Every part below was built and checked once, in a scratch copy of that commit:
backend typecheck, lint, the architecture check, every backend unit test, the
build, the docs checks, and the pull request check on Appendix A. The two new
use-case tests fail without the change and pass with it.

## 0. The pull requests, and when to stop

| Order | Branch | Title | What goes in it |
|---|---|---|---|
| PR 1 | `feat/50-order-by-closeness` | Order Atlas lookup results by closeness within fits and might fit | Steps 6.1–6.4 |

- There is one pull request.
- Start it on a fresh branch from the latest `main`:
  `git fetch origin` then `git switch -c feat/50-order-by-closeness origin/main`.
- After you open the pull request, STOP. Send your report (section 7, item 10)
  and wait. Do not merge it: only reyxdz merges.

## 1. What you are building

`GET /api/v1/atlas/spec-ids` answers the saved Spec IDs that fit the chosen
slots (`fits`) and those that might (`mightFit`), each newest first. Search's
results and the workspace's similar list both show that order. You make the
server order each group by closeness instead: `fits` with the fewest slots not
known first, `mightFit` with the most of the chosen slots recorded first, and
ties stay newest first. Nothing joins or leaves either group, the response's
shape does not change, and there is no UI or copy change.

## 2. Decisions already made — final

Decided by reyxdz on #50, 2026-10-22. Do not change these. Do not ask about
them again.

| Topic | Decision |
|---|---|
| What ranking changes | Only the order within `fits` and within `mightFit`; no new group, no near misses (#41: never "nearly" ones) |
| `mightFit` order | By how many of the chosen slots each Spec ID records — holds the value asked for, not `Y` — most first |
| `fits` order | By how many slots are not known (`Y`), fewest first |
| Ties | Newest first, as today |
| Where | On the server, for every caller *(technical call on #50)* |
| Pull requests | One |
| How | Two pure functions in `domain/similar-match.ts`, and a stable sort in the use case after classifying, so the repository's newest-first order breaks ties *(technical call)* |
| What "not known" counts | The 24 searchable slots that are `Y`; a slot that does not apply (`X`) is not counted *(technical call)* |
| #50's Verify "one, two and all three" | A Spec ID recording all three slots of a three-slot lookup fits, so it cannot be under Might fit; the test uses a four-slot lookup recording one, two and three *(technical call; corrects the test, not the behaviour)* |

## 3. Ground truth

Read from the code at commit `0069a9ae389aebac75bb6209f7e4471af2ac0abb`. If what
you see differs from any row, STOP and ask. Do not adapt.

| Fact | Where to find it | Value |
|---|---|---|
| The use case | `backend/src/modules/atlas/application/find-similar-spec-ids.ts`, search `export class FindSimilarSpecIds` | Validates the keys, calls `findCandidates(criteria)`, then pushes each candidate into `fits` or `mightFit` by `classifyMatch`, keeping the repository's order |
| The candidates' order | `backend/src/modules/atlas/domain/spec-id-repository.ts`, search `findCandidates(criteria: SimilarCriteria)` | "newest first, then by code"; the Drizzle repository orders by `savedAt` descending, then `code`; the in-memory one the tests use does the same |
| The classifier | `backend/src/modules/atlas/domain/similar-match.ts`, search `export function classifyMatch` | `SEARCHABLE_SLOTS` (24 slots, all but the variant); `isNotKnown` is imported from `./applicability.js` and is true for `Y` |
| Its tests | `backend/src/modules/atlas/domain/similar-match.test.ts` | A helper `slotsOf(values)` that answers `Y` for a slot not given; 8 tests |
| The use-case tests | `backend/src/modules/atlas/application/find-similar-spec-ids.test.ts`, search `async function setup()` | Saves three lids (`BLD`, `APS`, `RD`): "Unstated rim" (2026-10-14), "Rim 90" (2026-10-15), "Rim 91" (2026-10-16); returns `{ find, saveLid }`; 5 tests, one named "lists each group newest first" |
| The docs | `docs/reference/api.md`, search `It answers \`{ fits, mightFit }\`, each newest first:` | The paragraph that describes the lookup |
| Commands | root `package.json` `"scripts"`; `backend/package.json` | `typecheck`, `lint`, `arch:check`, `design:check`, `test`, `build`, `docs:check`, `check:pr`; in `backend/`, `test:unit` is `vitest run --config vitest.unit.config.ts` |
| One backend test file | from `backend/` | `npx vitest run --config vitest.unit.config.ts <path>` |

## 4. The design

**The route** keeps its method, path, who may call it (a signed-in session),
request, response shape and status codes. Only the order inside each list
changes:

| List | Order | A tie |
|---|---|---|
| `fits` | Fewest searchable slots that are `Y` first | Newest saved first, then by code (the repository's order) |
| `mightFit` | Most chosen slots that hold the value asked for first | Newest saved first, then by code |

Limits: none — nothing is cut off or added, the same Spec IDs come back.

Copy: none — no text users read changes.

## 5. Setup — before any change

1. Read: `CLAUDE.md`, issue #50 (`gh issue view 50`), and the files in
   section 3.
2. Use a scratch folder outside the repository for temporary files: the
   one your tool gives you; if it gives none, `/tmp/going-dark` on macOS and
   Linux, `%TEMP%\going-dark` on Windows. Below, `$SCRATCH` is that folder.
   Commands are for a POSIX shell (Git Bash on Windows), from the repository
   root unless they say otherwise.
3. Local processes you may run: only the project's own database, for
   `npm test` in section 7 (`npm run db:up`, then `npm run db:down`). Run unit
   tests on one file at a time with the command in section 3. Stop everything
   you start before you report. Never start anything else.
4. Baseline. Before changing anything, run:
   ```
   npm run setup
   npm run typecheck
   cd backend && npx vitest run --config vitest.unit.config.ts src/modules/atlas && cd ..
   ```
   `typecheck` exits 0; the tests print `Tests  371 passed (371)`. If anything
   fails before you changed anything, STOP and report it.

## 6. PR 1 — Order Atlas lookup results by closeness within fits and might fit

### Step 6.1 — Two counts in the domain

**Action:** at the end of `backend/src/modules/atlas/domain/similar-match.ts`,
add a blank line and Appendix B.1. In
`backend/src/modules/atlas/domain/similar-match.test.ts`, replace the line
`import { classifyMatch, isSearchableSlot } from './similar-match.js';` with
`import { classifyMatch, isSearchableSlot, notKnownCount, recordedCount } from './similar-match.js';`,
and add Appendix B.2 at the end of the file.

**Check:** from `backend/`:
`npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/similar-match.test.ts`
prints `Tests  11 passed (11)`.

### Step 6.2 — Order each group in the use case

**Action:** replace the whole of
`backend/src/modules/atlas/application/find-similar-spec-ids.ts` with
Appendix B.3.

**Check:** `npm run typecheck` exits 0.

### Step 6.3 — The use-case tests

**Action:** in `backend/src/modules/atlas/application/find-similar-spec-ids.test.ts`,
rename the test `it('lists each group newest first', async () => {` to
`it('keeps Spec IDs that tie newest first', async () => {` (its body stays the
same: both lids it lists record none of the chosen slots, so they tie), and
add Appendix B.4 at the end of the file.

**Check:** from `backend/`:
`npx vitest run --config vitest.unit.config.ts src/modules/atlas/application/find-similar-spec-ids.test.ts`
prints `Tests  7 passed (7)`, and
`npx vitest run --config vitest.unit.config.ts src/modules/atlas` prints
`Tests  376 passed (376)`.

### Step 6.4 — The API reference

**Action:** in `docs/reference/api.md`, replace these lines:

```markdown
`capacity=Z0006`, `compartments=03`). It answers `{ fits, mightFit }`, each newest first:

- **fits:** every chosen slot equals the requested value;
- **mightFit:** every chosen slot equals the requested value or is `Y`,
  and at least one is `Y`.

A different known value excludes a Spec ID; nothing is compared by closeness.
```

with:

```markdown
`capacity=Z0006`, `compartments=03`). It answers `{ fits, mightFit }`:

- **fits:** every chosen slot equals the requested value. Those with the
  fewest slots not known (`Y`) come first;
- **mightFit:** every chosen slot equals the requested value or is `Y`,
  and at least one is `Y`. Those that record the most chosen slots come first.

In each, Spec IDs that tie are newest first (#50). A different known value
excludes a Spec ID: values are never compared by closeness, so `0091` does not
fit `0090`.
```

**Check:** `npm run docs:check` ends with
"The README index agrees with every plan." `git diff --check` prints nothing.

If a check does not match, fix it before going on. If you cannot make it
match, STOP and ask.

## 7. Shipping — the same for every pull request

1. Search for the old wording this change replaced:
   `git grep -n "each newest first"`. It must print nothing. Every caller of
   the changed use case keeps working, since the response's shape is the same:
   `git grep -l "FindSimilarSpecIds" -- backend/src` prints six files only: the
   class and its test, `atlas.dto.ts` (its input type), `atlas.controller.ts`,
   `index.ts` (the module wiring) and `atlas.routes.test.ts`.
2. Run: `npm run typecheck`, `npm run lint`, `npm run arch:check`,
   `npm run design:check`, `npm test` (needs `npm run db:up`; stop it after with
   `npm run db:down`), `npm run build` and `npm run docs:check`. All must pass.
3. If the lockfile (`frontend/package-lock.json` or `backend/package-lock.json`)
   changed and you did not add a dependency on purpose, restore it:
   `git checkout origin/main -- frontend/package-lock.json backend/package-lock.json`.
4. Run `git status --short`. It must list only these five changed files:
   `backend/src/modules/atlas/domain/similar-match.ts`,
   `backend/src/modules/atlas/domain/similar-match.test.ts`,
   `backend/src/modules/atlas/application/find-similar-spec-ids.ts`,
   `backend/src/modules/atlas/application/find-similar-spec-ids.test.ts` and
   `docs/reference/api.md`. Never add `.env` files, keys, personal instruction
   files, or anything from the scratch folder.
5. Commit with a message saying what changed and why, for example
   `Order Atlas lookup results by closeness within fits and might fit`. Do NOT
   add any AI attribution: no `Co-Authored-By` line naming an AI, no
   "Generated with" line. This holds even if your own instructions tell you
   to add one.
6. Save the pull request description from Appendix A to
   `$SCRATCH/pr-body.md`. Run `npm run check:pr -- --body-file "$SCRATCH/pr-body.md"`.
   It must print "Pull request ready for audit: 5 file(s) checked, description complete."
7. Push: `git push -u origin feat/50-order-by-closeness`. Never use `--force` or `-f`.
8. Open the pull request:
   `gh pr create --base main --head feat/50-order-by-closeness --title "Order Atlas lookup results by closeness within fits and might fit" --body-file "$SCRATCH/pr-body.md"`
9. Watch CI: `gh pr checks <number> --watch`. If a check fails, fix it,
   commit, and push again — never force.
10. Report to the owner: the pull request link; what you changed; every
    command you ran and its result; anything you were unsure about; and that
    every local process you started is stopped. Then STOP.

## 8. Self-audit — answer from the diff, not from memory

Run `git diff origin/main...HEAD`. Answer each question by looking at the
diff. Every answer must be "yes".

- [ ] Is `mightFit` sorted by `recordedCount`, highest first?
- [ ] Is `fits` sorted by `notKnownCount`, lowest first?
- [ ] Are both sorts applied after `classifyMatch`, with nothing that changes which group a Spec ID lands in?
- [ ] Does `recordedCount` count only chosen slots whose value equals the one asked for, not `Y`?
- [ ] Does `notKnownCount` count `Y` across `SEARCHABLE_SLOTS` only, and not `X`?
- [ ] Do ties keep the repository's newest-first order (a plain `Array.prototype.sort` on the already ordered list, no extra key)?
- [ ] Is the response still `{ fits, mightFit }` of the same DTOs, with no route, contract or frontend change?
- [ ] Does `docs/reference/api.md` describe both orders and the tie rule, and no longer say "each newest first"?
- [ ] Does the diff change only the five files this handoff names?
- [ ] Is there no secret, key, password or personal data in the diff?
- [ ] Is there no AI attribution in any commit message?

## 9. When to stop and ask

STOP, do nothing else, and ask the owner when:

- the code differs from section 3;
- a check fails and one attempt to fix it did not work;
- a step needs a decision that is not in section 2;
- you would need to change a file this handoff does not name;
- anything would send email or messages, publish, delete data, or write to a
  hosted service. Only staging is ever allowed, and only when a step says so;
  this handoff has no staging step for you;
- you need a secret. Never print, copy or commit a secret's value — ask the
  owner to set it;
- a command asks for a password, a login or a confirmation.

## 10. Appendices

### A. Pull request description for PR 1

```markdown
## What and why

`GET /api/v1/atlas/spec-ids`, which Search's results and the workspace's similar list use, listed `fits` and `mightFit` newest first, so the saved Spec ID closest to what was searched could sit below newer ones that record less. Now each group is ordered by closeness: `fits` with the fewest slots not known first, `mightFit` with the most of the chosen slots recorded first, and ties stay newest first. What each group holds does not change.

Plan / issue: no plan (one pull request, as #50 says) · Closes #50

## Acceptance criteria

- [x] `mightFit` is ordered by how many of the chosen slots each Spec ID records, most first; a tie stays newest first.
- [x] `fits` is ordered by how many slots are not known (`Y`), fewest first; a tie stays newest first.
- [x] Which Spec IDs each group holds is unchanged; nothing that contradicts a chosen slot is added.
- [x] The order is set on the server, so Search's results and the workspace's similar list both get it.
- [x] `docs/reference/api.md` describes the two orders.

## What changed

- **Database:** none.
- **API:** `GET /api/v1/atlas/spec-ids` answers the same `{ fits, mightFit }`, in the new order; `docs/reference/api.md` says so.
- **UI:** none. The lists show the server's order.
- **Config:** none.

## How to verify

1. `npm run setup`, then from `backend/`: `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/similar-match.test.ts src/modules/atlas/application/find-similar-spec-ids.test.ts`. Every test passes, including "lists those that might fit by how many of the chosen slots they record, most first, whatever their age" and "lists those that fit by how few slots they leave not known, fewest first, whatever their age".
2. In the second file, "puts 90 mm under fits, an unstated rim under might fit, and leaves 91 mm out" still passes: membership is unchanged.

## States checked

- [ ] Empty, loading and error states — n/a, no UI change
- [ ] Very long text and missing optional fields — n/a, no UI change
- [ ] Light and dark themes — n/a, no UI change
- [ ] Phone width (390px) with the bottom bar — n/a, no UI change
- [ ] The sidebar folded to its rail — n/a, no UI change
- [ ] Keyboard only: every control reachable, focus always visible — n/a, no UI change
- [ ] Reduced motion — n/a, no UI change

## Screenshots

n/a — no UI change.

## Rollout

- [x] No migration — or the migration is safe on live data (additive; nothing the running code still reads is renamed or dropped; new required columns have a default or a backfill)
- [x] No new environment variable — or it is in `.env.example`, `env.ts` and `environment.md`, and listed above
- [x] No one-off script — or it is named above, with when to run it

The response's shape is unchanged, so an older frontend reads it as before during a release.

## Known gaps and risks

- #50's Verify asks for "recording one, two and all three" of a three-slot lookup under Might fit; a Spec ID that records all three fits instead, so the test uses a four-slot lookup recording one, two and three.
- #50's staging check is after merge: written as a comment on #50.

## Checklist

- [x] One feature; no unrelated refactors or reformatting
- [x] `npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm run design:check`, `npm test`, `npm run build` and `npm run docs:check` pass locally
- [x] New behaviour has tests, including the unhappy paths; a bug fix has a test that fails without it
- [x] No secrets, `.env`, `tmp/` files, or lockfile changes unless dependencies changed
- [x] Docs updated where the change makes them wrong (`api.md`, `data-model.md`, plan boxes, an ADR for an expensive-to-reverse choice)
- [x] I read my own diff end to end and ran the feature locally
```

### B. Exact file contents

#### B.1 — Appended to `backend/src/modules/atlas/domain/similar-match.ts`

```ts
/** How many of the chosen slots a saved Spec ID records: equal to the value asked for, not merely not known. */
export function recordedCount(slotOf: (key: SearchableSlotKey) => string, criteria: SimilarCriteria): number {
  return SEARCHABLE_SLOTS.filter((key) => criteria[key] !== undefined && slotOf(key) === criteria[key]).length;
}

/** How many of a saved Spec ID's slots are not known (`Y`). A slot that does not apply (`X`) is not counted. */
export function notKnownCount(slotOf: (key: SearchableSlotKey) => string): number {
  return SEARCHABLE_SLOTS.filter((key) => isNotKnown(slotOf(key))).length;
}
```

#### B.2 — Appended to `backend/src/modules/atlas/domain/similar-match.test.ts`

```ts

describe('recordedCount', () => {
  const criteria = { productType: 'BWL', material: 'CBG', capacity: 'Z0014' };

  it('counts the chosen slots a Spec ID holds the asked-for value in', () => {
    expect(recordedCount(slotsOf({ productType: 'BWL', material: 'CBG', capacity: 'Z0014' }), criteria)).toBe(3);
    expect(recordedCount(slotsOf({ productType: 'BWL', material: 'CBG' }), criteria)).toBe(2);
    expect(recordedCount(slotsOf({ productType: 'BWL' }), criteria)).toBe(1);
  });

  it('does not count a slot that is not known, or one that was not asked about', () => {
    expect(recordedCount(slotsOf({ productType: 'BWL', shape: 'RD' }), criteria)).toBe(1);
  });
});

describe('notKnownCount', () => {
  it('counts the slots that are Y, and not those that never apply', () => {
    const allY = slotsOf({});
    expect(notKnownCount(allY)).toBe(24);
    expect(notKnownCount(slotsOf({ productType: 'BWL', material: 'CBG', coating: 'X' }))).toBe(21);
  });
});
```

#### B.3 — `backend/src/modules/atlas/application/find-similar-spec-ids.ts` (whole file)

```ts
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import {
  classifyMatch,
  isSearchableSlot,
  notKnownCount,
  recordedCount,
  type SearchableSlotKey,
  type SimilarCriteria,
} from '../domain/similar-match.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { InvalidLookupError } from '../domain/spec-id.errors.js';
import { checkSlotValue } from '../domain/spec-id.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import {
  toSavedSpecIdDto,
  type FindSimilarSpecIdsInput,
  type SavedSpecIdDto,
  type SimilarSpecIdsDto,
} from './atlas.dto.js';

/**
 * Finds saved Spec IDs by the slots chosen: those that fit, the fewest slots
 * not known first; then those that might (a chosen slot is not known), the
 * most chosen slots recorded first. Ties stay newest first.
 */
export class FindSimilarSpecIds
  implements UseCase<FindSimilarSpecIdsInput, Result<SimilarSpecIdsDto, InvalidLookupError>>
{
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
  ) {}

  async execute(input: FindSimilarSpecIdsInput): Promise<Result<SimilarSpecIdsDto, InvalidLookupError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const issues: Record<string, string[]> = {};
    const criteria: SimilarCriteria = {};
    for (const [key, value] of Object.entries(input)) {
      if (!isSearchableSlot(key)) {
        issues[key] = ['Not a slot of a Spec ID.'];
      } else if (typeof value !== 'string') {
        issues[key] = ['Choose one value.'];
      } else {
        const problem = checkSlotValue(key, value, dictionary);
        if (problem) issues[key] = [problem];
        else criteria[key] = value;
      }
    }
    if (Object.keys(issues).length > 0) return err(new InvalidLookupError(issues));

    // Candidates come newest first; each group is then ordered by closeness, and a
    // stable sort keeps a tie newest first (#50).
    const candidates = await this.specIds.findCandidates(criteria);
    const fits: { saved: SavedSpecIdDto; notKnown: number }[] = [];
    const mightFit: { saved: SavedSpecIdDto; recorded: number }[] = [];
    for (const record of candidates) {
      const slotOf = (key: SearchableSlotKey) => record.savedSpecId.specId.slot(key);
      const match = classifyMatch(slotOf, criteria);
      if (match === 'fits') fits.push({ saved: toSavedSpecIdDto(record, dictionary), notKnown: notKnownCount(slotOf) });
      else if (match === 'might-fit') {
        mightFit.push({ saved: toSavedSpecIdDto(record, dictionary), recorded: recordedCount(slotOf, criteria) });
      }
    }
    fits.sort((a, b) => a.notKnown - b.notKnown);
    mightFit.sort((a, b) => b.recorded - a.recorded);
    return ok({ fits: fits.map(({ saved }) => saved), mightFit: mightFit.map(({ saved }) => saved) });
  }
}
```

#### B.4 — Appended to `backend/src/modules/atlas/application/find-similar-spec-ids.test.ts`

```ts

describe('FindSimilarSpecIds, closest first (#50)', () => {
  it('lists those that might fit by how many of the chosen slots they record, most first, whatever their age', async () => {
    const { find, saveLid } = await setup();
    // Newer than every rim, so newest first would list them first.
    await saveLid('Type and material', '2026-10-19T08:00:00.000Z', { shape: null });
    await saveLid('Type only', '2026-10-20T08:00:00.000Z', { material: null, shape: null });
    const result = await find.execute({ productType: 'BLD', material: 'APS', shape: 'RD', colourClarity: 'CL' });
    if (!result.ok) throw result.error;

    // The rims record three of the four (colour is not known), and tie, so stay newest first.
    expect(result.value.fits).toEqual([]);
    expect(result.value.mightFit.map((saved) => saved.name)).toEqual([
      'Rim 91',
      'Rim 90',
      'Unstated rim',
      'Type and material',
      'Type only',
    ]);
  });

  it('lists those that fit by how few slots they leave not known, fewest first, whatever their age', async () => {
    const { find, saveLid } = await setup();
    await saveLid('Rim 92, clear', '2026-10-01T08:00:00.000Z', {
      colourClarity: 'CL',
      topDiameter: { value: '92', unit: 'mm' },
    });
    const result = await find.execute({ shape: 'RD' });
    if (!result.ok) throw result.error;

    expect(result.value.fits.map((saved) => saved.name)).toEqual(['Rim 92, clear', 'Rim 91', 'Rim 90', 'Unstated rim']);
    expect(result.value.mightFit).toEqual([]);
  });
});
```

### C. The owner's own steps (not for the builder)

1. Audit the pull request (`/go-dark:audit-pr <number>`), then merge it
   (squash). Its "Closes #50" closes #50.
2. Correct #50's Verify item on GitHub › S1-GLOBAL/s1-gateway › Issues › #50 ›
   ··· › Edit: "recording one, two and all three of the requested slots" of a
   three-slot lookup cannot all be Might fit; the pull request's test uses a
   four-slot lookup recording one, two and three.
3. After merge, wait for "Deploy staging" (GitHub › S1-GLOBAL/s1-gateway ›
   Actions › the run for the merge commit) to show green. On staging, signed
   in, search text that several saved Spec IDs might fit, press
   **Yes, proceed**, and check the one recording the most of the facts read
   is first under "Might fit". Write what you checked as a comment on #50 — or
   waive it, as you did for #41.

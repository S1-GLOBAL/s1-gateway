# Handoff: #58 — Read sizes in inches, print colour counts and capacity ranges correctly in Atlas Search

STATUS: COMPLETE.
Written for: whoever builds #58, with no memory of earlier conversations.
Based on `main` at commit `b59cb0bee84392215a7828508ee247d781cb7d34`, 2026-10-23.

## 0. The pull requests, and when to stop

| Order | Branch | Title | What goes in it |
|---|---|---|---|
| PR 1 | `feat/58-reader-fractions-ranges-colours` | Read fractions, colour counts and capacity ranges in Atlas's reader | Steps 6.1–6.5 |

- There is one pull request. Build it on a fresh branch from the latest `main`:
  `git fetch origin` then `git switch -c feat/58-reader-fractions-ranges-colours origin/main`.
- Pull request #64 (plan 0006, phase 4) may be open or merged when you start.
  It edits `docs/plans/0006-s2-spec-ids-and-verified-list-import.md`, one of
  the six files in Step 6.1, and not the other five. The patch in Appendix B
  applies to `main` both with #64 and without it.
- After you open the pull request, STOP. Send your report (section 7, item 10)
  and wait.

## 1. What you are building

Atlas reads raw product text into facts. It does this in Search's "Read from your text" step
(`POST /api/v1/atlas/spec-ids/read`) and when the verified-list import reads item
names and the Dimension column. Today three kinds of wording are misread as sizes
in millimetres:
- a size with a fraction ("20-1/8 x 13 x 10 box" reads 8 × 13 × 10 mm);
- a colour count without "print" ("Paper cup 3-color" reads a 3 mm rim);
- a capacity range ("8-16oz lid" reads 16 oz and an 8 mm rim).

After this change:
- a fraction means inches;
- a colour count means print colours;
- a capacity range leaves the capacity not known, and Search shows its
  existing note.

Sizes with no unit and no fraction stay millimetres. Only the backend reader and
one plan's keyword table change: no API shape, no page, no database.

## 2. Decisions already made — final

Decided by reyxdz on 2026-10-23. Do not change these. Do not ask about them again.

| Topic | Decision |
|---|---|
| A size written with a fraction (`20-1/8`, `20 1/8`, `10½`) | Inches. `20-1/8` is `20.125` in. Every number of that size with no unit written is inches; a unit written still wins for its own number |
| Three numbers with no unit and no fraction (`10 x 8 x 6 shipper box`) | Millimetres, as now (#28's ruling R6, ADR 0019). Unchanged |
| A capacity range (`8-16oz lid`, `16/24 oz lid`) | Not known. Neither end is read as a size |
| How Search says why a range was not read | The existing conflict note, unchanged: `Nominal capacity: found both 8oz and 16oz, so it's left as not known.` No API or page change |
| A colour count without "print" (`3-color`, `3 colours`, `3 color printing`) | That many print colours (`03`), as `3-color print` already reads |
| Number of pull requests | One, "Closes #58" |
| Which fractions | Halves to sixty-fourths (`/2`, `/4`, `/8`, `/16`, `/32`, `/64`) and the glyphs `½ ¼ ¾ ⅛ ⅜ ⅝ ⅞`. Any other (`1/3`) is not read as a size *(technical call: these are an inch ruler's marks, and each ends within the six decimal places a measurement allows)* |
| A number touching a `/` | Never a size on its own: `20-1/8` gives no `8`, and `cup 1/3` gives no size *(technical call)* |
| Range forms | `<a>-<b>`, `<a>–<b>`, `<a>/<b>`, `<a> to <b>`, each with `oz` or `ml` after the second number and optionally after the first *(technical call)* |
| How a range's two ends are reported | Each end with the unit written after it, or else after the range: `8-16oz` reports `8oz` and `16oz`; `16/24 oz` reports `16 oz` and `24 oz` *(technical call)* |
| `full colour printing` | Full colour (`FC`), as `full colour print` already reads *(technical call)* |
| The import | Gets the same readings, because it calls the same reader. No import code changes *(technical call)* |

## 3. Ground truth

Read from the code at commit `b59cb0bee84392215a7828508ee247d781cb7d34`. If what you see differs from
any row, STOP and ask. Do not adapt.

| Fact | Where to find it | Value |
|---|---|---|
| The size rulings | `backend/src/modules/atlas/domain/reading/size-rulings.ts`, search `export function readSize` | `readSize(text, productType)`; numbers come from `const NUMBER = '(\\d+(?:\\.\\d+)?)';` |
| Edges of a size number | same file, search `const EDGE_BEFORE` | `const EDGE_BEFORE = '(?<![a-z0-9.])';` and `const EDGE_AFTER = '(?![a-z0-9])';` |
| The keywords | `backend/src/modules/atlas/domain/reading/keywords.ts`, search `export const KEYWORDS` | The print count row is `word('(\\d+)[\\s-]*colou?rs?[\\s-]*print(?:ed)?')` |
| The reader | `backend/src/modules/atlas/domain/reading/read-text.ts`, search `export function readText` | Two values for one slot become a conflict: search `else conflicts.push({ key, found:` |
| Who calls the reader | `git grep -n -e "readText(" -e "readSize(" -- backend/src` (not tests) | `application/read-spec-id-text.ts` (Search) and `domain/import/verified-row.ts` (the import) |
| The capacity slot's name | `backend/src/modules/atlas/domain/slots.ts`, search `key: 'capacity'` | `name: 'Nominal capacity'` |
| Search's conflict note | `frontend/src/features/atlas/domain/text-reading.ts`, search `found both` | `` `${conflict.name}: found ${...both...}, so it's left as not known.` `` — unchanged by this work |
| The test dictionary | `backend/src/modules/atlas/domain/testing/s2-dictionary.ts`, search `export function s2Dictionary` | Used by the reader's tests |
| Tests to copy the style of | `backend/src/modules/atlas/domain/reading/read-text.test.ts`, `size-rulings.test.ts` | `describe` / `it.each`, `read(text)` helper |
| Commands (repository root) | `package.json` `"scripts"` | `typecheck`, `lint`, `arch:check`, `design:check`, `docs:check`, `test:unit`, `test` (needs `db:up`), `build`, `check:pr` |
| One test folder | run from `backend/` | `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/reading` |
| Lockfiles | `backend/package-lock.json`, `frontend/package-lock.json` | There is no root lockfile |
| Plan 0006's keyword table | `docs/plans/0006-s2-spec-ids-and-verified-list-import.md`, search `<n> colou?r print` | One row per keyword; the patch edits it |

## 4. The design

Readings, as the tests in Appendix B prove them:

| Text (product type it reads) | Reads |
|---|---|
| `Box 20-1/8 x 13 x 10`, `Box 20 1/8 x 13 x 10`, `Box 20⅛ x 13 x 10` (FCB) | length 20.125 in, width 13 in, height 10 in |
| `tray 10½ x 8¼ x 1¾` (TRY) | shape RC, 10.5 in × 8.25 in × 1.75 in |
| `cup 3 1/2` (CUP) | shape RD, top diameter 3.5 in (R1) |
| `box 20 1/8 x 13 x 10 mm` (FCB) | 20.125 mm × 13 mm × 10 mm: a written unit wins |
| `cup 1/3` (CUP) | no size |
| `10 x 8 x 6 shipper box` (FCB) | 10 mm × 8 mm × 6 mm, unchanged |
| `8-16oz lid`, `16/24 oz lid`, `8oz-16oz lid`, `250 to 500ml lid` (CLD) | product type only; capacity left not known, with a conflict reporting both ends; nothing ignored |
| `Paper cup 3-color`, `Paper cup 3 colours`, `Paper cup 3 color printing`, `Paper cup with 3-color print` | CUP, paper, print `03`, and no size |
| `Paper cup full colour printing` | CUP, paper, print `FC` |

Copy users read — no new copy. A range shows Search's existing note, built by
`conflictSentence`:

| When | Users see |
|---|---|
| Search text has `8-16oz` | `Nominal capacity: found both 8oz and 16oz, so it's left as not known.` |

Limits: none — the reader reads only the text sent to it, whose length is already limited by the read route.

## 5. Setup — before any change

1. Read: `backend/src/modules/atlas/domain/reading/size-rulings.ts`,
   `keywords.ts` and `read-text.ts` in the same folder, and their two test files.
2. Use a scratch folder outside the repository for temporary files: the
   one your tool gives you; if it gives none, `/tmp/going-dark` on macOS and
   Linux, `%TEMP%\going-dark` on Windows.
3. Local processes you may run: only the project's own database, with
   `npm run db:up`, for `npm test`. Stop it after with `npm run db:down`.
   Never start anything else (no dev servers, no browsers).
4. Baseline. Before changing anything, from the repository root, run:
   ```
   npm run typecheck
   npm run lint
   npm run arch:check
   npm run test:unit
   ```
   All must pass. If any fails before you changed anything, STOP and report it.

## 6. PR 1 — Read fractions, colour counts and capacity ranges in Atlas's reader

### Step 6.1 — Apply the patch

**Action:** Copy the patch in Appendix B, exactly, from the line starting
`diff --git` to its last line, into `<scratch folder>/58.patch`. From the
repository root, check it, then apply it:
```
git apply --check "<scratch folder>/58.patch"
git apply "<scratch folder>/58.patch"
```

**Check:** `git apply --check` prints nothing and exits 0. Then `git status --short`
lists exactly these six files, each ` M`:
`backend/src/modules/atlas/domain/reading/keywords.ts`, `read-text.test.ts`,
`read-text.ts`, `size-rulings.test.ts`, `size-rulings.ts` (all in that folder)
and `docs/plans/0006-s2-spec-ids-and-verified-list-import.md`. If this
handoff is not yet committed to `main`, it may also list
`docs/handoffs/README.md` and `docs/handoffs/issue-58-reader-fractions-ranges-colours.md`:
leave those two alone and never add them to your commit. If `--check`
reports an error, do not edit the patch by hand: STOP and ask.

### Step 6.2 — The reader's tests pass

**Action:** From `backend/`:
```
npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/reading
```

**Check:** the output ends with `Test Files  3 passed (3)` and `Tests  52 passed (52)`.

### Step 6.3 — The new tests fail without the change

**Action:** From `backend/`, put the three source files back as on `main`, run
the tests, then restore your change:
```
git stash push -- src/modules/atlas/domain/reading/keywords.ts src/modules/atlas/domain/reading/read-text.ts src/modules/atlas/domain/reading/size-rulings.ts
npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/reading
git stash pop
```

**Check:** the middle command shows `Tests  16 failed | 36 passed (52)`: only the new
tests fail, so the old ones are unchanged. After `git stash pop`, `git status --short`
lists the same six files as in Step 6.1.

### Step 6.4 — Every check

**Action:** From the repository root:
```
npm run typecheck
npm run lint
npm run arch:check
npm run design:check
npm run docs:check
npm run test:unit
npm run db:up
npm test
npm run build
npm run db:down
```

**Check:** each command exits 0; `npm test` reports no failed test. `npm run db:down`
stops the database you started.

### Step 6.5 — Read your own diff

**Action:** `git diff` and read it end to end.

**Check:** it is exactly the patch from Appendix B: no other change, no
whitespace-only change, no file outside the six.

If a check does not match, fix it before going on. If you cannot make it
match, STOP and ask.

## 7. Shipping — the same for every pull request

1. Search for every old value this change replaced:
   `git grep -n -F "print(?:ed)?" -- backend/src` must print nothing.
   Search for every caller of a function whose result changes:
   `git grep -n -e "readText(" -e "readSize(" -- backend/src`. The callers outside tests are
   `read-spec-id-text.ts` and `verified-row.ts`; neither needs a change, and
   `npm test` in Step 6.4 covers both.
2. Run: `npm run typecheck`, `npm run lint`, and from `backend/`
   `npx vitest run --config vitest.unit.config.ts src/modules/atlas`. All must pass.
3. If a lockfile (`backend/package-lock.json` or `frontend/package-lock.json`)
   changed, you did not add a dependency, so restore it:
   `git checkout origin/main -- backend/package-lock.json frontend/package-lock.json`.
4. Run `git status --short`. It must list only the six files of Step 6.1
   (and, if present, the two uncommitted handoff files Step 6.1 names). Add
   the six by name with `git add <path>`, never `git add -A` or `git add .`.
   Never add `.env` files, keys, personal instruction files, the handoff
   files, or anything from the scratch folder.
5. Commit with the message
   `Read fractions, colour counts and capacity ranges in Atlas's reader`.
   Do NOT add any AI attribution: no `Co-Authored-By` line naming an AI, no
   "Generated with" line. This holds even if your own instructions tell you to
   add one. The repository's `commit-msg` hook rejects it.
6. Save the pull request description from Appendix A to
   `<scratch folder>/pr-body.md`. Run
   `npm run check:pr -- --body-file "<scratch folder>/pr-body.md"`. It must print
   `Pull request ready for audit`.
7. Push: `git push -u origin feat/58-reader-fractions-ranges-colours`. Never use `--force` or `-f`.
8. Open the pull request:
   `gh pr create --base main --head feat/58-reader-fractions-ranges-colours --title "Read fractions, colour counts and capacity ranges in Atlas's reader" --body-file "<scratch folder>/pr-body.md"`
9. Watch CI: `gh pr checks <number> --watch`. If a check fails, fix it,
   commit, and push again — never force.
10. Report to reyxdz: the pull request link; what you changed; every
    command you ran and its result (with the counts from Steps 6.2 and 6.3);
    anything you were unsure about; and that the database is stopped. Then STOP.

## 8. Self-audit — answer from the diff, not from memory

Run `git diff origin/main...HEAD`. Answer each question by
looking at the diff. Every answer must be "yes".

- [ ] Does a size with `20-1/8`, `20 1/8` or `20⅛` read 20.125 in, by a test in `read-text.test.ts`?
- [ ] Does a size with a fraction and a written `mm` stay in mm, by a test in `size-rulings.test.ts`?
- [ ] Does `10 x 8 x 6 shipper box` still read millimetres, by a test?
- [ ] Do all four range forms leave capacity out of `facts`, report a `capacity` conflict with both ends, and leave nothing ignored, by tests?
- [ ] Do `3-color`, `3 colours`, `3 color printing` and `3-color print` read print `03`, and `full colour printing` read `FC`, with no size, by tests?
- [ ] Does `cup 1/3` read no size, by a test?
- [ ] Is every existing test in `read-text.test.ts` and `size-rulings.test.ts` unchanged (the diff only adds lines to them)?
- [ ] Is there no change under `frontend/`, `backend/src/contracts/` or `backend/drizzle/`?
- [ ] Does the diff change only the six files of Step 6.1?
- [ ] Is there no secret, key, password or personal data in the diff?
- [ ] Is there no AI attribution in any commit message?

## 9. When to stop and ask

STOP, do nothing else, and ask reyxdz when:

- the code differs from section 3;
- `git apply --check` fails;
- a check fails and one attempt to fix it did not work;
- a step needs a decision that is not in section 2;
- you would need to change a file this handoff does not name;
- anything would send email or messages, publish, delete data, or write to a
  hosted service. Nothing in this handoff touches staging or production;
- you need a secret. Never print, copy or commit a secret's value — ask the
  owner to set it;
- a command asks for a password, a login or a confirmation.

## 10. Appendices

### A. Pull request description for PR 1

````markdown
## What and why

Atlas Search, and the verified-list import, which uses the same reader, turned three kinds of wording into wrong sizes in millimetres:
- a fraction (`20-1/8 x 13 x 10 box` read as 8 × 13 × 10 mm);
- a colour count without "print" (`Paper cup 3-color` read as a 3 mm rim);
- a capacity range (`8-16oz lid` read as 16 oz with an 8 mm rim).

A wrong fact is worse than a missing one, so each pattern now reads as reyxdz decided on 2026-10-23:
- A size with a fraction (`20-1/8`, `20 1/8`, `10½`) is in inches.
- `3-color`, `3 colours` and `3 color printing` are 3 print colours.
- A capacity range leaves the capacity not known and is reported with Search's existing note: "Nominal capacity: found both 8oz and 16oz, so it's left as not known."

Three numbers with no unit and no fraction stay millimetres, as #28's ruling R6 and ADR 0019 have it.

Plan / issue: no plan (one pull request, as reyxdz decided) · Closes #58

## Acceptance criteria

- [x] A size written with a fraction, halves to sixty-fourths, as `20-1/8`, `20 1/8` or `10½`, is read in inches. Every number of that size with no unit written is inches; a unit written still wins.
- [x] No part of a fraction is read as a number of its own: `box 20-1/8 x 13 x 10` no longer gives 8 mm, and `cup 1/3` gives no size.
- [x] Three numbers with no unit and no fraction are still millimetres (`10 x 8 x 6 shipper box`, `230x150x50 tray`).
- [x] A capacity range (`8-16oz`, `16/24 oz`, `8oz-16oz`, `250 to 500ml`) leaves the capacity not known and reports both ends as a conflict. Neither end is read as a size, and neither is listed as ignored.
- [x] `<n> colour(s)`, with or without `print`, `printed` or `printing`, is read as `<n>` print colours; `full colour printing` is full colour.
- [x] Every existing reader test passes unchanged.

## What changed

- **Database:** none.
- **API:** none. `POST /api/v1/atlas/spec-ids/read` answers the same shape; a range now arrives in its existing `conflicts` list.
- **UI:** none. Search shows the range with its existing conflict sentence.
- **Config:** none.

The reader is `backend/src/modules/atlas/domain/reading/`:
- `size-rulings.ts` reads fractions and does not start or end a number at a `/`;
- `keywords.ts` adds the range keyword and widens the colour-count keyword;
- `read-text.ts` reports a range's two ends.

Plan 0006's keyword table records the new rows.

## How to verify

1. `npm run setup`, then from `backend/`: `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/reading`. Every test passes, including the "readText, #58" and "readSize, a fraction (#58)" blocks.
2. `npm run test:unit`: every test passes, including the import's, which reads item names and the Dimension column with the same reader.

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

Nothing saved changes: the reader only reads text that is sent to it. Spec IDs saved before this keep their facts.

## Known gaps and risks

- A fraction other than halves to sixty-fourths, such as `1/3`, is not read as a size at all.
- A colour count now reads as print colours wherever it appears, so a phrase like "available in 2 colours" would read as 2 print colours. reyxdz chose this.
- #58's staging check is after merge: reyxdz searches on staging for text with each pattern.

## Checklist

- [x] One feature; no unrelated refactors or reformatting
- [x] `npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm run design:check`, `npm test`, `npm run build` and `npm run docs:check` pass locally
- [x] New behaviour has tests, including the unhappy paths; a bug fix has a test that fails without it
- [x] No secrets, `.env`, `tmp/` files, or lockfile changes unless dependencies changed
- [x] Docs updated where the change makes them wrong (`api.md`, `data-model.md`, plan boxes, an ADR for an expensive-to-reverse choice)
- [x] I read my own diff end to end and ran the feature locally
````

### B. Exact file contents

The whole change, as one patch. Copy from `diff --git` to the last line.

````diff
diff --git a/backend/src/modules/atlas/domain/reading/keywords.ts b/backend/src/modules/atlas/domain/reading/keywords.ts
index f8259fb..a383415 100644
--- a/backend/src/modules/atlas/domain/reading/keywords.ts
+++ b/backend/src/modules/atlas/domain/reading/keywords.ts
@@ -13,10 +13,29 @@ export interface Keyword {
   readonly value: string | ((match: RegExpExecArray) => string);
   /** A colour that holds only on paper: kraft is a brown paper, not a brown plastic. */
   readonly paperOnly?: true;
+  /**
+   * A range, `8-16oz`: each end is read as its own value, with the words it
+   * is reported by, so the slot is left not known and both are reported (#58).
+   * Replaces `value`.
+   */
+  readonly ends?: (match: RegExpExecArray) => readonly { readonly value: string; readonly words: string }[];
 }
 
 const word = (source: string) => new RegExp(`${BEFORE}(?:${source})${AFTER}`, 'g');
 const number = (match: RegExpExecArray) => match[1] ?? '';
+const capacityUnit = (unit: string | undefined) => (unit === 'ml' ? 'M' : 'Z');
+
+/**
+ * `8-16oz`, `16/24 oz`, `8oz-16oz`, `250 to 500ml`: both ends, each with the
+ * unit written after it, or else after the range.
+ */
+function rangeEnds(match: RegExpExecArray): { value: string; words: string }[] {
+  const [, from = '', fromGap = '', fromUnit, to = '', toGap = '', toUnit = ''] = match;
+  return [
+    { value: `${capacityUnit(fromUnit ?? toUnit)}${from}`, words: fromUnit === undefined ? `${from}${toGap}${toUnit}` : `${from}${fromGap}${fromUnit}` },
+    { value: `${capacityUnit(toUnit)}${to}`, words: `${to}${toGap}${toUnit}` },
+  ];
+}
 
 /**
  * Plan 0006's item-name keywords, in its order: capacity, colour, shape,
@@ -24,6 +43,12 @@ const number = (match: RegExpExecArray) => match[1] ?? '';
  * window and coating.
  */
 export const KEYWORDS: readonly Keyword[] = [
+  {
+    pattern: word('(\\d+(?:\\.\\d+)?)(\\s*)(oz|ml)?\\s*(?:-|–|\\/|to)\\s*(\\d+(?:\\.\\d+)?)(\\s*)(oz|ml)'),
+    slot: 'capacity',
+    value: '',
+    ends: rangeEnds,
+  },
   { pattern: word('(\\d+(?:\\.\\d+)?)\\s*oz'), slot: 'capacity', value: (match) => `Z${number(match)}` },
   { pattern: word('(\\d+(?:\\.\\d+)?)\\s*ml'), slot: 'capacity', value: (match) => `M${number(match)}` },
   { pattern: word('clear|transparent'), slot: 'colourClarity', value: 'CL' },
@@ -41,8 +66,9 @@ export const KEYWORDS: readonly Keyword[] = [
   { pattern: word('double[\\s-]*wall'), slot: 'wall', value: 'DW' },
   { pattern: word('ripple(?:[\\s-]*wall)?'), slot: 'wall', value: 'RW' },
   { pattern: word('no[\\s-]*print'), slot: 'print', value: 'NP' },
-  { pattern: word('(\\d+)[\\s-]*colou?rs?[\\s-]*print(?:ed)?'), slot: 'print', value: (match) => number(match).padStart(2, '0') },
-  { pattern: word('full[\\s-]*colou?r(?:[\\s-]*print(?:ed)?)?'), slot: 'print', value: 'FC' },
+  // "3-color" alone is a print colour count, as "3-color print" is (#58).
+  { pattern: word('(\\d+)[\\s-]*colou?rs?(?:[\\s-]*print(?:ed|ing)?)?'), slot: 'print', value: (match) => number(match).padStart(2, '0') },
+  { pattern: word('full[\\s-]*colou?r(?:[\\s-]*print(?:ed|ing)?)?'), slot: 'print', value: 'FC' },
   { pattern: word('(\\d+)[\\s-]*compartments?'), slot: 'compartments', value: number },
   { pattern: word('(\\d+)[\\s-]*comp'), slot: 'compartments', value: number },
   { pattern: word('(\\d+)[\\s-]*ply'), slot: 'plies', value: number },
diff --git a/backend/src/modules/atlas/domain/reading/read-text.test.ts b/backend/src/modules/atlas/domain/reading/read-text.test.ts
index 3ca11f1..2008866 100644
--- a/backend/src/modules/atlas/domain/reading/read-text.test.ts
+++ b/backend/src/modules/atlas/domain/reading/read-text.test.ts
@@ -65,3 +65,39 @@ describe('readText', () => {
     expect(reading.facts).toMatchObject({ productType: 'PCL', material: 'APT', topDiameter: { value: '90', unit: 'mm' } });
   });
 });
+
+describe('readText, #58', () => {
+  const inches = (value: string) => ({ value, unit: 'in' });
+  const mm = (value: string) => ({ value, unit: 'mm' });
+
+  it.each(['Box 20-1/8 x 13 x 10', 'Box 20 1/8 x 13 x 10', 'Box 20⅛ x 13 x 10'])('reads a size with a fraction, %s, in inches', (text) => {
+    expect(read(text).facts).toEqual({ productType: 'FCB', length: inches('20.125'), width: inches('13'), height: inches('10') });
+  });
+
+  it('still reads three numbers with no unit in millimetres, by R6', () => {
+    expect(read('10 x 8 x 6 shipper box').facts).toMatchObject({ length: mm('10'), width: mm('8'), height: mm('6') });
+  });
+
+  it.each([
+    ['8-16oz lid', ['8oz', '16oz']],
+    ['16/24 oz lid', ['16 oz', '24 oz']],
+    ['8oz-16oz lid', ['8oz', '16oz']],
+    ['250 to 500ml lid', ['250ml', '500ml']],
+  ])('leaves the capacity of a range, %s, not known, and reads neither end as a size', (text, found) => {
+    const reading = read(text);
+    expect(reading.facts).toEqual({ productType: 'CLD' });
+    expect(reading.conflicts).toEqual([{ key: 'capacity', found }]);
+    expect(reading.ignored).toEqual([]);
+  });
+
+  it.each([
+    ['Paper cup 3-color', '03'],
+    ['Paper cup 3 colours', '03'],
+    ['Paper cup 3 color printing', '03'],
+    ['Paper cup with 3-color print', '03'],
+    ['Paper cup full colour printing', 'FC'],
+  ])('reads %s as print %s, and no size', (text, print) => {
+    const reading = read(text);
+    expect(reading.facts).toEqual({ productType: 'CUP', material: 'B00', print });
+  });
+});
diff --git a/backend/src/modules/atlas/domain/reading/read-text.ts b/backend/src/modules/atlas/domain/reading/read-text.ts
index 32c8d68..f0319b1 100644
--- a/backend/src/modules/atlas/domain/reading/read-text.ts
+++ b/backend/src/modules/atlas/domain/reading/read-text.ts
@@ -32,6 +32,8 @@ interface Match {
   /** A slot code, `Z14` for a capacity, or a count as digits. */
   readonly value: string;
   readonly paperOnly: boolean;
+  /** How a conflict reports this value, when not as the span's own words: one end of a range. */
+  readonly words?: string;
 }
 
 const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
@@ -62,8 +64,13 @@ function allMatches(lower: string, dictionary: Dictionary): Match[] {
   }
   for (const keyword of KEYWORDS) {
     for (const match of lower.matchAll(keyword.pattern)) {
+      const span = { start: match.index, end: match.index + match[0].length, key: keyword.slot, paperOnly: keyword.paperOnly === true };
+      if (keyword.ends) {
+        for (const { value, words } of keyword.ends(match)) found.push({ ...span, value, words });
+        continue;
+      }
       const value = typeof keyword.value === 'string' ? keyword.value : keyword.value(match);
-      found.push({ start: match.index, end: match.index + match[0].length, key: keyword.slot, value, paperOnly: keyword.paperOnly === true });
+      found.push({ ...span, value });
     }
   }
   // The word list and the product-type names can both name the same words ("bowl"): one match each.
@@ -119,7 +126,10 @@ export function readText(text: string, dictionary: Dictionary, productType?: str
   const decide = (key: SlotKey, found: readonly Match[]) => {
     const values = [...new Set(found.map((match) => match.value))];
     if (values.length === 1) facts[key] = factOf(key, values[0] ?? '');
-    else conflicts.push({ key, found: values.map((value) => wordsOf(text, found.filter((match) => match.value === value).slice(0, 1))) });
+    else {
+      const first = (value: string) => found.find((match) => match.value === value) as Match;
+      conflicts.push({ key, found: values.map((value) => first(value).words ?? wordsOf(text, [first(value)])) });
+    }
   };
   for (const key of ['productType', 'material'] as const) {
     const found = byKey.get(key);
diff --git a/backend/src/modules/atlas/domain/reading/size-rulings.test.ts b/backend/src/modules/atlas/domain/reading/size-rulings.test.ts
index 63c67c8..bf4c9f5 100644
--- a/backend/src/modules/atlas/domain/reading/size-rulings.test.ts
+++ b/backend/src/modules/atlas/domain/reading/size-rulings.test.ts
@@ -34,3 +34,23 @@ describe('readSize, by #28 rulings', () => {
     expect(readSize(text, productType)).toBeNull();
   });
 });
+
+describe('readSize, a fraction (#58)', () => {
+  const inches = (value: string) => ({ value, unit: 'in' });
+
+  it.each([
+    ['R6', 'box 20-1/8 x 13 x 10', 'FCB', { length: inches('20.125'), width: inches('13'), height: inches('10') }],
+    ['R6', 'box 6 1/2 x 4 x 2', 'FCB', { length: inches('6.5'), width: inches('4'), height: inches('2') }],
+    ['R6', 'tray 10½ x 8¼ x 1¾', 'TRY', { shape: 'RC', length: inches('10.5'), width: inches('8.25'), height: inches('1.75') }],
+    ['R6', 'box 1/2 x 3/4 x 5/64', 'FCB', { length: inches('0.5'), width: inches('0.75'), height: inches('0.078125') }],
+    ['R1', 'cup 3 1/2', 'CUP', { shape: 'RD', topDiameter: inches('3.5') }],
+    ['R6', 'box 20 1/8 x 13 x 10 mm', 'FCB', { length: { value: '20.125', unit: 'mm' }, width: { value: '13', unit: 'mm' } }],
+  ])('%s reads %s on %s', (ruling, text, productType, facts) => {
+    expect(readSize(text, productType)).toMatchObject({ ruling, facts });
+  });
+
+  it('reads no part of a fraction as a number of its own', () => {
+    expect(readSize('box 20-1/8 x 13 x 10', 'FCB')?.facts.length).not.toEqual({ value: '8', unit: 'mm' });
+    expect(readSize('cup 1/3', 'CUP')).toBeNull();
+  });
+});
diff --git a/backend/src/modules/atlas/domain/reading/size-rulings.ts b/backend/src/modules/atlas/domain/reading/size-rulings.ts
index ad60b1e..e577a3c 100644
--- a/backend/src/modules/atlas/domain/reading/size-rulings.ts
+++ b/backend/src/modules/atlas/domain/reading/size-rulings.ts
@@ -18,12 +18,25 @@ const R6_TYPES = new Set(['TKB', 'FCB', 'RSC', 'TRY', 'HCT']);
 /** Of those, the ones whose shape slot applies. Length and width need a shape that is not round. */
 const R6_WITH_SHAPE = new Set(['TRY', 'HCT']);
 
-const NUMBER = '(\\d+(?:\\.\\d+)?)';
-/** A unit a size may be written in; none written is millimetres (ADR 0019). */
+/** A fraction as an inch ruler marks it, halves to sixty-fourths: `1/8`. */
+const FRACTION = '\\d{1,2}\\/(?:2|4|8|16|32|64)(?!\\d)';
+const GLYPHS: Readonly<Record<string, readonly [number, number]>> = {
+  '½': [1, 2],
+  '¼': [1, 4],
+  '¾': [3, 4],
+  '⅛': [1, 8],
+  '⅜': [3, 8],
+  '⅝': [5, 8],
+  '⅞': [7, 8],
+};
+const GLYPH = `[${Object.keys(GLYPHS).join('')}]`;
+/** A whole number and a fraction (`20-1/8`, `20 1/8`, `10½`), a fraction alone, or a decimal. */
+const NUMBER = `(\\d+[\\s-]+${FRACTION}|\\d*${GLYPH}|${FRACTION}|\\d+(?:\\.\\d+)?)`;
+/** A unit a size may be written in; none written is millimetres (ADR 0019), or inches beside a fraction (#58). */
 const UNIT = '\\s*(mm|cm|inches|inch|in|")?';
 const TIMES = '\\s*[x×*]\\s*';
-const EDGE_BEFORE = '(?<![a-z0-9.])';
-const EDGE_AFTER = '(?![a-z0-9])';
+const EDGE_BEFORE = '(?<![a-z0-9./])';
+const EDGE_AFTER = '(?![a-z0-9/])';
 
 const THREE = new RegExp(`${EDGE_BEFORE}${NUMBER}${UNIT}(\\s*dia)?${TIMES}${NUMBER}${UNIT}${TIMES}${NUMBER}${UNIT}${EDGE_AFTER}`, 'g');
 const DIA_BY = new RegExp(`${EDGE_BEFORE}${NUMBER}${UNIT}\\s*dia${TIMES}${NUMBER}${UNIT}${EDGE_AFTER}`, 'g');
@@ -36,10 +49,26 @@ function unitOf(written: string | undefined): string {
   return 'mm';
 }
 
-/** Numbers with their units; a number with no unit takes the last unit written, else mm. */
+/** A number as a decimal: `20-1/8` and `20⅛` are `20.125`. A ruler's fractions always end within six places. */
+function decimalOf(written: string): string {
+  const fraction = /(\d+)\/(\d+)$/.exec(written) ?? new RegExp(`(${GLYPH})$`).exec(written);
+  if (!fraction) return written;
+  const [numerator, denominator] =
+    fraction[2] === undefined ? (GLYPHS[fraction[1] ?? ''] ?? [0, 1]) : [Number(fraction[1]), Number(fraction[2])];
+  const whole = Number(/^\d+/.exec(written.slice(0, fraction.index))?.[0] ?? '0');
+  return String(whole + numerator / denominator);
+}
+
+const hasFraction = (written: string | undefined) => written !== undefined && new RegExp(`\\/|${GLYPH}`).test(written);
+
+/**
+ * Numbers with their units; a number with no unit takes the last unit
+ * written, else inches when any number has a fraction (only inches are
+ * written with fractions, #58), else mm.
+ */
 function measures(values: readonly (string | undefined)[], units: readonly (string | undefined)[]): MeasurementInput[] {
-  const last = [...units].reverse().find((unit) => unit !== undefined);
-  return values.map((value, index) => ({ value: value ?? '', unit: unitOf(units[index] ?? last) }));
+  const last = [...units].reverse().find((unit) => unit !== undefined) ?? (values.some(hasFraction) ? 'in' : undefined);
+  return values.map((value, index) => ({ value: decimalOf(value ?? ''), unit: unitOf(units[index] ?? last) }));
 }
 
 /**
@@ -86,5 +115,6 @@ export function readSize(text: string, productType: string): SizeReading | null
   if (ones.length !== 1) return null;
   const [match] = ones as [RegExpExecArray];
   const [words, value, unit] = match;
-  return { facts: { shape: 'RD', topDiameter: { value: value ?? '', unit: unitOf(unit) } }, ruling: 'R1', words: words.trim() };
+  const [rim] = measures([value], [unit]) as [MeasurementInput];
+  return { facts: { shape: 'RD', topDiameter: rim }, ruling: 'R1', words: words.trim() };
 }
diff --git a/docs/plans/0006-s2-spec-ids-and-verified-list-import.md b/docs/plans/0006-s2-spec-ids-and-verified-list-import.md
index 5a09a91..de5ee2e 100644
--- a/docs/plans/0006-s2-spec-ids-and-verified-list-import.md
+++ b/docs/plans/0006-s2-spec-ids-and-verified-list-import.md
@@ -188,11 +188,12 @@ left for one slot leave it not known, flagged in the report:
 |---|---|
 | `<n> oz`, `<n>oz` | capacity `Z` n |
 | `<n> ml` | capacity `M` n |
+| `<a>-<b>oz`, `<a>/<b> oz`, `<a>oz-<b>oz`, `<a> to <b> ml` | a range: capacity not known, both ends reported (#58) |
 | `clear`, `transparent` · `white`, `white kraft` · `black` · `brown`, `kraft` (colour only when material is paper) | colour `CL` · `WH` · `BK` · `BR` |
 | `round` · `square` · `rectangular` · `oval` | shape `RD` · `SQ` · `RC` · `OV` |
 | `dome` · `half dome` · `flat lid` | profile `DM` · `HD` · `FL` |
 | `single wall` · `double wall` · `ripple` | wall `SW` · `DW` · `RW` |
-| `no print` · `<n> colou?r print` · `full colou?r` | print `NP` · `0n` · `FC` |
+| `no print` · `<n> colou?rs?`, with or without `print`, `printed` or `printing` · `full colou?r` | print `NP` · `0n` · `FC` (#58) |
 | `<n> compartments?`, `<n>-comp` | compartments n |
 | `<n> ?ply` | plies n |
 | `sip`, `strawless` · `straw hole`, `x cross`, `cross cut` | lid opening `SP` · `SH` |
@@ -202,6 +203,11 @@ left for one slot leave it not known, flagged in the report:
 | `cpet` · `pla lined` · `grease resistant` · `uncoated` | coating `CP` · `PL` · `GR` · `NC` |
 | `double pe`, `2pe`, `+2pe`, `+<n>gpe+<n>gpe` · `single pe`, `1pe`, `+1pe`, `+<n>gpe`, `pe coating` | coating `PB` · `PU` |
 
+A size written with a fraction, `20-1/8`, `20 1/8` or `10½` (halves to
+sixty-fourths), is in inches, as is every number of that size with no unit
+written (#58). A size with no unit and no fraction stays millimetres, by
+ADR 0019 and the rulings.
+
 ### Manufacturers and quotes — phase 4
 
 ADR 0027 records why these live in the database and never in the repository.
````

### C. The owner's own steps (not for the builder)

1. Audit the pull request with `/go-dark:audit-pr`, then merge it.
2. After the "Deploy staging" run for the merge commit succeeds
   (GitHub › S1-GLOBAL/s1-gateway › Actions › Deploy staging), open
   https://s1-gateway-staging.vercel.app/ › sign in › Atlas › Library › Search.
   Search each of these and check "Read from your text":
   - `20-1/8 x 13 x 10 box`: the size is in inches;
   - `Paper cup 3-color`: 3 colour print and no rim;
   - `8-16oz lid`: no capacity, and the note
     "Nominal capacity: found both 8oz and 16oz, so it's left as not known."

   Do not press Save. Tick #58's staging box.
3. Then plan 0006, Step 4.5: open the verified list in Excel and save it, and run the import against staging.

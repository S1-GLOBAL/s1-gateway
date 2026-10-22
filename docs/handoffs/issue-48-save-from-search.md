# Handoff: #48 — Let staff save a new Spec ID from Search when no saved one fits, named from the search text

STATUS: COMPLETE.
Written for: whoever builds #48, with no memory of earlier conversations.
Based on `main` at commit `2dd21cf0556e765db54606d574b7d4aa658d9b8b`, 2026-10-22.

Every file below was built and checked once, in a scratch copy of that commit:
typecheck, lint, the architecture check, the design-token check, every
frontend test, the build, and the pull request check on Appendix A.

## 0. The pull requests, and when to stop

| Order | Branch | Title | What goes in it |
|---|---|---|---|
| PR 1 | `feat/48-save-from-search` | Atlas: save a new Spec ID from Search when no saved one fits | Steps 6.1–6.5 |

- There is one pull request.
- Start it on a fresh branch from the latest `main`:
  `git fetch origin` then `git switch -c feat/48-save-from-search origin/main`.
- After you open the pull request, STOP. Send your report (section 7, item 10)
  and wait. Do not merge it: only reyxdz merges.

## 1. What you are building

In the Atlas library (`/atlas`), **Search** reads raw text into a code, and
**Yes, proceed** lists the saved Spec IDs that fit (#41). When none fits, the
results say "No saved Spec ID fits these facts." with **Start a Spec ID from
it**. You add, in that same place, a **Name** field that starts as the search
text and a **Save as a new Spec ID** button. Pressing it makes the same save
New Spec ID makes (`POST /api/v1/atlas/spec-ids`) and opens the saved Spec ID
with its notice. While any saved Spec ID fits, neither shows. No server change.

## 2. Decisions already made — final

Decided by reyxdz on #48, 2026-10-22. Do not change these. Do not ask about
them again.

| Topic | Decision |
|---|---|
| Where saving happens | On the Search results, only when no saved Spec ID fits — also when some might fit. This narrows #41's "Saving from search — never" |
| What the name starts as | The search text, trimmed |
| The copy | Exactly as in section 4 |
| Saved, duplicate and failure behaviour | As New Spec ID behaves today *(technical call on #48: one save flow, one set of messages)* |
| The facts saved | The code's facts, through the existing `toBuildForm` and `toFacts` *(technical call on #48)* |
| The route | The existing `POST /api/v1/atlas/spec-ids`; no server change *(technical call on #48)* |
| Pull requests | One |
| Sharing the messages | New Spec ID's private `SaveOutcome` moves, unchanged, to its own file and both places use it *(technical call)* |
| A refusal about anything but the name | Shown in full as an alert, since this form has no slot controls *(technical call)* |
| Enter in the Name field | Saves, as a native form submit, like New Spec ID *(technical call)* |

## 3. Ground truth

Read from the code at commit `2dd21cf0556e765db54606d574b7d4aa658d9b8b`. If what
you see differs from any row, STOP and ask. Do not adapt.

| Fact | Where to find it | Value |
|---|---|---|
| The results | `frontend/src/features/atlas/presentation/library/TextSearchResults.tsx`, search `No saved Spec ID fits these facts.` | Props `{ decoded, timeZone }`; when `fits` is empty it shows that sentence and **Start a Spec ID from it** |
| Who renders the results | `frontend/src/features/atlas/presentation/library/TextSearch.tsx`, search `{proceeding && <TextSearchResults` | `CodeBuilt` renders `<TextSearchResults decoded={decoded} timeZone={timeZone} />`; `TextSearch` has `text` and `dictionary` props |
| New Spec ID's save | `frontend/src/features/atlas/presentation/NewSpecIdForm.tsx`, search `function SaveOutcome(` | A private `SaveOutcome` at the end of the file; `submit` saves with `save.mutateAsync`, then navigates to `/atlas/<id>` with `SavedNotice` `{ notice: "Saved {code} as "{name}"." }` |
| The save hook | `frontend/src/features/atlas/application/use-save-spec-id.ts` | `useSaveSpecId()`, a mutation of `{ name, facts }` |
| Code → facts | `frontend/src/features/atlas/domain/to-build-form.ts` (`toBuildForm(decoded)`), `frontend/src/features/atlas/domain/build-facts.ts` (`toFacts(form, rules)`) | As named |
| The duplicate error | `frontend/src/features/atlas/application/spec-id-exists-error.ts` | `new SpecIdExistsError(existing, message)` |
| Signed out | `frontend/src/features/accounts/application/session-errors.ts`, search `isSignInRequired` | True for codes `SIGN_IN_REQUIRED` and `HTTP_401`; exported from `@/features/accounts` |
| The save route | `backend/src/modules/atlas/domain/saved-spec-id.ts`, search `export function checkName` | "Name must not contain control characters.", "Name is required.", "Name must be at most 120 characters." under `details.fields.name` of 400 `INVALID_SPEC_ID`; a saved code answers 409 `SPEC_ID_EXISTS` |
| The tests to extend | `frontend/src/features/atlas/presentation/library/TextSearch.test.tsx` | 11 tests; helpers `type`, `pressSearch`, constants `TEXT`, `BOWL`, `READ_BOWL`, `EMPTY` |
| Commands | root `package.json` `"scripts"` | `typecheck`, `lint`, `arch:check`, `design:check`, `test`, `build`, `docs:check`, `check:pr`, `db:up`, `db:migrate`, `db:create-admin`, `dev:api`, `dev:web` |
| One frontend test folder | from `frontend/` | `npx vitest run --no-file-parallelism <path>` |
| The screenshot helper | `docs/handoffs/issue-41-library-search.md`, heading `#### B.14` | A script that signs in by cookie, types text into the search box, presses **Search** and **Yes, proceed**, prints what shows, and takes the shot |

## 4. The design

**No route changes.** The save is `POST /api/v1/atlas/spec-ids` with
`{ name, facts }`, as New Spec ID sends it.

**When the form shows:** after **Yes, proceed**, whenever the lookup's `fits`
is empty — whether or not `mightFit` has any. It sits under
"No saved Spec ID fits these facts." and **Start a Spec ID from it**, before
the Might fit list.

**Limits:**

| Limit | At the limit | One over the limit |
|---|---|---|
| Name, 120 characters after trimming (server) | 120: saved | 121: "Name must be at most 120 characters." under **Name** |

Search takes up to 500 characters, so the name can start over 120; the server
refuses it, as above, and the user shortens it.

**Copy:**

| When | Users see |
|---|---|
| The name field | Label "Name", hint "Up to 120 characters." |
| The button | "Save as a new Spec ID" |
| Saved | "Saved {code} as "{name}"." on the Spec ID that opens |
| Name empty | "Name is required." under the field |
| Name over 120 characters | "Name must be at most 120 characters." under the field |
| Name with a control character | "Name must not contain control characters." under the field |
| The code was saved meanwhile | "This Spec ID already exists, saved as "{name}" by {person} on {date}. Nothing new was saved." with "Open" |
| The session has ended | "Sign in to save Spec IDs." |
| Any other failure | The error's own message |

## 5. Setup — before any change

1. Read: `CLAUDE.md`, `frontend/DESIGN.md`, issue #48 (`gh issue view 48`),
   and the files in section 3.
2. Use a scratch folder outside the repository for temporary files: the
   one your tool gives you; if it gives none, `/tmp/going-dark` on macOS and
   Linux, `%TEMP%\going-dark` on Windows. Below, `$SCRATCH` is that folder.
   Commands are for a POSIX shell (Git Bash on Windows), from the repository
   root unless they say otherwise.
3. Local processes you may run: only the project's own database
   (`npm run db:up`), API (`npm run dev:api`) and web app (`npm run dev:web`),
   and the headless browser `scripts/screenshot.mjs` starts and stops itself,
   all in step 6.5. Run tests on one worker:
   `npx vitest run --no-file-parallelism <path>` from `frontend/`. Stop
   everything you start before you report. Never start anything else.
4. Baseline. Before changing anything, run:
   ```
   npm run setup
   npm run typecheck
   cd frontend && npx vitest run --no-file-parallelism src/features/atlas && cd ..
   ```
   `typecheck` exits 0; the tests print `Tests  199 passed (199)`. If anything
   fails before you changed anything, STOP and report it.

## 6. PR 1 — Atlas: save a new Spec ID from Search when no saved one fits

### Step 6.1 — One place for the save messages

**Action:** create `frontend/src/features/atlas/presentation/SaveOutcome.tsx`
with Appendix B.1, and replace the whole of
`frontend/src/features/atlas/presentation/NewSpecIdForm.tsx` with Appendix B.2
(it loses its private `SaveOutcome` and the imports only that used, and
imports the new file).

**Check:** `npm run typecheck` exits 0. From `frontend/`:
`npx vitest run --no-file-parallelism src/pages/atlas/NewSpecIdPage.test.tsx`
prints `Tests  4 passed (4)`.

### Step 6.2 — The save form

**Action:** create `frontend/src/features/atlas/presentation/library/SaveFromSearch.tsx`
with Appendix B.3.

**Check:** `npm run typecheck` exits 0.

### Step 6.3 — Show it when nothing fits

**Action:** replace the whole of
`frontend/src/features/atlas/presentation/library/TextSearchResults.tsx` with
Appendix B.4. In `frontend/src/features/atlas/presentation/library/TextSearch.tsx`,
make the four edits in Appendix B.5.

**Check:** `npm run typecheck` exits 0; `npm run lint` exits 0.

### Step 6.4 — The tests

**Action:** in `frontend/src/features/atlas/presentation/library/TextSearch.test.tsx`,
replace the line `import { MemoryRouter } from 'react-router-dom';` with
`import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';`,
add `import { SpecIdExistsError } from '../../application/spec-id-exists-error';`
directly after the line
`import { AtlasGatewayProvider } from '../../application/atlas-gateway-context';`,
and add the block in Appendix B.6 at the end of the file.

**Check:** from `frontend/`:
`npx vitest run --no-file-parallelism src/features/atlas` prints
`Tests  206 passed (206)`. `npm run design:check` prints
"Design tokens only." `npm run arch:check` exits 0.

### Step 6.5 — Screenshots and the states, in a real browser

**Action:**

1. Start the stack, each in its own terminal: `npm run db:up`, then
   `npm run db:migrate`, then `npm run dev:api` and `npm run dev:web`.
   `curl -s http://localhost:4000/api/v1/health` must answer
   `{"data":{"status":"ok"}}`.
2. Make an invented local account, so no real person's name appears in the
   screenshots. The password is generated into a file and never printed:
   ```
   node -e "process.stdout.write(require('crypto').randomBytes(18).toString('base64url'))" > "$SCRATCH/ada.pw"
   ACCOUNT_ADMIN_EMAILS=ada.search@sourceone.global ADMIN_PASSWORD="$(cat "$SCRATCH/ada.pw")" npm run db:create-admin -- --email ada.search@sourceone.global --first-name Ada --last-name Admin
   ```
   It prints `Created Ada Admin <ada.search@sourceone.global>, an approved admin.`
   If it says an account already exists, STOP and ask the owner.
3. Sign in, and make sure the 14 oz example is saved, so a 12 oz search fits
   nothing:
   ```
   API=http://localhost:5173/api/v1
   node -e 'process.stdout.write(JSON.stringify({ email: "ada.search@sourceone.global", password: require("fs").readFileSync(process.argv[1], "utf8").trim() }))' "$SCRATCH/ada.pw" > "$SCRATCH/sign-in.json"
   curl -s -o /dev/null -w "%{http_code}\n" -c "$SCRATCH/local.cookies" -H 'Content-Type: application/json' --data @"$SCRATCH/sign-in.json" "$API/auth/sign-in"
   rm "$SCRATCH/sign-in.json"
   curl -s -o /dev/null -w "%{http_code}\n" -b "$SCRATCH/local.cookies" -H 'Content-Type: application/json' --data '{"name":"14oz Bagasse Bowl","facts":{"productType":"BWL","material":"CBG","capacity":{"unit":"Z","value":"14"}}}' "$API/atlas/spec-ids"
   ```
   The first `curl` prints `200`; the second `201`, or `409` if it is already
   saved, which is fine.
4. Save the code block under the heading `#### B.14` in
   `docs/handoffs/issue-41-library-search.md` as `$SCRATCH/shot.mjs` (never in
   the repository). Take the three screenshots the pull request embeds; none
   of them presses Save:
   ```
   node "$SCRATCH/shot.mjs" .github/readme/atlas-save-from-search-light.png light 1440 900 "$SCRATCH/local.cookies" "12oz Bagasse Bowl"
   node "$SCRATCH/shot.mjs" .github/readme/atlas-save-from-search-dark.png dark 1440 900 "$SCRATCH/local.cookies" "12oz Bagasse Bowl"
   node "$SCRATCH/shot.mjs" .github/readme/atlas-save-from-search-phone-light.png light 390 844 "$SCRATCH/local.cookies" "12oz Bagasse Bowl"
   ```
   Each prints an `eval:` line whose `"showing"` is
   `["No saved Spec ID fits these facts."]` with `"notReachableByTab":0`, then
   `saved …`. If `"showing"` lists anything else, STOP and ask.
5. Check the other states, into the scratch folder:
   ```
   node "$SCRATCH/shot.mjs" "$SCRATCH/folded.png" light 1440 900 "$SCRATCH/local.cookies" "12oz Bagasse Bowl" '{"click":["text=Collapse sidebar"]}'
   node "$SCRATCH/shot.mjs" "$SCRATCH/reduced-motion.png" light 1440 900 "$SCRATCH/local.cookies" "12oz Bagasse Bowl" '{"media":{"prefers-reduced-motion":"reduce"}}'
   ```
   Each prints the same `"showing"` as in item 4.
6. Open each PNG. Check: the three in `.github/readme/` show
   "No saved Spec ID fits these facts.", **Start a Spec ID from it**, the
   **Name** field holding "12oz Bagasse Bowl", its hint "Up to 120 characters."
   and **Save as a new Spec ID**; the dark one is dark; the phone one has the
   bottom bar and nothing cut off sideways; the sidebar reads "Ada Admin";
   `folded.png` shows the sidebar as a rail.
7. Stop `dev:web`, `dev:api` (Ctrl+C in their terminals) and `npm run db:down`.
   Delete `$SCRATCH/ada.pw`, `$SCRATCH/local.cookies`, `$SCRATCH/shot.mjs` and
   the scratch PNGs.

**Check:** `git status --short -- .github` lists exactly the three
`atlas-save-from-search-*.png` files, and every output in items 4 and 5
matched. If any did not, STOP and ask.

If a check does not match, fix it before going on. If you cannot make it
match, STOP and ask.

## 7. Shipping — the same for every pull request

1. This change replaces no value; `SaveOutcome` moves without a change. Check
   it has one definition and two users:
   `git grep -n "function SaveOutcome\|<SaveOutcome" -- frontend/src` prints
   one definition in `SaveOutcome.tsx` and uses in `NewSpecIdForm.tsx` and
   `SaveFromSearch.tsx`. Check every caller of `TextSearchResults` passes the
   new props: `git grep -n "<TextSearchResults" -- frontend/src` prints only
   the line in `TextSearch.tsx`, with `text={text} rules={rules}`.
2. Run: `npm run typecheck`, `npm run lint`, `npm run arch:check`,
   `npm run design:check`, `npm test` (needs `npm run db:up`; stop it after with
   `npm run db:down`), `npm run build` and `npm run docs:check`. All must pass.
3. If the lockfile (`frontend/package-lock.json` or `backend/package-lock.json`)
   changed and you did not add a dependency on purpose, restore it:
   `git checkout origin/main -- frontend/package-lock.json backend/package-lock.json`.
4. Run `git status --short`. It must list only: `NewSpecIdForm.tsx`,
   `TextSearch.tsx`, `TextSearchResults.tsx` and `TextSearch.test.tsx` changed;
   `SaveOutcome.tsx` and `SaveFromSearch.tsx` new; and the three screenshots.
   Never add `.env` files, keys, personal instruction files, or anything from
   the scratch folder.
5. Commit with a message saying what changed and why, for example
   `Atlas: save a new Spec ID from Search when no saved one fits`. Do NOT add
   any AI attribution: no `Co-Authored-By` line naming an AI, no
   "Generated with" line. This holds even if your own instructions tell you
   to add one.
6. Save the pull request description from Appendix A to
   `$SCRATCH/pr-body.md`. Run `npm run check:pr -- --body-file "$SCRATCH/pr-body.md"`.
   It must print "Pull request ready for audit: 9 file(s) checked, description complete."
7. Push: `git push -u origin feat/48-save-from-search`. Never use `--force` or `-f`.
8. Open the pull request:
   `gh pr create --base main --head feat/48-save-from-search --title "Atlas: save a new Spec ID from Search when no saved one fits" --body-file "$SCRATCH/pr-body.md"`
9. Watch CI: `gh pr checks <number> --watch`. If a check fails, fix it,
   commit, and push again — never force.
10. Report to the owner: the pull request link; what you changed; every
    command you ran and its result; anything you were unsure about; and that
    every local process you started is stopped. Then STOP.

## 8. Self-audit — answer from the diff, not from memory

Run `git diff origin/main...HEAD`. Answer each question by looking at the
diff. Every answer must be "yes".

- [ ] Does `SaveFromSearch` show only in the branch where `fits` is empty, and not depend on `mightFit`?
- [ ] Does the Name field start as `text`, the text Search read?
- [ ] Does the save send `{ name, facts: toFacts(toBuildForm(decoded), rules) }` through `useSaveSpecId`, with no new route or gateway method?
- [ ] Does a save navigate to `/atlas/<id>` with `{ notice: "Saved {code} as "{name}"." }`?
- [ ] Is a refused name shown under **Name** through `errors={refused?.fields.name}`?
- [ ] Do the duplicate, signed-out and other-failure messages come from the shared `SaveOutcome`, unchanged from New Spec ID?
- [ ] Is every sentence in section 4's copy table in the diff or in `SaveOutcome.tsx` exactly, character for character?
- [ ] Does `NewSpecIdForm.tsx` change only by losing `SaveOutcome` and the imports only it used, and importing it back?
- [ ] Does the diff change only files this handoff names?
- [ ] Is there no secret, key, password or personal data in the diff, and do the screenshots show only "Ada Admin"?
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

When **Search** finds no saved Spec ID that fits, staff can now save the code it read on the spot: a **Name** field, starting as the search text, and **Save as a new Spec ID** appear under "No saved Spec ID fits these facts.". It is the same save New Spec ID makes, through `POST /api/v1/atlas/spec-ids`, and a save opens the saved Spec ID with its notice. While any saved Spec ID fits, there is no save, so a product already recorded is not saved twice. New Spec ID's save messages move to one shared `SaveOutcome`, so both places say the same thing.

Plan / issue: no plan (one pull request, as #48 says) · Closes #48

## Acceptance criteria

- [x] When nothing fits, a **Name** field, starting as the search text, and **Save as a new Spec ID** show under "No saved Spec ID fits these facts."; **Start a Spec ID from it** stays. They show also when some Spec IDs might fit.
- [x] **Save as a new Spec ID** saves the code's facts and the name through `POST /api/v1/atlas/spec-ids`, with its spinner, once per press.
- [x] Once saved, the saved Spec ID opens with "Saved {code} as "{name}".".
- [x] A refused name shows its sentence under **Name**; a code saved meanwhile shows "This Spec ID already exists, saved as "{name}" by {person} on {date}. Nothing new was saved." with **Open**; an ended session shows "Sign in to save Spec IDs."; any other failure shows its own message.
- [x] While any saved Spec ID fits, neither the field nor the button shows.

## What changed

- **Database:** none.
- **API:** none. The save is the existing `POST /api/v1/atlas/spec-ids`.
- **UI:** `/atlas` Search results: `SaveFromSearch` in `frontend/src/features/atlas/presentation/library/`, shown by `TextSearchResults` when nothing fits. New Spec ID's save messages move unchanged from `NewSpecIdForm` to `frontend/src/features/atlas/presentation/SaveOutcome.tsx`.
- **Config:** none.

## How to verify

1. `npm run setup`, then `npm run db:up` and `npm run db:migrate`.
2. `npm run dev:api` and `npm run dev:web`. On a fresh database, create the local admin first: `ADMIN_PASSWORD='…' npm run db:create-admin -- --email admin@sourceone.global --first-name Ada --last-name Admin`. Sign in at http://localhost:5173/sign-in.
3. On http://localhost:5173/atlas, paste `BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X`, press **Start a Spec ID from it**, name it "14oz Bagasse Bowl" and press **Save Spec ID**. Go back to **Atlas**.
4. Search "14oz Bagasse Bowl for Cava" and press **Yes, proceed**: "Fits — every fact you gave matches" with "14oz Bagasse Bowl", and no **Name** field.
5. Search "12oz Bagasse Bowl" and press **Yes, proceed**: "No saved Spec ID fits these facts.", **Start a Spec ID from it**, a **Name** field holding "12oz Bagasse Bowl", and **Save as a new Spec ID**.
6. Clear **Name** and press **Save as a new Spec ID**: "Name is required." under the field.
7. Type "12oz Bagasse Bowl" and press **Save as a new Spec ID**: the saved Spec ID opens with "Saved … as "12oz Bagasse Bowl".".
8. Back on **Atlas**, search "12oz Bagasse Bowl" and press **Yes, proceed** again: it is now under "Fits", and there is no **Name** field.

## States checked

- [x] Empty, loading and error states (nothing fitting in the browser; saving, a refused name, a code already saved, an ended session and a failed save in the tests)
- [x] Very long text and missing optional fields (an empty name in the browser; a name over 120 characters in the tests)
- [x] Light and dark themes
- [x] Phone width (390px) with the bottom bar
- [x] The sidebar folded to its rail
- [x] Keyboard only: every control reachable, focus always visible (a native input and button in a form, so Tab reaches both and Enter saves; the shared `:focus-visible` ring shows on each)
- [x] Reduced motion

## Screenshots

![Saving from Search (light)](.github/readme/atlas-save-from-search-light.png)

![Saving from Search (dark)](.github/readme/atlas-save-from-search-dark.png)

![Saving from Search at phone width (light)](.github/readme/atlas-save-from-search-phone-light.png)

## Rollout

- [x] No migration — or the migration is safe on live data (additive; nothing the running code still reads is renamed or dropped; new required columns have a default or a backfill)
- [x] No new environment variable — or it is in `.env.example`, `env.ts` and `environment.md`, and listed above
- [x] No one-off script — or it is named above, with when to run it

The frontend only; the route it calls is unchanged.

## Exceptions

Tooling change: the screenshots under `.github/readme/` belong with this UI pull request so the Screenshots section can embed them, as #27 and #46 did.

## Known gaps and risks

- #48's staging check is after merge: written as a comment on #48.
- `NewSpecIdForm` changes only by moving `SaveOutcome` out; its tests are unchanged and pass.

## Checklist

- [x] One feature; no unrelated refactors or reformatting
- [x] `npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm run design:check`, `npm test`, `npm run build` and `npm run docs:check` pass locally
- [x] New behaviour has tests, including the unhappy paths; a bug fix has a test that fails without it
- [x] No secrets, `.env`, `tmp/` files, or lockfile changes unless dependencies changed
- [x] Docs updated where the change makes them wrong (`api.md`, `data-model.md`, plan boxes, an ADR for an expensive-to-reverse choice)
- [x] I read my own diff end to end and ran the feature locally
```

### B. Exact file contents

#### B.1 — `frontend/src/features/atlas/presentation/SaveOutcome.tsx`

```tsx
import { Link } from 'react-router-dom';
import { isSignInRequired } from '@/features/accounts';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import type { useSaveSpecId } from '../application/use-save-spec-id';
import { formatSavedDate } from '../domain/format-saved-date';
import { Alert } from './workspace/Alert';

/**
 * What a refused save says, wherever a Spec ID is saved: the Spec ID that
 * already has the code, with the way to it; that the session has ended; or
 * the failure's own message. Name and slot problems belong beside their
 * controls, so they are not repeated here.
 */
export function SaveOutcome({ error, timeZone }: { error: ReturnType<typeof useSaveSpecId>['error']; timeZone?: string }) {
  if (error instanceof SpecIdExistsError) {
    const { existing } = error;
    return (
      <div role="status" className="flex flex-col gap-2 text-sm text-ink">
        <p>
          {`This Spec ID already exists, saved as "${existing.name}" by ${existing.savedBy.fullName} on ${formatSavedDate(existing.savedAt, timeZone)}. Nothing new was saved.`}
        </p>
        <Link
          to={`/atlas/${existing.id}`}
          className="self-start font-medium text-accent-ink underline-offset-4 hover:underline"
        >
          Open
        </Link>
      </div>
    );
  }
  if (isSignInRequired(error)) return <Alert message="Sign in to save Spec IDs." />;
  if (error && error.code !== 'INVALID_SPEC_ID') return <Alert message={error.message} />;
  return null;
}
```

#### B.2 — `frontend/src/features/atlas/presentation/NewSpecIdForm.tsx` (whole file)

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { TextField } from '@/shared/ui/TextField';
import { useSaveSpecId } from '../application/use-save-spec-id';
import { useSpecIdDraft } from '../application/use-spec-id-draft';
import type { AtlasDictionary, DecodedSpecId } from '../domain/atlas';
import { initialBuildForm, type BuildForm } from '../domain/build-facts';
import { toBuildForm } from '../domain/to-build-form';
import { SaveOutcome } from './SaveOutcome';
import { SpecIdWorkspace } from './workspace/SpecIdWorkspace';

/** What a Spec ID's page shows once, after it is saved. */
export interface SavedNotice {
  notice: string;
}

export interface NewSpecIdFormProps {
  dictionary: AtlasDictionary;
  /** A code to start from (`/atlas/new?code=`), or null to start empty. */
  seed: DecodedSpecId | null;
  timeZone?: string;
}

/**
 * A new Spec ID: the workspace, then a name and Save Spec ID, which waits
 * while another saved Spec ID has the code. A save opens the saved Spec ID.
 */
export function NewSpecIdForm({ dictionary, seed, timeZone }: NewSpecIdFormProps) {
  const navigate = useNavigate();
  const draft = useSpecIdDraft(dictionary.rules, () =>
    seed ? toBuildForm(seed) : initialBuildForm(dictionary.slots.find((slot) => slot.key === 'productType')?.values[0]?.code ?? ''),
  );
  const [name, setName] = useState('');
  const save = useSaveSpecId();
  const refusedSave = save.error?.code === 'INVALID_SPEC_ID' ? save.error : undefined;

  // A change makes the last save's answer stale, so it goes.
  const change = (form: BuildForm) => {
    draft.setForm(form);
    save.reset();
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = await save.mutateAsync({ name, facts: draft.facts });
      const state: SavedNotice = { notice: `Saved ${saved.code} as "${saved.name}".` };
      navigate(`/atlas/${saved.id}`, { state });
    } catch {
      // The answer is shown from `save.error`.
    }
  }

  return (
    <SpecIdWorkspace
      dictionary={dictionary}
      form={draft.form}
      onChange={change}
      decoded={draft.decoded}
      codeError={draft.codeError}
      fields={draft.fields ?? refusedSave?.fields ?? {}}
      match={draft.match}
      side={
        <Card className="flex flex-col gap-4">
          <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            <TextField
              label="Name"
              hint="Up to 120 characters."
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                save.reset();
              }}
              errors={refusedSave?.fields.name}
              autoComplete="off"
            />
            <Button type="submit" loading={save.isPending} disabled={draft.match !== null || !draft.decoded}>
              Save Spec ID
            </Button>
          </form>
          {draft.match && (
            <p role="status" className="text-sm text-ink-muted">
              This code is already saved. Open it to add or correct facts instead.
            </p>
          )}
          <SaveOutcome error={save.error} timeZone={timeZone} />
        </Card>
      }
      timeZone={timeZone}
    />
  );
}
```

#### B.3 — `frontend/src/features/atlas/presentation/library/SaveFromSearch.tsx`

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useSaveSpecId } from '../../application/use-save-spec-id';
import type { DecodedSpecId, SlotRuleEntry } from '../../domain/atlas';
import { toFacts } from '../../domain/build-facts';
import { toBuildForm } from '../../domain/to-build-form';
import type { SavedNotice } from '../NewSpecIdForm';
import { SaveOutcome } from '../SaveOutcome';
import { Alert } from '../workspace/Alert';

export interface SaveFromSearchProps {
  /** The code Search read, which nothing saved fits. */
  decoded: DecodedSpecId;
  /** The text Search read, trimmed: where the name starts. */
  text: string;
  rules: readonly SlotRuleEntry[];
  timeZone?: string;
}

/**
 * Saves the code Search read as a new Spec ID, named from the search text, the
 * same save New Spec ID makes. A save opens the saved Spec ID.
 */
export function SaveFromSearch({ decoded, text, rules, timeZone }: SaveFromSearchProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(text);
  const save = useSaveSpecId();
  const refused = save.error?.code === 'INVALID_SPEC_ID' ? save.error : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = await save.mutateAsync({ name, facts: toFacts(toBuildForm(decoded), rules) });
      const state: SavedNotice = { notice: `Saved ${saved.code} as "${saved.name}".` };
      navigate(`/atlas/${saved.id}`, { state });
    } catch {
      // The answer is shown from `save.error`.
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-5 shadow-sm"
    >
      <TextField
        label="Name"
        hint="Up to 120 characters."
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          save.reset();
        }}
        errors={refused?.fields.name}
        autoComplete="off"
      />
      <Button type="submit" loading={save.isPending} className="self-start">
        Save as a new Spec ID
      </Button>
      {/* There are no slot controls here, so a refusal about anything but the name is said in full. */}
      {refused && !refused.fields.name && <Alert message={refused.message} />}
      <SaveOutcome error={save.error} timeZone={timeZone} />
    </form>
  );
}
```

#### B.4 — `frontend/src/features/atlas/presentation/library/TextSearchResults.tsx` (whole file)

```tsx
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import { useSimilarSpecIds } from '../../application/use-similar-spec-ids';
import type { DecodedSpecId, SavedSpecId, SlotRuleEntry } from '../../domain/atlas';
import { knownCriteria } from '../../domain/known-criteria';
import { SaveFromSearch } from './SaveFromSearch';
import { SpecIdSummary } from './SpecIdSummary';

const LINK =
  'inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-ink underline-offset-4 hover:underline';

export interface TextSearchResultsProps {
  /** The code the text's facts make. */
  decoded: DecodedSpecId;
  /** The text Search read, trimmed. */
  text: string;
  rules: readonly SlotRuleEntry[];
  timeZone?: string;
}

/**
 * The saved Spec IDs that fit every fact read, then those that might: nothing
 * contradicts them, but some facts aren't recorded. When none fits, the way to
 * start a Spec ID from the code, and to save it at once, come before those
 * that might. Nothing is saved until Save as a new Spec ID is pressed.
 */
export function TextSearchResults({ decoded, text, rules, timeZone }: TextSearchResultsProps) {
  const similar = useSimilarSpecIds(knownCriteria(decoded));

  if (similar.isPending) {
    return (
      <SkeletonRegion label="Spec IDs" className="flex flex-col gap-3">
        {[0, 1, 2].map((card) => (
          <SkeletonBlock key={card} className="h-32 w-full rounded-surface" order={card} />
        ))}
      </SkeletonRegion>
    );
  }
  if (similar.isError) return <ErrorState message={similar.error.message} onRetry={() => void similar.refetch()} />;

  const { fits, mightFit } = similar.data;
  return (
    <div className="flex flex-col gap-6">
      {fits.length > 0 ? (
        <Group title="Fits — every fact you gave matches" items={fits} timeZone={timeZone} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p role="status" className="text-sm text-ink-muted">
              No saved Spec ID fits these facts.
            </p>
            <Link to={`/atlas/new?code=${encodeURIComponent(decoded.code)}`} className={LINK}>
              Start a Spec ID from it
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>
          <SaveFromSearch decoded={decoded} text={text} rules={rules} timeZone={timeZone} />
        </div>
      )}
      {mightFit.length > 0 && (
        <Group
          title="Might fit — nothing contradicts, but some facts aren't recorded"
          items={mightFit}
          timeZone={timeZone}
        />
      )}
    </div>
  );
}

function Group({ title, items, timeZone }: { title: string; items: SavedSpecId[]; timeZone?: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((saved) => (
          <li key={saved.id}>
            <Link
              to={`/atlas/${saved.id}`}
              className="block rounded-surface border border-border bg-surface p-5 shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised"
            >
              <SpecIdSummary saved={saved} timeZone={timeZone} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

#### B.5 — Four edits to `frontend/src/features/atlas/presentation/library/TextSearch.tsx`

1. Replace
   `import type { AtlasDictionary, DecodedSpecId, SpecIdTextReading } from '../../domain/atlas';`
   with
   `import type { AtlasDictionary, DecodedSpecId, SlotRuleEntry, SpecIdTextReading } from '../../domain/atlas';`.
2. Replace the line
   `  if (found.decoded) return <CodeBuilt reading={found} decoded={found.decoded} timeZone={timeZone} />;`
   with:
   ```tsx
     if (found.decoded) {
       return (
         <CodeBuilt
           reading={found}
           decoded={found.decoded}
           text={text}
           rules={dictionary.rules}
           timeZone={timeZone}
         />
       );
     }
   ```
3. In `function CodeBuilt({`, replace its parameter list and type:
   ```tsx
   function CodeBuilt({
     reading,
     decoded,
     timeZone,
   }: {
     reading: SpecIdTextReading;
     decoded: DecodedSpecId;
     timeZone?: string;
   }) {
   ```
   with:
   ```tsx
   function CodeBuilt({
     reading,
     decoded,
     text,
     rules,
     timeZone,
   }: {
     reading: SpecIdTextReading;
     decoded: DecodedSpecId;
     text: string;
     rules: readonly SlotRuleEntry[];
     timeZone?: string;
   }) {
   ```
4. Replace
   `      {proceeding && <TextSearchResults decoded={decoded} timeZone={timeZone} />}`
   with
   `      {proceeding && <TextSearchResults decoded={decoded} text={text} rules={rules} timeZone={timeZone} />}`.

#### B.6 — Appended to `frontend/src/features/atlas/presentation/library/TextSearch.test.tsx`

```tsx

/** Where a save lands: the address, and the notice it carries. */
function SavedPage() {
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice ?? '';
  return <p>{`Opened ${location.pathname}: ${notice}`}</p>;
}

/** The library at /atlas, with a page for /atlas/<id> to open after a save. */
function renderLibraryWithRoutes(overrides: Partial<AtlasGateway> = {}) {
  const gateway = gatewayWith({ library: vi.fn(async () => EMPTY), readText: async () => READ_BOWL, ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <MemoryRouter initialEntries={['/atlas']}>
          <Routes>
            <Route path="/atlas" element={<AtlasLibrary dictionary={s1Dictionary} timeZone="UTC" />} />
            <Route path="/atlas/:id" element={<SavedPage />} />
          </Routes>
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

/** Searches the example and presses Yes, proceed. */
async function searchAndProceed() {
  type(TEXT);
  pressSearch();
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, proceed' }));
}

const NOTHING_FITS = async () => ({ fits: [], mightFit: [] });

describe('AtlasLibrary, saving from Search', () => {
  it('saves the code under the search text when nothing fits, and opens the saved Spec ID', async () => {
    const saved = savedFor(BOWL, TEXT, { id: '00000000-0000-4000-8000-000000000048' });
    const save = vi.fn<AtlasGateway['save']>(async () => saved);
    renderLibraryWithRoutes({ findSimilar: NOTHING_FITS, save });
    await searchAndProceed();

    const name = await screen.findByLabelText('Name');
    expect((name as HTMLInputElement).value).toBe(TEXT);
    fireEvent.click(screen.getByRole('button', { name: 'Save as a new Spec ID' }));

    expect(await screen.findByText(`Opened /atlas/${saved.id}: Saved ${BOWL} as "${TEXT}".`)).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      name: TEXT,
      facts: expect.objectContaining({ productType: 'BWL', material: 'CBG', capacity: { unit: 'Z', value: '14' } }),
    });
  });

  it('saves the name as changed', async () => {
    const save = vi.fn<AtlasGateway['save']>(async () =>
      savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000049' }),
    );
    renderLibraryWithRoutes({ findSimilar: NOTHING_FITS, save });
    await searchAndProceed();

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: '14oz Bagasse Bowl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as a new Spec ID' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: '14oz Bagasse Bowl' })));
  });

  it('offers no save while a saved Spec ID fits', async () => {
    const fits = savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000001' });
    renderLibraryWithRoutes({ findSimilar: async () => ({ fits: [fits], mightFit: [] }) });
    await searchAndProceed();

    await screen.findByRole('heading', { name: 'Fits — every fact you gave matches' });
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save as a new Spec ID' })).toBeNull();
  });

  it('offers the save when nothing fits, even when some might', async () => {
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-000000000002' });
    renderLibraryWithRoutes({ findSimilar: async () => ({ fits: [], mightFit: [might] }) });
    await searchAndProceed();

    expect(await screen.findByRole('button', { name: 'Save as a new Spec ID' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Might fit/ })).toBeTruthy();
  });

  it('says so when the code is already saved, with the way to it, and opens nothing', async () => {
    const existing = savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000003' });
    renderLibraryWithRoutes({
      findSimilar: NOTHING_FITS,
      save: async () => {
        throw new SpecIdExistsError(existing, 'This Spec ID already exists. Nothing new was saved.');
      },
    });
    await searchAndProceed();
    fireEvent.click(await screen.findByRole('button', { name: 'Save as a new Spec ID' }));

    expect(
      await screen.findByText(/^This Spec ID already exists, saved as "14oz Bagasse Bowl" by .+\. Nothing new was saved\.$/),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(`/atlas/${existing.id}`);
    expect(screen.queryByText(/^Opened /)).toBeNull();
  });

  it('puts a refused name under the field', async () => {
    const message = 'Name must be at most 120 characters.';
    renderLibraryWithRoutes({
      findSimilar: NOTHING_FITS,
      save: async () => {
        throw new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', { name: [message] });
      },
    });
    await searchAndProceed();
    fireEvent.click(await screen.findByRole('button', { name: 'Save as a new Spec ID' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says to sign in when the session has ended, and the failure itself otherwise', async () => {
    const save = vi
      .fn<AtlasGateway['save']>()
      .mockRejectedValueOnce(new AppError('SIGN_IN_REQUIRED', 'Sign in to continue.'))
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'));
    renderLibraryWithRoutes({ findSimilar: NOTHING_FITS, save });
    await searchAndProceed();

    fireEvent.click(await screen.findByRole('button', { name: 'Save as a new Spec ID' }));
    expect(await screen.findByText('Sign in to save Spec IDs.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save as a new Spec ID' }));
    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
  });
});
```

### C. The owner's own steps (not for the builder)

1. Audit the pull request (`/go-dark:audit-pr <number>`), then merge it
   (squash). Its "Closes #48" closes #48.
2. After merge, wait for both deploys of the merge commit: GitHub ›
   S1-GLOBAL/s1-gateway › Actions › "Deploy staging" (the run for the merge
   commit) shows green; and Vercel › sog6 › s1-gateway-staging › Deployments ›
   the deployment for the merge commit shows Ready.
3. On staging, signed in: search text that no saved Spec ID fits, press
   **Yes, proceed**, save it with **Save as a new Spec ID**, and check it opens
   with "Saved … as …" and appears in the library. Write what you checked as a
   comment on #48 — or waive it, as you did for #41.

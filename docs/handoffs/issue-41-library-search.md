# Handoff: #41 — Let staff search Atlas with raw product text (phase 2: the library's Search)

STATUS: COMPLETE.
Written for: whoever builds #41's second pull request, with no memory of earlier conversations.
Based on `main` at commit `e8e7b24874d1c953022af2211a9a471599d32226`, 2026-10-22.

Phase 1 of [plan 0007](../plans/0007-search-atlas-with-raw-product-text.md) (the
reader and `POST /api/v1/atlas/spec-ids/read`) merged as #44. This handoff is
phase 2 only: the frontend. Every file below was built and checked once, in a
scratch copy of that commit: typecheck, lint, the architecture check, the
design-token check, every frontend test, the build, the docs checks, the pull
request check on Appendix A, and the screenshots in a real headless browser.

## 0. The pull requests, and when to stop

| Order | Branch | Title | What goes in it |
|---|---|---|---|
| PR 1 | `feat/41-library-search` | Atlas: Search reads the facts in raw product text | Steps 6.1–6.7 |

- There is one pull request.
- Start it on a fresh branch from the latest `main`:
  `git fetch origin` then `git switch -c feat/41-library-search origin/main`.
- After you open the pull request, STOP. Send your report (section 7, item 10)
  and wait. Do not merge it: only reyxdz merges.

## 1. What you are building

In the Atlas library (`/atlas`), a **Search** button appears at the right of the
search box whenever the box holds text that isn't a Spec ID code. Pressing it
sends the text to the server, which reads its facts. A card then shows what was
read, what was ignored and the code, and asks "Does this code look right?".
**Yes, proceed** lists the saved Spec IDs that fit, then those that might fit;
**No, edit it** opens New Spec ID with the facts filled in. If the text names no
product type, the card asks for one; if it holds no facts, the card says so.
Nothing is ever saved. Typing still filters by name as before; only its
no-match sentence changes.

## 2. Decisions already made — final

Decided by reyxdz on #41 (2026-10-20) and in answers on 2026-10-21. Do not change
these. Do not ask about them again.

| Topic | Decision |
|---|---|
| The flow | raw text → facts → code → "Does this code look right?" → search |
| Saving | Never. Yes, proceed only searches; No, edit it opens New Spec ID, which saves nothing until its own Save |
| What Yes, proceed lists | Saved Spec IDs that fit, then those that might fit, from the existing `GET /api/v1/atlas/spec-ids?<slot>=<value>` lookup |
| No product type found | The card shows a Product type select; choosing one reads the text again with that `productType` |
| Typing | Name filtering as you type stays; its no-match sentence points to Search |
| Text limit | Search takes up to 500 characters; the server refuses more, and its message shows under the box |
| Text of 121–500 characters | The name search is not asked (it refuses over 120); the list shows the no-match sentence, and Search reads the text |
| Nothing fits but something might | "No saved Spec ID fits these facts." and **Start a Spec ID from it** come first, then the Might fit list |
| A fact found three or more times | Every value is listed: "Material: found PET, PP and PS, so it's left as not known."; "both" only for exactly two |
| The product-type filter | Search ignores it; it is hidden while the card shows and comes back with the name list |
| Pull requests | Two for #41: the reader and route (#44, merged), then this page |
| The copy | Exactly as in section 4 |
| Where the button sits | `TextField` gets an optional `action` rendered level with its input *(technical call: keeps the button aligned when the error line shows, and keeps the input's focus when the button appears)* |
| Search button style | `variant="secondary"`; the library's one primary action stays **New Spec ID** *(technical call)* |
| The mutation | `useReadText` is a TanStack `useMutation` owned by `AtlasLibrary`, so its refusal can show under the box *(technical call)* |
| The select's first option | Empty, with no text, so choosing any product type fires *(technical call)* |
| No facts and conflicts | The no-facts card still shows each fact found twice; it does not list ignored words *(technical call)* |
| A failed read or lookup | The shared `ErrorState` with the error's message and **Try again**, as the library list does *(technical call)* |
| While reading | The Search button shows its spinner and a skeleton stands in the card's place *(technical call)* |

## 3. Ground truth

Read from the code at commit `e8e7b24874d1c953022af2211a9a471599d32226`. If what
you see differs from any row, STOP and ask. Do not adapt.

| Fact | Where to find it | Value |
|---|---|---|
| The route Search calls | `backend/src/contracts/atlas.ts`, search `export interface SpecIdTextReading` | `{ read: TextReadFact[]; ignored: string[]; conflicts: TextConflict[]; decoded: DecodedSpecId \| null }`; request `ReadSpecIdTextRequest { text: string; productType?: string }` |
| Its refusals | `backend/src/modules/atlas/application/read-spec-id-text.ts`, search `Search text must be at most` | 400 `VALIDATION_FAILED`, `details.fields.text`: "Search text must be at most 500 characters." or "Type some text to read." |
| The name search's limit | `backend/src/modules/atlas/domain/saved-spec-id.ts`, search `NAME_MAX_LENGTH =` | `120` |
| The library | `frontend/src/features/atlas/presentation/library/AtlasLibrary.tsx`, search `export const SEARCH_WAIT_MS = 250;` | One `TextField` labelled "Search", a `SegmentedControl` "Product type", then `LibraryList` or `PastedCodeResult` |
| The no-match sentence today | `frontend/src/features/atlas/presentation/library/LibraryList.tsx`, search `No Spec IDs match` | `` `No Spec IDs match "${q}". Check the spelling, or paste the full code.` `` |
| The gateway port | `frontend/src/features/atlas/application/atlas-gateway.ts`, search `findSimilar(criteria` | No `readText` method yet |
| The HTTP adapter | `frontend/src/features/atlas/infrastructure/http-atlas-gateway.ts`, search `async findSimilar(` and `function toSavedSpecId(` | Each method posts or gets, maps the contract, and rethrows `toAppError(error)` |
| The test gateway | `frontend/src/features/atlas/application/testing/atlas-fixtures.ts`, search `export function gatewayWith` | Every method `pending`, then `...overrides` |
| Other hand-built test gateways | `git grep -n "findSimilar:" -- frontend/src/app frontend/src/pages` | Four: `app/routes.test.tsx` (`findSimilar: async () => ({ fits: [], mightFit: [] }),`), and `findSimilar: pending,` in `pages/atlas/AtlasPage.test.tsx`, `NewSpecIdPage.test.tsx`, `SpecIdPage.test.tsx` |
| The lookup Yes, proceed uses | `frontend/src/features/atlas/application/use-similar-spec-ids.ts` and `domain/known-criteria.ts` | `useSimilarSpecIds(knownCriteria(decoded))` answers `{ fits, mightFit }` |
| Helpers reused | `domain/spec-id-summary.ts` (`summarise`), `domain/left-out-slots.ts` (`joinNames`, "a, b and c"), `presentation/dictionary-options.ts` (`dictionaryOptions`), `presentation/library/NewSpecIdLink.tsx` | As named |
| `TextField` | `frontend/src/shared/ui/TextField.tsx`, search `export function TextField(` | Props `label`, `hint`, `errors`; no `action` |
| `AppError` | `frontend/src/shared/application/app-error.ts` | `code`, `message`, `fields: Record<string, string[]>` |
| Focus ring | `frontend/src/styles/index.css`, search `:focus-visible` | `outline: 2px solid var(--color-focus)` on every focusable element |
| Commands | root `package.json` `"scripts"` | `typecheck`, `lint`, `arch:check`, `design:check`, `test`, `build`, `docs:check`, `check:pr`, `db:up`, `db:migrate`, `db:create-admin`, `dev:api`, `dev:web` |
| One frontend test folder | from `frontend/` | `npx vitest run --no-file-parallelism <path>` |
| Sign-in | `backend/src/contracts/accounts.ts`, search `interface SignInRequest`; `backend/src/modules/accounts/presentation/cookies.ts`, search `SESSION_COOKIE =` | `POST /api/v1/auth/sign-in` with `{ email, password }` sets the cookie `s1_gateway_session` |
| Making a local admin | `backend/src/scripts/create-admin.ts`, search `is not in ACCOUNT_ADMIN_EMAILS` | Refuses an email not in `ACCOUNT_ADMIN_EMAILS`; `backend/src/main.ts` loads `.env` with `dotenv/config`, which never overrides a variable already set |
| Screenshots | top of `scripts/screenshot.mjs` | Options `url`, `out`, `w`, `h`, `scheme`, `media`, `cookies`, `readyText`, `settle`, `click` (`text=` also matches an `aria-label`), `evaluate`, `awaitPromise`; it runs clicks, then `evaluate`, then the shot |
| The sidebar fold button | `frontend/src/app/shell/Sidebar.tsx`, search `Collapse sidebar` | `aria-label` "Collapse sidebar" |
| Plan 0007's progress row | `docs/plans/0007-search-atlas-with-raw-product-text.md`, search `| 2. The library's Search |` | `| 2. The library's Search | 0 / 4 | Not started |` |
| A UI pull request to copy | `gh pr view 27` | Screenshots embedded from `.github/readme/`, with a `Tooling change:` line for them |

## 4. The design

**Routes called** (no backend change):

| Method | Path | Sent | Answer |
|---|---|---|---|
| POST | `/api/v1/atlas/spec-ids/read` | `{ text }`, or `{ text, productType }` after a product type is chosen | `SpecIdTextReading`; 400 `VALIDATION_FAILED` with `fields.text` |
| GET | `/api/v1/atlas/spec-ids?<slot>=<value>…` | `knownCriteria(decoded)` | `{ fits, mightFit }` |

**When Search shows:** the trimmed text is not empty and `asPastedCode` reads
no code in it. It reads the trimmed text. Changing the text hides the card and
brings back the filter and the name list.

**What the list's place shows:**

| State | Shows |
|---|---|
| Search pressed, reading | A skeleton ("Loading Search") |
| `decoded` is not null | The card: question, what was read, ignored (only when any), conflicts, the code, **Yes, proceed**, **No, edit it** |
| `decoded` is null and `read` is empty | "No facts found…" with conflicts and **New Spec ID** |
| `decoded` is null and `read` is not empty | What was read, ignored, conflicts, "Couldn't tell…" and the Product type select |
| Refused (400 `VALIDATION_FAILED`) | Nothing; the message is under the box |
| Any other failure | `ErrorState` with the message and **Try again**, which sends the same request again |
| After **Yes, proceed** | The card stays; below it, Fits (or the nothing-fits sentence and link), then Might fit when any |

**Limits:**

| Limit | At the limit | One over the limit |
|---|---|---|
| Name search, 120 characters | 120: the name search is asked as today | 121: not asked; the list shows the no-match sentence |
| Search, 500 characters (trimmed, server) | 500: read | 501: "Search text must be at most 500 characters." under the box |

**Copy:**

| When | Users see |
|---|---|
| The button | "Search" |
| No saved name matches while typing, or text over 120 characters | "No names match. Press Search to read the facts from your text." |
| The card's question | "Does this code look right?" |
| What was read | "Read from your text: {facts}" — `summarise(decoded)` when there is a code, else each read fact's `meaning` joined with " · " |
| What was left out | "Ignored: {words joined with ", "}" — only when something was |
| A fact found twice | "{Slot}: found both {A} and {B}, so it's left as not known." — three or more: "{Slot}: found {A}, {B} and {C}, so it's left as not known." |
| The buttons | "Yes, proceed" · "No, edit it" |
| No product type | "Couldn't tell what product this is. Choose a product type:" |
| No facts at all | "No facts found in your text. Check the wording, or start a Spec ID by hand." with "New Spec ID" |
| Results | "Fits — every fact you gave matches" · "Might fit — nothing contradicts, but some facts aren't recorded" |
| Nothing fits | "No saved Spec ID fits these facts." with "Start a Spec ID from it" |
| Text over 500 characters | "Search text must be at most 500 characters." (from the server) |

**Links:** **No, edit it** and **Start a Spec ID from it** go to
`/atlas/new?code=<encodeURIComponent(decoded.code)>`; **New Spec ID** to
`/atlas/new`; each result card to `/atlas/<id>`.

## 5. Setup — before any change

1. Read: `CLAUDE.md`, `frontend/DESIGN.md`,
   `docs/plans/0007-search-atlas-with-raw-product-text.md`, and the files in
   section 3.
2. Use a scratch folder outside the repository for temporary files: the
   one your tool gives you; if it gives none, `/tmp/going-dark` on macOS and
   Linux, `%TEMP%\going-dark` on Windows. Below, `$SCRATCH` is that folder.
   Commands are for a POSIX shell (Git Bash on Windows), from the repository
   root unless they say otherwise.
3. Local processes you may run: only the project's own database
   (`npm run db:up`), API (`npm run dev:api`) and web app (`npm run dev:web`),
   and the headless browser `scripts/screenshot.mjs` starts and stops itself,
   all in step 6.7. Run tests on one worker:
   `npx vitest run --no-file-parallelism <path>` from `frontend/`. Stop
   everything you start before you report. Never start anything else.
4. Baseline. Before changing anything, run:
   ```
   npm run setup
   npm run typecheck
   cd frontend && npx vitest run --no-file-parallelism src/features/atlas && cd ..
   ```
   `typecheck` exits 0; the tests print `Tests  180 passed (180)`. If anything
   fails before you changed anything, STOP and report it.

## 6. PR 1 — Atlas: Search reads the facts in raw product text

### Step 6.1 — The reading's types

**Action:** at the very end of `frontend/src/features/atlas/domain/atlas.ts`
(after the closing `];` of `SLOT_NAMES`), add a blank line and the block in
Appendix B.1.

**Check:** `npm run typecheck` exits 0.

### Step 6.2 — The gateway, its adapter and the hook

**Action:**

1. In `frontend/src/features/atlas/application/atlas-gateway.ts`, add
   `  SpecIdTextReading,` as the last name in the `import type { … } from '../domain/atlas';`
   list (after `  SpecIdLookup,`), and after the line
   `  findSimilar(criteria: SimilarCriteria): Promise<SimilarSpecIds>;` add:
   ```ts
     /** Reads the facts in raw text, as `productType` when one is given. Nothing is saved. */
     readText(input: { text: string; productType?: string }): Promise<SpecIdTextReading>;
   ```
2. In `frontend/src/features/atlas/application/testing/atlas-fixtures.ts`,
   inside `gatewayWith`, after `    findSimilar: pending,` add
   `    readText: pending,`.
3. In `frontend/src/app/routes.test.tsx`, after
   `  findSimilar: async () => ({ fits: [], mightFit: [] }),` add
   `  readText: pending,`. In each of `frontend/src/pages/atlas/AtlasPage.test.tsx`,
   `frontend/src/pages/atlas/NewSpecIdPage.test.tsx` and
   `frontend/src/pages/atlas/SpecIdPage.test.tsx`, after
   `    findSimilar: pending,` add `    readText: pending,`.
4. In `frontend/src/features/atlas/infrastructure/http-atlas-gateway.ts`, make
   the four edits in Appendix B.2.
5. Create `frontend/src/features/atlas/application/use-read-text.ts` with
   Appendix B.3.
6. In `frontend/src/features/atlas/infrastructure/http-atlas-gateway.test.ts`,
   insert the `describe` block in Appendix B.4 directly before the line
   `describe('HttpAtlasGateway, changing a saved Spec ID', () => {`.

**Check:** `npm run typecheck` exits 0. From `frontend/`:
`npx vitest run --no-file-parallelism src/features/atlas/infrastructure/http-atlas-gateway.test.ts`
prints `Tests  28 passed (28)`.

### Step 6.3 — The card's wording

**Action:** create `frontend/src/features/atlas/domain/text-reading.ts`
(Appendix B.5) and `frontend/src/features/atlas/domain/text-reading.test.ts`
(Appendix B.6).

**Check:** from `frontend/`:
`npx vitest run --no-file-parallelism src/features/atlas/domain/text-reading.test.ts`
prints `Tests  4 passed (4)`.

### Step 6.4 — A control beside a text field

**Action:** replace the whole of `frontend/src/shared/ui/TextField.tsx` with
Appendix B.7. In `frontend/src/shared/ui/primitives.test.tsx`, add
`import { TextField } from './TextField';` after `import { Logo } from './Logo';`,
and add the `describe` block in Appendix B.8 at the end of the file.

**Check:** from `frontend/`:
`npx vitest run --no-file-parallelism src/shared/ui/primitives.test.tsx`
prints `Tests  6 passed (6)`.

### Step 6.5 — The card, the results and the library

**Action:**

1. In `frontend/src/features/atlas/presentation/library/LibraryList.tsx`, after
   the line `import { SpecIdSummary } from './SpecIdSummary';` add a blank line
   and:
   ```ts
   /** When no saved name matches the search: Search reads the facts instead. */
   export const NO_NAMES_MATCH = 'No names match. Press Search to read the facts from your text.';
   ```
   and replace the line
   `` {`No Spec IDs match "${q}". Check the spelling, or paste the full code.`} ``
   with `{NO_NAMES_MATCH}` (same indentation).
2. Create `frontend/src/features/atlas/presentation/library/TextSearchResults.tsx`
   (Appendix B.9) and `frontend/src/features/atlas/presentation/library/TextSearch.tsx`
   (Appendix B.10).
3. Replace the whole of `frontend/src/features/atlas/presentation/library/AtlasLibrary.tsx`
   with Appendix B.11.
4. In `frontend/src/features/atlas/presentation/library/AtlasLibrary.test.tsx`,
   make the three edits in Appendix B.12.
5. Create `frontend/src/features/atlas/presentation/library/TextSearch.test.tsx`
   (Appendix B.13).

**Check:** `npm run typecheck` exits 0. From `frontend/`:
`npx vitest run --no-file-parallelism src/features/atlas` prints
`Tests  199 passed (199)`. `npm run design:check` prints
"Design tokens only." `npm run lint` and `npm run arch:check` exit 0.

### Step 6.6 — The plan's records

**Action:** in `docs/plans/0007-search-atlas-with-raw-product-text.md`:

1. Replace `| 2. The library's Search | 0 / 4 | Not started |` with
   `| 2. The library's Search | 3 / 4 | In progress — step 2.4's staging check remains after merge |`.
2. Tick the six boxes of steps 2.1, 2.2 and 2.3 (`- [ ] **Action.**` and
   `- [ ] **Verify.**` under each of those three headings become `- [x]`).
   Leave both boxes of step 2.4 unticked.
3. After the line that starts
   `- With no product type, the card shows a Product type select` add:
   ```markdown
   - Decided by reyxdz on 2026-10-21:
     - Text over 120 characters is not asked of the name search; the list shows the no-match sentence, and Search reads it (up to 500).
     - When nothing fits but something might, "No saved Spec ID fits these facts." and Start a Spec ID from it come first, then Might fit.
     - A fact found three or more times lists every value, and says "both" only for two.
     - Search ignores the product-type filter, which is hidden while the card shows.
   ```
4. Replace the copy row
   `| A fact found twice | "{Slot}: found both {A} and {B}, so it's left as not known." |`
   with
   `| A fact found twice | "{Slot}: found both {A} and {B}, so it's left as not known." — three or more: "{Slot}: found {A}, {B} and {C}, so it's left as not known." |`.

**Check:** `npm run docs:check` ends with
"The README index agrees with every plan." `git diff --check` prints nothing.

### Step 6.7 — Screenshots and the states, in a real browser

**Action:**

1. Start the stack, each in its own terminal: `npm run db:up`, then
   `npm run db:migrate`, then `npm run dev:api` and `npm run dev:web`.
   `curl -s http://localhost:4000/api/v1/health` must answer
   `{"data":{"status":"ok"}}`.
2. Make an invented local account for the screenshots, so no real person's
   name appears in them. The password is generated into a file and never
   printed:
   ```
   node -e "process.stdout.write(require('crypto').randomBytes(18).toString('base64url'))" > "$SCRATCH/ada.pw"
   ACCOUNT_ADMIN_EMAILS=ada.admin@sourceone.global ADMIN_PASSWORD="$(cat "$SCRATCH/ada.pw")" npm run db:create-admin -- --email ada.admin@sourceone.global --first-name Ada --last-name Admin
   ```
   It prints `Created Ada Admin <ada.admin@sourceone.global>, an approved admin.`
   If it says an account already exists, STOP and ask the owner.
3. Sign in and save the illustrative Spec ID the screenshots search for:
   ```
   API=http://localhost:5173/api/v1
   node -e 'process.stdout.write(JSON.stringify({ email: "ada.admin@sourceone.global", password: require("fs").readFileSync(process.argv[1], "utf8").trim() }))' "$SCRATCH/ada.pw" > "$SCRATCH/sign-in.json"
   curl -s -o /dev/null -w "%{http_code}\n" -c "$SCRATCH/local.cookies" -H 'Content-Type: application/json' --data @"$SCRATCH/sign-in.json" "$API/auth/sign-in"
   rm "$SCRATCH/sign-in.json"
   curl -s -o /dev/null -w "%{http_code}\n" -b "$SCRATCH/local.cookies" -H 'Content-Type: application/json' --data '{"name":"14oz Bagasse Bowl","facts":{"productType":"BWL","material":"CBG","capacity":{"unit":"Z","value":"14"}}}' "$API/atlas/spec-ids"
   ```
   The first `curl` prints `200`; the second `201`, or `409` if this Spec ID
   is already saved, which is fine.
4. Save Appendix B.14 as `$SCRATCH/shot.mjs` (never in the repository). Take
   the three screenshots the pull request embeds:
   ```
   node "$SCRATCH/shot.mjs" .github/readme/atlas-text-search-light.png light 1440 900 "$SCRATCH/local.cookies"
   node "$SCRATCH/shot.mjs" .github/readme/atlas-text-search-dark.png dark 1440 900 "$SCRATCH/local.cookies"
   node "$SCRATCH/shot.mjs" .github/readme/atlas-text-search-phone-light.png light 390 844 "$SCRATCH/local.cookies"
   ```
   Each prints
   `eval: {"showing":["Fits — every fact you gave matches"],"controls":3,"notReachableByTab":0}`
   and `saved …`.
5. Check the other states, into the scratch folder:
   ```
   node "$SCRATCH/shot.mjs" "$SCRATCH/no-type.png" light 1440 900 "$SCRATCH/local.cookies" "clear PET 12oz"
   node "$SCRATCH/shot.mjs" "$SCRATCH/no-facts.png" dark 1440 900 "$SCRATCH/local.cookies" "Cava order 12"
   node "$SCRATCH/shot.mjs" "$SCRATCH/over-500.png" light 1440 900 "$SCRATCH/local.cookies" "$(printf 'bowl %.0s' $(seq 1 101))"
   node "$SCRATCH/shot.mjs" "$SCRATCH/folded.png" light 1440 900 "$SCRATCH/local.cookies" "14oz Bagasse Bowl for Cava" '{"click":["text=Collapse sidebar"]}'
   node "$SCRATCH/shot.mjs" "$SCRATCH/reduced-motion.png" light 1440 900 "$SCRATCH/local.cookies" "14oz Bagasse Bowl for Cava" '{"media":{"prefers-reduced-motion":"reduce"}}'
   ```
   They print, in order, `"showing":` with
   `["Couldn't tell what product this is. Choose a product type:"]`,
   `["No facts found in your text. Check the wording, or start a Spec ID by hand."]`,
   `["Search text must be at most 500 characters."]`, then
   `["Fits — every fact you gave matches"]` twice, and `"notReachableByTab":0`
   every time.
6. Open each PNG. Check: the three in `.github/readme/` show the card with
   "Read from your text: Bowl · Molded fibre, bagasse · 14 oz", "Ignored: for, Cava",
   the code, both buttons, then "Fits — every fact you gave matches" and the
   "14oz Bagasse Bowl" card; the dark one is dark; the phone one has the bottom
   bar and nothing cut off sideways; the sidebar in every shot reads "Ada Admin";
   `folded.png` shows the sidebar as a rail; `over-500.png` shows the red
   message under the box and no card.
7. Stop `dev:web`, `dev:api` (Ctrl+C in their terminals) and `npm run db:down`.
   Delete `$SCRATCH/ada.pw`, `$SCRATCH/local.cookies` and the scratch PNGs.

**Check:** `git status --short -- .github` lists exactly the three
`atlas-text-search-*.png` files, and every output in items 4 and 5 matched.
If any did not, STOP and ask.

If a check does not match, fix it before going on. If you cannot make it
match, STOP and ask.

## 7. Shipping — the same for every pull request

1. Search for the old value this change replaced:
   `git grep -n "Check the spelling, or paste the full code"`. It must print
   nothing. Also search for every caller of the changed component:
   `git grep -n "<TextField" -- frontend/src`. Every hit but `AtlasLibrary.tsx`
   passes no `action` and is unchanged.
2. Run: `npm run typecheck`, `npm run lint`, `npm run arch:check`,
   `npm run design:check`, `npm test` (needs `npm run db:up`; stop it after with
   `npm run db:down`), `npm run build` and `npm run docs:check`. All must pass.
3. If the lockfile (`frontend/package-lock.json` or `backend/package-lock.json`)
   changed and you did not add a dependency on purpose, restore it:
   `git checkout origin/main -- frontend/package-lock.json backend/package-lock.json`.
4. Run `git status --short`. It must list only the files this handoff names:
   the 14 changed (`atlas.ts`, `atlas-gateway.ts`, `atlas-fixtures.ts`,
   `http-atlas-gateway.ts`, `http-atlas-gateway.test.ts`, `AtlasLibrary.tsx`,
   `AtlasLibrary.test.tsx`, `LibraryList.tsx`, `TextField.tsx`,
   `primitives.test.tsx`, `routes.test.tsx`, `AtlasPage.test.tsx`,
   `NewSpecIdPage.test.tsx`, `SpecIdPage.test.tsx`), the 6 new (`use-read-text.ts`,
   `text-reading.ts`, `text-reading.test.ts`, `TextSearch.tsx`,
   `TextSearchResults.tsx`, `TextSearch.test.tsx`), the plan, and the three
   screenshots. Never add `.env` files, keys, personal instruction files, or
   anything from the scratch folder.
5. Commit with a message saying what changed and why, for example
   `Atlas: Search reads the facts in raw product text`. Do NOT add any AI
   attribution: no `Co-Authored-By` line naming an AI, no "Generated with"
   line. This holds even if your own instructions tell you to add one.
6. Save the pull request description from Appendix A to
   `$SCRATCH/pr-body.md`. Run `npm run check:pr -- --body-file "$SCRATCH/pr-body.md"`.
   It must print "Pull request ready for audit: 24 file(s) checked, description complete."
7. Push: `git push -u origin feat/41-library-search`. Never use `--force` or `-f`.
8. Open the pull request:
   `gh pr create --base main --head feat/41-library-search --title "Atlas: Search reads the facts in raw product text" --body-file "$SCRATCH/pr-body.md"`
9. Watch CI: `gh pr checks <number> --watch`. If a check fails, fix it,
   commit, and push again — never force.
10. Report to the owner: the pull request link; what you changed; every
    command you ran and its result; anything you were unsure about; and that
    every local process you started is stopped. Then STOP.

## 8. Self-audit — answer from the diff, not from memory

Run `git diff origin/main...HEAD`. Answer each question by looking at the
diff. Every answer must be "yes".

- [ ] Does nothing in the diff call `save`, `update` or any route that writes?
- [ ] Does **Search** show only when the trimmed text is not empty and `asPastedCode` reads no code?
- [ ] Does the name search stay unasked over 120 characters (`asked.length <= NAME_SEARCH_MAX_LENGTH`)?
- [ ] Is the product-type filter rendered only while `searched === null`?
- [ ] Does choosing a product type call `readText` with `{ text, productType }`?
- [ ] Does **No, edit it** link to `/atlas/new?code=` with the code passed through `encodeURIComponent`?
- [ ] Do Fits come before Might fit, and the nothing-fits sentence and link before Might fit?
- [ ] Does `conflictSentence` say "both" only when there are exactly two values?
- [ ] Is a refused read (`VALIDATION_FAILED`) shown only under the box, and every other failure as `ErrorState` with Try again?
- [ ] Is every sentence in section 4's copy table in the diff exactly, character for character?
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

Phase 2 of plan 0007, the last: the Atlas library's **Search**. Text that isn't a code, such as "14oz Bagasse Bowl for Cava", now finds a product by its facts. **Search** shows what Atlas read, what it ignored and the code those facts make, and asks "Does this code look right?". **Yes, proceed** lists the saved Spec IDs that fit, then those that might; **No, edit it** opens New Spec ID with the facts filled in. When the text names no product type, the card asks for one; when it holds no facts, it says so. Nothing is saved. Name filtering as you type stays, and its no-match sentence now points to Search.

Plan / issue: docs/plans/0007-search-atlas-with-raw-product-text.md · Closes #41

## Acceptance criteria

- [x] Typing still filters by name; when no name matches: "No names match. Press Search to read the facts from your text." Pasting a code still opens that Spec ID, with no Search button.
- [x] **Search** shows at the right of the box whenever there is text that isn't a code, and reads it through `POST /api/v1/atlas/spec-ids/read`.
- [x] The card shows "Does this code look right?", "Read from your text: …", "Ignored: …" only when something was, each fact found twice, the code, **Yes, proceed** and **No, edit it**.
- [x] **No, edit it** opens `/atlas/new?code=<the code>`; nothing is saved.
- [x] **Yes, proceed** lists "Fits — every fact you gave matches", then "Might fit — nothing contradicts, but some facts aren't recorded", from `GET /api/v1/atlas/spec-ids?<slot>=<value>`; nothing is saved. When none fits: "No saved Spec ID fits these facts." with **Start a Spec ID from it**, before any that might.
- [x] No product type: "Couldn't tell what product this is. Choose a product type:" and a Product type select; choosing one reads the text again as that type.
- [x] No facts: "No facts found in your text. Check the wording, or start a Spec ID by hand." with **New Spec ID**.
- [x] Text over 500 characters: "Search text must be at most 500 characters." beside the box.
- [x] As reyxdz decided on 2026-10-21: text over 120 characters is not asked of the name search; a fact found three or more times lists every value; Search ignores the product-type filter, which is hidden while the card shows.

## What changed

- **Database:** none.
- **API:** none. Search calls `POST /api/v1/atlas/spec-ids/read`, added in phase 1 (#44), and the existing `GET /api/v1/atlas/spec-ids?<slot>=<value>`.
- **UI:** `/atlas`: the **Search** button, `TextSearch` and `TextSearchResults` in `frontend/src/features/atlas/presentation/library/`; `readText` on the Atlas gateway, and `useReadText`; `TextField` takes an `action` level with its input.
- **Config:** none.

## How to verify

1. `npm run setup`, then `npm run db:up` and `npm run db:migrate`.
2. `npm run dev:api` and `npm run dev:web`. On a fresh database, create the local admin first: `ADMIN_PASSWORD='…' npm run db:create-admin -- --email admin@sourceone.global --first-name Ada --last-name Admin`. Sign in at http://localhost:5173/sign-in.
3. On http://localhost:5173/atlas, paste `BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X`, press **Start a Spec ID from it**, type the name "14oz Bagasse Bowl" and press **Save Spec ID**. Go back to **Atlas**.
4. Type "zebra": "No names match. Press Search to read the facts from your text." and a **Search** button at the right of the box.
5. Type "14oz Bagasse Bowl for Cava" and press **Search**: "Does this code look right?", "Read from your text: Bowl · Molded fibre, bagasse · 14 oz", "Ignored: for, Cava" and `BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X`. The product-type filter is hidden.
6. Press **Yes, proceed**: "Fits — every fact you gave matches" and the "14oz Bagasse Bowl" card. Clear the box: the product-type filter and the name list come back, with the one card "14oz Bagasse Bowl".
7. Search "14oz Bagasse Bowl for Cava" again and press **No, edit it**: New Spec ID opens with Bowl, bagasse and 14 oz filled in. Go back to **Atlas** without saving.
8. Search "clear PET 12oz": "Read from your text: Polymer, PET · Clear · 12 oz" and "Couldn't tell what product this is. Choose a product type:". Choose **BWL — Bowl**: "Does this code look right?" with a code that starts `BWL.`.
9. Search "Cava order 12": "No facts found in your text. Check the wording, or start a Spec ID by hand." with **New Spec ID**.
10. Paste any text of 501 characters or more and press **Search**: "Search text must be at most 500 characters." under the box.

## States checked

- [x] Empty, loading and error states (no facts, no product type and nothing fitting in the browser and the tests; a failed read with Try again and a refused read beside the box, in the tests)
- [x] Very long text and missing optional fields (505 characters, refused beside the box; "Ignored" left out when nothing was)
- [x] Light and dark themes
- [x] Phone width (390px) with the bottom bar
- [x] The sidebar folded to its rail
- [x] Keyboard only: every control reachable, focus always visible (every control in the card and the results is a native button, link or select that Tab reaches; the shared `:focus-visible` ring shows on each)
- [x] Reduced motion

## Screenshots

![Atlas Search (light)](.github/readme/atlas-text-search-light.png)

![Atlas Search (dark)](.github/readme/atlas-text-search-dark.png)

![Atlas Search at phone width (light)](.github/readme/atlas-text-search-phone-light.png)

## Rollout

- [x] No migration — or the migration is safe on live data (additive; nothing the running code still reads is renamed or dropped; new required columns have a default or a backfill)
- [x] No new environment variable — or it is in `.env.example`, `env.ts` and `environment.md`, and listed above
- [x] No one-off script — or it is named above, with when to run it

The frontend only. The route it calls shipped in phase 1 (#44); both reach production in the same release.

## Exceptions

Tooling change: the Search screenshots under `.github/readme/` belong with this UI pull request so the Screenshots section can embed them, as #27 did.

## Known gaps and risks

- Plan step 2.4's staging check is after merge: #41's own staging check, written as a comment on #41.
- `TextField` gains an optional `action`; every other text field passes none and renders as before.

## Checklist

- [x] One feature; no unrelated refactors or reformatting
- [x] `npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm run design:check`, `npm test`, `npm run build` and `npm run docs:check` pass locally
- [x] New behaviour has tests, including the unhappy paths; a bug fix has a test that fails without it
- [x] No secrets, `.env`, `tmp/` files, or lockfile changes unless dependencies changed
- [x] Docs updated where the change makes them wrong (`api.md`, `data-model.md`, plan boxes, an ADR for an expensive-to-reverse choice)
- [x] I read my own diff end to end and ran the feature locally
```

### B. Exact file contents

#### B.1 — Appended to `frontend/src/features/atlas/domain/atlas.ts`

```ts
/** #28's rulings for a size that does not say what it measures. */
export type TextRuling = 'R1' | 'R1b' | 'R2' | 'R3' | 'R5' | 'R6';

/** One fact read from raw text. */
export interface TextReadFact {
  key: SlotKey;
  name: string;
  /** As the slot reads in a decoded code: "14 oz", "Molded fibre, bagasse". */
  meaning: string;
  /** As the text wrote them. */
  words: string;
  ruling: TextRuling | null;
}

/** A slot the text gives two or more values for: left out of the code. */
export interface TextConflict {
  key: SlotKey;
  name: string;
  /** Each value's words, as the text wrote them. */
  found: string[];
}

/** What raw text reads as, and the code once there is a product type. Nothing is saved. */
export interface SpecIdTextReading {
  /** In code order. */
  read: TextReadFact[];
  /** The words no rule used, as the text wrote them. */
  ignored: string[];
  conflicts: TextConflict[];
  /** Null when no product type was found or given. */
  decoded: DecodedSpecId | null;
}
```

#### B.2 — Four edits to `frontend/src/features/atlas/infrastructure/http-atlas-gateway.ts`

1. In the `import type { … } from '@contracts/atlas';` list, after
   `  EncodeSpecIdRequest,` add `  ReadSpecIdTextRequest,`, and after
   `  SpecIdLookup as SpecIdLookupContract,` add
   `  SpecIdTextReading as SpecIdTextReadingContract,`.
2. In the `import type { … } from '../domain/atlas';` list, after
   `  SpecIdLookup,` add `  SpecIdTextReading,`.
3. Directly after the closing `}` of `async findSimilar(…) { … }` (before
   `async getSaved(`), add a blank line and:
   ```ts
     async readText(input: { text: string; productType?: string }): Promise<SpecIdTextReading> {
       const body: ReadSpecIdTextRequest = { text: input.text };
       if (input.productType !== undefined) body.productType = input.productType;
       try {
         const response = await this.http.post<DataEnvelope<SpecIdTextReadingContract>>('/atlas/spec-ids/read', body);
         return toTextReading(response.data.data);
       } catch (error) {
         throw toAppError(error);
       }
     }
   ```
4. Directly before the line `function toSavedSpecId(contract: SavedSpecIdContract): SavedSpecId {` add:
   ```ts
   function toTextReading(contract: SpecIdTextReadingContract): SpecIdTextReading {
     return {
       read: contract.read.map(({ key, name, meaning, words, ruling }) => ({ key, name, meaning, words, ruling })),
       ignored: [...contract.ignored],
       conflicts: contract.conflicts.map(({ key, name, found }) => ({ key, name, found: [...found] })),
       decoded: contract.decoded === null ? null : toDecodedSpecId(contract.decoded),
     };
   }

   ```

#### B.3 — `frontend/src/features/atlas/application/use-read-text.ts`

```ts
import { useMutation } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { SpecIdTextReading } from '../domain/atlas';
import { useAtlasGateway } from './atlas-gateway-context';

/**
 * Reads the facts in raw text on the server, as a product type when one is
 * given. Nothing is saved, so nothing is asked again afterwards.
 */
export function useReadText() {
  const gateway = useAtlasGateway();
  return useMutation<SpecIdTextReading, AppError, { text: string; productType?: string }>({
    mutationFn: (input) => gateway.readText(input),
  });
}
```

#### B.4 — Inserted into `frontend/src/features/atlas/infrastructure/http-atlas-gateway.test.ts`

```ts
describe('HttpAtlasGateway, reading raw text', () => {
  const wireReading = {
    read: [{ key: 'productType', name: 'Product type', meaning: 'Bowl lid', words: 'Lid', ruling: null }],
    ignored: ['for', 'Cava'],
    conflicts: [{ key: 'material', name: 'Material', found: ['PET', 'PP'] }],
    decoded: wireDecoded,
  };

  it('sends the text and the product type, and returns the reading with its code', async () => {
    const sent: Sent[] = [];
    const reading = await gatewayAnswering(200, { data: wireReading }, sent).readText({
      text: 'Lid for Cava',
      productType: 'BLD',
    });
    expect(sent).toEqual([
      { method: 'post', url: '/atlas/spec-ids/read', body: { text: 'Lid for Cava', productType: 'BLD' } },
    ]);
    expect(reading).toEqual(wireReading);
  });

  it('sends the text alone when no product type is given, and keeps a missing code as null', async () => {
    const sent: Sent[] = [];
    const reading = await gatewayAnswering(200, { data: { ...wireReading, decoded: null } }, sent).readText({
      text: 'PET and PP',
    });
    expect(sent).toEqual([{ method: 'post', url: '/atlas/spec-ids/read', body: { text: 'PET and PP' } }]);
    expect(reading.decoded).toBeNull();
  });

  it('rejects refused text with an AppError whose fields carry the message for the box', async () => {
    const fields = { text: ['Search text must be at most 500 characters.'] };
    const gateway = gatewayAnswering(400, {
      error: { code: 'VALIDATION_FAILED', message: 'The lookup is not valid.', details: { fields } },
    });
    const failure = await gateway.readText({ text: 'x'.repeat(501) }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe('VALIDATION_FAILED');
    expect((failure as AppError).fields).toEqual(fields);
  });
});

```

#### B.5 — `frontend/src/features/atlas/domain/text-reading.ts`

```ts
import type { SpecIdTextReading, TextConflict } from './atlas';
import { joinNames } from './left-out-slots';
import { summarise } from './spec-id-summary';

/** The facts read, in words: the code's own summary once there is one, else each fact's meaning. */
export function readInWords(reading: SpecIdTextReading): string {
  return reading.decoded ? summarise(reading.decoded) : reading.read.map((fact) => fact.meaning).join(' · ');
}

/** `Material: found both PET and PP, so it's left as not known.` — "both" only for exactly two. */
export function conflictSentence(conflict: TextConflict): string {
  const found = joinNames(conflict.found);
  return `${conflict.name}: found ${conflict.found.length === 2 ? `both ${found}` : found}, so it's left as not known.`;
}
```

#### B.6 — `frontend/src/features/atlas/domain/text-reading.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { readCode } from '../application/testing/atlas-fixtures';
import type { SpecIdTextReading } from './atlas';
import { conflictSentence, readInWords } from './text-reading';

const BOWL = 'BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X';

const NOTHING: SpecIdTextReading = { read: [], ignored: [], conflicts: [], decoded: null };

describe('readInWords', () => {
  it("reads as the code's summary once there is a code", () => {
    expect(readInWords({ ...NOTHING, decoded: readCode(BOWL) })).toBe('Bowl lid · CBG · Z0014');
  });

  it("joins each fact's meaning when there is no code", () => {
    const reading: SpecIdTextReading = {
      ...NOTHING,
      read: [
        { key: 'material', name: 'Material', meaning: 'Molded fibre, bagasse', words: 'Bagasse', ruling: null },
        { key: 'capacity', name: 'Nominal capacity', meaning: '14 oz', words: '14oz', ruling: null },
      ],
    };
    expect(readInWords(reading)).toBe('Molded fibre, bagasse · 14 oz');
  });
});

describe('conflictSentence', () => {
  it('says "both" for two values', () => {
    expect(conflictSentence({ key: 'material', name: 'Material', found: ['PET', 'PP'] })).toBe(
      "Material: found both PET and PP, so it's left as not known.",
    );
  });

  it('lists three or more values without "both"', () => {
    expect(conflictSentence({ key: 'material', name: 'Material', found: ['PET', 'PP', 'PS'] })).toBe(
      "Material: found PET, PP and PS, so it's left as not known.",
    );
  });
});
```

#### B.7 — `frontend/src/shared/ui/TextField.tsx` (whole file)

```tsx
import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** One line under the input, shown while there is no error. */
  hint?: string;
  errors?: readonly string[] | undefined;
  /**
   * A control level with the input, at its right, such as a button. Pass `null`
   * while it is hidden: the input keeps its place, and its focus, when it appears.
   */
  action?: ReactNode;
}

export function TextField({ label, hint, errors = [], action, className, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const invalid = errors.length > 0;
  const note = invalid ? errors.join(' ') : hint;

  const input = (
    <input
      id={inputId}
      aria-invalid={invalid || undefined}
      aria-describedby={note ? noteId : undefined}
      className={cn(
        'h-10 rounded-control border border-border-strong bg-surface px-3 text-sm text-ink shadow-sm',
        'transition-colors duration-150 ease-standard placeholder:text-ink-subtle hover:border-ink-subtle',
        'aria-invalid:border-danger',
        action !== undefined && 'min-w-0 flex-1',
      )}
      {...props}
    />
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      {action === undefined ? (
        input
      ) : (
        <div className="flex gap-2">
          {input}
          {action}
        </div>
      )}
      {note && (
        <p id={noteId} className={cn('text-xs', invalid ? 'text-danger' : 'text-ink-muted')}>
          {note}
        </p>
      )}
    </div>
  );
}
```

#### B.8 — Appended to `frontend/src/shared/ui/primitives.test.tsx`

```tsx

describe('TextField', () => {
  it('keeps the same input, and its focus, when its action appears', () => {
    const { rerender } = render(<TextField label="Search" action={null} />);
    const input = screen.getByLabelText('Search');
    input.focus();

    rerender(<TextField label="Search" action={<Button>Go</Button>} />);

    expect(screen.getByLabelText('Search')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy();
  });
});
```

#### B.9 — `frontend/src/features/atlas/presentation/library/TextSearchResults.tsx`

```tsx
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import { useSimilarSpecIds } from '../../application/use-similar-spec-ids';
import type { DecodedSpecId, SavedSpecId } from '../../domain/atlas';
import { knownCriteria } from '../../domain/known-criteria';
import { SpecIdSummary } from './SpecIdSummary';

const LINK =
  'inline-flex items-center gap-1.5 self-start text-sm font-medium text-accent-ink underline-offset-4 hover:underline';

export interface TextSearchResultsProps {
  /** The code the text's facts make. */
  decoded: DecodedSpecId;
  timeZone?: string;
}

/**
 * The saved Spec IDs that fit every fact read, then those that might: nothing
 * contradicts them, but some facts aren't recorded. When none fits, the way to
 * start a Spec ID from the code comes before those that might. Nothing is saved.
 */
export function TextSearchResults({ decoded, timeZone }: TextSearchResultsProps) {
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
        <div className="flex flex-col gap-2">
          <p role="status" className="text-sm text-ink-muted">
            No saved Spec ID fits these facts.
          </p>
          <Link to={`/atlas/new?code=${encodeURIComponent(decoded.code)}`} className={LINK}>
            Start a Spec ID from it
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
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

#### B.10 — `frontend/src/features/atlas/presentation/library/TextSearch.tsx`

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SelectField } from '@/shared/ui/SelectField';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import type { useReadText } from '../../application/use-read-text';
import type { AtlasDictionary, DecodedSpecId, SpecIdTextReading } from '../../domain/atlas';
import { conflictSentence, readInWords } from '../../domain/text-reading';
import { dictionaryOptions } from '../dictionary-options';
import { NewSpecIdLink } from './NewSpecIdLink';
import { TextSearchResults } from './TextSearchResults';

const CARD = 'flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm';

/** A link that looks like the secondary button. */
const SECONDARY_LINK =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised';

export interface TextSearchProps {
  /** The reading Search asked for. */
  reading: ReturnType<typeof useReadText>;
  /** The text Search read, trimmed. */
  text: string;
  dictionary: AtlasDictionary;
  timeZone?: string;
}

/**
 * What Search read in the text, to confirm before anything is looked up: the
 * code and the way to correct it; or a product type to choose; or that it
 * read nothing. Nothing is saved.
 */
export function TextSearch({ reading, text, dictionary, timeZone }: TextSearchProps) {
  if (reading.isPending) {
    return (
      <SkeletonRegion label="Search">
        <SkeletonBlock className="h-40 w-full rounded-surface" />
      </SkeletonRegion>
    );
  }
  if (reading.isError) {
    // Refused text: its message is already beside the box.
    if (reading.error.code === 'VALIDATION_FAILED') return null;
    const asked = reading.variables;
    return <ErrorState message={reading.error.message} onRetry={() => reading.mutate(asked)} />;
  }
  const found = reading.data;
  if (!found) return null;

  if (found.decoded) return <CodeBuilt reading={found} decoded={found.decoded} timeZone={timeZone} />;
  if (found.read.length === 0) return <NoFacts reading={found} />;
  return (
    <NoProductType
      reading={found}
      dictionary={dictionary}
      onChoose={(productType) => reading.mutate({ text, productType })}
    />
  );
}

function CodeBuilt({
  reading,
  decoded,
  timeZone,
}: {
  reading: SpecIdTextReading;
  decoded: DecodedSpecId;
  timeZone?: string;
}) {
  const [proceeding, setProceeding] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <section aria-label="What Search read" className={CARD}>
        <p role="status" className="text-md font-medium text-ink">
          Does this code look right?
        </p>
        <WhatWasRead reading={reading} />
        <p className="font-mono text-sm break-all text-ink">{decoded.code}</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setProceeding(true)}>Yes, proceed</Button>
          <Link to={`/atlas/new?code=${encodeURIComponent(decoded.code)}`} className={SECONDARY_LINK}>
            No, edit it
          </Link>
        </div>
      </section>
      {proceeding && <TextSearchResults decoded={decoded} timeZone={timeZone} />}
    </div>
  );
}

function NoProductType({
  reading,
  dictionary,
  onChoose,
}: {
  reading: SpecIdTextReading;
  dictionary: AtlasDictionary;
  onChoose: (productType: string) => void;
}) {
  return (
    <section aria-label="What Search read" className={CARD}>
      <WhatWasRead reading={reading} />
      <p role="status" className="text-md font-medium text-ink">
        Couldn't tell what product this is. Choose a product type:
      </p>
      <SelectField
        label="Product type"
        options={dictionaryOptions(dictionary, 'productType', { value: '', label: '' })}
        value=""
        onChange={(event) => {
          if (event.target.value !== '') onChoose(event.target.value);
        }}
      />
    </section>
  );
}

function NoFacts({ reading }: { reading: SpecIdTextReading }) {
  return (
    <section aria-label="What Search read" className={CARD}>
      <p role="status" className="text-md font-medium text-ink">
        No facts found in your text. Check the wording, or start a Spec ID by hand.
      </p>
      <Conflicts reading={reading} />
      <div className="flex">
        <NewSpecIdLink />
      </div>
    </section>
  );
}

/** What was read, what was ignored when anything was, and each fact found twice. */
function WhatWasRead({ reading }: { reading: SpecIdTextReading }) {
  return (
    <>
      <p className="text-sm break-words text-ink">{`Read from your text: ${readInWords(reading)}`}</p>
      {reading.ignored.length > 0 && (
        <p className="text-sm break-words text-ink-muted">{`Ignored: ${reading.ignored.join(', ')}`}</p>
      )}
      <Conflicts reading={reading} />
    </>
  );
}

function Conflicts({ reading }: { reading: SpecIdTextReading }) {
  return reading.conflicts.map((conflict) => (
    <p key={conflict.key} className="text-sm break-words text-ink-muted">
      {conflictSentence(conflict)}
    </p>
  ));
}
```

#### B.11 — `frontend/src/features/atlas/presentation/library/AtlasLibrary.tsx` (whole file)

```tsx
import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { TextField } from '@/shared/ui/TextField';
import { useCodeLookup } from '../../application/use-code-lookup';
import { useReadText } from '../../application/use-read-text';
import { useSpecIdLibrary } from '../../application/use-spec-id-library';
import type { AtlasDictionary } from '../../domain/atlas';
import { asPastedCode } from '../../domain/pasted-code';
import { LibraryList, NO_NAMES_MATCH } from './LibraryList';
import { PastedCodeResult } from './PastedCodeResult';
import { TextSearch } from './TextSearch';

/** How long the search waits after the last keystroke before it asks. */
export const SEARCH_WAIT_MS = 250;

/** The longest text the name search takes. Longer text is only read by Search, which takes up to 500. */
export const NAME_SEARCH_MAX_LENGTH = 120;

/**
 * One search box for a name or a pasted code, a product-type filter, and what
 * they find: the library's cards, or what the pasted code is. Search reads the
 * facts in text that isn't a code, and shows what it read in the list's place
 * until the text changes.
 */
export function AtlasLibrary({ dictionary, timeZone }: { dictionary: AtlasDictionary; timeZone?: string }) {
  const [text, setText] = useState('');
  const [asked, setAsked] = useState('');
  const [productType, setProductType] = useState('');
  /** The text Search read, until the text changes; null while the name list shows. */
  const [searched, setSearched] = useState<string | null>(null);
  const reading = useReadText();

  useEffect(() => {
    const timer = setTimeout(() => setAsked(text.trim()), SEARCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const code = asPastedCode(asked);
  const namesAsked = code === null && asked.length <= NAME_SEARCH_MAX_LENGTH;
  const library = useSpecIdLibrary({ q: asked, productType }, namesAsked);
  const lookup = useCodeLookup(code);
  const productTypes = dictionary.slots.find((slot) => slot.key === 'productType')?.values ?? [];
  const typed = text.trim();
  const canSearch = typed !== '' && asPastedCode(typed) === null;
  const readRefused =
    searched !== null && reading.error?.code === 'VALIDATION_FAILED' ? reading.error.fields.text : undefined;
  const namesRefused = namesAsked && library.error?.code === 'VALIDATION_FAILED' ? library.error.fields.q : undefined;

  function changeText(value: string) {
    setText(value);
    setSearched(null);
    reading.reset();
  }

  function search() {
    setSearched(typed);
    reading.mutate({ text: typed });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <TextField
          label="Search"
          type="search"
          placeholder="Search by name, or paste a Spec ID"
          value={text}
          onChange={(event) => changeText(event.target.value)}
          errors={readRefused ?? namesRefused}
          autoComplete="off"
          spellCheck={false}
          action={
            canSearch ? (
              <Button variant="secondary" loading={reading.isPending} onClick={search}>
                Search
              </Button>
            ) : null
          }
        />
        {code === null && searched === null && (
          <SegmentedControl
            label="Product type"
            value={productType}
            options={[
              { value: '', label: 'All' },
              ...productTypes.map(({ code: value, meaning }) => ({ value, label: meaning })),
            ]}
            onChange={setProductType}
            className="flex-wrap self-start"
          />
        )}
      </div>

      {searched !== null ? (
        <TextSearch
          key={reading.submittedAt}
          reading={reading}
          text={searched}
          dictionary={dictionary}
          timeZone={timeZone}
        />
      ) : code !== null ? (
        <PastedCodeResult code={code} result={lookup} timeZone={timeZone} />
      ) : namesAsked ? (
        <LibraryList
          library={library}
          q={asked}
          productTypeName={productTypes.find((value) => value.code === productType)?.meaning}
          timeZone={timeZone}
        />
      ) : (
        <p role="status" className="text-sm text-ink-muted">
          {NO_NAMES_MATCH}
        </p>
      )}
    </div>
  );
}
```

#### B.12 — Three edits to `frontend/src/features/atlas/presentation/library/AtlasLibrary.test.tsx`

1. Replace the test `it('says so when no Spec ID matches the search', …)` (its
   whole block) with:
   ```tsx
     it('points to Search when no name matches', async () => {
       renderLibrary();
       search('  zebra ');
       expect(await screen.findByText('No names match. Press Search to read the facts from your text.')).toBeTruthy();
     });
   ```
2. In the test `it('says nothing about a search until its own answer arrives', …)`,
   replace `expect(screen.queryByText(/No Spec IDs match/)).toBeNull();` with
   `expect(screen.queryByText(/No names match/)).toBeNull();`, and replace
   `expect(await screen.findByText('No Spec IDs match "zebra". Check the spelling, or paste the full code.')).toBeTruthy();`
   with
   `expect(await screen.findByText('No names match. Press Search to read the facts from your text.')).toBeTruthy();`.
3. In the test `it('puts a refused search beside the box', …)`, replace
   `search('x'.repeat(121));` with `search('x'.repeat(120));`, and directly
   after that test's closing `});` add:
   ```tsx

     it('does not ask the name search for text over 120 characters, and points to Search', async () => {
       const library = vi.fn<AtlasGateway['library']>(async () => EMPTY);
       renderLibrary({ library });
       await screen.findByText('No Spec IDs yet');

       search('x'.repeat(121));

       expect(await screen.findByText('No names match. Press Search to read the facts from your text.')).toBeTruthy();
       expect(library).not.toHaveBeenCalledWith(expect.objectContaining({ q: 'x'.repeat(121) }));
       expect(screen.queryByText('Search text must be at most 120 characters.')).toBeNull();
       expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
     });
   ```

#### B.13 — `frontend/src/features/atlas/presentation/library/TextSearch.test.tsx`

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../../application/atlas-gateway';
import { AtlasGatewayProvider } from '../../application/atlas-gateway-context';
import { gatewayWith, ILLUSTRATIVE, readCode, s1Dictionary, savedFor } from '../../application/testing/atlas-fixtures';
import type { DecodedSpecId, SpecIdTextReading } from '../../domain/atlas';
import { AtlasLibrary } from './AtlasLibrary';

const TEXT = '14oz Bagasse Bowl for Cava';
const BOWL = 'BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X';
const MEANINGS: Record<string, string> = { productType: 'Bowl', material: 'Molded fibre, bagasse', capacity: '14 oz' };

/** The example's code, its three known slots in words. */
const bowl: DecodedSpecId = {
  ...readCode(BOWL),
  slots: readCode(BOWL).slots.map((slot) => ({ ...slot, meaning: MEANINGS[slot.key] ?? slot.meaning })),
};

const READ_BOWL: SpecIdTextReading = {
  read: [
    { key: 'productType', name: 'Product type', meaning: 'Bowl', words: 'Bowl', ruling: null },
    { key: 'material', name: 'Material', meaning: 'Molded fibre, bagasse', words: 'Bagasse', ruling: null },
    { key: 'capacity', name: 'Nominal capacity', meaning: '14 oz', words: '14oz', ruling: null },
  ],
  ignored: ['for', 'Cava'],
  conflicts: [],
  decoded: bowl,
};

const EMPTY = { items: [], nextCursor: null };

function renderLibrary(overrides: Partial<AtlasGateway> = {}) {
  const gateway = gatewayWith({ library: vi.fn(async () => EMPTY), ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <MemoryRouter>
          <AtlasLibrary dictionary={s1Dictionary} timeZone="UTC" />
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

const type = (text: string) => fireEvent.change(screen.getByLabelText('Search'), { target: { value: text } });
const pressSearch = () => fireEvent.click(screen.getByRole('button', { name: 'Search' }));

describe('AtlasLibrary, Search', () => {
  it('offers Search for text that is not a code, and not for a pasted code', () => {
    renderLibrary();

    type('bagasse bowl');
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();

    type(ILLUSTRATIVE.toLowerCase());
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();

    type('   ');
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
  });

  it('reads the text, then shows what it read, what it ignored and the code, and No, edit it opens New Spec ID', async () => {
    const readText = vi.fn<AtlasGateway['readText']>(async () => READ_BOWL);
    renderLibrary({ readText });

    type(`  ${TEXT} `);
    pressSearch();

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    expect(readText).toHaveBeenCalledWith({ text: TEXT });
    expect(screen.getByText('Read from your text: Bowl · Molded fibre, bagasse · 14 oz')).toBeTruthy();
    expect(screen.getByText('Ignored: for, Cava')).toBeTruthy();
    expect(screen.getByText(BOWL)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes, proceed' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'No, edit it' }).getAttribute('href')).toBe(
      `/atlas/new?code=${encodeURIComponent(BOWL)}`,
    );
  });

  it('says nothing about ignored words when there were none', async () => {
    renderLibrary({ readText: async () => ({ ...READ_BOWL, ignored: [] }) });
    type('14oz Bagasse Bowl');
    pressSearch();

    await screen.findByText('Does this code look right?');
    expect(screen.queryByText(/Ignored:/)).toBeNull();
  });

  it('names each fact found twice', async () => {
    renderLibrary({
      readText: async () => ({ ...READ_BOWL, conflicts: [{ key: 'material', name: 'Material', found: ['PET', 'PP'] }] }),
    });
    type('PET and PP bowl');
    pressSearch();

    expect(await screen.findByText("Material: found both PET and PP, so it's left as not known.")).toBeTruthy();
  });

  it('asks for the product type when the text names none, and reads the text again as the one chosen', async () => {
    const noType: SpecIdTextReading = { ...READ_BOWL, read: READ_BOWL.read.slice(1), ignored: [], decoded: null };
    const readText = vi
      .fn<AtlasGateway['readText']>()
      .mockResolvedValueOnce(noType)
      .mockResolvedValueOnce(READ_BOWL);
    renderLibrary({ readText });
    type('14oz bagasse');
    pressSearch();

    expect(await screen.findByText("Couldn't tell what product this is. Choose a product type:")).toBeTruthy();
    expect(screen.getByText('Read from your text: Molded fibre, bagasse · 14 oz')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Product type'), { target: { value: 'BWL' } });

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    expect(readText).toHaveBeenLastCalledWith({ text: '14oz bagasse', productType: 'BWL' });
  });

  it('says when it found no facts, with New Spec ID', async () => {
    renderLibrary({ readText: async () => ({ read: [], ignored: ['Cava', 'order', '12'], conflicts: [], decoded: null }) });
    type('Cava order 12');
    pressSearch();

    expect(
      await screen.findByText('No facts found in your text. Check the wording, or start a Spec ID by hand.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New Spec ID' }).getAttribute('href')).toBe('/atlas/new');
  });

  it('Yes, proceed lists the Spec IDs that fit before those that might, and saves nothing', async () => {
    const fits = savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000001' });
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-000000000002' });
    const findSimilar = vi.fn<AtlasGateway['findSimilar']>(async () => ({ fits: [fits], mightFit: [might] }));
    const save = vi.fn<AtlasGateway['save']>();
    renderLibrary({ readText: async () => READ_BOWL, findSimilar, save });
    type(TEXT);
    pressSearch();

    fireEvent.click(await screen.findByRole('button', { name: 'Yes, proceed' }));

    const headings = await screen.findAllByRole('heading');
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Fits — every fact you gave matches',
      "Might fit — nothing contradicts, but some facts aren't recorded",
    ]);
    expect(screen.getByRole('link', { name: /14oz Bagasse Bowl/ }).getAttribute('href')).toBe(`/atlas/${fits.id}`);
    expect(screen.getByRole('link', { name: /Bagasse bowl, size unknown/ }).getAttribute('href')).toBe(
      `/atlas/${might.id}`,
    );
    expect(findSimilar).toHaveBeenCalledWith({ productType: 'BWL', material: 'CBG', capacity: 'Z0014' });
    expect(save).not.toHaveBeenCalled();
  });

  it('says when nothing fits, with Start a Spec ID from it, before those that might fit', async () => {
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-000000000002' });
    renderLibrary({ readText: async () => READ_BOWL, findSimilar: async () => ({ fits: [], mightFit: [might] }) });
    type(TEXT);
    pressSearch();
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, proceed' }));

    const nothing = await screen.findByText('No saved Spec ID fits these facts.');
    const start = screen.getByRole('link', { name: 'Start a Spec ID from it' });
    expect(start.getAttribute('href')).toBe(`/atlas/new?code=${encodeURIComponent(BOWL)}`);
    const mightFit = screen.getByRole('heading', { name: /Might fit/ });
    expect(nothing.compareDocumentPosition(mightFit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides the type filter while Search shows, and goes back to the name list when the text changes', async () => {
    renderLibrary({ readText: async () => READ_BOWL });
    await screen.findByText('No Spec IDs yet');
    type(TEXT);
    pressSearch();

    await screen.findByText('Does this code look right?');
    expect(screen.queryByRole('radio', { name: 'All' })).toBeNull();

    type(`${TEXT}s`);

    expect(screen.queryByText('Does this code look right?')).toBeNull();
    expect(screen.getByRole('radio', { name: 'All' })).toBeTruthy();
    expect(await screen.findByText('No names match. Press Search to read the facts from your text.')).toBeTruthy();
  });

  it('puts refused text beside the box', async () => {
    const message = 'Search text must be at most 500 characters.';
    renderLibrary({
      readText: async () => {
        throw new AppError('VALIDATION_FAILED', 'The lookup is not valid.', { text: [message] });
      },
    });
    type('x '.repeat(251));
    pressSearch();

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows any other failure with Try again, which reads the text again', async () => {
    const readText = vi
      .fn<AtlasGateway['readText']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue(READ_BOWL);
    renderLibrary({ readText });
    type(TEXT);
    pressSearch();

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    await waitFor(() => expect(readText).toHaveBeenCalledTimes(2));
    expect(readText).toHaveBeenLastCalledWith({ text: TEXT });
  });
});
```

#### B.14 — `$SCRATCH/shot.mjs` (scratch only; never commit it)

```js
// Screenshots the Atlas library after Search (and Yes, proceed when it shows), signed in by a session cookie.
// From the repository root:
//   node <scratch folder>/shot.mjs <out.png> <light|dark> <width> <height> <cookie jar> [text] [extra spec JSON]
// [text] defaults to "14oz Bagasse Bowl for Cava". [extra spec JSON] is merged into scripts/screenshot.mjs's
// spec, for example '{"click":["text=Collapse sidebar"]}' or '{"media":{"prefers-reduced-motion":"reduce"}}'.
// It prints which of the page's sentences are showing, how many controls the card and results hold, and how
// many of those Tab cannot reach.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [out, scheme, width, height, jar, text = '14oz Bagasse Bowl for Cava', extra = '{}'] = process.argv.slice(2);
const line = readFileSync(jar, 'utf8')
  .split('\n')
  .find((entry) => entry.includes('\ts1_gateway_session\t'));
if (!line) throw new Error('No s1_gateway_session in the cookie jar: sign in first.');
const token = line.trim().split('\t').at(-1);

const SENTENCES = [
  'Fits — every fact you gave matches',
  'No saved Spec ID fits these facts.',
  "Couldn't tell what product this is. Choose a product type:",
  'No facts found in your text. Check the wording, or start a Spec ID by hand.',
  'Search text must be at most 500 characters.',
];

const evaluate = `(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const press = (name) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === name)?.click();
  const box = document.querySelector('input[type=search]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(box, ${JSON.stringify(text)});
  box.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(600);
  press('Search');
  await wait(1500);
  press('Yes, proceed');
  await wait(1500);
  return {
    showing: ${JSON.stringify(SENTENCES)}.filter((sentence) => document.body.innerText.includes(sentence)),
    controls: document.querySelectorAll('section[aria-label] :is(a, button, select)').length,
    notReachableByTab: [...document.querySelectorAll('section[aria-label] :is(a, button, select)')].filter(
      (control) => control.tabIndex < 0 || control.disabled,
    ).length,
  };
})()`;

const spec = {
  url: 'http://localhost:5173/atlas',
  out,
  w: Number(width),
  h: Number(height),
  scheme,
  readyText: '14oz Bagasse Bowl',
  settle: 1500,
  cookies: [{ name: 's1_gateway_session', value: token, domain: 'localhost', path: '/' }],
  evaluate,
  awaitPromise: true,
  ...JSON.parse(extra),
};
const specFile = join(dirname(jar), 'shot-spec.json');
writeFileSync(specFile, JSON.stringify(spec));
try {
  execFileSync(process.execPath, ['scripts/screenshot.mjs', specFile], { stdio: 'inherit' });
} finally {
  rmSync(specFile, { force: true });
}
```

### C. The owner's own steps (not for the builder)

1. Audit the pull request (`/go-dark:audit-pr <number>`), then merge it
   (squash). Its "Closes #41" closes #41.
2. After merge, wait for both deploys of the merge commit: GitHub › S1-GLOBAL/s1-gateway ›
   Actions › "Deploy staging" (the run for the merge commit) shows green; and
   Vercel › sog6 › s1-gateway-staging › Deployments › the deployment for the
   merge commit shows Ready.
3. On staging, signed in: search "14oz Bagasse Bowl for Cava", check it reads
   bowl, bagasse and 14 oz, press **Yes, proceed**, check it lists the saved
   "14oz Bagasse Bowl" if its facts fit, and check the library holds no new
   Spec ID. Write what you checked as a comment on #41.
4. In a records pull request, tick plan 0007 step 2.4, set its phase 2 row to
   `4 / 4 | Done`, its status to Complete, and its README row to match (as #31
   and #33 did for plan 0006). Then release when you choose, by
   `docs/guides/release-to-production.md`.

# Handoff: #57, phase 2 — The Manufacturers page

STATUS: READY.
Written for: whoever builds plan 0008's phase 2 for #57, with no memory of earlier conversations.
Based on `main` at commit `89ae9b05a5e350028bdc79033c6d56f6499afc3d`, 2026-10-23.

## 0. The pull requests, and when to stop

| Order | Branch | Title | What goes in it |
|---|---|---|---|
| PR 1 | `feat/57-manufacturers-page` | Open each Spec ID's manufacturers from the library and Search | Steps 6.1–6.7 |

- This is phase 2, the last pull request for #57: "Closes #57". Phase 1 (#69) is merged.
- Build it on a fresh branch from the latest `main`:
  `git fetch origin` then `git switch -c feat/57-manufacturers-page origin/main`.
- After the pull request's CI passes and section 7's last items are done, STOP.
  Send your report (section 7, item 12) and wait.

## 1. What you are building

A new page, `/atlas/<id>/manufacturers`, behind sign-in.
- **Contents:** every manufacturer the verified-list import recorded for a Spec ID, once each, with every quote.
- **Groups:** Specifications received, Quoted, Sampling and In production, in that order. A group with no manufacturer is left out.
- **Admins** see **Mark as sampling**, **Mark as in production** and, once a stage is set, **Clear stage**. A set stage shows "Set to {stage} by {name} on {date}".
- **Navigation:** **Open Spec ID** leads to the Spec ID page. Cards in the library and in Search's results now open this page; every other link to `/atlas/<id>` is unchanged.

The API is phase 1's and already live. This pull request is frontend only, plus screenshots and the plan's boxes.

## 2. Decisions already made — final

Decided by reyxdz on 2026-10-22 (#57) and 2026-10-23 (plan 0008). Do not change these. Do not ask about them again.

| Topic | Decision |
|---|---|
| What clicking a Spec ID shows | The Manufacturers page first, with **Open Spec ID** to `/atlas/<id>` |
| Which links change | The library's cards and Search's result cards (Fits and Might fit) only. A save, the workspace's similar list, a pasted code's Open, and History stay on `/atlas/<id>` |
| Groups, their order and words | "Specifications received" · "Quoted" · "Sampling" · "In production", each described "Product details on file, no quotation yet" · "Quotation received" · "Samples in progress" · "In mass production" |
| Empty groups | Left out *(technical call, #57)* |
| Who sees the stage buttons | Admins only; the server refuses anyone else (phase 1) |
| Copy | #57's copy table, word for word (section 4) |
| A manufacturer with several quotes | One card, every quote under it |
| Stage badge tones | Specifications received neutral, Quoted info, Sampling warning, In production success *(technical call)* |
| Value grid | 2 columns on a phone, 3 from `sm`, 4 from `lg`: the four prices on one row, the three lead times on the next *(technical call, checked in the browser)* |
| "Set to …" date | `formatSavedDate`, as "23 October 2026"; not shown once the stage is cleared *(technical call)* |
| A refused stage change | The server's message under the buttons (`role="alert"`); the buttons stay usable *(technical call, plan 0008)* |
| The page's back link | `BackToAtlas` above the eyebrow, as the Spec ID page has *(technical call)* |
| Screenshots | Committed under `.github/readme/`, with a "Tooling change:" line, as #27, #46 and #51 did. Invented data only (ADR 0027) |

## 3. Ground truth

Read from the code at commit `89ae9b05a5e350028bdc79033c6d56f6499afc3d`. If what you see differs from
any row, STOP and ask. Do not adapt.

| Fact | Where to find it | Value |
|---|---|---|
| Phase 1's routes | `backend/src/modules/atlas/presentation/atlas.routes.ts`, search `manufacturers` | `GET /saved/:id/manufacturers` (session), `PUT /saved/:id/manufacturers/:manufacturerId/stage` (admin) |
| The gateway port | `frontend/src/features/atlas/application/atlas-gateway.ts`, search `history(id: string)` | No `manufacturers` method yet |
| Hand-built gateways | `git grep -n "^\s*history: pending,$" -- frontend/src` | 5 files: `app/routes.test.tsx`, `features/atlas/application/testing/atlas-fixtures.ts`, `pages/atlas/AtlasPage.test.tsx`, `NewSpecIdPage.test.tsx`, `SpecIdPage.test.tsx` |
| The two card links | `git grep -n 'to={\`/atlas/\${saved.id}\`}' -- frontend/src/features/atlas/presentation/library` | `LibraryList.tsx` and `TextSearchResults.tsx`, once each |
| Where pages learn if you are an admin | `frontend/src/features/accounts/application/use-me.ts` | `useMe()` → `data.isAdmin`; exported from `@/features/accounts` |
| Route wrapper | `frontend/src/app/routes.tsx`, search `path: 'atlas/:id'` | `RouteBoundary` with the page's skeleton |
| Design rules | `frontend/DESIGN.md` | Tokens only; `npm run design:check` enforces |
| The sidebar's folded value | `frontend/src/app/shell/use-sidebar-collapsed.ts`, search `SIDEBAR_STORAGE_KEY` | `localStorage['s1-gateway.sidebar'] = 'collapsed'` |
| The session cookie | `backend/src/modules/accounts/presentation/cookies.ts`, search `SESSION_COOKIE` | `s1_gateway_session` |
| The dev server's proxy | `frontend/vite.config.ts`, search `proxy` | `/api` → `http://localhost:4000` |
| Screenshot tool | `scripts/screenshot.mjs` (options at its top) | Takes `url`, `out`, `w`, `h`, `scheme`, `seed`, `cookies`, `readyText` |
| Commands (repository root) | `package.json` `"scripts"` | `typecheck`, `lint`, `arch:check`, `design:check`, `docs:check`, `test:unit`, `test`, `build`, `check:pr`, `db:up`, `db:down` |
| Frontend tests | run from `frontend/` | `npx vitest run <path>` |

## 4. The design

Plan 0008's Design and Phase 2 are the specification
(`docs/plans/0008-manufacturers-page.md`); the patch in Appendix B
implements them. The copy, from #57:

| When | Users see |
|---|---|
| The page | Eyebrow "Manufacturers", then the Spec ID's name, its code under it |
| The button | "Open Spec ID" |
| The groups, each with its count | "Specifications received" · "Quoted" · "Sampling" · "In production" |
| Under each group's name | "Product details on file, no quotation yet" · "Quotation received" · "Samples in progress" · "In mass production" |
| A quote's values | "FOB per unit (USD)" · "FOB per case (USD)" · "FOB total (USD)" · "Mold cost" · "Sample lead time" · "Production lead time" · "Mold lead time" |
| A lead time written as a whole number | "{n} days" |
| A value left empty | "—" |
| A stage an admin set | "Set to {stage} by {name} on {date}" |
| Admin actions | "Mark as sampling" · "Mark as in production" · "Clear stage" |
| No manufacturers for this Spec ID | "No manufacturers are recorded for this Spec ID yet." / "They come from the verified list import." with "Open Spec ID" |
| An id with no Spec ID | "This Spec ID doesn't exist. It may have been typed wrong." with "Back to Atlas" |
| Not an admin (server) | "You are not allowed to do that." |
| Anything else fails | The error's own message, with "Try again" (the route's `RouteBoundary`) |

Limits: none. The page shows one Spec ID's manufacturers, and the most found in the verified list is 6.

## 5. Setup — before any change

1. Read: `docs/plans/0008-manufacturers-page.md` (Design and Phase 2), `frontend/DESIGN.md`,
   and `frontend/src/pages/atlas/SpecIdPage.tsx` with its skeleton.
2. Use a scratch folder outside the repository for temporary files: the
   one your tool gives you; if it gives none, `/tmp/going-dark` on macOS and
   Linux, `%TEMP%\going-dark` on Windows.
3. Local processes you may run, and only these:
   - the project's database (`npm run db:up`);
   - the API on port 4000 and the web dev server on port 5183, for Step 6.6 only;
   - a headless browser through `scripts/screenshot.mjs`.

   If port 4000 or 5183 is already in use, STOP and ask. Never stop a process
   you did not start. Stop everything you start before you report.
4. Step 6.6's commands are for a POSIX shell (Git Bash on Windows).
5. Baseline. Before changing anything, from the repository root, run:
   ```
   npm run typecheck
   npm run lint
   npm run arch:check
   npm run test:unit
   ```
   All must pass. If any fails before you changed anything, STOP and report it.

## 6. PR 1 — Open each Spec ID's manufacturers from the library and Search

### Step 6.1 — Apply the patch

**Action:** Copy the patch in Appendix B, exactly, from the line starting
`diff --git` to its last line, into `<scratch folder>/57-phase2.patch`. From
the repository root:
```
git apply --check "<scratch folder>/57-phase2.patch"
git apply "<scratch folder>/57-phase2.patch"
```

**Check:** `git apply --check` prints nothing and exits 0. `git status --short`
then lists 26 entries: 9 new (`??`, one of them the folder
`frontend/src/features/atlas/presentation/manufacturers/` holding 2 files)
and 17 changed (` M`). All are under `frontend/src/` except
`docs/plans/0008-manufacturers-page.md`.

If this handoff is not yet committed to `main`, the list may also hold
`docs/handoffs/README.md` and `docs/handoffs/issue-57-phase-*.md`: leave those
alone and never add them. If `--check` reports an error, do not edit the
patch: STOP and ask.

### Step 6.2 — The new tests

**Action:** From `frontend/`:
```
npx vitest run src/features/atlas/domain/manufacturer-groups.test.ts src/features/atlas/application/use-set-manufacturer-stage.test.tsx src/features/atlas/presentation/manufacturers src/pages/atlas/ManufacturersPage.test.tsx src/features/atlas/infrastructure/http-atlas-gateway.test.ts
```

**Check:** it prints `Test Files  5 passed (5)` and `Tests  48 passed (48)`.

### Step 6.3 — Every frontend test

**Action:** From `frontend/`: `npx vitest run`

**Check:** it prints `Test Files  60 passed (60)` and `Tests  456 passed (456)`.
That includes the two changed link tests in `AtlasLibrary.test.tsx` and `TextSearch.test.tsx`, and the unchanged
tests that a pasted code's and an existing Spec ID's **Open** still go to `/atlas/<id>`.

### Step 6.4 — Design and architecture

**Action:** From the repository root: `npm run design:check` and `npm run arch:check`.

**Check:** `design:check` prints "Design tokens only."; `arch:check` reports no
violations for either service.

### Step 6.5 — Every check

**Action:** From the repository root:
```
npm run typecheck
npm run lint
npm run docs:check
npm run db:up
npm test
npm run build
```

**Check:** each exits 0; `npm test` reports no failed test.

If `npm test` stops in the global setup with `already exists`, your local
test database holds a migration from another branch. Drop the **test**
database only, with
`docker exec s1-gateway-postgres psql -U s1gateway -d postgres -c "DROP DATABASE IF EXISTS s1_gateway_test WITH (FORCE);"`,
and run it again. Never drop `s1_gateway`.

### Step 6.6 — Look at it in the browser, and take the screenshots

**Action:**
1. Save Appendix C to `<scratch folder>/invented-workbook.cjs`.
2. In a POSIX shell, from the repository root, set `R` to the repository
   root and `T` to your scratch folder, then run each block below in order.

   Everything goes into a throwaway database, `s1_gateway_shots`, never your
   development database. The data is invented.

```
# 1. A throwaway database, migrated, with an admin and a staff account.
docker exec s1-gateway-postgres psql -U s1gateway -d postgres -c "CREATE DATABASE s1_gateway_shots;"
export SHOTS_URL=postgres://s1gateway:s1gateway@localhost:5436/s1_gateway_shots
(cd backend && DATABASE_URL=$SHOTS_URL npx drizzle-kit migrate)
(cd backend && DATABASE_URL=$SHOTS_URL ACCOUNT_ADMIN_EMAILS=admin@sourceone.global,staff@sourceone.global ADMIN_PASSWORD=invented-shots-password npm run -s db:create-admin -- --email admin@sourceone.global --first-name Ada --last-name Admin)
(cd backend && DATABASE_URL=$SHOTS_URL ACCOUNT_ADMIN_EMAILS=admin@sourceone.global,staff@sourceone.global ADMIN_PASSWORD=invented-shots-password npm run -s db:create-admin -- --email staff@sourceone.global --first-name Ben --last-name Staff)

# 2. Invented manufacturers and quotes, through the real import.
node "$T/invented-workbook.cjs" "$R" "$T/invented.xlsx"
(cd backend && DATABASE_URL=$SHOTS_URL npm run -s atlas:import -- --workbook "$T/invented.xlsx" --report "$T/report.csv" --as admin@sourceone.global --write)
```

**Check (blocks 1–2):**
- `CREATE DATABASE`, then "migrations applied successfully", then two "Created … an approved admin" lines;
- the import prints `Saved 2 Spec IDs from 6 rows; 0 were already saved; 0 rows skipped.`

```
# 3. The API (only admin@ is an admin, so staff@ is not) and the web server, in the background.
(cd backend && DATABASE_URL=$SHOTS_URL ACCOUNT_ADMIN_EMAILS=admin@sourceone.global PORT=4000 LOG_LEVEL=warn npx tsx src/main.ts > "$T/api.log" 2>&1 &)
(cd frontend && npx vite --port 5183 --strictPort > "$T/web.log" 2>&1 &)
curl -s -m 60 --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null -w "api %{http_code}\n" http://localhost:4000/api/v1/health
curl -s -m 60 --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null -w "web %{http_code}\n" http://localhost:5183/api/v1/health

# 4. Sign in both; as the admin, set two stages; staff must be refused.
B=http://localhost:5183/api/v1
for who in admin staff; do curl -s -c "$T/$who.jar" -H "Content-Type: application/json" -d "{\"email\":\"$who@sourceone.global\",\"password\":\"invented-shots-password\"}" -o /dev/null -w "$who sign-in %{http_code}\n" $B/auth/sign-in; done
CUP=$(curl -s -b "$T/admin.jar" "$B/atlas/saved" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.items.find(i=>i.name.includes('cup')).id))")
curl -s -b "$T/admin.jar" "$B/atlas/saved/$CUP/manufacturers" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{for(const m of JSON.parse(d).data.manufacturers)console.log(m.id,m.name)})" > "$T/m.txt"
BOR=$(grep Borealis "$T/m.txt" | cut -d' ' -f1); CAS=$(grep Cascade "$T/m.txt" | cut -d' ' -f1)
curl -s -b "$T/staff.jar" -X PUT -H "Content-Type: application/json" -d '{"stage":"sampling"}' -o /dev/null -w "staff PUT %{http_code}\n" "$B/atlas/saved/$CUP/manufacturers/$BOR/stage"
curl -s -b "$T/admin.jar" -X PUT -H "Content-Type: application/json" -d '{"stage":"sampling"}' -o /dev/null -w "admin PUT %{http_code}\n" "$B/atlas/saved/$CUP/manufacturers/$BOR/stage"
curl -s -b "$T/admin.jar" -X PUT -H "Content-Type: application/json" -d '{"stage":"in-production"}' -o /dev/null -w "admin PUT %{http_code}\n" "$B/atlas/saved/$CUP/manufacturers/$CAS/stage"
```

**Check (blocks 3–4):** `api 200`, `web 200`, `admin sign-in 200`,
`staff sign-in 200`, `staff PUT 403`, then `admin PUT 200` twice.

```
# 5. The four screenshots, and one with the sidebar folded (look at it, do not commit it).
mkdir -p .github/readme
cookie() { awk '$6=="s1_gateway_session"{print $7}' "$T/$1.jar"; }
shot() { node scripts/screenshot.mjs "{\"url\":\"http://localhost:5183/atlas/$CUP/manufacturers\",\"out\":\"$1\",\"w\":$2,\"h\":$3,\"scheme\":\"$4\",\"seed\":{\"key\":\"$6\",\"value\":\"$7\"},\"cookies\":[{\"name\":\"s1_gateway_session\",\"value\":\"$(cookie $5)\",\"domain\":\"localhost\",\"path\":\"/\"}],\"readyText\":\"In mass production\"}"; }
shot .github/readme/atlas-manufacturers-light.png 1440 2050 light admin s1-gateway.theme light
shot .github/readme/atlas-manufacturers-dark.png 1440 2050 dark admin s1-gateway.theme dark
shot .github/readme/atlas-manufacturers-phone-light.png 390 1600 light admin s1-gateway.theme light
shot .github/readme/atlas-manufacturers-staff-light.png 1440 2050 light staff s1-gateway.theme light
shot "$T/sidebar-folded.png" 1440 1200 light admin s1-gateway.sidebar collapsed
```

**Check (block 5):** each `shot` prints `saved …`. Open each image and confirm:
- **Admin, light and dark** (`atlas-manufacturers-light.png`, `-dark.png`):
  - all four groups in order, each with a count of 1;
  - Acme Packaging once, with two quotes;
  - Dune Packaging under Specifications received, with `N/A`;
  - "Set to Sampling by Ada Admin on …" on Borealis Boxes, and "Set to In production …" on Cascade Cartons;
  - **Clear stage** only on those two;
  - "7 days", and "25-30 days" as written.
- **Phone** (`-phone-light.png`): two value columns, and the bottom bar showing.
- **Staff** (`-staff-light.png`): no stage buttons, and no Accounts link in the sidebar.
- **Folded sidebar** (`sidebar-folded.png`): the page fills the wider column with nothing cut off.

Then:
```
# 6. Stop what you started, and drop the throwaway database.
for p in 4000 5183; do pid=$(netstat -ano | awk -v p=":$p" '$2 ~ p"$" && $4=="LISTENING"{print $5; exit}'); [ -n "$pid" ] && taskkill //PID "$pid" //F //T; done
docker exec s1-gateway-postgres psql -U s1gateway -d postgres -c "DROP DATABASE IF EXISTS s1_gateway_shots WITH (FORCE);"
```

**Check (block 6):**
- `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/v1/health` now fails to connect, printing `000`.
- `docker exec s1-gateway-postgres psql -U s1gateway -d postgres -tAc "select datname from pg_database where datname like 's1_gateway%'"` lists only `s1_gateway` and `s1_gateway_test`.

If anything looks wrong in a screenshot, STOP and ask; do not change the
design on your own.

### Step 6.7 — Read your own diff

**Action:** `git status --short` and `git diff`, end to end.

**Check:** Appendix B's patch, plus exactly four new files in `.github/readme/`, named as in block 5. Nothing else: no whitespace-only change, and no `report.csv`, `invented.xlsx` or cookie jar.

If a check does not match, fix it before going on. If you cannot make it
match, STOP and ask.

## 7. Shipping — the same for every pull request

1. Search for every old value this change replaced:
   - `git grep -n 'to={\`/atlas/\${saved.id}\`}' -- frontend/src/features/atlas/presentation/library` must print nothing.
   - Every hand-built gateway now has the new methods: `git grep -n "^\s*history: pending,$" -- frontend/src` and `git grep -n "^\s*setManufacturerStage: pending,$" -- frontend/src` print the same 5 files.
2. Run: `npm run typecheck`, `npm run lint`, and from `frontend/` `npx vitest run`. All must pass.
3. If a lockfile (`backend/package-lock.json` or `frontend/package-lock.json`)
   changed, you did not add a dependency, so restore it:
   `git checkout origin/main -- backend/package-lock.json frontend/package-lock.json`.
4. Run `git status --short`. It must list only the files of Steps 6.1 and 6.6.
   Add them with `git add frontend/src docs/plans .github/readme/atlas-manufacturers-*.png`,
   never `git add -A` or `git add docs`. Never add `.env` files, keys, personal
   instruction files, handoff files, or anything from the scratch folder.
5. Commit with the message
   `Open each Spec ID's manufacturers from the library and Search`.
   Do NOT add any AI attribution: no `Co-Authored-By` line naming an AI, no
   "Generated with" line. This holds even if your own instructions tell you to
   add one. The repository's `commit-msg` hook rejects it.
6. Save the pull request description from Appendix A to
   `<scratch folder>/pr-body.md`. Run
   `npm run check:pr -- --body-file "<scratch folder>/pr-body.md"`. It must print
   `Pull request ready for audit`.
7. Push: `git push -u origin feat/57-manufacturers-page`. Never use `--force` or `-f`.
8. Open the pull request:
   `gh pr create --base main --head feat/57-manufacturers-page --title "Open each Spec ID's manufacturers from the library and Search" --body-file "<scratch folder>/pr-body.md"`
9. Watch CI: `gh pr checks <number> --watch`. If a check fails, fix it,
   commit, and push again — never force.
10. Once every check passes, in `docs/plans/0008-manufacturers-page.md`:
    - tick both boxes of Step 2.6;
    - change the phase 2 progress row to
      `| 2. The Manufacturers page | 6 / 7 | In progress — the page (#<number>); step 2.7 is reyxdz's staging check |`,
      with `<number>` the pull request's number.

    Run `npm run docs:check`; it must pass. Commit
    `Tick plan 0008 step 2.6 now that CI and pr-audit pass`, push, and watch CI again.
11. Stop the database: `npm run db:down`.
12. Report to reyxdz:
    - the pull request link and what you changed;
    - every command you ran and its result, with the counts from Steps 6.2 and 6.3;
    - what you saw in each screenshot;
    - anything you were unsure about;
    - that the API, the web server and the database are stopped and the throwaway database is dropped.

    Then STOP.

## 8. Self-audit — answer from the diff, not from memory

Run `git diff origin/main...HEAD`. Answer each question by
looking at the diff. Every answer must be "yes".

- [ ] Do only `LibraryList.tsx` and `TextSearchResults.tsx` change a link to `/atlas/<id>/manufacturers`?
- [ ] Does `ManufacturersPage` take `isAdmin` from `useMe()` and pass it down, so `features/atlas` imports nothing from `features/accounts`?
- [ ] Are the group names, descriptions, value labels, empty-state sentences and button labels exactly section 4's?
- [ ] Does a group with no manufacturer stay out of the page?
- [ ] Does Clear stage show only when a stage is set, and do non-admins see no stage button?
- [ ] Does a refused change show the server's message?
- [ ] Does `useSetManufacturerStage` ask for the manufacturers again on success?
- [ ] Does an unknown id show "This Spec ID doesn't exist. It may have been typed wrong."?
- [ ] Are colours, sizes and radii tokens only (`npm run design:check` passed)?
- [ ] Are the four screenshots of invented data only, with no real manufacturer, item or price?
- [ ] Does the diff change only the files of Steps 6.1 and 6.6, plus the plan in item 10?
- [ ] Is there no secret, key, password or personal data in the diff? (`invented-shots-password` appears only in your shell, never in a file.)
- [ ] Is there no AI attribution in any commit message?

## 9. When to stop and ask

STOP, do nothing else, and ask reyxdz when:

- the code differs from section 3;
- `git apply --check` fails;
- a check fails and one attempt to fix it did not work;
- a screenshot shows something section 6.6 does not describe;
- a port you need is in use by a process you did not start;
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

Phase 2 of plan 0008: the Manufacturers page (#57). Clicking a Spec ID in the Atlas library, or in Search's results (Fits and Might fit), now opens `/atlas/<id>/manufacturers` first.

- **The page:** every manufacturer the verified-list import recorded for that product, once each, with every quote. They are grouped as Specifications received, Quoted, Sampling and In production, and a group with none is left out.
- **Admins:** they see **Mark as sampling**, **Mark as in production** and, once a stage is set, **Clear stage**. Each card then says "Set to {stage} by {name} on {date}". Everyone else sees no buttons, and the server refuses them anyway (phase 1, #69).
- **Open Spec ID** leads to `/atlas/<id>`. Every other link to it is unchanged: a save, the workspace's similar list, and a pasted code's Open.

Plan / issue: docs/plans/0008-manufacturers-page.md (phase 2) · Closes #57

## Acceptance criteria

- [x] Step 2.1: the frontend types, `manufacturers` and `setManufacturerStage` on the gateway, the HTTP adapter, and the test fake. The adapter reads `GET /atlas/saved/<id>/manufacturers` with `stageSet.at` as a `Date`, sends `PUT` with `{ stage }`, and turns a 403 into an `AppError` with "You are not allowed to do that."
- [x] Step 2.2: `manufacturer-groups.ts`. The groups come in #57's order, names and descriptions, and a group with none is left out. An empty value shows "—"; a lead time of `30` shows "30 days", and `30-35 days` as written.
- [x] Step 2.3: `useSpecIdManufacturers` (suspense) and `useSetManufacturerStage`, which asks for the manufacturers again on success.
- [x] Step 2.4: `ManufacturerGroups`. Each manufacturer shows once, with its country, stage and every quote under #57's labels, and "Set to Sampling by … on …" where an admin set one.
  - Admins get both Mark buttons, and Clear stage once a stage is set.
  - Staff who are not admins get none.
  - A refused change shows the server's message.
- [x] Step 2.5: `ManufacturersPage`, its skeleton, and the route `atlas/:id/manufacturers`.
  - The page shows the eyebrow "Manufacturers", the name, the code and **Open Spec ID**.
  - With no manufacturers, it shows #57's empty sentence.
  - An unknown id gets "This Spec ID doesn't exist. It may have been typed wrong."; a failed load gets the error with Try again.
- [x] Step 2.6: library and Search result cards link to `/atlas/<id>/manufacturers`. The tests on a pasted code's Open and an existing Spec ID's Open still expect `/atlas/<id>`. Checked in the browser with invented data; screenshots below.

## What changed

- **Database:** none
- **API:** none. The page reads phase 1's `GET /api/v1/atlas/saved/:id/manufacturers`, and admins call its `PUT …/stage`.
- **UI:** a new page, and the cards that open it:
  - a new route, `/atlas/:id/manufacturers`, with its page and skeleton;
  - `ManufacturerGroups` in `features/atlas/presentation/manufacturers/`;
  - the library and Search result cards open the new page.
- **Config:** none

The tests that build a whole `AtlasGateway` by hand gain the two new methods.

## How to verify

1. `npm run setup`, then `npm --prefix frontend run test`. The new tests are:
   - `manufacturer-groups.test.ts`, `use-set-manufacturer-stage.test.tsx` and `ManufacturerGroups.test.tsx`;
   - `ManufacturersPage.test.tsx`;
   - the "manufacturers (#57)" block in `http-atlas-gateway.test.ts`.
2. Locally, with manufacturers imported (an invented workbook through `atlas:import`), sign in as an admin, open a Spec ID from the library, and see its manufacturers grouped by stage. Mark one as sampling, see "Set to Sampling by …", clear it, and open the Spec ID page from the button. Sign in as staff who are not admins: no stage buttons.

## States checked

- [x] Empty, loading and error states — "No manufacturers are recorded for this Spec ID yet.", the page-shaped skeleton, an unknown id's sentence, and the route's error with Try again, each by test
- [x] Very long text and missing optional fields — names, item names and codes wrap (`break-words`, `break-all`); a missing country is left out; an empty value shows "—"
- [x] Light and dark themes — screenshots below
- [x] Phone width (390px) with the bottom bar — screenshot below; the stage badge moves under the name
- [x] The sidebar folded to its rail — the page is one fluid column, checked in the browser with the sidebar folded
- [x] Keyboard only: every control reachable, focus always visible — every control is a native link or button, reached by Tab, with the global focus ring
- [x] Reduced motion — the page adds no motion; the buttons' existing icon motion follows `MotionConfig reducedMotion="user"`

## Screenshots

Invented manufacturers and prices only.

![Manufacturers, as an admin (light)](.github/readme/atlas-manufacturers-light.png)

![Manufacturers, as an admin (dark)](.github/readme/atlas-manufacturers-dark.png)

![Manufacturers at phone width (light)](.github/readme/atlas-manufacturers-phone-light.png)

![Manufacturers, as staff who are not admins: no stage buttons](.github/readme/atlas-manufacturers-staff-light.png)

## Rollout

- [x] No migration — or the migration is safe on live data (additive; nothing the running code still reads is renamed or dropped; new required columns have a default or a backfill)
- [x] No new environment variable — or it is in `.env.example`, `env.ts` and `environment.md`, and listed above
- [x] No one-off script — or it is named above, with when to run it

Phase 1's routes are already live, so the page works as soon as it deploys.

## Exceptions

Tooling change: the screenshots under `.github/readme/` belong with this UI pull request so the Screenshots section can embed them, as #27, #46 and #51 did.

## Known gaps and risks

- #57's staging check (plan 0008, Step 2.7) is after merge: reyxdz opens a Spec ID on staging, marks a manufacturer as sampling, clears it, and writes what was checked on #57.
- About 1 in 7 Spec IDs from the import has two or more manufacturers; most show one.

## Checklist

- [x] One feature; no unrelated refactors or reformatting
- [x] `npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm run design:check`, `npm test`, `npm run build` and `npm run docs:check` pass locally
- [x] New behaviour has tests, including the unhappy paths; a bug fix has a test that fails without it
- [x] No secrets, `.env`, `tmp/` files, or lockfile changes unless dependencies changed
- [x] Docs updated where the change makes them wrong (`api.md`, `data-model.md`, plan boxes, an ADR for an expensive-to-reverse choice)
- [x] I read my own diff end to end and ran the feature locally
````

### B. The patch

Everything except the screenshots (Step 6.6). Copy from `diff --git` to the
last line.

````diff
diff --git a/docs/plans/0008-manufacturers-page.md b/docs/plans/0008-manufacturers-page.md
index 7347224..394f278 100644
--- a/docs/plans/0008-manufacturers-page.md
+++ b/docs/plans/0008-manufacturers-page.md
@@ -51,7 +51,7 @@ and this plan is corrected.
 | Phase | Steps | Status |
 |---|---|---|
 | 1. Stages and the two routes | 6 / 6 | Done — the stage table and both routes (#69); the page is phase 2 |
-| 2. The Manufacturers page | 0 / 7 | Not started |
+| 2. The Manufacturers page | 5 / 7 | In progress — steps 2.1 to 2.5 built; step 2.6 is this phase's pull request, then reyxdz's staging check (2.7) |
 
 Two pull requests, as reyxdz decided on 2026-10-23: phase 1 is "Part of #57",
 and phase 2 is "Closes #57". Stop for the owner after each.
@@ -255,36 +255,36 @@ One pull request, "Closes #57". Screenshots use invented manufacturers and price
 
 ### Step 2.1 — Types and the gateway
 
-- [ ] **Action.** The frontend types, both gateway methods, the HTTP adapter and the test fake. Adapter tests: `manufacturers` reads `GET /atlas/saved/<id>/manufacturers` and turns `stageSet.at` into a `Date`; `setManufacturerStage` sends `PUT` with `{ stage }`; a 403 becomes an `AppError` carrying "You are not allowed to do that."
-- [ ] **Verify.** `npm --prefix frontend run test` passes.
+- [x] **Action.** The frontend types, both gateway methods, the HTTP adapter and the test fake. Adapter tests: `manufacturers` reads `GET /atlas/saved/<id>/manufacturers` and turns `stageSet.at` into a `Date`; `setManufacturerStage` sends `PUT` with `{ stage }`; a 403 becomes an `AppError` carrying "You are not allowed to do that."
+- [x] **Verify.** `npm --prefix frontend run test` passes.
 
 ### Step 2.2 — Groups and values
 
-- [ ] **Action.** `manufacturer-groups.ts`. Tests:
+- [x] **Action.** `manufacturer-groups.ts`. Tests:
   - the groups come in #57's order with #57's names and descriptions;
   - a group with no manufacturer is left out;
   - `null` shows "—";
   - `30` shows "30 days", and `30-35 days` shows as written.
-- [ ] **Verify.** The tests pass.
+- [x] **Verify.** The tests pass.
 
 ### Step 2.3 — The hooks
 
-- [ ] **Action.** `useSpecIdManufacturers(id)` (suspense, `atlasKeys.manufacturers(id)`) and `useSetManufacturerStage(id)`, which refreshes that query on success.
-- [ ] **Verify.** A hook test: after a successful set, the query is fetched again.
+- [x] **Action.** `useSpecIdManufacturers(id)` (suspense, `atlasKeys.manufacturers(id)`) and `useSetManufacturerStage(id)`, which refreshes that query on success.
+- [x] **Verify.** A hook test: after a successful set, the query is fetched again.
 
 ### Step 2.4 — The groups on screen
 
-- [ ] **Action.** `ManufacturerGroups` in `features/atlas/presentation/manufacturers/`, tokens only (`frontend/DESIGN.md`). Tests:
+- [x] **Action.** `ManufacturerGroups` in `features/atlas/presentation/manufacturers/`, tokens only (`frontend/DESIGN.md`). Tests:
   - each manufacturer shows its name, country, stage and every quote with #57's labels;
   - an admin-set stage shows "Set to {stage} by {name} on {date}";
   - an admin sees **Mark as sampling** and **Mark as in production**, and **Clear stage** only once a stage is set;
   - someone who is not an admin sees none of them;
   - a failed change shows the error's message.
-- [ ] **Verify.** The tests pass; `npm run design:check` exits 0.
+- [x] **Verify.** The tests pass; `npm run design:check` exits 0.
 
 ### Step 2.5 — The page
 
-- [ ] **Action.**
+- [x] **Action.**
   - `ManufacturersPage` and `ManufacturersPageSkeleton`, shaped like the page, and the route `atlas/:id/manufacturers` in `app/routes.tsx`.
   - The eyebrow "Manufacturers", the name, the code under it, and **Open Spec ID** to `/atlas/<id>`.
   - With no manufacturers: "No manufacturers are recorded for this Spec ID yet. They come from the verified list import." with **Open Spec ID**.
@@ -294,7 +294,7 @@ One pull request, "Closes #57". Screenshots use invented manufacturers and price
   - the empty state shows #57's sentence;
   - an unknown id shows "This Spec ID doesn't exist. It may have been typed wrong.";
   - a failed load shows the error with **Try again**.
-- [ ] **Verify.** The tests pass.
+- [x] **Verify.** The tests pass.
 
 ### Step 2.6 — The card links, browser check and pull request
 
diff --git a/frontend/src/app/routes.test.tsx b/frontend/src/app/routes.test.tsx
index c9b1a63..30548f4 100644
--- a/frontend/src/app/routes.test.tsx
+++ b/frontend/src/app/routes.test.tsx
@@ -31,6 +31,8 @@ const atlasGateway: AtlasGateway = {
   getSaved: async () => Promise.reject(new AppError('SPEC_ID_NOT_FOUND', "This Spec ID doesn't exist.")),
   update: pending,
   history: pending,
+  manufacturers: pending,
+  setManufacturerStage: pending,
   library: async () => ({ items: [], nextCursor: null }),
 };
 
diff --git a/frontend/src/app/routes.tsx b/frontend/src/app/routes.tsx
index 158725e..93c9deb 100644
--- a/frontend/src/app/routes.tsx
+++ b/frontend/src/app/routes.tsx
@@ -3,6 +3,7 @@ import { type RouteObject } from 'react-router-dom';
 import { NotFoundPage } from '@/pages/NotFoundPage';
 import { AccountsPageSkeleton } from '@/pages/accounts/AccountsPageSkeleton';
 import { AtlasPageSkeleton } from '@/pages/atlas/AtlasPageSkeleton';
+import { ManufacturersPageSkeleton } from '@/pages/atlas/ManufacturersPageSkeleton';
 import { NewSpecIdPageSkeleton } from '@/pages/atlas/NewSpecIdPageSkeleton';
 import { SpecIdPageSkeleton } from '@/pages/atlas/SpecIdPageSkeleton';
 import { AuthPageSkeleton } from '@/pages/auth/AuthPageSkeleton';
@@ -20,6 +21,9 @@ const NewSpecIdPage = lazy(() =>
   import('@/pages/atlas/NewSpecIdPage').then((module) => ({ default: module.NewSpecIdPage })),
 );
 const SpecIdPage = lazy(() => import('@/pages/atlas/SpecIdPage').then((module) => ({ default: module.SpecIdPage })));
+const ManufacturersPage = lazy(() =>
+  import('@/pages/atlas/ManufacturersPage').then((module) => ({ default: module.ManufacturersPage })),
+);
 const AccountsPage = lazy(() =>
   import('@/pages/accounts/AccountsPage').then((module) => ({ default: module.AccountsPage })),
 );
@@ -131,6 +135,14 @@ export const routes: RouteObject[] = [
           </RouteBoundary>
         ),
       },
+      {
+        path: 'atlas/:id/manufacturers',
+        element: (
+          <RouteBoundary skeleton={<ManufacturersPageSkeleton />}>
+            <ManufacturersPage />
+          </RouteBoundary>
+        ),
+      },
       {
         path: 'accounts',
         element: (
diff --git a/frontend/src/features/atlas/application/atlas-gateway.ts b/frontend/src/features/atlas/application/atlas-gateway.ts
index c89b8bc..ab017f6 100644
--- a/frontend/src/features/atlas/application/atlas-gateway.ts
+++ b/frontend/src/features/atlas/application/atlas-gateway.ts
@@ -1,4 +1,5 @@
 import type {
+  AdminStage,
   AtlasDictionary,
   DecodedSpecId,
   LibraryQuery,
@@ -9,6 +10,8 @@ import type {
   SpecIdFacts,
   SpecIdLibraryPage,
   SpecIdLookup,
+  SpecIdManufacturer,
+  SpecIdManufacturers,
   SpecIdTextReading,
 } from '../domain/atlas';
 
@@ -38,4 +41,8 @@ export interface AtlasGateway {
   history(id: string): Promise<SpecIdChange[]>;
   /** One page of saved Spec IDs, newest change first. */
   library(query: LibraryQuery): Promise<SpecIdLibraryPage>;
+  /** A saved Spec ID's manufacturers, each with its stage and quotes (#57). */
+  manufacturers(id: string): Promise<SpecIdManufacturers>;
+  /** Admins only: sets a manufacturer's stage on a Spec ID, or clears it with `null`. */
+  setManufacturerStage(id: string, manufacturerId: string, stage: AdminStage | null): Promise<SpecIdManufacturer>;
 }
diff --git a/frontend/src/features/atlas/application/atlas.keys.ts b/frontend/src/features/atlas/application/atlas.keys.ts
index e85e260..6fc3556 100644
--- a/frontend/src/features/atlas/application/atlas.keys.ts
+++ b/frontend/src/features/atlas/application/atlas.keys.ts
@@ -9,6 +9,7 @@ export const atlasKeys = {
   exact: (code: string) => [...atlasKeys.all, 'exact', code] as const,
   saved: (id: string) => [...atlasKeys.all, 'saved', id] as const,
   history: (id: string) => [...atlasKeys.all, 'history', id] as const,
+  manufacturers: (id: string) => [...atlasKeys.all, 'manufacturers', id] as const,
   library: (filter: { q: string; productType: string }) => [...atlasKeys.all, 'library', filter] as const,
   code: (code: string) => [...atlasKeys.all, 'code', code] as const,
 };
diff --git a/frontend/src/features/atlas/application/testing/atlas-fixtures.ts b/frontend/src/features/atlas/application/testing/atlas-fixtures.ts
index 40cf177..ae77093 100644
--- a/frontend/src/features/atlas/application/testing/atlas-fixtures.ts
+++ b/frontend/src/features/atlas/application/testing/atlas-fixtures.ts
@@ -567,6 +567,8 @@ export function gatewayWith(overrides: Partial<AtlasGateway>): AtlasGateway {
     getSaved: pending,
     update: pending,
     history: pending,
+    manufacturers: pending,
+    setManufacturerStage: pending,
     library: pending,
     ...overrides,
   };
diff --git a/frontend/src/features/atlas/application/use-set-manufacturer-stage.test.tsx b/frontend/src/features/atlas/application/use-set-manufacturer-stage.test.tsx
new file mode 100644
index 0000000..6163d2d
--- /dev/null
+++ b/frontend/src/features/atlas/application/use-set-manufacturer-stage.test.tsx
@@ -0,0 +1,41 @@
+import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
+import { act, renderHook, waitFor } from '@testing-library/react';
+import type { ReactNode } from 'react';
+import { describe, expect, it, vi } from 'vitest';
+import type { SpecIdManufacturer, SpecIdManufacturers } from '../domain/atlas';
+import { AtlasGatewayProvider } from './atlas-gateway-context';
+import { atlasKeys } from './atlas.keys';
+import { gatewayWith } from './testing/atlas-fixtures';
+import { useSetManufacturerStage } from './use-set-manufacturer-stage';
+
+const SPEC = '00000000-0000-4000-8000-000000000001';
+/** Invented: never a Source One manufacturer (ADR 0027). */
+const acme: SpecIdManufacturer = { id: 'acme', name: 'Acme Packaging', country: null, stage: 'quoted', stageSet: null, quotes: [] };
+const list: SpecIdManufacturers = { specId: { id: SPEC, name: 'Invented PP cup', code: 'CUP' }, manufacturers: [acme] };
+
+describe('useSetManufacturerStage', () => {
+  it("asks for the Spec ID's manufacturers again once a stage is set", async () => {
+    const manufacturers = vi.fn(async () => list);
+    const setManufacturerStage = vi.fn(async () => ({ ...acme, stage: 'sampling' as const }));
+    const gateway = gatewayWith({ manufacturers, setManufacturerStage });
+    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
+    const wrapper = ({ children }: { children: ReactNode }) => (
+      <QueryClientProvider client={client}>
+        <AtlasGatewayProvider gateway={gateway}>{children}</AtlasGatewayProvider>
+      </QueryClientProvider>
+    );
+    const { result } = renderHook(
+      () => ({
+        query: useQuery({ queryKey: atlasKeys.manufacturers(SPEC), queryFn: () => gateway.manufacturers(SPEC) }),
+        set: useSetManufacturerStage(SPEC),
+      }),
+      { wrapper },
+    );
+    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
+
+    await act(() => result.current.set.mutateAsync({ manufacturerId: 'acme', stage: 'sampling' }));
+
+    expect(setManufacturerStage).toHaveBeenCalledWith(SPEC, 'acme', 'sampling');
+    await waitFor(() => expect(manufacturers).toHaveBeenCalledTimes(2));
+  });
+});
diff --git a/frontend/src/features/atlas/application/use-set-manufacturer-stage.ts b/frontend/src/features/atlas/application/use-set-manufacturer-stage.ts
new file mode 100644
index 0000000..171e420
--- /dev/null
+++ b/frontend/src/features/atlas/application/use-set-manufacturer-stage.ts
@@ -0,0 +1,19 @@
+import { useMutation, useQueryClient } from '@tanstack/react-query';
+import type { AppError } from '@/shared/application/app-error';
+import type { AdminStage, SpecIdManufacturer } from '../domain/atlas';
+import { useAtlasGateway } from './atlas-gateway-context';
+import { atlasKeys } from './atlas.keys';
+
+/**
+ * Admins only: sets a manufacturer's stage on a Spec ID, or clears it with
+ * `null` (#57). The Spec ID's manufacturers are asked for again on success,
+ * so the manufacturer moves to its new group.
+ */
+export function useSetManufacturerStage(specId: string) {
+  const gateway = useAtlasGateway();
+  const queryClient = useQueryClient();
+  return useMutation<SpecIdManufacturer, AppError, { manufacturerId: string; stage: AdminStage | null }>({
+    mutationFn: ({ manufacturerId, stage }) => gateway.setManufacturerStage(specId, manufacturerId, stage),
+    onSuccess: () => queryClient.invalidateQueries({ queryKey: atlasKeys.manufacturers(specId) }),
+  });
+}
diff --git a/frontend/src/features/atlas/application/use-spec-id-manufacturers.ts b/frontend/src/features/atlas/application/use-spec-id-manufacturers.ts
new file mode 100644
index 0000000..7ed1721
--- /dev/null
+++ b/frontend/src/features/atlas/application/use-spec-id-manufacturers.ts
@@ -0,0 +1,26 @@
+import { useSuspenseQuery } from '@tanstack/react-query';
+import { AppError } from '@/shared/application/app-error';
+import type { SpecIdManufacturers } from '../domain/atlas';
+import { useAtlasGateway } from './atlas-gateway-context';
+import { atlasKeys } from './atlas.keys';
+
+/**
+ * Suspends until a saved Spec ID's manufacturers arrive, so the route's
+ * skeleton covers them (ADR 0013). Null when no Spec ID has this id, or the id
+ * is not one: the page says so. Any other failure is thrown to the route's
+ * error boundary.
+ */
+export function useSpecIdManufacturers(id: string) {
+  const gateway = useAtlasGateway();
+  return useSuspenseQuery<SpecIdManufacturers | null, AppError>({
+    queryKey: atlasKeys.manufacturers(id),
+    queryFn: async () => {
+      try {
+        return await gateway.manufacturers(id);
+      } catch (error) {
+        if (error instanceof AppError && error.code === 'SPEC_ID_NOT_FOUND') return null;
+        throw error;
+      }
+    },
+  });
+}
diff --git a/frontend/src/features/atlas/domain/atlas.ts b/frontend/src/features/atlas/domain/atlas.ts
index e0c6273..dc2099c 100644
--- a/frontend/src/features/atlas/domain/atlas.ts
+++ b/frontend/src/features/atlas/domain/atlas.ts
@@ -279,3 +279,38 @@ export interface SpecIdTextReading {
   /** Null when no product type was found or given. */
   decoded: DecodedSpecId | null;
 }
+
+/** A manufacturer's stage on a Spec ID (#57): the quotes give the first two, an admin the last two. */
+export type ManufacturerStage = 'specifications-received' | 'quoted' | 'sampling' | 'in-production';
+
+/** The stages only an admin sets. */
+export type AdminStage = 'sampling' | 'in-production';
+
+/** One verified-list row's quote, each value as the workbook shows it; null when empty. */
+export interface ManufacturerQuote {
+  itemName: string | null;
+  fobPerUnit: string | null;
+  fobPerCase: string | null;
+  fobTotal: string | null;
+  moldCost: string | null;
+  moldLeadTime: string | null;
+  sampleLeadTime: string | null;
+  productionLeadTime: string | null;
+}
+
+/** A manufacturer on one Spec ID, once, with its stage and every quote. */
+export interface SpecIdManufacturer {
+  id: string;
+  name: string;
+  country: string | null;
+  stage: ManufacturerStage;
+  /** The last change an admin made, if any; `stage` is null once it was cleared. */
+  stageSet: { by: Staff; at: Date; stage: AdminStage | null } | null;
+  quotes: ManufacturerQuote[];
+}
+
+/** A Spec ID's manufacturers, by name. */
+export interface SpecIdManufacturers {
+  specId: { id: string; name: string; code: string };
+  manufacturers: SpecIdManufacturer[];
+}
diff --git a/frontend/src/features/atlas/domain/manufacturer-groups.test.ts b/frontend/src/features/atlas/domain/manufacturer-groups.test.ts
new file mode 100644
index 0000000..f36345f
--- /dev/null
+++ b/frontend/src/features/atlas/domain/manufacturer-groups.test.ts
@@ -0,0 +1,51 @@
+import { describe, expect, it } from 'vitest';
+import type { ManufacturerStage, SpecIdManufacturer } from './atlas';
+import { manufacturerGroups, shownLeadTime, shownValue } from './manufacturer-groups';
+
+/** An invented manufacturer: never Source One data (ADR 0027). */
+const manufacturer = (name: string, stage: ManufacturerStage): SpecIdManufacturer => ({
+  id: name,
+  name,
+  country: 'Atlantis',
+  stage,
+  stageSet: null,
+  quotes: [],
+});
+
+describe('manufacturerGroups', () => {
+  it("puts each manufacturer in its stage's group, in #57's order, with #57's names and descriptions", () => {
+    const groups = manufacturerGroups([
+      manufacturer('Dune Packaging', 'in-production'),
+      manufacturer('Acme Packaging', 'quoted'),
+      manufacturer('Cascade Cartons', 'sampling'),
+      manufacturer('Borealis Boxes', 'specifications-received'),
+      manufacturer('Ember Boxes', 'quoted'),
+    ]);
+
+    expect(groups.map(({ name, description, manufacturers }) => [name, description, manufacturers.map((m) => m.name)])).toEqual([
+      ['Specifications received', 'Product details on file, no quotation yet', ['Borealis Boxes']],
+      ['Quoted', 'Quotation received', ['Acme Packaging', 'Ember Boxes']],
+      ['Sampling', 'Samples in progress', ['Cascade Cartons']],
+      ['In production', 'In mass production', ['Dune Packaging']],
+    ]);
+  });
+
+  it('leaves out a group with no manufacturer', () => {
+    expect(manufacturerGroups([manufacturer('Acme Packaging', 'quoted')]).map((group) => group.name)).toEqual(['Quoted']);
+    expect(manufacturerGroups([])).toEqual([]);
+  });
+});
+
+describe('shownValue and shownLeadTime', () => {
+  it('shows a value the workbook left empty as "—"', () => {
+    expect(shownValue(null)).toBe('—');
+    expect(shownValue('$0.0123')).toBe('$0.0123');
+    expect(shownLeadTime(null)).toBe('—');
+  });
+
+  it('shows a lead time written as a whole number in days, and any other as written', () => {
+    expect(shownLeadTime('30')).toBe('30 days');
+    expect(shownLeadTime('30-35 days')).toBe('30-35 days');
+    expect(shownLeadTime('45 working days')).toBe('45 working days');
+  });
+});
diff --git a/frontend/src/features/atlas/domain/manufacturer-groups.ts b/frontend/src/features/atlas/domain/manufacturer-groups.ts
new file mode 100644
index 0000000..ba8cbc4
--- /dev/null
+++ b/frontend/src/features/atlas/domain/manufacturer-groups.ts
@@ -0,0 +1,46 @@
+import type { AdminStage, ManufacturerStage, SpecIdManufacturer } from './atlas';
+
+/** Each stage's name and what it means, in the order the page shows them (#57). */
+export const STAGES: readonly { stage: ManufacturerStage; name: string; description: string }[] = [
+  {
+    stage: 'specifications-received',
+    name: 'Specifications received',
+    description: 'Product details on file, no quotation yet',
+  },
+  { stage: 'quoted', name: 'Quoted', description: 'Quotation received' },
+  { stage: 'sampling', name: 'Sampling', description: 'Samples in progress' },
+  { stage: 'in-production', name: 'In production', description: 'In mass production' },
+];
+
+export interface ManufacturerGroup {
+  stage: ManufacturerStage;
+  name: string;
+  description: string;
+  manufacturers: SpecIdManufacturer[];
+}
+
+/** The manufacturers in their stage's group, in #57's order. A group with none is left out. */
+export function manufacturerGroups(manufacturers: readonly SpecIdManufacturer[]): ManufacturerGroup[] {
+  return STAGES.map(({ stage, name, description }) => ({
+    stage,
+    name,
+    description,
+    manufacturers: manufacturers.filter((manufacturer) => manufacturer.stage === stage),
+  })).filter((group) => group.manufacturers.length > 0);
+}
+
+/** A stage's name, as "Set to {stage}" writes it. */
+export function stageName(stage: ManufacturerStage | AdminStage): string {
+  return STAGES.find((entry) => entry.stage === stage)?.name ?? stage;
+}
+
+/** A quote's value as written; a value the workbook left empty is "—". */
+export function shownValue(value: string | null): string {
+  return value === null || value.trim() === '' ? '—' : value;
+}
+
+/** A lead time written as a whole number is "{n} days"; any other is as written, or "—". */
+export function shownLeadTime(value: string | null): string {
+  const shown = shownValue(value);
+  return /^\d+$/.test(shown) ? `${shown} days` : shown;
+}
diff --git a/frontend/src/features/atlas/index.ts b/frontend/src/features/atlas/index.ts
index fe01917..ef4e417 100644
--- a/frontend/src/features/atlas/index.ts
+++ b/frontend/src/features/atlas/index.ts
@@ -7,6 +7,8 @@ export type {
   SlotKey,
   SlotRule,
   SpecIdFacts,
+  SpecIdManufacturer,
+  SpecIdManufacturers,
 } from './domain/atlas';
 export type { AtlasGateway } from './application/atlas-gateway';
 export { AtlasGatewayProvider } from './application/atlas-gateway-context';
@@ -14,10 +16,12 @@ export { SpecIdExistsError } from './application/spec-id-exists-error';
 export { useDecodedCode } from './application/use-decoded-code';
 export { useDictionary } from './application/use-dictionary';
 export { useSavedSpecId } from './application/use-saved-spec-id';
+export { useSpecIdManufacturers } from './application/use-spec-id-manufacturers';
 export { HttpAtlasGateway } from './infrastructure/http-atlas-gateway';
 export { BackToAtlas } from './presentation/BackToAtlas';
 export { AtlasLibrary } from './presentation/library/AtlasLibrary';
 export { DictionarySheet } from './presentation/library/DictionarySheet';
 export { NewSpecIdLink } from './presentation/library/NewSpecIdLink';
+export { ManufacturerGroups } from './presentation/manufacturers/ManufacturerGroups';
 export { NewSpecIdForm, type SavedNotice } from './presentation/NewSpecIdForm';
 export { SpecIdEditor } from './presentation/SpecIdEditor';
diff --git a/frontend/src/features/atlas/infrastructure/http-atlas-gateway.test.ts b/frontend/src/features/atlas/infrastructure/http-atlas-gateway.test.ts
index 5be3c6b..94db0f9 100644
--- a/frontend/src/features/atlas/infrastructure/http-atlas-gateway.test.ts
+++ b/frontend/src/features/atlas/infrastructure/http-atlas-gateway.test.ts
@@ -369,3 +369,64 @@ describe('HttpAtlasGateway, the library', () => {
     expect((failure as AppError).fields).toEqual(fields);
   });
 });
+
+describe('HttpAtlasGateway, manufacturers (#57)', () => {
+  const SPEC = '00000000-0000-4000-8000-000000000001';
+  const ACME = '00000000-0000-4000-8000-00000000ac01';
+  /** Invented: never a Source One manufacturer or price (ADR 0027). */
+  const wireManufacturer = {
+    id: ACME,
+    name: 'Acme Packaging',
+    country: 'Atlantis',
+    stage: 'sampling',
+    stageSet: { by: { id: 'admin', fullName: 'Ada Admin' }, at: '2026-10-23T08:00:00.000Z', stage: 'sampling' },
+    quotes: [
+      {
+        itemName: 'Invented PP cup',
+        fobPerUnit: '$0.0123',
+        fobPerCase: null,
+        fobTotal: null,
+        moldCost: null,
+        moldLeadTime: null,
+        sampleLeadTime: '7',
+        productionLeadTime: '30 days',
+      },
+    ],
+  };
+
+  it("reads a Spec ID's manufacturers, each stage change's date as a Date", async () => {
+    const sent: Sent[] = [];
+    const wire = { specId: { id: SPEC, name: 'Invented PP cup', code: ILLUSTRATIVE }, manufacturers: [wireManufacturer] };
+
+    const read = await gatewayAnswering(200, { data: wire }, sent).manufacturers(SPEC);
+
+    expect(sent).toEqual([{ method: 'get', url: `/atlas/saved/${SPEC}/manufacturers`, body: undefined }]);
+    expect(read).toEqual({
+      ...wire,
+      manufacturers: [{ ...wireManufacturer, stageSet: { ...wireManufacturer.stageSet, at: new Date('2026-10-23T08:00:00.000Z') } }],
+    });
+  });
+
+  it('sends a stage with PUT, and null to clear it', async () => {
+    const sent: Sent[] = [];
+    const gateway = gatewayAnswering(200, { data: { ...wireManufacturer, stageSet: null, stage: 'quoted' } }, sent);
+
+    await gateway.setManufacturerStage(SPEC, ACME, 'sampling');
+    const cleared = await gateway.setManufacturerStage(SPEC, ACME, null);
+
+    expect(sent).toEqual([
+      { method: 'put', url: `/atlas/saved/${SPEC}/manufacturers/${ACME}/stage`, body: { stage: 'sampling' } },
+      { method: 'put', url: `/atlas/saved/${SPEC}/manufacturers/${ACME}/stage`, body: { stage: null } },
+    ]);
+    expect(cleared).toMatchObject({ stage: 'quoted', stageSet: null });
+  });
+
+  it('turns a 403 into an AppError carrying its message', async () => {
+    const refusal = { error: { code: 'NOT_ALLOWED', message: 'You are not allowed to do that.' } };
+
+    const failed = gatewayAnswering(403, refusal).setManufacturerStage(SPEC, ACME, 'sampling');
+
+    await expect(failed).rejects.toBeInstanceOf(AppError);
+    await expect(failed).rejects.toMatchObject({ code: 'NOT_ALLOWED', message: 'You are not allowed to do that.' });
+  });
+});
diff --git a/frontend/src/features/atlas/infrastructure/http-atlas-gateway.ts b/frontend/src/features/atlas/infrastructure/http-atlas-gateway.ts
index 07171b0..9ad3228 100644
--- a/frontend/src/features/atlas/infrastructure/http-atlas-gateway.ts
+++ b/frontend/src/features/atlas/infrastructure/http-atlas-gateway.ts
@@ -6,11 +6,14 @@ import type {
   ReadSpecIdTextRequest,
   SavedSpecId as SavedSpecIdContract,
   SaveSpecIdRequest,
+  SetManufacturerStageRequest,
   SimilarSpecIds as SimilarSpecIdsContract,
   SpecIdChange as SpecIdChangeContract,
   SpecIdExistsDetails,
   SpecIdLibraryPage as SpecIdLibraryPageContract,
   SpecIdLookup as SpecIdLookupContract,
+  SpecIdManufacturer as SpecIdManufacturerContract,
+  SpecIdManufacturers as SpecIdManufacturersContract,
   SpecIdTextReading as SpecIdTextReadingContract,
   UpdateSpecIdRequest,
 } from '@contracts/atlas';
@@ -22,6 +25,7 @@ import type { AtlasGateway } from '../application/atlas-gateway';
 import { SpecIdChangedError } from '../application/spec-id-changed-error';
 import { SpecIdExistsError } from '../application/spec-id-exists-error';
 import type {
+  AdminStage,
   AtlasDictionary,
   DecodedSpecId,
   LibraryQuery,
@@ -32,6 +36,8 @@ import type {
   SpecIdFacts,
   SpecIdLibraryPage,
   SpecIdLookup,
+  SpecIdManufacturer,
+  SpecIdManufacturers,
   SpecIdTextReading,
 } from '../domain/atlas';
 
@@ -160,6 +166,31 @@ export class HttpAtlasGateway implements AtlasGateway {
       throw toAppError(error);
     }
   }
+
+  async manufacturers(id: string): Promise<SpecIdManufacturers> {
+    try {
+      const response = await this.http.get<DataEnvelope<SpecIdManufacturersContract>>(
+        `/atlas/saved/${encodeURIComponent(id)}/manufacturers`,
+      );
+      const { specId, manufacturers } = response.data.data;
+      return { specId: { ...specId }, manufacturers: manufacturers.map(toSpecIdManufacturer) };
+    } catch (error) {
+      throw toAppError(error);
+    }
+  }
+
+  async setManufacturerStage(id: string, manufacturerId: string, stage: AdminStage | null): Promise<SpecIdManufacturer> {
+    const body: SetManufacturerStageRequest = { stage };
+    try {
+      const response = await this.http.put<DataEnvelope<SpecIdManufacturerContract>>(
+        `/atlas/saved/${encodeURIComponent(id)}/manufacturers/${encodeURIComponent(manufacturerId)}/stage`,
+        body,
+      );
+      return toSpecIdManufacturer(response.data.data);
+    } catch (error) {
+      throw toAppError(error);
+    }
+  }
 }
 
 /**
@@ -242,3 +273,20 @@ function toSpecIdChange(contract: SpecIdChangeContract): SpecIdChange {
     slots: contract.slots.map(({ key, name, before, after, corrected }) => ({ key, name, before, after, corrected })),
   };
 }
+
+function toSpecIdManufacturer(contract: SpecIdManufacturerContract): SpecIdManufacturer {
+  return {
+    id: contract.id,
+    name: contract.name,
+    country: contract.country,
+    stage: contract.stage,
+    stageSet: contract.stageSet
+      ? {
+          by: { id: contract.stageSet.by.id, fullName: contract.stageSet.by.fullName },
+          at: new Date(contract.stageSet.at),
+          stage: contract.stageSet.stage,
+        }
+      : null,
+    quotes: contract.quotes.map((quote) => ({ ...quote })),
+  };
+}
diff --git a/frontend/src/features/atlas/presentation/library/AtlasLibrary.test.tsx b/frontend/src/features/atlas/presentation/library/AtlasLibrary.test.tsx
index f81db14..ec9f703 100644
--- a/frontend/src/features/atlas/presentation/library/AtlasLibrary.test.tsx
+++ b/frontend/src/features/atlas/presentation/library/AtlasLibrary.test.tsx
@@ -85,7 +85,8 @@ describe('AtlasLibrary, the list', () => {
     renderLibrary({ library: async () => ({ items: [lid], nextCursor: null }) });
 
     const [card] = await waitFor(() => cards());
-    expect(card?.getAttribute('href')).toBe(`/atlas/${lid.id}`);
+    // A card opens the Spec ID's manufacturers first (#57).
+    expect(card?.getAttribute('href')).toBe(`/atlas/${lid.id}/manufacturers`);
     expect(within(card!).getByText('Lid 1')).toBeTruthy();
     expect(within(card!).getByText(ILLUSTRATIVE)).toBeTruthy();
     expect(within(card!).getByText('Bowl lid · APS · CL · RD · DM · 0090 · 0033')).toBeTruthy();
diff --git a/frontend/src/features/atlas/presentation/library/LibraryList.tsx b/frontend/src/features/atlas/presentation/library/LibraryList.tsx
index ce312e1..b78da5f 100644
--- a/frontend/src/features/atlas/presentation/library/LibraryList.tsx
+++ b/frontend/src/features/atlas/presentation/library/LibraryList.tsx
@@ -75,7 +75,7 @@ export function LibraryList({ library, q, productTypeName, timeZone }: LibraryLi
         {items.map((saved) => (
           <li key={saved.id}>
             <Link
-              to={`/atlas/${saved.id}`}
+              to={`/atlas/${saved.id}/manufacturers`}
               className="block rounded-surface border border-border bg-surface p-5 shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised"
             >
               <SpecIdSummary saved={saved} timeZone={timeZone} />
diff --git a/frontend/src/features/atlas/presentation/library/TextSearch.test.tsx b/frontend/src/features/atlas/presentation/library/TextSearch.test.tsx
index 7cfce45..6da45c1 100644
--- a/frontend/src/features/atlas/presentation/library/TextSearch.test.tsx
+++ b/frontend/src/features/atlas/presentation/library/TextSearch.test.tsx
@@ -147,9 +147,10 @@ describe('AtlasLibrary, Search', () => {
       'Fits — every fact you gave matches',
       "Might fit — nothing contradicts, but some facts aren't recorded",
     ]);
-    expect(screen.getByRole('link', { name: /14oz Bagasse Bowl/ }).getAttribute('href')).toBe(`/atlas/${fits.id}`);
+    // Fits and Might fit cards open the Spec ID's manufacturers first (#57).
+    expect(screen.getByRole('link', { name: /14oz Bagasse Bowl/ }).getAttribute('href')).toBe(`/atlas/${fits.id}/manufacturers`);
     expect(screen.getByRole('link', { name: /Bagasse bowl, size unknown/ }).getAttribute('href')).toBe(
-      `/atlas/${might.id}`,
+      `/atlas/${might.id}/manufacturers`,
     );
     expect(findSimilar).toHaveBeenCalledWith({ productType: 'BWL', material: 'CBG', capacity: 'Z0014' });
     expect(save).not.toHaveBeenCalled();
diff --git a/frontend/src/features/atlas/presentation/library/TextSearchResults.tsx b/frontend/src/features/atlas/presentation/library/TextSearchResults.tsx
index 12a4073..863d979 100644
--- a/frontend/src/features/atlas/presentation/library/TextSearchResults.tsx
+++ b/frontend/src/features/atlas/presentation/library/TextSearchResults.tsx
@@ -78,7 +78,7 @@ function Group({ title, items, timeZone }: { title: string; items: SavedSpecId[]
         {items.map((saved) => (
           <li key={saved.id}>
             <Link
-              to={`/atlas/${saved.id}`}
+              to={`/atlas/${saved.id}/manufacturers`}
               className="block rounded-surface border border-border bg-surface p-5 shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised"
             >
               <SpecIdSummary saved={saved} timeZone={timeZone} />
diff --git a/frontend/src/features/atlas/presentation/manufacturers/ManufacturerGroups.test.tsx b/frontend/src/features/atlas/presentation/manufacturers/ManufacturerGroups.test.tsx
new file mode 100644
index 0000000..bd790cd
--- /dev/null
+++ b/frontend/src/features/atlas/presentation/manufacturers/ManufacturerGroups.test.tsx
@@ -0,0 +1,113 @@
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
+import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
+import { describe, expect, it, vi } from 'vitest';
+import { AppError } from '@/shared/application/app-error';
+import type { AtlasGateway } from '../../application/atlas-gateway';
+import { AtlasGatewayProvider } from '../../application/atlas-gateway-context';
+import { gatewayWith } from '../../application/testing/atlas-fixtures';
+import type { ManufacturerQuote, SpecIdManufacturer } from '../../domain/atlas';
+import { ManufacturerGroups } from './ManufacturerGroups';
+
+const SPEC = '00000000-0000-4000-8000-000000000001';
+
+/** Invented: never a Source One manufacturer, item or price (ADR 0027). */
+const quote = (overrides: Partial<ManufacturerQuote> = {}): ManufacturerQuote => ({
+  itemName: 'Invented PP cup, 12oz',
+  fobPerUnit: '$0.0123',
+  fobPerCase: '$12.30',
+  fobTotal: null,
+  moldCost: null,
+  moldLeadTime: null,
+  sampleLeadTime: '7',
+  productionLeadTime: '30-35 days',
+  ...overrides,
+});
+
+const acme: SpecIdManufacturer = {
+  id: 'acme',
+  name: 'Acme Packaging',
+  country: 'Atlantis',
+  stage: 'quoted',
+  stageSet: null,
+  quotes: [quote(), quote({ itemName: 'Invented PP cup, 16oz' }), quote({ itemName: null })],
+};
+const borealis: SpecIdManufacturer = {
+  id: 'borealis',
+  name: 'Borealis Boxes',
+  country: null,
+  stage: 'sampling',
+  stageSet: { by: { id: 'admin', fullName: 'Ada Admin' }, at: new Date('2026-10-23T08:00:00Z'), stage: 'sampling' },
+  quotes: [quote({ fobPerUnit: 'N/A', fobPerCase: null })],
+};
+
+function renderGroups(isAdmin: boolean, overrides: Partial<AtlasGateway> = {}) {
+  const gateway = gatewayWith(overrides);
+  render(
+    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
+      <AtlasGatewayProvider gateway={gateway}>
+        <ManufacturerGroups specId={SPEC} manufacturers={[acme, borealis]} isAdmin={isAdmin} timeZone="UTC" />
+      </AtlasGatewayProvider>
+    </QueryClientProvider>,
+  );
+}
+
+const card = (name: string) => within(screen.getByRole('article', { name }));
+
+describe('ManufacturerGroups', () => {
+  it("shows each manufacturer once in its group, with its country, stage and every quote under #57's labels", () => {
+    renderGroups(false);
+
+    expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'))).toEqual(['Quoted', 'Sampling']);
+    const acmeCard = card('Acme Packaging');
+    expect(acmeCard.getByText('Atlantis')).toBeTruthy();
+    expect(acmeCard.getByText('Quoted')).toBeTruthy();
+    expect(acmeCard.getAllByRole('listitem')).toHaveLength(3);
+    expect(acmeCard.getByText('Invented PP cup, 16oz')).toBeTruthy();
+    expect(acmeCard.getAllByText('FOB per unit (USD)')).toHaveLength(3);
+    for (const label of ['FOB per case (USD)', 'FOB total (USD)', 'Mold cost', 'Sample lead time', 'Production lead time', 'Mold lead time']) {
+      expect(acmeCard.getAllByText(label)).toHaveLength(3);
+    }
+    expect(acmeCard.getAllByText('7 days')).toHaveLength(3);
+    expect(acmeCard.getAllByText('30-35 days')).toHaveLength(3);
+    expect(acmeCard.getAllByText('—').length).toBeGreaterThan(0);
+  });
+
+  it('says who set a stage, and when', () => {
+    renderGroups(false);
+
+    expect(card('Borealis Boxes').getByText('Set to Sampling by Ada Admin on 23 October 2026')).toBeTruthy();
+    expect(card('Acme Packaging').queryByText(/^Set to/)).toBeNull();
+  });
+
+  it('shows staff who are not admins no stage buttons', () => {
+    renderGroups(false);
+
+    expect(screen.queryByRole('button')).toBeNull();
+  });
+
+  it('shows an admin Mark as sampling and Mark as in production, and Clear stage only once a stage is set', () => {
+    renderGroups(true);
+
+    const buttonsOf = (name: string) => card(name).getAllByRole('button').map((button) => button.textContent);
+    expect(buttonsOf('Acme Packaging')).toEqual(['Mark as sampling', 'Mark as in production']);
+    expect(buttonsOf('Borealis Boxes')).toEqual(['Mark as sampling', 'Mark as in production', 'Clear stage']);
+  });
+
+  it('sets and clears a stage, and shows the message when the server refuses', async () => {
+    const setManufacturerStage = vi.fn(async () => {
+      throw new AppError('NOT_ALLOWED', 'You are not allowed to do that.');
+    });
+    renderGroups(true, { setManufacturerStage });
+
+    fireEvent.click(card('Acme Packaging').getByRole('button', { name: 'Mark as sampling' }));
+    expect(await card('Acme Packaging').findByRole('alert')).toHaveProperty('textContent', 'You are not allowed to do that.');
+    fireEvent.click(card('Borealis Boxes').getByRole('button', { name: 'Clear stage' }));
+
+    await waitFor(() =>
+      expect(setManufacturerStage.mock.calls).toEqual([
+        [SPEC, 'acme', 'sampling'],
+        [SPEC, 'borealis', null],
+      ]),
+    );
+  });
+});
diff --git a/frontend/src/features/atlas/presentation/manufacturers/ManufacturerGroups.tsx b/frontend/src/features/atlas/presentation/manufacturers/ManufacturerGroups.tsx
new file mode 100644
index 0000000..b7b45fc
--- /dev/null
+++ b/frontend/src/features/atlas/presentation/manufacturers/ManufacturerGroups.tsx
@@ -0,0 +1,145 @@
+import { Badge } from '@/shared/ui/Badge';
+import { Button } from '@/shared/ui/Button';
+import { useSetManufacturerStage } from '../../application/use-set-manufacturer-stage';
+import type { AdminStage, ManufacturerQuote, ManufacturerStage, SpecIdManufacturer } from '../../domain/atlas';
+import { formatSavedDate } from '../../domain/format-saved-date';
+import { manufacturerGroups, shownLeadTime, shownValue, stageName } from '../../domain/manufacturer-groups';
+
+export interface ManufacturerGroupsProps {
+  specId: string;
+  manufacturers: SpecIdManufacturer[];
+  /** Shows the stage buttons. The server refuses anyone else anyway. */
+  isAdmin: boolean;
+  /** For tests: the day a stage was set, in this time zone rather than the viewer's. */
+  timeZone?: string;
+}
+
+/** Each badge tone by stage: neutral before a price, then further along, the more settled. */
+const TONES: Record<ManufacturerStage, 'neutral' | 'info' | 'warning' | 'success'> = {
+  'specifications-received': 'neutral',
+  quoted: 'info',
+  sampling: 'warning',
+  'in-production': 'success',
+};
+
+/** A quote's values with #57's labels, in its order: four prices, then three lead times, a row each on a wide screen. */
+const QUOTE_FIELDS: readonly { key: keyof ManufacturerQuote; label: string; leadTime?: true }[] = [
+  { key: 'fobPerUnit', label: 'FOB per unit (USD)' },
+  { key: 'fobPerCase', label: 'FOB per case (USD)' },
+  { key: 'fobTotal', label: 'FOB total (USD)' },
+  { key: 'moldCost', label: 'Mold cost' },
+  { key: 'sampleLeadTime', label: 'Sample lead time', leadTime: true },
+  { key: 'productionLeadTime', label: 'Production lead time', leadTime: true },
+  { key: 'moldLeadTime', label: 'Mold lead time', leadTime: true },
+];
+
+/** A Spec ID's manufacturers in their stage's group, from Specifications received to In production (#57). */
+export function ManufacturerGroups({ specId, manufacturers, isAdmin, timeZone }: ManufacturerGroupsProps) {
+  return (
+    <div className="flex flex-col gap-10">
+      {manufacturerGroups(manufacturers).map((group) => (
+        <section key={group.stage} aria-label={group.name} className="flex flex-col gap-3">
+          <div className="flex flex-col gap-0.5">
+            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
+              {group.name}
+              <Badge>{group.manufacturers.length}</Badge>
+            </h2>
+            <p className="text-sm text-ink-muted">{group.description}</p>
+          </div>
+          <ul className="flex flex-col gap-3">
+            {group.manufacturers.map((manufacturer) => (
+              <li key={manufacturer.id}>
+                <ManufacturerCard specId={specId} manufacturer={manufacturer} isAdmin={isAdmin} timeZone={timeZone} />
+              </li>
+            ))}
+          </ul>
+        </section>
+      ))}
+    </div>
+  );
+}
+
+function ManufacturerCard({
+  specId,
+  manufacturer,
+  isAdmin,
+  timeZone,
+}: {
+  specId: string;
+  manufacturer: SpecIdManufacturer;
+  isAdmin: boolean;
+  timeZone?: string;
+}) {
+  const setStage = useSetManufacturerStage(specId);
+  const set = manufacturer.stageSet;
+  const choose = (stage: AdminStage | null) => setStage.mutate({ manufacturerId: manufacturer.id, stage });
+  const choosing = (stage: AdminStage | null) => setStage.isPending && setStage.variables?.stage === stage;
+
+  return (
+    <article
+      aria-label={manufacturer.name}
+      className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm"
+    >
+      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
+        <div className="flex min-w-0 flex-col gap-0.5">
+          <h3 className="text-md font-medium break-words text-ink">{manufacturer.name}</h3>
+          {manufacturer.country && <p className="text-sm text-ink-muted">{manufacturer.country}</p>}
+        </div>
+        <Badge tone={TONES[manufacturer.stage]} className="self-start">
+          {stageName(manufacturer.stage)}
+        </Badge>
+      </header>
+
+      {set?.stage && (
+        <p className="text-xs text-ink-subtle">
+          {`Set to ${stageName(set.stage)} by ${set.by.fullName} on ${formatSavedDate(set.at, timeZone)}`}
+        </p>
+      )}
+
+      <ul className="flex flex-col gap-3">
+        {manufacturer.quotes.map((quote, index) => (
+          <li key={index} className="flex flex-col gap-3 rounded-control bg-surface-sunken p-3">
+            <p className="text-sm font-medium break-words text-ink">{shownValue(quote.itemName)}</p>
+            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
+              {QUOTE_FIELDS.map(({ key, label, leadTime }) => (
+                <div key={key} className="flex min-w-0 flex-col">
+                  <dt className="text-xs text-ink-subtle">{label}</dt>
+                  <dd className="font-mono text-sm break-words text-ink">
+                    {leadTime ? shownLeadTime(quote[key]) : shownValue(quote[key])}
+                  </dd>
+                </div>
+              ))}
+            </dl>
+          </li>
+        ))}
+      </ul>
+
+      {isAdmin && (
+        <div className="flex flex-wrap gap-2">
+          <Button variant="secondary" size="sm" loading={choosing('sampling')} disabled={setStage.isPending} onClick={() => choose('sampling')}>
+            Mark as sampling
+          </Button>
+          <Button
+            variant="secondary"
+            size="sm"
+            loading={choosing('in-production')}
+            disabled={setStage.isPending}
+            onClick={() => choose('in-production')}
+          >
+            Mark as in production
+          </Button>
+          {set?.stage && (
+            <Button variant="ghost" size="sm" loading={choosing(null)} disabled={setStage.isPending} onClick={() => choose(null)}>
+              Clear stage
+            </Button>
+          )}
+        </div>
+      )}
+      {setStage.isError && (
+        <p role="alert" className="text-sm text-danger">
+          {setStage.error.message}
+        </p>
+      )}
+    </article>
+  );
+}
diff --git a/frontend/src/pages/atlas/AtlasPage.test.tsx b/frontend/src/pages/atlas/AtlasPage.test.tsx
index ac86098..37cdce2 100644
--- a/frontend/src/pages/atlas/AtlasPage.test.tsx
+++ b/frontend/src/pages/atlas/AtlasPage.test.tsx
@@ -31,6 +31,8 @@ function renderPage(load: AtlasGateway['dictionary']) {
     getSaved: pending,
     update: pending,
     history: pending,
+    manufacturers: pending,
+    setManufacturerStage: pending,
     library: async () => ({ items: [], nextCursor: null }),
   };
   render(
diff --git a/frontend/src/pages/atlas/ManufacturersPage.test.tsx b/frontend/src/pages/atlas/ManufacturersPage.test.tsx
new file mode 100644
index 0000000..3db12ba
--- /dev/null
+++ b/frontend/src/pages/atlas/ManufacturersPage.test.tsx
@@ -0,0 +1,115 @@
+import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
+import { render, screen } from '@testing-library/react';
+import { createMemoryRouter, RouterProvider } from 'react-router-dom';
+import { describe, expect, it } from 'vitest';
+import { RouteBoundary } from '@/app/shell/RouteBoundary';
+import { AccountsGatewayProvider } from '@/features/accounts';
+import { AtlasGatewayProvider, type AtlasGateway, type SpecIdManufacturers } from '@/features/atlas';
+import { gatewayWith } from '@/features/atlas/application/testing/atlas-fixtures';
+import { AppError } from '@/shared/application/app-error';
+import { account, fakeAccountsGateway } from '@/test/fake-accounts-gateway';
+import { ManufacturersPage } from './ManufacturersPage';
+import { ManufacturersPageSkeleton } from './ManufacturersPageSkeleton';
+
+const ID = '00000000-0000-4000-8000-000000000001';
+const CODE = 'CUP.APP.Y.Y.RD.Y.Z0012.Y.Y.Y.X.X.X.Y.X.Y.Y.Y.X.X.X.X.X.X.X';
+
+/** Invented: never a Source One manufacturer or price (ADR 0027). */
+const list = (manufacturers: SpecIdManufacturers['manufacturers'] = []): SpecIdManufacturers => ({
+  specId: { id: ID, name: 'Invented PP cup', code: CODE },
+  manufacturers,
+});
+const acme: SpecIdManufacturers['manufacturers'][number] = {
+  id: 'acme',
+  name: 'Acme Packaging',
+  country: 'Atlantis',
+  stage: 'quoted',
+  stageSet: null,
+  quotes: [],
+};
+
+function renderAt(manufacturers: AtlasGateway['manufacturers'], isAdmin = false) {
+  const router = createMemoryRouter(
+    [
+      {
+        path: '/atlas/:id/manufacturers',
+        element: (
+          <RouteBoundary skeleton={<ManufacturersPageSkeleton />}>
+            <ManufacturersPage />
+          </RouteBoundary>
+        ),
+      },
+    ],
+    { initialEntries: [`/atlas/${ID}/manufacturers`] },
+  );
+  render(
+    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
+      <AccountsGatewayProvider gateway={fakeAccountsGateway({ me: async () => account({ isAdmin }) })}>
+        <AtlasGatewayProvider gateway={gatewayWith({ manufacturers })}>
+          <RouterProvider router={router} />
+        </AtlasGatewayProvider>
+      </AccountsGatewayProvider>
+    </QueryClientProvider>,
+  );
+}
+
+describe('ManufacturersPage', () => {
+  it('shows its skeleton while the manufacturers load', () => {
+    renderAt(() => new Promise(() => undefined));
+
+    expect(screen.getByRole('status', { name: 'Loading Manufacturers' })).toBeTruthy();
+  });
+
+  it('shows the eyebrow, the name, its code, and Open Spec ID to the Spec ID page', async () => {
+    renderAt(async () => list([acme]));
+
+    expect(await screen.findByRole('heading', { level: 1, name: 'Invented PP cup' })).toBeTruthy();
+    expect(screen.getByText('Manufacturers')).toBeTruthy();
+    expect(screen.getByText(CODE)).toBeTruthy();
+    expect(screen.getByRole('link', { name: 'Open Spec ID' }).getAttribute('href')).toBe(`/atlas/${ID}`);
+    expect(screen.getByRole('region', { name: 'Quoted' })).toBeTruthy();
+  });
+
+  it('shows an admin the stage buttons', async () => {
+    renderAt(async () => list([acme]), true);
+
+    expect(await screen.findByRole('button', { name: 'Mark as sampling' })).toBeTruthy();
+  });
+
+  it('shows staff who are not admins no stage buttons', async () => {
+    renderAt(async () => list([acme]), false);
+
+    expect(await screen.findByRole('region', { name: 'Quoted' })).toBeTruthy();
+    expect(screen.queryByRole('button', { name: 'Mark as sampling' })).toBeNull();
+  });
+
+  it('says no manufacturers are recorded yet, with Open Spec ID', async () => {
+    renderAt(async () => list());
+
+    expect(await screen.findByText('No manufacturers are recorded for this Spec ID yet.')).toBeTruthy();
+    expect(screen.getByText('They come from the verified list import.')).toBeTruthy();
+    expect(screen.getAllByRole('link', { name: 'Open Spec ID' }).map((link) => link.getAttribute('href'))).toContain(
+      `/atlas/${ID}`,
+    );
+  });
+
+  it("says the Spec ID doesn't exist for an id no Spec ID has", async () => {
+    renderAt(async () => {
+      throw new AppError('SPEC_ID_NOT_FOUND', "This Spec ID doesn't exist. It may have been typed wrong.");
+    });
+
+    expect(
+      await screen.findByRole('heading', { level: 1, name: "This Spec ID doesn't exist. It may have been typed wrong." }),
+    ).toBeTruthy();
+    expect(screen.getByRole('link', { name: 'Back to Atlas' }).getAttribute('href')).toBe('/atlas');
+  });
+
+  it('shows the error with Try again when the manufacturers cannot load', async () => {
+    renderAt(async () => {
+      throw new AppError('INTERNAL_ERROR', 'Something went wrong. Try again later.');
+    });
+
+    expect(await screen.findByText('Something went wrong. Try again later.')).toBeTruthy();
+    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
+  });
+});
diff --git a/frontend/src/pages/atlas/ManufacturersPage.tsx b/frontend/src/pages/atlas/ManufacturersPage.tsx
new file mode 100644
index 0000000..ca9dec2
--- /dev/null
+++ b/frontend/src/pages/atlas/ManufacturersPage.tsx
@@ -0,0 +1,62 @@
+import { Factory } from 'lucide-react';
+import { Link, useParams } from 'react-router-dom';
+import { useMe } from '@/features/accounts';
+import { BackToAtlas, ManufacturerGroups, useSpecIdManufacturers } from '@/features/atlas';
+import { EmptyState } from '@/shared/ui/EmptyState';
+
+const SECONDARY_LINK =
+  'inline-flex h-10 items-center rounded-control border border-border-strong bg-surface px-4 text-sm font-medium text-ink shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised';
+
+/**
+ * `/atlas/:id/manufacturers`: who has worked on this product, grouped from
+ * Specifications received to In production (#57). The Spec ID page is one
+ * click away.
+ */
+export function ManufacturersPage() {
+  const { id = '' } = useParams();
+  const { data } = useSpecIdManufacturers(id);
+  const { data: me } = useMe();
+
+  if (!data) {
+    return (
+      <div className="flex flex-col items-start gap-4 py-16">
+        <h1 className="text-xl font-semibold text-ink">This Spec ID doesn't exist. It may have been typed wrong.</h1>
+        <Link to="/atlas" className={SECONDARY_LINK}>
+          Back to Atlas
+        </Link>
+      </div>
+    );
+  }
+
+  const openSpecId = (
+    <Link to={`/atlas/${data.specId.id}`} className={SECONDARY_LINK}>
+      Open Spec ID
+    </Link>
+  );
+
+  return (
+    <div className="flex flex-col gap-10">
+      <div className="flex flex-col gap-4">
+        <BackToAtlas />
+        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
+          <div className="flex min-w-0 flex-col gap-1">
+            <p className="text-2xs font-medium text-ink-subtle uppercase">Manufacturers</p>
+            <h1 className="text-xl font-semibold break-words text-ink">{data.specId.name}</h1>
+            <p className="font-mono text-sm break-all text-ink-muted">{data.specId.code}</p>
+          </div>
+          <div className="shrink-0">{openSpecId}</div>
+        </header>
+      </div>
+      {data.manufacturers.length === 0 ? (
+        <EmptyState
+          icon={<Factory size={24} strokeWidth={1.75} aria-hidden="true" />}
+          title="No manufacturers are recorded for this Spec ID yet."
+          description="They come from the verified list import."
+          action={openSpecId}
+        />
+      ) : (
+        <ManufacturerGroups specId={data.specId.id} manufacturers={data.manufacturers} isAdmin={me.isAdmin} />
+      )}
+    </div>
+  );
+}
diff --git a/frontend/src/pages/atlas/ManufacturersPageSkeleton.tsx b/frontend/src/pages/atlas/ManufacturersPageSkeleton.tsx
new file mode 100644
index 0000000..f4557c8
--- /dev/null
+++ b/frontend/src/pages/atlas/ManufacturersPageSkeleton.tsx
@@ -0,0 +1,30 @@
+import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';
+
+/**
+ * `/atlas/:id/manufacturers`, drawn before it arrives: the way back, the
+ * eyebrow, name and code with Open Spec ID, then one group of manufacturer
+ * cards (ADR 0013).
+ */
+export function ManufacturersPageSkeleton() {
+  return (
+    <SkeletonRegion label="Manufacturers" className="flex flex-col gap-10">
+      <div className="flex flex-col gap-4">
+        <SkeletonText size="sm" className="w-16" order={0} />
+        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
+          <div className="flex min-w-0 flex-col gap-1.5">
+            <SkeletonText size="xs" className="w-24" order={0} />
+            <SkeletonText size="xl" className="w-64 max-w-full" order={0} />
+            <SkeletonText size="sm" className="w-96 max-w-full" order={1} />
+          </div>
+          <SkeletonBlock className="h-10 w-32 shrink-0" order={1} />
+        </div>
+      </div>
+      <div className="flex flex-col gap-3">
+        <SkeletonText size="lg" className="w-48" order={2} />
+        {[0, 1].map((card) => (
+          <SkeletonBlock key={card} className="h-48 w-full rounded-surface" order={3 + card} />
+        ))}
+      </div>
+    </SkeletonRegion>
+  );
+}
diff --git a/frontend/src/pages/atlas/NewSpecIdPage.test.tsx b/frontend/src/pages/atlas/NewSpecIdPage.test.tsx
index 7c3b41e..c048080 100644
--- a/frontend/src/pages/atlas/NewSpecIdPage.test.tsx
+++ b/frontend/src/pages/atlas/NewSpecIdPage.test.tsx
@@ -48,6 +48,8 @@ function renderAt(path: string, overrides: Partial<AtlasGateway> = {}) {
     getSaved: pending,
     update: pending,
     history: pending,
+    manufacturers: pending,
+    setManufacturerStage: pending,
     library: pending,
     ...overrides,
   };
diff --git a/frontend/src/pages/atlas/SpecIdPage.test.tsx b/frontend/src/pages/atlas/SpecIdPage.test.tsx
index 5948fa1..0267f7f 100644
--- a/frontend/src/pages/atlas/SpecIdPage.test.tsx
+++ b/frontend/src/pages/atlas/SpecIdPage.test.tsx
@@ -37,6 +37,8 @@ function renderAt(path: string, getSaved: AtlasGateway['getSaved'], state?: unkn
     getSaved,
     update: pending,
     history: pending,
+    manufacturers: pending,
+    setManufacturerStage: pending,
     library: pending,
   };
   const router = createMemoryRouter(
````

### C. `invented-workbook.cjs` (for Step 6.6; never committed)

````js
// Writes an invented workbook in the verified list's layout: never Source One data (ADR 0027).
const { createRequire } = require('node:module');
const ExcelJS = createRequire(`${process.argv[2]}/backend/package.json`)('exceljs');
const book = new ExcelJS.Workbook();
const sheet = book.addWorksheet('Main Table');
const rows = [
  // company, country, item name, category, material, dimension, FOB per unit, per case, sample, production
  ['Acme Packaging', 'Atlantis', 'Invented PP cup, 12oz', 'Cup', 'Plastic - PP', 90, 0.0123, 12.3, 7, 30],
  ['Acme Packaging', 'Atlantis', 'Invented PP cup, 12oz', 'Cup', 'Plastic - PP', 90, 0.0119, 11.9, 7, '25-30 days'],
  ['Borealis Boxes', 'Lemuria', 'Invented PP cup, 12oz', 'Cup', 'Plastic - PP', 90, 0.015, 15, 10, 35],
  ['Cascade Cartons', 'Hyperborea', 'Invented PP cup, 12oz', 'Cup', 'Plastic - PP', 90, 0.014, 14, 5, 28],
  ['Dune Packaging', 'Mu', 'Invented PP cup, 12oz', 'Cup', 'Plastic - PP', 90, 'N/A', 'N/A', '', ''],
  ['Acme Packaging', 'Atlantis', 'Invented PET lid, 90mm', 'Lid', 'Plastic - PET', 90, 0.0088, 8.8, 7, 30],
];
rows.forEach((values, index) => {
  const r = index + 4;
  const [company, country, item, category, material, dimension, unit, perCase, sample, production] = values;
  Object.entries({ A: company, B: country, C: item, D: category, E: material, F: dimension, O: unit, P: perCase, T: sample, U: production })
    .forEach(([column, value]) => { if (value !== '') sheet.getCell(`${column}${r}`).value = value; });
  sheet.getCell(`O${r}`).numFmt = '"$"#,##0.0000';
  sheet.getCell(`P${r}`).numFmt = '"$"#,##0.00';
});
book.xlsx.writeFile(process.argv[3]).then(() => console.log('wrote', process.argv[3]));
````

### D. The owner's own steps (not for the builder)

1. Audit the pull request with `/go-dark:audit-pr`, then merge it. Merging closes #57.
2. After "Deploy staging" for the merge commit succeeds (GitHub › S1-GLOBAL/s1-gateway › Actions › Deploy staging), plan 0008 Step 2.7 on https://s1-gateway-staging.vercel.app/:
   1. Atlas › Library: open a Spec ID, and see its manufacturers grouped by stage, with their quotes.
   2. As an admin, mark one as sampling; see it move, with "Set to Sampling by …".
   3. Clear it.
   4. Open the Spec ID page from **Open Spec ID**.
3. Write what you checked as a comment on #57, and tick #57's Verify items and plan 0008's Step 2.7.

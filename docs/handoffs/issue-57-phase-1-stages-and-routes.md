# Handoff: #57, phase 1 — Manufacturers' stages and the two manufacturer routes

STATUS: COMPLETE.
Written for: whoever builds plan 0008's phase 1 for #57, with no memory of earlier conversations.
Based on `main` at commit `d709072ae0a3752fefc6473dd2bc4c92c2108f48`, 2026-10-23.

## 0. The pull requests, and when to stop

| Order | Branch | Title | What goes in it |
|---|---|---|---|
| PR 1 | `feat/57-manufacturer-stages-api` | Record manufacturers' stages and add the two manufacturer routes | Steps 6.1–6.6 |

- This handoff is phase 1 only, one pull request, "Part of #57". Phase 2,
  the page, gets its own handoff after this merges.
- Build it on a fresh branch from the latest `main`:
  `git fetch origin` then `git switch -c feat/57-manufacturer-stages-api origin/main`.
- After you open the pull request and CI passes, do section 7's last items,
  then STOP. Send your report (section 7, item 12) and wait.

## 1. What you are building

The backend for #57's Manufacturers page:

- **Reading.** `GET /api/v1/atlas/saved/:id/manufacturers` lets any signed-in staff member read a Spec ID's manufacturers, each once, with its stage and every quote the verified-list import recorded.
- **The stages.** Two come from the quotes: "Quoted" when a quote has a per-unit or per-case price, else "Specifications received". The other two, Sampling and In production, are set by an admin with `PUT …/manufacturers/:manufacturerId/stage`. Anyone who is not an admin gets 403 from the existing admin gate.
- **The record.** Every change goes in a new insert-only table, with who, when, and the stage before and after.

There is no UI in this pull request.

## 2. Decisions already made — final

Decided by reyxdz on 2026-10-22 (#57) and 2026-10-23 (plan 0008, merged in #68). Do not change these. Do not ask about them again.

| Topic | Decision |
|---|---|
| Who reads manufacturers and prices | Every signed-in staff member |
| Who sets Sampling or In production | Admins only (`ACCOUNT_ADMIN_EMAILS`), forward or back, every change recorded |
| How stages combine | An admin-set stage shows over the quotes' stage; clearing it (`null`) returns to the quotes' stage; a re-import never touches it |
| The quotes' stage | "Quoted" when any quote's per-unit or per-case price has a price, else "Specifications received" |
| Number of pull requests | Two for #57: this one ("Part of #57"), then the page ("Closes #57") |
| What is a price | A value with at least one digit. `N/A`, `-` and `/` are not prices: the verified list writes them in price cells *(technical call, plan 0008)* |
| How admins are enforced | The `PUT` sits in a second Atlas router mounted with `access: 'admin'`, behind the existing admin gate, as `/accounts` is *(technical call, plan 0008)* |
| How changes are stored | Insert-only; the newest change is the current stage; in one transaction with the manufacturer's row locked, so two admins at once each record the stage they replaced *(technical call, plan 0008)* |
| Setting the stage it already has | Answers 200 and records nothing *(technical call, plan 0008)* |
| A manufacturer with no quote on the Spec ID, or an id that is not one | 404 `MANUFACTURER_NOT_FOUND`, "This manufacturer has no quote on this Spec ID." *(technical call, plan 0008)* |
| Index name | `atlas_stage_changes_spec_manufacturer_idx`: Postgres cuts names at 63 characters, and the longer name was 65 *(technical call)* |

## 3. Ground truth

Read from the code at commit `d709072ae0a3752fefc6473dd2bc4c92c2108f48`. If what you see differs from
any row, STOP and ask. Do not adapt.

| Fact | Where to find it | Value |
|---|---|---|
| The last migration | `git ls-files backend/drizzle` | `0013_atlas_manufacturers_and_quotes.sql`; there are 14 `.sql` files |
| Migrations are generated | `backend/package.json`, search `"db:generate"` | `drizzle-kit generate`; run from `backend/` as `npm run db:generate -- --name <name>` (ADR 0005) |
| The sourcing port | `backend/src/modules/atlas/domain/sourcing/sourcing-repository.ts`, search `export interface SourcingRepository` | Has `replaceQuotes` and `quotesOf` only |
| How admin routes are gated | `backend/src/shared/presentation/http/create-app.ts`, search `adminModules` | Session modules mount first, then `api.use(options.adminGate)`, then admin modules |
| The admin gate's refusal | `backend/src/modules/accounts/presentation/session-gate.ts`, search `createAdminGate` | 403 `NOT_ALLOWED`, "You are not allowed to do that." |
| How Atlas is mounted | `backend/src/modules/atlas/index.ts`, search `return { path: '/atlas'` | One module, `access: 'session'`; `buildAtlasModule` returns `HttpModule` |
| Where modules are composed | `backend/src/compose.ts`, search `buildAtlasModule({` | Listed once in `modules: [...]`, not spread |
| The Atlas controller | `backend/src/modules/atlas/presentation/atlas.controller.ts`, search `private readonly readSpecIdText` | The constructor's last parameter |
| The route file's comment | `backend/src/modules/atlas/presentation/atlas.routes.ts`, search `there is no PUT and no DELETE` | One line, changed by the patch |
| Tables emptied between tests | `backend/src/test/database.ts`, search `truncate table` | Starts `account_invites, atlas_quotes, atlas_manufacturers,` |
| Atlas's own truncate | `backend/src/atlas.db.test.ts`, search `truncate table atlas_quotes` | One line, changed by the patch |
| api.md's old sentence | `docs/reference/api.md`, search `on any Atlas` | "`PUT` and `DELETE` on any Atlas path answer 404", replaced by the patch |
| Commands (repository root) | `package.json` `"scripts"` | `typecheck`, `lint`, `arch:check`, `design:check`, `docs:check`, `test:unit`, `test` (needs `db:up`), `build`, `check:pr`, `db:up`, `db:down` |
| One test folder | run from `backend/` | `npx vitest run --config vitest.unit.config.ts <path>` for unit tests; `npx vitest run <path>` for `*.db.test.ts` (needs `npm run db:up`) |
| Lockfiles | `backend/package-lock.json`, `frontend/package-lock.json` | No root lockfile; this change adds no dependency |

## 4. The design

Plan 0008's "Design" section is the specification
(`docs/plans/0008-manufacturers-page.md`); the patch in Appendix B implements
phase 1 of it. In short:

| Route | Who | Answers |
|---|---|---|
| `GET /api/v1/atlas/saved/:id/manufacturers` | any signed-in staff member | 200 `{ data: SpecIdManufacturers }`; 401 without a session; 404 `SPEC_ID_NOT_FOUND` for an unknown id or one that is not a UUID |
| `PUT /api/v1/atlas/saved/:id/manufacturers/:manufacturerId/stage`, body `{ "stage": "sampling" \| "in-production" \| null }` | admins | 200 `{ data: SpecIdManufacturer }`; 401 without a session; 403 `NOT_ALLOWED` for anyone else, recording nothing; 400 `VALIDATION_FAILED` for any other body; 404 `SPEC_ID_NOT_FOUND`; 404 `MANUFACTURER_NOT_FOUND` |

| When | The API says |
|---|---|
| Not an admin | 403 `NOT_ALLOWED`: "You are not allowed to do that." (existing) |
| Unknown Spec ID | 404 `SPEC_ID_NOT_FOUND`: "This Spec ID doesn't exist. It may have been typed wrong." (existing) |
| Manufacturer with no quote on it | 404 `MANUFACTURER_NOT_FOUND`: "This manufacturer has no quote on this Spec ID." (new) |

Limits: none. The route reads one Spec ID's quotes, and the body is one field.

## 5. Setup — before any change

1. Read: `docs/plans/0008-manufacturers-page.md` (Design and Phase 1), and
   `backend/src/modules/atlas/domain/sourcing/sourcing-repository.ts`.
2. Use a scratch folder outside the repository for temporary files: the
   one your tool gives you; if it gives none, `/tmp/going-dark` on macOS and
   Linux, `%TEMP%\going-dark` on Windows.
3. Local processes you may run: only the project's own database, with
   `npm run db:up` from the repository root, for the database tests. Stop it at
   the end with `npm run db:down`. Never start anything else (no dev server,
   no browser).
4. Baseline. Before changing anything, from the repository root, run:
   ```
   npm run typecheck
   npm run lint
   npm run arch:check
   npm run test:unit
   ```
   All must pass. If any fails before you changed anything, STOP and report it.

## 6. PR 1 — Record manufacturers' stages and add the two manufacturer routes

### Step 6.1 — Apply the patch

**Action:** Copy the patch in Appendix B, exactly, from the line starting
`diff --git` to its last line, into `<scratch folder>/57-phase1.patch`. From
the repository root:
```
git apply --check "<scratch folder>/57-phase1.patch"
git apply "<scratch folder>/57-phase1.patch"
```

**Check:** `git apply --check` prints nothing and exits 0. `git status --short`
then lists 27 entries: 8 new files (`??`) and 19 changed (` M`). Every one is
under `backend/src/` or `docs/`. If this handoff is not yet committed to
`main`, the list may also hold `docs/handoffs/README.md` and
`docs/handoffs/issue-57-phase-1-stages-and-routes.md`: leave those two alone
and never add them to your commit. If `--check` reports an error, do not edit
the patch by hand: STOP and ask.

### Step 6.2 — Generate the migration

**Action:** From `backend/`:
```
npm run db:generate -- --name atlas_manufacturer_stage_changes
npm run db:generate
```

**Check:**
- The first command creates `backend/drizzle/0014_atlas_manufacturer_stage_changes.sql`, `backend/drizzle/meta/0014_snapshot.json`, and a change to `backend/drizzle/meta/_journal.json`.
- The SQL file's text is exactly Appendix C. Save Appendix C to `<scratch folder>/0014-expected.sql`, then, from the repository root, run the command below. It prints `same`. Drizzle writes the file with no final line break, and the command ignores that one difference.
  ```
  node -e "const fs=require('fs');const [a,b]=process.argv.slice(1).map((f)=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n').trimEnd());console.log(a===b?'same':'DIFFERENT')" "<scratch folder>/0014-expected.sql" backend/drizzle/0014_atlas_manufacturer_stage_changes.sql
  ```
- The second command prints "No schema changes, nothing to migrate".
- If the SQL differs, STOP and ask. Never edit a generated migration.

### Step 6.3 — The new unit tests

**Action:** From `backend/`:
```
npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/sourcing/stage.test.ts src/modules/atlas/application/manufacturers.test.ts
npx vitest run --config vitest.unit.config.ts src/modules/atlas
```

**Check:** the first prints `Test Files  2 passed (2)` and `Tests  18 passed (18)`;
the second `Test Files  32 passed (32)` and `Tests  457 passed (457)`.

### Step 6.4 — The database tests

**Action:** From the repository root `npm run db:up`, then from `backend/`:
```
npx vitest run src/modules/atlas/infrastructure/drizzle-sourcing-repository.db.test.ts src/atlas-manufacturers.db.test.ts
```

**Check:** it prints `Test Files  2 passed (2)` and `Tests  15 passed (15)`.
Among them: "refuses staff who are not admins with 403 NOT_ALLOWED, and records
nothing" and "leaves a stage an admin set as it was when the import replaces
the quotes again".

If instead the run stops before any test, in the global setup's `db:migrate`,
with `relation "atlas_manufacturer_stage_changes" already exists`, your local
test database holds a migration from another branch. Drop the **test**
database only, then run the command again; the setup recreates it:
```
docker exec s1-gateway-postgres psql -U s1gateway -d postgres -c "DROP DATABASE IF EXISTS s1_gateway_test WITH (FORCE);"
```
Never drop `s1_gateway`, the development database.

### Step 6.5 — Every check

**Action:** From the repository root:
```
npm run typecheck
npm run lint
npm run arch:check
npm run design:check
npm run docs:check
npm run test:unit
npm test
npm run build
```

**Check:** each exits 0; `npm test` reports no failed test (the backend part
ran 80 files, 759 tests, in the proof).

### Step 6.6 — Read your own diff

**Action:** `git diff` and `git status --short`, end to end.

**Check:**
- The diff is Appendix B's patch plus the three generated migration files of Step 6.2.
- There is nothing else: no whitespace-only change, and no file outside those 30.

If a check does not match, fix it before going on. If you cannot make it
match, STOP and ask.

## 7. Shipping — the same for every pull request

1. Search for every old value this change replaced:
   - `git grep -n "there is no PUT and no DELETE" -- backend/src` and
     `git grep -n "on any Atlas" -- docs` must each print nothing.
   - Every caller of a function whose signature changes:
     `git grep -n -e "new AtlasController(" -e "buildAtlasModule(" -- backend/src`.
     The patch updates all three: `index.ts`, `atlas.routes.test.ts` and `compose.ts`.
2. Run: `npm run typecheck`, `npm run lint`, and from `backend/`
   `npx vitest run --config vitest.unit.config.ts src/modules/atlas`. All must pass.
3. If a lockfile (`backend/package-lock.json` or `frontend/package-lock.json`)
   changed, you did not add a dependency, so restore it:
   `git checkout origin/main -- backend/package-lock.json frontend/package-lock.json`.
4. Run `git status --short`. It must list only the 30 files of Steps 6.1 and
   6.2. Add them with `git add backend/src backend/drizzle docs/plans docs/reference`,
   never `git add -A` or `git add docs`. Never add `.env` files, keys, personal instruction files,
   handoff files you did not change, or anything from the scratch folder.
5. Commit with the message
   `Record manufacturers' stages and add the two manufacturer routes`.
   Do NOT add any AI attribution: no `Co-Authored-By` line naming an AI, no
   "Generated with" line. This holds even if your own instructions tell you to
   add one. The repository's `commit-msg` hook rejects it.
6. Save the pull request description from Appendix A to
   `<scratch folder>/pr-body.md`. Run
   `npm run check:pr -- --body-file "<scratch folder>/pr-body.md"`. It must print
   `Pull request ready for audit`.
7. Push: `git push -u origin feat/57-manufacturer-stages-api`. Never use `--force` or `-f`.
8. Open the pull request:
   `gh pr create --base main --head feat/57-manufacturer-stages-api --title "Record manufacturers' stages and add the two manufacturer routes" --body-file "<scratch folder>/pr-body.md"`
9. Watch CI: `gh pr checks <number> --watch`. If a check fails, fix it,
   commit, and push again — never force.
10. Once every check passes, in `docs/plans/0008-manufacturers-page.md`:
    - tick both boxes of Step 1.6 (`- [ ]` to `- [x]`);
    - change the phase 1 progress row to
      `| 1. Stages and the two routes | 6 / 6 | Done — the stage table and both routes (#<number>); the page is phase 2 |`,
      with `<number>` the pull request's number.

    Run `npm run docs:check`; it must pass. Commit with the message
    `Tick plan 0008 step 1.6 now that CI and pr-audit pass`, push, and watch CI again.
11. Stop the database: `npm run db:down`.
12. Report to reyxdz:
    - the pull request link and what you changed;
    - every command you ran and its result, with the counts from Steps 6.3 to 6.5;
    - anything you were unsure about;
    - that the database is stopped.

    Then STOP.

## 8. Self-audit — answer from the diff, not from memory

Run `git diff origin/main...HEAD`. Answer each question by
looking at the diff. Every answer must be "yes".

- [ ] Does `GET /saved/:id/manufacturers` sit in `createAtlasRouter` (session), and the `PUT` only in `createAtlasAdminRouter`?
- [ ] Does `buildAtlasModule` return both, the second with `access: 'admin'`, and does `compose.ts` spread it?
- [ ] Does `hasPrice` require a digit, with tests for `N/A`, `-` and `/`?
- [ ] Does `stageOf` take an admin's stage over the quotes, and the quotes' stage once it is `null`?
- [ ] Does `recordStageChange` lock the manufacturer's row, read the newest change, and record nothing when the stage is unchanged?
- [ ] Is `atlas_manufacturer_stage_changes` only ever inserted into, never updated or deleted, in the diff?
- [ ] Does the import code (`import-verified-list.ts`, `replaceQuotes`) stay unchanged?
- [ ] Is the migration generated (Step 6.2), not written by hand?
- [ ] Do the composed tests cover 401, 403 with nothing recorded, 200 with who/when/before/after, 400, and both 404s?
- [ ] Is every manufacturer, item and price in the tests invented (Acme Packaging, Borealis Boxes, Cascade Cartons, Atlantis, Lemuria)?
- [ ] Do `api.md` and `data-model.md` describe both routes and the table?
- [ ] Does the diff change only the 30 files of Steps 6.1 and 6.2, plus the plan in item 10?
- [ ] Is there no secret, key, password or personal data in the diff?
- [ ] Is there no AI attribution in any commit message?

## 9. When to stop and ask

STOP, do nothing else, and ask reyxdz when:

- the code differs from section 3;
- `git apply --check` fails, or the generated SQL differs from Appendix C;
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

Phase 1 of plan 0008: the backend for #57's Manufacturers page.

- **Reading:** `GET /api/v1/atlas/saved/:id/manufacturers` answers a Spec ID's manufacturers, each once, by name, with its stage and every quote the verified-list import recorded. Any signed-in staff member may call it.
- **The stage rule:** a manufacturer's stage is the one an admin set (Sampling or In production). Otherwise it is "Quoted" when a quote's per-unit or per-case price holds a digit, else "Specifications received". `N/A`, `-` and `/` are not prices.
- **Setting a stage:** `PUT …/manufacturers/:manufacturerId/stage` sets the stage, or clears it with `null`. It is mounted behind the existing admin gate, so anyone else gets 403 `NOT_ALLOWED` before any Atlas code runs, as on `/accounts` (ADR 0027).
- **The record:** every change goes in a new insert-only table, `atlas_manufacturer_stage_changes`, with who, when, and the stage before and after. The import never touches it.

The Manufacturers page itself is phase 2.

Plan / issue: docs/plans/0008-manufacturers-page.md (phase 1) · Part of #57

## Acceptance criteria

- [x] Step 1.1: `atlas_manufacturer_stage_changes`, by migration `0014_atlas_manufacturer_stage_changes` made with `npm run db:generate`; running it again makes no new migration.
- [x] Step 1.2: `stageOf` and `hasPrice`. A per-unit price, or only a per-case one, is Quoted; no price is Specifications received; `N/A`, `-` and `/` are not prices; an admin-set Sampling wins over Quoted; `null` hands back to the quotes.
- [x] Step 1.3: `currentStages` and `recordStageChange`, Drizzle and in-memory. Tested on the database:
  - a change records who, when, before and after;
  - the same stage twice records one change, and clearing records `null` after;
  - after a stage is set, `replaceQuotes` with the same rows leaves it set;
  - two changes made at once each record the stage they replaced.
- [x] Step 1.4: `GetSpecIdManufacturers` and `SetManufacturerStage`. Tested:
  - three quotes from one manufacturer give one entry with three quotes;
  - Quoted and Specifications received are told apart;
  - Sampling shows over Quoted, and clearing it shows Quoted again;
  - `stageSet` names who and when;
  - `SPEC_ID_NOT_FOUND` and `MANUFACTURER_NOT_FOUND` record nothing.
- [x] Step 1.5: contract types, the body schema, both handlers, `createAtlasAdminRouter`, and `buildAtlasModule` returning both modules. Composed database route tests:
  - `GET`: 401 without a session, 404 for an unknown id and for a non-id, 200 for staff;
  - `PUT`: 403 `NOT_ALLOWED` for staff with nothing recorded, 200 for an admin with who, when, before and after recorded, 400 for `{ "stage": "quoted" }`, 404 for an unknown manufacturer or Spec ID, 401 without a session.
- [x] Step 1.6: `api.md` documents both routes, their access and statuses, and `MANUFACTURER_NOT_FOUND`; `data-model.md` documents the table.

## What changed

- **Database:** `backend/drizzle/0014_atlas_manufacturer_stage_changes.sql` creates `atlas_manufacturer_stage_changes`, with foreign keys to `atlas_spec_ids`, `atlas_manufacturers` and `accounts`, a check on the two stage values, and an index on `(spec_id, manufacturer_id, changed_at)`.
- **API:** two new routes and one new error code:
  - `GET /api/v1/atlas/saved/:id/manufacturers` (session), 200 `{ data: SpecIdManufacturers }`;
  - `PUT /api/v1/atlas/saved/:id/manufacturers/:manufacturerId/stage` (admin), with body `{ stage: "sampling" | "in-production" | null }`, 200 `{ data: SpecIdManufacturer }`;
  - the new error `MANUFACTURER_NOT_FOUND` (404).
- **UI:** none. The page is phase 2.
- **Config:** none. Admins are the existing `ACCOUNT_ADMIN_EMAILS`.

## How to verify

1. `npm run setup`, `npm run db:up`, then `npm test`. The new tests are:
   - `backend/src/modules/atlas/domain/sourcing/stage.test.ts`;
   - `backend/src/modules/atlas/application/manufacturers.test.ts`;
   - the "stages (#57)" block in `drizzle-sourcing-repository.db.test.ts`;
   - `backend/src/atlas-manufacturers.db.test.ts`.
2. From `backend/`, `npm run db:generate` prints "No schema changes, nothing to migrate".
3. In `atlas-manufacturers.db.test.ts`, "refuses staff who are not admins with 403 NOT_ALLOWED, and records nothing" passes.

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

Migration 0014 only creates an empty table. Both routes are new, so nothing that calls the API today changes. Staging's deploy runs the migration before the API starts.

## Known gaps and risks

- No page uses these routes yet; phase 2 adds it. #57's staging check comes after phase 2.
- `MANUFACTURER_NOT_FOUND`'s message, "This manufacturer has no quote on this Spec ID.", is a technical call in plan 0008. Users see it only on a page left open while the data changed.
- `api.md` said `PUT` and `DELETE` on any Atlas path answer 404. It now says there is no `PUT` or `DELETE` for a saved Spec ID, and that the one Atlas `PUT` sets a manufacturer's stage.

## Checklist

- [x] One feature; no unrelated refactors or reformatting
- [x] `npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm run design:check`, `npm test`, `npm run build` and `npm run docs:check` pass locally
- [x] New behaviour has tests, including the unhappy paths; a bug fix has a test that fails without it
- [x] No secrets, `.env`, `tmp/` files, or lockfile changes unless dependencies changed
- [x] Docs updated where the change makes them wrong (`api.md`, `data-model.md`, plan boxes, an ADR for an expensive-to-reverse choice)
- [x] I read my own diff end to end and ran the feature locally
````

### B. The patch

Everything except the generated migration (Step 6.2). Copy from `diff --git`
to the last line.

````diff
diff --git a/backend/src/atlas-manufacturers.db.test.ts b/backend/src/atlas-manufacturers.db.test.ts
new file mode 100644
index 0000000..72f898b
--- /dev/null
+++ b/backend/src/atlas-manufacturers.db.test.ts
@@ -0,0 +1,162 @@
+import { count, sql } from 'drizzle-orm';
+import request from 'supertest';
+import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
+import { composeApp } from './compose.js';
+import { atlasManufacturerStageChanges } from './modules/atlas/infrastructure/atlas-manufacturer-stage-changes.table.js';
+import { DrizzleSourcingRepository } from './modules/atlas/infrastructure/drizzle-sourcing-repository.js';
+import { createAdmin } from './scripts/create-admin.js';
+import { FixedClock, SequentialIdGenerator, silentLogger } from './shared/application/testing/fakes.js';
+import { connectTestDatabase, resetTables } from './test/database.js';
+
+const ADMIN = 'admin@sourceone.global';
+const STAFF = 'staff@sourceone.global';
+const PASSWORD = 'correct-horse-battery';
+const NOW = new Date('2026-10-23T08:00:00.000Z');
+const UNKNOWN = '00000000-0000-4000-8000-0000000000ff';
+
+const connection = connectTestDatabase();
+const app = composeApp({
+  db: connection.db,
+  logger: silentLogger,
+  clock: new FixedClock(NOW),
+  ids: new SequentialIdGenerator(),
+  corsOrigin: 'http://localhost:5173',
+  accountAdminEmails: [ADMIN],
+  cookieSecure: false,
+});
+
+let admin: ReturnType<typeof request.agent>;
+let staff: ReturnType<typeof request.agent>;
+let adminId: string;
+
+/** Signs in an account made like the admin, but only `email` in its own list: the app's list decides who is an admin. */
+async function signedIn(email: string, firstName: string): Promise<ReturnType<typeof request.agent>> {
+  const created = await createAdmin(connection.db, {
+    email,
+    firstName,
+    lastName: 'Invented',
+    password: PASSWORD,
+    nodeEnv: 'test',
+    accountAdminEmails: [email],
+  });
+  if (!created.ok) throw new Error(created.error);
+  const agent = request.agent(app);
+  const signIn = await agent.post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
+  if (signIn.status !== 200) throw new Error(`sign-in failed: ${signIn.status}`);
+  return agent;
+}
+
+beforeAll(async () => {
+  await resetTables(connection.db);
+  admin = await signedIn(ADMIN, 'Ada');
+  staff = await signedIn(STAFF, 'Ben');
+  adminId = (await admin.get('/api/v1/auth/me')).body.data.id;
+});
+beforeEach(async () => {
+  await connection.db.execute(
+    sql`truncate table atlas_manufacturer_stage_changes, atlas_quotes, atlas_manufacturers, atlas_spec_id_changes, atlas_spec_ids`,
+  );
+});
+afterAll(() => connection.close());
+
+/** Saves an invented cup and records two invented manufacturers' quotes on it. Never Source One data (ADR 0027). */
+async function cupWithQuotes(): Promise<{ id: string; acme: string }> {
+  const saved = await admin.post('/api/v1/atlas/spec-ids').send({ name: 'Invented PP cup', facts: { productType: 'CUP', material: 'APP' } });
+  const id: string = saved.body.data.id;
+  const values = (fobPerUnit: string | null) => ({
+    itemName: 'Invented PP cup',
+    fobPerUnit,
+    fobPerCase: null,
+    fobTotal: null,
+    moldCost: null,
+    moldLeadTime: null,
+    sampleLeadTime: '7',
+    productionLeadTime: '30 days',
+  });
+  const sourcing = new DrizzleSourcingRepository(connection.db);
+  await sourcing.replaceQuotes([
+    { id: crypto.randomUUID(), specId: id, manufacturer: { id: crypto.randomUUID(), name: 'Acme Packaging', country: 'Atlantis' }, values: values('$0.0123'), importedAt: NOW },
+    { id: crypto.randomUUID(), specId: id, manufacturer: { id: crypto.randomUUID(), name: 'Borealis Boxes', country: null }, values: values('N/A'), importedAt: NOW },
+  ]);
+  const acme = (await sourcing.quotesOf(id)).find((record) => record.manufacturer.name === 'Acme Packaging')?.manufacturer.id as string;
+  return { id, acme };
+}
+
+const stageChanges = async () => (await connection.db.select({ n: count() }).from(atlasManufacturerStageChanges))[0]?.n;
+const stagePath = (id: string, manufacturerId: string) => `/api/v1/atlas/saved/${id}/manufacturers/${manufacturerId}/stage`;
+
+describe('GET /api/v1/atlas/saved/:id/manufacturers', () => {
+  it('answers each manufacturer once, by name, with its stage and quotes, to any signed-in staff member', async () => {
+    const { id } = await cupWithQuotes();
+
+    const response = await staff.get(`/api/v1/atlas/saved/${id}/manufacturers`);
+
+    expect(response.status).toBe(200);
+    expect(response.body.data.specId).toMatchObject({ id, name: 'Invented PP cup' });
+    expect(response.body.data.manufacturers).toEqual([
+      expect.objectContaining({ name: 'Acme Packaging', country: 'Atlantis', stage: 'quoted', stageSet: null, quotes: [expect.objectContaining({ fobPerUnit: '$0.0123', productionLeadTime: '30 days' })] }),
+      expect.objectContaining({ name: 'Borealis Boxes', country: null, stage: 'specifications-received', stageSet: null }),
+    ]);
+  });
+
+  it('answers 401 without a session, and 404 SPEC_ID_NOT_FOUND for an unknown id or one that is not an id', async () => {
+    expect((await request(app).get(`/api/v1/atlas/saved/${UNKNOWN}/manufacturers`)).status).toBe(401);
+    for (const id of [UNKNOWN, 'not-an-id']) {
+      const response = await staff.get(`/api/v1/atlas/saved/${id}/manufacturers`);
+      expect(response.status).toBe(404);
+      expect(response.body.error.code).toBe('SPEC_ID_NOT_FOUND');
+    }
+  });
+});
+
+describe('PUT /api/v1/atlas/saved/:id/manufacturers/:manufacturerId/stage', () => {
+  it('refuses staff who are not admins with 403 NOT_ALLOWED, and records nothing', async () => {
+    const { id, acme } = await cupWithQuotes();
+
+    const response = await staff.put(stagePath(id, acme)).send({ stage: 'sampling' });
+
+    expect(response.status).toBe(403);
+    expect(response.body.error).toEqual({ code: 'NOT_ALLOWED', message: 'You are not allowed to do that.' });
+    expect(await stageChanges()).toBe(0);
+  });
+
+  it('sets the stage for an admin, answers the manufacturer, and records who, when, before and after', async () => {
+    const { id, acme } = await cupWithQuotes();
+
+    const response = await admin.put(stagePath(id, acme)).send({ stage: 'sampling' });
+
+    expect(response.status).toBe(200);
+    expect(response.body.data).toMatchObject({
+      id: acme,
+      stage: 'sampling',
+      stageSet: { by: { id: adminId, fullName: 'Ada Invented' }, at: NOW.toISOString(), stage: 'sampling' },
+    });
+    const [row] = await connection.db.select().from(atlasManufacturerStageChanges);
+    expect(row).toMatchObject({ specId: id, manufacturerId: acme, stageBefore: null, stageAfter: 'sampling', changedBy: adminId, changedAt: NOW });
+
+    const cleared = await admin.put(stagePath(id, acme)).send({ stage: null });
+    expect(cleared.body.data).toMatchObject({ stage: 'quoted', stageSet: { stage: null } });
+    expect(await stageChanges()).toBe(2);
+  });
+
+  it('answers 400 VALIDATION_FAILED for any other stage, and 404 for an unknown manufacturer or Spec ID', async () => {
+    const { id, acme } = await cupWithQuotes();
+
+    const invalid = await admin.put(stagePath(id, acme)).send({ stage: 'quoted' });
+    const noManufacturer = await admin.put(stagePath(id, UNKNOWN)).send({ stage: 'sampling' });
+    const notAnId = await admin.put(stagePath(id, 'not-an-id')).send({ stage: 'sampling' });
+    const noSpecId = await admin.put(stagePath(UNKNOWN, acme)).send({ stage: 'sampling' });
+
+    expect([invalid.status, invalid.body.error.code]).toEqual([400, 'VALIDATION_FAILED']);
+    expect([noManufacturer.status, noManufacturer.body.error.code]).toEqual([404, 'MANUFACTURER_NOT_FOUND']);
+    expect([notAnId.status, notAnId.body.error.code]).toEqual([404, 'MANUFACTURER_NOT_FOUND']);
+    expect([noSpecId.status, noSpecId.body.error.code]).toEqual([404, 'SPEC_ID_NOT_FOUND']);
+    expect(await stageChanges()).toBe(0);
+  });
+
+  it('answers 401 without a session', async () => {
+    const response = await request(app).put(stagePath(UNKNOWN, UNKNOWN)).send({ stage: 'sampling' });
+
+    expect(response.status).toBe(401);
+  });
+});
diff --git a/backend/src/atlas.db.test.ts b/backend/src/atlas.db.test.ts
index 9873375..83581bb 100644
--- a/backend/src/atlas.db.test.ts
+++ b/backend/src/atlas.db.test.ts
@@ -53,7 +53,7 @@ beforeAll(async () => {
   await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });
 });
 beforeEach(async () => {
-  await connection.db.execute(sql`truncate table atlas_quotes, atlas_manufacturers, atlas_spec_id_changes, atlas_spec_ids`);
+  await connection.db.execute(sql`truncate table atlas_manufacturer_stage_changes, atlas_quotes, atlas_manufacturers, atlas_spec_id_changes, atlas_spec_ids`);
 });
 afterAll(() => connection.close());
 
diff --git a/backend/src/compose.ts b/backend/src/compose.ts
index 22bfd07..60576e5 100644
--- a/backend/src/compose.ts
+++ b/backend/src/compose.ts
@@ -41,7 +41,7 @@ export function composeApp(deps: AppDependencies): Express {
       buildHealthModule(),
       ...accounts.modules,
       buildToolsModule({ db: deps.db, clock: deps.clock, ids: deps.ids }),
-      buildAtlasModule({ db: deps.db, clock: deps.clock, ids: deps.ids }),
+      ...buildAtlasModule({ db: deps.db, clock: deps.clock, ids: deps.ids }),
     ],
   });
 }
diff --git a/backend/src/contracts/atlas.ts b/backend/src/contracts/atlas.ts
index c9c10e7..3230125 100644
--- a/backend/src/contracts/atlas.ts
+++ b/backend/src/contracts/atlas.ts
@@ -270,3 +270,41 @@ export interface SpecIdTextReading {
   conflicts: TextConflict[];
   decoded: DecodedSpecId | null;
 }
+
+/** A manufacturer's stage on a Spec ID (#57): the quotes give the first two, an admin the last two. */
+export type ManufacturerStage = 'specifications-received' | 'quoted' | 'sampling' | 'in-production';
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
+  /** The last change an admin made, if any; a cleared stage still shows who cleared it. ISO 8601 `at`. */
+  stageSet: { by: SavedBy; at: string; stage: 'sampling' | 'in-production' | null } | null;
+  quotes: ManufacturerQuote[];
+}
+
+/** `GET /atlas/saved/:id/manufacturers`. */
+export interface SpecIdManufacturers {
+  specId: { id: string; name: string; code: string };
+  /** By name. */
+  manufacturers: SpecIdManufacturer[];
+}
+
+/** `PUT /atlas/saved/:id/manufacturers/:manufacturerId/stage`, admins only. `null` clears the stage. */
+export interface SetManufacturerStageRequest {
+  stage: 'sampling' | 'in-production' | null;
+}
diff --git a/backend/src/database-schema.ts b/backend/src/database-schema.ts
index ca55219..e20d070 100644
--- a/backend/src/database-schema.ts
+++ b/backend/src/database-schema.ts
@@ -18,3 +18,4 @@ export { atlasSpecIds } from './modules/atlas/infrastructure/atlas-spec-ids.tabl
 export { atlasSpecIdChanges } from './modules/atlas/infrastructure/atlas-spec-id-changes.table.js';
 export { atlasManufacturers } from './modules/atlas/infrastructure/atlas-manufacturers.table.js';
 export { atlasQuotes } from './modules/atlas/infrastructure/atlas-quotes.table.js';
+export { atlasManufacturerStageChanges } from './modules/atlas/infrastructure/atlas-manufacturer-stage-changes.table.js';
diff --git a/backend/src/modules/atlas/application/atlas.dto.ts b/backend/src/modules/atlas/application/atlas.dto.ts
index 54d7ee6..eb25010 100644
--- a/backend/src/modules/atlas/application/atlas.dto.ts
+++ b/backend/src/modules/atlas/application/atlas.dto.ts
@@ -3,6 +3,7 @@ import type { SlotState, SpecId, SpecIdFactsInput } from '../domain/spec-id.js';
 import type { FormerHolderRecord, SavedSpecIdRecord } from '../domain/spec-id-repository.js';
 import type { Ruling } from '../domain/reading/size-rulings.js';
 import { DICTIONARY_SLOTS, slotDefinition, type SlotKey, type SlotRule } from '../domain/slots.js';
+import type { AdminStage, Stage } from '../domain/sourcing/stage.js';
 
 /** The dictionary as the application hands it outward. */
 export interface DictionaryDto {
@@ -235,3 +236,40 @@ export interface SpecIdTextReadingDto {
   /** Null until a product type is found or given. */
   decoded: DecodedSpecIdDto | null;
 }
+
+/** One verified-list row's quote, each value as the workbook shows it; null when empty (ADR 0027). */
+export interface ManufacturerQuoteDto {
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
+/** A manufacturer on one Spec ID, once, with its stage and every quote (#57). */
+export interface SpecIdManufacturerDto {
+  id: string;
+  name: string;
+  country: string | null;
+  stage: Stage;
+  /** The last change an admin made, if any; a cleared stage still names who cleared it. */
+  stageSet: { by: StaffDto; at: string; stage: AdminStage | null } | null;
+  quotes: ManufacturerQuoteDto[];
+}
+
+export interface SpecIdManufacturersDto {
+  specId: { id: string; name: string; code: string };
+  /** By name. */
+  manufacturers: SpecIdManufacturerDto[];
+}
+
+export interface SetManufacturerStageInput {
+  id: string;
+  manufacturerId: string;
+  /** Null clears the stage an admin set, handing it back to the quotes. */
+  stage: AdminStage | null;
+  by: StaffDto;
+}
diff --git a/backend/src/modules/atlas/application/get-spec-id-manufacturers.ts b/backend/src/modules/atlas/application/get-spec-id-manufacturers.ts
new file mode 100644
index 0000000..5f9e96a
--- /dev/null
+++ b/backend/src/modules/atlas/application/get-spec-id-manufacturers.ts
@@ -0,0 +1,58 @@
+import type { UseCase } from '../../../shared/application/use-case.js';
+import { err, ok, type Result } from '../../../shared/domain/result.js';
+import type { QuoteRecord, SourcingRepository, StageChangeRecord } from '../domain/sourcing/sourcing-repository.js';
+import { stageOf } from '../domain/sourcing/stage.js';
+import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
+import type { SpecIdRepository } from '../domain/spec-id-repository.js';
+import type { SavedSpecIdIdInput, SpecIdManufacturerDto, SpecIdManufacturersDto } from './atlas.dto.js';
+
+/**
+ * A saved Spec ID's manufacturers (#57): each once, by name, with its stage
+ * and every quote the verified-list import recorded for it.
+ */
+export class GetSpecIdManufacturers implements UseCase<SavedSpecIdIdInput, Result<SpecIdManufacturersDto, SpecIdNotFoundError>> {
+  constructor(
+    private readonly specIds: SpecIdRepository,
+    private readonly sourcing: SourcingRepository,
+  ) {}
+
+  async execute(input: SavedSpecIdIdInput): Promise<Result<SpecIdManufacturersDto, SpecIdNotFoundError>> {
+    const record = await this.specIds.findById(input.id);
+    if (!record) return err(new SpecIdNotFoundError('id'));
+    const { savedSpecId } = record;
+    return ok({
+      specId: { id: savedSpecId.id, name: savedSpecId.name, code: savedSpecId.specId.code },
+      manufacturers: await manufacturersOn(this.sourcing, savedSpecId.id),
+    });
+  }
+}
+
+/** Each manufacturer with a quote on the Spec ID, once, in the order its quotes come: by name. */
+export async function manufacturersOn(sourcing: SourcingRepository, specId: string): Promise<SpecIdManufacturerDto[]> {
+  const [quotes, stages] = await Promise.all([sourcing.quotesOf(specId), sourcing.currentStages(specId)]);
+  const changes = new Map(stages.map((record) => [record.change.manufacturerId, record]));
+  const byManufacturer = new Map<string, QuoteRecord[]>();
+  for (const record of quotes) {
+    byManufacturer.set(record.manufacturer.id, [...(byManufacturer.get(record.manufacturer.id) ?? []), record]);
+  }
+  return [...byManufacturer.values()].map((records) => toManufacturerDto(records, changes.get(records[0]?.manufacturer.id ?? '')));
+}
+
+function toManufacturerDto(records: readonly QuoteRecord[], set: StageChangeRecord | undefined): SpecIdManufacturerDto {
+  const manufacturer = (records[0] as QuoteRecord).manufacturer;
+  const values = records.map((record) => record.quote.values);
+  return {
+    id: manufacturer.id,
+    name: manufacturer.name,
+    country: manufacturer.country,
+    stage: stageOf(values, set?.change.stageAfter ?? null),
+    stageSet: set
+      ? {
+          by: { id: set.change.changedBy, fullName: set.changedByName },
+          at: set.change.changedAt.toISOString(),
+          stage: set.change.stageAfter,
+        }
+      : null,
+    quotes: values.map((value) => ({ ...value })),
+  };
+}
diff --git a/backend/src/modules/atlas/application/manufacturers.test.ts b/backend/src/modules/atlas/application/manufacturers.test.ts
new file mode 100644
index 0000000..688c91c
--- /dev/null
+++ b/backend/src/modules/atlas/application/manufacturers.test.ts
@@ -0,0 +1,148 @@
+import { describe, expect, it } from 'vitest';
+import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
+import type { QuoteValues } from '../domain/sourcing/quote.js';
+import { GetSpecIdManufacturers } from './get-spec-id-manufacturers.js';
+import { SaveSpecId } from './save-spec-id.js';
+import { SetManufacturerStage } from './set-manufacturer-stage.js';
+import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
+import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
+import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
+
+const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', fullName: 'Ada Admin' };
+const ACME = '00000000-0000-4000-8000-00000000ac01';
+const BOREALIS = '00000000-0000-4000-8000-00000000b001';
+const NOW = new Date('2026-10-23T08:00:00.000Z');
+
+/** An invented quote: never a Source One price (ADR 0027). */
+const values = (overrides: Partial<QuoteValues> = {}): QuoteValues => ({
+  itemName: 'Invented PP cup',
+  fobPerUnit: null,
+  fobPerCase: null,
+  fobTotal: null,
+  moldCost: null,
+  moldLeadTime: null,
+  sampleLeadTime: null,
+  productionLeadTime: null,
+  ...overrides,
+});
+
+async function setup() {
+  const dictionaries = new InMemoryDictionaryRepository();
+  const specIds = new InMemorySpecIdRepository();
+  const sourcing = new InMemorySourcingRepository();
+  sourcing.nameChanger(ADMIN.id, ADMIN.fullName);
+  const ids = new SequentialIdGenerator();
+  const clock = new FixedClock(NOW);
+  const save = new SaveSpecId(dictionaries, specIds, clock, ids);
+  const saved = async (material: string) => {
+    const result = await save.execute({ name: 'Invented cup', facts: { productType: 'CUP', material }, savedBy: ADMIN });
+    if (!result.ok) throw new Error('setup failed');
+    return result.value.id;
+  };
+  const cup = await saved('APP');
+  const other = await saved('APT');
+  const quote = (specId: string, manufacturerId: string, name: string, overrides: Partial<QuoteValues> = {}) => ({
+    id: ids.next(),
+    specId,
+    manufacturer: { id: manufacturerId, name, country: 'Atlantis' },
+    values: values(overrides),
+    importedAt: NOW,
+  });
+  await sourcing.replaceQuotes([
+    quote(cup, ACME, 'Acme Packaging', { itemName: 'Invented cup A', fobPerUnit: '$0.0123' }),
+    quote(cup, ACME, 'Acme Packaging', { itemName: 'Invented cup B', fobPerUnit: 'N/A' }),
+    quote(cup, ACME, 'Acme Packaging', { itemName: 'Invented cup C' }),
+    quote(cup, BOREALIS, 'Borealis Boxes', { fobPerUnit: 'N/A', fobPerCase: '-' }),
+    quote(other, '00000000-0000-4000-8000-00000000c001', 'Cascade Cartons', { fobPerUnit: '$0.0200' }),
+  ]);
+  return {
+    sourcing,
+    cup,
+    list: (id: string) => new GetSpecIdManufacturers(specIds, sourcing).execute({ id }),
+    setStage: (id: string, manufacturerId: string, stage: 'sampling' | 'in-production' | null) =>
+      new SetManufacturerStage(specIds, sourcing, clock, ids).execute({ id, manufacturerId, stage, by: ADMIN }),
+  };
+}
+
+describe('GetSpecIdManufacturers', () => {
+  it('lists a manufacturer with three quotes once, with all three, by name', async () => {
+    const { list, cup } = await setup();
+
+    const result = await list(cup);
+
+    if (!result.ok) throw new Error('expected manufacturers');
+    expect(result.value.manufacturers.map((m) => [m.name, m.quotes.length])).toEqual([
+      ['Acme Packaging', 3],
+      ['Borealis Boxes', 1],
+    ]);
+    expect(result.value.specId).toMatchObject({ id: cup, name: 'Invented cup' });
+  });
+
+  it('is Quoted with a per-unit price, and Specifications received with only N/A and -', async () => {
+    const { list, cup } = await setup();
+
+    const result = await list(cup);
+
+    if (!result.ok) throw new Error('expected manufacturers');
+    expect(result.value.manufacturers.map((m) => [m.name, m.stage, m.stageSet])).toEqual([
+      ['Acme Packaging', 'quoted', null],
+      ['Borealis Boxes', 'specifications-received', null],
+    ]);
+  });
+
+  it('answers SPEC_ID_NOT_FOUND for an id no Spec ID has', async () => {
+    const { list } = await setup();
+
+    const result = await list('00000000-0000-4000-8000-0000000000ff');
+
+    expect(!result.ok && result.error.code).toBe('SPEC_ID_NOT_FOUND');
+  });
+});
+
+describe('SetManufacturerStage', () => {
+  it('shows an admin-set Sampling over Quoted, naming who and when, and Quoted again once cleared', async () => {
+    const { setStage, list, cup } = await setup();
+
+    const set = await setStage(cup, ACME, 'sampling');
+
+    expect(set.ok && set.value).toMatchObject({
+      stage: 'sampling',
+      stageSet: { by: ADMIN, at: NOW.toISOString(), stage: 'sampling' },
+    });
+    const cleared = await setStage(cup, ACME, null);
+    expect(cleared.ok && cleared.value).toMatchObject({ stage: 'quoted', stageSet: { by: ADMIN, stage: null } });
+    const listed = await list(cup);
+    expect(listed.ok && listed.value.manufacturers[0]?.stage).toBe('quoted');
+  });
+
+  it('records who, when, and the stage before and after, and nothing for the stage it already has', async () => {
+    const { setStage, sourcing, cup } = await setup();
+
+    await setStage(cup, BOREALIS, 'sampling');
+    await setStage(cup, BOREALIS, 'sampling');
+    await setStage(cup, BOREALIS, 'in-production');
+
+    expect(sourcing.allStageChanges.map((c) => [c.stageBefore, c.stageAfter, c.changedBy, c.changedAt])).toEqual([
+      [null, 'sampling', ADMIN.id, NOW],
+      ['sampling', 'in-production', ADMIN.id, NOW],
+    ]);
+  });
+
+  it('answers MANUFACTURER_NOT_FOUND for a manufacturer whose quotes are on another Spec ID', async () => {
+    const { setStage, sourcing, cup } = await setup();
+
+    const result = await setStage(cup, '00000000-0000-4000-8000-00000000c001', 'sampling');
+
+    expect(!result.ok && result.error.code).toBe('MANUFACTURER_NOT_FOUND');
+    expect(sourcing.allStageChanges).toEqual([]);
+  });
+
+  it('answers SPEC_ID_NOT_FOUND for an id no Spec ID has, and records nothing', async () => {
+    const { setStage, sourcing } = await setup();
+
+    const result = await setStage('00000000-0000-4000-8000-0000000000ff', ACME, 'sampling');
+
+    expect(!result.ok && result.error.code).toBe('SPEC_ID_NOT_FOUND');
+    expect(sourcing.allStageChanges).toEqual([]);
+  });
+});
diff --git a/backend/src/modules/atlas/application/set-manufacturer-stage.ts b/backend/src/modules/atlas/application/set-manufacturer-stage.ts
new file mode 100644
index 0000000..95a294c
--- /dev/null
+++ b/backend/src/modules/atlas/application/set-manufacturer-stage.ts
@@ -0,0 +1,47 @@
+import type { Clock } from '../../../shared/application/ports/clock.js';
+import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
+import type { UseCase } from '../../../shared/application/use-case.js';
+import { err, ok, type Result } from '../../../shared/domain/result.js';
+import { ManufacturerNotFoundError } from '../domain/sourcing/sourcing.errors.js';
+import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
+import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
+import type { SpecIdRepository } from '../domain/spec-id-repository.js';
+import type { SetManufacturerStageInput, SpecIdManufacturerDto } from './atlas.dto.js';
+import { manufacturersOn } from './get-spec-id-manufacturers.js';
+
+export type SetManufacturerStageError = SpecIdNotFoundError | ManufacturerNotFoundError;
+
+/**
+ * Sets a manufacturer's stage on a Spec ID to Sampling or In production, or
+ * clears it, and records who, when, and the stage before and after (#57).
+ * Only admins reach it: the route sits behind the admin gate. Setting the
+ * stage it already has records nothing.
+ */
+export class SetManufacturerStage
+  implements UseCase<SetManufacturerStageInput, Result<SpecIdManufacturerDto, SetManufacturerStageError>>
+{
+  constructor(
+    private readonly specIds: SpecIdRepository,
+    private readonly sourcing: SourcingRepository,
+    private readonly clock: Clock,
+    private readonly ids: IdGenerator,
+  ) {}
+
+  async execute(input: SetManufacturerStageInput): Promise<Result<SpecIdManufacturerDto, SetManufacturerStageError>> {
+    if (!(await this.specIds.findById(input.id))) return err(new SpecIdNotFoundError('id'));
+    const quoted = (await this.sourcing.quotesOf(input.id)).some((record) => record.manufacturer.id === input.manufacturerId);
+    if (!quoted) return err(new ManufacturerNotFoundError());
+
+    await this.sourcing.recordStageChange({
+      id: this.ids.next(),
+      specId: input.id,
+      manufacturerId: input.manufacturerId,
+      stageAfter: input.stage,
+      changedBy: input.by.id,
+      changedAt: this.clock.now(),
+    });
+    const entry = (await manufacturersOn(this.sourcing, input.id)).find((manufacturer) => manufacturer.id === input.manufacturerId);
+    if (!entry) return err(new ManufacturerNotFoundError());
+    return ok(entry);
+  }
+}
diff --git a/backend/src/modules/atlas/application/testing/in-memory-sourcing-repository.ts b/backend/src/modules/atlas/application/testing/in-memory-sourcing-repository.ts
index a5a425e..4024cbc 100644
--- a/backend/src/modules/atlas/application/testing/in-memory-sourcing-repository.ts
+++ b/backend/src/modules/atlas/application/testing/in-memory-sourcing-repository.ts
@@ -1,14 +1,33 @@
 import { type Manufacturer, manufacturerKey } from '../../domain/sourcing/manufacturer.js';
 import type { Quote } from '../../domain/sourcing/quote.js';
-import type { QuoteRecord, QuoteToRecord, SourcingRepository } from '../../domain/sourcing/sourcing-repository.js';
+import type {
+  QuoteRecord,
+  QuoteToRecord,
+  SourcingRepository,
+  StageChangeRecord,
+  StageChangeToRecord,
+} from '../../domain/sourcing/sourcing-repository.js';
+import type { StageChange } from '../../domain/sourcing/stage.js';
 
 /** The SourcingRepository contract, in memory. A test double, never used in production. */
 export class InMemorySourcingRepository implements SourcingRepository {
   private readonly manufacturers = new Map<string, Manufacturer>();
   private quotes: Quote[] = [];
+  private readonly stageChanges: StageChange[] = [];
+  private readonly changerNames = new Map<string, string>();
   /** How many times `replaceQuotes` was called. */
   replaced = 0;
 
+  /** Teaches the fake a changer's name, as the real repository reads it from accounts. */
+  nameChanger(accountId: string, fullName: string): void {
+    this.changerNames.set(accountId, fullName);
+  }
+
+  /** Every stage change held, oldest first. */
+  get allStageChanges(): StageChange[] {
+    return [...this.stageChanges];
+  }
+
   /** Every manufacturer held, in the order first added. */
   get allManufacturers(): Manufacturer[] {
     return [...this.manufacturers.values()];
@@ -46,4 +65,19 @@ export class InMemorySourcingRepository implements SourcingRepository {
           a.quote.id.localeCompare(b.quote.id),
       );
   }
+
+  async currentStages(specId: string): Promise<StageChangeRecord[]> {
+    const newest = new Map<string, StageChange>();
+    for (const change of this.stageChanges) if (change.specId === specId) newest.set(change.manufacturerId, change);
+    return [...newest.values()].map((change) => ({ change, changedByName: this.changerNames.get(change.changedBy) ?? '' }));
+  }
+
+  async recordStageChange(input: StageChangeToRecord): Promise<StageChange | null> {
+    const newest = this.stageChanges.filter((change) => change.specId === input.specId && change.manufacturerId === input.manufacturerId).at(-1);
+    const stageBefore = newest?.stageAfter ?? null;
+    if (stageBefore === input.stageAfter) return null;
+    const change: StageChange = { ...input, stageBefore };
+    this.stageChanges.push(change);
+    return change;
+  }
 }
diff --git a/backend/src/modules/atlas/domain/sourcing/sourcing-repository.ts b/backend/src/modules/atlas/domain/sourcing/sourcing-repository.ts
index 3717c97..c3f2eae 100644
--- a/backend/src/modules/atlas/domain/sourcing/sourcing-repository.ts
+++ b/backend/src/modules/atlas/domain/sourcing/sourcing-repository.ts
@@ -1,5 +1,6 @@
 import type { Manufacturer } from './manufacturer.js';
 import type { Quote, QuoteValues } from './quote.js';
+import type { AdminStage, StageChange } from './stage.js';
 
 /** A quote to record, with the manufacturer it comes from. */
 export interface QuoteToRecord {
@@ -21,6 +22,22 @@ export interface QuoteRecord {
   readonly manufacturer: Manufacturer;
 }
 
+/** A stage change with the full name of the admin who made it. */
+export interface StageChangeRecord {
+  readonly change: StageChange;
+  readonly changedByName: string;
+}
+
+/** A stage an admin sets, or clears with `null`, on one manufacturer for one Spec ID. */
+export interface StageChangeToRecord {
+  readonly id: string;
+  readonly specId: string;
+  readonly manufacturerId: string;
+  readonly stageAfter: AdminStage | null;
+  readonly changedBy: string;
+  readonly changedAt: Date;
+}
+
 /** Where manufacturers and their quotes are kept (ADR 0027). */
 export interface SourcingRepository {
   /**
@@ -32,4 +49,13 @@ export interface SourcingRepository {
   replaceQuotes(quotes: readonly QuoteToRecord[]): Promise<void>;
   /** Every quote for one Spec ID, by manufacturer name, then item name. */
   quotesOf(specId: string): Promise<QuoteRecord[]>;
+  /** Each manufacturer's newest stage change on one Spec ID, if an admin made one. */
+  currentStages(specId: string): Promise<StageChangeRecord[]>;
+  /**
+   * In one transaction, with the manufacturer's row locked: records the change
+   * with the stage it replaces as `stageBefore`, and answers it. Answers null,
+   * recording nothing, when the stage is already `stageAfter`. Changes are
+   * only ever added.
+   */
+  recordStageChange(change: StageChangeToRecord): Promise<StageChange | null>;
 }
diff --git a/backend/src/modules/atlas/domain/sourcing/sourcing.errors.ts b/backend/src/modules/atlas/domain/sourcing/sourcing.errors.ts
new file mode 100644
index 0000000..01857cc
--- /dev/null
+++ b/backend/src/modules/atlas/domain/sourcing/sourcing.errors.ts
@@ -0,0 +1,10 @@
+import { DomainError } from '../../../../shared/domain/domain-error.js';
+
+/** The manufacturer has no quote on this Spec ID, so it has no stage there to set. */
+export class ManufacturerNotFoundError extends DomainError {
+  override readonly code = 'MANUFACTURER_NOT_FOUND';
+
+  constructor() {
+    super('This manufacturer has no quote on this Spec ID.');
+  }
+}
diff --git a/backend/src/modules/atlas/domain/sourcing/stage.test.ts b/backend/src/modules/atlas/domain/sourcing/stage.test.ts
new file mode 100644
index 0000000..7d47445
--- /dev/null
+++ b/backend/src/modules/atlas/domain/sourcing/stage.test.ts
@@ -0,0 +1,44 @@
+import { describe, expect, it } from 'vitest';
+import type { QuoteValues } from './quote.js';
+import { hasPrice, stageOf } from './stage.js';
+
+/** An invented quote: never a Source One price (ADR 0027). */
+const quote = (values: Partial<QuoteValues> = {}): QuoteValues => ({
+  itemName: 'Invented PP cup',
+  fobPerUnit: null,
+  fobPerCase: null,
+  fobTotal: null,
+  moldCost: null,
+  moldLeadTime: null,
+  sampleLeadTime: null,
+  productionLeadTime: null,
+  ...values,
+});
+
+describe('stageOf', () => {
+  it('is quoted when a quote has a per-unit price, or only a per-case one', () => {
+    expect(stageOf([quote({ fobPerUnit: '$0.0123' })], null)).toBe('quoted');
+    expect(stageOf([quote({ fobPerCase: '$12.30' })], null)).toBe('quoted');
+  });
+
+  it('is specifications received when no quote has a price', () => {
+    expect(stageOf([quote({ fobTotal: '$1,230.00', sampleLeadTime: '7' })], null)).toBe('specifications-received');
+    expect(stageOf([], null)).toBe('specifications-received');
+  });
+
+  it('takes the stage an admin set over the quotes, and the quotes again once it is cleared', () => {
+    expect(stageOf([quote({ fobPerUnit: '$0.0123' })], 'sampling')).toBe('sampling');
+    expect(stageOf([quote()], 'in-production')).toBe('in-production');
+    expect(stageOf([quote({ fobPerUnit: '$0.0123' })], null)).toBe('quoted');
+  });
+});
+
+describe('hasPrice', () => {
+  it.each(['N/A', '-', '/', '', null])('does not take %j for a price', (value) => {
+    expect(hasPrice(value)).toBe(false);
+  });
+
+  it.each(['$0.0350', '12', '$0.05 per 1000 pouches'])('takes %j for a price', (value) => {
+    expect(hasPrice(value)).toBe(true);
+  });
+});
diff --git a/backend/src/modules/atlas/domain/sourcing/stage.ts b/backend/src/modules/atlas/domain/sourcing/stage.ts
new file mode 100644
index 0000000..9b480ef
--- /dev/null
+++ b/backend/src/modules/atlas/domain/sourcing/stage.ts
@@ -0,0 +1,38 @@
+import type { QuoteValues } from './quote.js';
+
+/** The stages only an admin sets: the verified list has no such status (#57, ADR 0027). */
+export const ADMIN_STAGES = ['sampling', 'in-production'] as const;
+export type AdminStage = (typeof ADMIN_STAGES)[number];
+
+/** A manufacturer's stage on a Spec ID, from the first contact to mass production. */
+export type Stage = 'specifications-received' | 'quoted' | AdminStage;
+
+/**
+ * Whether a quote's value is a price. The verified list writes `N/A`, `-` and
+ * `/` in some price cells; a price always has a digit.
+ */
+export function hasPrice(value: string | null): boolean {
+  return value !== null && /\d/.test(value);
+}
+
+/**
+ * A manufacturer's stage: the one an admin set, else `quoted` when any of its
+ * quotes has a per-unit or per-case price, else `specifications-received`.
+ * Clearing an admin's stage (`null`) hands it back to the quotes.
+ */
+export function stageOf(quotes: readonly QuoteValues[], set: AdminStage | null): Stage {
+  if (set !== null) return set;
+  return quotes.some((quote) => hasPrice(quote.fobPerUnit) || hasPrice(quote.fobPerCase)) ? 'quoted' : 'specifications-received';
+}
+
+/** One change an admin made to a manufacturer's stage on a Spec ID. Only ever recorded, never changed. */
+export interface StageChange {
+  readonly id: string;
+  readonly specId: string;
+  readonly manufacturerId: string;
+  readonly stageBefore: AdminStage | null;
+  /** Null is a cleared stage. */
+  readonly stageAfter: AdminStage | null;
+  readonly changedBy: string;
+  readonly changedAt: Date;
+}
diff --git a/backend/src/modules/atlas/index.ts b/backend/src/modules/atlas/index.ts
index 3558cc7..9e8b671 100644
--- a/backend/src/modules/atlas/index.ts
+++ b/backend/src/modules/atlas/index.ts
@@ -10,14 +10,17 @@ import { FindSpecIdByCode } from './application/find-spec-id-by-code.js';
 import { GetDictionary } from './application/get-dictionary.js';
 import { GetSavedSpecId } from './application/get-saved-spec-id.js';
 import { GetSpecIdHistory } from './application/get-spec-id-history.js';
+import { GetSpecIdManufacturers } from './application/get-spec-id-manufacturers.js';
 import { ListSavedSpecIds } from './application/list-saved-spec-ids.js';
 import { ReadSpecIdText } from './application/read-spec-id-text.js';
 import { SaveSpecId } from './application/save-spec-id.js';
+import { SetManufacturerStage } from './application/set-manufacturer-stage.js';
 import { UpdateSpecId } from './application/update-spec-id.js';
 import { DrizzleDictionaryRepository } from './infrastructure/drizzle-dictionary-repository.js';
+import { DrizzleSourcingRepository } from './infrastructure/drizzle-sourcing-repository.js';
 import { DrizzleSpecIdRepository } from './infrastructure/drizzle-spec-id-repository.js';
 import { AtlasController } from './presentation/atlas.controller.js';
-import { createAtlasRouter } from './presentation/atlas.routes.js';
+import { createAtlasAdminRouter, createAtlasRouter } from './presentation/atlas.routes.js';
 
 export interface AtlasModuleDependencies {
   db: Database;
@@ -25,10 +28,15 @@ export interface AtlasModuleDependencies {
   ids: IdGenerator;
 }
 
-/** The module's composition root: the one place its adapters meet its use cases. */
-export function buildAtlasModule(deps: AtlasModuleDependencies): HttpModule {
+/**
+ * The module's composition root: the one place its adapters meet its use
+ * cases. Two modules on `/atlas`: every signed-in staff member's routes, and
+ * the admins' (#57).
+ */
+export function buildAtlasModule(deps: AtlasModuleDependencies): HttpModule[] {
   const dictionaries = new DrizzleDictionaryRepository(deps.db);
   const specIds = new DrizzleSpecIdRepository(deps.db);
+  const sourcing = new DrizzleSourcingRepository(deps.db);
   const controller = new AtlasController(
     new GetDictionary(dictionaries),
     new DecodeSpecId(dictionaries),
@@ -47,6 +55,13 @@ export function buildAtlasModule(deps: AtlasModuleDependencies): HttpModule {
       library: new ListSavedSpecIds(dictionaries, specIds),
     },
     new ReadSpecIdText(dictionaries),
+    {
+      list: new GetSpecIdManufacturers(specIds, sourcing),
+      setStage: new SetManufacturerStage(specIds, sourcing, deps.clock, deps.ids),
+    },
   );
-  return { path: '/atlas', router: createAtlasRouter(controller), access: 'session' };
+  return [
+    { path: '/atlas', router: createAtlasRouter(controller), access: 'session' },
+    { path: '/atlas', router: createAtlasAdminRouter(controller), access: 'admin' },
+  ];
 }
diff --git a/backend/src/modules/atlas/infrastructure/atlas-manufacturer-stage-changes.table.ts b/backend/src/modules/atlas/infrastructure/atlas-manufacturer-stage-changes.table.ts
new file mode 100644
index 0000000..b2566b0
--- /dev/null
+++ b/backend/src/modules/atlas/infrastructure/atlas-manufacturer-stage-changes.table.ts
@@ -0,0 +1,45 @@
+import { sql } from 'drizzle-orm';
+import { check, foreignKey, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
+import { accountsTable } from '../../accounts/index.js';
+import { atlasManufacturers } from './atlas-manufacturers.table.js';
+import { atlasSpecIds } from './atlas-spec-ids.table.js';
+
+/*
+ * Every change an admin made to a manufacturer's stage on a Spec ID: who,
+ * when, and the stage before and after (#57). Rows are only ever inserted;
+ * the newest one is the current stage, and a null `stage_after` hands the
+ * stage back to the quotes. The import never touches this table.
+ */
+export const atlasManufacturerStageChanges = pgTable(
+  'atlas_manufacturer_stage_changes',
+  {
+    id: uuid('id').primaryKey(),
+    specId: uuid('spec_id').notNull(),
+    manufacturerId: uuid('manufacturer_id').notNull(),
+    /** Null when no admin had set a stage. */
+    stageBefore: varchar('stage_before', { length: 16 }),
+    /** Null is a cleared stage. */
+    stageAfter: varchar('stage_after', { length: 16 }),
+    changedBy: uuid('changed_by').notNull(),
+    changedAt: timestamp('changed_at', { withTimezone: true }).notNull(),
+  },
+  (table) => [
+    foreignKey({ name: 'atlas_manufacturer_stage_changes_spec_id_fk', columns: [table.specId], foreignColumns: [atlasSpecIds.id] }),
+    foreignKey({
+      name: 'atlas_manufacturer_stage_changes_manufacturer_id_fk',
+      columns: [table.manufacturerId],
+      foreignColumns: [atlasManufacturers.id],
+    }),
+    foreignKey({
+      name: 'atlas_manufacturer_stage_changes_changed_by_fk',
+      columns: [table.changedBy],
+      foreignColumns: [accountsTable.id],
+    }),
+    check(
+      'atlas_manufacturer_stage_changes_stage_check',
+      sql`(${table.stageBefore} is null or ${table.stageBefore} in ('sampling', 'in-production')) and (${table.stageAfter} is null or ${table.stageAfter} in ('sampling', 'in-production'))`,
+    ),
+    // A manufacturer's newest change on a Spec ID.
+    index('atlas_stage_changes_spec_manufacturer_idx').on(table.specId, table.manufacturerId, table.changedAt),
+  ],
+);
diff --git a/backend/src/modules/atlas/infrastructure/drizzle-sourcing-repository.db.test.ts b/backend/src/modules/atlas/infrastructure/drizzle-sourcing-repository.db.test.ts
index eaa29c1..af337b5 100644
--- a/backend/src/modules/atlas/infrastructure/drizzle-sourcing-repository.db.test.ts
+++ b/backend/src/modules/atlas/infrastructure/drizzle-sourcing-repository.db.test.ts
@@ -9,6 +9,7 @@ import type { QuoteValues } from '../domain/sourcing/quote.js';
 import type { QuoteToRecord } from '../domain/sourcing/sourcing-repository.js';
 import { SpecId } from '../domain/spec-id.js';
 import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
+import { atlasManufacturerStageChanges } from './atlas-manufacturer-stage-changes.table.js';
 import { atlasManufacturers } from './atlas-manufacturers.table.js';
 import { atlasQuotes } from './atlas-quotes.table.js';
 import { DrizzleSourcingRepository } from './drizzle-sourcing-repository.js';
@@ -122,3 +123,65 @@ describe('DrizzleSourcingRepository', () => {
     expect(await manufacturerCount()).toBe(1);
   });
 });
+
+describe('DrizzleSourcingRepository, stages (#57)', () => {
+  const AT = new Date('2026-10-23T09:00:00.000Z');
+  const later = (minutes: number) => new Date(AT.getTime() + minutes * 60_000);
+
+  /** Records Acme's quote on the cup and answers Acme's id. */
+  async function acme(): Promise<string> {
+    await repository.replaceQuotes([quote('Acme Packaging', 'Atlantis')]);
+    return (await repository.quotesOf(CUP_ID))[0]?.manufacturer.id as string;
+  }
+
+  const change = (manufacturerId: string, stageAfter: 'sampling' | 'in-production' | null, changedAt = AT) =>
+    repository.recordStageChange({ id: randomUUID(), specId: CUP_ID, manufacturerId, stageAfter, changedBy: SAVER_ID, changedAt });
+
+  it('records who, when, and the stage before and after, and answers the newest with the name of who made it', async () => {
+    const manufacturerId = await acme();
+
+    const first = await change(manufacturerId, 'sampling');
+    await change(manufacturerId, 'in-production', later(1));
+
+    expect(first).toMatchObject({ stageBefore: null, stageAfter: 'sampling', changedBy: SAVER_ID, changedAt: AT });
+    expect(await repository.currentStages(CUP_ID)).toEqual([
+      {
+        change: expect.objectContaining({ manufacturerId, stageBefore: 'sampling', stageAfter: 'in-production', changedAt: later(1) }),
+        changedByName: 'Ada Invented',
+      },
+    ]);
+  });
+
+  it('records nothing for the stage a manufacturer already has, and null for a cleared one', async () => {
+    const manufacturerId = await acme();
+
+    await change(manufacturerId, 'sampling');
+    expect(await change(manufacturerId, 'sampling', later(1))).toBeNull();
+    const cleared = await change(manufacturerId, null, later(2));
+
+    expect(cleared).toMatchObject({ stageBefore: 'sampling', stageAfter: null });
+    expect(await change(manufacturerId, null, later(3))).toBeNull();
+  });
+
+  it('leaves a stage an admin set as it was when the import replaces the quotes again', async () => {
+    const manufacturerId = await acme();
+    await change(manufacturerId, 'sampling');
+
+    await repository.replaceQuotes([quote('Acme Packaging', 'Atlantis')]);
+
+    expect((await repository.quotesOf(CUP_ID))[0]?.manufacturer.id).toBe(manufacturerId);
+    expect((await repository.currentStages(CUP_ID)).map(({ change }) => change.stageAfter)).toEqual(['sampling']);
+  });
+
+  it('gives each of two changes made at once the stage it replaced', async () => {
+    const manufacturerId = await acme();
+
+    await Promise.all([change(manufacturerId, 'sampling'), change(manufacturerId, 'in-production', later(1))]);
+
+    const rows = (await connection.db.select().from(atlasManufacturerStageChanges)).sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
+    const [firstRecorded, secondRecorded] = [...rows].sort((a, b) => (a.stageBefore === null ? -1 : b.stageBefore === null ? 1 : 0));
+    expect(rows).toHaveLength(2);
+    expect(firstRecorded?.stageBefore).toBeNull();
+    expect(secondRecorded?.stageBefore).toBe(firstRecorded?.stageAfter);
+  });
+});
diff --git a/backend/src/modules/atlas/infrastructure/drizzle-sourcing-repository.ts b/backend/src/modules/atlas/infrastructure/drizzle-sourcing-repository.ts
index 4ea87e9..79f5bbb 100644
--- a/backend/src/modules/atlas/infrastructure/drizzle-sourcing-repository.ts
+++ b/backend/src/modules/atlas/infrastructure/drizzle-sourcing-repository.ts
@@ -1,7 +1,16 @@
-import { asc, eq, sql } from 'drizzle-orm';
+import { and, asc, desc, eq, sql } from 'drizzle-orm';
 import type { Database } from '../../../shared/infrastructure/database/connection.js';
+import { accountsTable } from '../../accounts/index.js';
 import { manufacturerKey } from '../domain/sourcing/manufacturer.js';
-import type { QuoteRecord, QuoteToRecord, SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
+import type {
+  QuoteRecord,
+  QuoteToRecord,
+  SourcingRepository,
+  StageChangeRecord,
+  StageChangeToRecord,
+} from '../domain/sourcing/sourcing-repository.js';
+import type { AdminStage, StageChange } from '../domain/sourcing/stage.js';
+import { atlasManufacturerStageChanges } from './atlas-manufacturer-stage-changes.table.js';
 import { atlasManufacturers } from './atlas-manufacturers.table.js';
 import { atlasQuotes } from './atlas-quotes.table.js';
 
@@ -83,4 +92,60 @@ export class DrizzleSourcingRepository implements SourcingRepository {
       manufacturer: { id: manufacturer.id, name: manufacturer.name, country: manufacturer.country, createdAt: manufacturer.createdAt },
     }));
   }
+
+  async currentStages(specId: string): Promise<StageChangeRecord[]> {
+    const rows = await this.db
+      .selectDistinctOn([atlasManufacturerStageChanges.manufacturerId], {
+        change: atlasManufacturerStageChanges,
+        changedByName: accountsTable.fullName,
+      })
+      .from(atlasManufacturerStageChanges)
+      .innerJoin(accountsTable, eq(atlasManufacturerStageChanges.changedBy, accountsTable.id))
+      .where(eq(atlasManufacturerStageChanges.specId, specId))
+      .orderBy(
+        atlasManufacturerStageChanges.manufacturerId,
+        desc(atlasManufacturerStageChanges.changedAt),
+        desc(atlasManufacturerStageChanges.id),
+      );
+    return rows.map(({ change, changedByName }) => ({ change: toStageChange(change), changedByName }));
+  }
+
+  async recordStageChange(input: StageChangeToRecord): Promise<StageChange | null> {
+    return this.db.transaction(async (tx) => {
+      // Two admins at once: the second waits here, then reads the first one's change as its "before".
+      await tx
+        .select({ id: atlasManufacturers.id })
+        .from(atlasManufacturers)
+        .where(eq(atlasManufacturers.id, input.manufacturerId))
+        .for('update');
+      const [newest] = await tx
+        .select({ stageAfter: atlasManufacturerStageChanges.stageAfter })
+        .from(atlasManufacturerStageChanges)
+        .where(
+          and(
+            eq(atlasManufacturerStageChanges.specId, input.specId),
+            eq(atlasManufacturerStageChanges.manufacturerId, input.manufacturerId),
+          ),
+        )
+        .orderBy(desc(atlasManufacturerStageChanges.changedAt), desc(atlasManufacturerStageChanges.id))
+        .limit(1);
+      const stageBefore = (newest?.stageAfter ?? null) as AdminStage | null;
+      if (stageBefore === input.stageAfter) return null;
+      const change: StageChange = { ...input, stageBefore };
+      await tx.insert(atlasManufacturerStageChanges).values(change);
+      return change;
+    });
+  }
+}
+
+function toStageChange(row: typeof atlasManufacturerStageChanges.$inferSelect): StageChange {
+  return {
+    id: row.id,
+    specId: row.specId,
+    manufacturerId: row.manufacturerId,
+    stageBefore: row.stageBefore as AdminStage | null,
+    stageAfter: row.stageAfter as AdminStage | null,
+    changedBy: row.changedBy,
+    changedAt: row.changedAt,
+  };
 }
diff --git a/backend/src/modules/atlas/presentation/atlas.controller.ts b/backend/src/modules/atlas/presentation/atlas.controller.ts
index 795d5e6..b4a79da 100644
--- a/backend/src/modules/atlas/presentation/atlas.controller.ts
+++ b/backend/src/modules/atlas/presentation/atlas.controller.ts
@@ -7,6 +7,8 @@ import type {
   SpecIdChange,
   SpecIdLibraryPage,
   SpecIdLookup,
+  SpecIdManufacturer,
+  SpecIdManufacturers,
   SpecIdTextReading,
 } from '../../../contracts/atlas.js';
 import type { UseCase } from '../../../shared/application/use-case.js';
@@ -26,13 +28,17 @@ import type {
   SaveSpecIdInput,
   SavedSpecIdDto,
   SavedSpecIdIdInput,
+  SetManufacturerStageInput,
   SimilarSpecIdsDto,
   SpecIdChangeDto,
   SpecIdLibraryPageDto,
   SpecIdLookupDto,
+  SpecIdManufacturerDto,
+  SpecIdManufacturersDto,
   SpecIdTextReadingDto,
   UpdateSpecIdInput,
 } from '../application/atlas.dto.js';
+import { ManufacturerNotFoundError } from '../domain/sourcing/sourcing.errors.js';
 import {
   SpecIdNotFoundError,
   type InvalidLookupError,
@@ -43,9 +49,11 @@ import {
 import {
   decodeSpecIdRequestSchema,
   encodeSpecIdRequestSchema,
+  manufacturerIdSchema,
   readSpecIdTextRequestSchema,
   saveSpecIdRequestSchema,
   savedSpecIdIdSchema,
+  setManufacturerStageRequestSchema,
   updateSpecIdRequestSchema,
 } from './atlas.schemas.js';
 
@@ -61,13 +69,16 @@ type UpdateResult = Result<
 type HistoryResult = Result<SpecIdChangeDto[], SpecIdNotFoundError>;
 type LibraryResult = Result<SpecIdLibraryPageDto, InvalidLookupError>;
 type ReadResult = Result<SpecIdTextReadingDto, InvalidLookupError | InvalidSpecIdError>;
+type ManufacturersResult = Result<SpecIdManufacturersDto, SpecIdNotFoundError>;
+type SetStageResult = Result<SpecIdManufacturerDto, SpecIdNotFoundError | ManufacturerNotFoundError>;
 
 type AtlasErrorCode =
   | InvalidSpecIdError['code']
   | SpecIdExistsError['code']
   | SpecIdNotFoundError['code']
   | SpecIdChangedError['code']
-  | InvalidLookupError['code'];
+  | InvalidLookupError['code']
+  | ManufacturerNotFoundError['code'];
 
 const STATUS_BY_CODE: Record<AtlasErrorCode, number> = {
   INVALID_SPEC_ID: 400,
@@ -75,6 +86,7 @@ const STATUS_BY_CODE: Record<AtlasErrorCode, number> = {
   SPEC_ID_NOT_FOUND: 404,
   SPEC_ID_CHANGED: 409,
   VALIDATION_FAILED: 400,
+  MANUFACTURER_NOT_FOUND: 404,
 };
 
 /** The use cases behind the saved Spec ID routes: one by id, a change, its history, the library. */
@@ -85,6 +97,12 @@ export interface SavedSpecIdUseCases {
   library: UseCase<ListSavedSpecIdsInput, LibraryResult>;
 }
 
+/** The use cases behind a Spec ID's manufacturers (#57): reading them, and an admin setting a stage. */
+export interface ManufacturerUseCases {
+  list: UseCase<SavedSpecIdIdInput, ManufacturersResult>;
+  setStage: UseCase<SetManufacturerStageInput, SetStageResult>;
+}
+
 /** The signed-in staff member a request comes from: who a saved Spec ID is saved by. */
 export type SignedInStaff = (req: Request) => { id: string; fullName: string };
 
@@ -100,6 +118,7 @@ export class AtlasController {
     private readonly signedInStaff: SignedInStaff,
     private readonly saved: SavedSpecIdUseCases,
     private readonly readSpecIdText: UseCase<ReadSpecIdTextInput, ReadResult>,
+    private readonly manufacturerUseCases: ManufacturerUseCases,
   ) {}
 
   dictionary = async (_req: Request, res: Response): Promise<void> => {
@@ -170,6 +189,24 @@ export class AtlasController {
     sendData(res, 200, history);
   };
 
+  manufacturers = async (req: Request, res: Response): Promise<void> => {
+    const result = await this.manufacturerUseCases.list.execute({ id: savedSpecIdOf(req) });
+    if (!result.ok) throw toHttpError(result.error);
+    const manufacturers: SpecIdManufacturers = result.value;
+    sendData(res, 200, manufacturers);
+  };
+
+  /** Admins only: the route is mounted behind the admin gate. */
+  setManufacturerStage = async (req: Request, res: Response): Promise<void> => {
+    const id = savedSpecIdOf(req);
+    const manufacturerId = manufacturerIdOf(req);
+    const { stage } = parseBody(setManufacturerStageRequestSchema, req.body);
+    const result = await this.manufacturerUseCases.setStage.execute({ id, manufacturerId, stage, by: this.signedInStaff(req) });
+    if (!result.ok) throw toHttpError(result.error);
+    const manufacturer: SpecIdManufacturer = result.value;
+    sendData(res, 200, manufacturer);
+  };
+
   findSimilar = async (req: Request, res: Response): Promise<void> => {
     const result = await this.findSimilarSpecIds.execute({ ...req.query });
     if (!result.ok) throw toHttpError(result.error);
@@ -191,6 +228,13 @@ function savedSpecIdOf(req: Request): string {
   return parsed.data;
 }
 
+/** The `:manufacturerId` of a stage route. Anything that is not an id names no manufacturer: 404, before any query. */
+function manufacturerIdOf(req: Request): string {
+  const parsed = manufacturerIdSchema.safeParse(req.params.manufacturerId);
+  if (!parsed.success) throw toHttpError(new ManufacturerNotFoundError());
+  return parsed.data;
+}
+
 function toHttpError(error: { code: AtlasErrorCode; message: string; details?: Record<string, unknown> | undefined }) {
   return new HttpError(STATUS_BY_CODE[error.code], error.code, error.message, error.details);
 }
diff --git a/backend/src/modules/atlas/presentation/atlas.routes.test.ts b/backend/src/modules/atlas/presentation/atlas.routes.test.ts
index 0fee435..d04c2b0 100644
--- a/backend/src/modules/atlas/presentation/atlas.routes.test.ts
+++ b/backend/src/modules/atlas/presentation/atlas.routes.test.ts
@@ -9,11 +9,14 @@ import { FindSpecIdByCode } from '../application/find-spec-id-by-code.js';
 import { GetDictionary } from '../application/get-dictionary.js';
 import { GetSavedSpecId } from '../application/get-saved-spec-id.js';
 import { GetSpecIdHistory } from '../application/get-spec-id-history.js';
+import { GetSpecIdManufacturers } from '../application/get-spec-id-manufacturers.js';
 import { ListSavedSpecIds } from '../application/list-saved-spec-ids.js';
 import { ReadSpecIdText } from '../application/read-spec-id-text.js';
 import { SaveSpecId } from '../application/save-spec-id.js';
+import { SetManufacturerStage } from '../application/set-manufacturer-stage.js';
 import { UpdateSpecId } from '../application/update-spec-id.js';
 import { InMemoryDictionaryRepository } from '../application/testing/in-memory-dictionary-repository.js';
+import { InMemorySourcingRepository } from '../application/testing/in-memory-sourcing-repository.js';
 import { InMemorySpecIdRepository } from '../application/testing/in-memory-spec-id-repository.js';
 import { ILLUSTRATIVE, ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1, withSlot } from '../domain/testing/spec-id-codes.js';
 import { AtlasController } from './atlas.controller.js';
@@ -35,6 +38,7 @@ function setup() {
   const dictionaries = new InMemoryDictionaryRepository();
   const specIds = new InMemorySpecIdRepository();
   specIds.nameSaver(STAFF.id, STAFF.fullName);
+  const sourcing = new InMemorySourcingRepository();
   const controller = new AtlasController(
     new GetDictionary(dictionaries),
     new DecodeSpecId(dictionaries),
@@ -60,6 +64,15 @@ function setup() {
       library: new ListSavedSpecIds(dictionaries, specIds),
     },
     new ReadSpecIdText(dictionaries),
+    {
+      list: new GetSpecIdManufacturers(specIds, sourcing),
+      setStage: new SetManufacturerStage(
+        specIds,
+        sourcing,
+        new FixedClock(new Date('2026-10-18T08:00:00.000Z')),
+        new SequentialIdGenerator(),
+      ),
+    },
   );
   // Atlas route shape only — production mounts Atlas behind the session gate.
   return createApp({
diff --git a/backend/src/modules/atlas/presentation/atlas.routes.ts b/backend/src/modules/atlas/presentation/atlas.routes.ts
index a4a395a..ded0d22 100644
--- a/backend/src/modules/atlas/presentation/atlas.routes.ts
+++ b/backend/src/modules/atlas/presentation/atlas.routes.ts
@@ -3,7 +3,9 @@ import type { AtlasController } from './atlas.controller.js';
 
 /**
  * The dictionary is only read (ADR 0021). A saved Spec ID is created, read and
- * changed, never deleted (ADR 0022): there is no PUT and no DELETE.
+ * changed, never deleted (ADR 0022): there is no DELETE. Every signed-in staff
+ * member may call these; the one PUT, a manufacturer's stage, is admins' only
+ * and lives in `createAtlasAdminRouter` (#57).
  */
 export function createAtlasRouter(controller: AtlasController): Router {
   const router = Router();
@@ -18,5 +20,16 @@ export function createAtlasRouter(controller: AtlasController): Router {
   router.get('/saved/:id', controller.getSaved);
   router.patch('/saved/:id', controller.update);
   router.get('/saved/:id/history', controller.history);
+  router.get('/saved/:id/manufacturers', controller.manufacturers);
+  return router;
+}
+
+/**
+ * Atlas routes only admins may call, mounted behind the admin gate (ADR 0027):
+ * setting or clearing a manufacturer's stage on a Spec ID (#57).
+ */
+export function createAtlasAdminRouter(controller: AtlasController): Router {
+  const router = Router();
+  router.put('/saved/:id/manufacturers/:manufacturerId/stage', controller.setManufacturerStage);
   return router;
 }
diff --git a/backend/src/modules/atlas/presentation/atlas.schemas.ts b/backend/src/modules/atlas/presentation/atlas.schemas.ts
index a02a11a..8217c3a 100644
--- a/backend/src/modules/atlas/presentation/atlas.schemas.ts
+++ b/backend/src/modules/atlas/presentation/atlas.schemas.ts
@@ -6,6 +6,7 @@ import type {
   ReadSpecIdTextRequest,
   MeasurementFact,
   SaveSpecIdRequest,
+  SetManufacturerStageRequest,
   SpecIdFacts,
   UpdateSpecIdRequest,
 } from '../../../contracts/atlas.js';
@@ -76,3 +77,11 @@ export const updateSpecIdRequestSchema = z.object({
 
 /** A saved Spec ID's id: anything else names no Spec ID, so it is answered 404 before any query. */
 export const savedSpecIdIdSchema = z.guid();
+
+/** `stage` is required: `null` clears it, and any other value is refused (#57). */
+export const setManufacturerStageRequestSchema = z.object({
+  stage: z.enum(['sampling', 'in-production']).nullable(),
+}) satisfies z.ZodType<SetManufacturerStageRequest>;
+
+/** A manufacturer's id: anything else names no manufacturer, so it is answered 404 before any query. */
+export const manufacturerIdSchema = z.guid();
diff --git a/backend/src/test/database.ts b/backend/src/test/database.ts
index 9372602..f559827 100644
--- a/backend/src/test/database.ts
+++ b/backend/src/test/database.ts
@@ -14,6 +14,6 @@ export function connectTestDatabase(): DatabaseConnection {
 /** Empties every table. Add each new table here. */
 export async function resetTables(db: Database): Promise<void> {
   await db.execute(
-    sql`truncate table account_invites, atlas_quotes, atlas_manufacturers, atlas_spec_id_changes, atlas_spec_ids, password_reset_tokens, sessions, accounts, tools restart identity cascade`,
+    sql`truncate table account_invites, atlas_manufacturer_stage_changes, atlas_quotes, atlas_manufacturers, atlas_spec_id_changes, atlas_spec_ids, password_reset_tokens, sessions, accounts, tools restart identity cascade`,
   );
 }
diff --git a/docs/plans/0008-manufacturers-page.md b/docs/plans/0008-manufacturers-page.md
index ab9e06f..586818b 100644
--- a/docs/plans/0008-manufacturers-page.md
+++ b/docs/plans/0008-manufacturers-page.md
@@ -1,6 +1,6 @@
 # 0008. Manufacturers on each Spec ID, with stages admins set
 
-- **Status:** Ready
+- **Status:** In progress
 - **Owner:** Rey Denzo
 - **Related:** [#57](https://github.com/S1-GLOBAL/s1-gateway/issues/57) ·
   [ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md) ·
@@ -50,7 +50,7 @@ and this plan is corrected.
 
 | Phase | Steps | Status |
 |---|---|---|
-| 1. Stages and the two routes | 0 / 6 | Not started |
+| 1. Stages and the two routes | 5 / 6 | In progress — steps 1.1 to 1.5 built; step 1.6 is this phase's pull request |
 | 2. The Manufacturers page | 0 / 7 | Not started |
 
 Two pull requests, as reyxdz decided on 2026-10-23: phase 1 is "Part of #57",
@@ -198,38 +198,38 @@ One pull request, "Part of #57". Every test uses invented manufacturers and pric
 
 ### Step 1.1 — The table
 
-- [ ] **Action.** `atlas_manufacturer_stage_changes` as the design gives it, in `database-schema.ts`, and migration `0014` from `npm --prefix backend run db:generate -- --name atlas_manufacturer_stage_changes`. Add the table to `resetTables` in `backend/src/test/database.ts` and to the truncate in `backend/src/atlas.db.test.ts`.
-- [ ] **Verify.** `npm run db:generate` run again prints "No schema changes, nothing to migrate"; `npm test` passes.
+- [x] **Action.** `atlas_manufacturer_stage_changes` as the design gives it, in `database-schema.ts`, and migration `0014` from `npm --prefix backend run db:generate -- --name atlas_manufacturer_stage_changes`. Add the table to `resetTables` in `backend/src/test/database.ts` and to the truncate in `backend/src/atlas.db.test.ts`.
+- [x] **Verify.** `npm run db:generate` run again prints "No schema changes, nothing to migrate"; `npm test` passes.
 
 ### Step 1.2 — Stages in the domain
 
-- [ ] **Action.** `domain/sourcing/stage.ts` as designed. Tests: a quote with a per-unit price is `quoted`; one with only a per-case price is `quoted`; one with neither is `specifications-received`; `N/A`, `-` and `/` are not prices; an admin-set `sampling` wins over `quoted`; `null` hands back to the quotes.
-- [ ] **Verify.** From `backend/`: `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/sourcing` passes.
+- [x] **Action.** `domain/sourcing/stage.ts` as designed. Tests: a quote with a per-unit price is `quoted`; one with only a per-case price is `quoted`; one with neither is `specifications-received`; `N/A`, `-` and `/` are not prices; an admin-set `sampling` wins over `quoted`; `null` hands back to the quotes.
+- [x] **Verify.** From `backend/`: `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/sourcing` passes.
 
 ### Step 1.3 — The repository
 
-- [ ] **Action.** `currentStages` and `recordStageChange` on `SourcingRepository`, with the Drizzle and in-memory adapters. Database tests:
+- [x] **Action.** `currentStages` and `recordStageChange` on `SourcingRepository`, with the Drizzle and in-memory adapters. Database tests:
   - a change records who, when, before and after;
   - the same stage twice records one change;
   - clearing records `null` after;
   - after a stage is set, `replaceQuotes` with the same rows leaves `currentStages` unchanged;
   - two changes in a row each record the stage they replaced.
-- [ ] **Verify.** `npm test` passes; `npm run arch:check` exits 0.
+- [x] **Verify.** `npm test` passes; `npm run arch:check` exits 0.
 
 ### Step 1.4 — The use cases
 
-- [ ] **Action.** `GetSpecIdManufacturers` and `SetManufacturerStage`, and `ManufacturerNotFoundError`. Tests with the in-memory adapters:
+- [x] **Action.** `GetSpecIdManufacturers` and `SetManufacturerStage`, and `ManufacturerNotFoundError`. Tests with the in-memory adapters:
   - a manufacturer with three quotes on one Spec ID appears once, with three quotes;
   - one with a per-unit price is Quoted, one with none is Specifications received;
   - an admin-set Sampling shows over Quoted, and clearing it shows Quoted again;
   - an unknown id answers `SpecIdNotFoundError`;
   - a manufacturer whose quotes are on another Spec ID answers `ManufacturerNotFoundError`;
   - `stageSet` names who made the last change, and when.
-- [ ] **Verify.** The tests pass.
+- [x] **Verify.** The tests pass.
 
 ### Step 1.5 — Contract, routes and wiring
 
-- [ ] **Action.**
+- [x] **Action.**
   - The contract types above.
   - A body schema in `atlas.schemas.ts`, and the two handlers in `atlas.controller.ts`; `MANUFACTURER_NOT_FOUND` maps to 404.
   - `createAtlasAdminRouter` in `atlas.routes.ts`, whose comment changes to "the one PUT sets a manufacturer's stage, admins only".
@@ -240,7 +240,7 @@ One pull request, "Part of #57". Every test uses invented manufacturers and pric
   - `PUT` as staff who are not admins answers 403 `NOT_ALLOWED` and records nothing;
   - as an admin it answers 200 and records who, when, before and after;
   - `{ "stage": "quoted" }` answers 400 `VALIDATION_FAILED`.
-- [ ] **Verify.** `npm test` passes; `npm run arch:check` exits 0.
+- [x] **Verify.** `npm test` passes; `npm run arch:check` exits 0.
 
 ### Step 1.6 — Docs and the pull request
 
diff --git a/docs/plans/README.md b/docs/plans/README.md
index b621602..5afc1be 100644
--- a/docs/plans/README.md
+++ b/docs/plans/README.md
@@ -67,4 +67,4 @@ does not exist yet, say so and mark the plan blocked rather than inventing it.
 | [0005](./0005-account-invites.md) | Accounts by invite: a one-time registration link, and first and last names | In progress |
 | [0006](./0006-s2-spec-ids-and-verified-list-import.md) | S2 Spec IDs, a dictionary from the verified list, and its import | In progress |
 | [0007](./0007-search-atlas-with-raw-product-text.md) | Search Atlas with raw product text | Complete |
-| [0008](./0008-manufacturers-page.md) | Manufacturers on each Spec ID, with stages admins set | Ready |
+| [0008](./0008-manufacturers-page.md) | Manufacturers on each Spec ID, with stages admins set | In progress |
diff --git a/docs/reference/api.md b/docs/reference/api.md
index 8792494..aa7ca62 100644
--- a/docs/reference/api.md
+++ b/docs/reference/api.md
@@ -60,6 +60,8 @@ Request bodies are JSON, at most **100 kB**.
 | GET | `/atlas/saved/:id` | session | 200 `{ data: SavedSpecId }` | 401, 404 `SPEC_ID_NOT_FOUND` |
 | PATCH | `/atlas/saved/:id` | session | 200 `{ data: SavedSpecId }` | 401, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED`, 404 `SPEC_ID_NOT_FOUND`, 409 `SPEC_ID_CHANGED`, 409 `SPEC_ID_EXISTS` |
 | GET | `/atlas/saved/:id/history` | session | 200 `{ data: SpecIdChange[] }`, newest first | 401, 404 `SPEC_ID_NOT_FOUND` |
+| GET | `/atlas/saved/:id/manufacturers` | session | 200 `{ data: SpecIdManufacturers }` | 401, 404 `SPEC_ID_NOT_FOUND` |
+| PUT | `/atlas/saved/:id/manufacturers/:manufacturerId/stage` | admin | 200 `{ data: SpecIdManufacturer }` | 401, 403 `NOT_ALLOWED`, 400 `VALIDATION_FAILED`, 404 `SPEC_ID_NOT_FOUND`, 404 `MANUFACTURER_NOT_FOUND` |
 
 When `mustChangePassword` is true, every session route except
 `GET /auth/me`, `POST /auth/sign-out` and `POST /auth/change-password`
@@ -266,8 +268,28 @@ its creation last: `kind` (`created` or `updated`), `changedBy`,
 ("Not known", "Doesn't apply", "62 mm"). `corrected` is true when a known
 value was replaced.
 
-Nothing replaces or deletes a saved Spec ID: `PUT` and `DELETE` on any Atlas
-path answer 404 ([ADR 0022](../decisions/0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md)).
+`GET /atlas/saved/:id/manufacturers` answers a `SpecIdManufacturers`: the
+Spec ID's `{ id, name, code }` and `manufacturers`, each manufacturer once,
+by name, as `{ id, name, country, stage, stageSet, quotes }` (#57). Quotes come
+from the verified-list import, each value as the workbook shows it, null when
+empty ([ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md)).
+`stage` is the one an admin set, `sampling` or `in-production`; with none,
+`quoted` when any quote's `fobPerUnit` or `fobPerCase` holds a digit (`N/A`,
+`-` and `/` are not prices), else `specifications-received`. `stageSet` is the
+last change an admin made, `{ by, at, stage }` with `stage` null once cleared,
+or null when none was made.
+
+`PUT /atlas/saved/:id/manufacturers/:manufacturerId/stage` takes
+`{ stage: "sampling" | "in-production" | null }`; `null` clears it, handing the
+stage back to the quotes. Only admins may call it: anyone else is answered 403
+`NOT_ALLOWED` by the admin gate, and nothing is recorded. Every change is
+recorded with who, when, and the stage before and after; setting the stage a
+manufacturer already has records nothing. A manufacturer with no quote on that
+Spec ID, or a `:manufacturerId` that is not an id, answers 404
+`MANUFACTURER_NOT_FOUND`. The verified-list import never changes a stage.
+
+Nothing replaces or deletes a saved Spec ID ([ADR 0022](../decisions/0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md)):
+there is no `PUT` or `DELETE` for one. The one Atlas `PUT` sets a manufacturer's stage.
 
 ## Error codes
 
@@ -296,5 +318,6 @@ path answer 404 ([ADR 0022](../decisions/0022-saved-spec-ids-can-be-edited-and-e
 | `SPEC_ID_EXISTS` | 409 | That Spec ID is already saved. `details.existing` is the saved Spec ID; nothing new was saved |
 | `SPEC_ID_NOT_FOUND` | 404 | No saved Spec ID has, or had, this code; or none has this id |
 | `SPEC_ID_CHANGED` | 409 | The Spec ID changed since the `version` the change was started from; nothing was saved |
+| `MANUFACTURER_NOT_FOUND` | 404 | The manufacturer has no quote on this Spec ID, or the id is not one |
 | `NOT_FOUND` | 404 | No route matches the method and path |
 | `INTERNAL_ERROR` | 500 | An unexpected failure. Logged in full on the server; the response says nothing more |
diff --git a/docs/reference/data-model.md b/docs/reference/data-model.md
index 1cf0a79..fcbe1ec 100644
--- a/docs/reference/data-model.md
+++ b/docs/reference/data-model.md
@@ -317,3 +317,32 @@ current rows, in one transaction.
 |---|---|---|
 | `atlas_quotes_spec_id_idx` | `spec_id` | A Spec ID's manufacturers (#57) |
 | `atlas_quotes_manufacturer_id_idx` | `manufacturer_id` | A manufacturer's quotes |
+
+## `atlas_manufacturer_stage_changes`
+
+Every change an admin made to a manufacturer's stage on a Spec ID (#57).
+Defined in
+`backend/src/modules/atlas/infrastructure/atlas-manufacturer-stage-changes.table.ts`.
+Rows are only ever inserted. A manufacturer's current stage on a Spec ID is
+the newest row's `stage_after`; with no row, or a null `stage_after`, its
+quotes decide it ("Quoted" or "Specifications received"). The verified-list
+import never touches this table, and never deletes a manufacturer, so a
+re-import leaves every stage as it was
+([ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md)).
+
+| Column | Type | Null | Default | Notes |
+|---|---|---|---|---|
+| `id` | `uuid` | no | — | Primary key. Generated by the application |
+| `spec_id` | `uuid` | no | — | FK `atlas_manufacturer_stage_changes_spec_id_fk` → `atlas_spec_ids.id` |
+| `manufacturer_id` | `uuid` | no | — | FK `atlas_manufacturer_stage_changes_manufacturer_id_fk` → `atlas_manufacturers.id` |
+| `stage_before` | `varchar(16)` | yes | — | `sampling` or `in-production`; null when no admin had set one |
+| `stage_after` | `varchar(16)` | yes | — | `sampling` or `in-production`; null is a cleared stage |
+| `changed_by` | `uuid` | no | — | FK `atlas_manufacturer_stage_changes_changed_by_fk` → `accounts.id`. Always an admin: the route sits behind the admin gate |
+| `changed_at` | `timestamptz` | no | — | Set by the application's clock |
+
+**Constraints and indexes**
+
+| Name | On | Why |
+|---|---|---|
+| `atlas_manufacturer_stage_changes_stage_check` | check | Each stage column is `sampling`, `in-production` or null |
+| `atlas_stage_changes_spec_manufacturer_idx` | `spec_id, manufacturer_id, changed_at` | A manufacturer's newest change on a Spec ID |
````

### C. The migration Step 6.2 must generate

````sql
CREATE TABLE "atlas_manufacturer_stage_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"spec_id" uuid NOT NULL,
	"manufacturer_id" uuid NOT NULL,
	"stage_before" varchar(16),
	"stage_after" varchar(16),
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "atlas_manufacturer_stage_changes_stage_check" CHECK (("atlas_manufacturer_stage_changes"."stage_before" is null or "atlas_manufacturer_stage_changes"."stage_before" in ('sampling', 'in-production')) and ("atlas_manufacturer_stage_changes"."stage_after" is null or "atlas_manufacturer_stage_changes"."stage_after" in ('sampling', 'in-production')))
);
--> statement-breakpoint
ALTER TABLE "atlas_manufacturer_stage_changes" ADD CONSTRAINT "atlas_manufacturer_stage_changes_spec_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."atlas_spec_ids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_manufacturer_stage_changes" ADD CONSTRAINT "atlas_manufacturer_stage_changes_manufacturer_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."atlas_manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atlas_manufacturer_stage_changes" ADD CONSTRAINT "atlas_manufacturer_stage_changes_changed_by_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "atlas_stage_changes_spec_manufacturer_idx" ON "atlas_manufacturer_stage_changes" USING btree ("spec_id","manufacturer_id","changed_at");
````

### D. The owner's own steps (not for the builder)

1. Audit the pull request with `/go-dark:audit-pr`, then merge it.
2. Watch "Deploy staging" for the merge commit
   (GitHub › S1-GLOBAL/s1-gateway › Actions › Deploy staging). Its
   "Migrate the staging database" step applies migration 0014. Nothing else on
   staging changes until phase 2.
3. Then ask for phase 2's handoff (the Manufacturers page, "Closes #57").

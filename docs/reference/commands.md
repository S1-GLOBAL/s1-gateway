# Commands

Run from the repository root unless noted.

| Command | Does | Needs Docker |
|---|---|---|
| `npm run setup` | Creates `.env` files from `.env.example`, installs the git hooks, installs both services' dependencies | no |
| `npm run setup:env` | Only the `.env` files. Never overwrites an existing one | no |
| `npm run hooks:install` | Only the git hooks (`core.hooksPath` → `.githooks/`) | no |
| `npm run db:up` | Starts Postgres 17 on host port 5436 | yes |
| `npm run db:down` | Stops it; data is kept | yes |
| `npm run db:reset` | Stops it and deletes the data | yes |
| `npm run db:generate` | Writes a migration from the table definitions. Add `-- --name <what_changed>` | no |
| `npm run db:migrate` | Applies pending migrations | yes |
| `ADMIN_PASSWORD=… npm run db:create-admin -- --email <address> --first-name <name> --last-name <name>` | Creates an approved admin, for local development: with sign-up gone it is the way into an empty database. The email must be in `ACCOUNT_ADMIN_EMAILS`; the password is read from `ADMIN_PASSWORD` for that one run. Refuses to run with `NODE_ENV=production` | yes |
| `npm run dev:api` | API with reload on change, http://localhost:4000 | yes, for anything that reads data |
| `npm run dev:web` | SPA with hot reload, http://localhost:5173. No service worker | no |
| `npm run build` | Builds both services: `backend/dist/` and `frontend/dist/` (with `sw.js`) | no |
| `npm run typecheck` | TypeScript, both services | no |
| `npm run lint` | oxlint, both services | no |
| `npm run arch:check` | The dependency rule, both services ([ADR 0004](../decisions/0004-layer-rules-are-enforced-by-dependency-cruiser.md)) | no |
| `npm run design:check` | Tokens only under `frontend/src`: no raw colours, one-off type/elevation/radius/duration/easing values, interpolated classes, `text-accent`, or hand-added tracking ([DESIGN.md](../../frontend/DESIGN.md)) | no |
| `npm run test:unit` | Every test that needs no database | no |
| `npm test` | Every test. Creates and migrates `s1_gateway_test` first | yes |
| `npm run docs:check` | Every relative link in the docs resolves; plan statuses agree with their checklists and the index | no |
| `npm run check:commits` | The AI-attribution check over `origin/main..HEAD` | no |
| `npm run check:pr -- --body-file pr.md` | What the `pr-audit` check runs: the description in `pr.md` and the diff against `origin/main` ([Open a pull request](../guides/open-a-pull-request.md)) | no |
| `npm run test:scripts` | The tests of the repository scripts, such as the PR audit. Part of `npm test` and `npm run test:unit` | no |
| `node scripts/screenshot.mjs '<json>'` | Screenshots a page of a locally running app in headless Chrome or Edge. Options are documented at the top of the script | no |

## In `frontend/`

| Command | Does |
|---|---|
| `npm run pwa:icons` | Regenerates the PWA icons in `public/brand/` from `public/brand/app-icon.png` (settings in `pwa-assets.config.ts`) |
| `npm run preview` | Serves the production build locally, with the service worker |

## In `backend/`

| Command | Does |
|---|---|
| `npm run atlas:import -- --workbook "<path>" --report "<path>" --as <email> [--write]` | Imports the verified list into the Atlas library of the database in `DATABASE_URL` ([plan 0006](../plans/0006-s2-spec-ids-and-verified-list-import.md), [ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md)). Without `--write` it is a dry run and saves nothing. See below |

### `atlas:import`

| Option | Means |
|---|---|
| `--workbook` | The verified list workbook. It reads sheet "Main Table" from row 4: columns A–B, COMPANY and COUNTRY; C–G, item name, Category, Material, Dimension, Weight; and O–U, the FOB prices per unit, per case and total, the mold cost, and the mold, sample and production lead times. A merged cell's value applies to every row it spans, so a COMPANY merged down a block of rows is each row's manufacturer |
| `--report` | Where to write the report, a CSV file: the totals first, then one line per row with its outcome (`new`, `same as row <n>`, `already saved` or `skipped`), its code, `manufacturer` (`found` or `no manufacturer`), `quote` (`recorded` or `not recorded`), why it was skipped, what was read from it, any fact dropped and why, and any flag |
| `--as` | The email of an active staff account, recorded as the one who saved each Spec ID. Any other email is refused before the workbook is read |
| `--write` | Saves the Spec IDs not already saved, and replaces every quote with one for each row imported that names its manufacturer ([ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md)). Running it again saves no new Spec ID and leaves as many quotes. Manufacturers are found or added, never deleted |

A dry run's report says what `--write` would do. A quote's values are kept as
Excel shows them, number format and all (`$0.0350`). A price that is a
formula has a value only if Excel saved one with it; a workbook last saved by
a tool that does not calculate has none, and the report flags each such cell,
for example `FOB per unit: a formula with no value saved in the workbook`.
Opening the workbook in Excel and saving it stores the values.

The workbook and the report hold Source One rows, names and prices: keep
both outside the repository and never commit either
([constraints](../explanation/constraints.md#6-the-repository-is-public)).
Spellings come from `WORD_LIST` in
`backend/src/modules/atlas/domain/reading/`.

| When | It prints |
|---|---|
| A dry run | `Dry run: nothing was saved. {n} Spec IDs would be created from {r} rows; {s} rows skipped. Report: {path}` |
| `--write` | `Saved {n} Spec IDs from {r} rows; {e} were already saved; {s} rows skipped. Report: {path}` |
| `--as` is not an active staff account | `No active staff account is {email}. Nothing was imported.` |

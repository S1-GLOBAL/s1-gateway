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
| `npm run dev:api` | API with reload on change, http://localhost:4000 | yes, for anything that reads data |
| `npm run dev:web` | SPA with hot reload, http://localhost:5173. No service worker | no |
| `npm run build` | Builds both services: `backend/dist/` and `frontend/dist/` (with `sw.js`) | no |
| `npm run typecheck` | TypeScript, both services | no |
| `npm run lint` | oxlint, both services | no |
| `npm run arch:check` | The dependency rule, both services ([ADR 0004](../decisions/0004-layer-rules-are-enforced-by-dependency-cruiser.md)) | no |
| `npm run test:unit` | Every test that needs no database | no |
| `npm test` | Every test. Creates and migrates `s1_gateway_test` first | yes |
| `npm run docs:check` | Every relative link in the docs resolves; plan statuses agree with their checklists and the index | no |
| `npm run check:commits` | The AI-attribution check over `origin/main..HEAD` | no |
| `node scripts/screenshot.mjs '<json>'` | Screenshots a page of a locally running app in headless Chrome or Edge. Options are documented at the top of the script | no |

## In `frontend/`

| Command | Does |
|---|---|
| `npm run pwa:icons` | Regenerates the PWA icons in `public/` from `public/icon.svg` |
| `npm run preview` | Serves the production build locally, with the service worker |

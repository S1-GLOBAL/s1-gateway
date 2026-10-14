# 0001. Project scaffold

- **Status:** Complete except the browser checks of the PWA and the Tools page
- **Owner:** Rey Denzo
- **Related:** [ADR 0003](../decisions/0003-clean-architecture-with-layers-inside-modules.md) ·
  [ADR 0004](../decisions/0004-layer-rules-are-enforced-by-dependency-cruiser.md) ·
  [ADR 0007](../decisions/0007-one-definition-of-an-api-shape.md) ·
  [ADR 0008](../decisions/0008-testing-strategy.md) ·
  [ADR 0010](../decisions/0010-the-app-shell-is-cached-api-responses-never-are.md)

## Goal

At the end of this plan, `s1-gateway` — Source One Global's Gateway, an
internal staff hub — is a working PERN + TypeScript repository: Postgres 17 in
Docker, an Express 5 API and a React 19 SPA that installs as a PWA, both built
to Clean Architecture with the dependency rule enforced by a check rather than
by review, one real example module (`tools`) running end to end through every
layer, and a `docs/` tree with the same architecture as Bilikha's.

## Scope

**In scope**
- Root repository: tooling scripts, git hooks, CI workflow, Docker Postgres
- Backend: shared kernel, composition root, `health` and `tools` modules
- Frontend: app shell, shared UI primitives, `tools` feature, Tools page
- PWA: manifest, icons, a precached app shell, an update prompt, an offline
  notice, and a kill switch
- Type-only API contracts, imported by both sides
- Architecture check (`arch:check`) for both services
- Documentation tree and its checks (`docs:check`)

**Out of scope** — and where it is handled instead
- Staff authentication — a later plan; nothing in this scaffold is access-controlled
- Visual identity (colours, type, logo) — `frontend/DESIGN.md` and the icon
  start as neutral placeholders; a later decision
- Deployment, hosting and the release procedure — a later plan;
  `reference/deployments.md` and a release guide are written when something is deployed
- Caching API responses for offline reading — rejected for now by ADR 0010
- Bilikha's pull-request audit, bundle budget, release guard and screenshot scripts

## Rules for whoever executes this

1. **Read the Design section before Phase 1.** Every file below implements it.
2. **Execute with `superpowers:executing-plans`** (or
   `superpowers:subagent-driven-development`). Tick each box as it is done.
3. **Do not commit.** The owner has not asked for commits. Leave every change
   uncommitted in the working tree; the owner makes the first commit.
4. **Never add AI attribution** to anything — no `Co-Authored-By` naming an AI,
   no "Generated with" footer. See ADR 0009.
5. **Minimal local load.** Run only the checks a step names. Do not start
   Docker or a dev server unless the step says so; stop anything you start.
6. **All paths are relative to `C:\SOG\s1-gateway`** unless a step says otherwise.
7. **If a step's expected output does not appear, stop and report** rather
   than improvising around it.

---

## Design

### Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL 17 (Docker locally, host port 5436) |
| API | Express 5 + TypeScript 6 (ESM, `NodeNext`), Drizzle ORM, zod 4, Pino |
| Web | React 19 + TypeScript 6, Vite 8, Tailwind CSS 4, TanStack Query 5, Axios, React Router 7 |
| PWA | vite-plugin-pwa 2 (Workbox), `@vite-pwa/assets-generator` for icons |
| Tests | Vitest 5 (both sides), supertest, Testing Library, happy-dom |
| Lint | oxlint (both sides) |
| Architecture | dependency-cruiser 18 (both sides) |

TypeScript is 6, not 7: dependency-cruiser parses TypeScript through the
compiler API, which TypeScript 7 does not ship.

Two `package.json` files under one root, driven by root scripts using
`npm --prefix`. No npm workspaces.

### Repository layout

```
s1-gateway/
├── docs/                 developer documentation
├── backend/              Express API
├── frontend/             React SPA + PWA, with frontend/DESIGN.md
├── scripts/              setup-env, install-git-hooks, check-commit-msg,
│                         check-doc-links, check-plan-status
├── .githooks/            commit-msg (attribution), pre-push (checks)
├── .github/workflows/    ci.yml
├── docker-compose.yml    Postgres 17
└── package.json          root scripts
```

### The dependency rule

Each module (backend) and feature (frontend) has four layers. Dependencies
point inward only:

```
presentation ──┐
               ├──▶ application ──▶ domain
infrastructure ┘
```

**Backend**

| Layer | May import | Must not import |
|---|---|---|
| `domain` | its own module's `domain`, `shared/domain` | any other layer, any npm package, any Node built-in |
| `application` | its own module's `domain` and `application`, `shared/domain`, `shared/application` | `infrastructure`, `presentation`, any npm package, any Node built-in |
| `infrastructure` | inward layers, `shared/infrastructure`, npm packages | any `presentation` |
| `presentation` | inward layers, `shared/presentation`, `contracts`, npm packages | any `infrastructure` |
| `contracts` | nothing but sibling contracts, type-only | everything else; emits no JavaScript |

**Frontend**

| Layer | May import | Must not import |
|---|---|---|
| `domain` | its own feature's `domain`, `shared/domain` | any other layer, any npm package |
| `application` | inward layers, `shared/application`, `react`, `@tanstack/react-query` | `infrastructure`, `presentation`, any other npm package |
| `infrastructure` | inward layers, `shared/infrastructure`, `@contracts/*`, npm packages | any `presentation` |
| `presentation` | inward layers, `shared/ui`, `shared/application` | any `infrastructure`, `axios`, `@contracts/*` |
| `shared/ui` | itself, `react`, `clsx`, `tailwind-merge` | everything else |

**Both sides**
- A module or feature imports another only through that one's `index.ts`.
- `shared/` never imports a module, feature, page or the app.
- Composition roots import anything: backend `src/main.ts`, `src/compose.ts`,
  `src/database-schema.ts` and each module's `index.ts`; frontend `src/app/`,
  `src/main.tsx` and each feature's `index.ts`.
- Dependency injection is constructor arguments and React context, by hand.
  No container.
- No circular dependencies anywhere.
- Test files (`*.test.ts(x)`, `src/test/`) are outside the rules.

`npm run arch:check` runs dependency-cruiser over both services and fails on
any violation. It runs in CI and in the pre-push hook.

### Backend

```
backend/src/
├── main.ts                       process entry: env, logger, database, listen, shutdown
├── compose.ts                    composeApp(deps): builds every module into one Express app
├── database-schema.ts            aggregates module tables for drizzle-kit
├── shared/
│   ├── domain/                   Result, DomainError
│   ├── application/              UseCase<I, O>; ports: Clock, IdGenerator, Logger;
│   │                             testing/fakes.ts (FixedClock, SequentialIdGenerator,
│   │                             silentLogger, RecordingLogger)
│   ├── infrastructure/           config/env.ts, database/connection.ts,
│   │                             database/postgres-errors.ts, logging/pino-logger.ts,
│   │                             system-clock.ts, crypto-id-generator.ts
│   └── presentation/http/        create-app.ts, http-module.ts, http-error.ts,
│                                 respond.ts, parse-body.ts, error-handler.ts,
│                                 not-found-handler.ts
├── contracts/                    envelope.ts, health.ts, tools.ts — types only
├── test/                         global-setup.ts, database.ts (DB-backed tests only)
└── modules/
    ├── health/
    │   ├── presentation/         health.routes.ts
    │   └── index.ts              buildHealthModule()
    └── tools/
        ├── domain/               tool.ts, tool.errors.ts, tool-repository.ts
        ├── application/          tool.dto.ts, list-tools.ts, create-tool.ts,
        │                         testing/in-memory-tool-repository.ts
        ├── infrastructure/       tools.table.ts, tool.mapper.ts,
        │                         drizzle-tool-repository.ts
        ├── presentation/         tools.schemas.ts, tools.controller.ts, tools.routes.ts
        └── index.ts              buildToolsModule(deps)
```

**The `tools` module.** A tool is an internal application or link a staff
member can open from the hub.

| Field | Rule |
|---|---|
| `id` | UUID, from the `IdGenerator` port |
| `name` | 1–80 characters after trimming; unique ignoring case |
| `url` | absolute `http:` or `https:` URL, at most 2048 characters after trimming |
| `description` | 0–280 characters after trimming; defaults to empty |
| `category` | 1–40 characters after trimming |
| `createdAt` | from the `Clock` port |

`Tool.create` checks every rule and returns a `Result` carrying all broken
rules at once. Use cases return `Result`; the controller maps a
`DomainError`'s `code` to an HTTP status. Name uniqueness is enforced by a
unique index on `lower(name)`; the repository turns a unique violation into
`ToolNameTakenError`, so two simultaneous requests cannot both succeed.

**HTTP surface**, all under `/api/v1`:

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/health` | 200 `{ data: { status: "ok" } }` | — |
| GET | `/tools` | 200 `{ data: Tool[] }`, by category then name, ignoring case | — |
| POST | `/tools` | 201 `{ data: Tool }` | 400 `VALIDATION_FAILED`, 400 `MALFORMED_JSON`, 409 `TOOL_NAME_TAKEN`, 413 `PAYLOAD_TOO_LARGE` |
| any | unknown | — | 404 `NOT_FOUND` |

Every error has one shape: `{ error: { code, message, details? } }`. A
field-level failure puts `details.fields` as `{ [field]: string[] }`. An
unexpected throw is logged at error level and answered with a generic 500
`INTERNAL_ERROR` that carries no stack.

### Frontend

```
frontend/src/
├── main.tsx                      mounts <App/>
├── vite-env.d.ts                 VITE_API_URL type
├── app/                          App, providers, router, dependencies, query-client,
│   └── pwa/                      UpdatePrompt, OfflineBanner, use-online-status
├── shared/
│   ├── application/              app-error.ts (AppError: code, message, fields)
│   ├── infrastructure/           http-client.ts, to-app-error.ts
│   └── ui/                       cn, Button, Card, TextField — no domain knowledge
├── features/tools/
│   ├── domain/                   tool.ts, group-by-category.ts, is-web-url.ts
│   ├── application/              tools-gateway.ts (port), tools-gateway-context.tsx,
│   │                             tools.keys.ts, use-tools.ts, use-create-tool.ts
│   ├── infrastructure/           http-tools-gateway.ts
│   ├── presentation/             ToolCard, ToolList, CreateToolForm
│   └── index.ts                  public surface of the feature
├── pages/                        ToolsPage, NotFoundPage — route composition only
├── styles/                       theme.css (tokens, @theme static), index.css
└── test/setup.ts                 Testing Library cleanup
```

The frontend's `Tool` (with `createdAt: Date`) is its own domain type;
`HttpToolsGateway` maps the contract's `Tool` (with `createdAt: string`) into
it. Contract types never reach `presentation`.

A failed request always rejects with `AppError`, so a component renders
`error.message` and `error.fields[name]` without knowing whether the cause was
a timeout, no connection, or a 409.

The Vite dev server proxies `/api` to `http://localhost:4000`.

### PWA

- **Installable.** A web app manifest (`S1 Gateway`, standalone, start `/`)
  and icons generated once from `public/icon.svg`.
- **Offline app shell.** Workbox precaches the build output: JS, CSS, HTML,
  icons. Navigations fall back to the cached `index.html`, **except under
  `/api/`**, which always goes to the network.
- **API responses are never cached** (ADR 0010). Offline, the Tools page shows
  the normal "cannot reach the server" message, and an offline banner says why.
- **Updates prompt, never surprise.** `registerType: 'prompt'`: a new worker
  waits; `UpdatePrompt` offers "Reload" and "Later". No `skipWaiting` behind a
  user's back.
- **Kill switch.** Building with `PWA_SELF_DESTROY=true` ships a worker that
  unregisters itself and clears its caches — vite-plugin-pwa's `selfDestroying`.
- **No worker in development.** `devOptions.enabled: false`, so `npm run dev:web`
  never serves a stale cache.

### Contracts

`backend/src/contracts/` holds TypeScript types for every request and
response. No runtime code, no zod, no imports except type-only imports of a
sibling contract. The backend annotates responses with them and validates
requests with zod schemas declared `satisfies z.ZodType<Contract>`; the
frontend imports them with `import type` through the `@contracts/*` path
alias, in `infrastructure` only.

### Tests

| What | Where | Database |
|---|---|---|
| Entity invariants, pure rules | `domain/*.test.ts` | none |
| Use cases, with in-memory fakes of the ports | `application/*.test.ts` | none |
| HTTP mapping, with real use cases over the in-memory repository | `presentation/*.test.ts` via supertest | none |
| Drizzle repository | `infrastructure/*.db.test.ts` | real Postgres |
| Whole app, as composed | `src/compose.db.test.ts` | real Postgres |
| Frontend domain, gateway, form, offline banner | `*.test.ts(x)` | none |

`npm run test:unit` runs everything except `*.db.test.ts`. `npm test` runs all
of it and needs Postgres; CI runs it against a service container.

### Documentation

The same architecture as Bilikha's `docs/`: organised by purpose, one index,
decay rules, templates for decisions and plans.

```
docs/
├── README.md
├── getting-started/local-setup.md
├── guides/              add-a-module, add-a-use-case, change-the-database-schema,
│                        add-a-ui-component, turn-off-the-service-worker
├── reference/           api, data-model, environment, commands
├── explanation/         architecture, constraints
├── decisions/           README, _template, 0001–0010
├── plans/               README, _template, 0001 (this plan)
└── handoffs/            README
```

| # | Decision |
|---|---|
| 0001 | Record architecture decisions |
| 0002 | PERN with a client-rendered SPA |
| 0003 | Clean Architecture with layers inside modules |
| 0004 | Layer rules are enforced by dependency-cruiser |
| 0005 | Generated migrations over `db:push` |
| 0006 | Versioned API prefix from day one |
| 0007 | One definition of an API shape |
| 0008 | Testing strategy |
| 0009 | AI attribution is blocked by a hook, not a rule |
| 0010 | The app shell is cached; API responses never are |

Root files: `README.md` and `CLAUDE.md`. `frontend/DESIGN.md` holds the
design-system rules.

---

## Global constraints

- Node 22 or 24 (dependency-cruiser's engine range); verified on Node 24.10.0.
- TypeScript `~6.0.2` in both services. Not 7.
- Backend relative imports end in `.js` (ESM, `NodeNext`). Frontend relative
  imports have no extension (`bundler` resolution).
- Frontend has `erasableSyntaxOnly`: no constructor parameter properties, no
  enums, no namespaces. Declare class fields explicitly.
- Contracts are types only. `import type` everywhere they are used.
- Styling uses tokens only: no raw colours in components, no interpolated
  Tailwind class names.
- API errors: `{ error: { code, message, details? } }`; field errors in
  `details.fields` as `{ [field]: string[] }`.
- Field limits: name 80, URL 2048, description 280, category 40.
- Docker Postgres: user `s1gateway`, password `s1gateway`, database
  `s1_gateway`, host port `5436`. Tests use `s1_gateway_test` and refuse any
  database whose name does not end in `_test`.
- No commits, no remotes, no pushes. No AI attribution anywhere.

## Review focus

Inputs and conditions the spec implies that a user is most likely to hit:

1. **A duplicate name that differs only in case or surrounding spaces**
   (`"  PAYROLL "` after `"Payroll"`) → 409 `TOOL_NAME_TAKEN`, never a 500 or a
   second row. Pinned in Task 3.2 (use case), Task 3.3 (route) and Task 3.4
   (repository against Postgres).
2. **A malformed or missing request body** → 400 in the error shape, never a
   500. Pinned in Task 3.3.
3. **A non-web URL** (`javascript:`, `ftp:`, relative) → rejected by the
   backend, and never rendered as a clickable link by the frontend even if one
   reached the database. Pinned in Task 3.1 and Task 5.1 / 5.4.
4. **An over-long field** (a 2049-character URL) → 400, never a database error
   surfacing as 500. Pinned in Task 3.1.
5. **The server unreachable or slow** → a readable message on the page and an
   offline banner, never a blank screen; and offline navigation never answers
   an `/api/` request with cached HTML. Pinned in Task 5.3, Task 5.4 and
   Task 6.2.

## Prerequisites

- Node 22 or 24 — `node --version` prints `v22.x` or `v24.x`
- npm — `npm --version` prints a version
- Git — `git --version`; `C:\SOG\s1-gateway` is a repository on `main` with no commits
- Docker Desktop — only for Phase 7's optional database run and CI parity

## Progress

| Phase | Steps | Status |
|---|---|---|
| 1. Repository foundation | 11 / 11 | Done |
| 2. Backend foundation | 22 / 22 | Done |
| 3. Tools module (backend) | 22 / 22 | Done |
| 4. Frontend foundation | 14 / 14 | Done |
| 5. Tools feature (frontend) | 19 / 19 | Done |
| 6. PWA | 10 / 10 | Done |
| 7. Documentation | 14 / 14 | Done |
| 8. Verification | 9 / 9 | Done |

**Deviations from the steps above**, made while executing and kept:

- Lint runs `oxlint --deny-warnings`: oxlint's default rules are warnings and
  exit 0, so without the flag the lint gate could never fail.
- The dependency-cruiser configs gained `only-layer-folders`,
  `test-doubles-only-in-tests` and (frontend) `pages-not-to-infrastructure`,
  closing ways around the layer rules a review found
  ([ADR 0004](../decisions/0004-layer-rules-are-enforced-by-dependency-cruiser.md)).
- The error handler answers every client-caused body-parser failure with its
  4xx status (415 `UNSUPPORTED_MEDIA_TYPE`, otherwise `BAD_REQUEST`), not 500.
- `Tool.create` rejects control characters in every field; Postgres refuses NUL.
- The frontend's `isWebUrl` uses `new URL` in a try instead of `URL.canParse`,
  which Safari 16 lacks.
- VitePWA has no `includeAssets` and sets `includeManifestIcons: false`, so
  each icon is precached once.
- Unit test totals are therefore backend 40 and frontend 26, not the 34 and 25
  the steps expect.
- Docker Postgres is published on host port **5436**, not 5433: the owner's
  machine runs a local Postgres on 5433, which answered `localhost` instead of
  the container. The six database-backed tests then passed against the
  container (2026-10-15).

**Not yet verified in a browser:** installing the PWA, the offline shell, and
creating a tool on the Tools page against a running API. The behaviour is
covered by component tests and by inspecting the built `sw.js`.

---

## Phase 1 — Repository foundation

### Task 1.1 — Root files

**Files:**
- Create: `package.json`, `.gitignore`, `.gitattributes`, `docker-compose.yml`

- [x] **Step 1: Create `package.json`.**

```json
{
  "name": "s1-gateway",
  "version": "0.1.0",
  "private": true,
  "description": "s1-gateway — Source One Global's Gateway, the internal staff hub",
  "scripts": {
    "setup": "npm run setup:env && npm run hooks:install && npm --prefix backend install && npm --prefix frontend install",
    "setup:env": "node scripts/setup-env.mjs",
    "hooks:install": "node scripts/install-git-hooks.mjs",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:reset": "docker compose down -v && docker compose up -d",
    "db:generate": "npm --prefix backend run db:generate",
    "db:migrate": "npm --prefix backend run db:migrate",
    "dev:api": "npm --prefix backend run dev",
    "dev:web": "npm --prefix frontend run dev",
    "build": "npm --prefix backend run build && npm --prefix frontend run build",
    "lint": "npm --prefix backend run lint && npm --prefix frontend run lint",
    "typecheck": "npm --prefix backend run typecheck && npm --prefix frontend run typecheck",
    "arch:check": "npm --prefix backend run arch:check && npm --prefix frontend run arch:check",
    "test": "npm --prefix backend run test && npm --prefix frontend run test",
    "test:unit": "npm --prefix backend run test:unit && npm --prefix frontend run test",
    "docs:check": "node scripts/check-doc-links.mjs && node scripts/check-plan-status.mjs",
    "check:commits": "node scripts/check-commit-msg.mjs --range origin/main..HEAD"
  }
}
```

- [x] **Step 2: Create `.gitignore`.**

```gitignore
node_modules/
dist/
build/
dev-dist/
.env
.env.*
!.env.example

*.log
npm-debug.log*
.DS_Store
Thumbs.db

.vscode/*
!.vscode/extensions.json
.idea/

coverage/
.vite/

# Scratch output from manual API testing. Cookie jars and request bodies can
# hold session ids and passwords, so they must never be committable.
tmp/
tmp-*
*.cookies
```

- [x] **Step 3: Create `.gitattributes`.**

```gitattributes
* text=auto eol=lf
*.png binary
*.ico binary
```

- [x] **Step 4: Create `docker-compose.yml`.**

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: s1-gateway-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: s1gateway
      POSTGRES_PASSWORD: s1gateway
      POSTGRES_DB: s1_gateway
    # 5436 on the host so this never collides with another project's
    # Postgres on 5432.
    ports:
      - '5436:5432'
    volumes:
      - s1-gateway-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U s1gateway -d s1_gateway']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  s1-gateway-pgdata:
```

### Task 1.2 — Repository scripts

**Files:**
- Create: `scripts/setup-env.mjs`, `scripts/install-git-hooks.mjs`,
  `scripts/check-doc-links.mjs`, `scripts/check-plan-status.mjs`,
  `scripts/check-commit-msg.mjs`

- [x] **Step 1: Copy the five scripts from Bilikha.** Copy each file
  byte-for-byte from `C:\client_projects\Bilikha\scripts\` into `scripts\`:
  `setup-env.mjs`, `install-git-hooks.mjs`, `check-doc-links.mjs`,
  `check-plan-status.mjs`, `check-commit-msg.mjs`.

```bash
cp /c/client_projects/Bilikha/scripts/{setup-env,install-git-hooks,check-doc-links,check-plan-status,check-commit-msg}.mjs /c/SOG/s1-gateway/scripts/
```

- [x] **Step 2: Make the copies about s1-gateway.** Apply exactly these edits:
  - `scripts/install-git-hooks.mjs`: replace `Bilikha's hooks live in` with
    `s1-gateway's hooks live in`.
  - `scripts/check-commit-msg.mjs`: in the header comment, replace the
    paragraph beginning `CLAUDE.md has forbidden` and ending `See ADR 0041.`
    with:

    ```
     * CLAUDE.md forbids `Co-authored-by` trailers naming an AI tool. A rule in a
     * markdown file only binds the tools that read it; this binds the ones that
     * do not. In Bilikha, 37 commits carried an AI trailer despite the rule, and
     * GitHub attached a bot to the contributor list for good. See ADR 0009.
    ```

    and in the final error text replace `"Commit and pull request attribution", and ADR 0041.`
    with `"Commit and pull request attribution", and ADR 0009.`
  - `scripts/check-plan-status.mjs`: replace the line
    `const PHASE_HEADING = /^#\s*Phase\s+(\d+)\b/;` with
    `const PHASE_HEADING = /^#{1,3}\s*Phase\s+(\d+)\b/;` and the comment above
    it with `` /** `## Phase 6 — Portfolio` */ `` — the original pattern never
    matched a `##` heading, so unticked boxes were never attributed to a phase.
  - `scripts/check-doc-links.mjs`: no change.
  - `scripts/setup-env.mjs`: no change.

- [x] **Step 3: Verify the scripts load.**

Run: `node scripts/check-doc-links.mjs` from the repository root.
Expected: `Scanned 1 markdown files, …`, then a list of broken links, all in
`docs/plans/0001-project-scaffold.md`, and exit 1. That is correct for now:
this plan links to documents Phase 7 writes. A stack trace is a failure.

### Task 1.3 — Git hooks and CI

**Files:**
- Create: `.githooks/commit-msg`, `.githooks/pre-push`, `.github/workflows/ci.yml`

- [x] **Step 1: Create `.githooks/commit-msg`** — copy Bilikha's
  `.githooks/commit-msg` byte-for-byte; it names no project.

- [x] **Step 2: Create `.githooks/pre-push`.**

```sh
#!/bin/sh
#
# Runs the fast checks before anything leaves this machine: typecheck, lint,
# the architecture check and the docs checks. A red push only becomes a red
# CI run a few minutes later — this is the same answer, sooner.
#
# Tests are left to CI because some need the Docker database. This is a
# convenience, not the gate: `git push --no-verify` skips it, and CI does not.

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

# Deleting a remote branch pushes nothing to check.
zero=0000000000000000000000000000000000000000
pushing=0
while read -r _local_ref local_sha _remote_ref _remote_sha; do
  [ "$local_sha" != "$zero" ] && pushing=1
done
[ "$pushing" = 0 ] && exit 0

if ! command -v npm >/dev/null 2>&1; then
  echo "pre-push: npm not found, skipping the checks — CI will run them" >&2
  exit 0
fi

if [ ! -d "$root/backend/node_modules" ] || [ ! -d "$root/frontend/node_modules" ]; then
  echo "pre-push: dependencies not installed (run npm run setup), skipping — CI will run the checks" >&2
  exit 0
fi

cd "$root" || exit 1

for check in typecheck lint arch:check docs:check; do
  echo "pre-push: npm run $check" >&2
  if ! output=$(npm run --silent "$check" 2>&1); then
    echo "$output" >&2
    echo "" >&2
    echo "pre-push: \`npm run $check\` failed. Push refused." >&2
    exit 1
  fi
done
```

- [x] **Step 3: Create `.github/workflows/ci.yml`.**

```yaml
name: CI

on:
  push:
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest

    services:
      # Tests run against real Postgres by decision — ADR 0008.
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: s1gateway
          POSTGRES_PASSWORD: s1gateway
          POSTGRES_DB: s1_gateway_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U s1gateway -d s1_gateway_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    env:
      TEST_DATABASE_URL: postgres://s1gateway:s1gateway@localhost:5432/s1_gateway_test

    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v5
        with:
          node-version: '24'
          cache: npm
          cache-dependency-path: |
            backend/package-lock.json
            frontend/package-lock.json

      # The commit-msg hook only protects clones that ran `npm run setup`.
      # This is the real enforcement — ADR 0009.
      - name: Commit messages
        env:
          EVENT: ${{ github.event_name }}
          BASE: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.sha }}
          BEFORE: ${{ github.event.before }}
          PR_HEAD: ${{ github.event.pull_request.head.sha }}
        run: |
          if [ "$EVENT" = "pull_request" ]; then
            range="$BASE..$PR_HEAD"
          elif git cat-file -e "$BEFORE^{commit}" 2>/dev/null; then
            range="$BEFORE..$HEAD_SHA"
          elif git rev-parse -q --verify "$HEAD_SHA^" >/dev/null; then
            range="$HEAD_SHA~1..$HEAD_SHA"
          else
            range="$HEAD_SHA"
          fi
          echo "checking $range"
          node scripts/check-commit-msg.mjs --range "$range"

      - name: Install backend
        run: npm ci --prefix backend

      - name: Install frontend
        run: npm ci --prefix frontend

      - name: Typecheck
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Architecture
        run: npm run arch:check

      # The backend's globalSetup creates and migrates the test database.
      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Docs
        run: npm run docs:check
```

- [x] **Step 4: Verify the attribution check rejects a trailer.**

Run (Git Bash, repository root):
```bash
printf 'Add x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n' > "$TMP/msg.txt"; node scripts/check-commit-msg.mjs "$TMP/msg.txt"; echo "exit=$?"
```
Expected: `AI attribution found in the commit message:` … and `exit=1`.

---

## Phase 2 — Backend foundation

### Task 2.1 — Backend package and configuration

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`,
  `backend/tsconfig.build.json`, `backend/.env.example`,
  `backend/vitest.config.ts`, `backend/vitest.unit.config.ts`,
  `backend/drizzle.config.ts`, `backend/.dependency-cruiser.cjs`

- [x] **Step 1: Create `backend/package.json`.**

```json
{
  "name": "@s1-gateway/backend",
  "version": "0.1.0",
  "private": true,
  "description": "s1-gateway API",
  "type": "module",
  "engines": {
    "node": "^22 || ^24"
  },
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js",
    "typecheck": "tsc --noEmit",
    "lint": "oxlint src",
    "arch:check": "depcruise src --config .dependency-cruiser.cjs",
    "test": "vitest run",
    "test:unit": "vitest run --config vitest.unit.config.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "compression": "^1.8.2",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "drizzle-orm": "^0.45.2",
    "express": "^5.2.1",
    "helmet": "^8.3.0",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0",
    "postgres": "^3.4.9",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/compression": "^1.8.1",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/node": "^24.13.3",
    "@types/supertest": "^7.2.1",
    "dependency-cruiser": "^18.6.0",
    "drizzle-kit": "^0.31.10",
    "oxlint": "^1.83.0",
    "pino-pretty": "^13.1.3",
    "supertest": "^7.3.1",
    "tsx": "^4.23.13",
    "typescript": "~6.0.2",
    "vitest": "^5.0.1"
  }
}
```

- [x] **Step 2: Create `backend/tsconfig.json` and `backend/tsconfig.build.json`.**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["src/**/*.test.ts", "src/test/**", "src/**/testing/**"]
}
```

- [x] **Step 3: Create `backend/.env.example`.**

```dotenv
NODE_ENV=development
PORT=4000
LOG_LEVEL=info
# The Docker Postgres from docker-compose.yml, published on host port 5436.
DATABASE_URL=postgres://s1gateway:s1gateway@localhost:5436/s1_gateway
# The SPA's origin, allowed by CORS.
CORS_ORIGIN=http://localhost:5173
```

- [x] **Step 4: Create the two Vitest configs.**

`backend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

/**
 * Every test, including the ones that need Postgres (`*.db.test.ts`).
 *
 * The database URL is decided here, before any module loads, so nothing in
 * the application reads a test-specific variable. `TEST_DATABASE_URL` wins;
 * otherwise the Docker database's `_test` sibling is used.
 */
const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://s1gateway:s1gateway@localhost:5436/s1_gateway_test';

// globalSetup runs before the test environment exists, so it reads this from
// the inherited process environment rather than from `test.env`.
process.env.DATABASE_URL = DATABASE_URL;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // One database, shared: parallel files would truncate each other's rows.
    fileParallelism: false,
    globalSetup: ['./src/test/global-setup.ts'],
    env: { NODE_ENV: 'test', DATABASE_URL, LOG_LEVEL: 'silent' },
    hookTimeout: 60_000,
  },
});
```

`backend/vitest.unit.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

/** Everything that runs without a database: domain, application, presentation. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.db.test.ts', 'node_modules/**'],
  },
});
```

- [x] **Step 5: Create `backend/drizzle.config.ts`.**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database-schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
```

- [x] **Step 6: Create `backend/.dependency-cruiser.cjs`.**

```js
/**
 * The dependency rule, enforced (ADR 0003, ADR 0004).
 *
 * Layers: domain ← application ← infrastructure / presentation. `$1` in a
 * `to` pattern refers to the group captured by the rule's `from.path`, so
 * "its own module" means the same module the importing file lives in.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'Domain imports only its own domain and shared/domain — no package, no Node built-in.',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/domain/' },
      to: { pathNot: ['^src/$1/domain/', '^src/shared/domain/'] },
    },
    {
      name: 'application-depends-only-inward',
      comment: 'Application imports only domain and application code — no package, no Node built-in.',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/application/' },
      to: { pathNot: ['^src/$1/(domain|application)/', '^src/shared/(domain|application)/'] },
    },
    {
      name: 'infrastructure-not-to-presentation',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/infrastructure/' },
      to: { path: '^src/(modules/[^/]+|shared)/presentation/' },
    },
    {
      name: 'presentation-not-to-infrastructure',
      severity: 'error',
      from: { path: '^src/(modules/[^/]+|shared)/presentation/' },
      to: { path: '^src/(modules/[^/]+|shared)/infrastructure/' },
    },
    {
      name: 'modules-meet-only-at-index',
      comment: 'Another module is reached through its index.ts, never its internals.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/', pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'] },
    },
    {
      name: 'shared-knows-no-module',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(modules/|main\\.ts|compose\\.ts|database-schema\\.ts)' },
    },
    {
      name: 'contracts-are-self-contained',
      comment: 'Contracts are types only and import nothing but each other.',
      severity: 'error',
      from: { path: '^src/contracts/' },
      to: { pathNot: '^src/contracts/' },
    },
    {
      name: 'contracts-only-in-presentation',
      severity: 'error',
      from: { pathNot: ['^src/(modules/[^/]+|shared)/presentation/', '^src/contracts/'] },
      to: { path: '^src/contracts/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.test\\.ts$', '^src/test/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.json'],
    },
  },
};
```

- [x] **Step 7: Install.**

Run: `npm install` in `backend/`.
Expected: exits 0 and writes `backend/package-lock.json`. Warnings are fine;
`ERR!` is a failure.

### Task 2.2 — Shared kernel: domain and application

**Files:**
- Create: `backend/src/shared/domain/result.ts`,
  `backend/src/shared/domain/domain-error.ts`,
  `backend/src/shared/application/use-case.ts`,
  `backend/src/shared/application/ports/clock.ts`,
  `backend/src/shared/application/ports/id-generator.ts`,
  `backend/src/shared/application/ports/logger.ts`,
  `backend/src/shared/application/testing/fakes.ts`

**Interfaces — produces:**
- `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }`,
  `ok<T>(value: T)`, `err<E>(error: E)`
- `abstract class DomainError extends Error { abstract readonly code: string; readonly details?: Record<string, unknown> }`
- `interface UseCase<I, O> { execute(input: I): Promise<O> }`
- `interface Clock { now(): Date }`, `interface IdGenerator { next(): string }`,
  `interface Logger { info/warn/error(message: string, context?: Record<string, unknown>): void }`
- `FixedClock(at: Date)`, `SequentialIdGenerator` (ids
  `00000000-0000-4000-8000-000000000001`, `…002`, …), `silentLogger`,
  `RecordingLogger` (`.errors: { message: string; context?: Record<string, unknown> }[]`)

- [x] **Step 1: Create the files.**

`backend/src/shared/domain/result.ts`:
```ts
/**
 * The outcome of an operation that can fail for a reason the caller is
 * expected to handle. Broken business rules travel as values, not exceptions,
 * so a use case's signature says what can go wrong.
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

`backend/src/shared/domain/domain-error.ts`:
```ts
/**
 * A business rule was broken. `code` is stable and machine-readable; the
 * presentation layer maps it to a transport status. `message` is safe to show
 * to a user.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
```

`backend/src/shared/application/use-case.ts`:
```ts
/** One thing the application does, independent of how it is invoked. */
export interface UseCase<I, O> {
  execute(input: I): Promise<O>;
}
```

`backend/src/shared/application/ports/clock.ts`:
```ts
export interface Clock {
  now(): Date;
}
```

`backend/src/shared/application/ports/id-generator.ts`:
```ts
export interface IdGenerator {
  /** A new, unique identifier — a UUID in production. */
  next(): string;
}
```

`backend/src/shared/application/ports/logger.ts`:
```ts
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
```

`backend/src/shared/application/testing/fakes.ts`:
```ts
import type { Clock } from '../ports/clock.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { Logger } from '../ports/logger.js';

/** Test doubles for the shared ports. Never imported by production code. */

export class FixedClock implements Clock {
  constructor(private readonly at: Date) {}

  now(): Date {
    return new Date(this.at);
  }
}

/** Valid version-4 UUIDs, in order, so assertions can name them. */
export class SequentialIdGenerator implements IdGenerator {
  private count = 0;

  next(): string {
    this.count += 1;
    return `00000000-0000-4000-8000-${String(this.count).padStart(12, '0')}`;
  }
}

export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export class RecordingLogger implements Logger {
  readonly errors: { message: string; context?: Record<string, unknown> }[] = [];

  info(): void {}

  warn(): void {}

  error(message: string, context?: Record<string, unknown>): void {
    this.errors.push({ message, context });
  }
}
```

- [x] **Step 2: Typecheck.**

Run: `npm run typecheck` in `backend/`. Expected: exits 0, no output.

### Task 2.3 — Environment, with a test

**Files:**
- Create: `backend/src/shared/infrastructure/config/env.ts`
- Test: `backend/src/shared/infrastructure/config/env.test.ts`

**Interfaces — produces:** `parseEnv(source: Record<string, string | undefined>): Result<Env, string[]>`;
`Env = { NODE_ENV; PORT: number; LOG_LEVEL; DATABASE_URL: string; CORS_ORIGIN: string }`

- [x] **Step 1: Write the failing test.**

```ts
import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const DATABASE_URL = 'postgres://s1gateway:s1gateway@localhost:5436/s1_gateway';

describe('parseEnv', () => {
  it('fills in defaults when only the database is given', () => {
    expect(parseEnv({ DATABASE_URL })).toEqual({
      ok: true,
      value: {
        NODE_ENV: 'development',
        PORT: 4000,
        LOG_LEVEL: 'info',
        DATABASE_URL,
        CORS_ORIGIN: 'http://localhost:5173',
      },
    });
  });

  it('reads PORT as a number', () => {
    const result = parseEnv({ DATABASE_URL, PORT: '8080' });
    expect(result.ok && result.value.PORT).toBe(8080);
  });

  it('names the missing variable', () => {
    const result = parseEnv({});
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.join('\n')).toContain('DATABASE_URL');
  });

  it('rejects a database URL that is not Postgres', () => {
    const result = parseEnv({ DATABASE_URL: 'mysql://localhost/s1' });
    expect(!result.ok && result.error.join('\n')).toContain('DATABASE_URL');
  });
});
```

- [x] **Step 2: Run it and watch it fail.**

Run: `npx vitest run --config vitest.unit.config.ts src/shared/infrastructure/config` in `backend/`.
Expected: FAIL — `Failed to resolve import "./env.js"` or `Cannot find module`.

- [x] **Step 3: Implement `env.ts`.**

```ts
import { z } from 'zod';
import { err, ok, type Result } from '../../domain/result.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CORS_ORIGIN: z.url().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validated once, at boot. A bad value fails here with the variable's name,
 * not three layers deep inside a request an hour later.
 */
export function parseEnv(source: Record<string, string | undefined>): Result<Env, string[]> {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return ok(parsed.data);
  return err(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
}
```

- [x] **Step 4: Run it and watch it pass.**

Run: the command from Step 2. Expected: `4 passed`.

### Task 2.4 — Shared infrastructure

**Files:**
- Create: `backend/src/shared/infrastructure/database/connection.ts`,
  `backend/src/shared/infrastructure/database/postgres-errors.ts`,
  `backend/src/shared/infrastructure/logging/pino-logger.ts`,
  `backend/src/shared/infrastructure/system-clock.ts`,
  `backend/src/shared/infrastructure/crypto-id-generator.ts`

**Interfaces — produces:** `type Database = PostgresJsDatabase`;
`connectDatabase(url: string): DatabaseConnection` with `{ db: Database; close(): Promise<void> }`;
`isUniqueViolation(error: unknown): boolean`; `createPino({ level, pretty }): PinoInstance`;
`class PinoLogger implements Logger`; `class SystemClock implements Clock`;
`class CryptoIdGenerator implements IdGenerator`

- [x] **Step 1: Create the files.**

`backend/src/shared/infrastructure/database/connection.ts`:
```ts
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type Database = PostgresJsDatabase;

export interface DatabaseConnection {
  readonly db: Database;
  close(): Promise<void>;
}

export function connectDatabase(url: string): DatabaseConnection {
  const sql = postgres(url, { max: 10, onnotice: () => undefined });
  return {
    db: drizzle(sql),
    close: () => sql.end({ timeout: 5 }),
  };
}
```

`backend/src/shared/infrastructure/database/postgres-errors.ts`:
```ts
const UNIQUE_VIOLATION = '23505';

/**
 * Postgres reports a broken unique index as SQLSTATE 23505. Drizzle may wrap
 * the driver's error, so the code is looked for on the error and its cause.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate.code === UNIQUE_VIOLATION || candidate.cause?.code === UNIQUE_VIOLATION;
}
```

`backend/src/shared/infrastructure/logging/pino-logger.ts`:
```ts
import { pino, type Logger as PinoInstance } from 'pino';
import type { Logger } from '../../application/ports/logger.js';

export function createPino(options: { level: string; pretty: boolean }): PinoInstance {
  return pino({
    level: options.level,
    ...(options.pretty ? { transport: { target: 'pino-pretty' } } : {}),
  });
}

/** Adapts Pino to the application's Logger port. */
export class PinoLogger implements Logger {
  constructor(private readonly pino: PinoInstance) {}

  info(message: string, context: Record<string, unknown> = {}): void {
    this.pino.info(context, message);
  }

  warn(message: string, context: Record<string, unknown> = {}): void {
    this.pino.warn(context, message);
  }

  error(message: string, context: Record<string, unknown> = {}): void {
    this.pino.error(context, message);
  }
}
```

`backend/src/shared/infrastructure/system-clock.ts`:
```ts
import type { Clock } from '../application/ports/clock.js';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
```

`backend/src/shared/infrastructure/crypto-id-generator.ts`:
```ts
import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../application/ports/id-generator.js';

export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
```

- [x] **Step 2: Typecheck.**

Run: `npm run typecheck` in `backend/`. Expected: exits 0.

### Task 2.5 — Contracts and the HTTP layer, with the health module

**Files:**
- Create: `backend/src/contracts/README.md`, `backend/src/contracts/envelope.ts`,
  `backend/src/contracts/health.ts`,
  `backend/src/shared/presentation/http/http-error.ts`,
  `backend/src/shared/presentation/http/respond.ts`,
  `backend/src/shared/presentation/http/parse-body.ts`,
  `backend/src/shared/presentation/http/error-handler.ts`,
  `backend/src/shared/presentation/http/not-found-handler.ts`,
  `backend/src/shared/presentation/http/http-module.ts`,
  `backend/src/shared/presentation/http/create-app.ts`,
  `backend/src/modules/health/presentation/health.routes.ts`,
  `backend/src/modules/health/index.ts`
- Test: `backend/src/modules/health/presentation/health.routes.test.ts`

**Interfaces — produces:**
- `DataEnvelope<T> = { data: T }`, `ApiErrorBody = { error: { code: string; message: string; details?: Record<string, unknown> } }`, `Health = { status: 'ok' }`
- `class HttpError(status: number, code: string, message: string, details?: Record<string, unknown>)`
- `sendData<T>(res, status, data: T): void`, `sendError(res, status, code, message, details?): void`
- `parseBody<T>(schema: z.ZodType<T>, body: unknown): T` — throws `HttpError` 400 `VALIDATION_FAILED`
  with `details: { fields: Record<string, string[]>, form: string[] }`
- `interface HttpModule { readonly path: string; readonly router: Router }`
- `createApp(options: { modules: HttpModule[]; logger: Logger; corsOrigin: string; requestLogger?: RequestHandler }): Express`
- `buildHealthModule(): HttpModule`

- [x] **Step 1: Write the failing test.**

`backend/src/modules/health/presentation/health.routes.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { silentLogger } from '../../../shared/application/testing/fakes.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { buildHealthModule } from '../index.js';

const app = createApp({
  modules: [buildHealthModule()],
  logger: silentLogger,
  corsOrigin: 'http://localhost:5173',
});

describe('GET /api/v1/health', () => {
  it('answers ok in the data envelope', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });
});

describe('an unknown route', () => {
  it('answers 404 in the error shape', async () => {
    const response = await request(app).get('/api/v1/nothing-here');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(typeof response.body.error.message).toBe('string');
  });
});
```

- [x] **Step 2: Run it and watch it fail.**

Run: `npx vitest run --config vitest.unit.config.ts src/modules/health` in `backend/`.
Expected: FAIL — cannot resolve `create-app.js` / `index.js`.

- [x] **Step 3: Create the contracts.**

`backend/src/contracts/README.md`:
```markdown
# API contracts

The shape of every request and response, declared once and imported by both
the backend and the frontend ([ADR 0007](../../../docs/decisions/0007-one-definition-of-an-api-shape.md)).

## Rules

1. **Types only.** No runtime code: no constants, functions, enums, classes or
   zod. If it compiles to JavaScript it does not belong here.
2. **No imports**, except a type-only import of a sibling contract
   (`import type { Tool } from './tools.js'`).
3. **No Drizzle or domain types.** A contract describes the wire, not a table
   or an entity.
4. **Used only at the edge.** Backend `presentation` and frontend
   `infrastructure` import contracts; nothing else does. `npm run arch:check`
   enforces it.
```

`backend/src/contracts/envelope.ts`:
```ts
/** Every successful response body. */
export interface DataEnvelope<T> {
  data: T;
}

/** Every error response body. Field-level problems are in `details.fields`. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

`backend/src/contracts/health.ts`:
```ts
export interface Health {
  status: 'ok';
}
```

- [x] **Step 4: Create the HTTP layer.**

`backend/src/shared/presentation/http/http-error.ts`:
```ts
/** An error that already knows its HTTP answer. Thrown, and rendered by the error handler. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
```

`backend/src/shared/presentation/http/respond.ts`:
```ts
import type { Response } from 'express';
import type { ApiErrorBody, DataEnvelope } from '../../../contracts/envelope.js';

export function sendData<T>(res: Response, status: number, data: T): void {
  const body: DataEnvelope<T> = { data };
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): void {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  res.status(status).json(body);
}
```

`backend/src/shared/presentation/http/parse-body.ts`:
```ts
import { z } from 'zod';
import { HttpError } from './http-error.js';

/**
 * Checks the request body's shape. Business rules are the domain's job; this
 * only guarantees the use case receives the types it declares.
 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;

  const flattened = z.flattenError(parsed.error);
  throw new HttpError(400, 'VALIDATION_FAILED', 'The request body is not valid.', {
    fields: flattened.fieldErrors,
    form: flattened.formErrors,
  });
}
```

`backend/src/shared/presentation/http/error-handler.ts`:
```ts
import type { ErrorRequestHandler } from 'express';
import type { Logger } from '../../application/ports/logger.js';
import { HttpError } from './http-error.js';
import { sendError } from './respond.js';

interface KnownFailure {
  status: number;
  code: string;
  message: string;
}

/** Express's body parser marks a body it could not read with a `type`. */
function bodyParserFailure(error: unknown): KnownFailure | null {
  if (typeof error !== 'object' || error === null || !('type' in error)) return null;
  if (error.type === 'entity.parse.failed') {
    return { status: 400, code: 'MALFORMED_JSON', message: 'The request body is not valid JSON.' };
  }
  if (error.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' };
  }
  return null;
}

/**
 * The only place an error becomes a response, so the client sees exactly one
 * error shape. Anything unrecognised is a bug: logged in full, answered with a
 * generic 500 that leaks nothing.
 */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    if (error instanceof HttpError) {
      sendError(res, error.status, error.code, error.message, error.details);
      return;
    }

    const failure = bodyParserFailure(error);
    if (failure) {
      sendError(res, failure.status, failure.code, failure.message);
      return;
    }

    logger.error('Unhandled error', { err: error });
    sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Try again later.');
  };
}
```

`backend/src/shared/presentation/http/not-found-handler.ts`:
```ts
import type { RequestHandler } from 'express';
import { sendError } from './respond.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.path}.`);
};
```

`backend/src/shared/presentation/http/http-module.ts`:
```ts
import type { Router } from 'express';

/** What a module hands the composition root: where to mount it, and its routes. */
export interface HttpModule {
  readonly path: string;
  readonly router: Router;
}
```

`backend/src/shared/presentation/http/create-app.ts`:
```ts
import compression from 'compression';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Logger } from '../../application/ports/logger.js';
import { createErrorHandler } from './error-handler.js';
import type { HttpModule } from './http-module.js';
import { notFoundHandler } from './not-found-handler.js';

export interface AppOptions {
  modules: HttpModule[];
  logger: Logger;
  corsOrigin: string;
  /** Per-request logging. Left out in tests. */
  requestLogger?: RequestHandler;
}

/**
 * Builds the Express app from modules it is given. It knows nothing about any
 * module — the composition root decides what is mounted.
 *
 * Express 5 forwards a rejected promise from an async handler to the error
 * handler by itself, so there is no asyncHandler wrapper.
 */
export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: options.corsOrigin }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  if (options.requestLogger) app.use(options.requestLogger);

  const api = express.Router();
  for (const module of options.modules) api.use(module.path, module.router);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(createErrorHandler(options.logger));

  return app;
}
```

- [x] **Step 5: Create the health module.**

`backend/src/modules/health/presentation/health.routes.ts`:
```ts
import { Router } from 'express';
import type { Health } from '../../../contracts/health.js';
import { sendData } from '../../../shared/presentation/http/respond.js';

export function createHealthRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const health: Health = { status: 'ok' };
    sendData(res, 200, health);
  });
  return router;
}
```

`backend/src/modules/health/index.ts`:
```ts
import type { HttpModule } from '../../shared/presentation/http/http-module.js';
import { createHealthRouter } from './presentation/health.routes.js';

/** Liveness only. Health has no rules, so it has only a presentation layer. */
export function buildHealthModule(): HttpModule {
  return { path: '/health', router: createHealthRouter() };
}
```

- [x] **Step 6: Run the test and watch it pass.**

Run: the command from Step 2. Expected: `2 passed`.

- [x] **Step 7: Run the architecture check.**

Run: `npm run arch:check` in `backend/`.
Expected: `✔ no dependency violations found` (with a module and dependency
count). If it reports `not-to-unresolvable` for `.js` imports, add
`extensionAlias: { '.js': ['.ts', '.js'] }` inside `enhancedResolveOptions`
and re-run; record that in this step's box text.

---

## Phase 3 — Tools module (backend)

### Task 3.1 — Domain: the Tool entity

**Files:**
- Create: `backend/src/modules/tools/domain/tool.errors.ts`,
  `backend/src/modules/tools/domain/tool.ts`,
  `backend/src/modules/tools/domain/tool-repository.ts`
- Test: `backend/src/modules/tools/domain/tool.test.ts`

**Interfaces — produces:**
- `type ToolField = 'name' | 'url' | 'description' | 'category'`, `type ToolIssues = Partial<Record<ToolField, string[]>>`
- `class InvalidToolError extends DomainError` — `code: 'VALIDATION_FAILED'`, `issues: ToolIssues`, `details: { fields: ToolIssues }`
- `class ToolNameTakenError extends DomainError` — `code: 'TOOL_NAME_TAKEN'`, `details: { fields: { name: [message] } }`
- `TOOL_LIMITS = { name: 80, url: 2048, description: 280, category: 40 }`
- `interface ToolProps { id; name; url; description; category: string; createdAt: Date }`
- `interface NewTool { name: string; url: string; description?: string | undefined; category: string }`
- `class Tool` — `static create(input: NewTool, id: string, createdAt: Date): Result<Tool, InvalidToolError>`,
  `static restore(props: ToolProps): Tool`, getters `id name url description category createdAt`
- `interface ToolRepository { list(): Promise<Tool[]>; add(tool: Tool): Promise<Result<void, ToolNameTakenError>> }`

- [x] **Step 1: Write the failing test.**

`backend/src/modules/tools/domain/tool.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { InvalidToolError } from './tool.errors.js';
import { Tool, type NewTool } from './tool.js';

const ID = '00000000-0000-4000-8000-000000000001';
const AT = new Date('2026-10-14T08:00:00.000Z');
const valid: NewTool = { name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' };

function issuesFor(input: NewTool) {
  const result = Tool.create(input, ID, AT);
  if (result.ok) throw new Error('expected the tool to be rejected');
  expect(result.error).toBeInstanceOf(InvalidToolError);
  return result.error.issues;
}

describe('Tool.create', () => {
  it('creates a tool from valid input, trimming every field', () => {
    const result = Tool.create(
      { name: '  Payroll ', url: ' https://payroll.example.com ', description: ' Pay ', category: ' Finance ' },
      ID,
      AT,
    );
    if (!result.ok) throw result.error;
    expect(result.value.id).toBe(ID);
    expect(result.value.name).toBe('Payroll');
    expect(result.value.url).toBe('https://payroll.example.com');
    expect(result.value.description).toBe('Pay');
    expect(result.value.category).toBe('Finance');
    expect(result.value.createdAt).toEqual(AT);
  });

  it('defaults the description to empty', () => {
    const result = Tool.create(valid, ID, AT);
    expect(result.ok && result.value.description).toBe('');
  });

  it('accepts a plain http URL', () => {
    expect(Tool.create({ ...valid, url: 'http://intranet.local/payroll' }, ID, AT).ok).toBe(true);
  });

  it('accepts fields exactly at their limits', () => {
    const url = `https://example.com/${'a'.repeat(2048 - 'https://example.com/'.length)}`;
    const result = Tool.create(
      { name: 'n'.repeat(80), url, description: 'd'.repeat(280), category: 'c'.repeat(40) },
      ID,
      AT,
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    ['an empty name', { ...valid, name: '   ' }, 'name'],
    ['a name over 80 characters', { ...valid, name: 'n'.repeat(81) }, 'name'],
    ['a relative URL', { ...valid, url: '/payroll' }, 'url'],
    ['a javascript: URL', { ...valid, url: 'javascript:alert(1)' }, 'url'],
    ['an ftp: URL', { ...valid, url: 'ftp://files.example.com' }, 'url'],
    ['a URL over 2048 characters', { ...valid, url: `https://example.com/${'a'.repeat(2048)}` }, 'url'],
    ['a description over 280 characters', { ...valid, description: 'd'.repeat(281) }, 'description'],
    ['an empty category', { ...valid, category: '' }, 'category'],
    ['a category over 40 characters', { ...valid, category: 'c'.repeat(41) }, 'category'],
  ] as const)('rejects %s', (_label, input, field) => {
    const issues = issuesFor(input);
    expect(Object.keys(issues)).toEqual([field]);
    expect(issues[field]?.[0]).toEqual(expect.any(String));
  });

  it('reports every broken rule at once', () => {
    const issues = issuesFor({ name: '', url: 'nope', category: '' });
    expect(Object.keys(issues).sort()).toEqual(['category', 'name', 'url']);
  });
});
```

- [x] **Step 2: Run it and watch it fail.**

Run: `npx vitest run --config vitest.unit.config.ts src/modules/tools/domain` in `backend/`.
Expected: FAIL — cannot resolve `./tool.errors.js`.

- [x] **Step 3: Implement the domain.**

`backend/src/modules/tools/domain/tool.errors.ts`:
```ts
import { DomainError } from '../../../shared/domain/domain-error.js';

export type ToolField = 'name' | 'url' | 'description' | 'category';
export type ToolIssues = Partial<Record<ToolField, string[]>>;

export class InvalidToolError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor(readonly issues: ToolIssues) {
    super('The tool is not valid.', { fields: issues });
  }
}

export class ToolNameTakenError extends DomainError {
  override readonly code = 'TOOL_NAME_TAKEN';

  constructor(name: string) {
    const message = `A tool named "${name}" already exists.`;
    super(message, { fields: { name: [message] } });
  }
}
```

`backend/src/modules/tools/domain/tool.ts`:
```ts
import { err, ok, type Result } from '../../../shared/domain/result.js';
import { InvalidToolError, type ToolIssues } from './tool.errors.js';

export const TOOL_LIMITS = { name: 80, url: 2048, description: 280, category: 40 } as const;

export interface ToolProps {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly description: string;
  readonly category: string;
  readonly createdAt: Date;
}

export interface NewTool {
  name: string;
  url: string;
  description?: string | undefined;
  category: string;
}

/** An internal application or link a staff member can open from the hub. */
export class Tool {
  private constructor(private readonly props: ToolProps) {}

  /**
   * Checks every rule and reports all the broken ones together, so a form can
   * show every problem at once rather than one per attempt.
   */
  static create(input: NewTool, id: string, createdAt: Date): Result<Tool, InvalidToolError> {
    const name = input.name.trim();
    const url = input.url.trim();
    const description = (input.description ?? '').trim();
    const category = input.category.trim();
    const issues: ToolIssues = {};

    if (name.length === 0) issues.name = ['Name is required.'];
    else if (name.length > TOOL_LIMITS.name) {
      issues.name = [`Name must be at most ${TOOL_LIMITS.name} characters.`];
    }

    if (url.length > TOOL_LIMITS.url) {
      issues.url = [`URL must be at most ${TOOL_LIMITS.url} characters.`];
    } else if (!isWebUrl(url)) {
      issues.url = ['URL must be a full http:// or https:// address.'];
    }

    if (description.length > TOOL_LIMITS.description) {
      issues.description = [`Description must be at most ${TOOL_LIMITS.description} characters.`];
    }

    if (category.length === 0) issues.category = ['Category is required.'];
    else if (category.length > TOOL_LIMITS.category) {
      issues.category = [`Category must be at most ${TOOL_LIMITS.category} characters.`];
    }

    if (Object.keys(issues).length > 0) return err(new InvalidToolError(issues));
    return ok(new Tool({ id, name, url, description, category, createdAt }));
  }

  /** Rebuilds a tool that was valid when it was stored. For persistence only. */
  static restore(props: ToolProps): Tool {
    return new Tool(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get url(): string {
    return this.props.url;
  }

  get description(): string {
    return this.props.description;
  }

  get category(): string {
    return this.props.category;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }
}

/** Only web addresses: a `javascript:` URL in a link is script injection. */
function isWebUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
}
```

`backend/src/modules/tools/domain/tool-repository.ts`:
```ts
import type { Result } from '../../../shared/domain/result.js';
import type { ToolNameTakenError } from './tool.errors.js';
import type { Tool } from './tool.js';

/** Where tools are kept. The domain owns this port; infrastructure implements it. */
export interface ToolRepository {
  /** Every tool, ordered by category and then name, both ignoring case. */
  list(): Promise<Tool[]>;

  /** Fails with ToolNameTakenError when a tool already has this name, ignoring case. */
  add(tool: Tool): Promise<Result<void, ToolNameTakenError>>;
}
```

- [x] **Step 4: Run it and watch it pass.**

Run: the command from Step 2. Expected: `14 passed`.

### Task 3.2 — Application: the use cases

**Files:**
- Create: `backend/src/modules/tools/application/tool.dto.ts`,
  `backend/src/modules/tools/application/list-tools.ts`,
  `backend/src/modules/tools/application/create-tool.ts`,
  `backend/src/modules/tools/application/testing/in-memory-tool-repository.ts`
- Test: `backend/src/modules/tools/application/create-tool.test.ts`,
  `backend/src/modules/tools/application/list-tools.test.ts`

**Interfaces — consumes:** Task 3.1, Task 2.2.
**Interfaces — produces:**
- `interface ToolDto { id; name; url; description; category; createdAt: string /* ISO 8601 */ }`
- `interface CreateToolInput { name: string; url: string; description?: string | undefined; category: string }`
- `toToolDto(tool: Tool): ToolDto`
- `class ListTools implements UseCase<void, ToolDto[]>` — `constructor(tools: ToolRepository)`
- `type CreateToolError = InvalidToolError | ToolNameTakenError`
- `class CreateTool implements UseCase<CreateToolInput, Result<ToolDto, CreateToolError>>` —
  `constructor(tools: ToolRepository, clock: Clock, ids: IdGenerator)`
- `class InMemoryToolRepository implements ToolRepository`

- [x] **Step 1: Write the failing tests.**

`backend/src/modules/tools/application/create-tool.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { InvalidToolError, ToolNameTakenError } from '../domain/tool.errors.js';
import { CreateTool } from './create-tool.js';
import { InMemoryToolRepository } from './testing/in-memory-tool-repository.js';

const payroll = { name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' };

function setup() {
  const repository = new InMemoryToolRepository();
  const createTool = new CreateTool(
    repository,
    new FixedClock(new Date('2026-10-14T08:00:00.000Z')),
    new SequentialIdGenerator(),
  );
  return { repository, createTool };
}

describe('CreateTool', () => {
  it('returns the new tool with its id and creation time', async () => {
    const { createTool } = setup();
    expect(await createTool.execute(payroll)).toEqual({
      ok: true,
      value: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Payroll',
        url: 'https://payroll.example.com',
        description: '',
        category: 'Finance',
        createdAt: '2026-10-14T08:00:00.000Z',
      },
    });
  });

  it('stores the tool', async () => {
    const { repository, createTool } = setup();
    await createTool.execute(payroll);
    expect((await repository.list()).map((tool) => tool.name)).toEqual(['Payroll']);
  });

  it('rejects an invalid tool and stores nothing', async () => {
    const { repository, createTool } = setup();
    const result = await createTool.execute({ ...payroll, name: ' ' });
    expect(!result.ok && result.error).toBeInstanceOf(InvalidToolError);
    expect(await repository.list()).toEqual([]);
  });

  it('rejects a taken name, ignoring case and surrounding spaces', async () => {
    const { repository, createTool } = setup();
    await createTool.execute(payroll);
    const result = await createTool.execute({ ...payroll, name: '  PAYROLL ' });
    expect(!result.ok && result.error).toBeInstanceOf(ToolNameTakenError);
    expect(await repository.list()).toHaveLength(1);
  });
});
```

`backend/src/modules/tools/application/list-tools.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { CreateTool } from './create-tool.js';
import { ListTools } from './list-tools.js';
import { InMemoryToolRepository } from './testing/in-memory-tool-repository.js';

describe('ListTools', () => {
  it('is empty before anything is added', async () => {
    expect(await new ListTools(new InMemoryToolRepository()).execute()).toEqual([]);
  });

  it('lists tools by category, then name', async () => {
    const repository = new InMemoryToolRepository();
    const createTool = new CreateTool(repository, new FixedClock(new Date()), new SequentialIdGenerator());
    for (const [name, category] of [['Payroll', 'Finance'], ['Leave', 'HR'], ['expenses', 'Finance']]) {
      await createTool.execute({ name: name!, url: 'https://example.com', category: category! });
    }

    const tools = await new ListTools(repository).execute();
    expect(tools.map((tool) => `${tool.category}/${tool.name}`)).toEqual([
      'Finance/expenses',
      'Finance/Payroll',
      'HR/Leave',
    ]);
  });
});
```

- [x] **Step 2: Run them and watch them fail.**

Run: `npx vitest run --config vitest.unit.config.ts src/modules/tools/application` in `backend/`.
Expected: FAIL — cannot resolve `./create-tool.js`.

- [x] **Step 3: Implement the application layer.**

`backend/src/modules/tools/application/tool.dto.ts`:
```ts
import type { Tool } from '../domain/tool.js';

/** A tool as the application hands it outward. Dates are ISO 8601 strings. */
export interface ToolDto {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  createdAt: string;
}

export interface CreateToolInput {
  name: string;
  url: string;
  description?: string | undefined;
  category: string;
}

export function toToolDto(tool: Tool): ToolDto {
  return {
    id: tool.id,
    name: tool.name,
    url: tool.url,
    description: tool.description,
    category: tool.category,
    createdAt: tool.createdAt.toISOString(),
  };
}
```

`backend/src/modules/tools/application/list-tools.ts`:
```ts
import type { UseCase } from '../../../shared/application/use-case.js';
import type { ToolRepository } from '../domain/tool-repository.js';
import { toToolDto, type ToolDto } from './tool.dto.js';

export class ListTools implements UseCase<void, ToolDto[]> {
  constructor(private readonly tools: ToolRepository) {}

  async execute(): Promise<ToolDto[]> {
    return (await this.tools.list()).map(toToolDto);
  }
}
```

`backend/src/modules/tools/application/create-tool.ts`:
```ts
import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { InvalidToolError, ToolNameTakenError } from '../domain/tool.errors.js';
import type { ToolRepository } from '../domain/tool-repository.js';
import { Tool } from '../domain/tool.js';
import { toToolDto, type CreateToolInput, type ToolDto } from './tool.dto.js';

export type CreateToolError = InvalidToolError | ToolNameTakenError;

export class CreateTool implements UseCase<CreateToolInput, Result<ToolDto, CreateToolError>> {
  constructor(
    private readonly tools: ToolRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateToolInput): Promise<Result<ToolDto, CreateToolError>> {
    const created = Tool.create(input, this.ids.next(), this.clock.now());
    if (!created.ok) return created;

    // Uniqueness is the repository's to decide: only the database can rule
    // out two simultaneous requests both taking the same name.
    const added = await this.tools.add(created.value);
    if (!added.ok) return added;

    return ok(toToolDto(created.value));
  }
}
```

`backend/src/modules/tools/application/testing/in-memory-tool-repository.ts`:
```ts
import { err, ok, type Result } from '../../../../shared/domain/result.js';
import { ToolNameTakenError } from '../../domain/tool.errors.js';
import type { ToolRepository } from '../../domain/tool-repository.js';
import type { Tool } from '../../domain/tool.js';

/** The ToolRepository contract, in memory. A test double, never used in production. */
export class InMemoryToolRepository implements ToolRepository {
  private readonly tools: Tool[] = [];

  async list(): Promise<Tool[]> {
    return [...this.tools].sort((a, b) => compareText(a.category, b.category) || compareText(a.name, b.name));
  }

  async add(tool: Tool): Promise<Result<void, ToolNameTakenError>> {
    const taken = this.tools.some((existing) => existing.name.toLowerCase() === tool.name.toLowerCase());
    if (taken) return err(new ToolNameTakenError(tool.name));
    this.tools.push(tool);
    return ok(undefined);
  }
}

function compareText(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
```

- [x] **Step 4: Run them and watch them pass.**

Run: the command from Step 2. Expected: `6 passed`.

### Task 3.3 — Presentation: routes, with HTTP tests

**Files:**
- Create: `backend/src/contracts/tools.ts`,
  `backend/src/modules/tools/presentation/tools.schemas.ts`,
  `backend/src/modules/tools/presentation/tools.controller.ts`,
  `backend/src/modules/tools/presentation/tools.routes.ts`
- Test: `backend/src/modules/tools/presentation/tools.routes.test.ts`

**Interfaces — consumes:** Tasks 2.5, 3.2.
**Interfaces — produces:**
- contract `Tool { id; name; url; description; category; createdAt: string }`,
  `CreateToolRequest { name: string; url: string; description?: string; category: string }`
- `createToolRequestSchema`
- `class ToolsController(listTools: UseCase<void, ToolDto[]>, createTool: UseCase<CreateToolInput, Result<ToolDto, CreateToolError>>)`
  with handlers `list` and `create`
- `createToolsRouter(controller: ToolsController): Router`

- [x] **Step 1: Write the failing test.**

`backend/src/modules/tools/presentation/tools.routes.test.ts`:
```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  RecordingLogger,
  SequentialIdGenerator,
} from '../../../shared/application/testing/fakes.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { CreateTool } from '../application/create-tool.js';
import { ListTools } from '../application/list-tools.js';
import { InMemoryToolRepository } from '../application/testing/in-memory-tool-repository.js';
import type { ToolDto } from '../application/tool.dto.js';
import { ToolsController } from './tools.controller.js';
import { createToolsRouter } from './tools.routes.js';

const payroll = { name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' };

function setup(listTools?: UseCase<void, ToolDto[]>) {
  const repository = new InMemoryToolRepository();
  const logger = new RecordingLogger();
  const controller = new ToolsController(
    listTools ?? new ListTools(repository),
    new CreateTool(repository, new FixedClock(new Date('2026-10-14T08:00:00.000Z')), new SequentialIdGenerator()),
  );
  const app = createApp({
    modules: [{ path: '/tools', router: createToolsRouter(controller) }],
    logger,
    corsOrigin: 'http://localhost:5173',
  });
  return { app, logger };
}

describe('POST /api/v1/tools', () => {
  it('creates a tool and answers 201 with it', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/v1/tools').send(payroll);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Payroll',
        url: 'https://payroll.example.com',
        description: '',
        category: 'Finance',
        createdAt: '2026-10-14T08:00:00.000Z',
      },
    });
  });

  it('answers 400 VALIDATION_FAILED with the field for a broken rule', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/v1/tools').send({ ...payroll, url: 'javascript:alert(1)' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields.url).toEqual([expect.any(String)]);
  });

  it('answers 400 VALIDATION_FAILED for a missing field', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/v1/tools').send({ name: 'Payroll', url: payroll.url });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields.category).toEqual([expect.any(String)]);
  });

  it('answers 400 VALIDATION_FAILED when there is no body at all', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/v1/tools');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('answers 400 MALFORMED_JSON for a body that is not JSON', async () => {
    const { app } = setup();
    const response = await request(app)
      .post('/api/v1/tools')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MALFORMED_JSON');
  });

  it('answers 409 TOOL_NAME_TAKEN for a name taken in another case', async () => {
    const { app } = setup();
    await request(app).post('/api/v1/tools').send(payroll);
    const response = await request(app).post('/api/v1/tools').send({ ...payroll, name: '  PAYROLL ' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TOOL_NAME_TAKEN');
    expect(response.body.error.details.fields.name).toEqual([expect.any(String)]);
  });
});

describe('GET /api/v1/tools', () => {
  it('lists what was created', async () => {
    const { app } = setup();
    await request(app).post('/api/v1/tools').send(payroll);
    const response = await request(app).get('/api/v1/tools');
    expect(response.status).toBe(200);
    expect(response.body.data.map((tool: ToolDto) => tool.name)).toEqual(['Payroll']);
  });

  it('answers a generic 500 for an unexpected failure, and logs it', async () => {
    const failing: UseCase<void, ToolDto[]> = {
      execute: () => Promise.reject(new Error('connection refused at 10.0.0.5')),
    };
    const { app, logger } = setup(failing);
    const response = await request(app).get('/api/v1/tools');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again later.' },
    });
    expect(logger.errors).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run it and watch it fail.**

Run: `npx vitest run --config vitest.unit.config.ts src/modules/tools/presentation` in `backend/`.
Expected: FAIL — cannot resolve `./tools.controller.js`.

- [x] **Step 3: Implement the contract and the presentation layer.**

`backend/src/contracts/tools.ts`:
```ts
export interface Tool {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  /** ISO 8601. */
  createdAt: string;
}

export interface CreateToolRequest {
  name: string;
  url: string;
  description?: string;
  category: string;
}
```

`backend/src/modules/tools/presentation/tools.schemas.ts`:
```ts
import { z } from 'zod';
import type { CreateToolRequest } from '../../../contracts/tools.js';

/** The request's shape only. The rules (lengths, URL scheme) belong to the domain. */
export const createToolRequestSchema = z.object({
  name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  category: z.string(),
}) satisfies z.ZodType<CreateToolRequest>;
```

`backend/src/modules/tools/presentation/tools.controller.ts`:
```ts
import type { Request, Response } from 'express';
import type { Tool as ToolContract } from '../../../contracts/tools.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Result } from '../../../shared/domain/result.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import { parseBody } from '../../../shared/presentation/http/parse-body.js';
import { sendData } from '../../../shared/presentation/http/respond.js';
import type { CreateToolError } from '../application/create-tool.js';
import type { CreateToolInput, ToolDto } from '../application/tool.dto.js';
import { createToolRequestSchema } from './tools.schemas.js';

const STATUS_BY_CODE: Record<CreateToolError['code'], number> = {
  VALIDATION_FAILED: 400,
  TOOL_NAME_TAKEN: 409,
};

/** Translates HTTP into use-case calls and results back into HTTP. No business rules here. */
export class ToolsController {
  constructor(
    private readonly listTools: UseCase<void, ToolDto[]>,
    private readonly createTool: UseCase<CreateToolInput, Result<ToolDto, CreateToolError>>,
  ) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const tools: ToolContract[] = await this.listTools.execute();
    sendData(res, 200, tools);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parseBody(createToolRequestSchema, req.body);
    const result = await this.createTool.execute(input);

    if (!result.ok) {
      const { error } = result;
      throw new HttpError(STATUS_BY_CODE[error.code], error.code, error.message, error.details);
    }

    const tool: ToolContract = result.value;
    sendData(res, 201, tool);
  };
}
```

`backend/src/modules/tools/presentation/tools.routes.ts`:
```ts
import { Router } from 'express';
import type { ToolsController } from './tools.controller.js';

export function createToolsRouter(controller: ToolsController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  return router;
}
```

- [x] **Step 4: Run it and watch it pass.**

Run: the command from Step 2. Expected: `8 passed`.

### Task 3.4 — Infrastructure: the Drizzle repository and the migration

**Files:**
- Create: `backend/src/modules/tools/infrastructure/tools.table.ts`,
  `backend/src/modules/tools/infrastructure/tool.mapper.ts`,
  `backend/src/modules/tools/infrastructure/drizzle-tool-repository.ts`,
  `backend/src/database-schema.ts`, `backend/src/test/global-setup.ts`,
  `backend/src/test/database.ts`, `backend/drizzle/0000_create_tools.sql` (generated)
- Test: `backend/src/modules/tools/infrastructure/drizzle-tool-repository.db.test.ts`

**Interfaces — produces:** `tools` table; `class DrizzleToolRepository(db: Database) implements ToolRepository`;
`connectTestDatabase(): DatabaseConnection`; `resetTables(db: Database): Promise<void>`

- [x] **Step 1: Create the table, mapper and repository.**

`backend/src/modules/tools/infrastructure/tools.table.ts`:
```ts
import { sql } from 'drizzle-orm';
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const tools = pgTable(
  'tools',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    url: varchar('url', { length: 2048 }).notNull(),
    description: varchar('description', { length: 280 }).notNull().default(''),
    category: varchar('category', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    // Names are unique ignoring case. Only the database can enforce that
    // against two simultaneous requests.
    uniqueIndex('tools_name_lower_unique').on(sql`lower(${table.name})`),
  ],
);
```

`backend/src/modules/tools/infrastructure/tool.mapper.ts`:
```ts
import { Tool } from '../domain/tool.js';
import type { tools } from './tools.table.js';

type ToolRow = typeof tools.$inferSelect;
type NewToolRow = typeof tools.$inferInsert;

export function toDomain(row: ToolRow): Tool {
  return Tool.restore({
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
    category: row.category,
    createdAt: row.createdAt,
  });
}

export function toRow(tool: Tool): NewToolRow {
  return {
    id: tool.id,
    name: tool.name,
    url: tool.url,
    description: tool.description,
    category: tool.category,
    createdAt: tool.createdAt,
  };
}
```

`backend/src/modules/tools/infrastructure/drizzle-tool-repository.ts`:
```ts
import { sql } from 'drizzle-orm';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors.js';
import { ToolNameTakenError } from '../domain/tool.errors.js';
import type { ToolRepository } from '../domain/tool-repository.js';
import type { Tool } from '../domain/tool.js';
import { toDomain, toRow } from './tool.mapper.js';
import { tools } from './tools.table.js';

export class DrizzleToolRepository implements ToolRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Tool[]> {
    const rows = await this.db
      .select()
      .from(tools)
      .orderBy(sql`lower(${tools.category})`, sql`lower(${tools.name})`);
    return rows.map(toDomain);
  }

  async add(tool: Tool): Promise<Result<void, ToolNameTakenError>> {
    try {
      await this.db.insert(tools).values(toRow(tool));
      return ok(undefined);
    } catch (error) {
      if (isUniqueViolation(error)) return err(new ToolNameTakenError(tool.name));
      throw error;
    }
  }
}
```

`backend/src/database-schema.ts`:
```ts
/**
 * Every table, for drizzle-kit. Each table lives in its module's
 * infrastructure layer; this composition-level file only gathers them.
 */
export { tools } from './modules/tools/infrastructure/tools.table.js';
```

- [x] **Step 2: Generate the migration.**

Run: `npx drizzle-kit generate --name create_tools` in `backend/`.
Expected: `backend/drizzle/0000_create_tools.sql` exists and contains
`CREATE TABLE "tools"` and
`CREATE UNIQUE INDEX "tools_name_lower_unique" ON "tools" USING btree (lower("name"));`,
plus `backend/drizzle/meta/`. No database is needed for this step.

- [x] **Step 3: Create the test harness.**

`backend/src/test/global-setup.ts`:
```ts
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

/**
 * Runs once before any test file: creates the test database if it is missing,
 * then migrates it. Fails with an instruction, not two hundred red tests, when
 * Postgres is not running.
 */
export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL was not set by vitest.config.ts.');

  const name = new URL(url).pathname.slice(1);

  // Tests truncate tables. Refusing anything not named *_test makes wiping
  // the development database impossible rather than merely unlikely.
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${name}". Use a database whose name ends in "_test".`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  let admin: postgres.Sql;
  try {
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => undefined });
    await admin`select 1`;
  } catch (error) {
    throw new Error(
      `Cannot reach Postgres at ${adminUrl.host}. Run "npm run db:up" and try again.\n`
        + `Original error: ${(error as Error).message}`,
    );
  }

  try {
    const existing = await admin`select 1 from pg_database where datname = ${name}`;
    // An identifier cannot be a parameter; `name` was checked above.
    if (existing.length === 0) await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  execFileSync('npm', ['run', 'db:migrate'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
    shell: true,
  });
}
```

`backend/src/test/database.ts`:
```ts
import { sql } from 'drizzle-orm';
import {
  connectDatabase,
  type Database,
  type DatabaseConnection,
} from '../shared/infrastructure/database/connection.js';

export function connectTestDatabase(): DatabaseConnection {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL was not set by vitest.config.ts.');
  return connectDatabase(url);
}

/** Empties every table. Add each new table here. */
export async function resetTables(db: Database): Promise<void> {
  await db.execute(sql`truncate table tools`);
}
```

- [x] **Step 4: Write the repository test.**

`backend/src/modules/tools/infrastructure/drizzle-tool-repository.db.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { ToolNameTakenError } from '../domain/tool.errors.js';
import { Tool } from '../domain/tool.js';
import { DrizzleToolRepository } from './drizzle-tool-repository.js';

const connection = connectTestDatabase();
const repository = new DrizzleToolRepository(connection.db);
const ids = new SequentialIdGenerator();
const AT = new Date('2026-10-14T08:00:00.000Z');

function tool(name: string, category: string, description = ''): Tool {
  const result = Tool.create({ name, url: 'https://example.com', description, category }, ids.next(), AT);
  if (!result.ok) throw result.error;
  return result.value;
}

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

describe('DrizzleToolRepository', () => {
  it('round-trips every field', async () => {
    const payroll = tool('Payroll', 'Finance', 'Monthly pay');
    await repository.add(payroll);
    const [stored] = await repository.list();
    expect(stored?.id).toBe(payroll.id);
    expect(stored?.name).toBe('Payroll');
    expect(stored?.url).toBe('https://example.com');
    expect(stored?.description).toBe('Monthly pay');
    expect(stored?.category).toBe('Finance');
    expect(stored?.createdAt.toISOString()).toBe(AT.toISOString());
  });

  it('lists by category, then name, ignoring case', async () => {
    await repository.add(tool('Payroll', 'Finance'));
    await repository.add(tool('Leave', 'HR'));
    await repository.add(tool('expenses', 'Finance'));
    const names = (await repository.list()).map((stored) => stored.name);
    expect(names).toEqual(['expenses', 'Payroll', 'Leave']);
  });

  it('refuses a second tool whose name differs only in case', async () => {
    await repository.add(tool('Payroll', 'Finance'));
    const result = await repository.add(tool('PAYROLL', 'Finance'));
    expect(!result.ok && result.error).toBeInstanceOf(ToolNameTakenError);
    expect(await repository.list()).toHaveLength(1);
  });
});
```

- [x] **Step 5: Typecheck and lint.** (The DB test runs in CI and in Phase 8's
  optional database run — rule 5.)

Run: `npm run typecheck && npm run lint` in `backend/`. Expected: exits 0;
oxlint reports `Found 0 warnings and 0 errors.`

### Task 3.5 — Composition: the module, the app, and the process

**Files:**
- Create: `backend/src/modules/tools/index.ts`, `backend/src/compose.ts`,
  `backend/src/main.ts`
- Test: `backend/src/compose.db.test.ts`

**Interfaces — produces:**
- `buildToolsModule(deps: { db: Database; clock: Clock; ids: IdGenerator }): HttpModule`
- `composeApp(deps: { db; logger; clock; ids; corsOrigin; requestLogger? }): Express`

- [x] **Step 1: Create the module's composition.**

`backend/src/modules/tools/index.ts`:
```ts
import type { Clock } from '../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../shared/application/ports/id-generator.js';
import type { Database } from '../../shared/infrastructure/database/connection.js';
import type { HttpModule } from '../../shared/presentation/http/http-module.js';
import { CreateTool } from './application/create-tool.js';
import { ListTools } from './application/list-tools.js';
import { DrizzleToolRepository } from './infrastructure/drizzle-tool-repository.js';
import { ToolsController } from './presentation/tools.controller.js';
import { createToolsRouter } from './presentation/tools.routes.js';

export interface ToolsModuleDependencies {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
}

/** The module's composition root: the one place its adapters meet its use cases. */
export function buildToolsModule(deps: ToolsModuleDependencies): HttpModule {
  const repository = new DrizzleToolRepository(deps.db);
  const controller = new ToolsController(
    new ListTools(repository),
    new CreateTool(repository, deps.clock, deps.ids),
  );
  return { path: '/tools', router: createToolsRouter(controller) };
}
```

- [x] **Step 2: Create the app's composition.**

`backend/src/compose.ts`:
```ts
import type { Express, RequestHandler } from 'express';
import { buildHealthModule } from './modules/health/index.js';
import { buildToolsModule } from './modules/tools/index.js';
import type { Clock } from './shared/application/ports/clock.js';
import type { IdGenerator } from './shared/application/ports/id-generator.js';
import type { Logger } from './shared/application/ports/logger.js';
import type { Database } from './shared/infrastructure/database/connection.js';
import { createApp } from './shared/presentation/http/create-app.js';

export interface AppDependencies {
  db: Database;
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
  corsOrigin: string;
  requestLogger?: RequestHandler;
}

/** Every module, wired. `main.ts` and the end-to-end tests both build the app here. */
export function composeApp(deps: AppDependencies): Express {
  return createApp({
    logger: deps.logger,
    corsOrigin: deps.corsOrigin,
    requestLogger: deps.requestLogger,
    modules: [
      buildHealthModule(),
      buildToolsModule({ db: deps.db, clock: deps.clock, ids: deps.ids }),
    ],
  });
}
```

- [x] **Step 3: Create the process entry.**

`backend/src/main.ts`:
```ts
import 'dotenv/config';
import { pinoHttp } from 'pino-http';
import { composeApp } from './compose.js';
import { parseEnv } from './shared/infrastructure/config/env.js';
import { CryptoIdGenerator } from './shared/infrastructure/crypto-id-generator.js';
import { connectDatabase } from './shared/infrastructure/database/connection.js';
import { createPino, PinoLogger } from './shared/infrastructure/logging/pino-logger.js';
import { SystemClock } from './shared/infrastructure/system-clock.js';

const parsed = parseEnv(process.env);
if (!parsed.ok) {
  console.error('Invalid environment — check backend/.env against backend/.env.example:');
  for (const line of parsed.error) console.error(`  ${line}`);
  process.exit(1);
}
const env = parsed.value;

const pino = createPino({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const logger = new PinoLogger(pino);
const database = connectDatabase(env.DATABASE_URL);

const app = composeApp({
  db: database.db,
  logger,
  clock: new SystemClock(),
  ids: new CryptoIdGenerator(),
  corsOrigin: env.CORS_ORIGIN,
  requestLogger: pinoHttp({ logger: pino }),
});

const server = app.listen(env.PORT, () => {
  logger.info(`s1-gateway API listening on http://localhost:${env.PORT}`, { env: env.NODE_ENV });
});

/**
 * Stop taking connections, let in-flight requests finish, then release the
 * pool. The ceiling keeps a stuck request from blocking a deploy forever.
 */
function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close(() => {
    database.close().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error('Error while closing the database', { err: error });
        process.exit(1);
      },
    );
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [x] **Step 4: Write the end-to-end test.**

`backend/src/compose.db.test.ts`:
```ts
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { composeApp } from './compose.js';
import { FixedClock, SequentialIdGenerator, silentLogger } from './shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from './test/database.js';

const connection = connectTestDatabase();
const app = composeApp({
  db: connection.db,
  logger: silentLogger,
  clock: new FixedClock(new Date('2026-10-14T08:00:00.000Z')),
  ids: new SequentialIdGenerator(),
  corsOrigin: 'http://localhost:5173',
});

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

describe('the composed app', () => {
  it('answers health', async () => {
    expect((await request(app).get('/api/v1/health')).body).toEqual({ data: { status: 'ok' } });
  });

  it('creates a tool in Postgres and lists it back', async () => {
    const created = await request(app)
      .post('/api/v1/tools')
      .send({ name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' });
    expect(created.status).toBe(201);

    const listed = await request(app).get('/api/v1/tools');
    expect(listed.body.data).toEqual([created.body.data]);
  });

  it('answers 409 for a duplicate name against the real unique index', async () => {
    const tool = { name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' };
    await request(app).post('/api/v1/tools').send(tool);
    const duplicate = await request(app).post('/api/v1/tools').send({ ...tool, name: 'payroll' });
    expect(duplicate.status).toBe(409);
  });
});
```

- [x] **Step 5: Run every backend check that needs no database.**

Run, in `backend/`:
```bash
npm run typecheck && npm run lint && npm run arch:check && npm run test:unit
```
Expected: each exits 0; arch:check prints `no dependency violations found`;
test:unit prints `Test Files  6 passed (6)` and `Tests  34 passed (34)`.

---

## Phase 4 — Frontend foundation

### Task 4.1 — Frontend package and configuration

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`,
  `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`,
  `frontend/vite.config.ts`, `frontend/vitest.config.ts`,
  `frontend/.env.example`, `frontend/index.html`, `frontend/.dependency-cruiser.cjs`,
  `frontend/src/vite-env.d.ts`, `frontend/src/test/setup.ts`

- [x] **Step 1: Create `frontend/package.json`.**

```json
{
  "name": "@s1-gateway/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": "^22 || ^24"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "lint": "oxlint src",
    "arch:check": "depcruise src --config .dependency-cruiser.cjs",
    "test": "vitest run",
    "pwa:icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.102.8",
    "axios": "^1.20.0",
    "clsx": "^2.1.1",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-router-dom": "^7.18.3",
    "tailwind-merge": "^3.7.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/react": "^16.3.3",
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.7",
    "@vite-pwa/assets-generator": "^2.0.0",
    "@vitejs/plugin-react": "^6.1.1",
    "dependency-cruiser": "^18.6.0",
    "happy-dom": "^20.14.5",
    "oxlint": "^1.83.0",
    "tailwindcss": "^4.3.3",
    "typescript": "~6.0.2",
    "vite": "^8.3.0",
    "vite-plugin-pwa": "^2.0.0",
    "vitest": "^5.0.1",
    "workbox-window": "^7.4.1"
  }
}
```

- [x] **Step 2: Create the three tsconfigs.**

`frontend/tsconfig.json`:
```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`frontend/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "types": ["vite/client", "vite-plugin-pwa/react"],
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"],
      "@contracts/*": ["../backend/src/contracts/*"]
    },
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`frontend/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [x] **Step 3: Create the Vite and Vitest configs.** The PWA plugin is added
  in Phase 6; until then `vite.config.ts` is:

```ts
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // One origin in development: the browser talks to Vite, Vite to the API.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
```

`frontend/vitest.config.ts`:
```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
    },
  }),
);
```

`frontend/src/test/setup.ts`:
```ts
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are off, so Testing Library cannot register this itself.
afterEach(() => cleanup());
```

- [x] **Step 4: Create `frontend/.env.example`, `frontend/index.html` and `frontend/src/vite-env.d.ts`.**

`frontend/.env.example`:
```dotenv
# Where the SPA sends API requests. Leave unset in development: Vite proxies
# /api to the backend on :4000, so the default /api/v1 works.
# VITE_API_URL=/api/v1
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Source One Global's internal staff hub" />
    <title>S1 Gateway</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [x] **Step 5: Create `frontend/.dependency-cruiser.cjs`.**

```js
/**
 * The dependency rule, enforced (ADR 0003, ADR 0004). See the backend's copy
 * for how `$1` works. The frontend's application layer may use React and
 * TanStack Query — hooks are how a React app delivers its use cases.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|shared)/domain/' },
      to: { pathNot: ['^src/$1/domain/', '^src/shared/domain/'] },
    },
    {
      name: 'application-depends-only-inward',
      comment: 'Application may use react and @tanstack/react-query, and nothing else from outside.',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|shared)/application/' },
      to: {
        pathNot: [
          '^src/$1/(domain|application)/',
          '^src/shared/(domain|application)/',
          '^node_modules/(react|@tanstack/react-query)/',
        ],
      },
    },
    {
      name: 'infrastructure-not-to-presentation',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|shared)/infrastructure/' },
      to: { path: '^src/(features/[^/]+|shared)/(presentation|ui)/' },
    },
    {
      name: 'presentation-not-to-infrastructure',
      severity: 'error',
      from: { path: '^src/(features/[^/]+/presentation|shared/ui)/' },
      to: { path: '(^src/(features/[^/]+|shared)/infrastructure/|^node_modules/axios/)' },
    },
    {
      name: 'contracts-only-in-infrastructure',
      severity: 'error',
      from: { pathNot: '^src/(features/[^/]+|shared)/infrastructure/' },
      to: { path: 'backend/src/contracts/' },
    },
    {
      name: 'shared-ui-is-generic',
      severity: 'error',
      from: { path: '^src/shared/ui/' },
      to: { pathNot: ['^src/shared/ui/', '^node_modules/(react|clsx|tailwind-merge)/'] },
    },
    {
      name: 'features-meet-only-at-index',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/', pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'] },
    },
    {
      name: 'pages-use-feature-index',
      severity: 'error',
      from: { path: '^src/pages/' },
      to: { path: '^src/features/', pathNot: '^src/features/[^/]+/index\\.ts$' },
    },
    {
      name: 'nothing-reaches-up',
      comment: 'shared knows no feature, page or app; features know no page or app.',
      severity: 'error',
      from: { path: '^src/(shared|features)/' },
      to: { path: '^src/(pages|app)/' },
    },
    {
      name: 'shared-knows-no-feature',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'virtual: modules come from Vite plugins and have no file.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: '^virtual:' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', 'backend/src/contracts'] },
    exclude: { path: ['\\.test\\.tsx?$', '^src/test/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'browser', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
```

- [x] **Step 6: Install.**

Run: `npm install` in `frontend/`.
Expected: exits 0 and writes `frontend/package-lock.json`.

### Task 4.2 — Styles, shared UI and shared infrastructure

**Files:**
- Create: `frontend/src/styles/theme.css`, `frontend/src/styles/index.css`,
  `frontend/src/shared/ui/cn.ts`, `frontend/src/shared/ui/Button.tsx`,
  `frontend/src/shared/ui/Card.tsx`, `frontend/src/shared/ui/TextField.tsx`,
  `frontend/src/shared/application/app-error.ts`,
  `frontend/src/shared/infrastructure/http-client.ts`,
  `frontend/src/shared/infrastructure/to-app-error.ts`
- Test: `frontend/src/shared/infrastructure/to-app-error.test.ts`

**Interfaces — produces:**
- `class AppError extends Error { readonly code: string; readonly fields: Record<string, string[]> }` —
  `new AppError(code, message, fields = {})`
- `createHttpClient(baseURL: string): AxiosInstance`
- `toAppError(error: unknown): AppError` — codes `TIMEOUT`, `NETWORK`, the API's code, `HTTP_<status>`, `UNKNOWN`
- `cn(...inputs: ClassValue[]): string`; `Button({ variant?: 'primary' | 'secondary', … })`;
  `Card(props: HTMLAttributes<HTMLElement>)`; `TextField({ label: string; errors?: readonly string[]; …input props })`
- Tokens: `surface`, `surface-raised`, `ink`, `ink-muted`, `border`, `accent`,
  `accent-strong`, `accent-contrast`, `danger`; radius `box`

- [x] **Step 1: Write the failing test.**

`frontend/src/shared/infrastructure/to-app-error.test.ts`:
```ts
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { toAppError } from './to-app-error';

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function responseError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: String(status),
    headers: {},
    config,
    data,
  });
}

describe('toAppError', () => {
  it('keeps the API error code, message and fields', () => {
    const error = toAppError(
      responseError(409, {
        error: { code: 'TOOL_NAME_TAKEN', message: 'Taken.', details: { fields: { name: ['Taken.'] } } },
      }),
    );
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('TOOL_NAME_TAKEN');
    expect(error.message).toBe('Taken.');
    expect(error.fields).toEqual({ name: ['Taken.'] });
  });

  it('names a timeout', () => {
    expect(toAppError(new AxiosError('timeout', 'ECONNABORTED', config)).code).toBe('TIMEOUT');
  });

  it('names a request that got no answer', () => {
    const error = toAppError(new AxiosError('Network Error', 'ERR_NETWORK', config));
    expect(error.code).toBe('NETWORK');
    expect(error.message).toMatch(/cannot reach the server/i);
  });

  it('falls back to the status for a body that is not the API shape', () => {
    expect(toAppError(responseError(502, '<html>Bad gateway</html>')).code).toBe('HTTP_502');
  });

  it('wraps anything else', () => {
    expect(toAppError(new Error('boom')).code).toBe('UNKNOWN');
  });
});
```

- [x] **Step 2: Run it and watch it fail.**

Run: `npx vitest run src/shared` in `frontend/`.
Expected: FAIL — cannot resolve `@/shared/application/app-error`.

- [x] **Step 3: Create the styles.**

`frontend/src/styles/theme.css`:
```css
/*
 * Design tokens. Neutral placeholders until a visual identity is decided —
 * change values here, never in components. See frontend/DESIGN.md.
 */
@theme static {
  --color-surface: #ffffff;
  --color-surface-raised: #f4f5f7;
  --color-ink: #16181d;
  --color-ink-muted: #5b6270;
  --color-border: #d9dce3;
  --color-accent: #2453c7;
  --color-accent-strong: #1b3f99;
  --color-accent-contrast: #ffffff;
  --color-danger: #b42318;

  --radius-box: 0.5rem;

  --font-sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

/* Dark mode follows the device. */
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #121418;
    --color-surface-raised: #1b1e24;
    --color-ink: #eceef2;
    --color-ink-muted: #a3a9b6;
    --color-border: #2e323b;
    --color-accent: #7c9dff;
    --color-accent-strong: #a3baff;
    --color-accent-contrast: #0b1020;
    --color-danger: #ff8a7a;
  }
}
```

`frontend/src/styles/index.css`:
```css
@import 'tailwindcss';
@import './theme.css';

@layer base {
  html {
    color-scheme: light dark;
  }

  body {
    @apply bg-surface font-sans text-ink antialiased;
  }
}
```

- [x] **Step 4: Create the shared application error and infrastructure.**

`frontend/src/shared/application/app-error.ts`:
```ts
/**
 * Every failed request, normalised. A component shows `message`, and
 * `fields[name]` next to an input, without knowing whether the cause was a
 * timeout, no connection, or a rule the server enforced.
 */
export class AppError extends Error {
  readonly code: string;
  readonly fields: Record<string, string[]>;

  constructor(code: string, message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.fields = fields;
  }
}
```

`frontend/src/shared/infrastructure/http-client.ts`:
```ts
import axios, { type AxiosInstance } from 'axios';

export function createHttpClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 15_000,
    headers: { Accept: 'application/json' },
  });
}
```

`frontend/src/shared/infrastructure/to-app-error.ts`:
```ts
import type { ApiErrorBody } from '@contracts/envelope';
import { isAxiosError } from 'axios';
import { AppError } from '@/shared/application/app-error';

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!isAxiosError(error)) return new AppError('UNKNOWN', 'Something went wrong. Try again.');

  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new AppError('TIMEOUT', 'The server took too long to answer. Try again.');
  }
  if (!error.response) {
    return new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }

  const body = error.response.data as Partial<ApiErrorBody> | undefined;
  const apiError = typeof body === 'object' && body !== null ? body.error : undefined;
  if (apiError && typeof apiError.code === 'string' && typeof apiError.message === 'string') {
    return new AppError(apiError.code, apiError.message, readFields(apiError.details));
  }

  const { status } = error.response;
  return new AppError(`HTTP_${status}`, `The server answered with an error (${status}). Try again.`);
}

function readFields(details: Record<string, unknown> | undefined): Record<string, string[]> {
  const fields = details?.fields;
  if (typeof fields !== 'object' || fields === null) return {};

  const result: Record<string, string[]> = {};
  for (const [name, messages] of Object.entries(fields)) {
    if (Array.isArray(messages)) {
      result[name] = messages.filter((message): message is string => typeof message === 'string');
    }
  }
  return result;
}
```

- [x] **Step 5: Create the shared UI primitives.**

`frontend/src/shared/ui/cn.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names; a later Tailwind class overrides an earlier conflicting one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

`frontend/src/shared/ui/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-strong',
  secondary: 'border border-border bg-surface text-ink hover:bg-surface-raised',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', type = 'button', className, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-box px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
```

`frontend/src/shared/ui/Card.tsx`:
```tsx
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-box border border-border bg-surface-raised p-4', className)} {...props} />;
}
```

`frontend/src/shared/ui/TextField.tsx`:
```tsx
import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errors?: readonly string[] | undefined;
}

export function TextField({ label, errors = [], className, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const invalid = errors.length > 0;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className="rounded-box border border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent aria-invalid:border-danger"
        {...props}
      />
      {invalid && (
        <p id={errorId} className="text-sm text-danger">
          {errors.join(' ')}
        </p>
      )}
    </div>
  );
}
```

- [x] **Step 6: Run the test and watch it pass.**

Run: the command from Step 2. Expected: `5 passed`.

### Task 4.3 — App shell

**Files:**
- Create: `frontend/src/main.tsx`, `frontend/src/app/App.tsx`,
  `frontend/src/app/query-client.ts`, `frontend/src/app/router.tsx`,
  `frontend/src/pages/NotFoundPage.tsx`
- (`providers.tsx` and `dependencies.ts` are created in Task 5.5, once the
  feature they wire exists.)

- [x] **Step 1: Create the files.** `App.tsx` here is a first version; Task 5.5
  replaces it.

`frontend/src/app/query-client.ts`:
```ts
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: 1 },
    },
  });
}
```

`frontend/src/pages/NotFoundPage.tsx`:
```tsx
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-muted">
        There is nothing at this address. <Link to="/" className="text-accent hover:underline">Go to the hub</Link>.
      </p>
    </main>
  );
}
```

`frontend/src/app/router.tsx`:
```tsx
import { createBrowserRouter } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([{ path: '*', element: <NotFoundPage /> }]);
```

`frontend/src/app/App.tsx`:
```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { createQueryClient } from './query-client';
import { router } from './router';

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

`frontend/src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [x] **Step 2: Run the frontend checks.**

Run, in `frontend/`: `npm run typecheck && npm run lint && npm run arch:check && npm run build`
Expected: each exits 0; arch:check prints `no dependency violations found`;
the build writes `frontend/dist/index.html`.

---

## Phase 5 — Tools feature (frontend)

### Task 5.1 — Domain

**Files:**
- Create: `frontend/src/features/tools/domain/tool.ts`,
  `frontend/src/features/tools/domain/group-by-category.ts`,
  `frontend/src/features/tools/domain/is-web-url.ts`
- Test: `frontend/src/features/tools/domain/group-by-category.test.ts`,
  `frontend/src/features/tools/domain/is-web-url.test.ts`

**Interfaces — produces:**
- `interface Tool { id; name; url; description; category: string; createdAt: Date }`
- `interface NewTool { name: string; url: string; description: string; category: string }`
- `interface ToolGroup { category: string; tools: readonly Tool[] }`, `groupByCategory(tools: readonly Tool[]): ToolGroup[]`
- `isWebUrl(value: string): boolean`

- [x] **Step 1: Write the failing tests.**

`frontend/src/features/tools/domain/group-by-category.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { groupByCategory } from './group-by-category';
import type { Tool } from './tool';

function tool(name: string, category: string): Tool {
  return { id: name, name, url: 'https://example.com', description: '', category, createdAt: new Date(0) };
}

describe('groupByCategory', () => {
  it('returns no groups for no tools', () => {
    expect(groupByCategory([])).toEqual([]);
  });

  it('groups ignoring case, labelled as first seen', () => {
    const groups = groupByCategory([tool('Payroll', 'Finance'), tool('Expenses', 'finance')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.category).toBe('Finance');
  });

  it('sorts groups, and tools within a group, by name ignoring case', () => {
    const groups = groupByCategory([tool('Payroll', 'Finance'), tool('Leave', 'HR'), tool('expenses', 'Finance')]);
    expect(groups.map((group) => [group.category, group.tools.map((t) => t.name)])).toEqual([
      ['Finance', ['expenses', 'Payroll']],
      ['HR', ['Leave']],
    ]);
  });
});
```

`frontend/src/features/tools/domain/is-web-url.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isWebUrl } from './is-web-url';

describe('isWebUrl', () => {
  it.each(['https://payroll.example.com', 'http://intranet.local/a'])('accepts %s', (url) => {
    expect(isWebUrl(url)).toBe(true);
  });

  it.each(['javascript:alert(1)', 'ftp://files.example.com', '/relative', ''])('rejects %s', (url) => {
    expect(isWebUrl(url)).toBe(false);
  });
});
```

- [x] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/features/tools/domain` in `frontend/`.
Expected: FAIL — cannot resolve `./group-by-category`.

- [x] **Step 3: Implement the domain.**

`frontend/src/features/tools/domain/tool.ts`:
```ts
/** A tool as the frontend works with it. Independent of the wire format. */
export interface Tool {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  createdAt: Date;
}

export interface NewTool {
  name: string;
  url: string;
  description: string;
  category: string;
}
```

`frontend/src/features/tools/domain/group-by-category.ts`:
```ts
import type { Tool } from './tool';

export interface ToolGroup {
  category: string;
  tools: readonly Tool[];
}

/**
 * One group per category, ignoring case — "Finance" and "finance" are the
 * same shelf, labelled as first seen. Groups and the tools in each are sorted
 * by name, ignoring case.
 */
export function groupByCategory(tools: readonly Tool[]): ToolGroup[] {
  const groups = new Map<string, { category: string; tools: Tool[] }>();

  for (const tool of tools) {
    const key = tool.category.toLowerCase();
    const group = groups.get(key);
    if (group) group.tools.push(tool);
    else groups.set(key, { category: tool.category, tools: [tool] });
  }

  return [...groups.values()]
    .sort((a, b) => compareText(a.category, b.category))
    .map((group) => ({ category: group.category, tools: [...group.tools].sort((a, b) => compareText(a.name, b.name)) }));
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}
```

`frontend/src/features/tools/domain/is-web-url.ts`:
```ts
/**
 * Only http and https become links. The backend refuses anything else, and
 * this keeps a `javascript:` URL inert even if one ever reached the database.
 */
export function isWebUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
}
```

- [x] **Step 4: Run them and watch them pass.**

Run: the command from Step 2. Expected: `9 passed`.

### Task 5.2 — Application: the port and the hooks

**Files:**
- Create: `frontend/src/features/tools/application/tools-gateway.ts`,
  `frontend/src/features/tools/application/tools-gateway-context.tsx`,
  `frontend/src/features/tools/application/tools.keys.ts`,
  `frontend/src/features/tools/application/use-tools.ts`,
  `frontend/src/features/tools/application/use-create-tool.ts`

**Interfaces — produces:**
- `interface ToolsGateway { list(): Promise<Tool[]>; create(input: NewTool): Promise<Tool> }` — rejects with `AppError`
- `ToolsGatewayProvider({ gateway, children })`, `useToolsGateway(): ToolsGateway`
- `toolsKeys.all`, `toolsKeys.list()`
- `useTools()` → `UseQueryResult<Tool[], AppError>`; `useCreateTool()` → `UseMutationResult<Tool, AppError, NewTool>`

These are exercised through the form test in Task 5.4.

- [x] **Step 1: Create the files.**

`frontend/src/features/tools/application/tools-gateway.ts`:
```ts
import type { NewTool, Tool } from '../domain/tool';

/**
 * Where the tools feature gets and sends tools. The application owns this
 * port; infrastructure implements it over HTTP. Every method rejects with an
 * AppError.
 */
export interface ToolsGateway {
  list(): Promise<Tool[]>;
  create(input: NewTool): Promise<Tool>;
}
```

`frontend/src/features/tools/application/tools-gateway-context.tsx`:
```tsx
import { createContext, useContext, type ReactNode } from 'react';
import type { ToolsGateway } from './tools-gateway';

const ToolsGatewayContext = createContext<ToolsGateway | null>(null);

export function ToolsGatewayProvider({ gateway, children }: { gateway: ToolsGateway; children: ReactNode }) {
  return <ToolsGatewayContext value={gateway}>{children}</ToolsGatewayContext>;
}

export function useToolsGateway(): ToolsGateway {
  const gateway = useContext(ToolsGatewayContext);
  if (!gateway) throw new Error('useToolsGateway must be used inside <ToolsGatewayProvider>.');
  return gateway;
}
```

`frontend/src/features/tools/application/tools.keys.ts`:
```ts
export const toolsKeys = {
  all: ['tools'] as const,
  list: () => [...toolsKeys.all, 'list'] as const,
};
```

`frontend/src/features/tools/application/use-tools.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Tool } from '../domain/tool';
import { useToolsGateway } from './tools-gateway-context';
import { toolsKeys } from './tools.keys';

export function useTools() {
  const gateway = useToolsGateway();
  return useQuery<Tool[], AppError>({
    queryKey: toolsKeys.list(),
    queryFn: () => gateway.list(),
  });
}
```

`frontend/src/features/tools/application/use-create-tool.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { NewTool, Tool } from '../domain/tool';
import { useToolsGateway } from './tools-gateway-context';
import { toolsKeys } from './tools.keys';

export function useCreateTool() {
  const gateway = useToolsGateway();
  const queryClient = useQueryClient();
  return useMutation<Tool, AppError, NewTool>({
    mutationFn: (input) => gateway.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: toolsKeys.all }),
  });
}
```

- [x] **Step 2: Typecheck.**

Run: `npm run typecheck` in `frontend/`. Expected: exits 0.

### Task 5.3 — Infrastructure: the HTTP gateway

**Files:**
- Create: `frontend/src/features/tools/infrastructure/http-tools-gateway.ts`
- Test: `frontend/src/features/tools/infrastructure/http-tools-gateway.test.ts`

**Interfaces — produces:** `class HttpToolsGateway implements ToolsGateway` — `constructor(http: AxiosInstance)`

- [x] **Step 1: Write the failing test.**

```ts
import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { HttpToolsGateway } from './http-tools-gateway';

const wireTool = {
  id: 't1',
  name: 'Payroll',
  url: 'https://payroll.example.com',
  description: '',
  category: 'Finance',
  createdAt: '2026-10-14T08:00:00.000Z',
};

function gatewayAnswering(status: number, data: unknown, sent: unknown[] = []): HttpToolsGateway {
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config.data === undefined ? undefined : JSON.parse(config.data as string));
    const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
    return response;
  };
  return new HttpToolsGateway(axios.create({ adapter }));
}

describe('HttpToolsGateway', () => {
  it('lists tools with their creation time as a Date', async () => {
    const [tool] = await gatewayAnswering(200, { data: [wireTool] }).list();
    expect(tool?.createdAt).toEqual(new Date('2026-10-14T08:00:00.000Z'));
    expect(tool?.name).toBe('Payroll');
  });

  it('sends the new tool and returns what was created', async () => {
    const sent: unknown[] = [];
    const created = await gatewayAnswering(201, { data: wireTool }, sent).create({
      name: 'Payroll',
      url: 'https://payroll.example.com',
      description: '',
      category: 'Finance',
    });
    expect(sent).toEqual([{ name: 'Payroll', url: 'https://payroll.example.com', description: '', category: 'Finance' }]);
    expect(created.id).toBe('t1');
  });

  it('rejects with an AppError carrying the API error', async () => {
    const gateway = gatewayAnswering(409, {
      error: { code: 'TOOL_NAME_TAKEN', message: 'Taken.', details: { fields: { name: ['Taken.'] } } },
    });
    const failure = await gateway.list().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe('TOOL_NAME_TAKEN');
  });

  it('rejects with NETWORK when the server cannot be reached', async () => {
    const adapter: AxiosAdapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    };
    const failure = await new HttpToolsGateway(axios.create({ adapter })).list().catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('NETWORK');
  });
});
```

- [x] **Step 2: Run it and watch it fail.**

Run: `npx vitest run src/features/tools/infrastructure` in `frontend/`.
Expected: FAIL — cannot resolve `./http-tools-gateway`.

- [x] **Step 3: Implement the gateway.**

```ts
import type { DataEnvelope } from '@contracts/envelope';
import type { CreateToolRequest, Tool as ToolContract } from '@contracts/tools';
import type { AxiosInstance } from 'axios';
import { toAppError } from '@/shared/infrastructure/to-app-error';
import type { ToolsGateway } from '../application/tools-gateway';
import type { NewTool, Tool } from '../domain/tool';

/** The ToolsGateway port over the HTTP API. The only file in the feature that knows the wire format. */
export class HttpToolsGateway implements ToolsGateway {
  private readonly http: AxiosInstance;

  constructor(http: AxiosInstance) {
    this.http = http;
  }

  async list(): Promise<Tool[]> {
    try {
      const response = await this.http.get<DataEnvelope<ToolContract[]>>('/tools');
      return response.data.data.map(toDomain);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async create(input: NewTool): Promise<Tool> {
    const body: CreateToolRequest = {
      name: input.name,
      url: input.url,
      description: input.description,
      category: input.category,
    };
    try {
      const response = await this.http.post<DataEnvelope<ToolContract>>('/tools', body);
      return toDomain(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

function toDomain(contract: ToolContract): Tool {
  return { ...contract, createdAt: new Date(contract.createdAt) };
}
```

- [x] **Step 4: Run it and watch it pass.**

Run: the command from Step 2. Expected: `4 passed`.

### Task 5.4 — Presentation: card, list and form

**Files:**
- Create: `frontend/src/features/tools/presentation/ToolCard.tsx`,
  `frontend/src/features/tools/presentation/ToolList.tsx`,
  `frontend/src/features/tools/presentation/CreateToolForm.tsx`
- Test: `frontend/src/features/tools/presentation/ToolCard.test.tsx`,
  `frontend/src/features/tools/presentation/CreateToolForm.test.tsx`

**Interfaces — produces:** `ToolCard({ tool: Tool })`, `ToolList({ tools: readonly Tool[] })`, `CreateToolForm()`

- [x] **Step 1: Write the failing tests.**

`frontend/src/features/tools/presentation/ToolCard.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Tool } from '../domain/tool';
import { ToolCard } from './ToolCard';

const base: Tool = {
  id: 't1',
  name: 'Payroll',
  url: 'https://payroll.example.com',
  description: 'Monthly pay',
  category: 'Finance',
  createdAt: new Date(0),
};

describe('ToolCard', () => {
  it('links to the tool in a new tab, without an opener', () => {
    render(<ToolCard tool={base} />);
    const link = screen.getByRole('link', { name: 'Payroll' });
    expect(link.getAttribute('href')).toBe('https://payroll.example.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('never turns a non-web URL into a link', () => {
    render(<ToolCard tool={{ ...base, url: 'javascript:alert(1)' }} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Payroll')).toBeTruthy();
  });
});
```

`frontend/src/features/tools/presentation/CreateToolForm.test.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { ToolsGateway } from '../application/tools-gateway';
import { ToolsGatewayProvider } from '../application/tools-gateway-context';
import type { NewTool, Tool } from '../domain/tool';
import { CreateToolForm } from './CreateToolForm';

function renderForm(create: ToolsGateway['create']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const gateway: ToolsGateway = { list: async () => [], create };
  render(
    <QueryClientProvider client={queryClient}>
      <ToolsGatewayProvider gateway={gateway}>
        <CreateToolForm />
      </ToolsGatewayProvider>
    </QueryClientProvider>,
  );
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submitPayroll() {
  fill('Name', 'Payroll');
  fill('URL', 'https://payroll.example.com');
  fill('Category', 'Finance');
  fireEvent.click(screen.getByRole('button', { name: 'Add tool' }));
}

describe('CreateToolForm', () => {
  it('sends the entered tool and clears the form', async () => {
    const create = vi.fn(async (input: NewTool): Promise<Tool> => ({ ...input, id: 't1', createdAt: new Date() }));
    renderForm(create);
    submitPayroll();

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: 'Payroll',
        url: 'https://payroll.example.com',
        description: '',
        category: 'Finance',
      }),
    );
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(''));
  });

  it("shows the server's message under the field it is about, and keeps the input", async () => {
    const message = 'A tool named "Payroll" already exists.';
    renderForm(async () => {
      throw new AppError('TOOL_NAME_TAKEN', message, { name: [message] });
    });
    submitPayroll();

    expect(await screen.findByText(message)).toBeTruthy();
    const name = screen.getByLabelText('Name') as HTMLInputElement;
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.value).toBe('Payroll');
  });

  it('shows a general message when the failure is not about a field', async () => {
    renderForm(async () => {
      throw new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.');
    });
    submitPayroll();

    expect((await screen.findByRole('alert')).textContent).toMatch(/cannot reach the server/i);
  });
});
```

- [x] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/features/tools/presentation` in `frontend/`.
Expected: FAIL — cannot resolve `./ToolCard`.

- [x] **Step 3: Implement the components.**

`frontend/src/features/tools/presentation/ToolCard.tsx`:
```tsx
import { Card } from '@/shared/ui/Card';
import { isWebUrl } from '../domain/is-web-url';
import type { Tool } from '../domain/tool';

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Card className="flex h-full flex-col gap-1">
      {isWebUrl(tool.url) ? (
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent hover:underline"
        >
          {tool.name}
        </a>
      ) : (
        <span className="font-medium">{tool.name}</span>
      )}
      {tool.description && <p className="text-sm text-ink-muted">{tool.description}</p>}
    </Card>
  );
}
```

`frontend/src/features/tools/presentation/ToolList.tsx`:
```tsx
import { groupByCategory } from '../domain/group-by-category';
import type { Tool } from '../domain/tool';
import { ToolCard } from './ToolCard';

export function ToolList({ tools }: { tools: readonly Tool[] }) {
  const groups = groupByCategory(tools);

  if (groups.length === 0) {
    return <p className="text-ink-muted">No tools yet. Add the first one below.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.category.toLowerCase()} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{group.category}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.tools.map((tool) => (
              <li key={tool.id}>
                <ToolCard tool={tool} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

`frontend/src/features/tools/presentation/CreateToolForm.tsx`:
```tsx
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useCreateTool } from '../application/use-create-tool';
import type { NewTool } from '../domain/tool';

const EMPTY: NewTool = { name: '', url: '', description: '', category: '' };

export function CreateToolForm() {
  const [values, setValues] = useState<NewTool>(EMPTY);
  const createTool = useCreateTool();
  const fields = createTool.error?.fields ?? {};
  const hasFieldErrors = Object.keys(fields).length > 0;

  function update(field: keyof NewTool) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
    };
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTool.mutate(values, { onSuccess: () => setValues(EMPTY) });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Add a tool</h2>
      <TextField label="Name" name="name" value={values.name} onChange={update('name')} errors={fields.name} maxLength={80} required />
      <TextField label="URL" name="url" type="url" value={values.url} onChange={update('url')} errors={fields.url} placeholder="https://" required />
      <TextField label="Category" name="category" value={values.category} onChange={update('category')} errors={fields.category} maxLength={40} required />
      <TextField label="Description" name="description" value={values.description} onChange={update('description')} errors={fields.description} maxLength={280} />
      {createTool.error && !hasFieldErrors && (
        <p role="alert" className="text-sm text-danger">
          {createTool.error.message}
        </p>
      )}
      <Button type="submit" disabled={createTool.isPending} className="self-start">
        {createTool.isPending ? 'Adding…' : 'Add tool'}
      </Button>
    </form>
  );
}
```

- [x] **Step 4: Run them and watch them pass.**

Run: the command from Step 2. Expected: `5 passed`.

### Task 5.5 — Feature index, page and wiring

**Files:**
- Create: `frontend/src/features/tools/index.ts`, `frontend/src/pages/ToolsPage.tsx`,
  `frontend/src/app/dependencies.ts`, `frontend/src/app/providers.tsx`
- Modify: `frontend/src/app/router.tsx`, `frontend/src/app/App.tsx`

- [x] **Step 1: Create the feature's public surface.**

`frontend/src/features/tools/index.ts`:
```ts
export type { NewTool, Tool } from './domain/tool';
export type { ToolsGateway } from './application/tools-gateway';
export { ToolsGatewayProvider } from './application/tools-gateway-context';
export { useTools } from './application/use-tools';
export { HttpToolsGateway } from './infrastructure/http-tools-gateway';
export { CreateToolForm } from './presentation/CreateToolForm';
export { ToolList } from './presentation/ToolList';
```

- [x] **Step 2: Create the page.**

`frontend/src/pages/ToolsPage.tsx`:
```tsx
import { CreateToolForm, ToolList, useTools } from '@/features/tools';
import { Card } from '@/shared/ui/Card';

export function ToolsPage() {
  const tools = useTools();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Tools</h1>
        <p className="text-ink-muted">Internal apps and links for Source One Global staff.</p>
      </header>

      {tools.isPending ? (
        <p className="text-ink-muted">Loading tools…</p>
      ) : tools.isError ? (
        <p role="alert" className="text-danger">
          {tools.error.message}
        </p>
      ) : (
        <ToolList tools={tools.data} />
      )}

      <Card className="max-w-xl">
        <CreateToolForm />
      </Card>
    </main>
  );
}
```

- [x] **Step 3: Wire the dependencies and providers.**

`frontend/src/app/dependencies.ts`:
```ts
import { HttpToolsGateway, type ToolsGateway } from '@/features/tools';
import { createHttpClient } from '@/shared/infrastructure/http-client';

/** Every port's production adapter, chosen in one place. */
export interface Dependencies {
  toolsGateway: ToolsGateway;
}

export function createDependencies(): Dependencies {
  const http = createHttpClient(import.meta.env.VITE_API_URL ?? '/api/v1');
  return { toolsGateway: new HttpToolsGateway(http) };
}
```

`frontend/src/app/providers.tsx`:
```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ToolsGatewayProvider } from '@/features/tools';
import { createDependencies } from './dependencies';
import { createQueryClient } from './query-client';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [dependencies] = useState(createDependencies);

  return (
    <QueryClientProvider client={queryClient}>
      <ToolsGatewayProvider gateway={dependencies.toolsGateway}>{children}</ToolsGatewayProvider>
    </QueryClientProvider>
  );
}
```

- [x] **Step 4: Replace `frontend/src/app/router.tsx` and `frontend/src/app/App.tsx`.**

`frontend/src/app/router.tsx`:
```tsx
import { createBrowserRouter } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ToolsPage } from '@/pages/ToolsPage';

export const router = createBrowserRouter([
  { path: '/', element: <ToolsPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
```

`frontend/src/app/App.tsx`:
```tsx
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers';
import { router } from './router';

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
```

- [x] **Step 5: Run every frontend check.**

Run, in `frontend/`: `npm run typecheck && npm run lint && npm run arch:check && npm test && npm run build`
Expected: each exits 0; arch:check prints `no dependency violations found`;
tests print `Test Files  6 passed (6)` and `Tests  23 passed (23)`.

---

## Phase 6 — PWA

### Task 6.1 — Icons and the manifest

**Files:**
- Create: `frontend/public/icon.svg`; generated `frontend/public/pwa-64x64.png`,
  `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`,
  `apple-touch-icon-180x180.png`, `favicon.ico`
- Modify: `frontend/vite.config.ts`, `frontend/index.html`

- [x] **Step 1: Create the placeholder icon.** `frontend/public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2453c7"/>
  <text x="256" y="318" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="200" font-weight="700" fill="#ffffff">S1</text>
</svg>
```

- [x] **Step 2: Generate the icons.**

Run: `npm run pwa:icons` in `frontend/`.
Expected: the six files listed under **Files** appear in `frontend/public/`.

- [x] **Step 3: Add the PWA plugin to `frontend/vite.config.ts`.** Replace the
  file with:

```ts
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new worker waits for the user to choose Reload — never swaps
      // under an open tab (ADR 0010).
      registerType: 'prompt',
      // Registered by useRegisterSW in <UpdatePrompt />.
      injectRegister: false,
      // The kill switch: build with PWA_SELF_DESTROY=true to ship a worker
      // that unregisters itself and clears its caches.
      selfDestroying: process.env.PWA_SELF_DESTROY === 'true',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'S1 Gateway',
        short_name: 'S1 Gateway',
        description: "Source One Global's internal staff hub",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2453c7',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell only. API responses are never cached (ADR 0010).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // An API request must never be answered with the cached HTML shell.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      // No worker in development, so `npm run dev:web` never serves a stale cache.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // One origin in development: the browser talks to Vite, Vite to the API.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
```

- [x] **Step 4: Add the icons and theme colour to `frontend/index.html`.** Insert
  after the `description` meta:

```html
    <meta name="theme-color" content="#2453c7" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

### Task 6.2 — Update prompt and offline banner

**Files:**
- Create: `frontend/src/app/pwa/use-online-status.ts`,
  `frontend/src/app/pwa/OfflineBanner.tsx`, `frontend/src/app/pwa/UpdatePrompt.tsx`
- Modify: `frontend/src/app/App.tsx`
- Test: `frontend/src/app/pwa/OfflineBanner.test.tsx`

- [x] **Step 1: Write the failing test.**

`frontend/src/app/pwa/OfflineBanner.test.tsx`:
```tsx
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OfflineBanner } from './OfflineBanner';

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
}

afterEach(() => setOnline(true));

describe('OfflineBanner', () => {
  it('shows nothing while online', () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says so when the connection drops, and goes away when it returns', () => {
    setOnline(true);
    render(<OfflineBanner />);

    act(() => setOnline(false));
    expect(screen.getByRole('status').textContent).toMatch(/offline/i);

    act(() => setOnline(true));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
```

- [x] **Step 2: Run it and watch it fail.**

Run: `npx vitest run src/app/pwa` in `frontend/`.
Expected: FAIL — cannot resolve `./OfflineBanner`.

- [x] **Step 3: Implement the hook and the two components.**

`frontend/src/app/pwa/use-online-status.ts`:
```ts
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
```

`frontend/src/app/pwa/OfflineBanner.tsx`:
```tsx
import { useOnlineStatus } from './use-online-status';

/** Offline is a state, not an error: say what is happening, in a sentence. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <p role="status" className="border-b border-border bg-surface-raised px-4 py-2 text-center text-sm text-ink-muted">
      You are offline. The Gateway will show live data again when you reconnect.
    </p>
  );
}
```

`frontend/src/app/pwa/UpdatePrompt.tsx`:
```tsx
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/shared/ui/Button';

/** A new version waits until the user chooses to reload (ADR 0010). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center gap-3 rounded-box border border-border bg-surface-raised p-4"
    >
      <p className="flex-1 text-sm">A new version of the Gateway is ready.</p>
      <Button variant="secondary" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button onClick={() => void updateServiceWorker(true)}>Reload</Button>
    </div>
  );
}
```

- [x] **Step 4: Mount both in `frontend/src/app/App.tsx`.** Replace the file with:

```tsx
import { RouterProvider } from 'react-router-dom';
import { OfflineBanner } from './pwa/OfflineBanner';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { AppProviders } from './providers';
import { router } from './router';

export function App() {
  return (
    <AppProviders>
      <OfflineBanner />
      <RouterProvider router={router} />
      <UpdatePrompt />
    </AppProviders>
  );
}
```

- [x] **Step 5: Run the test and watch it pass.**

Run: the command from Step 2. Expected: `2 passed`.

- [x] **Step 6: Build and inspect the worker.**

Run, in `frontend/`: `npm run typecheck && npm run lint && npm run arch:check && npm test && npm run build`
Expected: each exits 0; `frontend/dist/` contains `sw.js`, `manifest.webmanifest`
and `workbox-*.js`. Then run `grep -c "api" dist/sw.js` (Git Bash) and expect
`1` or more — the `navigateFallbackDenylist` pattern is present — and
`grep -oE 'url:"[^"]*"' dist/sw.js` (the precache list is minified, so keys
are unquoted) lists only built assets (`index.html`,
`assets/…`, icons), never an `/api/` URL.

---

## Phase 7 — Documentation

Every document below is prose. Each step names the file, every section it must
have, and every fact it must state. Follow Bilikha's voice: short, direct,
explains *why*, never restates code or lists directories file by file
(`docs/README.md`, "The rule that keeps this useful"). Write the facts given;
do not invent policy beyond them.

### Task 7.1 — The docs index and the decision records

- [x] **Step 1: `docs/README.md`.** Same structure as Bilikha's
  `docs/README.md`, with "Bilikha" replaced by "s1-gateway": title
  `# s1-gateway developer documentation`; the purpose table (Getting started,
  Guides, Reference, Explanation, Decisions, Plans, Handoffs) with the same
  columns; the line pointing to `frontend/DESIGN.md` (link target `../frontend/DESIGN.md`);
  "The rule that keeps this useful"; "Decay"; and an **Index** listing every
  file this phase creates, grouped by category, plus `Plan index` and
  `0001 — Project scaffold`.

- [x] **Step 2: `docs/decisions/README.md` and `docs/decisions/_template.md`.**
  Copy both from Bilikha. In the README, replace the **Log** table with rows
  0001–0010 (titles from the Design section; status **Accepted** for all).

- [x] **Step 3: Decision records 0001–0010.** Each uses `_template.md` (Status,
  Date `2026-10-14`, Context, Decision, Alternatives considered, Consequences)
  and stays under a page. File names and the facts each must state:
  - `0001-record-architecture-decisions.md` — decisions with consequences get a
    record; numbered, never renumbered; superseded, never deleted.
  - `0002-pern-with-client-rendered-spa.md` — internal staff hub, behind a
    sign-in once auth lands, so no SEO or link-preview need; a client-rendered
    SPA on Vite is enough. Alternatives: Next.js / SSR (rejected: no public
    pages), separate repositories (rejected: one PR should change an endpoint
    and its consumer).
  - `0003-clean-architecture-with-layers-inside-modules.md` — the four layers
    and the dependency rule (copy the Design section's tables); layers live
    *inside* each module and feature; composition roots; manual DI. Context
    must say plainly that Bilikha's ADR 0014 rejected Clean Architecture for
    its CRUD workload, and why this project chose it anyway: the owner
    required it; a gateway is expected to front several internal systems, so
    infrastructure swaps are realistic; and enforcement by a check removes the
    "team routes around it" risk. Alternatives: global layers (one feature
    spread over four folders), Bilikha's light modular monolith. Consequences:
    more files per feature (entity, port, use case, mapper, adapter);
    database types never leak past infrastructure; use cases test with no
    database.
  - `0004-layer-rules-are-enforced-by-dependency-cruiser.md` — rules in
    `backend/.dependency-cruiser.cjs` and `frontend/.dependency-cruiser.cjs`;
    run by `npm run arch:check`, the pre-push hook and CI. Alternatives:
    review only (convention, not compilation), ESLint boundary plugins
    (rejected: the project lints with oxlint, which cannot express layer
    rules). Consequence: TypeScript stays on 6 until dependency-cruiser
    supports TypeScript 7.
  - `0005-migrations-over-db-push.md` — schema changes go through
    `npm run db:generate` and committed SQL in `backend/drizzle/`;
    `drizzle-kit push` is never used. Why: reviewable, repeatable,
    the same in CI, staging and production.
  - `0006-versioned-api-prefix.md` — every route under `/api/v1`, from day
    one, so a breaking change can ship as `/api/v2` beside it.
  - `0007-one-definition-of-an-api-shape.md` — contracts in
    `backend/src/contracts/`, types only, imported by the frontend with
    `import type` via `@contracts/*`; the backend's zod schemas declare
    `satisfies z.ZodType<Contract>`. Cite Bilikha's two production bugs from
    hand-copied response types (its ADR 0037) as the reason. Alternatives:
    zod schemas shared at runtime (rejected: the frontend would bundle code
    from `backend/`), OpenAPI generation (rejected: a toolchain for two
    endpoints).
  - `0008-testing-strategy.md` — the test table from the Design section;
    `test:unit` needs no database; DB tests named `*.db.test.ts` run against a
    real Postgres, never a mock, and refuse a database not named `*_test`.
  - `0009-ai-attribution-is-blocked-by-a-hook-not-a-rule.md` — no AI
    attribution in commits or PR descriptions; enforced by
    `.githooks/commit-msg` and the CI step running `scripts/check-commit-msg.mjs`.
    Cite Bilikha's 37 trailer-carrying commits and the permanent bot
    contributor as the reason.
  - `0010-the-app-shell-is-cached-api-responses-never-are.md` — the PWA
    section of the Design, as a decision: precache the build output only;
    `/api/` excluded from the navigation fallback; `registerType: 'prompt'`
    with no silent `skipWaiting`; the `PWA_SELF_DESTROY` kill switch; no
    worker in development. Alternatives: installable only with no caching
    (Bilikha's state — rejected: staff should get an instant shell and an
    honest offline message), caching the tools list (rejected for now: stale
    links are worse than an honest offline message). Consequence: hosting must
    serve `sw.js` and `index.html` with `Cache-Control: no-cache`, recorded
    for the deployment plan.

### Task 7.2 — Plans and handoffs

- [x] **Step 1: `docs/plans/README.md` and `docs/plans/_template.md`.** Copy
  both from Bilikha. In the README, replace the path example
  `backend/src/modules/auth/auth.service.ts` with
  `backend/src/modules/tools/application/create-tool.ts`, and replace the
  **Plans** table with one row:
  `| [0001](./0001-project-scaffold.md) | Project scaffold | In progress |`
  and delete the closing paragraph about execution order.

- [x] **Step 2: `docs/handoffs/README.md`.** Copy Bilikha's. Delete the table's
  two data rows, keeping its header row — there are no issues yet, and the
  repository has no remote. Keep the naming rule
  (`issue-<number>-<short-title>.md`).

- [x] **Step 3: Mark this plan In progress.** In this file, change
  `- **Status:** Draft` to `- **Status:** In progress`.

### Task 7.3 — Getting started, guides, reference and explanation

- [x] **Step 1: `docs/getting-started/local-setup.md`.** Sections:
  Requirements (Node 22 or 24, npm, Docker Desktop, Git); Steps —
  `npm run setup`, `npm run db:up`, `npm run db:migrate`, `npm run dev:api`
  (http://localhost:4000), `npm run dev:web` (http://localhost:5173) in a
  second terminal; "Check it works" — `curl http://localhost:4000/api/v1/health`
  answers `{"data":{"status":"ok"}}` and the Tools page loads; Troubleshooting —
  port 5436 in use, `Invalid environment` at boot (compare `backend/.env` with
  `.env.example`), tests say `Cannot reach Postgres` (run `npm run db:up`);
  Stopping — `npm run db:down`.

- [x] **Step 2: The five guides.**
  - `docs/guides/add-a-module.md` — when a new module is warranted (a new
    business noun with its own rules); the order to build it: domain entity
    and errors → repository port → use cases with an in-memory fake and tests
    → contract → presentation (schema, controller, routes) and HTTP tests →
    Drizzle table, mapper, repository, migration, `.db.test.ts` →
    `index.ts` → mount in `src/compose.ts` → add the table to
    `src/database-schema.ts` and `src/test/database.ts`'s truncate. Points to
    the `tools` module as the file-by-file example. The frontend mirror:
    domain → port and hooks → HTTP gateway → components → `index.ts` →
    wire in `src/app/dependencies.ts` and `providers.tsx` → page and route.
    Ends with the checks: typecheck, lint, arch:check, test:unit.
  - `docs/guides/add-a-use-case.md` — adding one operation to an existing
    module: the use case class, its test with fakes, a new error with a
    `code` and its HTTP status in the controller's `STATUS_BY_CODE`, the
    contract, the route, the HTTP test; and the frontend hook.
  - `docs/guides/change-the-database-schema.md` — edit the module's
    `*.table.ts`; `npm run db:generate -- --name <what_changed>`; read the
    generated SQL; `npm run db:migrate`; never `drizzle-kit push` (ADR 0005);
    a migration that has shipped is never edited — write a new one.
  - `docs/guides/add-a-ui-component.md` — generic primitives go in
    `src/shared/ui/` (no domain knowledge, tokens only, `cn` for class
    merging); feature components go in the feature's `presentation/`; a
    component receives domain types, never contract types; read
    `frontend/DESIGN.md` first.
  - `docs/guides/turn-off-the-service-worker.md` — when: a bad build is stuck
    in staff browsers. How: build with `PWA_SELF_DESTROY=true npm run build`
    in `frontend/`, deploy it, and leave it deployed until staff have opened
    the app once; then deploy a normal build to turn the worker back on.
    Why this exists: ADR 0010.

- [x] **Step 3: The four reference pages.**
  - `docs/reference/api.md` — base path `/api/v1`; the success envelope and
    the error shape; the HTTP surface table from the Design section; every
    error code (`VALIDATION_FAILED`, `MALFORMED_JSON`, `PAYLOAD_TOO_LARGE`,
    `TOOL_NAME_TAKEN`, `NOT_FOUND`, `INTERNAL_ERROR`) with its status and
    when it happens; the body limit (100 kB).
  - `docs/reference/data-model.md` — the `tools` table: every column with its
    type, nullability and default; the `tools_name_lower_unique` index and
    why it exists.
  - `docs/reference/environment.md` — backend variables (`NODE_ENV`, `PORT`,
    `LOG_LEVEL`, `DATABASE_URL`, `CORS_ORIGIN`) with default and meaning;
    test-only `TEST_DATABASE_URL`; frontend `VITE_API_URL`; build-time
    `PWA_SELF_DESTROY`.
  - `docs/reference/commands.md` — every root script from the Design
    section's root `package.json`, plus `pwa:icons` in `frontend/`, each with
    one line on what it does and whether it needs Docker.

- [x] **Step 4: The two explanation pages.**
  - `docs/explanation/architecture.md` — the two-services diagram (browser →
    Vite SPA → `/api/v1` → Express → Drizzle → Postgres); the request
    lifecycle for `POST /api/v1/tools` traced through middleware → router →
    controller → `parseBody` → `CreateTool` → `Tool.create` →
    `DrizzleToolRepository` → response, and the error path; the dependency
    rule with the diagram and why each restriction exists; how the
    composition roots wire adapters; the frontend's layers and why
    `application` may use React; the PWA's place (the shell, never the
    data); "What is deliberately absent" — DI container, repositories for
    reads that do not need them, Redis, GraphQL, microservices, each with the
    reason.
  - `docs/explanation/constraints.md` — what shapes this product: an internal
    tool for Source One Global staff; no public pages, so no SEO; staff on
    office networks and laptops more than phones, but installed as an app;
    live data matters more than offline reading (why API responses are not
    cached); no authentication yet — **nothing here may be exposed outside
    the internal network until the authentication plan ships**.

### Task 7.4 — Root documents and the design system

- [x] **Step 1: `README.md`.** Sections: title and one-line description
  (Source One Global's Gateway — the internal staff hub); Quick start (the
  local-setup commands, linking to `docs/getting-started/local-setup.md`);
  Stack (the Design section's table); Layout (the repository tree);
  Documentation (the purpose table linking each `docs/` category, plus
  `frontend/DESIGN.md`); Current state — what works (health, tools list and
  create, PWA install and offline shell) and what is not built
  (authentication, deployment, visual identity).

- [x] **Step 2: `CLAUDE.md`.** Modelled on Bilikha's `CLAUDE.md`, rewritten for
  this repository:
  - **Start here** — always load this file, `docs/explanation/constraints.md`
    and your plan; then by area: backend (`docs/guides/add-a-module.md`,
    `docs/guides/add-a-use-case.md`, `docs/explanation/architecture.md`),
    frontend (`frontend/DESIGN.md`, `docs/guides/add-a-ui-component.md`),
    database (`docs/guides/change-the-database-schema.md`).
  - **Read one file and copy its shape** — a table: entity
    `backend/src/modules/tools/domain/tool.ts`; use case
    `backend/src/modules/tools/application/create-tool.ts`; repository
    adapter `backend/src/modules/tools/infrastructure/drizzle-tool-repository.ts`;
    controller `backend/src/modules/tools/presentation/tools.controller.ts`;
    module wiring `backend/src/modules/tools/index.ts`; contract
    `backend/src/contracts/tools.ts`; frontend port
    `frontend/src/features/tools/application/tools-gateway.ts`; frontend
    adapter `frontend/src/features/tools/infrastructure/http-tools-gateway.ts`;
    UI primitive `frontend/src/shared/ui/Button.tsx`; tokens
    `frontend/src/styles/theme.css`.
  - **Look up, do not preload** — `docs/decisions/`, `docs/reference/`, other plans.
  - **Commit and pull request attribution — MUST** — Bilikha's section,
    verbatim in substance, citing ADR 0009.
  - **Other standing rules** — never commit a secret (`.env` is ignored;
    new variables go in `.env.example`); the dependency rule is enforced —
    run `npm run arch:check`, and never weaken a rule in
    `.dependency-cruiser.cjs` to pass it (ADR 0003, 0004); backend relative
    imports end in `.js`; contracts are types only (ADR 0007); tokens only in
    UI; schema changes by generated migration (ADR 0005); record decisions;
    verify before reporting done — `npm run typecheck`, `npm run lint`,
    `npm run arch:check`, `npm run test:unit`, `npm run docs:check`.

- [x] **Step 3: `frontend/DESIGN.md`.** Sections: status (neutral placeholders
  until a visual identity is decided); tokens — a table of every colour token
  from `theme.css` with its light and dark value and what it is for, plus
  `radius-box` and `font-sans`; rules — tokens only, no raw hex, shadow or
  font size in a component; never an interpolated class name (Tailwind cannot
  see `bg-${x}`); one radius for every box; dark mode follows the device;
  `shared/ui` primitives know nothing about any feature; every input has a
  visible label and announces its error with `aria-invalid` and
  `aria-describedby`; how to change a token (edit `theme.css` only).

- [x] **Step 4: Run the docs checks.**

Run: `npm run docs:check` from the repository root.
Expected: `All relative links resolve.`, then
`Every finished plan agrees with its own progress table.`,
`Every finished phase has its boxes ticked.`,
`The README index agrees with every plan.`; exit 0.

---

## Phase 8 — Verification

- [x] **Step 1: Run every local check from the root.**

Run: `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit && npm run docs:check`
Expected: every command exits 0.

- [x] **Step 2: Prove the architecture check bites — backend.** Create
  `backend/src/modules/tools/domain/arch-probe.ts` containing
  `import type { PgTable } from 'drizzle-orm/pg-core';` and
  `export type Probe = PgTable;`. Run `npm run arch:check` in `backend/`.
  Expected: fails, naming `domain-is-pure` and `arch-probe.ts`. Delete the file.

- [x] **Step 3: Prove it bites — frontend.** Create
  `frontend/src/features/tools/presentation/arch-probe.ts` containing
  `import { HttpToolsGateway } from '../infrastructure/http-tools-gateway';` and
  `export const probe = HttpToolsGateway;`. Run `npm run arch:check` in
  `frontend/`. Expected: fails, naming `presentation-not-to-infrastructure`.
  Delete the file.

- [x] **Step 4: Re-run `npm run arch:check`** from the root. Expected: passes
  again — both probes are gone.

- [x] **Step 5: Build both services.**

Run: `npm run build` from the root. Expected: exits 0; `backend/dist/main.js`
and `frontend/dist/sw.js` exist.

- [x] **Step 6 (optional, needs Docker — ask the owner first): Run the
  database-backed tests.** `npm run db:up`, then `npm --prefix backend test`.
  Expected: `Tests  40 passed`. Then `npm run db:down` and confirm with
  `docker ps` that `s1-gateway-postgres` is not running. If the owner declines,
  leave this box unticked and say so in the Progress table: CI runs these.

- [x] **Step 7: Check whitespace.**

Run: `git add -N . && git diff --check; git reset -q`
Expected: no output. (`add -N` only records intent so `diff` sees new files;
`reset` undoes it — nothing is staged or committed.)

- [x] **Step 8: Confirm nothing private or generated is tracked.**

Run: `git status --short --ignored | grep -E '\.env$|node_modules|dist'`
Expected: each listed path is marked `!!` (ignored). No `.env` appears
without `!!`.

- [x] **Step 9: Update this plan.** Tick every box, update the Progress table,
  and set the Status to `Complete` if Step 6 ran, otherwise
  `Complete except the database-backed tests, which CI runs`. Update
  `docs/plans/README.md` to match, then re-run `npm run docs:check`.

---

## Acceptance

The plan is complete when every box below is checked.

- [x] `npm run typecheck` passes for both services
- [x] `npm run lint` passes for both services
- [x] `npm run arch:check` passes, and fails for a domain file importing Drizzle
  and for a presentation file importing infrastructure
- [x] `npm run test:unit` passes
- [x] `npm run docs:check` passes
- [x] `npm run build` produces `backend/dist/main.js` and `frontend/dist/sw.js`
- [x] The database-backed tests pass (locally in Phase 8 Step 6, or in CI)
- [x] `GET /api/v1/tools` and `POST /api/v1/tools` behave as the HTTP surface table says
- [ ] The Tools page lists tools grouped by category and creates one
- [ ] The built app is installable and serves its shell offline; `/api/` is never served from cache

## Follow-ups

- Staff authentication — plan to be written; nothing may be exposed outside
  the internal network before it ships
- Visual identity: `DESIGN.md` tokens and the app icon — decision to be written
- Deployment and release, including `Cache-Control: no-cache` for `sw.js` and
  `index.html` — plan to be written
- A remote repository and the first commit — the owner's call

# s1-gateway

**Source One Global's Gateway** — the internal staff hub: one place to reach
the applications and links staff use every day.

---

## Quick start

Requires Node 22 or 24, Docker Desktop, and npm.

```bash
npm run setup        # env files, git hooks, dependencies for both services
npm run db:up        # Postgres in Docker, host port 5436
npm run db:migrate

npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:5173   (second terminal)
```

Full walkthrough and troubleshooting:
[docs/getting-started/local-setup.md](./docs/getting-started/local-setup.md)

---

## Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL 17 |
| API | Express 5 + TypeScript 6, Drizzle ORM, zod, Pino |
| Web | React 19 + TypeScript 6, Vite, Tailwind CSS 4, TanStack Query, Axios, React Router |
| PWA | vite-plugin-pwa (Workbox) |
| Tests | Vitest, supertest, Testing Library |
| Lint and architecture | oxlint, dependency-cruiser |

Both services follow **Clean Architecture**, with the dependency rule checked
by `npm run arch:check` rather than left to review — see
[ADR 0003](./docs/decisions/0003-clean-architecture-with-layers-inside-modules.md).

---

## Layout

```
s1-gateway/
├── docs/              Developer documentation — start here
├── backend/           Express API
├── frontend/          React SPA and PWA (see frontend/DESIGN.md)
├── scripts/           Repository tooling
├── .githooks/         commit-msg and pre-push hooks
└── docker-compose.yml Local Postgres
```

---

## Documentation

Organised by purpose — see [docs/README.md](./docs/README.md) for the map.

| | |
|---|---|
| [Getting started](./docs/getting-started/) | Get it running |
| [Guides](./docs/guides/) | How to do a specific task |
| [Reference](./docs/reference/) | API, data model, environment, commands |
| [Explanation](./docs/explanation/) | Architecture, and the constraints that shape it |
| [Decisions](./docs/decisions/) | Why we chose what we chose |
| [Plans](./docs/plans/) | Step-by-step build plans with checklists |
| [Design system](./frontend/DESIGN.md) | Tokens and UI rules |

---

## Current state

Working end to end:

- **Health** — `GET /api/v1/health`
- **Tools** — list the internal apps and links, grouped by category, and add
  one; names are unique ignoring case
- **PWA** — installable, opens instantly and offline from a cached shell,
  says plainly when it cannot reach the server, and offers new versions with a
  Reload prompt

Not built yet:

- **Authentication** — nothing is access-controlled, so **do not expose this
  outside the internal network** ([constraints](./docs/explanation/constraints.md))
- **Deployment** — no hosting or release procedure yet
- **Visual identity** — colours and the icon are neutral placeholders

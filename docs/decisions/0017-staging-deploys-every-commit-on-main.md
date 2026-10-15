# 0017. Staging deploys every commit on `main`: Vercel, Render and Supabase

- **Status:** Accepted
- **Date:** 2026-10-16
- **Related:** [0005](./0005-migrations-over-db-push.md) ·
  [0010](./0010-the-app-shell-is-cached-api-responses-never-are.md) ·
  [0016](./0016-the-repository-lives-in-the-s1-global-organisation.md) ·
  [Deploy to staging](../guides/deploy-to-staging.md)

## Context

Nothing the Gateway builds has run anywhere but a laptop. A shared staging
copy lets the team try each merged change, on real hosting, before anything
is released. Production is out of scope here and gets its own decision.

The hosting accounts belong to `reyxdz-s1`, not to reyxdz
([0016](./0016-the-repository-lives-in-the-s1-global-organisation.md)), and
all three services are on free plans.

Two constraints shape the pipeline:

- **A migration must land before the code that needs it.** Render's
  auto-deploy starts the new API the moment `main` moves, with no way to run
  a step first on the free plan (its pre-deploy command is for paid
  instances).
- **Supabase's direct connection is IPv6 only.** Render and GitHub's runners
  connect over IPv4, so both go through Supabase's session pooler.

## Decision

| Piece | Where | Deploys |
|---|---|---|
| Frontend | Vercel project `s1-gateway-staging`, root `frontend/` | By Vercel, on every push to `main` |
| API | Render web service `s1-gateway-staging-api`, root `backend/` | By the **Deploy staging** workflow |
| Database | Supabase project `s1-gateway-staging`, Singapore | Migrated by the **Deploy staging** workflow |

**Deploy staging** (`.github/workflows/deploy-staging.yml`) runs when CI
passes on a push to `main`. It applies pending migrations to the staging
database with `drizzle-kit migrate`, then calls Render's deploy hook with that
commit. Render's auto-deploy is off. Deploys run one at a time, never
cancelled, so migrations apply in order.

**The frontend and the API share one address.** `frontend/vercel.json`
forwards `/api/*` to the Render service, so the browser only ever talks to
the Vercel domain: no `VITE_API_URL`, no cross-origin requests, and the
service worker's existing rule of never caching `/api/`
([0010](./0010-the-app-shell-is-cached-api-responses-never-are.md)) still
holds. Every other path falls back to `index.html`, so a page opened directly
or refreshed loads instead of returning a 404.

**Secrets live in two places only.** The API's variables are set on Render.
The workflow's two secrets, `STAGING_DATABASE_URL` and
`RENDER_STAGING_DEPLOY_HOOK`, are environment secrets of the GitHub
environment `staging`, which only `main` can deploy to. Supabase's Data API is
off: the app reaches Postgres directly, so nothing else should expose its
tables.

## Alternatives considered

**Render auto-deploy, with migrations at startup.** Simplest, but a failing
migration would crash-loop the API, and two instances starting together
would race the same migration.

**Migrations from a developer's machine.** Easy to forget, and it needs the
staging password on laptops.

**Supabase's GitHub integration.** It applies migrations from a
`supabase/migrations` folder, written in its own format. The repository's
migrations are Drizzle's ([0005](./0005-migrations-over-db-push.md)), and two
tools applying migrations to one database is how they drift.

**`VITE_API_URL` pointing straight at Render.** Works, but every request
becomes cross-origin, `CORS_ORIGIN` must track each Vercel domain, and
preview deployments would need their own entries.

## Consequences

- A merge reaches staging in a few minutes, with no one releasing it.
- The frontend can go live a minute or two before the API. Migrations must
  stay additive ([change the database schema](../guides/change-the-database-schema.md)),
  which they already must.
- A failed migration stops the deploy: the API stays on the previous commit,
  and the workflow run shows why.
- Free plans: the Render service sleeps after 15 idle minutes, so the first
  request takes about a minute; Supabase pauses a project after a week
  without activity. Acceptable for staging, not for production.
- Vercel's preview deployments for pull requests also forward `/api/*` to
  staging, so a preview reads and writes staging data.
- The Render address is in `frontend/vercel.json`. Renaming or replacing the
  service means changing that file.

# Environment variables

Each service reads `.env` in its own directory; `npm run setup` creates them
from `.env.example`. Never commit a `.env`. A new variable goes into the
matching `.env.example` with a safe placeholder, and into this page.

## Backend — `backend/.env`

Validated once at boot by `backend/src/shared/infrastructure/config/env.ts`.
A missing or invalid value stops the process with the variable's name.

| Variable | Default | Meaning |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` or `production`. In `development`, logs are pretty-printed |
| `PORT` | `4000` | Port the API listens on |
| `LOG_LEVEL` | `info` | Pino level: `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |
| `DATABASE_URL` | — (required) | `postgres://` or `postgresql://` URL. Locally `postgres://s1gateway:s1gateway@localhost:5436/s1_gateway` |
| `CORS_ORIGIN` | `http://localhost:5173` | The SPA's origin, allowed by CORS |
| `ACCOUNT_ADMIN_EMAILS` | — (required) | Comma-separated `@sourceone.global` addresses that may invite staff, and approve, disable and reset accounts. `npm run db:create-admin` accepts only these. Trimmed and lower-cased at boot. Every entry must match `/^[^@]+@sourceone\.global$/` or the API refuses to start |

### `npm run db:create-admin` only

| Variable | Default | Meaning |
|---|---|---|
| `ADMIN_PASSWORD` | — (required by the command) | The new admin's password, at least 12 characters. Set it for that one run (`ADMIN_PASSWORD=… npm run db:create-admin -- …`); never leave it in `.env`. The API never reads it |

### Tests only

| Variable | Default | Meaning |
|---|---|---|
| `TEST_DATABASE_URL` | `postgres://s1gateway:s1gateway@localhost:5436/s1_gateway_test` | Database for `npm test`. Its name must end in `_test`; the test setup refuses anything else |

## Frontend — `frontend/.env`

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `/api/v1` | Base URL for API requests. Leave unset in development — Vite proxies `/api` to :4000. Baked in at build time |

### Build time

| Variable | Default | Meaning |
|---|---|---|
| `PWA_SELF_DESTROY` | unset | `true` builds a service worker that removes itself. See [Turn off the service worker](../guides/turn-off-the-service-worker.md) |

## Staging

Values are set in each host's dashboard, never in the repository. Where each
one lives, and how to change it: [Deploy to staging](../guides/deploy-to-staging.md).

| Variable | Set on | Value |
|---|---|---|
| `NODE_ENV` | Render | `production` |
| `LOG_LEVEL` | Render | `info` |
| `DATABASE_URL` | Render | Supabase's session pooler URL, port 5432, ending `?sslmode=require` |
| `CORS_ORIGIN` | Render | The Vercel staging address |
| `ACCOUNT_ADMIN_EMAILS` | Render | Your `@sourceone.global` admin address(es), comma-separated |
| `PORT` | — | Set by Render; do not set it |
| `VITE_API_URL` | — | Leave unset. `frontend/vercel.json` forwards `/api/*` to Render, so the default `/api/v1` works |

The **Deploy staging** workflow reads two secrets from the GitHub environment
`staging`:

| Secret | Value |
|---|---|
| `STAGING_DATABASE_URL` | The same URL as Render's `DATABASE_URL` |
| `RENDER_STAGING_DEPLOY_HOOK` | Render → the service → **Settings** → **Deploy Hook** |

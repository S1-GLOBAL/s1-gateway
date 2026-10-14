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

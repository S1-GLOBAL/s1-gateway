# Deploy to staging

Staging runs whatever is on `main`. Merging a pull request is the deploy:
there is nothing to run by hand. This guide covers following a deploy, fixing
one that failed, and setting staging up again from nothing. The reasoning is
[ADR 0017](../decisions/0017-staging-deploys-every-commit-on-main.md).

| Piece | Service | Account | Name |
|---|---|---|---|
| Frontend | Vercel | team **SOG** | project `s1-gateway-staging` |
| API | Render | `reyxdz-s1`'s workspace | web service `s1-gateway-staging-api` |
| Database | Supabase | organization **SOG** | project `s1-gateway-staging` |

---

## What happens on a merge

1. **Vercel** builds `frontend/` and publishes it. This starts at once.
2. **CI** runs on `main`.
3. When CI passes, **Deploy staging** runs:
   1. `drizzle-kit migrate` applies any new migration to the staging database.
   2. Render's deploy hook starts a deploy of that exact commit.
4. **Render** builds `backend/`, waits for `/api/v1/health` to answer, then
   switches traffic to the new version.

From merge to both halves live takes about five minutes.

## Follow a deploy

| To see | Go to |
|---|---|
| The pipeline | GitHub → `S1-GLOBAL/s1-gateway` → **Actions** → **Deploy staging** → the run for your commit |
| The API's build and start | Render → `s1-gateway-staging-api` → **Events**, then **Logs** |
| The frontend's build | Vercel → team SOG → `s1-gateway-staging` → **Deployments** |
| The database | Supabase → org SOG → `s1-gateway-staging` → **Table Editor** (schema `public`); applied migrations are in schema `drizzle`, table `__drizzle_migrations` |

## When it fails

| What failed | Means | Do |
|---|---|---|
| **Deploy staging** did not run | CI failed or was cancelled on that commit; a newer push cancels an older CI run | Fix CI. A newer commit deploys everything before it |
| **Migrate the staging database** | The migration is wrong for the data, or the database is unreachable | Read the step's log. Unreachable: check the Supabase project is not paused (Supabase → project → **Restore**). A bad migration: fix it in a new pull request — never edit one that has shipped ([ADR 0005](../decisions/0005-migrations-over-db-push.md)) |
| **Deploy the API on Render** | The deploy hook was refused | The hook was regenerated or the service deleted. Update the secret (below) and re-run the job |
| Render's build or health check | The code does not start with staging's settings | Render keeps the previous version live. Read **Logs**; a missing or invalid variable is named there |

**Re-run a deploy:** Actions → **Deploy staging** → the run → **Re-run all
jobs**. It is safe: a migration that already applied is skipped.

Do not use Render's **Manual Deploy** for a commit whose migration has not run;
it would start code ahead of its database.

## Change a secret

| Secret | Set in | Used by |
|---|---|---|
| `DATABASE_URL` | Render → `s1-gateway-staging-api` → **Environment** | The API |
| `STAGING_DATABASE_URL` (same value) | GitHub → Settings → **Environments** → `staging` → Environment secrets | The migration step |
| `RENDER_STAGING_DEPLOY_HOOK` | GitHub, same place | The deploy step |

After changing the database password in Supabase, update **both** database
URLs. Only a repository admin can edit GitHub's environment secrets. Pass
values through a password manager, never through chat.

---

## Set staging up from nothing

Use the names above, and the same region, **Southeast Asia (Singapore)**, for
Supabase and Render.

### 1. Supabase

1. **New project** in organization SOG. Generate a password and keep it in a
   password manager.
2. Security: **Enable Data API** off, **Automatically expose new tables** off,
   **Enable automatic RLS** on. Leave GitHub empty.
3. **Connect** → **Session pooler**. Put the password in (URL-encode symbols),
   and add `?sslmode=require`. Port **5432**, not 6543. This is the staging
   database URL.

### 2. Render

**New** → **Web Service** → GitHub → `S1-GLOBAL/s1-gateway`.

| Field | Value |
|---|---|
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/v1/health` |
| Auto-Deploy | **Off** |
| Environment | `NODE_ENV=production`, `LOG_LEVEL=info`, `DATABASE_URL`, `CORS_ORIGIN` = the Vercel address |

`--include=dev` matters: with `NODE_ENV=production`, npm skips TypeScript and
the build fails. Render sets `PORT` itself. After it is created, copy
**Settings** → **Deploy Hook**.

### 3. GitHub

`S1-GLOBAL/s1-gateway` → **Settings** → **Environments** → **New environment**
→ `staging`. **Deployment branches and tags** → **Selected branches** → `main`.
Add the environment secrets `STAGING_DATABASE_URL` and
`RENDER_STAGING_DEPLOY_HOOK`.

### 4. Vercel

**Add New** → **Project** → GitHub account **S1-GLOBAL** → `s1-gateway`.
Root Directory `frontend`, preset **Vite**, no environment variables. Keep
**Include files outside the root directory** on: the build reads the API's
types from `backend/src/contracts`.

### 5. Point the frontend at the API

If the Render address changed, update the `/api/:path*` destination in
`frontend/vercel.json` in a pull request. Merging it runs the whole pipeline
once, which also creates the tables in a new database.

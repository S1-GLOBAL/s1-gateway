# Local setup

From a fresh clone to the Tools page running against a local database.

## Requirements

- **Node 22 or 24** — `node --version`. These are the versions both
  `package.json` files declare and CI runs (24).
- **npm** — comes with Node.
- **Docker Desktop** — for Postgres.
- **Git.**

## Steps

From the repository root:

```bash
npm run setup        # .env files, git hooks, dependencies for both services
npm run db:up        # Postgres 17 in Docker, on host port 5436
npm run db:migrate   # create the tables
npm run dev:api      # http://localhost:4000
```

In a second terminal:

```bash
npm run dev:web      # http://localhost:5173
```

`npm run setup` never overwrites an existing `.env`. If you already have one,
compare it with `.env.example` yourself.

There is no sign-up page: accounts are created by invite. Create yourself an
admin first, with an address listed in `ACCOUNT_ADMIN_EMAILS` in
`backend/.env` and a password of at least 12 characters:

```bash
ADMIN_PASSWORD='…' npm run db:create-admin -- --email admin@sourceone.global --first-name Ada --last-name Admin
```

Sign in with it, then invite anyone else from the Accounts page.

## Check it works

```bash
curl http://localhost:4000/api/v1/health
```

answers `{"data":{"status":"ok"}}`. Open <http://localhost:5173>: the Tools
page loads, says there are no tools yet, and adding one shows it under its
category.

## Troubleshooting

**Port 5436 is in use.** Another container or a local Postgres has it. Stop
it, or change the host port in `docker-compose.yml` and in `DATABASE_URL` in
`backend/.env` together.

**The API exits with `Invalid environment`.** It names the variable. Compare
`backend/.env` with `backend/.env.example`; the full list is in the
[environment reference](../reference/environment.md).

**Tests say `Cannot reach Postgres`.** `npm test` needs the database. Run
`npm run db:up`, or run `npm run test:unit`, which needs nothing.

**The page shows "Cannot reach the server".** The API is not running on
:4000. Vite proxies `/api` to it in development.

## Stopping

```bash
npm run db:down      # stops Postgres; data is kept in a Docker volume
npm run db:reset     # stops it and deletes the data
```

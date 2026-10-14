# 0005. Generated migrations over `db:push`

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Drizzle offers two ways to change the schema: `drizzle-kit push`, which diffs
the schema against a live database and applies the difference directly, and
`drizzle-kit generate`, which writes a SQL migration file to be applied later.

## Decision

Every schema change goes through `npm run db:generate`, producing SQL in
`backend/drizzle/` that is read, committed and applied with
`npm run db:migrate`. `drizzle-kit push` is never used, against any database.

A migration that has been shipped is never edited. A correction is a new
migration.

## Alternatives considered

**`push` in development, migrations in production.** Two paths means the
development database drifts from what the migrations produce, and the first
time the migrations run for real is in production.

## Consequences

Every change is reviewable as SQL in a pull request and repeatable in CI,
staging and production. The cost is one extra command and a file to read per
schema change — reading it is the point.

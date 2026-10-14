# 0008. Testing strategy

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Clean Architecture ([0003](./0003-clean-architecture-with-layers-inside-modules.md))
makes most of the system testable without infrastructure. What remains — SQL,
unique indexes, the real wiring — can only be proven against a real database.

## Decision

| What | Where | Database |
|---|---|---|
| Entity invariants, pure rules | `domain/*.test.ts` | none |
| Use cases, with in-memory fakes of the ports | `application/*.test.ts` | none |
| HTTP mapping, with real use cases over the in-memory repository | `presentation/*.test.ts` via supertest | none |
| Drizzle repositories | `infrastructure/*.db.test.ts` | real Postgres |
| The whole app, as composed | `backend/src/compose.db.test.ts` | real Postgres |
| Frontend domain, gateways, components | `*.test.ts(x)` with happy-dom | none |

`npm run test:unit` runs everything except `*.db.test.ts` and needs nothing
running. `npm test` runs everything; the backend's global setup creates and
migrates the test database first.

Database tests run against real Postgres, never a mock. They refuse to run
against any database whose name does not end in `_test`, because they
truncate tables between cases. Test files run one at a time, since they share
that database.

Fakes of ports live in a `testing/` folder beside the port they implement and
are excluded from the production build.

## Alternatives considered

**Mock the database.** A mocked unique index proves nothing about the real
one, and case-insensitive uniqueness is exactly the kind of rule that only
the database can enforce.

**Only end-to-end tests.** Slow, and a failure points at the whole stack
rather than the rule that broke.

## Consequences

Most tests run in well under a second with no setup. Database tests need
`npm run db:up` locally; CI runs them against a Postgres service container.

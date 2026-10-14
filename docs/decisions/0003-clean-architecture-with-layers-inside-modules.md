# 0003. Clean Architecture with layers inside modules

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** [0004](./0004-layer-rules-are-enforced-by-dependency-cruiser.md) ·
  [architecture](../explanation/architecture.md)

## Context

The owner required Clean Architecture from the start. That is worth stating
plainly, because the sister project Bilikha — same stack, same author —
rejected it in its own ADR 0014 as over-engineering for a CRUD workload: an
interface and a mapper per entity to guard against swapping a database nobody
intended to swap, and a small team that would route around it within a month.

Two things differ here. A gateway is expected to front several internal
systems, so swapping or adding an adapter behind a port is a realistic event
rather than a hypothetical one. And the rules are enforced by a check
([0004](./0004-layer-rules-are-enforced-by-dependency-cruiser.md)), which
removes the "team routes around it" risk Bilikha named.

## Decision

Every backend module and every frontend feature has four layers. Dependencies
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
| `application` | its own `domain` and `application`, `shared/domain`, `shared/application` | `infrastructure`, `presentation`, any npm package, any Node built-in |
| `infrastructure` | inward layers, `shared/infrastructure`, npm packages | any `presentation` |
| `presentation` | inward layers, `shared/presentation`, `contracts`, npm packages | any `infrastructure` |

**Frontend**

| Layer | May import | Must not import |
|---|---|---|
| `domain` | its own feature's `domain`, `shared/domain` | any other layer, any npm package |
| `application` | inward layers, `shared/application`, `react`, `@tanstack/react-query` | `infrastructure`, `presentation`, any other npm package |
| `infrastructure` | inward layers, `shared/infrastructure`, `@contracts/*`, npm packages | any `presentation` |
| `presentation` | inward layers, `shared/ui`, `shared/application` | any `infrastructure`, `axios`, `@contracts/*` |

The layers live **inside** each module (`backend/src/modules/<name>/`) and
feature (`frontend/src/features/<name>/`), so one change stays in one folder.
A module or feature is reached from outside only through its `index.ts`.

Adapters meet use cases only in composition roots: `backend/src/main.ts`,
`backend/src/compose.ts` and each module's `index.ts`; `frontend/src/app/` and
each feature's `index.ts`. Dependency injection is constructor arguments and
React context, by hand.

## Alternatives considered

**Global layers** — `domain/`, `application/`, `infrastructure/`,
`presentation/` at the top, each holding every feature. The textbook layout,
and it spreads one feature across four distant folders, so every change is a
tour of the tree.

**Bilikha's light modular monolith** — routes, a zod schema and a service per
feature, with Drizzle as the data layer. Fewer files, and database types leak
into services and responses. Rejected because the owner required Clean
Architecture and the gateway's integrations make ports worth having.

**A DI container.** Constructor arguments wired in one file are explicit,
greppable and typed. A container adds indirection this size does not need.

## Consequences

**Good.** Domain rules and use cases are tested with no database and no HTTP.
Database and wire types never leak past their adapters. Adding a second
adapter behind a port — another system the gateway fronts — touches
infrastructure and one composition root, nothing else.

**Bad.** More files per feature: an entity, a port, a use case, a DTO, a
mapper, an adapter, a controller. The example `tools` module is the template;
copy its shape rather than inventing one.

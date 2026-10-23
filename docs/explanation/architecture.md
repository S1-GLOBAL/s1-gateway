# Architecture

Why the system is shaped this way. For *how to change it*, see the
[guides](../guides/); for exact names and values, see the
[reference](../reference/).

---

## Two services, one repository

```
          browser  (installed PWA or tab)
             │
   ┌─────────┴──────────┐
   │  React SPA (Vite)  │   :5173 dev — shell precached by a service worker
   └─────────┬──────────┘
             │  /api/v1  (Vite proxies in dev)
   ┌─────────┴──────────┐
   │  Express 5 API     │   :4000
   └─────────┬──────────┘
             │  Drizzle
   ┌─────────┴──────────┐
   │  PostgreSQL 17     │   :5436 locally
   └────────────────────┘
```

The frontend never talks to Postgres. The backend serves no HTML. One pull
request can change an endpoint and its consumer, and the type-only contracts
keep the two in agreement
([ADR 0007](../decisions/0007-one-definition-of-an-api-shape.md)).

---

## The dependency rule

Both services follow Clean Architecture
([ADR 0003](../decisions/0003-clean-architecture-with-layers-inside-modules.md)),
with the layers inside each module or feature:

```
presentation ──┐
               ├──▶ application ──▶ domain
infrastructure ┘
```

- **Domain** is the business: entities, their rules, and the ports
  (interfaces) the business needs from the outside world. It imports nothing
  outside itself, so the rules can be read and tested without a framework in
  sight.
- **Application** is what the system does: one use case per operation,
  talking to the world only through ports. On the backend it imports no
  package at all. On the frontend it may use React and TanStack Query — hooks
  are how a React app delivers its use cases — but never Axios or the wire
  format.
- **Infrastructure** implements ports: Drizzle repositories on the backend,
  HTTP gateways on the frontend. It is the only place a database row or an API
  response shape is known.
- **Presentation** is the delivery mechanism: Express controllers and routes
  on the backend, React components on the frontend.

Infrastructure and presentation never import each other. They meet only in a
**composition root** — `backend/src/main.ts`, `backend/src/compose.ts` and
each module's `index.ts`; `frontend/src/app/` and each feature's `index.ts` —
where adapters are constructed and handed to use cases by constructor (or, on
the frontend, by React context).

**Each restriction exists for a reason.** Domain purity keeps the rules
testable in milliseconds. Application's independence from Express and Drizzle
means a use case can be called from a route, a script or a queue consumer
unchanged. Presentation's ban on infrastructure stops a controller from
reaching past the use case into the database. The frontend presentation's ban
on contracts means a component cannot break when the wire format changes; the
gateway absorbs it.

All of it is checked by `npm run arch:check`
([ADR 0004](../decisions/0004-layer-rules-are-enforced-by-dependency-cruiser.md)).

---

## Request lifecycle

`POST /api/v1/tools` with `{ "name": "Payroll", "url": "https://…", "category": "Finance" }`:

1. **Middleware** in `createApp`, in order — `helmet`, `cors` (one allowed
   origin), `compression`, JSON parsing (100 kB limit), `pino-http` (one log
   line per request, with the `cookie`, `set-cookie`, `authorization` and
   `x-vercel-proxy-signature` headers written as `[Redacted]`).
2. **Router** — `/api/v1` → the `tools` module's router → `controller.create`.
3. **Controller** — `parseBody` checks the body's *shape* against a zod
   schema typed by the contract. A wrong shape throws `HttpError` 400.
4. **Use case** — `CreateTool` asks `Tool.create` for an entity, with an id
   from the `IdGenerator` port and a time from the `Clock` port.
5. **Domain** — `Tool.create` trims every field and checks every rule,
   returning all the broken ones at once as `InvalidToolError`.
6. **Repository** — `DrizzleToolRepository.add` inserts the row. A unique
   violation on `lower(name)` comes back as `ToolNameTakenError` — the
   database, not a prior lookup, decides, so two simultaneous requests cannot
   both win.
7. **Back out** — the use case returns a `Result`; the controller maps a
   failure's `code` to a status and throws `HttpError`, or sends
   `201 { data: tool }`.

**The error path.** Every throw ends in the error handler — Express 5
forwards rejected promises by itself, so there is no `asyncHandler`. An
`HttpError` is rendered as-is; a JSON parse failure becomes 400
`MALFORMED_JSON`; anything else is a bug, logged in full and answered with a
bare 500 `INTERNAL_ERROR`. The client sees one error shape, always.

**Environment is validated at boot**, not at use: a bad `DATABASE_URL` stops
`main.ts` with the variable's name, rather than surfacing inside a request.

---

## The frontend

```
pages/<name>/   a page and its skeleton — composition only
features/<name>/{domain,application,infrastructure,presentation}
shared/ui/      primitives and animated icons, no domain knowledge
app/            providers, routes, the shell, the PWA's prompt and banner
```

**The shell never moves between its own pages.** `app/shell/` draws the sidebar, the top
bar and the phone's bottom bar once. Only the content region changes between
those pages, with a short fade
([ADR 0012](../decisions/0012-motion-and-animated-icons.md)).
Crossing the signed-out door — the landing, sign-in, registration, and
entering or leaving the hub — is a full-screen curtain
([ADR 0028](../decisions/0028-the-door-is-a-full-screen-curtain.md)).
A cold open of the landing or an invite link keeps that curtain up until
the session or the invite has arrived.
The routes table, `app/routes.tsx`, is the one place a page is registered,
lazily, with its skeleton.

**Loading is a skeleton of the page; failure is a sentence.** Pages read data
with suspense queries, so one `Suspense` per route covers code and data, and
one error boundary per route turns any failure into `ErrorState` with Try
again ([ADR 0013](../decisions/0013-loading-states-are-page-shaped-skeletons.md)).

**The theme is a feature like any other.** `features/appearance` owns the
preference (domain), its ports and `useTheme` (application), `localStorage`
and the `<html>` attribute (infrastructure), and the switch (presentation)
([ADR 0011](../decisions/0011-visual-identity.md)).

**Server state belongs to TanStack Query.** Fetched data lives in the query
cache under a key from the feature's key factory; copying it into
`useState` makes a second source of truth that goes stale.

**Every failure is an `AppError`.** The gateway converts timeouts, lost
connections and API errors into one shape, so a component shows
`error.message`, and `error.fields[name]` beside the input it concerns,
without knowing the cause.

**The PWA caches the shell, never the data**
([ADR 0010](../decisions/0010-the-app-shell-is-cached-api-responses-never-are.md)).
The app opens instantly and offline; data always comes from the network, and
when it cannot, the page says so.

---

## What is deliberately absent

| Not here | Why |
|---|---|
| A DI container | Constructor arguments wired in one file are explicit and typed. A container adds indirection this size does not need |
| An `Entity` base class, value objects for every field | Nothing shares behaviour yet. Add one when two entities need the same thing |
| Redis | Nothing to cache or queue yet |
| GraphQL | A handful of endpoints with predictable shapes |
| Microservices | One product, one team, one deployable pair |
| Server-side rendering | An internal tool behind a sign-in has no SEO need ([ADR 0002](../decisions/0002-pern-with-client-rendered-spa.md)) |

Each is a real option later. None is justified now, and each adds something
someone has to run.

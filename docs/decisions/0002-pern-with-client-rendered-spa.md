# 0002. PERN with a client-rendered SPA

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

s1-gateway is Source One Global's internal staff hub. Its users are staff,
and once authentication lands every page will sit behind a sign-in. Nothing
needs to be indexed by a search engine, and nobody shares a link that must
render a preview card in a chat app.

## Decision

PostgreSQL, Express, React and Node, all in TypeScript. The frontend is a
client-rendered single-page app built with Vite; the backend is a JSON API
under `/api/v1` that serves no HTML. Both live in one repository with two
`package.json` files, deployed independently and versioned together.

## Alternatives considered

**Next.js or another server-rendering framework.** Its payoff is SEO and
first paint for anonymous visitors. An internal tool behind a sign-in has
neither need, and it would blur the boundary between the API and the UI that
the architecture depends on.

**Separate repositories for API and web.** One pull request should be able to
change an endpoint and its consumer together, and the type-only contracts
([0007](./0007-one-definition-of-an-api-shape.md)) are imported across the two
by path. Separate repositories would need a published package between them.

## Consequences

A blank page until the JavaScript loads, which the PWA's precached shell
([0010](./0010-the-app-shell-is-cached-api-responses-never-are.md)) makes
near-instant after the first visit. If the Gateway ever gains public pages,
this decision is the one to revisit.

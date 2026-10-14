# 0007. One definition of an API shape

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** [contracts README](../../backend/src/contracts/README.md)

## Context

In Bilikha, the frontend hand-wrote its own interface for every response.
Two production bugs followed (its ADR 0037): a field computed on the server
under one name and read on the client under another, and a response that was
nested in one endpoint and flat in another, which took a whole page down. Both
compiled cleanly and passed every check, because nothing compared the two
sides.

## Decision

Every request and response shape is a TypeScript type in
`backend/src/contracts/`, declared once:

- **Types only.** No runtime code, no zod, no imports except type-only imports
  of a sibling contract.
- The backend's presentation layer annotates responses with the contract and
  validates requests with zod schemas declared `satisfies z.ZodType<Contract>`,
  so a schema that drifts from its contract fails to compile.
- The frontend imports contracts with `import type` through the `@contracts/*`
  path alias, **in infrastructure only**, and maps them into its own domain
  types. `npm run arch:check` enforces where they may be imported.

## Alternatives considered

**Share zod schemas at runtime.** The frontend would bundle code from
`backend/`, resolving `zod` from the backend's `node_modules`. Fragile, and it
couples the two builds.

**Generate a client from OpenAPI.** A toolchain, a generated directory and a
spec to maintain, for a handful of endpoints.

## Consequences

Rename a field in a contract and both sides fail to compile until they agree.
The contracts carry no runtime validation of responses on the frontend; the
backend's types are trusted at the boundary.

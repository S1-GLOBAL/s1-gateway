# 0020. Atlas is built in TypeScript in the Gateway

- **Status:** Accepted
- **Date:** 2026-10-16
- **Related:** [Issue #4](https://github.com/S1-GLOBAL/s1-gateway/issues/4) ·
  [ADR 0002](./0002-pern-with-client-rendered-spa.md) ·
  [ADR 0003](./0003-clean-architecture-with-layers-inside-modules.md) ·
  [ADR 0019](./0019-the-s1-spec-id-format.md)

## Context

Atlas began as a Python package. It holds the retired A1 encoder and the
reference for the rules S1 keeps: codes decodable through a versioned
dictionary, published meanings never reused, never guessing, the three search
outcomes, and per-factory evidence. The S1 specification retires the A1
encoder and says the S1 encoder is built in the Source One hub. The Gateway is
that hub, and it is a TypeScript application on Postgres
([ADR 0002](./0002-pern-with-client-rendered-spa.md)).

## Decision

Atlas is built in TypeScript inside the Gateway, as the backend module
`backend/src/modules/atlas/` and the frontend feature
`frontend/src/features/atlas/`, following the layers of
[ADR 0003](./0003-clean-architecture-with-layers-inside-modules.md). The S1
encoder and decoder are pure functions in the module's domain layer, with no
npm packages.

The Python Atlas package is an offline reference only. No Python runs in the
Gateway: none is called, deployed or copied into this repository.

## Alternatives considered

**Call the Python package from the Gateway**, as a service or a subprocess.
Its encoder is the retired A1 one, so there is no S1 encoder to call; and it
would add a second runtime to build, deploy and keep running beside the
Gateway's one.

## Consequences

The S1 rules have one implementation, tested in this repository's own suite
and deployed with the Gateway. Where the Python package and the Gateway
disagree about S1, [ADR 0019](./0019-the-s1-spec-id-format.md) decides. Rules
that only the Python package implements today, such as the search outcomes,
are rebuilt here when their own issues come up, not imported.

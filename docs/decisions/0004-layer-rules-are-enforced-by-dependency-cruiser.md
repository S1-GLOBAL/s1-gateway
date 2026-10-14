# 0004. Layer rules are enforced by dependency-cruiser

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** [0003](./0003-clean-architecture-with-layers-inside-modules.md)

## Context

A dependency rule that only lives in a document is a suggestion. Bilikha's
ADR 0014 said it outright: "Boundary discipline is convention, not
compilation. Nothing stops a module importing another's internals except
review." Clean Architecture without enforcement decays into the same thing
with more folders.

## Decision

The rules in [0003](./0003-clean-architecture-with-layers-inside-modules.md)
are written as dependency-cruiser rules in `backend/.dependency-cruiser.cjs`
and `frontend/.dependency-cruiser.cjs`. `npm run arch:check` runs both. It runs
in the pre-push hook and in CI, and a violation fails the build.

Type-only imports count (`tsPreCompilationDeps: true`): a domain file that
imports a Drizzle *type* is as much a violation as one that imports Drizzle.

Three rules close the ways around the layer rules:

- **`only-layer-folders`** — code inside a module, a feature or `shared/`
  lives in one of its layer folders (or a module's `index.ts`). Without it, a
  `helpers/` folder would sit outside every rule and could relay an import
  from presentation to infrastructure.
- **`test-doubles-only-in-tests`** — nothing outside a `testing/` folder
  imports from one, so a fake cannot reach production.
- **`pages-not-to-infrastructure`** — frontend pages compose features; they
  never touch Axios, the HTTP client or the contracts.

Each rule was proven by a file that broke it and was caught.

## Alternatives considered

**Review only.** Works until the first busy week.

**An ESLint boundaries plugin.** The project lints with oxlint, as Bilikha
does, and oxlint cannot express layer rules. Adding ESLint alongside it for
one rule set would mean two linters and two configurations.

**TypeScript project references per layer.** Enforces direction at compile
time, at the cost of a `tsconfig` per layer per module. Too much ceremony for
the same guarantee.

## Consequences

A rule that fails names itself (`domain-is-pure`, `presentation-not-to-infrastructure`)
and the offending import, so the fix is obvious. Never weaken a rule to make a
change pass; if a rule is wrong, change it in a pull request that says why.

dependency-cruiser parses TypeScript through the compiler API, which
TypeScript 7 does not ship. **Both services stay on TypeScript 6** until
dependency-cruiser supports 7.

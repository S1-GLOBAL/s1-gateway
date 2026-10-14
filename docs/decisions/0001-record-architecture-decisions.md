# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

s1-gateway starts with choices that will look arbitrary to whoever joins
later: Clean Architecture where a lighter structure would run, TypeScript 6
rather than 7, a service worker that caches the shell but never the data.
Without the reasoning written down, each of these is either cargo-culted or
re-argued from scratch.

## Decision

Any decision with consequences gets a short record in `docs/decisions/`,
copied from `_template.md`. Records are numbered sequentially and never
renumbered. A decision that stops being true is marked **Superseded**, with a
link to what replaced it, and is never deleted.

## Alternatives considered

**Commit messages and pull request descriptions only.** The reasoning exists
but cannot be found: nobody searches history for "why", and squash merges
flatten it.

**A single architecture document.** It becomes a description of the code as
it is, and loses the alternatives that were rejected — the part that stops a
question being reopened.

## Consequences

A few minutes per decision, and a log someone has to keep up to date. In
return, a newcomer can see why the code is shaped as it is, and a decision
that should be revisited can be, with its original reasoning in front of them.

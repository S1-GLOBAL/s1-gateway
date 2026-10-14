# 0006. Versioned API prefix from day one

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

The API has one consumer today, the SPA in this repository. A gateway tends
to gain more: scripts, other internal systems, an installed PWA running last
week's build.

## Decision

Every route is mounted under `/api/v1`. A breaking change ships as `/api/v2`
beside it, and `/api/v1` stays until its consumers have moved.

## Alternatives considered

**No prefix until it is needed.** Adding one later breaks every existing
client at once, which is the exact situation a version prefix exists to avoid.

**Version in a header.** Invisible in logs, in the browser's network tab and
in a pasted URL.

## Consequences

Five characters in every path. An installed PWA holding an old build keeps
working against `/api/v1` while a new version rolls out.

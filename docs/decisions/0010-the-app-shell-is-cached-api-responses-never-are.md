# 0010. The app shell is cached; API responses never are

- **Status:** Accepted
- **Date:** 2026-10-14
- **Related:** [Turn off the service worker](../guides/turn-off-the-service-worker.md)

## Context

The Gateway installs as a PWA. A service worker makes caching decisions
durable — that is its value and its danger. Cache the wrong thing and staff
see stale data; ship a bad worker and an ordinary reload no longer fixes it.

## Decision

- **Precache the build output only**: JS, CSS, HTML, icons. Navigations fall
  back to the cached `index.html`, so the app opens instantly and offline.
- **Never cache an API response.** `/api/` is excluded from the navigation
  fallback and there is no runtime caching, so every request for data goes to
  the network. Offline, the page says it cannot reach the server and an
  offline banner says why.
- **Updates prompt.** `registerType: 'prompt'`: a new worker waits until the
  user chooses Reload. No `skipWaiting` behind an open tab.
- **A kill switch exists before it is needed.** Building with
  `PWA_SELF_DESTROY=true` ships a worker that unregisters itself and clears
  its caches.
- **No worker in development**, so `npm run dev:web` never serves a stale cache.

## Alternatives considered

**Installable only, caching nothing** — where Bilikha stands. Safest, but
staff get the browser's offline page instead of an honest message, and a cold
start on every launch.

**Cache the tools list for offline reading.** A stale list of links is worse
than an honest "you are offline": a tool that has moved or been retired would
still be offered. Revisit if staff need to read data offline.

## Consequences

Hosting must serve `sw.js` and `index.html` with `Cache-Control: no-cache`,
or updates will not be detected. That belongs to the deployment plan.

A user who dismisses the update prompt keeps the old shell until the next
launch. The API's version prefix ([0006](./0006-versioned-api-prefix.md))
keeps that old shell working.

This is about the browser and the service worker. The API may keep data it
reads in its own memory when every request still checks that data is current:
Atlas keeps the live dictionary between requests, and reads it again whenever
the latest approved change has moved
([ADR 0032](./0032-spec-ids-are-written-tagged.md)). No response is served
from a cache.

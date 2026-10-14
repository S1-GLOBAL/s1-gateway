# 0013. Loading states are page-shaped skeletons

- **Status:** Accepted
- **Date:** 2026-10-15
- **Related:** [plan 0002](../plans/0002-visual-identity-and-motion.md) ·
  [0012](./0012-motion-and-animated-icons.md)

## Context

Switching tabs means loading the next page's code and data. On an office
network that usually takes well under 100ms; sometimes it takes seconds. A
spinner tells the user nothing about what is coming, and a skeleton that
flashes for 40ms on every click is worse than nothing.

The owner chose: show a skeleton only when loading is genuinely slow, never on
every switch.

## Decision

**Every route declares a skeleton shaped like its page** — the same grid, the
same card sizes, text bars the height of the line they stand for. It lives
next to the page and is the route's `Suspense` fallback.

**Code and data load through the same mechanism.** Pages are `lazy()`, and
read data with TanStack Query's `useSuspenseQuery`, so one `Suspense`
boundary per route covers both.

**Timing:**

- The skeleton is **invisible for its first 150ms**, through a CSS
  `animation-delay` on its fade-in — no timers, no state. A fast switch never
  shows it.
- Once shown, React 19's Suspense reveal throttling holds it for about 300ms,
  so it does not flicker away.

**Look:** blocks are `surface-sunken`; a single shimmer gradient sweeps across
all of them in sync (one fixed-position background, so blocks on the same row
light up together); blocks fade in top to bottom with a 30ms stagger. Under
reduced motion the shimmer becomes a slow opacity pulse.

**A route that fails to load** shows a calm error in the same frame — a
sentence and a Retry button — through an error boundary, never a blank page
or the router's default error screen.

## Alternatives considered

**A skeleton on every switch, held ~350ms.** Consistent, and adds a wait to
every click in a tool staff use all day. The owner rejected it.

**A top progress bar.** Says "something is loading" but not what; and it moves
the eye away from where the content will appear.

**`isPending` checks in each page.** Works, but every page re-implements the
same branch, and code-loading and data-loading need two different fallbacks.

## Consequences

A new page is not finished until it has a skeleton. Data hooks used by pages
are suspense hooks; components that should not suspend (a form submitting)
keep using mutations and normal queries.

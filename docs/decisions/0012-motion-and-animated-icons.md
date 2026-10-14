# 0012. Motion: page transitions and stroke-animated icons

- **Status:** Proposed
- **Date:** 2026-10-15
- **Related:** [plan 0002](../plans/0002-visual-identity-and-motion.md) ·
  [0013](./0013-loading-states-are-page-shaped-skeletons.md)

## Context

The owner asked for page transitions that feel deliberate, and icons that
animate part by part — each stroke doing its own thing — rather than the
whole glyph spinning or bouncing. Both are easy to overdo: motion that
performs instead of explaining, or that makes a tool used all day feel slow.

Bilikha used the browser's View Transitions API for navigation (its ADR 0034)
and lucide-animated icons on `motion` (its ADR 0047). Here the owner chose
`motion` for transitions too.

## Decision

**`motion`** (the library formerly named framer-motion) drives all
JavaScript animation. It is used through `LazyMotion` with `m.*` elements in
`strict` mode; the feature bundle (`domMax`, which the shared-layout nav
indicator needs) is a separate chunk fetched after first paint.

**Only the content region transitions.** The sidebar and top bar never move.
Exit: fade and lift 4px, 120ms. Enter: rise 8px, fade in and un-blur from
4px, 240ms. `AnimatePresence mode="wait"`, keyed on the route, with the
leaving page's element frozen so it does not re-render as the new page.

**The active nav item is marked by a lime pill** that slides between items as
a shared layout animation.

**Icons are hand-written** in `frontend/src/shared/ui/icons/`, drawn from
Lucide's paths (ISC licence) with **each stroke its own `m.*` element and its
own variant**. An icon never animates itself: the element it sits in — a nav
link, a button, a card — sets `initial="rest"`, `whileHover="active"`,
`whileFocus="active"`, and the variants propagate to the strokes. A nav icon
also plays once when its route becomes active. Nothing loops.

**Durations and easings are tokens** (`frontend/src/shared/ui/motion.ts`):
120ms, 200ms, 320ms; standard, emphasized and exit curves.

**Reduced motion is honoured** with `MotionConfig reducedMotion="user"`:
movement and blur go, opacity fades stay, icons stay still.

**The theme switch** cross-fades the whole page with the View Transitions API
where it exists, and switches instantly where it does not.

## Alternatives considered

**View Transitions for navigation, as in Bilikha.** No dependency, but the
owner chose `motion`, and it is needed anyway for the icons and the nav pill.

**lucide-animated, copied in.** Close to what is wanted, but its icons animate
on their own hover; here the parent drives them, and the set needed is twelve
icons, small enough to write and own.

**CSS-only icon animation.** Possible for some strokes, but per-stroke
variants driven by a parent's hover and by route activation are exactly what
`motion`'s variant propagation does.

## Consequences

About 30–45 kB gzip of `motion`, loaded after first paint. Every new animated
icon is written by hand, stroke by stroke — deliberate, and slower than
importing one. Any page transition longer than 320ms, or any looping
animation, is a departure from this record and needs a new one.

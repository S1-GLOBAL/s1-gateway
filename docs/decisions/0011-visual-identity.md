# 0011. Visual identity: lime as fill, olive as ink

- **Status:** Accepted
- **Date:** 2026-10-15
- **Related:** [plan 0002](../plans/0002-visual-identity-and-motion.md) ·
  [`frontend/DESIGN.md`](../../frontend/DESIGN.md)

## Context

Source One's portal uses a lime accent, `#c8f135`, on black. The Gateway needs
a light and a dark theme, and the lime behaves very differently on each:

| Pairing | Contrast |
|---|---|
| `#c8f135` on near-black `#0b0c0b` | 14.99:1 |
| near-black text on a `#c8f135` fill | 14.99:1 |
| `#c8f135` on white | **1.31:1** — unreadable |
| `#466d00` (deep olive, same hue) on white | 6.09:1 |

So the lime cannot be "the accent colour" in the usual sense on light: any
text, link or icon drawn in it disappears.

The interface is for staff who use it all day. It has to look like a
considered product, not a template: consistent, restrained, and with nothing
on screen that does not do something.

## Decision

**The accent is two tokens, not one.**

- `accent` is a **fill**: the primary button, the active nav pill, a
  selection. It is `#c8f135` on both themes, and anything on top of it uses
  `on-accent` (near-black) — 14:1 or better on both.
- `accent-ink` is the accent **as text or icon**: links, the active icon, an
  accent heading. It is `#c8f135` on dark and `#466d00` on light.

On light, lime is never text. Code that needs "accent text" uses
`text-accent-ink`; there is no `text-accent` utility in use.

**Neutrals are graphite with a faint green cast**, so the lime belongs to
them rather than shouting from flat grey. The full token table, for both
themes, is in plan 0002 and in `frontend/DESIGN.md`.

**Type is Poppins** (400, 500, 600) for everything, and **Geist Mono** for
URLs, IDs, keys and tabular numbers. Both are self-hosted through
`@fontsource`, so the installed PWA renders correctly offline and no request
goes to a font CDN.

**The theme is a preference**: System (default), Light or Dark, stored per
device in `localStorage` under `s1-gateway.theme`. An inline script in
`index.html` sets `data-theme` on `<html>` before first paint, so the wrong
theme never flashes.

**The logo** is Source One's own PNG, used as a CSS mask filled with
`currentColor`, so one file serves both themes. The PWA icon is the S mark in
lime on near-black.

## Alternatives considered

**One accent colour, darkened on light.** A darker lime fill on light reads as
a different brand, and the primary button stops matching the portal.

**Lime text on light with a dark outline or shadow.** Legible, and looks like
a workaround.

**Google Fonts.** One fewer dependency, and a font request to a third party on
every first load, which also fails offline.

**Dark only.** Simplest, but staff on bright office screens asked for nothing
of the kind, and a light theme is expected of a professional tool.

## Consequences

Every component that uses the accent has to choose fill or ink. That is one
decision per use, and it is the one that keeps the light theme legible. The
showcase at `/theme` shows each pairing's contrast, computed live, so a token
change that breaks contrast is visible at once.

Poppins is wide; body text is 14px and headings are tracked tighter, or large
sizes sprawl.

# 0002. Visual identity, motion and the app shell

- **Status:** Ready
- **Owner:** Rey Denzo
- **Related:** [plan 0001](./0001-project-scaffold.md) ·
  [ADR 0003](../decisions/0003-clean-architecture-with-layers-inside-modules.md) ·
  [ADR 0010](../decisions/0010-the-app-shell-is-cached-api-responses-never-are.md)

## Goal

At the end of this plan the Gateway has its own look: a light and a dark
theme built around Source One's lime `#c8f135`, Poppins type, the Source One
logo, a collapsible sidebar shell, page transitions, icons that animate stroke
by stroke, and skeletons shaped like the page they stand in for. A `/theme`
screen shows all of it in one place. It reads as the work of a senior product
designer and frontend developer: restrained, consistent, and nothing on screen
that does not do something.

## Scope

**In scope**
- Design tokens for both themes, typography, radius, elevation and motion
- A theme preference (System / Light / Dark), remembered per device, applied
  before first paint
- The Source One logo, as a theme-aware mask; a new PWA icon from its mark
- The app shell: collapsible sidebar, icon rail, phone bottom bar, top bar
- Page transitions and the sliding active-nav indicator, with `motion`
- A hand-written set of stroke-animated icons
- Page-shaped skeletons with a synchronised shimmer and timing rules
- The Tools page restyled; the `/theme` showcase screen
- ADRs 0011–0013, a rewritten `frontend/DESIGN.md`, an updated architecture rule

**Out of scope** — and where it is handled instead
- Search, notifications, a user menu or avatar — none of them exist yet, so
  none are drawn. Each arrives with the feature that makes it real
- Authentication — its own plan
- Charts and data-visualisation colours — when there is data to chart

---

## Design

### Principles

1. **Nothing decorative that does not do something.** No placeholder search
   box, no avatar without an account, no fake numbers. Placeholder chrome is
   the fastest way to make an interface look generated.
2. **Restraint with the accent.** Lime marks the one thing that matters on a
   screen — the primary action, the current place. Everything else is neutral.
3. **One system.** Every colour, size, radius, shadow, duration and easing is a
   token. A component that needs a value that is not a token adds the token.
4. **Motion explains, it never performs.** It shows where something came from
   or went, and it is fast. Nothing loops for attention.

### Colour

Neutrals are graphite with a faint green cast, so the lime belongs to them.

| Token | Dark | Light | For |
|---|---|---|---|
| `canvas` | `#0b0c0b` | `#f6f7f3` | Page background behind everything |
| `surface` | `#121412` | `#ffffff` | Cards, the sidebar, panels |
| `surface-raised` | `#191c19` | `#fbfcf9` | Hover rows, menus, anything above a surface |
| `surface-sunken` | `#070807` | `#eef0ea` | Inputs, wells, skeleton base |
| `border` | `#262a25` | `#e2e5dc` | Every hairline |
| `border-strong` | `#353a33` | `#cfd3c8` | Input borders, dividers that must be seen |
| `ink` | `#eef0ea` | `#111310` | Primary text |
| `ink-muted` | `#a2a89c` | `#565c52` | Secondary text |
| `ink-subtle` | `#80867b` | `#6b7166` | Placeholders, metadata — AA on every surface |
| `accent` | `#c8f135` | `#c8f135` | Fills: primary button, active nav pill, selection |
| `accent-hover` | `#d6f75e` | `#bce41f` | Hover on an accent fill |
| `on-accent` | `#0b0c0b` | `#111310` | Text and icons on an accent fill |
| `accent-ink` | `#c8f135` | `#466d00` | Accent as text or icon on a surface: links, active icon |
| `accent-soft` | `rgb(200 241 53 / 0.12)` | `#f1fbd2` | Tinted backgrounds: selected row, badge |
| `focus` | `#c8f135` | `#466d00` | Focus rings |
| `success` / `success-soft` | `#3ddc97` / 12% | `#067647` / `#dcfae6` | |
| `warning` / `warning-soft` | `#fdb022` / 12% | `#b54708` / `#fef0c7` | |
| `danger` / `danger-soft` | `#ff8a7a` / 12% | `#b42318` / `#fee4e2` | |
| `info` / `info-soft` | `#7cb4ff` / 12% | `#175cd3` / `#d1e9ff` | |

**The lime rule.** On light, lime is never text: `#c8f135` on white is 1.31:1.
It is only ever a fill with `on-accent` on top (14:1), and `accent-ink`
`#466d00` (6.09:1 on white) carries the accent wherever it must be read. On
dark, the lime is both (13.6:1 on `surface`). Every text pairing in the table
passes WCAG AA; the showcase computes and shows each ratio live.

**Theme preference.** System (default), Light or Dark, stored in
`localStorage` per device. A small inline script in `index.html` sets
`data-theme` on `<html>` before the first paint, so there is never a flash of
the wrong theme. The tokens are defined once under `:root` (light) and again
under `[data-theme='dark']`; System listens to `prefers-color-scheme` and
follows changes live. The PWA `theme-color` meta follows the resolved theme.

### Type

- **Poppins** (400, 500, 600) for everything — `@fontsource/poppins`, self-hosted
  so the installed PWA renders correctly offline. Latin subset only.
- **Geist Mono** (variable) for URLs, IDs, keyboard keys and tabular numbers —
  `@fontsource-variable/geist-mono`.
- Scale (size / line height / tracking):

| Token | Size | Line | Tracking | Weight | For |
|---|---|---|---|---|---|
| `text-2xs` | 11px | 16px | 0.02em | 500 | Overlines, badges |
| `text-xs` | 12px | 16px | 0 | 400 | Metadata, captions |
| `text-sm` | 13px | 20px | 0 | 400 | UI controls, table cells |
| `text-base` | 14px | 22px | 0 | 400 | Body |
| `text-md` | 16px | 24px | -0.005em | 500 | Card titles |
| `text-lg` | 20px | 28px | -0.01em | 600 | Section headings |
| `text-xl` | 24px | 32px | -0.015em | 600 | Page titles |
| `text-2xl` | 32px | 40px | -0.02em | 600 | Showcase display |
| `text-3xl` | 40px | 48px | -0.025em | 600 | Showcase hero |

Poppins is geometric and wide; body sits at 14px and headings are tracked
tighter so large sizes do not sprawl.

### Shape, depth, spacing

- **Radius:** `radius-control` 8px (buttons, inputs, nav items, badges use
  full pill), `radius-surface` 14px (cards, panels, the sidebar).
- **Elevation**, as tokens: `shadow-sm`, `shadow-md`, `shadow-lg`. Light: soft,
  layered, slightly green-tinted shadows. Dark: shadows are invisible on black,
  so each level is a `border` hairline plus a 1px inner top highlight
  (`inset 0 1px 0 rgb(255 255 255 / 0.04)`).
- **Spacing:** Tailwind's 4px scale. Page gutter 24px (16px on phones);
  sections 40px apart; cards 20px padding.

### Motion

`motion` (the library formerly named framer-motion), loaded with `LazyMotion`
and `m.*` elements in `strict` mode; the feature bundle (`domMax`, needed for
the shared-layout nav indicator) is code-split and fetched after first paint.

| Token | Value | For |
|---|---|---|
| `duration-fast` | 120ms | Hover, press, exit |
| `duration-base` | 200ms | Toggles, small enters |
| `duration-slow` | 320ms | Page enter, panel slide |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Most movement |
| `ease-emphasized` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Page enter, nav pill |
| `ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` | Leaving |

- **Page transition.** Only the content region animates; the shell never
  moves. Exit: opacity 1→0, y 0→−4px, 120ms `ease-exit`. Enter: opacity 0→1,
  y 8px→0, blur 4px→0, 240ms `ease-emphasized`. `AnimatePresence mode="wait"`
  keyed on the route, with the outgoing outlet frozen so it does not re-render
  as the new page.
- **Active nav.** A lime pill behind the current item, moved between items by
  a shared `layoutId` with a spring (stiffness 500, damping 40).
- **Sidebar collapse.** Width animates 248px ↔ 72px; labels fade before the
  width moves and after it returns. The choice is remembered.
- **Theme switch.** The whole page cross-fades between themes in 200ms using
  the browser's View Transitions API. Where the API is missing, the theme
  switches instantly. No per-element colour transitions — they make every
  surface fade at a slightly different moment.
- **Reduced motion.** `MotionConfig reducedMotion="user"`: transforms and blur
  are dropped, opacity fades remain; icons do not animate; the shimmer becomes
  a gentle opacity pulse.

### Animated icons

Hand-written components in `src/shared/ui/icons/`, each drawn on Lucide's 24px
grid (paths from Lucide, ISC licence, kept beside them) with **each stroke as
its own `m.path` and its own variant**. An icon is animated by its parent: the
nav item, button or card it sits in is an `m.*` element with
`initial="rest"`, `whileHover="active"`, `whileFocus="active"`, and the icon's
paths respond to those variants. A nav item's icon also plays once when its
route becomes active.

The set, and what each part does:

| Icon | Used for | Motion |
|---|---|---|
| `ToolsIcon` (app grid) | Tools nav | the four tiles dip and spring back in turn, clockwise |
| `ThemeIcon` (palette) | Theme nav | the four paint dots pop in sequence |
| `SunIcon` | Light theme | core scales; rays extend one by one around it |
| `MoonIcon` | Dark theme | crescent rocks; a star blinks in |
| `MonitorIcon` | System theme | screen draws, stand drops in |
| `ExternalLinkIcon` | Open a tool | arrow leaves the box and re-enters from the corner |
| `PlusIcon` | Add tool | vertical then horizontal stroke redraw |
| `SidebarIcon` | Collapse sidebar | chevrons fold toward the edge |
| `CheckIcon` | Success | stroke draws on |
| `AlertIcon` | Errors | body shakes 2px, dot drops |
| `RefreshIcon` | Retry | arcs rotate 180° and settle |
| `WifiOffIcon` | Offline banner | arcs fade out from the outermost |

Static icons elsewhere use `lucide-react`. All icons are `aria-hidden`; their
parent carries the label.

### Skeletons

- Every route declares a skeleton component shaped like its page — same grid,
  same card sizes, text bars the height of the line they stand for.
- The routed outlet wraps each page in `Suspense` with that skeleton as the
  fallback. Pages load data with TanStack Query's `useSuspenseQuery`, so code
  and data loading share one mechanism.
- **Timing:** the skeleton is invisible for its first 150ms (a CSS
  `animation-delay` on its fade-in — no timers), so a fast switch shows no
  skeleton at all. Once shown, React 19's Suspense reveal throttling holds it
  for about 300ms, so it never flickers.
- **Look:** blocks are `surface-sunken`; one shimmer gradient sweeps across
  all blocks in sync (a single fixed-position gradient, so blocks on the same
  row light up together). Blocks fade in with a 30ms stagger, top to bottom.
- A page that fails to load shows a calm error state in the same frame, with
  a Retry button, not a crash.

### Logo

Copied from `source-one-portal/frontend/public/logo.png` (white RGBA, 2615×562)
into `frontend/public/brand/`. Two crops are made once with `sharp`:
`wordmark.png` (mark + wordmark) and `mark.png` (the S mark only).

`Logo` renders them as a CSS `mask-image` filled with `currentColor`, so the
same file is ink-coloured on either theme. Expanded sidebar: wordmark.
Collapsed rail and phones: mark.

The PWA icon is regenerated from the mark: lime `#c8f135` on `#0b0c0b`, with a
maskable variant. `theme-color` in the manifest becomes `#0b0c0b`.

### Screens

**App shell** (`src/app/shell/`)
- **Sidebar**, 248px: the wordmark; the nav (Tools, Theme) with animated icons
  and the sliding lime pill; at the foot, the collapse button. Collapses to a
  72px icon rail with tooltips. On phones (< 768px) the sidebar becomes a
  bottom bar of icons and labels.
- **Top bar**, 56px, inside the content column: where you are, as
  `Gateway / <page>`, on the left;
  the theme switch (a three-way segmented control with the animated icons) on
  the right. Nothing else.
- The offline banner and the update prompt keep their behaviour, restyled.

**Tools** (`/`, labelled Tools)
- Header: title, one line of description, and an "Add tool" primary button
  that opens the form in a side sheet.
- Groups by category; each tool a card with its name, its host in Geist Mono,
  the description, and an external-link icon that animates on hover. The whole
  card is the link.
- Empty state: one sentence and the Add tool button.

**Theme** (`/theme`) — the showcase
1. Brand — the logo on both themes, side by side
2. Colour — every token as a swatch with its value and live contrast ratio
   against the surface it is used on, for the current theme
3. Type — the scale, set in real sentences
4. Controls — buttons (primary, secondary, ghost, danger) in rest, hover,
   focus, disabled, loading; inputs with label, hint, error; badges; the
   segmented control
5. Surfaces — card, raised panel, elevation levels
6. Icons — the animated set, each playing on hover
7. Loading — a "Simulate loading" switch that suspends a sample card grid so
   its skeleton is shown; a Retry demo of the error state
8. Motion — the duration and easing tokens, each as a small box you can play

### Architecture

| Code | Where | Layer |
|---|---|---|
| Theme preference: type, `resolveTheme(preference, systemPrefersDark)` | `features/appearance/domain/` | domain |
| `ThemePreferenceStore` port, `useTheme()` / provider | `features/appearance/application/` | application |
| `LocalStorageThemePreferenceStore`, system-scheme watcher, `<html>` applier | `features/appearance/infrastructure/` | infrastructure |
| `ThemeSwitch` | `features/appearance/presentation/` | presentation |
| Tokens, fonts | `src/styles/` | — |
| Primitives (Button, Card, TextField, Badge, SegmentedControl, Sheet, Skeleton, Logo, Tooltip) and animated icons | `src/shared/ui/` | shared UI |
| Shell, routes table (path, label, icon, lazy page, skeleton), transitions | `src/app/` | composition |
| Tools page and skeleton; Theme page and skeleton | `src/pages/` | pages |

`shared/ui` may additionally import `motion` and `lucide-react`; the
`shared-ui-is-generic` rule in `frontend/.dependency-cruiser.cjs` is widened by
exactly those two.

### Decisions to record

- **0011** — Visual identity: lime as fill, olive as ink on light; graphite
  neutrals; Poppins and Geist Mono self-hosted; the theme preference.
- **0012** — Motion: `motion`, lazily loaded; page transitions on the content
  region only; stroke-animated icons played by their parent; reduced motion.
- **0013** — Loading: page-shaped skeletons via Suspense and
  `useSuspenseQuery`; 150ms invisible, React's throttle for the minimum.

### Testing

- `resolveTheme` and the preference store (domain and infrastructure tests)
- `ThemeSwitch` changes `data-theme` on `<html>` and remembers the choice
- The sidebar collapses, remembers it, and the active item follows the route
- Navigating between routes renders the destination's skeleton while its data
  is pending, then the page
- The skeleton is not visible before its delay (asserts the delay style)
- Every animated icon renders with `aria-hidden` and one `path` per stroke
- Tools page states: loading, error with Retry, empty, list; card is a link
  opening in a new tab only for web URLs
- Existing tests keep passing; `typecheck`, `lint`, `arch:check`, `test:unit`,
  `docs:check`, `build` all exit 0
- Bundle: the initial JS stays under 170 kB gzip; `motion` features load in a
  separate chunk

### Changes made while proving the handoff

Every piece of code in the handoff was built and checked once before it was
written down. That pass changed these details of the design above; the tables
above already show the result.

- **`ink-subtle`** was `#8a9084` (light) and `#6c7267` (dark), which read at
  3.3:1 and 3.7:1 — below AA. It is now `#6b7166` and `#80867b`, at least
  4.6:1 on every surface in both themes.
- **The Tools icon is an app grid**, not a wrench. Lucide's wrench is a single
  stroke, so it could only ever rotate as a whole; the grid has four tiles to
  move one by one.
- **The bundle budget is 170 kB gzip**, not 150. Measured: 162 kB. `motion`'s
  core is shared by every `m.*` element and its lazy feature bundle, so it
  stays in the main chunk; pages and the animation engine are separate chunks.
- **The stages** are: 1 — tokens, fonts, logo, theme logic, the `motion`
  foundation and the restyled primitives; 2 — icons, the shell, transitions,
  skeletons and the Tools page (a skeleton has to match its page, so they ship
  together); 3 — the showcase, the docs and the browser check.
- **The top bar** shows `Gateway / <page>` rather than repeating the page's
  own title, which the page header already shows at full size.
- **Logo files**: only the two crops (`brand/wordmark.png`, `brand/mark.png`)
  and the app-icon source are kept in `public/brand/`; the PWA icons are
  generated beside them by `pwa-assets.config.ts`, with no padding, on
  `#0b0c0b`.

### Verification in a browser

Run once, with the owner's agreement, on the built app (`npm run preview`),
light and dark: shell, both pages, a transition, a hover on each icon, the
skeleton via the showcase switch, collapse, phone width. Stop the preview
server afterwards.

---

## Progress

Built by following [the handoff](../handoffs/plan-0002-visual-identity-and-motion.md),
one stage at a time, stopping for the owner after each.

| Phase | Steps | Status |
|---|---|---|
| 1. Tokens, fonts, logo, theme, motion, primitives | 0 / 1 | Not started |
| 2. Icons, shell, transitions, skeletons, Tools page | 0 / 1 | Not started |
| 3. Showcase, docs, browser check | 0 / 1 | Not started |

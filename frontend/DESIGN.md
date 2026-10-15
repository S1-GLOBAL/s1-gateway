# Design system

The Gateway's look, as rules. The decisions behind it are
[ADR 0011](../docs/decisions/0011-visual-identity.md) (colour, type, theme),
[ADR 0012](../docs/decisions/0012-motion-and-animated-icons.md) (motion, icons)
and [ADR 0013](../docs/decisions/0013-loading-states-are-page-shaped-skeletons.md)
(loading). The running app shows all of it at **`/theme`**.

---

## Principles

1. **Nothing decorative that does not do something.** No placeholder search
   box, no avatar without an account, no fake numbers.
2. **Restraint with the accent.** Lime marks the one thing that matters on a
   screen — the primary action, the current place. Everything else is neutral.
3. **One system.** Every colour, size, radius, shadow, duration and easing is a
   token. A value that is not a token becomes one first. `npm run design:check`
   (CI and `pre-push`) refuses raw colours, one-off type/elevation/radius
   values, interpolated classes, `text-accent`, and hand-added tracking under
   `src/`.
4. **Motion explains; it never performs.** It shows where something came from
   or went, and it is short. Nothing loops for attention.

---

## Colour

Defined in `src/styles/theme.css`: light under `:root`, dark under
`[data-theme='dark']`. Tailwind's default palette is removed
(`--color-*: initial`), so `bg-blue-500` produces nothing — only these exist.

| Token | Light | Dark | For |
|---|---|---|---|
| `canvas` | `#f6f7f3` | `#0b0c0b` | Behind everything |
| `surface` | `#ffffff` | `#121412` | Cards, the sidebar, panels |
| `surface-raised` | `#fbfcf9` | `#191c19` | Above a surface: hovered rows, menus |
| `surface-sunken` | `#eef0ea` | `#070807` | Inputs' wells, the segmented track, skeletons |
| `border` | `#e2e5dc` | `#262a25` | Every hairline |
| `border-strong` | `#cfd3c8` | `#353a33` | Input borders, dividers that must be seen |
| `ink` | `#111310` | `#eef0ea` | Primary text |
| `ink-muted` | `#565c52` | `#a2a89c` | Secondary text |
| `ink-subtle` | `#6b7166` | `#80867b` | Metadata, placeholders — still AA on every surface |
| `accent` | `#c8f135` | `#c8f135` | **Fill only**: primary button, current nav item, selection |
| `accent-hover` | `#bce41f` | `#d6f75e` | A hovered accent fill |
| `on-accent` | `#111310` | `#0b0c0b` | Text and icons on an accent fill |
| `accent-ink` | `#466d00` | `#c8f135` | **The accent as text or icon**: links, the active icon |
| `accent-soft` | `#f1fbd2` | lime at 12% | Tinted backgrounds: badges, icon wells |
| `focus` | `#466d00` | `#c8f135` | Focus rings (set globally) |
| `success` / `-soft` | `#067647` / `#dcfae6` | `#3ddc97` / 12% | |
| `warning` / `-soft` | `#b54708` / `#fef0c7` | `#fdb022` / 12% | |
| `danger` / `-soft` | `#b42318` / `#fee4e2` | `#ff8a7a` / 12% | |
| `info` / `-soft` | `#175cd3` / `#d1e9ff` | `#7cb4ff` / 12% | |

**The lime rule.** `#c8f135` on white is 1.31:1 — invisible. So on light,
lime is never text: use `bg-accent text-on-accent` for a fill and
`text-accent-ink` for accent text. Never `text-accent`.

## Type

| Class | Size / line | Weight | For |
|---|---|---|---|
| `text-3xl` | 40 / 48 | 600 | Showcase hero only |
| `text-2xl` | 32 / 40 | 600 | Display, 404 |
| `text-xl` | 24 / 32 | 600 | Page titles |
| `text-lg` | 20 / 28 | 600 | Section headings, sheet titles |
| `text-md` | 16 / 24 | 500 | Card titles |
| `text-base` | 14 / 22 | 400 | Body (the default) |
| `text-sm` | 13 / 20 | 400 | Controls, labels, table cells |
| `text-xs` | 12 / 16 | 400 | Metadata, captions, hints |
| `text-2xs` | 11 / 16 | 500 | Badges, overlines |

**Poppins** for everything (`font-sans`, the default). **Geist Mono**
(`font-mono`) for URLs, hosts, IDs, keys and numbers that must line up. Large
sizes carry negative tracking from the token; never add `tracking-*` by hand.

## Shape, depth, spacing

- **Radius:** `rounded-control` (8px) for buttons, inputs, nav items, wells;
  `rounded-surface` (14px) for cards, panels, sheets; `rounded-full` for pills
  and badges. No other radius.
- **Elevation:** `shadow-sm` (resting), `shadow-md` (hovered, tooltips),
  `shadow-lg` (sheets, the update prompt). On dark they become a 1px top
  highlight — a surface also always has `border border-border`.
- **Spacing:** Tailwind's 4px scale. Page gutter 24px (16px on phones); 40px
  between page sections; 20px inside cards.
- **Scrollbars** are styled once, globally, in `src/styles/index.css`: a
  `border-strong` pill in a clear 12px track, `ink-subtle` under the pointer,
  `accent-ink` while held (olive on light, lime on dark). CSS only — never a scrollbar library or a JavaScript
  scroll container. Firefox gets the thin standard version in the same colours.

## Motion

Tokens in `src/shared/ui/motion.ts` (seconds) and `theme.css` (CSS):

| Token | Value | For |
|---|---|---|
| `duration.fast` | 120ms | Hover, press, leaving |
| `duration.base` | 200ms | Toggles, small arrivals |
| `duration.slow` | 320ms | Pages, panels, the sidebar |
| `ease.standard` / `ease-standard` | `0.2, 0, 0, 1` | Most movement |
| `ease.emphasized` / `ease-emphasized` | `0.05, 0.7, 0.1, 1` | Arrivals, the nav pill |
| `ease.exit` / `ease-exit` | `0.3, 0, 1, 1` | Leaving |

- Animate with `motion` through `import * as m from 'motion/react-m'` — never
  `motion.div`, which `<LazyMotion strict>` rejects.
- Only the content region moves between pages. Transforms, opacity and a
  small blur only.
- Nothing shifts sideways between pages. The root always reserves the
  scrollbar's space (`scrollbar-gutter: stable` in `src/styles/index.css`), so
  a page that scrolls and one that does not have the same width.
- Every animation respects reduced motion (`MotionConfig reducedMotion="user"`).

## Icons

- **Animated icons** live in `src/shared/ui/icons/`. Each stroke is its own
  `m.*` element with `rest` and `active` variants; `active` always ends on the
  rest pose. An icon never animates itself — the element it sits in does,
  with `{...iconTrigger}` from `motion.ts` (`Button` and `SegmentedControl`
  already do). Sizes: 16 in buttons, 18 in the sidebar, 20 in tiles.
- **Static icons** come from `lucide-react` at `strokeWidth={1.75}`.
- Every icon is `aria-hidden`; the element around it carries the label.
- A new animated icon: copy one from `icons.tsx`, take the paths from
  `node_modules/lucide-react/dist/esm/icons/<name>.mjs`, give each stroke a
  motion of its own, add it to `icons/index.ts` and to `icons.test.tsx` with
  its stroke count, and to the Icons section of `/theme`.

## Loading and failure

- Every page has a skeleton beside it (`<Page>Skeleton.tsx`) built from
  `SkeletonRegion`, `SkeletonBlock` and `SkeletonText`, laid out exactly like
  the page. It is the route's fallback in `src/app/routes.tsx`.
- Skeletons are invisible for 150ms; blocks fade in top to bottom (`order`);
  one shimmer sweeps all of them.
- A failure is `ErrorState`: a sentence, and Try again. Never a blank page,
  never an error code on its own.
- An empty list is `EmptyState`: what goes here, and the action that adds it.

## Theme

- System (default), Light or Dark, chosen in the top bar. Stored per device
  under `localStorage['s1-gateway.theme']`; the sidebar's fold under
  `localStorage['s1-gateway.sidebar']`.
- The inline script in `index.html` applies the theme before first paint.
  Keep it in step with `THEME_STORAGE_KEY`.
- Components never branch on the theme: they use tokens, and the tokens change.

## Logo and app icon

- `public/brand/wordmark.png` and `mark.png` are crops of Source One's logo
  (from the portal, `source-one-portal/frontend/public/logo.png`). `<Logo>`
  draws them as a mask in the current text colour.
- `public/brand/app-icon.png` (the mark in lime on `#0b0c0b`) is the source of
  every PWA icon. After changing it, run `npm run pwa:icons` in `frontend/`.

## Accessibility, always

- Every input has a visible label; errors use `aria-invalid` and
  `aria-describedby` (`TextField` does both).
- Focus is always visible (a 2px `focus` ring, set globally).
- Text passes WCAG AA on the surface it sits on. `/theme` shows each ratio live.

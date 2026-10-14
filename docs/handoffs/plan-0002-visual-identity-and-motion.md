# Handoff: plan 0002 — Visual identity, motion and the app shell

STATUS: READY.
Written for: whoever builds plan 0002, with no memory of earlier conversations.
Based on `main` at commit `afeebbd5e7fada483cd5d1485f258e7a09878acd`, 2026-10-15.
The one commit after it on `main` adds this handoff and updates the text of
plan 0002; it changes no code.

Every file below was built and checked once, in a scratch copy, before it was
written here: typecheck, lint, the architecture check, every test, the build,
and a look in a real browser. Type or paste exactly what this file says, and
each check will print exactly what it says it will.

## 0. The stages, and when to stop

| Order | Branch | Commit title | What goes in it |
|---|---|---|---|
| Stage 1 | `feat/plan-0002-visual-identity` | `Add the Gateway's tokens, fonts, logo, theme and motion foundation` | Steps 6.1.1–6.1.30 |
| Stage 2 | the same branch | `Add the app shell, animated icons, transitions, skeletons and the restyled Tools page` | Steps 6.2.1–6.2.38 |
| Stage 3 | the same branch | `Add the Theme showcase and document the design system` | Steps 6.3.1–6.3.27 |

- Build the stages in this order, one at a time, all on one local branch.
- **There is no remote.** Never run `git push`. Never open a pull request.
  Never run `git remote add`.
- Each stage ends with **one commit** (section 7). After that commit, STOP.
  Send your report (section 7, item 6) and wait. Start the next stage only
  when the owner writes "continue to stage 2" or "continue to stage 3".

## 1. What you are building

The Gateway gets its own look. You add a light and a dark theme built around
Source One's lime `#c8f135`, Poppins type, Source One's logo, and a theme
switch (Light, Dark, Match device) that is remembered per device. You add an
app shell: a sidebar that folds to an icon rail, a top bar, and a bottom bar
on phones. Pages change with a short transition, icons animate stroke by
stroke when hovered, and every page shows a skeleton of itself while it
loads. The Tools page is restyled, and a new `/theme` page shows the whole
design system on one screen.

## 2. Decisions already made — final

Decided by Rey Denzo (owner) on 2026-10-14 and 2026-10-15. Do not change these.
Do not ask about them again.

| Topic | Decision |
|---|---|
| Accent on dark | `#c8f135` as both fill and text |
| Accent on light | `#c8f135` only as a fill, with near-black text on it; `#466d00` for accent text and icons |
| Fonts | Poppins (400, 500, 600) for everything; Geist Mono for URLs, IDs and numbers. Self-hosted |
| Theme choice | Light, Dark, or Match device (the default). Remembered per device |
| App shell | A collapsible sidebar (248px, folds to a 72px rail); a bottom bar on phones under 768px |
| Page transitions | With `motion` (the library formerly named framer-motion). Only the content region moves |
| Icons | Hand-written; each stroke animates on its own when the icon's parent is hovered or focused |
| Skeletons | Only when loading is slow: invisible for 150ms, then shown; shaped like the page |
| Placeholder UI | None. No search box, avatar or notification bell until they do something |
| Showcase | One screen at `/theme` showing brand, colour, type, controls, surfaces, icons, loading, motion |
| Commits | One local commit per stage on `feat/plan-0002-visual-identity`. No push, no remote |
| Stages | Three, and the builder stops after each for the owner |
| Browser check | The builder runs it once, at the end of stage 3, takes screenshots, and stops the server |
| `ink-subtle` colour | `#6b7166` light, `#80867b` dark *(technical call: the first values failed WCAG AA)* |
| Tools icon | An app grid whose four tiles animate in turn *(technical call: Lucide's wrench is one stroke)* |
| Main bundle budget | At most 170 kB gzip *(technical call: measured 162 kB)* |
| Top bar text | `Gateway / <page>` *(technical call: the page header already shows the title)* |
| Stage contents | Motion and primitives in stage 1; the Tools page with the shell in stage 2 *(technical call: a skeleton must ship with its page)* |

## 3. Ground truth

Read from the code at commit `afeebbd5e7fada483cd5d1485f258e7a09878acd`. Run the
search in the "Where" column if you need to confirm a row. If what you see
differs from any row, STOP and ask. Do not adapt.

| Fact | Where to find it | Value |
|---|---|---|
| Node version | `node --version` | `v22` or `v24` (built on `v24.10.0`) |
| Frontend typecheck | `frontend/package.json`, search `"typecheck"` | `tsc -b` |
| Frontend lint | `frontend/package.json`, search `"lint"` | `oxlint --deny-warnings src` |
| Frontend architecture check | `frontend/package.json`, search `"arch:check"` | `depcruise src --config .dependency-cruiser.cjs` |
| Frontend tests | `frontend/package.json`, search `"test"` | `vitest run`; one file: `npx vitest run <path>` from `frontend/` |
| Test file pattern | `frontend/vitest.config.ts`, search `include` | `src/**/*.test.{ts,tsx}`, environment `happy-dom` |
| Packages already installed | `frontend/package.json`, search `"motion"`, `"lucide-react"`, `"@fontsource` | `motion ^14.2.0`, `lucide-react ^1.57.0`, `@fontsource/poppins ^5.3.0`, `@fontsource-variable/geist-mono ^5.3.0` |
| Logo files prepared | `ls frontend/public/brand` | `app-icon.png  mark.png  source-one-logo.png  wordmark.png` |
| Old PWA icons | `ls frontend/public` | `apple-touch-icon-180x180.png  brand  favicon.ico  icon.svg  maskable-icon-512x512.png  pwa-192x192.png  pwa-512x512.png  pwa-64x64.png` |
| Current tokens | `frontend/src/styles/theme.css`, search `Neutral placeholders` | The neutral blue placeholder palette |
| Current Tools page | `frontend/src/pages/ToolsPage.tsx`, search `export function ToolsPage` | One file, using `useTools` from `@/features/tools` |
| `useTools` today | `frontend/src/features/tools/application/use-tools.ts`, search `useQuery` | `useQuery<Tool[], AppError>` |
| `App.tsx` today | `frontend/src/app/App.tsx`, search `UpdatePrompt` | Renders `OfflineBanner`, `RouterProvider` and `UpdatePrompt` |
| Shared UI rule | `frontend/.dependency-cruiser.cjs`, search `shared-ui-is-generic` | allows only `react`, `clsx`, `tailwind-merge` |
| Screenshot script | `scripts/screenshot.mjs`, search `hover` | Exists; options documented at its top |
| Git hooks | `git config --get core.hooksPath` | `.githooks` (the commit-msg hook blocks AI attribution) |
| Unit tests before you start | `npm run test:unit` from the repository root | backend `40 passed (40)`, frontend `26 passed (26)` |

## 4. The design

The full specification is the **Design** section of
`docs/plans/0002-visual-identity-and-motion.md`. You do not need to design
anything: every file is given below, complete. Read that section once, so you
know what you are building and why.

**Limits:** none new. The only limits are the existing tool field limits
(name 80, URL 2048, description 280, category 40), which this work does not
change.

**Every piece of text a person reads**, so you can recognise it:

| Where | Text |
|---|---|
| Top bar | `Gateway / Tools`, `Gateway / Theme`, `Gateway / Not found` |
| Theme switch (accessible names) | `Theme` (the group); `Light`, `Dark`, `Match device` |
| Sidebar | `Tools`, `Theme`; `Collapse sidebar` / `Expand sidebar`; logo link `Source One Gateway, home` |
| Skip link | `Skip to content` |
| Tools page header | `Tools` — `The apps and links Source One staff open every day.` — button `Add tool` |
| Tools empty state | `No tools yet` — `Add the first app or link, and it appears here for everyone, under its category.` |
| Add tool sheet | `Add a tool` — `It appears for everyone, under its category.` — buttons `Cancel`, `Add tool`, `Close` |
| Form hints | `The full address, starting with https://`; `Tools with the same category are shown together.`; `Optional. One line about what it is for.` |
| Route error | `This page could not load.` — the error's message — button `Try again` |
| Skeleton (screen readers) | `Loading tools`, `Loading theme` |
| Offline banner | `You are offline. The Gateway will show live data again when you reconnect.` |
| Update prompt | `A new version of the Gateway is ready.` — `Later`, `Reload` |
| Not found | `404` — `There is nothing at this address.` — `It may have moved. Everything the Gateway has is in the sidebar, or go to Tools.` |
| Theme page | `Theme` — `The Gateway's colour, type, controls and motion. Switch the theme at the top right to see both.` |

## 5. Setup — before any change

1. Read, once: `CLAUDE.md`, `frontend/DESIGN.md` (the current, short one),
   and the Design section of `docs/plans/0002-visual-identity-and-motion.md`.
2. Use a scratch folder outside the repository for temporary files: the one
   your tool gives you; if it gives none, `%TEMP%\going-dark`
   (in Git Bash: `"$TEMP/going-dark"`).
3. **Shell.** Every command in this file is for **Git Bash** on Windows. Unless
   a step says otherwise, run it from `C:\SOG\s1-gateway\frontend`
   (in Git Bash: `cd /c/SOG/s1-gateway/frontend`). Steps that say "from the
   repository root" mean `cd /c/SOG/s1-gateway`.
4. **Local processes you may run:** only these, and only where a step says so:
   `npm run …` scripts that exit by themselves, `npx vitest run …`, and — in
   stage 3 only — `npx vite preview` and `node scripts/screenshot.mjs`. Never
   start Docker, the API, `npm run dev:*`, or anything else. Stop everything
   you start before you report.
5. **Baseline.** Before changing anything, from the repository root, run:

   ```bash
   git status --short; git log --oneline -2
   npm run typecheck > /dev/null 2>&1; echo "typecheck=$?"
   npm run lint > /dev/null 2>&1; echo "lint=$?"
   npm run arch:check > /dev/null 2>&1; echo "arch=$?"
   npm run test:unit 2>&1 | grep -E "Tests "
   ```

   Expected, exactly: `git status --short` prints nothing; the log's second
   line is `afeebbd Initial scaffold of the Source One Gateway`;
   `typecheck=0`, `lint=0`, `arch=0`; and two lines
   `Tests  40 passed (40)` and `Tests  26 passed (26)`.
   If anything differs, STOP and report it — do not change anything.

## 6. Stage 1 — tokens, fonts, logo, theme and the motion foundation

### Step 6.1.1 — Create the branch

**Action:** from the repository root, run:

```bash
git switch -c feat/plan-0002-visual-identity
```

**Check:** `git branch --show-current` prints `feat/plan-0002-visual-identity`.

### Step 6.1.2 — Replace the design tokens

**Action:** replace the whole of `frontend/src/styles/theme.css` with exactly:

````css
/*
 * Design tokens — ADR 0011 and frontend/DESIGN.md.
 *
 * Light is the default under :root; dark redefines the same names under
 * [data-theme='dark']. Change a value here and nowhere else.
 *
 * `--color-*: initial` (and the same for text, radius, shadow and font)
 * removes Tailwind's default palette and scales, so a class that is not one of
 * these tokens produces no CSS at all instead of an off-brand colour.
 */
@theme static {
  --color-*: initial;
  --text-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --font-*: initial;

  /* Neutrals: graphite with a faint green cast. */
  --color-canvas: #f6f7f3;
  --color-surface: #ffffff;
  --color-surface-raised: #fbfcf9;
  --color-surface-sunken: #eef0ea;
  --color-border: #e2e5dc;
  --color-border-strong: #cfd3c8;
  --color-ink: #111310;
  --color-ink-muted: #565c52;
  --color-ink-subtle: #6b7166;

  /* The accent is two tokens: a fill, and the accent as text (ADR 0011). */
  --color-accent: #c8f135;
  --color-accent-hover: #bce41f;
  --color-on-accent: #111310;
  --color-accent-ink: #466d00;
  --color-accent-soft: #f1fbd2;
  --color-focus: #466d00;

  --color-success: #067647;
  --color-success-soft: #dcfae6;
  --color-warning: #b54708;
  --color-warning-soft: #fef0c7;
  --color-danger: #b42318;
  --color-danger-soft: #fee4e2;
  --color-info: #175cd3;
  --color-info-soft: #d1e9ff;

  --radius-control: 8px;
  --radius-surface: 14px;

  --shadow-sm: 0 1px 2px rgb(17 19 16 / 0.06);
  --shadow-md: 0 1px 2px rgb(17 19 16 / 0.04), 0 4px 12px -2px rgb(17 19 16 / 0.08);
  --shadow-lg: 0 2px 4px rgb(17 19 16 / 0.04), 0 16px 40px -8px rgb(17 19 16 / 0.16);

  --font-sans: 'Poppins', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono Variable', ui-monospace, 'SFMono-Regular', Menlo, monospace;

  --text-2xs: 11px;
  --text-2xs--line-height: 16px;
  --text-2xs--letter-spacing: 0.02em;
  --text-xs: 12px;
  --text-xs--line-height: 16px;
  --text-sm: 13px;
  --text-sm--line-height: 20px;
  --text-base: 14px;
  --text-base--line-height: 22px;
  --text-md: 16px;
  --text-md--line-height: 24px;
  --text-md--letter-spacing: -0.005em;
  --text-lg: 20px;
  --text-lg--line-height: 28px;
  --text-lg--letter-spacing: -0.01em;
  --text-xl: 24px;
  --text-xl--line-height: 32px;
  --text-xl--letter-spacing: -0.015em;
  --text-2xl: 32px;
  --text-2xl--line-height: 40px;
  --text-2xl--letter-spacing: -0.02em;
  --text-3xl: 40px;
  --text-3xl--line-height: 48px;
  --text-3xl--letter-spacing: -0.025em;

  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-exit: cubic-bezier(0.3, 0, 1, 1);
}

:root {
  color-scheme: light;
}

[data-theme='dark'] {
  color-scheme: dark;

  --color-canvas: #0b0c0b;
  --color-surface: #121412;
  --color-surface-raised: #191c19;
  --color-surface-sunken: #070807;
  --color-border: #262a25;
  --color-border-strong: #353a33;
  --color-ink: #eef0ea;
  --color-ink-muted: #a2a89c;
  --color-ink-subtle: #80867b;

  --color-accent: #c8f135;
  --color-accent-hover: #d6f75e;
  --color-on-accent: #0b0c0b;
  --color-accent-ink: #c8f135;
  --color-accent-soft: rgb(200 241 53 / 0.12);
  --color-focus: #c8f135;

  --color-success: #3ddc97;
  --color-success-soft: rgb(61 220 151 / 0.12);
  --color-warning: #fdb022;
  --color-warning-soft: rgb(253 176 34 / 0.12);
  --color-danger: #ff8a7a;
  --color-danger-soft: rgb(255 138 122 / 0.12);
  --color-info: #7cb4ff;
  --color-info-soft: rgb(124 180 255 / 0.12);

  /* Shadows vanish on black: a top highlight carries the edge instead. */
  --shadow-sm: inset 0 1px 0 rgb(255 255 255 / 0.04);
  --shadow-md: inset 0 1px 0 rgb(255 255 255 / 0.05), 0 8px 24px -8px rgb(0 0 0 / 0.6);
  --shadow-lg: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 24px 48px -12px rgb(0 0 0 / 0.7);
}
````

**Check:** `grep -c "color-accent-ink" src/styles/theme.css` prints `2`.

### Step 6.1.3 — Replace the global stylesheet

**Action:** replace the whole of `frontend/src/styles/index.css` with exactly:

````css
@import 'tailwindcss';
@import './theme.css';

@layer base {
  html {
    background-color: var(--color-canvas);
  }

  body {
    @apply bg-canvas font-sans text-base text-ink antialiased;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
  }

  ::selection {
    background-color: var(--color-accent);
    color: var(--color-on-accent);
  }

  :focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  h1,
  h2,
  h3 {
    text-wrap: balance;
  }
}

/*
 * Skeletons — ADR 0013. One fixed-position gradient is shared by every block,
 * so blocks on the same row light up together. The region stays invisible for
 * its first 150ms (the delay is set inline by <SkeletonRegion>).
 */
@layer components {
  .skeleton-region {
    animation: skeleton-region-in 200ms var(--ease-standard) both;
  }

  .skeleton-block {
    border-radius: var(--radius-control);
    background-color: var(--color-surface-sunken);
    background-image: linear-gradient(
      100deg,
      transparent 30%,
      color-mix(in oklab, var(--color-surface) 65%, transparent) 50%,
      transparent 70%
    );
    background-size: 200vw 100%;
    background-attachment: fixed;
    background-repeat: no-repeat;
    animation:
      skeleton-block-in 240ms var(--ease-standard) both,
      skeleton-shimmer 1.6s linear infinite;
  }
}

@keyframes skeleton-region-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes skeleton-block-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes skeleton-shimmer {
  from {
    background-position: 100vw 0;
  }
  to {
    background-position: -100vw 0;
  }
}

@keyframes skeleton-pulse {
  50% {
    opacity: 0.55;
  }
}

@keyframes sheet-in {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
  to {
    transform: none;
    opacity: 1;
  }
}

@keyframes backdrop-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-block {
    background-image: none;
    animation: skeleton-pulse 2s ease-in-out infinite;
  }

  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
  animation-timing-function: var(--ease-standard);
}
````

**Check:** `grep -c "@keyframes" src/styles/index.css` prints `7`.

### Step 6.1.4 — Load the fonts

**Action:** replace the whole of `frontend/src/main.tsx` with exactly:

````tsx
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource-variable/geist-mono/wght.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html has no #root element.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
````

**Check:** `grep -c "@fontsource" src/main.tsx` prints `4`.

### Step 6.1.5 — Apply the theme before first paint

**Action:** replace the whole of `frontend/index.html` with exactly:

````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Source One Global's internal staff hub" />
    <meta name="theme-color" content="#0b0c0b" />
    <link rel="icon" href="/brand/favicon.ico" sizes="48x48" />
    <link rel="apple-touch-icon" href="/brand/apple-touch-icon-180x180.png" />
    <title>S1 Gateway</title>
    <script>
      // Sets the theme before the first paint, so the wrong one never flashes
      // (ADR 0011). Reads the same key as LocalStorageThemePreferenceStore.
      (function () {
        var theme = 'light';
        try {
          var stored = localStorage.getItem('s1-gateway.theme');
          var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          theme = stored === 'dark' || (stored !== 'light' && systemDark) ? 'dark' : 'light';
        } catch (e) {}
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#0b0c0b' : '#f6f7f3');
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
````

**Check:** `grep -c "s1-gateway.theme" index.html` prints `1`.

### Step 6.1.6 — Add the motion tokens

**Action:** create `frontend/src/shared/ui/motion.ts` with exactly:

````ts
/**
 * Motion tokens — ADR 0012. Seconds, because that is what `motion` takes.
 * The same curves exist as CSS custom properties in styles/theme.css.
 */
export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/**
 * The two states every animated icon knows. The element an icon sits in sets
 * them — `initial="rest"`, `whileHover="active"`, `whileFocus="active"` — and
 * they propagate down to each stroke.
 */
export const iconTrigger = {
  initial: 'rest',
  whileHover: 'active',
  whileFocus: 'active',
} as const;
````

**Check:** `ls src/shared/ui/motion.ts` prints the path.

### Step 6.1.7 — Add the lazily loaded motion features

**Action:** create `frontend/src/app/motion-features.ts` with exactly:

````ts
// Loaded on demand by <MotionProvider>, so the animation engine is a separate
// chunk fetched after first paint (ADR 0012).
export { domMax as default } from 'motion/react';
````

**Check:** `ls src/app/motion-features.ts` prints the path.

### Step 6.1.8 — Add the motion provider

**Action:** create `frontend/src/app/motion-provider.tsx` with exactly:

````tsx
import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

const loadFeatures = () => import('./motion-features').then((module) => module.default);

/**
 * `strict`: a stray `motion.div` (which would bundle every feature eagerly)
 * throws in development. Use `m.div`. `reducedMotion="user"` drops movement
 * for people who asked their OS for less of it.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
````

**Check:** `grep -c "LazyMotion" src/app/motion-provider.tsx` prints `3`.

### Step 6.1.9 — Write the theme domain test first

**Action:** create `frontend/src/features/appearance/domain/theme.test.ts` with exactly:

````ts
import { describe, expect, it } from 'vitest';
import { isThemePreference, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('follows the system when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the system when the preference is explicit', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('isThemePreference', () => {
  it.each(['system', 'light', 'dark'])('accepts %s', (value) => {
    expect(isThemePreference(value)).toBe(true);
  });

  it.each([null, '', 'Dark', 'blue', 1])('rejects %s', (value) => {
    expect(isThemePreference(value)).toBe(false);
  });
});
````

**Check:** `npx vitest run src/features/appearance/domain` fails, and its output
contains `Failed to resolve import "./theme"`. That failure is expected: the
code does not exist yet.

### Step 6.1.10 — Add the theme domain

**Action:** create `frontend/src/features/appearance/domain/theme.ts` with exactly:

````ts
/** What a person chose. `system` follows the device's light or dark setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** What is actually drawn. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}
````

**Check:** `npx vitest run src/features/appearance/domain` prints `Tests  10 passed (10)`.

### Step 6.1.11 — Write the preference store test first

**Action:** create `frontend/src/features/appearance/infrastructure/local-storage-theme-preference-store.test.ts` with exactly:

````ts
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageThemePreferenceStore, THEME_STORAGE_KEY } from './local-storage-theme-preference-store';

beforeEach(() => window.localStorage.clear());

describe('LocalStorageThemePreferenceStore', () => {
  it('reads system when nothing is stored', () => {
    expect(new LocalStorageThemePreferenceStore(window.localStorage).read()).toBe('system');
  });

  it('remembers what it writes', () => {
    const store = new LocalStorageThemePreferenceStore(window.localStorage);
    store.write('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(store.read()).toBe('dark');
  });

  it('reads system when the stored value is not a preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(new LocalStorageThemePreferenceStore(window.localStorage).read()).toBe('system');
  });

  it('works without storage at all', () => {
    const store = new LocalStorageThemePreferenceStore(undefined);
    store.write('light');
    expect(store.read()).toBe('system');
  });
});
````

**Check:** `npx vitest run src/features/appearance/infrastructure` fails, and its
output contains `Failed to resolve import "./local-storage-theme-preference-store"`.

### Step 6.1.12 — Add the ports

**Action:** create `frontend/src/features/appearance/application/theme-ports.ts` with exactly:

````ts
import type { ResolvedTheme, ThemePreference } from '../domain/theme';

/** Where the preference is remembered. Never throws: a broken store reads `system`. */
export interface ThemePreferenceStore {
  read(): ThemePreference;
  write(preference: ThemePreference): void;
}

/** The page the theme is drawn on. */
export interface ThemeDocument {
  /** Whether the device is set to dark right now. */
  prefersDark(): boolean;
  /** Calls `listener` whenever the device's setting changes. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Draws the page in `theme`. */
  apply(theme: ResolvedTheme): void;
  /** Runs `update` — synchronously — inside a cross-fade where the browser supports one. */
  transition(update: () => void): void;
}
````

**Check:** `ls src/features/appearance/application/theme-ports.ts` prints the path.

### Step 6.1.13 — Add the preference store

**Action:** create `frontend/src/features/appearance/infrastructure/local-storage-theme-preference-store.ts` with exactly:

````ts
import type { ThemePreferenceStore } from '../application/theme-ports';
import { isThemePreference, type ThemePreference } from '../domain/theme';

/** Also read by the inline script in index.html, before React starts. Keep the two in step. */
export const THEME_STORAGE_KEY = 's1-gateway.theme';

/**
 * The preference in localStorage. Storage can be missing or throw (a private
 * window, blocked site data); then every read is `system` and writes do nothing.
 */
export class LocalStorageThemePreferenceStore implements ThemePreferenceStore {
  private readonly storage: Storage | undefined;

  constructor(storage: Storage | undefined) {
    this.storage = storage;
  }

  read(): ThemePreference {
    try {
      const value = this.storage?.getItem(THEME_STORAGE_KEY);
      return isThemePreference(value) ? value : 'system';
    } catch {
      return 'system';
    }
  }

  write(preference: ThemePreference): void {
    try {
      this.storage?.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Not remembered; the choice still applies for this visit.
    }
  }
}

/** `window.localStorage`, or undefined where reading it throws. */
export function browserLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
````

**Check:** `npx vitest run src/features/appearance/infrastructure` prints `Tests  4 passed (4)`.

### Step 6.1.14 — Write the theme provider test first

**Action:** create `frontend/src/features/appearance/application/theme-context.test.tsx` with exactly:

````tsx
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ResolvedTheme, ThemePreference } from '../domain/theme';
import type { ThemeDocument, ThemePreferenceStore } from './theme-ports';
import { ThemeProvider, useTheme } from './theme-context';

class MemoryStore implements ThemePreferenceStore {
  value: ThemePreference;

  constructor(value: ThemePreference) {
    this.value = value;
  }

  read(): ThemePreference {
    return this.value;
  }

  write(preference: ThemePreference): void {
    this.value = preference;
  }
}

class FakeDocument implements ThemeDocument {
  dark: boolean;
  applied: ResolvedTheme[] = [];
  private listeners = new Set<() => void>();

  constructor(dark: boolean) {
    this.dark = dark;
  }

  prefersDark(): boolean {
    return this.dark;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  apply(theme: ResolvedTheme): void {
    this.applied.push(theme);
  }

  transition(update: () => void): void {
    update();
  }

  setSystemDark(dark: boolean): void {
    this.dark = dark;
    for (const listener of this.listeners) listener();
  }
}

function Probe() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <p>
        {preference}/{resolved}
      </p>
      <button type="button" onClick={() => setPreference('dark')}>
        dark
      </button>
    </div>
  );
}

function renderWith(store: MemoryStore, document: FakeDocument) {
  render(
    <ThemeProvider store={store} document={document}>
      <Probe />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  it('starts from the stored preference and applies the resolved theme', () => {
    const document = new FakeDocument(true);
    renderWith(new MemoryStore('system'), document);
    expect(screen.getByText('system/dark')).toBeTruthy();
    expect(document.applied.at(-1)).toBe('dark');
  });

  it('follows the system while the preference is system', () => {
    const document = new FakeDocument(false);
    renderWith(new MemoryStore('system'), document);
    act(() => document.setSystemDark(true));
    expect(screen.getByText('system/dark')).toBeTruthy();
    expect(document.applied.at(-1)).toBe('dark');
  });

  it('stores and applies a new preference', () => {
    const store = new MemoryStore('light');
    const document = new FakeDocument(false);
    renderWith(store, document);
    act(() => screen.getByRole('button', { name: 'dark' }).click());
    expect(store.value).toBe('dark');
    expect(screen.getByText('dark/dark')).toBeTruthy();
    expect(document.applied.at(-1)).toBe('dark');
  });
});
````

**Check:** `npx vitest run src/features/appearance/application` fails, and its
output contains `Failed to resolve import "./theme-context"`.

### Step 6.1.15 — Add the theme provider

**Action:** create `frontend/src/features/appearance/application/theme-context.tsx` with exactly:

````tsx
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { resolveTheme, type ResolvedTheme, type ThemePreference } from '../domain/theme';
import type { ThemeDocument, ThemePreferenceStore } from './theme-ports';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference(preference: ThemePreference): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  store,
  document,
  children,
}: {
  store: ThemePreferenceStore;
  document: ThemeDocument;
  children: ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => store.read());
  const systemPrefersDark = useSyncExternalStore(
    (listener) => document.subscribe(listener),
    () => document.prefersDark(),
    () => false,
  );
  const resolved = resolveTheme(preference, systemPrefersDark);

  // Before paint, so a change never shows a frame in the old theme.
  useLayoutEffect(() => {
    document.apply(resolved);
  }, [document, resolved]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      store.write(next);
      document.transition(() => setPreferenceState(next));
    },
    [document, store],
  );

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return value;
}
````

**Check:** `npx vitest run src/features/appearance/application` prints `Tests  3 passed (3)`.

### Step 6.1.16 — Add the browser adapter

**Action:** create `frontend/src/features/appearance/infrastructure/browser-theme-document.ts` with exactly:

````ts
import { flushSync } from 'react-dom';
import type { ThemeDocument } from '../application/theme-ports';
import type { ResolvedTheme } from '../domain/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The browser-chrome colour (address bar, PWA title bar) per theme: the canvas token. */
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#f6f7f3', dark: '#0b0c0b' };

export class BrowserThemeDocument implements ThemeDocument {
  prefersDark(): boolean {
    return window.matchMedia(DARK_QUERY).matches;
  }

  subscribe(listener: () => void): () => void {
    const query = window.matchMedia(DARK_QUERY);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }

  apply(theme: ResolvedTheme): void {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }

  /**
   * The whole page cross-fades between themes (ADR 0012). Where the View
   * Transitions API is missing, or the person asked for reduced motion, the
   * theme simply switches.
   */
  transition(update: () => void): void {
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    if (typeof document.startViewTransition !== 'function' || reduced) {
      update();
      return;
    }
    document.startViewTransition(() => flushSync(update));
  }
}
````

**Check:** `ls src/features/appearance/infrastructure/browser-theme-document.ts` prints the path.

### Step 6.1.17 — Add the feature's public surface

**Action:** create `frontend/src/features/appearance/index.ts` with exactly:

````ts
export type { ResolvedTheme, ThemePreference } from './domain/theme';
export { THEME_PREFERENCES } from './domain/theme';
export type { ThemeDocument, ThemePreferenceStore } from './application/theme-ports';
export { ThemeProvider, useTheme } from './application/theme-context';
export { BrowserThemeDocument } from './infrastructure/browser-theme-document';
export {
  LocalStorageThemePreferenceStore,
  THEME_STORAGE_KEY,
  browserLocalStorage,
} from './infrastructure/local-storage-theme-preference-store';
````

**Check:** `npx vitest run src/features/appearance` prints `Tests  17 passed (17)`.

### Step 6.1.18 — Write the primitives test first

**Action:** create `frontend/src/shared/ui/primitives.test.tsx` with exactly:

````tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';
import { Button } from './Button';
import { Logo } from './Logo';

describe('Button', () => {
  it('is a plain button by default', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('disabled')).toBe(false);
  });

  it('is busy and cannot be pressed while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});

describe('Logo', () => {
  it('is announced as Source One', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'Source One' })).toBeTruthy();
  });

  it('keeps the artwork proportions at any height', () => {
    render(<Logo variant="mark" height={42.4} />);
    const logo = screen.getByRole('img', { name: 'Source One' });
    expect(logo.style.width).toBe('59px');
  });
});

describe('Badge', () => {
  it('uses the accent ink for the accent tone, never the fill', () => {
    render(<Badge tone="accent">New</Badge>);
    expect(screen.getByText('New').className).toContain('text-accent-ink');
  });
});
````

**Check:** `npx vitest run src/shared/ui/primitives` fails, and its output
contains `Failed to resolve import` (it names `./Badge` or `./Logo`, the two
files the next steps create).

### Step 6.1.19 — Add the Badge

**Action:** create `frontend/src/shared/ui/Badge.tsx` with exactly:

````tsx
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted',
  accent: 'bg-accent-soft text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-2xs font-medium', TONES[tone], className)}
      {...props}
    />
  );
}
````

**Check:** `ls src/shared/ui/Badge.tsx` prints the path.

### Step 6.1.20 — Add the Logo

**Action:** create `frontend/src/shared/ui/Logo.tsx` with exactly:

````tsx
import type { CSSProperties } from 'react';
import { cn } from './cn';

/** Width over height of each crop in public/brand/. */
const ART = {
  wordmark: { src: '/brand/wordmark.png', ratio: 2527 / 424 },
  mark: { src: '/brand/mark.png', ratio: 589 / 424 },
} as const;

export interface LogoProps {
  variant?: keyof typeof ART;
  /** Height in pixels; the width follows the artwork. */
  height?: number;
  className?: string;
}

/**
 * Source One's logo. The PNG is a mask filled with the current text colour,
 * so the same file is dark on the light theme and light on the dark one.
 */
export function Logo({ variant = 'wordmark', height = 28, className }: LogoProps) {
  const { src, ratio } = ART[variant];
  const style: CSSProperties = {
    height,
    width: Math.round(height * ratio),
    maskImage: `url(${src})`,
    WebkitMaskImage: `url(${src})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'left center',
    WebkitMaskPosition: 'left center',
  };
  return <span role="img" aria-label="Source One" className={cn('inline-block shrink-0 bg-current', className)} style={style} />;
}
````

**Check:** `ls src/shared/ui/Logo.tsx` prints the path.

### Step 6.1.21 — Replace the Button, Card and TextField

**Action:** replace the whole of `frontend/src/shared/ui/Button.tsx` with exactly:

````tsx
import type { HTMLMotionProps } from 'motion/react';
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { iconTrigger } from './motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent shadow-sm hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-surface text-ink shadow-sm hover:bg-surface-raised',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-surface shadow-sm hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, marks the button busy and stops further presses. */
  loading?: boolean;
  children?: ReactNode;
}

/**
 * Any animated icon inside plays when the button is hovered or focused — the
 * button sets the icon states (ADR 0012).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <m.button
      {...iconTrigger}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control font-medium',
        'transition-[background-color,color,opacity,transform] duration-150 ease-standard active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-[spin_700ms_linear_infinite] rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </m.button>
  );
}
````

Replace the whole of `frontend/src/shared/ui/Card.tsx` with exactly:

````tsx
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-surface border border-border bg-surface p-5 shadow-sm', className)}
      {...props}
    />
  );
}
````

Replace the whole of `frontend/src/shared/ui/TextField.tsx` with exactly:

````tsx
import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** One line under the input, shown while there is no error. */
  hint?: string;
  errors?: readonly string[] | undefined;
}

export function TextField({ label, hint, errors = [], className, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const invalid = errors.length > 0;
  const note = invalid ? errors.join(' ') : hint;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={invalid || undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          'h-10 rounded-control border border-border-strong bg-surface px-3 text-sm text-ink shadow-sm',
          'transition-colors duration-150 ease-standard placeholder:text-ink-subtle hover:border-ink-subtle',
          'aria-invalid:border-danger',
        )}
        {...props}
      />
      {note && (
        <p id={noteId} className={cn('text-xs', invalid ? 'text-danger' : 'text-ink-muted')}>
          {note}
        </p>
      )}
    </div>
  );
}
````

**Check:** `npx vitest run src/shared/ui/primitives` prints `Tests  5 passed (5)`.

### Step 6.1.22 — Wire the theme and motion into the app

**Action:** replace the whole of `frontend/src/app/dependencies.ts` with exactly:

````ts
import {
  BrowserThemeDocument,
  LocalStorageThemePreferenceStore,
  browserLocalStorage,
  type ThemeDocument,
  type ThemePreferenceStore,
} from '@/features/appearance';
import { HttpToolsGateway, type ToolsGateway } from '@/features/tools';
import { createHttpClient } from '@/shared/infrastructure/http-client';

/** Every port's production adapter, chosen in one place. */
export interface Dependencies {
  toolsGateway: ToolsGateway;
  themeStore: ThemePreferenceStore;
  themeDocument: ThemeDocument;
}

export function createDependencies(): Dependencies {
  const http = createHttpClient(import.meta.env.VITE_API_URL ?? '/api/v1');
  return {
    toolsGateway: new HttpToolsGateway(http),
    themeStore: new LocalStorageThemePreferenceStore(browserLocalStorage()),
    themeDocument: new BrowserThemeDocument(),
  };
}
````

Replace the whole of `frontend/src/app/providers.tsx` with exactly:

````tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ThemeProvider } from '@/features/appearance';
import { ToolsGatewayProvider } from '@/features/tools';
import { createDependencies } from './dependencies';
import { MotionProvider } from './motion-provider';
import { createQueryClient } from './query-client';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [dependencies] = useState(createDependencies);

  return (
    <ThemeProvider store={dependencies.themeStore} document={dependencies.themeDocument}>
      <MotionProvider>
        <QueryClientProvider client={queryClient}>
          <ToolsGatewayProvider gateway={dependencies.toolsGateway}>{children}</ToolsGatewayProvider>
        </QueryClientProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}
````

**Check:** `npm run typecheck > /dev/null 2>&1; echo "exit=$?"` prints `exit=0`.

### Step 6.1.23 — Let shared UI use motion and lucide-react

**Action:** replace the whole of `frontend/.dependency-cruiser.cjs` with exactly:

````js
/**
 * The dependency rule, enforced (ADR 0003, ADR 0004). See the backend's copy
 * for how `$1` works. The frontend's application layer may use React and
 * TanStack Query — hooks are how a React app delivers its use cases.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|shared)/domain/' },
      to: { pathNot: ['^src/$1/domain/', '^src/shared/domain/'] },
    },
    {
      name: 'application-depends-only-inward',
      comment: 'Application may use react and @tanstack/react-query, and nothing else from outside.',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|shared)/application/' },
      to: {
        pathNot: [
          '^src/$1/(domain|application)/',
          '^src/shared/(domain|application)/',
          '^node_modules/(react|@tanstack/react-query)/',
        ],
      },
    },
    {
      name: 'infrastructure-not-to-presentation',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|shared)/infrastructure/' },
      to: { path: '^src/(features/[^/]+|shared)/(presentation|ui)/' },
    },
    {
      name: 'presentation-not-to-infrastructure',
      severity: 'error',
      from: { path: '^src/(features/[^/]+/presentation|shared/ui)/' },
      to: { path: '(^src/(features/[^/]+|shared)/infrastructure/|^node_modules/axios/)' },
    },
    {
      name: 'contracts-only-in-infrastructure',
      severity: 'error',
      from: { pathNot: '^src/(features/[^/]+|shared)/infrastructure/' },
      to: { path: 'backend/src/contracts/' },
    },
    {
      name: 'shared-ui-is-generic',
      severity: 'error',
      from: { path: '^src/shared/ui/' },
      to: { pathNot: ['^src/shared/ui/', '^node_modules/(react|clsx|tailwind-merge|motion|lucide-react)/'] },
    },
    {
      name: 'features-meet-only-at-index',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/', pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'] },
    },
    {
      name: 'pages-use-feature-index',
      severity: 'error',
      from: { path: '^src/pages/' },
      to: { path: '^src/features/', pathNot: '^src/features/[^/]+/index\\.ts$' },
    },
    {
      name: 'nothing-reaches-up',
      comment: 'shared knows no feature, page or app; features know no page or app.',
      severity: 'error',
      from: { path: '^src/(shared|features)/' },
      to: { path: '^src/(pages|app)/' },
    },
    {
      name: 'shared-knows-no-feature',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'pages-not-to-infrastructure',
      comment: 'Pages compose features. Network and wire-format code stays in infrastructure.',
      severity: 'error',
      from: { path: '^src/pages/' },
      to: { path: '(^src/shared/infrastructure/|^node_modules/axios/|backend/src/contracts/)' },
    },
    {
      name: 'only-layer-folders',
      comment:
        'Code in a feature lives in one of the four layers (or its index.ts); shared/ holds only '
        + 'domain, application, infrastructure and ui. A folder outside them would be outside every rule above.',
      severity: 'error',
      from: {},
      to: {
        path: '^src/(features/[^/]+|shared)/',
        pathNot: [
          '^src/features/[^/]+/(domain|application|infrastructure|presentation)/',
          '^src/features/[^/]+/index\\.ts$',
          '^src/shared/(domain|application|infrastructure|ui)/',
        ],
      },
    },
    {
      name: 'only-layer-folders-import',
      comment: 'The same rule from the importing side, so an unimported stray file is caught too.',
      severity: 'error',
      from: {
        path: '^src/(features/[^/]+|shared)/',
        pathNot: [
          '^src/features/[^/]+/(domain|application|infrastructure|presentation)/',
          '^src/features/[^/]+/index\\.ts$',
          '^src/shared/(domain|application|infrastructure|ui)/',
        ],
      },
      to: {},
    },
    {
      name: 'test-doubles-only-in-tests',
      comment: 'Fakes in a testing/ folder are for tests. Production code never imports them.',
      severity: 'error',
      from: { pathNot: '/testing/' },
      to: { path: '/testing/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'virtual: modules come from Vite plugins and have no file.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: '^virtual:' },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', 'backend/src/contracts'] },
    exclude: { path: ['\\.test\\.tsx?$', '^src/test/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'browser', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
````

**Check:** `grep -c "tailwind-merge|motion|lucide-react" .dependency-cruiser.cjs` prints `1`.

### Step 6.1.24 — Remove the old icons and the unused logo original

**Action:** run:

```bash
git rm -q public/pwa-64x64.png public/pwa-192x192.png public/pwa-512x512.png public/maskable-icon-512x512.png public/apple-touch-icon-180x180.png public/favicon.ico public/icon.svg public/brand/source-one-logo.png
```

**Check:** `ls public` prints only `brand`, and `ls public/brand` prints
`app-icon.png  mark.png  wordmark.png`.

### Step 6.1.25 — Add the icon generator's settings

**Action:** create `frontend/pwa-assets.config.ts` with exactly:

````ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * PWA icons from public/brand/app-icon.png, written beside it.
 * The source is already full-bleed near-black with the mark inside the
 * maskable safe zone, so no icon gets extra padding or a white background.
 * Run `npm run pwa:icons` after changing the source.
 */
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#0b0c0b' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#0b0c0b' } },
  },
  images: ['public/brand/app-icon.png'],
});
````

**Check:** `ls pwa-assets.config.ts` prints the path.

### Step 6.1.26 — Point the scripts at the new icon source

**Action:** replace the whole of `frontend/package.json` with exactly:

````json
{
  "name": "@s1-gateway/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": "^22 || ^24"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b",
    "lint": "oxlint --deny-warnings src",
    "arch:check": "depcruise src --config .dependency-cruiser.cjs",
    "test": "vitest run",
    "pwa:icons": "pwa-assets-generator"
  },
  "dependencies": {
    "@fontsource-variable/geist-mono": "^5.3.0",
    "@fontsource/poppins": "^5.3.0",
    "@tanstack/react-query": "^5.102.8",
    "axios": "^1.20.0",
    "clsx": "^2.1.1",
    "lucide-react": "^1.57.0",
    "motion": "^14.2.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-router-dom": "^7.18.3",
    "tailwind-merge": "^3.7.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@testing-library/dom": "^10.4.2",
    "@testing-library/react": "^16.3.3",
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.7",
    "@vite-pwa/assets-generator": "^2.0.0",
    "@vitejs/plugin-react": "^6.1.1",
    "dependency-cruiser": "^18.6.0",
    "happy-dom": "^20.14.5",
    "oxlint": "^1.83.0",
    "tailwindcss": "^4.3.3",
    "typescript": "~6.0.2",
    "vite": "^8.3.0",
    "vite-plugin-pwa": "^2.0.0",
    "vitest": "^5.0.1",
    "workbox-window": "^7.4.1"
  }
}
````

Then replace the whole of `frontend/tsconfig.node.json` with exactly:

````json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "skipLibCheck": true,
    "module": "nodenext",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "pwa-assets.config.ts"]
}
````

**Check:** `grep '"pwa:icons"' package.json` prints `"pwa:icons": "pwa-assets-generator"`,
and `git diff --stat package-lock.json` prints nothing (the lockfile does not change).

### Step 6.1.27 — Generate the app icons

**Action:** run `npm run pwa:icons`.

**Check:** the output ends with `PWA assets generated`, and `ls public/brand` prints exactly:
`app-icon.png  apple-touch-icon-180x180.png  favicon.ico  mark.png  maskable-icon-512x512.png  pwa-192x192.png  pwa-512x512.png  pwa-64x64.png  wordmark.png`.

### Step 6.1.28 — Point the PWA at the new icons and colours

**Action:** replace the whole of `frontend/vite.config.ts` with exactly:

````ts
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A new worker waits for the user to choose Reload — never swaps
      // under an open tab (ADR 0010).
      registerType: 'prompt',
      // Registered by useRegisterSW in <UpdatePrompt />.
      injectRegister: false,
      // The kill switch: build with PWA_SELF_DESTROY=true to ship a worker
      // that unregisters itself and clears its caches.
      selfDestroying: process.env.PWA_SELF_DESTROY === 'true',
      // globPatterns already precaches every icon; listing them twice is noise.
      includeManifestIcons: false,
      manifest: {
        name: 'S1 Gateway',
        short_name: 'S1 Gateway',
        description: "Source One Global's internal staff hub",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0c0b',
        theme_color: '#0b0c0b',
        icons: [
          { src: 'brand/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'brand/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'brand/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'brand/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell only. API responses are never cached (ADR 0010).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The icon source is for `npm run pwa:icons`, not for the app.
        globIgnores: [
          'brand/app-icon.png',
          // Geist Mono ships every script; staff text is Latin. The other
          // subsets still load on demand, they are just not precached.
          '**/geist-mono-{cyrillic,cyrillic-ext,latin-ext,vietnamese,symbols2}-*.woff2',
        ],
        navigateFallback: '/index.html',
        // An API request must never be answered with the cached HTML shell.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      // No worker in development, so `npm run dev:web` never serves a stale cache.
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // One origin in development: the browser talks to Vite, Vite to the API.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
````

**Check:** `grep -c "brand/" vite.config.ts` prints `5`.

### Step 6.1.29 — Move three components off the removed class names

The new tokens remove `rounded-box` and `text-accent`. Three existing files
use them; these versions use `rounded-surface` and `text-accent-ink` instead.
(All three are replaced again, fully restyled, in stage 2.)

**Action:** replace the whole of `frontend/src/app/pwa/UpdatePrompt.tsx` with exactly:

````tsx
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/shared/ui/Button';

/** A new version waits until the user chooses to reload (ADR 0010). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center gap-3 rounded-surface border border-border bg-surface-raised p-4"
    >
      <p className="flex-1 text-sm">A new version of the Gateway is ready.</p>
      <Button variant="secondary" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button onClick={() => void updateServiceWorker(true)}>Reload</Button>
    </div>
  );
}
````

Replace the whole of `frontend/src/features/tools/presentation/ToolCard.tsx` with exactly:

````tsx
import { Card } from '@/shared/ui/Card';
import { isWebUrl } from '../domain/is-web-url';
import type { Tool } from '../domain/tool';

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Card className="flex h-full flex-col gap-1">
      {isWebUrl(tool.url) ? (
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent-ink hover:underline"
        >
          {tool.name}
        </a>
      ) : (
        <span className="font-medium">{tool.name}</span>
      )}
      {tool.description && <p className="text-sm text-ink-muted">{tool.description}</p>}
    </Card>
  );
}
````

Replace the whole of `frontend/src/pages/NotFoundPage.tsx` with exactly:

````tsx
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-muted">
        There is nothing at this address. <Link to="/" className="text-accent-ink hover:underline">Go to the hub</Link>.
      </p>
    </main>
  );
}
````

**Check:** `git grep -nE "rounded-box|accent-strong|accent-contrast|text-accent( |\")|outline-accent" -- src; echo "exit=$?"`
prints only `exit=1` (no matches).

### Step 6.1.30 — Run every check for stage 1

**Action:** run:

```bash
npm run typecheck > /dev/null 2>&1; echo "typecheck=$?"
npm run lint > /dev/null 2>&1; echo "lint=$?"
npm run arch:check 2>&1 | grep -E "violation"
npm test 2>&1 | grep -E "Tests |Test Files"
npm run build 2>&1 | grep -E "precache|index-.*\.js"
```

**Check:** exactly — `typecheck=0`; `lint=0`;
`✔ no dependency violations found (62 modules, 111 dependencies cruised)`;
`Test Files  11 passed (11)` and `Tests  48 passed (48)`; and the build lines
show `precache  18 entries` and an `index-….js` whose gzip size is at most
`170 kB`. Then go to section 7 and ship stage 1.

## 6b. Stage 2 — icons, the shell, transitions, skeletons and the Tools page

Start only after the owner wrote "continue to stage 2".

### Step 6.2.1 — Add the icon licence note

**Action:** create `frontend/src/shared/ui/icons/LUCIDE-LICENSE.txt` with exactly:

````text
The paths of the icons in this folder are taken from Lucide (https://lucide.dev).
The animation is this project's own. Lucide's licence follows.

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
````

**Check:** `head -1 src/shared/ui/icons/LUCIDE-LICENSE.txt` prints
`The paths of the icons in this folder are taken from Lucide (https://lucide.dev).`

### Step 6.2.2 — Add the icon frame

**Action:** create `frontend/src/shared/ui/icons/icon-svg.tsx` with exactly:

````tsx
import type { CSSProperties, ReactNode } from 'react';
import * as m from 'motion/react-m';

export interface IconProps {
  /** Pixels. Default 18. */
  size?: number;
  className?: string;
}

/**
 * The frame every animated icon is drawn in: Lucide's 24px grid and stroke.
 * It has no animation of its own — it passes the `rest` / `active` state set
 * by the element around it down to each stroke (ADR 0012).
 */
export function IconSvg({ size = 18, className, children }: IconProps & { children: ReactNode }) {
  return (
    <m.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ overflow: 'visible' }}
    >
      {children}
    </m.svg>
  );
}

/** Rotate and scale a stroke about its own centre. */
export const ownCentre: CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' };

/** Rotate a group of strokes about the centre of the icon. */
export const iconCentre: CSSProperties = { transformBox: 'view-box', transformOrigin: '12px 12px' };
````

**Check:** `ls src/shared/ui/icons/icon-svg.tsx` prints the path.

### Step 6.2.3 — Write the icons test first

**Action:** create `frontend/src/shared/ui/icons/icons.test.tsx` with exactly:

````tsx
import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import type { IconProps } from './icon-svg';
import {
  AlertIcon,
  CheckIcon,
  ExternalLinkIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  RefreshIcon,
  SidebarIcon,
  SunIcon,
  ThemeIcon,
  ToolsIcon,
  WifiOffIcon,
} from './index';

/** Icon, and how many separately drawn strokes it has. */
const ICONS: [string, ComponentType<IconProps>, number][] = [
  ['ToolsIcon', ToolsIcon, 4],
  ['ThemeIcon', ThemeIcon, 5],
  ['SunIcon', SunIcon, 9],
  ['MoonIcon', MoonIcon, 3],
  ['MonitorIcon', MonitorIcon, 3],
  ['ExternalLinkIcon', ExternalLinkIcon, 3],
  ['PlusIcon', PlusIcon, 2],
  ['SidebarIcon', SidebarIcon, 3],
  ['CheckIcon', CheckIcon, 1],
  ['AlertIcon', AlertIcon, 3],
  ['RefreshIcon', RefreshIcon, 4],
  ['WifiOffIcon', WifiOffIcon, 7],
];

describe.each(ICONS)('%s', (_name, Icon, strokes) => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Icon />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws each stroke as its own element', () => {
    const { container } = render(<Icon />);
    expect(container.querySelectorAll('path, rect, circle, line')).toHaveLength(strokes);
  });

  it('takes a size', () => {
    const { container } = render(<Icon size={24} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('24');
  });
});
````

**Check:** `npx vitest run src/shared/ui/icons` fails, and its output contains
`Failed to resolve import "./index"`.

### Step 6.2.4 — Add the twelve animated icons

**Action:** create `frontend/src/shared/ui/icons/icons.tsx` with exactly:

````tsx
import type { Variants } from 'motion/react';
import * as m from 'motion/react-m';
import { ease } from '../motion';
import { IconSvg, iconCentre, ownCentre, type IconProps } from './icon-svg';

/*
 * Stroke-animated icons — ADR 0012. Paths from Lucide (see LUCIDE-LICENSE.txt).
 *
 * Every stroke is its own element with its own variants. `rest` is the drawn
 * icon; `active` is a short keyframe sequence that always ends back on the
 * rest pose, so an icon left in `active` (a nav item on the current page)
 * looks exactly like one at rest. Nothing loops.
 */

const SNAP = { duration: 0 };

/* ---------------------------------------------------------------- Tools -- */

/** Four app tiles; each dips and springs back in turn, clockwise. */
const tile: Variants = {
  rest: { scale: 1 },
  active: (order: number) => ({
    scale: [1, 0.55, 1.08, 1],
    transition: { duration: 0.5, delay: order * 0.06, ease: ease.standard },
  }),
};

export function ToolsIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.rect custom={0} variants={tile} style={ownCentre} width="7" height="7" x="3" y="3" rx="1" />
      <m.rect custom={1} variants={tile} style={ownCentre} width="7" height="7" x="14" y="3" rx="1" />
      <m.rect custom={2} variants={tile} style={ownCentre} width="7" height="7" x="14" y="14" rx="1" />
      <m.rect custom={3} variants={tile} style={ownCentre} width="7" height="7" x="3" y="14" rx="1" />
    </IconSvg>
  );
}

/* ---------------------------------------------------------------- Theme -- */

/** The palette stays; its four paint dots pop in sequence. */
const paint: Variants = {
  rest: { scale: 1 },
  active: (order: number) => ({
    scale: [1, 0, 1.6, 1],
    transition: { duration: 0.45, delay: 0.05 + order * 0.07, ease: ease.standard },
  }),
};

export function ThemeIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <m.circle custom={0} variants={paint} style={ownCentre} cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <m.circle custom={1} variants={paint} style={ownCentre} cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <m.circle custom={2} variants={paint} style={ownCentre} cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <m.circle custom={3} variants={paint} style={ownCentre} cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    </IconSvg>
  );
}

/* ------------------------------------------------------------------ Sun -- */

const core: Variants = {
  rest: { scale: 1 },
  active: { scale: [1, 0.78, 1], transition: { duration: 0.45, ease: ease.standard } },
};

/** Each ray retracts and grows back in turn, clockwise from the top. */
const ray: Variants = {
  rest: { pathLength: 1, opacity: 1 },
  active: (order: number) => ({
    pathLength: [1, 0, 1],
    opacity: [1, 0, 1],
    transition: { duration: 0.4, delay: order * 0.04, ease: ease.standard },
  }),
};

const SUN_RAYS = [
  'M12 2v2',
  'm19.07 4.93-1.41 1.41',
  'M20 12h2',
  'm17.66 17.66 1.41 1.41',
  'M12 20v2',
  'm6.34 17.66-1.41 1.41',
  'M2 12h2',
  'm4.93 4.93 1.41 1.41',
];

export function SunIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.circle variants={core} style={ownCentre} cx="12" cy="12" r="4" />
      {SUN_RAYS.map((d, order) => (
        <m.path key={d} custom={order} variants={ray} d={d} />
      ))}
    </IconSvg>
  );
}

/* ----------------------------------------------------------------- Moon -- */

/** The crescent rocks; its star blinks out and back. */
const crescent: Variants = {
  rest: { rotate: 0 },
  active: { rotate: [0, -18, 8, 0], transition: { duration: 0.55, ease: ease.standard } },
};

const star: Variants = {
  rest: { scale: 1, opacity: 1 },
  active: {
    scale: [1, 0, 1.3, 1],
    opacity: [1, 0, 1, 1],
    transition: { duration: 0.45, delay: 0.12, ease: ease.standard },
  },
};

export function MoonIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.path
        variants={crescent}
        style={ownCentre}
        d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
      />
      <m.g variants={star} style={ownCentre}>
        <path d="M18 5h4" />
        <path d="M20 3v4" />
      </m.g>
    </IconSvg>
  );
}

/* -------------------------------------------------------------- Monitor -- */

/** The screen redraws; the stand drops into place under it. */
const screen: Variants = {
  rest: { pathLength: 1 },
  active: { pathLength: [1, 0, 1], transition: { duration: 0.55, ease: ease.standard } },
};

const stand: Variants = {
  rest: { y: 0, opacity: 1 },
  active: {
    y: [0, -3, 0],
    opacity: [1, 0, 1],
    transition: { duration: 0.4, delay: 0.18, ease: ease.standard },
  },
};

export function MonitorIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.rect variants={screen} width="20" height="14" x="2" y="3" rx="2" />
      <m.g variants={stand}>
        <line x1="8" x2="16" y1="21" y2="21" />
        <line x1="12" x2="12" y1="17" y2="21" />
      </m.g>
    </IconSvg>
  );
}

/* -------------------------------------------------------- External link -- */

/** The arrow leaves through the corner and comes back in from inside the box. */
const arrow: Variants = {
  rest: { x: 0, y: 0, opacity: 1 },
  active: {
    x: [0, 5, -5, 0],
    y: [0, -5, 5, 0],
    opacity: [1, 0, 0, 1],
    transition: { duration: 0.5, times: [0, 0.35, 0.36, 1], ease: ease.standard },
  },
};

export function ExternalLinkIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.g variants={arrow}>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
      </m.g>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </IconSvg>
  );
}

/* ----------------------------------------------------------------- Plus -- */

/** The horizontal stroke redraws, then the vertical. */
const bar: Variants = {
  rest: { pathLength: 1 },
  active: (order: number) => ({
    pathLength: [1, 0, 1],
    transition: { duration: 0.35, delay: order * 0.1, ease: ease.standard },
  }),
};

export function PlusIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.path custom={0} variants={bar} d="M5 12h14" />
      <m.path custom={1} variants={bar} d="M12 5v14" />
    </IconSvg>
  );
}

/* -------------------------------------------------------------- Sidebar -- */

/** The panel stays; the chevron nudges the way the sidebar will move. */
const nudge: Variants = {
  rest: { x: 0 },
  active: (direction: number) => ({
    x: [0, direction * 2.5, 0],
    transition: { duration: 0.4, ease: ease.standard },
  }),
};

export function SidebarIcon({ collapsed = false, ...props }: IconProps & { collapsed?: boolean }) {
  return (
    <IconSvg {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <m.path custom={collapsed ? 1 : -1} variants={nudge} d={collapsed ? 'm14 9 3 3-3 3' : 'm16 15-3-3 3-3'} />
    </IconSvg>
  );
}

/* ---------------------------------------------------------------- Check -- */

const tick: Variants = {
  rest: { pathLength: 1 },
  active: { pathLength: [0, 1], transition: { duration: 0.35, ease: ease.emphasized } },
};

export function CheckIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.path variants={tick} d="M20 6 9 17l-5-5" />
    </IconSvg>
  );
}

/* ---------------------------------------------------------------- Alert -- */

/** The ring shakes; the mark inside drops and settles. */
const ring: Variants = {
  rest: { x: 0 },
  active: { x: [0, -1.5, 1.5, -1, 0], transition: { duration: 0.4, ease: 'easeInOut' } },
};

const mark: Variants = {
  rest: { y: 0 },
  active: { y: [0, -1.5, 0], transition: { duration: 0.35, delay: 0.1, ease: ease.standard } },
};

export function AlertIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.circle variants={ring} cx="12" cy="12" r="10" />
      <m.g variants={mark}>
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </m.g>
    </IconSvg>
  );
}

/* -------------------------------------------------------------- Refresh -- */

/**
 * Each half turns a half-turn about the centre, the second a beat behind.
 * The icon is symmetric under a half-turn, so `rest` snaps back unseen.
 */
const half: Variants = {
  rest: { rotate: 0, transition: SNAP },
  active: (order: number) => ({
    rotate: 180,
    transition: { duration: 0.5, delay: order * 0.06, ease: ease.emphasized },
  }),
};

export function RefreshIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.g custom={0} variants={half} style={iconCentre}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </m.g>
      <m.g custom={1} variants={half} style={iconCentre}>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </m.g>
    </IconSvg>
  );
}

/* -------------------------------------------------------------- Offline -- */

/** The signal fades out from the outermost arc in; the slash redraws. */
const signal: Variants = {
  rest: { opacity: 1 },
  active: (order: number) => ({
    opacity: [1, 0.15, 1],
    transition: { duration: 0.6, delay: order * 0.08, ease: 'easeInOut' },
  }),
};

const slash: Variants = {
  rest: { pathLength: 1 },
  active: { pathLength: [1, 0, 1], transition: { duration: 0.5, ease: ease.standard } },
};

export function WifiOffIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.path custom={3} variants={signal} d="M12 20h.01" />
      <m.path custom={2} variants={signal} d="M8.5 16.429a5 5 0 0 1 7 0" />
      <m.path custom={1} variants={signal} d="M5 12.859a10 10 0 0 1 5.17-2.69" />
      <m.path custom={1} variants={signal} d="M19 12.859a10 10 0 0 0-2.007-1.523" />
      <m.path custom={0} variants={signal} d="M2 8.82a15 15 0 0 1 4.177-2.643" />
      <m.path custom={0} variants={signal} d="M22 8.82a15 15 0 0 0-11.288-3.764" />
      <m.path variants={slash} d="m2 2 20 20" />
    </IconSvg>
  );
}
````

Then create `frontend/src/shared/ui/icons/index.ts` with exactly:

````ts
export type { IconProps } from './icon-svg';
export {
  AlertIcon,
  CheckIcon,
  ExternalLinkIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  RefreshIcon,
  SidebarIcon,
  SunIcon,
  ThemeIcon,
  ToolsIcon,
  WifiOffIcon,
} from './icons';
````

**Check:** `npx vitest run src/shared/ui/icons` prints `Tests  36 passed (36)`.

### Step 6.2.5 — Add the segmented control

**Action:** create `frontend/src/shared/ui/SegmentedControl.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';
import { iconTrigger } from './motion';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive technology. */
  label: string;
  value: T;
  options: readonly SegmentedOption<NoInfer<T>>[];
  onChange(value: NoInfer<T>): void;
  /** Show icons only; each label becomes the option's accessible name and tooltip. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * A row of mutually exclusive choices — a radio group. The selected option
 * sits on a pill that slides between options; arrow keys move the selection.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  iconOnly = false,
  className,
}: SegmentedControlProps<T>) {
  const pillId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-control border border-border bg-surface-sunken p-0.5', className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <m.button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            {...iconTrigger}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'relative inline-flex h-7 items-center justify-center gap-1.5 rounded-control text-sm font-medium transition-colors duration-150 ease-standard',
              iconOnly ? 'w-8' : 'px-3',
              selected ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {selected && (
              <m.span
                layoutId={pillId}
                aria-hidden="true"
                className="absolute inset-0 rounded-control border border-border bg-surface shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {option.icon}
              {!iconOnly && option.label}
            </span>
          </m.button>
        );
      })}
    </div>
  );
}
````

**Check:** `grep -c "NoInfer" src/shared/ui/SegmentedControl.tsx` prints `2`.

### Step 6.2.6 — Write the theme switch test first

**Action:** create `frontend/src/features/appearance/presentation/ThemeSwitch.test.tsx` with exactly:

````tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ThemeDocument, ThemePreferenceStore } from '../application/theme-ports';
import { ThemeProvider } from '../application/theme-context';
import type { ResolvedTheme, ThemePreference } from '../domain/theme';
import { ThemeSwitch } from './ThemeSwitch';

function setup(initial: ThemePreference) {
  const stored: ThemePreference[] = [initial];
  const applied: ResolvedTheme[] = [];
  const store: ThemePreferenceStore = {
    read: () => stored.at(-1) ?? 'system',
    write: (preference) => {
      stored.push(preference);
    },
  };
  const document: ThemeDocument = {
    prefersDark: () => false,
    subscribe: () => () => undefined,
    apply: (theme) => {
      applied.push(theme);
    },
    transition: (update) => update(),
  };
  render(
    <ThemeProvider store={store} document={document}>
      <ThemeSwitch />
    </ThemeProvider>,
  );
  return { stored, applied };
}

describe('ThemeSwitch', () => {
  it('offers the three choices, with the current one checked', () => {
    setup('system');
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Match device' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('false');
  });

  it('remembers and applies a choice', () => {
    const { stored, applied } = setup('light');
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(stored.at(-1)).toBe('dark');
    expect(applied.at(-1)).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
  });

  it('moves the choice with the arrow keys', () => {
    const { stored } = setup('light');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Light' }), { key: 'ArrowRight' });
    expect(stored.at(-1)).toBe('dark');
  });
});
````

**Check:** `npx vitest run src/features/appearance/presentation` fails, and its
output contains `Failed to resolve import "./ThemeSwitch"`.

### Step 6.2.7 — Add the theme switch

**Action:** create `frontend/src/features/appearance/presentation/ThemeSwitch.tsx` with exactly:

````tsx
import { MonitorIcon, MoonIcon, SunIcon } from '@/shared/ui/icons';
import { SegmentedControl, type SegmentedOption } from '@/shared/ui/SegmentedControl';
import { useTheme } from '../application/theme-context';
import type { ThemePreference } from '../domain/theme';

const OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'light', label: 'Light', icon: <SunIcon size={16} /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon size={16} /> },
  { value: 'system', label: 'Match device', icon: <MonitorIcon size={16} /> },
];

export function ThemeSwitch({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      label="Theme"
      iconOnly
      value={preference}
      options={OPTIONS}
      onChange={setPreference}
      className={className}
    />
  );
}
````

Then replace the whole of `frontend/src/features/appearance/index.ts` with exactly:

````ts
export type { ResolvedTheme, ThemePreference } from './domain/theme';
export { THEME_PREFERENCES } from './domain/theme';
export type { ThemeDocument, ThemePreferenceStore } from './application/theme-ports';
export { ThemeProvider, useTheme } from './application/theme-context';
export { BrowserThemeDocument } from './infrastructure/browser-theme-document';
export {
  LocalStorageThemePreferenceStore,
  THEME_STORAGE_KEY,
  browserLocalStorage,
} from './infrastructure/local-storage-theme-preference-store';
export { ThemeSwitch } from './presentation/ThemeSwitch';
````

**Check:** `npx vitest run src/features/appearance/presentation` prints `Tests  3 passed (3)`.

### Step 6.2.8 — Write the skeleton test first

**Action:** create `frontend/src/shared/ui/Skeleton.test.tsx` with exactly:

````tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SKELETON_DELAY_MS, SkeletonBlock, SkeletonRegion } from './Skeleton';

describe('SkeletonRegion', () => {
  it('is announced once, as loading what it stands for', () => {
    render(
      <SkeletonRegion label="tools">
        <SkeletonBlock />
      </SkeletonRegion>,
    );
    const region = screen.getByRole('status', { name: 'Loading tools' });
    expect(region.getAttribute('aria-busy')).toBe('true');
  });

  it('stays invisible for its first 150ms, so a fast load never shows it', () => {
    render(
      <SkeletonRegion label="tools">
        <SkeletonBlock />
      </SkeletonRegion>,
    );
    expect(SKELETON_DELAY_MS).toBe(150);
    expect(screen.getByRole('status').style.animationDelay).toBe('150ms');
  });
});

describe('SkeletonBlock', () => {
  it('fades in after the region, staggered by its order, and shares one shimmer', () => {
    const { container } = render(<SkeletonBlock order={2} />);
    const block = container.firstElementChild as HTMLElement;
    expect(block.style.animationDelay).toBe('210ms, 0ms');
    expect(block.getAttribute('aria-hidden')).toBe('true');
  });
});
````

**Check:** `npx vitest run src/shared/ui/Skeleton` fails, and its output contains
`Failed to resolve import "./Skeleton"`.

### Step 6.2.9 — Add the skeleton primitives

**Action:** create `frontend/src/shared/ui/Skeleton.tsx` with exactly:

````tsx
import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * How long a skeleton stays invisible (ADR 0013). A load faster than this
 * never shows one. The fade itself is CSS (`.skeleton-region` in index.css).
 */
export const SKELETON_DELAY_MS = 150;

/** Gap between one block fading in and the next, top to bottom. */
const STAGGER_MS = 30;

/** Wraps a page-shaped skeleton. Announced once as "Loading <label>". */
export function SkeletonRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`Loading ${label}`}
      className={cn('skeleton-region', className)}
      style={{ animationDelay: `${SKELETON_DELAY_MS}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * One grey block. `order` staggers its fade-in. Size it with classes exactly
 * as the real element is sized, so nothing moves when the page arrives.
 */
export function SkeletonBlock({ className, order = 0 }: { className?: string; order?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton-block', className)}
      // The second value is the shimmer's delay: none, so every block shares one sweep.
      style={{ animationDelay: `${SKELETON_DELAY_MS + order * STAGGER_MS}ms, 0ms` }}
    />
  );
}

/** Line boxes, from the type scale in theme.css. */
const LINE: Record<'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl', string> = {
  xs: 'h-4 text-xs',
  sm: 'h-5 text-sm',
  base: 'h-[22px] text-base',
  md: 'h-6 text-md',
  lg: 'h-7 text-lg',
  xl: 'h-8 text-xl',
  '2xl': 'h-10 text-2xl',
};

/**
 * A line of text: a bar the height of the letters, centred in a box the height
 * of the line, so it takes exactly the space the text will.
 */
export function SkeletonText({
  size = 'base',
  className,
  order = 0,
}: {
  size?: keyof typeof LINE;
  /** Width classes, e.g. `w-48` or `w-2/3`. */
  className?: string;
  order?: number;
}) {
  return (
    <div aria-hidden="true" className={cn('flex items-center', LINE[size], className)}>
      <SkeletonBlock order={order} className="h-[0.7em] w-full rounded-full" />
    </div>
  );
}
````

**Check:** `npx vitest run src/shared/ui/Skeleton` prints `Tests  3 passed (3)`.

### Step 6.2.10 — Add the error state

**Action:** create `frontend/src/shared/ui/ErrorState.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import { Button } from './Button';
import { cn } from './cn';
import { AlertIcon, RefreshIcon } from './icons';

export interface ErrorStateProps {
  title?: string;
  /** The reason, in a sentence. Usually the AppError's message. */
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** A calm failure in the frame the content would have filled — never a blank page. */
export function ErrorState({ title = 'This could not load.', message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-4 rounded-surface border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center',
        className,
      )}
    >
      <m.span
        initial="rest"
        animate="active"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
      >
        <AlertIcon size={20} />
      </m.span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-md font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-muted">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshIcon size={16} />
          Try again
        </Button>
      )}
    </div>
  );
}
````

**Check:** `ls src/shared/ui/ErrorState.tsx` prints the path.

### Step 6.2.11 — Add the error boundary

**Action:** create `frontend/src/shared/ui/ErrorBoundary.tsx` with exactly:

````tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Drawn in place of the children after a render error. `retry` clears it. */
  fallback(error: unknown, retry: () => void): ReactNode;
  /** Called before a retry, e.g. to reset failed queries. */
  onReset?(): void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
  error: unknown;
}

/** Catches a render error below it and draws `fallback` instead of a blank page. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Kept visible in the console for whoever is debugging; the user sees the fallback.
    console.error(error, info.componentStack);
  }

  retry = (): void => {
    this.props.onReset?.();
    this.setState({ failed: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.failed) return this.props.fallback(this.state.error, this.retry);
    return this.props.children;
  }
}
````

**Check:** `ls src/shared/ui/ErrorBoundary.tsx` prints the path.

### Step 6.2.12 — Add the page header

**Action:** create `frontend/src/shared/ui/PageHeader.tsx` with exactly:

````tsx
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** The page's one primary action, at the right. */
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="text-base text-ink-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
````

**Check:** `ls src/shared/ui/PageHeader.tsx` prints the path.

### Step 6.2.13 — Add the empty state

**Action:** create `frontend/src/shared/ui/EmptyState.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { iconTrigger } from './motion';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

/** Nothing here yet: one sentence about what goes here, and how to add it. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <m.div
      {...iconTrigger}
      className="flex flex-col items-center gap-4 rounded-surface border border-dashed border-border-strong px-6 py-16 text-center"
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">{icon}</span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-md font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </m.div>
  );
}
````

**Check:** `npm run typecheck > /dev/null 2>&1; echo "exit=$?"` prints `exit=0`.

### Step 6.2.14 — Write the sheet test first

**Action:** create `frontend/src/shared/ui/Sheet.test.tsx` with exactly:

````tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('is closed until asked to open', () => {
    render(
      <Sheet open={false} onClose={() => undefined} title="Add a tool">
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a dialog named by its title', () => {
    render(
      <Sheet open onClose={() => undefined} title="Add a tool" description="It appears for everyone.">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add a tool' });
    expect((dialog as HTMLDialogElement).open).toBe(true);
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('asks to close from its close button', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Add a tool">
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
````

**Check:** `npx vitest run src/shared/ui/Sheet` fails, and its output contains
`Failed to resolve import "./Sheet"`.

### Step 6.2.15 — Add the sheet

**Action:** create `frontend/src/shared/ui/Sheet.tsx` with exactly:

````tsx
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface SheetProps {
  open: boolean;
  onClose(): void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A panel that slides in from the right over a frosted backdrop. Built on the
 * native <dialog>, which traps focus, closes on Escape and restores focus to
 * the button that opened it.
 */
export function Sheet({ open, onClose, title, description, children, className }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // A click on the backdrop lands on the <dialog> itself, never on its content.
  function onClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={onClick}
      className={cn(
        'm-0 ml-auto h-dvh max-h-dvh w-full max-w-md border-l border-border bg-surface p-0 text-ink shadow-lg',
        'open:animate-[sheet-in_280ms_var(--ease-emphasized)]',
        'backdrop:bg-canvas/70 backdrop:backdrop-blur-sm open:backdrop:animate-[backdrop-in_200ms_var(--ease-standard)]',
        className,
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface-sunken hover:text-ink"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </dialog>
  );
}
````

**Check:** `npx vitest run src/shared/ui/Sheet` prints `Tests  3 passed (3)`.

### Step 6.2.16 — Write the tool host test first

**Action:** create `frontend/src/features/tools/domain/tool-host.test.ts` with exactly:

````ts
import { describe, expect, it } from 'vitest';
import { toolHost } from './tool-host';

describe('toolHost', () => {
  it('shows the host without a leading www', () => {
    expect(toolHost('https://www.payroll.example.com/login?x=1')).toBe('payroll.example.com');
  });

  it('keeps a port, which tells two internal services apart', () => {
    expect(toolHost('http://intranet.local:8080/a')).toBe('intranet.local:8080');
  });

  it('returns the text unchanged when it is not a URL', () => {
    expect(toolHost('not a url')).toBe('not a url');
  });
});
````

**Check:** `npx vitest run src/features/tools/domain/tool-host` fails, and its
output contains `Failed to resolve import "./tool-host"`.

### Step 6.2.17 — Add the tool host

**Action:** create `frontend/src/features/tools/domain/tool-host.ts` with exactly:

````ts
/** The part of a tool's address a person recognises: `payroll.example.com`. */
export function toolHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}
````

**Check:** `npx vitest run src/features/tools/domain/tool-host` prints `Tests  3 passed (3)`.

### Step 6.2.18 — Load tools through suspense

**Action:** replace the whole of `frontend/src/features/tools/application/use-tools.ts` with exactly:

````ts
import { useSuspenseQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Tool } from '../domain/tool';
import { useToolsGateway } from './tools-gateway-context';
import { toolsKeys } from './tools.keys';

/**
 * Suspends until the tools arrive, so the route's skeleton covers both the
 * page's code and its data (ADR 0013). A failure is thrown to the nearest
 * error boundary.
 */
export function useTools() {
  const gateway = useToolsGateway();
  return useSuspenseQuery<Tool[], AppError>({
    queryKey: toolsKeys.list(),
    queryFn: () => gateway.list(),
  });
}
````

**Check:** `grep -c "useSuspenseQuery" src/features/tools/application/use-tools.ts` prints `2`.

### Step 6.2.19 — Restyle the tool card, list and form

**Action:** replace the whole of `frontend/src/features/tools/presentation/ToolCard.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import { useId } from 'react';
import { cn } from '@/shared/ui/cn';
import { ExternalLinkIcon } from '@/shared/ui/icons';
import { iconTrigger } from '@/shared/ui/motion';
import { isWebUrl } from '../domain/is-web-url';
import type { Tool } from '../domain/tool';
import { toolHost } from '../domain/tool-host';

const CARD = cn(
  'group flex h-full flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm',
  'transition-[border-color,box-shadow,transform] duration-200 ease-standard',
);

const INTERACTIVE = 'hover:-translate-y-px hover:border-border-strong hover:shadow-md';

/**
 * The whole card is the link, named by the tool's name alone. A URL that is
 * not http(s) is drawn as a plain card: never a link, never clickable.
 */
export function ToolCard({ tool }: { tool: Tool }) {
  const nameId = useId();
  const descriptionId = useId();
  const linkable = isWebUrl(tool.url);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-md font-semibold text-ink"
        >
          {tool.name.slice(0, 1).toUpperCase()}
        </span>
        {linkable && (
          <span className="text-ink-subtle transition-colors duration-150 ease-standard group-hover:text-accent-ink">
            <ExternalLinkIcon size={16} />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p id={nameId} className="truncate text-md font-medium text-ink">
          {tool.name}
        </p>
        <p className="truncate font-mono text-xs text-ink-subtle">{toolHost(tool.url)}</p>
      </div>
      {tool.description && (
        <p id={descriptionId} className="line-clamp-2 text-sm text-ink-muted">
          {tool.description}
        </p>
      )}
    </>
  );

  if (!linkable) return <div className={CARD}>{body}</div>;

  return (
    <m.a
      {...iconTrigger}
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-labelledby={nameId}
      aria-describedby={tool.description ? descriptionId : undefined}
      className={cn(CARD, INTERACTIVE)}
    >
      {body}
    </m.a>
  );
}
````

Replace the whole of `frontend/src/features/tools/presentation/ToolList.tsx` with exactly:

````tsx
import { Badge } from '@/shared/ui/Badge';
import { groupByCategory } from '../domain/group-by-category';
import type { Tool } from '../domain/tool';
import { ToolCard } from './ToolCard';

/** Tools grouped by category. The empty state belongs to the page, not to this list. */
export function ToolList({ tools }: { tools: readonly Tool[] }) {
  return (
    <div className="flex flex-col gap-10">
      {groupByCategory(tools).map((group) => (
        <section key={group.category.toLowerCase()} aria-label={group.category} className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink-muted">
            {group.category}
            <Badge>{group.tools.length}</Badge>
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.tools.map((tool) => (
              <li key={tool.id}>
                <ToolCard tool={tool} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
````

Replace the whole of `frontend/src/features/tools/presentation/CreateToolForm.tsx` with exactly:

````tsx
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { PlusIcon } from '@/shared/ui/icons';
import { TextField } from '@/shared/ui/TextField';
import { useCreateTool } from '../application/use-create-tool';
import type { NewTool } from '../domain/tool';

const EMPTY: NewTool = { name: '', url: '', description: '', category: '' };

export interface CreateToolFormProps {
  /** Called after the tool is saved. */
  onCreated?(): void;
  /** Shows a Cancel button that calls this. */
  onCancel?(): void;
}

export function CreateToolForm({ onCreated, onCancel }: CreateToolFormProps) {
  const [values, setValues] = useState<NewTool>(EMPTY);
  const createTool = useCreateTool();
  const fields = createTool.error?.fields ?? {};
  const hasFieldErrors = Object.keys(fields).length > 0;

  function update(field: keyof NewTool) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
    };
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTool.mutate(values, {
      onSuccess: () => {
        setValues(EMPTY);
        onCreated?.();
      },
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField label="Name" name="name" value={values.name} onChange={update('name')} errors={fields.name} maxLength={80} required />
      <TextField
        label="URL"
        name="url"
        type="url"
        value={values.url}
        onChange={update('url')}
        errors={fields.url}
        placeholder="https://"
        hint="The full address, starting with https://"
        required
      />
      <TextField
        label="Category"
        name="category"
        value={values.category}
        onChange={update('category')}
        errors={fields.category}
        maxLength={40}
        hint="Tools with the same category are shown together."
        required
      />
      <TextField
        label="Description"
        name="description"
        value={values.description}
        onChange={update('description')}
        errors={fields.description}
        maxLength={280}
        hint="Optional. One line about what it is for."
      />
      {createTool.error && !hasFieldErrors && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {createTool.error.message}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={createTool.isPending}>
          <PlusIcon size={16} />
          Add tool
        </Button>
      </div>
    </form>
  );
}
````

**Check:** `npx vitest run src/features/tools` prints `Tests  22 passed (22)`.

### Step 6.2.20 — Add the list of places

**Action:** create `frontend/src/app/nav.ts` with exactly:

````ts
import type { ComponentType } from 'react';
import { ThemeIcon, ToolsIcon, type IconProps } from '@/shared/ui/icons';

export interface NavItem {
  /** Absolute path. */
  path: string;
  /** In the sidebar, the bottom bar and the top bar. */
  label: string;
  icon: ComponentType<IconProps>;
}

/** Every place in the app, in the order the sidebar shows them. */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Tools', icon: ToolsIcon },
  { path: '/theme', label: 'Theme', icon: ThemeIcon },
];

/** The nav item a path belongs to, if any. */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.path === pathname);
}
````

**Check:** `ls src/app/nav.ts` prints the path.

### Step 6.2.21 — Remember the sidebar's fold

**Action:** create `frontend/src/app/shell/use-sidebar-collapsed.ts` with exactly:

````ts
import { useCallback, useState } from 'react';

export const SIDEBAR_STORAGE_KEY = 's1-gateway.sidebar';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/** Whether the sidebar is folded to its icon rail. Remembered per device. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'collapsed' : 'expanded');
      } catch {
        // Not remembered; it still folds for this visit.
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}
````

**Check:** `ls src/app/shell/use-sidebar-collapsed.ts` prints the path.

### Step 6.2.22 — Add the sidebar link

**Action:** create `frontend/src/app/shell/SidebarLink.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/ui/cn';
import type { NavItem } from '../nav';

const MotionLink = m.create(Link);

/**
 * One place in the sidebar. The current one sits on the lime pill, which
 * slides between items (ADR 0012); its icon plays once on arrival and on
 * hover. Folded to the rail, the label becomes a tooltip.
 */
export function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { pathname } = useLocation();
  const current = pathname === item.path;
  const Icon = item.icon;

  return (
    <MotionLink
      to={item.path}
      aria-current={current ? 'page' : undefined}
      initial="rest"
      animate={current ? 'active' : 'rest'}
      whileHover="active"
      whileFocus="active"
      className={cn(
        'group relative flex h-9 items-center gap-3 rounded-control px-2.5 text-sm font-medium outline-offset-0',
        current ? 'text-on-accent' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
      )}
    >
      {current && (
        <m.span
          layoutId="sidebar-pill"
          aria-hidden="true"
          className="absolute inset-0 rounded-control bg-accent shadow-sm"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <span className="relative shrink-0">
        <Icon size={18} />
      </span>
      <span className={cn('relative truncate', collapsed && 'sr-only')}>{item.label}</span>
      {collapsed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full z-20 ml-3 whitespace-nowrap rounded-control bg-ink px-2 py-1 text-xs font-medium text-canvas opacity-0 shadow-md transition-opacity duration-150 ease-standard group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {item.label}
        </span>
      )}
    </MotionLink>
  );
}
````

**Check:** `grep -c "sidebar-pill" src/app/shell/SidebarLink.tsx` prints `1`.

### Step 6.2.23 — Write the sidebar test first

**Action:** create `frontend/src/app/shell/Sidebar.test.tsx` with exactly:

````tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar';
import { SIDEBAR_STORAGE_KEY, useSidebarCollapsed } from './use-sidebar-collapsed';

function Harness() {
  const [collapsed, toggle] = useSidebarCollapsed();
  return <Sidebar collapsed={collapsed} onToggle={toggle} />;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>,
  );
}

beforeEach(() => window.localStorage.clear());

describe('Sidebar', () => {
  it('marks the current page', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Tools' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Theme' }).getAttribute('aria-current')).toBeNull();
  });

  it('folds to its rail and remembers it', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
    // Folded, the link keeps its name for assistive technology.
    expect(screen.getByRole('link', { name: 'Tools' })).toBeTruthy();
  });

  it('starts folded when it was left folded', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed');
    renderAt('/');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
  });
});
````

**Check:** `npx vitest run src/app/shell` fails, and its output contains
`Failed to resolve import "./Sidebar"`.

### Step 6.2.24 — Add the sidebar

**Action:** create `frontend/src/app/shell/Sidebar.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/ui/cn';
import { SidebarIcon } from '@/shared/ui/icons';
import { Logo } from '@/shared/ui/Logo';
import { duration, ease, iconTrigger } from '@/shared/ui/motion';
import { NAV_ITEMS } from '../nav';
import { SidebarLink } from './SidebarLink';

export const SIDEBAR_WIDTH = { expanded: 248, collapsed: 72 } as const;

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle(): void }) {
  return (
    <m.aside
      aria-label="Main"
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
      transition={{ duration: duration.slow, ease: ease.emphasized }}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface md:flex"
    >
      <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Link to="/" aria-label="Source One Gateway, home" className="rounded-control text-ink">
          {collapsed ? <Logo variant="mark" height={22} /> : <Logo variant="wordmark" height={22} />}
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <SidebarLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      <div className={cn('flex shrink-0 border-t border-border p-3', collapsed ? 'justify-center' : 'justify-end')}>
        <m.button
          {...iconTrigger}
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="inline-flex size-9 items-center justify-center rounded-control text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface-sunken hover:text-ink"
        >
          <SidebarIcon collapsed={collapsed} />
        </m.button>
      </div>
    </m.aside>
  );
}
````

**Check:** `npx vitest run src/app/shell` prints `Tests  3 passed (3)`.

### Step 6.2.25 — Add the top bar

**Action:** create `frontend/src/app/shell/TopBar.tsx` with exactly:

````tsx
import { useLocation } from 'react-router-dom';
import { ThemeSwitch } from '@/features/appearance';
import { Logo } from '@/shared/ui/Logo';
import { navItemFor } from '../nav';

/** Where you are, and the theme. Nothing else lives here until it does something. */
export function TopBar() {
  const { pathname } = useLocation();
  const here = navItemFor(pathname)?.label ?? 'Not found';

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-canvas/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-ink md:hidden">
          <Logo variant="mark" height={20} />
        </span>
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden text-ink-subtle sm:inline">Gateway</span>
          <span aria-hidden="true" className="hidden text-border-strong sm:inline">
            /
          </span>
          <span className="truncate font-medium text-ink">{here}</span>
        </p>
      </div>
      <ThemeSwitch />
    </header>
  );
}
````

**Check:** `ls src/app/shell/TopBar.tsx` prints the path.

### Step 6.2.26 — Add the phone's bottom bar

**Action:** create `frontend/src/app/shell/BottomNav.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/ui/cn';
import { NAV_ITEMS } from '../nav';

const MotionLink = m.create(Link);

/** The sidebar's places, as a bottom bar on phones. */
export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}>
        {NAV_ITEMS.map((item) => {
          const current = pathname === item.path;
          const Icon = item.icon;
          return (
            <li key={item.path}>
              <MotionLink
                to={item.path}
                aria-current={current ? 'page' : undefined}
                initial="rest"
                animate={current ? 'active' : 'rest'}
                whileTap="active"
                className={cn(
                  'relative flex h-16 flex-col items-center justify-center gap-1 text-2xs font-medium',
                  current ? 'text-accent-ink' : 'text-ink-muted',
                )}
              >
                {current && (
                  <m.span
                    layoutId="bottom-nav-mark"
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon size={20} />
                {item.label}
              </MotionLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
````

**Check:** `ls src/app/shell/BottomNav.tsx` prints the path.

### Step 6.2.27 — Add the route boundary

**Action:** create `frontend/src/app/shell/RouteBoundary.tsx` with exactly:

````tsx
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
import { AppError } from '@/shared/application/app-error';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { ErrorState } from '@/shared/ui/ErrorState';

/**
 * Wraps one route: its skeleton while its code or data loads, and a calm
 * error with Try again if either fails (ADR 0013).
 */
export function RouteBoundary({ skeleton, children }: { skeleton: ReactNode; children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallback={(error, retry) => (
            <ErrorState
              title="This page could not load."
              message={
                error instanceof AppError
                  ? error.message
                  : 'Something went wrong while loading it. Try again in a moment.'
              }
              onRetry={retry}
            />
          )}
        >
          <Suspense fallback={skeleton}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
````

**Check:** `ls src/app/shell/RouteBoundary.tsx` prints the path.

### Step 6.2.28 — Add the page transition

**Action:** create `frontend/src/app/shell/AnimatedOutlet.tsx` with exactly:

````tsx
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { duration, ease } from '@/shared/ui/motion';

/**
 * The leaving page keeps rendering what it rendered: without this, the outlet
 * would already show the next page while the old one fades out.
 */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

/**
 * Only the content region moves between pages; the shell stays put (ADR 0012).
 * Leave: fade and lift 4px, 120ms. Arrive: rise 8px out of a 4px blur, 240ms.
 */
export function AnimatedOutlet() {
  const { pathname } = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.main
        key={pathname}
        id="content"
        initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.24, ease: ease.emphasized } }}
        exit={{ opacity: 0, y: -4, filter: 'blur(0px)', transition: { duration: duration.fast, ease: ease.exit } }}
        className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-28 sm:px-6 md:pb-12"
      >
        <FrozenOutlet />
      </m.main>
    </AnimatePresence>
  );
}
````

**Check:** `grep -c "AnimatePresence" src/app/shell/AnimatedOutlet.tsx` prints `3`.

### Step 6.2.29 — Restyle the offline banner and update prompt

**Action:** replace the whole of `frontend/src/app/pwa/OfflineBanner.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import { WifiOffIcon } from '@/shared/ui/icons';
import { useOnlineStatus } from './use-online-status';

/** Offline is a state, not an error: say what is happening, in a sentence. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <m.p
      role="status"
      initial="rest"
      animate="active"
      className="flex items-center justify-center gap-2 border-b border-border bg-warning-soft px-4 py-2 text-center text-sm text-warning"
    >
      <WifiOffIcon size={16} />
      You are offline. The Gateway will show live data again when you reconnect.
    </m.p>
  );
}
````

Replace the whole of `frontend/src/app/pwa/UpdatePrompt.tsx` with exactly:

````tsx
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/shared/ui/Button';
import { RefreshIcon } from '@/shared/ui/icons';
import { duration, ease } from '@/shared/ui/motion';

/** A new version waits until the user chooses to reload (ADR 0010). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <AnimatePresence>
      {needRefresh && (
        <m.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.emphasized } }}
          exit={{ opacity: 0, y: 12, transition: { duration: duration.fast, ease: ease.exit } }}
          className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-md items-center gap-3 rounded-surface border border-border bg-surface p-3 pl-4 shadow-lg md:bottom-6"
        >
          <p className="flex-1 text-sm text-ink">A new version of the Gateway is ready.</p>
          <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            <RefreshIcon size={14} />
            Reload
          </Button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
````

**Check:** `npx vitest run src/app/pwa` prints `Tests  2 passed (2)`.

### Step 6.2.30 — Add the shell

**Action:** create `frontend/src/app/shell/AppShell.tsx` with exactly:

````tsx
import { OfflineBanner } from '../pwa/OfflineBanner';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { AnimatedOutlet } from './AnimatedOutlet';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useSidebarCollapsed } from './use-sidebar-collapsed';

/** The frame every page lives in. Only the content region changes between pages. */
export function AppShell() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <div className="flex min-h-dvh bg-canvas">
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-accent px-3 py-2 text-sm font-medium text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <TopBar />
        <AnimatedOutlet />
      </div>
      <BottomNav />
      <UpdatePrompt />
    </div>
  );
}
````

**Check:** `npm run typecheck > /dev/null 2>&1; echo "exit=$?"` prints `exit=0`.

### Step 6.2.31 — Write the Tools page test first

**Action:** create `frontend/src/pages/tools/ToolsPage.test.tsx` with exactly:

````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { ToolsGatewayProvider, type Tool, type ToolsGateway } from '@/features/tools';
import { AppError } from '@/shared/application/app-error';
import { ToolsPage } from './ToolsPage';
import { ToolsPageSkeleton } from './ToolsPageSkeleton';

const payroll: Tool = {
  id: 't1',
  name: 'Payroll',
  url: 'https://payroll.example.com',
  description: 'Monthly pay',
  category: 'Finance',
  createdAt: new Date(0),
};

function renderPage(list: ToolsGateway['list']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const gateway: ToolsGateway = { list, create: async () => payroll };
  render(
    <QueryClientProvider client={queryClient}>
      <ToolsGatewayProvider gateway={gateway}>
        <RouteBoundary skeleton={<ToolsPageSkeleton />}>
          <ToolsPage />
        </RouteBoundary>
      </ToolsGatewayProvider>
    </QueryClientProvider>,
  );
}

describe('ToolsPage', () => {
  it('shows its skeleton while the tools load', () => {
    renderPage(() => new Promise(() => undefined));
    expect(screen.getByRole('status', { name: 'Loading tools' })).toBeTruthy();
  });

  it('lists the tools under their category', async () => {
    renderPage(async () => [payroll]);
    expect(await screen.findByRole('link', { name: 'Payroll' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Finance' })).toBeTruthy();
  });

  it('says there are none yet, and offers to add one', async () => {
    renderPage(async () => []);
    expect(await screen.findByText('No tools yet')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add tool' })).toHaveLength(2);
  });

  it('shows the reason it failed, and tries again on request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const list = vi
      .fn<ToolsGateway['list']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue([payroll]);
    renderPage(list);

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Payroll' })).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('opens the Add a tool sheet', async () => {
    renderPage(async () => [payroll]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add tool' }));
    expect(screen.getByRole('dialog', { name: 'Add a tool' })).toBeTruthy();
  });
});
````

**Check:** `npx vitest run src/pages/tools` fails, and its output contains
`Failed to resolve import` (it names `./ToolsPage` or `./ToolsPageSkeleton`,
the two files the next steps create).

### Step 6.2.32 — Add the Tools page skeleton

**Action:** create `frontend/src/pages/tools/ToolsPageSkeleton.tsx` with exactly:

````tsx
import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** The Tools page, drawn before it arrives: the same header, groups and card grid (ADR 0013). */
export function ToolsPageSkeleton() {
  return (
    <SkeletonRegion label="tools" className="flex flex-col gap-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <SkeletonText size="xl" className="w-28" order={0} />
          <SkeletonText size="base" className="w-80 max-w-full" order={1} />
        </div>
        <SkeletonBlock className="h-10 w-28" order={1} />
      </div>
      {[0, 1].map((group) => (
        <div key={group} className="flex flex-col gap-4">
          <SkeletonText size="sm" className="w-24" order={2 + group * 2} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <div key={card} className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5">
                <SkeletonBlock className="size-9" order={3 + group * 2} />
                <div className="flex flex-col gap-1">
                  <SkeletonText size="md" className="w-2/3" order={3 + group * 2} />
                  <SkeletonText size="xs" className="w-1/2" order={3 + group * 2} />
                </div>
                <SkeletonText size="sm" className="w-full" order={3 + group * 2} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
````

**Check:** `ls src/pages/tools/ToolsPageSkeleton.tsx` prints the path.

### Step 6.2.33 — Add the Tools page, and remove the old one

**Action:** create `frontend/src/pages/tools/ToolsPage.tsx` with exactly:

````tsx
import { useState } from 'react';
import { CreateToolForm, ToolList, useTools } from '@/features/tools';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PlusIcon, ToolsIcon } from '@/shared/ui/icons';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Sheet } from '@/shared/ui/Sheet';

export function ToolsPage() {
  const { data: tools } = useTools();
  const [adding, setAdding] = useState(false);
  const open = () => setAdding(true);
  const close = () => setAdding(false);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Tools"
        description="The apps and links Source One staff open every day."
        action={
          <Button onClick={open}>
            <PlusIcon size={16} />
            Add tool
          </Button>
        }
      />

      {tools.length === 0 ? (
        <EmptyState
          icon={<ToolsIcon size={22} />}
          title="No tools yet"
          description="Add the first app or link, and it appears here for everyone, under its category."
          action={
            <Button variant="secondary" onClick={open}>
              <PlusIcon size={16} />
              Add tool
            </Button>
          }
        />
      ) : (
        <ToolList tools={tools} />
      )}

      <Sheet open={adding} onClose={close} title="Add a tool" description="It appears for everyone, under its category.">
        <CreateToolForm onCreated={close} onCancel={close} />
      </Sheet>
    </div>
  );
}
````

Then run `git rm -q src/pages/ToolsPage.tsx`.

**Check:** `npx vitest run src/pages/tools` prints `Tests  5 passed (5)`, and
`ls src/pages` prints `NotFoundPage.tsx  tools`.

### Step 6.2.34 — Restyle the not-found page

**Action:** replace the whole of `frontend/src/pages/NotFoundPage.tsx` with exactly:

````tsx
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <p className="font-mono text-sm text-ink-subtle">404</p>
      <h1 className="text-2xl font-semibold text-ink">There is nothing at this address.</h1>
      <p className="text-base text-ink-muted">
        It may have moved. Everything the Gateway has is in the sidebar, or go to{' '}
        <Link to="/" className="font-medium text-accent-ink underline-offset-4 hover:underline">
          Tools
        </Link>
        .
      </p>
    </div>
  );
}
````

**Check:** `grep -c "There is nothing at this address." src/pages/NotFoundPage.tsx` prints `1`.

### Step 6.2.35 — Add the routes table

**Action:** create `frontend/src/app/routes.tsx` with exactly:

````tsx
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ToolsPageSkeleton } from '@/pages/tools/ToolsPageSkeleton';
import { AppShell } from './shell/AppShell';
import { RouteBoundary } from './shell/RouteBoundary';

// Each page is its own chunk. Its skeleton is not: it must be ready the
// moment the page is not (ADR 0013).
const ToolsPage = lazy(() => import('@/pages/tools/ToolsPage').then((module) => ({ default: module.ToolsPage })));

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <RouteBoundary skeleton={<ToolsPageSkeleton />}>
            <ToolsPage />
          </RouteBoundary>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
````

**Check:** `grep -c "lazy(" src/app/routes.tsx` prints `1`.

### Step 6.2.36 — Use the routes table

**Action:** replace the whole of `frontend/src/app/router.tsx` with exactly:

````tsx
import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

export const router = createBrowserRouter(routes);
````

Replace the whole of `frontend/src/app/App.tsx` with exactly:

````tsx
import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers';
import { router } from './router';

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
````

**Check:** `npm run typecheck > /dev/null 2>&1; echo "exit=$?"` prints `exit=0`.

### Step 6.2.37 — Confirm nothing uses the removed class names

**Action:** run `git grep -nE "rounded-box|accent-strong|accent-contrast|text-accent( |\")|outline-accent" -- src; echo "exit=$?"`.

**Check:** it prints only `exit=1` (no matches).

### Step 6.2.38 — Run every check for stage 2

**Action:** run:

```bash
npm run typecheck > /dev/null 2>&1; echo "typecheck=$?"
npm run lint > /dev/null 2>&1; echo "lint=$?"
npm run arch:check 2>&1 | grep -E "violation"
npm test 2>&1 | grep -E "Tests |Test Files"
npm run build 2>&1 | grep -E "precache|ToolsPage-.*\.js|index-.*\.js"
```

**Check:** exactly — `typecheck=0`; `lint=0`;
`✔ no dependency violations found (86 modules, 205 dependencies cruised)`;
`Test Files  18 passed (18)` and `Tests  104 passed (104)`; and the build
lines show a separate `ToolsPage-….js` chunk and an `index-….js` whose gzip
size is at most `170 kB`. Then go to section 7 and ship stage 2.

## 6c. Stage 3 — the Theme showcase, the docs, and the browser check

Start only after the owner wrote "continue to stage 3".

### Step 6.3.1 — Write the contrast test first

**Action:** create `frontend/src/shared/domain/contrast.test.ts` with exactly:

````ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA } from './contrast';

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it('gives the figures ADR 0011 is built on', () => {
    expect(contrastRatio('#c8f135', '#ffffff')).toBeCloseTo(1.31, 2);
    expect(contrastRatio('#466d00', '#ffffff')).toBeCloseTo(6.09, 2);
    expect(contrastRatio('#111310', '#c8f135')).toBeCloseTo(14.31, 2);
  });

  it('does not care which colour is the text', () => {
    expect(contrastRatio('#466d00', '#ffffff')).toBe(contrastRatio('#ffffff', '#466d00'));
  });

  it('reads three-digit hex', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });

  it('returns null for anything that is not a hex colour', () => {
    expect(contrastRatio('rgb(0 0 0)', '#ffffff')).toBeNull();
  });
});

describe('meetsAA', () => {
  it('needs 4.5:1 for body text', () => {
    expect(meetsAA(4.5)).toBe(true);
    expect(meetsAA(4.49)).toBe(false);
  });
});
````

**Check:** `npx vitest run src/shared/domain` fails, and its output contains
`Failed to resolve import "./contrast"`.

### Step 6.3.2 — Add the contrast calculation

**Action:** create `frontend/src/shared/domain/contrast.ts` with exactly:

````ts
/** WCAG 2 contrast between two colours, from 1 (none) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number | null {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  if (a === null || b === null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG AA for body text. */
export function meetsAA(ratio: number): boolean {
  return ratio >= 4.5;
}

function relativeLuminance(hex: string): number | null {
  const channels = parseHex(hex);
  if (!channels) return null;
  const [r, g, b] = channels.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseHex(value: string): [number, number, number] | null {
  const hex = value.trim().replace(/^#/, '');
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}
````

**Check:** `npx vitest run src/shared/domain` prints `Tests  6 passed (6)`.

### Step 6.3.3 — Add the showcase section frame

**Action:** create `frontend/src/pages/theme/ShowcaseSection.tsx` with exactly:

````tsx
import type { ReactNode } from 'react';

/** One numbered part of the showcase: a heading, a sentence, and the samples. */
export function ShowcaseSection({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const id = `theme-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="grid gap-6 border-t border-border pt-10 lg:grid-cols-[220px_1fr] lg:gap-10">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs text-ink-subtle">{String(index).padStart(2, '0')}</p>
        <h2 id={id} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
````

**Check:** `ls src/pages/theme/ShowcaseSection.tsx` prints the path.

### Step 6.3.4 — Add the Brand section

**Action:** create `frontend/src/pages/theme/sections/BrandSection.tsx` with exactly:

````tsx
import { Logo } from '@/shared/ui/Logo';
import { ShowcaseSection } from '../ShowcaseSection';

export function BrandSection() {
  return (
    <ShowcaseSection
      index={1}
      title="Brand"
      description="Source One's own logo, drawn in the current ink so it holds on either theme."
    >
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <figure className="flex flex-col gap-3">
          <div className="flex h-36 items-center justify-center rounded-surface border border-border bg-surface px-8 text-ink">
            <Logo variant="wordmark" height={34} />
          </div>
          <figcaption className="text-xs text-ink-muted">Wordmark — the expanded sidebar</figcaption>
        </figure>
        <figure className="flex flex-col gap-3">
          <div className="flex h-36 items-center justify-center rounded-surface border border-border bg-surface text-ink">
            <Logo variant="mark" height={40} />
          </div>
          <figcaption className="text-xs text-ink-muted">Mark — the rail and phones</figcaption>
        </figure>
        <figure className="flex flex-col gap-3">
          <div className="flex h-36 items-center justify-center rounded-surface border border-border bg-surface">
            <img src="/brand/pwa-192x192.png" alt="" width={72} height={72} className="rounded-surface shadow-md" />
          </div>
          <figcaption className="text-xs text-ink-muted">App icon — the installed PWA</figcaption>
        </figure>
      </div>
    </ShowcaseSection>
  );
}
````

**Check:** `ls src/pages/theme/sections/BrandSection.tsx` prints the path.

### Step 6.3.5 — Add the Colour section

**Action:** create `frontend/src/pages/theme/sections/ColourSection.tsx` with exactly:

````tsx
import { useLayoutEffect, useState } from 'react';
import { useTheme } from '@/features/appearance';
import { contrastRatio, meetsAA } from '@/shared/domain/contrast';
import { Badge } from '@/shared/ui/Badge';
import { ShowcaseSection } from '../ShowcaseSection';

interface Swatch {
  token: string;
  use: string;
  /** For a text colour: the token it is read on. Its contrast is shown. */
  on?: string;
}

const GROUPS: { title: string; swatches: Swatch[] }[] = [
  {
    title: 'Surfaces',
    swatches: [
      { token: 'canvas', use: 'Behind everything' },
      { token: 'surface', use: 'Cards, sidebar, panels' },
      { token: 'surface-raised', use: 'Above a surface' },
      { token: 'surface-sunken', use: 'Inputs, wells, skeletons' },
      { token: 'border', use: 'Every hairline' },
      { token: 'border-strong', use: 'Inputs, firm dividers' },
    ],
  },
  {
    title: 'Text',
    swatches: [
      { token: 'ink', use: 'Primary text', on: 'surface' },
      { token: 'ink-muted', use: 'Secondary text', on: 'surface' },
      { token: 'ink-subtle', use: 'Metadata, placeholders', on: 'surface' },
    ],
  },
  {
    title: 'Accent',
    swatches: [
      { token: 'accent', use: 'Fill: primary action, current place' },
      { token: 'accent-hover', use: 'Fill, hovered' },
      { token: 'on-accent', use: 'Text on the fill', on: 'accent' },
      { token: 'accent-ink', use: 'Accent as text or icon', on: 'surface' },
      { token: 'accent-soft', use: 'Tinted backgrounds' },
      { token: 'focus', use: 'Focus rings' },
    ],
  },
  {
    title: 'Status',
    swatches: [
      { token: 'success', use: 'Done, healthy', on: 'surface' },
      { token: 'warning', use: 'Needs attention', on: 'surface' },
      { token: 'danger', use: 'Failed, destructive', on: 'surface' },
      { token: 'info', use: 'Neutral notice', on: 'surface' },
    ],
  },
];

/** Every token's current value, read from the page, refreshed when the theme changes. */
function useTokenValues(): Record<string, string> {
  const { resolved } = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const group of GROUPS) {
      for (const { token } of group.swatches) next[token] = style.getPropertyValue(`--color-${token}`).trim();
    }
    setValues(next);
  }, [resolved]);

  return values;
}

export function ColourSection() {
  const values = useTokenValues();

  return (
    <ShowcaseSection
      index={2}
      title="Colour"
      description="Graphite with a green cast, and one lime. On light, lime is only ever a fill; the olive accent-ink carries it as text. Ratios are live for the current theme."
    >
      <div className="flex flex-col gap-8">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-ink-muted">{group.title}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.swatches.map((swatch) => {
                const value = values[swatch.token] ?? '';
                const ratio = swatch.on ? contrastRatio(value, values[swatch.on] ?? '') : null;
                return (
                  <li key={swatch.token} className="flex items-center gap-3 rounded-surface border border-border bg-surface p-3">
                    <span
                      aria-hidden="true"
                      className="size-11 shrink-0 rounded-control border border-border"
                      style={{ background: `var(--color-${swatch.token})` }}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate font-mono text-xs text-ink">{swatch.token}</p>
                      <p className="truncate text-xs text-ink-muted">{swatch.use}</p>
                      <p className="truncate font-mono text-2xs text-ink-subtle">{value || '—'}</p>
                    </div>
                    {ratio !== null && (
                      <Badge tone={meetsAA(ratio) ? 'success' : 'danger'} title={`On ${swatch.on}`}>
                        {ratio.toFixed(1)}:1
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </ShowcaseSection>
  );
}
````

**Check:** `ls src/pages/theme/sections/ColourSection.tsx` prints the path.

### Step 6.3.6 — Add the Type section

**Action:** create `frontend/src/pages/theme/sections/TypeSection.tsx` with exactly:

````tsx
import { cn } from '@/shared/ui/cn';
import { ShowcaseSection } from '../ShowcaseSection';

const SCALE = [
  { token: 'text-3xl', spec: '40 / 48 · 600', className: 'text-3xl font-semibold', sample: 'Supplying the future' },
  { token: 'text-2xl', spec: '32 / 40 · 600', className: 'text-2xl font-semibold', sample: 'Everything staff open, in one place' },
  { token: 'text-xl', spec: '24 / 32 · 600', className: 'text-xl font-semibold', sample: 'Tools' },
  { token: 'text-lg', spec: '20 / 28 · 600', className: 'text-lg font-semibold', sample: 'Finance' },
  { token: 'text-md', spec: '16 / 24 · 500', className: 'text-md font-medium', sample: 'Payroll' },
  { token: 'text-base', spec: '14 / 22 · 400', className: 'text-base', sample: 'Monthly pay runs close on the 25th; anything later moves to the next cycle.' },
  { token: 'text-sm', spec: '13 / 20 · 400', className: 'text-sm', sample: 'Tools with the same category are shown together.' },
  { token: 'text-xs', spec: '12 / 16 · 400', className: 'text-xs text-ink-muted', sample: 'Added 14 October 2026' },
  { token: 'text-2xs', spec: '11 / 16 · 500', className: 'text-2xs font-medium uppercase text-ink-muted', sample: 'Finance · 3 tools' },
];

export function TypeSection() {
  return (
    <ShowcaseSection
      index={3}
      title="Type"
      description="Poppins for everything people read; Geist Mono for addresses, IDs and numbers that must line up."
    >
      <div className="flex flex-col divide-y divide-border rounded-surface border border-border bg-surface">
        {SCALE.map((row) => (
          <div key={row.token} className="grid items-baseline gap-2 px-5 py-4 sm:grid-cols-[140px_1fr]">
            <div className="flex flex-col">
              <span className="font-mono text-xs text-ink">{row.token}</span>
              <span className="font-mono text-2xs text-ink-subtle">{row.spec}</span>
            </div>
            <p className={cn('min-w-0 text-ink', row.className)}>{row.sample}</p>
          </div>
        ))}
        <div className="grid items-baseline gap-2 px-5 py-4 sm:grid-cols-[140px_1fr]">
          <div className="flex flex-col">
            <span className="font-mono text-xs text-ink">font-mono</span>
            <span className="font-mono text-2xs text-ink-subtle">Geist Mono</span>
          </div>
          <p className="font-mono text-sm text-ink">payroll.example.com · 0123456789 · ⌘K</p>
        </div>
      </div>
    </ShowcaseSection>
  );
}
````

**Check:** `ls src/pages/theme/sections/TypeSection.tsx` prints the path.

### Step 6.3.7 — Add the Controls section

**Action:** create `frontend/src/pages/theme/sections/ControlsSection.tsx` with exactly:

````tsx
import { useState, type ReactNode } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { CheckIcon, PlusIcon, ToolsIcon } from '@/shared/ui/icons';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { TextField } from '@/shared/ui/TextField';
import { ShowcaseSection } from '../ShowcaseSection';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function ControlsSection() {
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <ShowcaseSection
      index={4}
      title="Controls"
      description="One primary action per screen, in lime. Hover a button with an icon to see it play."
    >
      <div className="flex flex-col gap-8 rounded-surface border border-border bg-surface p-6">
        <Row label="Buttons">
          <Button>
            <PlusIcon size={16} />
            Add tool
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Remove</Button>
        </Row>
        <Row label="States and sizes">
          <Button size="sm">
            <CheckIcon size={14} />
            Small
          </Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </Row>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Name" placeholder="Payroll" hint="As staff will see it in the list." />
          <TextField label="URL" defaultValue="payroll" errors={['URL must be a full http:// or https:// address.']} />
        </div>
        <Row label="Badges">
          <Badge>Neutral</Badge>
          <Badge tone="accent">New</Badge>
          <Badge tone="success">Healthy</Badge>
          <Badge tone="warning">Degraded</Badge>
          <Badge tone="danger">Down</Badge>
          <Badge tone="info">Maintenance</Badge>
        </Row>
        <Row label="Segmented control">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: 'Grid', icon: <ToolsIcon size={14} /> },
              { value: 'list', label: 'List' },
            ]}
          />
        </Row>
      </div>
    </ShowcaseSection>
  );
}
````

**Check:** `ls src/pages/theme/sections/ControlsSection.tsx` prints the path.

### Step 6.3.8 — Add the Surfaces section

**Action:** create `frontend/src/pages/theme/sections/SurfacesSection.tsx` with exactly:

````tsx
import { cn } from '@/shared/ui/cn';
import { ShowcaseSection } from '../ShowcaseSection';

const LEVELS = [
  { name: 'shadow-sm', className: 'shadow-sm', use: 'Resting cards, inputs, buttons' },
  { name: 'shadow-md', className: 'shadow-md', use: 'Hovered cards, tooltips' },
  { name: 'shadow-lg', className: 'shadow-lg', use: 'Sheets, the update prompt' },
];

export function SurfacesSection() {
  return (
    <ShowcaseSection
      index={5}
      title="Surfaces"
      description="Two radii: 14px for surfaces, 8px for controls. On dark, depth is a hairline and a 1px top highlight — shadows vanish on black."
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {LEVELS.map((level) => (
            <div key={level.name} className={cn('flex h-32 flex-col justify-end gap-0.5 rounded-surface border border-border bg-surface p-4', level.className)}>
              <p className="font-mono text-xs text-ink">{level.name}</p>
              <p className="text-xs text-ink-muted">{level.use}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex h-24 flex-col justify-end rounded-surface bg-surface-sunken p-4">
            <p className="font-mono text-xs text-ink">surface-sunken</p>
            <p className="text-xs text-ink-muted">A well: inputs and skeletons sit on it</p>
          </div>
          <div className="flex h-24 flex-col justify-end rounded-surface border border-border bg-surface-raised p-4">
            <p className="font-mono text-xs text-ink">surface-raised</p>
            <p className="text-xs text-ink-muted">Above a surface: hovered rows, menus</p>
          </div>
        </div>
      </div>
    </ShowcaseSection>
  );
}
````

**Check:** `ls src/pages/theme/sections/SurfacesSection.tsx` prints the path.

### Step 6.3.9 — Add the Icons section

**Action:** create `frontend/src/pages/theme/sections/IconsSection.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import type { ComponentType } from 'react';
import {
  AlertIcon,
  CheckIcon,
  ExternalLinkIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  RefreshIcon,
  SidebarIcon,
  SunIcon,
  ThemeIcon,
  ToolsIcon,
  WifiOffIcon,
  type IconProps,
} from '@/shared/ui/icons';
import { iconTrigger } from '@/shared/ui/motion';
import { ShowcaseSection } from '../ShowcaseSection';

const ICONS: { name: string; Icon: ComponentType<IconProps>; motion: string }[] = [
  { name: 'Tools', Icon: ToolsIcon, motion: 'Tiles dip in turn' },
  { name: 'Theme', Icon: ThemeIcon, motion: 'Paint dots pop' },
  { name: 'Sun', Icon: SunIcon, motion: 'Rays redraw around' },
  { name: 'Moon', Icon: MoonIcon, motion: 'Rocks; star blinks' },
  { name: 'Monitor', Icon: MonitorIcon, motion: 'Screen redraws' },
  { name: 'External link', Icon: ExternalLinkIcon, motion: 'Arrow leaves, returns' },
  { name: 'Plus', Icon: PlusIcon, motion: 'Strokes redraw' },
  { name: 'Sidebar', Icon: SidebarIcon, motion: 'Chevron nudges' },
  { name: 'Check', Icon: CheckIcon, motion: 'Tick draws on' },
  { name: 'Alert', Icon: AlertIcon, motion: 'Ring shakes' },
  { name: 'Refresh', Icon: RefreshIcon, motion: 'Halves turn' },
  { name: 'Offline', Icon: WifiOffIcon, motion: 'Signal fades out' },
];

export function IconsSection() {
  return (
    <ShowcaseSection
      index={6}
      title="Icons"
      description="Each stroke moves on its own, played by whatever the icon sits in. Hover or tab to a tile."
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {ICONS.map(({ name, Icon, motion }) => (
          <li key={name}>
            <m.div
              {...iconTrigger}
              tabIndex={0}
              className="flex flex-col items-start gap-4 rounded-surface border border-border bg-surface p-4 transition-colors duration-150 ease-standard hover:border-border-strong"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-control bg-accent-soft text-accent-ink">
                <Icon size={20} />
              </span>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-ink">{name}</p>
                <p className="text-xs text-ink-muted">{motion}</p>
              </div>
            </m.div>
          </li>
        ))}
      </ul>
    </ShowcaseSection>
  );
}
````

**Check:** `ls src/pages/theme/sections/IconsSection.tsx` prints the path.

### Step 6.3.10 — Add the Loading section

**Action:** create `frontend/src/pages/theme/sections/LoadingSection.tsx` with exactly:

````tsx
import { Suspense, use, useState } from 'react';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';
import { ShowcaseSection } from '../ShowcaseSection';

type Demo = 'loaded' | 'loading' | 'failed';

/** Never settles, so whatever reads it stays suspended until it is unmounted. */
const forever = new Promise<never>(() => undefined);

function Suspends(): null {
  use(forever);
  return null;
}

const SAMPLES = [
  { name: 'Payroll', host: 'payroll.example.com', description: 'Monthly pay runs and payslips.' },
  { name: 'Expenses', host: 'expenses.example.com', description: 'Claims, receipts and approvals.' },
  { name: 'Leave', host: 'hr.example.com', description: 'Book and approve time off.' },
];

function SampleCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SAMPLES.map((sample) => (
        <div key={sample.name} className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm">
          <span className="inline-flex size-9 items-center justify-center rounded-control bg-surface-sunken text-md font-semibold text-ink">
            {sample.name.slice(0, 1)}
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-md font-medium text-ink">{sample.name}</p>
            <p className="font-mono text-xs text-ink-subtle">{sample.host}</p>
          </div>
          <p className="text-sm text-ink-muted">{sample.description}</p>
        </div>
      ))}
    </div>
  );
}

function SampleCardsSkeleton() {
  return (
    <SkeletonRegion label="samples" className="grid gap-4 sm:grid-cols-3">
      {SAMPLES.map((sample, order) => (
        <div key={sample.name} className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5">
          <SkeletonBlock className="size-9" order={order} />
          <div className="flex flex-col gap-1">
            <SkeletonText size="md" className="w-2/3" order={order} />
            <SkeletonText size="xs" className="w-1/2" order={order} />
          </div>
          <SkeletonText size="sm" className="w-full" order={order} />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function LoadingSection() {
  const [demo, setDemo] = useState<Demo>('loaded');

  return (
    <ShowcaseSection
      index={7}
      title="Loading"
      description="A skeleton shaped like what is coming, invisible for its first 150ms, with one shimmer across every block. A failure keeps the frame and says why."
    >
      <div className="flex flex-col gap-5">
        <SegmentedControl
          label="Sample state"
          value={demo}
          onChange={setDemo}
          options={[
            { value: 'loaded', label: 'Loaded' },
            { value: 'loading', label: 'Loading' },
            { value: 'failed', label: 'Failed' },
          ]}
          className="self-start"
        />
        {demo === 'failed' ? (
          <ErrorState
            title="These tools could not load."
            message="Cannot reach the server. Check your connection and try again."
            onRetry={() => setDemo('loaded')}
          />
        ) : (
          <Suspense fallback={<SampleCardsSkeleton />}>{demo === 'loading' ? <Suspends /> : <SampleCards />}</Suspense>
        )}
      </div>
    </ShowcaseSection>
  );
}
````

**Check:** `ls src/pages/theme/sections/LoadingSection.tsx` prints the path.

### Step 6.3.11 — Add the Motion section

**Action:** create `frontend/src/pages/theme/sections/MotionSection.tsx` with exactly:

````tsx
import * as m from 'motion/react-m';
import { useState } from 'react';
import { duration, ease } from '@/shared/ui/motion';
import { ShowcaseSection } from '../ShowcaseSection';

const TOKENS = [
  { name: 'duration-fast', value: '120ms', use: 'Hover, press, leaving', seconds: duration.fast, curve: ease.standard },
  { name: 'duration-base', value: '200ms', use: 'Toggles, small arrivals', seconds: duration.base, curve: ease.standard },
  { name: 'duration-slow', value: '320ms', use: 'Pages, panels', seconds: duration.slow, curve: ease.standard },
  { name: 'ease-standard', value: '0.2, 0, 0, 1', use: 'Most movement', seconds: 0.6, curve: ease.standard },
  { name: 'ease-emphasized', value: '0.05, 0.7, 0.1, 1', use: 'Arrivals, the nav pill', seconds: 0.6, curve: ease.emphasized },
  { name: 'ease-exit', value: '0.3, 0, 1, 1', use: 'Leaving', seconds: 0.6, curve: ease.exit },
];

function Track({ seconds, curve }: { seconds: number; curve: readonly [number, number, number, number] }) {
  const [end, setEnd] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setEnd((current) => !current)}
      aria-label="Play"
      className="relative h-8 w-full rounded-full bg-surface-sunken"
    >
      <m.span
        aria-hidden="true"
        className="absolute top-1 left-1 size-6 rounded-full bg-accent shadow-sm"
        animate={{ left: end ? 'calc(100% - 1.75rem)' : '0.25rem' }}
        transition={{ duration: seconds, ease: curve }}
      />
    </button>
  );
}

export function MotionSection() {
  return (
    <ShowcaseSection
      index={8}
      title="Motion"
      description="Short, and only where it explains where something came from or went. Press a track to play its token."
    >
      <ul className="flex flex-col divide-y divide-border rounded-surface border border-border bg-surface">
        {TOKENS.map((token) => (
          <li key={token.name} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[180px_1fr_200px]">
            <div className="flex flex-col">
              <span className="font-mono text-xs text-ink">{token.name}</span>
              <span className="font-mono text-2xs text-ink-subtle">{token.value}</span>
            </div>
            <Track seconds={token.seconds} curve={token.curve} />
            <span className="text-xs text-ink-muted sm:text-right">{token.use}</span>
          </li>
        ))}
      </ul>
    </ShowcaseSection>
  );
}
````

**Check:** `npm run typecheck > /dev/null 2>&1; echo "exit=$?"` prints `exit=0`.

### Step 6.3.12 — Write the Theme page test first

**Action:** create `frontend/src/pages/theme/ThemePage.test.tsx` with exactly:

````tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, type ThemeDocument, type ThemePreferenceStore } from '@/features/appearance';
import { ThemePage } from './ThemePage';

function renderPage() {
  const store: ThemePreferenceStore = { read: () => 'light', write: () => undefined };
  const document: ThemeDocument = {
    prefersDark: () => false,
    subscribe: () => () => undefined,
    apply: () => undefined,
    transition: (update) => update(),
  };
  render(
    <ThemeProvider store={store} document={document}>
      <ThemePage />
    </ThemeProvider>,
  );
}

describe('ThemePage', () => {
  it('shows all eight parts of the system, in order', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Brand', 'Colour', 'Type', 'Controls', 'Surfaces', 'Icons', 'Loading', 'Motion']);
  });

  it('shows the skeleton when the sample is set to loading', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Loading' }));
    expect(screen.getByRole('status', { name: 'Loading samples' })).toBeTruthy();
  });

  it('shows the error state when the sample fails, and recovers on Try again', () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Failed' }));
    expect(screen.getByText('These tools could not load.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Claims, receipts and approvals.')).toBeTruthy();
  });
});
````

**Check:** `npx vitest run src/pages/theme` fails, and its output contains
`Failed to resolve import "./ThemePage"`.

### Step 6.3.13 — Add the Theme page and its skeleton

**Action:** create `frontend/src/pages/theme/ThemePage.tsx` with exactly:

````tsx
import { PageHeader } from '@/shared/ui/PageHeader';
import { BrandSection } from './sections/BrandSection';
import { ColourSection } from './sections/ColourSection';
import { ControlsSection } from './sections/ControlsSection';
import { IconsSection } from './sections/IconsSection';
import { LoadingSection } from './sections/LoadingSection';
import { MotionSection } from './sections/MotionSection';
import { SurfacesSection } from './sections/SurfacesSection';
import { TypeSection } from './sections/TypeSection';

/** The design system, in one place (plan 0002, frontend/DESIGN.md). */
export function ThemePage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Theme"
        description="The Gateway's colour, type, controls and motion. Switch the theme at the top right to see both."
      />
      <BrandSection />
      <ColourSection />
      <TypeSection />
      <ControlsSection />
      <SurfacesSection />
      <IconsSection />
      <LoadingSection />
      <MotionSection />
    </div>
  );
}
````

Then create `frontend/src/pages/theme/ThemePageSkeleton.tsx` with exactly:

````tsx
import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';

/** The Theme page's header and its first two sections (ADR 0013). */
export function ThemePageSkeleton() {
  return (
    <SkeletonRegion label="theme" className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <SkeletonText size="xl" className="w-28" order={0} />
        <SkeletonText size="base" className="w-[28rem] max-w-full" order={1} />
      </div>
      {[0, 1].map((section) => (
        <div key={section} className="grid gap-6 border-t border-border pt-10 lg:grid-cols-[220px_1fr] lg:gap-10">
          <div className="flex flex-col gap-1">
            <SkeletonText size="xs" className="w-6" order={2 + section * 2} />
            <SkeletonText size="lg" className="w-24" order={2 + section * 2} />
            <SkeletonText size="sm" className="w-full" order={2 + section * 2} />
            <SkeletonText size="sm" className="w-3/4" order={2 + section * 2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SkeletonBlock className="h-36 rounded-surface sm:col-span-2" order={3 + section * 2} />
            <SkeletonBlock className="h-36 rounded-surface" order={3 + section * 2} />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
````

**Check:** `npx vitest run src/pages/theme` prints `Tests  3 passed (3)`.

### Step 6.3.14 — Write the navigation test first

**Action:** create `frontend/src/app/routes.test.tsx` with exactly:

````tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, type ThemeDocument, type ThemePreferenceStore } from '@/features/appearance';
import { ToolsGatewayProvider, type ToolsGateway } from '@/features/tools';
import { routes } from './routes';

// The service worker's registration only exists in a Vite build.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: async () => undefined,
  }),
}));

function renderAt(path: string, list: ToolsGateway['list'] = async () => []) {
  const store: ThemePreferenceStore = { read: () => 'light', write: () => undefined };
  const document: ThemeDocument = {
    prefersDark: () => false,
    subscribe: () => () => undefined,
    apply: () => undefined,
    transition: (update) => update(),
  };
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <ThemeProvider store={store} document={document}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToolsGatewayProvider gateway={{ list, create: async () => Promise.reject(new Error('unused')) }}>
          <RouterProvider router={router} />
        </ToolsGatewayProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return router;
}

describe('the app', () => {
  it('opens on Tools, inside the shell', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Tools' })).toBeTruthy();
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
  });

  it("shows the destination's skeleton while it loads, then the page", async () => {
    renderAt('/', () => new Promise(() => undefined));
    expect(await screen.findByRole('status', { name: 'Loading tools' })).toBeTruthy();
  });

  it('moves between places from the sidebar', async () => {
    const router = renderAt('/');
    await screen.findByRole('heading', { level: 1, name: 'Tools' });
    const [sidebarThemeLink] = screen.getAllByRole('link', { name: 'Theme' });
    fireEvent.click(sidebarThemeLink!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Theme' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/theme');
  });

  it('says plainly when an address does not exist', async () => {
    renderAt('/nowhere');
    expect(await screen.findByRole('heading', { level: 1, name: 'There is nothing at this address.' })).toBeTruthy();
  });
});
````

**Check:** `npx vitest run src/app/routes` fails: the output shows
`1 failed | 3 passed (4)`, and the failing test is
`moves between places from the sidebar`. (The Theme route does not exist yet.)

### Step 6.3.15 — Register the Theme page

**Action:** replace the whole of `frontend/src/app/routes.tsx` with exactly:

````tsx
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ThemePageSkeleton } from '@/pages/theme/ThemePageSkeleton';
import { ToolsPageSkeleton } from '@/pages/tools/ToolsPageSkeleton';
import { AppShell } from './shell/AppShell';
import { RouteBoundary } from './shell/RouteBoundary';

// Each page is its own chunk. Its skeleton is not: it must be ready the
// moment the page is not (ADR 0013).
const ToolsPage = lazy(() => import('@/pages/tools/ToolsPage').then((module) => ({ default: module.ToolsPage })));
const ThemePage = lazy(() => import('@/pages/theme/ThemePage').then((module) => ({ default: module.ThemePage })));

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <RouteBoundary skeleton={<ToolsPageSkeleton />}>
            <ToolsPage />
          </RouteBoundary>
        ),
      },
      {
        path: 'theme',
        element: (
          <RouteBoundary skeleton={<ThemePageSkeleton />}>
            <ThemePage />
          </RouteBoundary>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
````

**Check:** `npx vitest run src/app/routes` prints `Tests  4 passed (4)`.

### Step 6.3.16 — Rewrite the design system document

**Action:** from the repository root, replace the whole of `frontend/DESIGN.md` with exactly:

````markdown
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
   token. A value that is not a token becomes one first.
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
````

**Check:** `grep -c "The lime rule" frontend/DESIGN.md` prints `1`.

### Step 6.3.17 — Accept decisions 0011, 0012 and 0013

**Action:** from the repository root, run:

```bash
sed -i 's/^- \*\*Status:\*\* Proposed$/- **Status:** Accepted/' docs/decisions/0011-visual-identity.md docs/decisions/0012-motion-and-animated-icons.md docs/decisions/0013-loading-states-are-page-shaped-skeletons.md
sed -i 's/| Visual identity: lime as fill, olive as ink | Proposed |/| Visual identity: lime as fill, olive as ink | Accepted |/; s/| Motion: page transitions and stroke-animated icons | Proposed |/| Motion: page transitions and stroke-animated icons | Accepted |/; s/| Loading states are page-shaped skeletons | Proposed |/| Loading states are page-shaped skeletons | Accepted |/' docs/decisions/README.md
```

**Check:** `grep -c "Accepted" docs/decisions/0011-visual-identity.md docs/decisions/0012-motion-and-animated-icons.md docs/decisions/0013-loading-states-are-page-shaped-skeletons.md`
prints `1` for each file, and `grep -c "| Proposed |" docs/decisions/README.md` prints `0`.

### Step 6.3.18 — Update the architecture explanation

**Action:** from the repository root, replace the whole of `docs/explanation/architecture.md` with exactly:

````markdown
# Architecture

Why the system is shaped this way. For *how to change it*, see the
[guides](../guides/); for exact names and values, see the
[reference](../reference/).

---

## Two services, one repository

```
          browser  (installed PWA or tab)
             │
   ┌─────────┴──────────┐
   │  React SPA (Vite)  │   :5173 dev — shell precached by a service worker
   └─────────┬──────────┘
             │  /api/v1  (Vite proxies in dev)
   ┌─────────┴──────────┐
   │  Express 5 API     │   :4000
   └─────────┬──────────┘
             │  Drizzle
   ┌─────────┴──────────┐
   │  PostgreSQL 17     │   :5436 locally
   └────────────────────┘
```

The frontend never talks to Postgres. The backend serves no HTML. One pull
request can change an endpoint and its consumer, and the type-only contracts
keep the two in agreement
([ADR 0007](../decisions/0007-one-definition-of-an-api-shape.md)).

---

## The dependency rule

Both services follow Clean Architecture
([ADR 0003](../decisions/0003-clean-architecture-with-layers-inside-modules.md)),
with the layers inside each module or feature:

```
presentation ──┐
               ├──▶ application ──▶ domain
infrastructure ┘
```

- **Domain** is the business: entities, their rules, and the ports
  (interfaces) the business needs from the outside world. It imports nothing
  outside itself, so the rules can be read and tested without a framework in
  sight.
- **Application** is what the system does: one use case per operation,
  talking to the world only through ports. On the backend it imports no
  package at all. On the frontend it may use React and TanStack Query — hooks
  are how a React app delivers its use cases — but never Axios or the wire
  format.
- **Infrastructure** implements ports: Drizzle repositories on the backend,
  HTTP gateways on the frontend. It is the only place a database row or an API
  response shape is known.
- **Presentation** is the delivery mechanism: Express controllers and routes
  on the backend, React components on the frontend.

Infrastructure and presentation never import each other. They meet only in a
**composition root** — `backend/src/main.ts`, `backend/src/compose.ts` and
each module's `index.ts`; `frontend/src/app/` and each feature's `index.ts` —
where adapters are constructed and handed to use cases by constructor (or, on
the frontend, by React context).

**Each restriction exists for a reason.** Domain purity keeps the rules
testable in milliseconds. Application's independence from Express and Drizzle
means a use case can be called from a route, a script or a queue consumer
unchanged. Presentation's ban on infrastructure stops a controller from
reaching past the use case into the database. The frontend presentation's ban
on contracts means a component cannot break when the wire format changes; the
gateway absorbs it.

All of it is checked by `npm run arch:check`
([ADR 0004](../decisions/0004-layer-rules-are-enforced-by-dependency-cruiser.md)).

---

## Request lifecycle

`POST /api/v1/tools` with `{ "name": "Payroll", "url": "https://…", "category": "Finance" }`:

1. **Middleware** in `createApp`, in order — `helmet`, `cors` (one allowed
   origin), `compression`, JSON parsing (100 kB limit), `pino-http` (one log
   line per request).
2. **Router** — `/api/v1` → the `tools` module's router → `controller.create`.
3. **Controller** — `parseBody` checks the body's *shape* against a zod
   schema typed by the contract. A wrong shape throws `HttpError` 400.
4. **Use case** — `CreateTool` asks `Tool.create` for an entity, with an id
   from the `IdGenerator` port and a time from the `Clock` port.
5. **Domain** — `Tool.create` trims every field and checks every rule,
   returning all the broken ones at once as `InvalidToolError`.
6. **Repository** — `DrizzleToolRepository.add` inserts the row. A unique
   violation on `lower(name)` comes back as `ToolNameTakenError` — the
   database, not a prior lookup, decides, so two simultaneous requests cannot
   both win.
7. **Back out** — the use case returns a `Result`; the controller maps a
   failure's `code` to a status and throws `HttpError`, or sends
   `201 { data: tool }`.

**The error path.** Every throw ends in the error handler — Express 5
forwards rejected promises by itself, so there is no `asyncHandler`. An
`HttpError` is rendered as-is; a JSON parse failure becomes 400
`MALFORMED_JSON`; anything else is a bug, logged in full and answered with a
bare 500 `INTERNAL_ERROR`. The client sees one error shape, always.

**Environment is validated at boot**, not at use: a bad `DATABASE_URL` stops
`main.ts` with the variable's name, rather than surfacing inside a request.

---

## The frontend

```
pages/<name>/   a page and its skeleton — composition only
features/<name>/{domain,application,infrastructure,presentation}
shared/ui/      primitives and animated icons, no domain knowledge
app/            providers, routes, the shell, the PWA's prompt and banner
```

**The shell never moves; pages do.** `app/shell/` draws the sidebar, the top
bar and the phone's bottom bar once. Only the content region changes between
pages, with a short transition
([ADR 0012](../decisions/0012-motion-and-animated-icons.md)). The routes
table, `app/routes.tsx`, is the one place a page is registered, lazily, with
its skeleton.

**Loading is a skeleton of the page; failure is a sentence.** Pages read data
with suspense queries, so one `Suspense` per route covers code and data, and
one error boundary per route turns any failure into `ErrorState` with Try
again ([ADR 0013](../decisions/0013-loading-states-are-page-shaped-skeletons.md)).

**The theme is a feature like any other.** `features/appearance` owns the
preference (domain), its ports and `useTheme` (application), `localStorage`
and the `<html>` attribute (infrastructure), and the switch (presentation)
([ADR 0011](../decisions/0011-visual-identity.md)).

**Server state belongs to TanStack Query.** Fetched data lives in the query
cache under a key from the feature's key factory; copying it into
`useState` makes a second source of truth that goes stale.

**Every failure is an `AppError`.** The gateway converts timeouts, lost
connections and API errors into one shape, so a component shows
`error.message`, and `error.fields[name]` beside the input it concerns,
without knowing the cause.

**The PWA caches the shell, never the data**
([ADR 0010](../decisions/0010-the-app-shell-is-cached-api-responses-never-are.md)).
The app opens instantly and offline; data always comes from the network, and
when it cannot, the page says so.

---

## What is deliberately absent

| Not here | Why |
|---|---|
| A DI container | Constructor arguments wired in one file are explicit and typed. A container adds indirection this size does not need |
| An `Entity` base class, value objects for every field | Nothing shares behaviour yet. Add one when two entities need the same thing |
| Redis | Nothing to cache or queue yet |
| GraphQL | A handful of endpoints with predictable shapes |
| Microservices | One product, one team, one deployable pair |
| Server-side rendering | An internal tool behind a sign-in has no SEO need ([ADR 0002](../decisions/0002-pern-with-client-rendered-spa.md)) |

Each is a real option later. None is justified now, and each adds something
someone has to run.
````

**Check:** `grep -c "The shell never moves; pages do." docs/explanation/architecture.md` prints `1`.

### Step 6.3.19 — Update the UI component guide, and add the page guide

**Action:** from the repository root, replace the whole of `docs/guides/add-a-ui-component.md` with exactly:

````markdown
# Add a UI component

Read [`frontend/DESIGN.md`](../../frontend/DESIGN.md) first. It is short and
not optional. The running app shows every existing primitive at `/theme`.

## Where it goes

| It is… | It goes in | It may import |
|---|---|---|
| A generic primitive (a button, a field, a sheet) or an animated icon, with no knowledge of any feature | `frontend/src/shared/ui/` | `react`, `clsx`, `tailwind-merge`, `motion`, `lucide-react`, other `shared/ui` files |
| Part of one feature | `frontend/src/features/<name>/presentation/` | its feature's `domain` and `application`, `shared/ui`, `shared/application` |
| A whole screen | `frontend/src/pages/<name>/` — see [Add a page](./add-a-page.md) | features through their `index.ts`, `shared/ui`, `shared/domain` |

`npm run arch:check` enforces the table.

## Rules

- **Tokens only.** Colours, radius, shadows, fonts and type sizes come from
  `src/styles/theme.css` through Tailwind classes (`bg-surface`,
  `text-ink-muted`, `rounded-surface`, `shadow-md`, `text-sm`). Tailwind's own
  palette is switched off, so an off-token class silently draws nothing.
- **The accent is a fill or ink, never both.** `bg-accent text-on-accent` for
  a fill; `text-accent-ink` for accent text. Never `text-accent`.
- **Never build a class name from a variable** (`` `bg-${tone}` ``). Tailwind
  cannot see it. Map the variable to whole class names, as `Badge` does.
- **Merge classes with `cn`** from `shared/ui/cn.ts`, so a caller's
  `className` overrides the component's.
- **Animate with `m.*`** from `motion/react-m`, with durations and easings from
  `shared/ui/motion.ts`. Anything that holds an animated icon spreads
  `{...iconTrigger}` so the icon plays on hover and focus.
- **A component receives domain types**, never contract types. The gateway has
  already mapped them.
- **Errors**: `error.fields[name]` under the input it is about; otherwise
  `ErrorState` or an inline `role="alert"`. `TextField` handles the
  `aria-invalid` / `aria-describedby` wiring.
- **Links to outside URLs** check `isWebUrl` first, and open with
  `rel="noopener noreferrer"`.
- **Show it at `/theme`.** A new primitive gets a sample in the matching
  section of `src/pages/theme/sections/`.

## Test

Render it with Testing Library and assert on what a person sees or does —
roles, labels, text — not on class names. A component that needs data gets a
fake gateway through the feature's provider, as `CreateToolForm.test.tsx` does.
````

Then create `docs/guides/add-a-page.md` with exactly:

````markdown
# Add a page

A page is a place in the sidebar. It composes features; it holds no rules of
its own. The Tools page is the worked example —
`frontend/src/pages/tools/`.

1. **Create the folder** `frontend/src/pages/<name>/`.
2. **Write the page**, `<Name>Page.tsx`. Start it with `PageHeader` (a title,
   one sentence, at most one primary action). Read data with the feature's
   suspense hook (`useSuspenseQuery` inside, as `useTools` does) — never check
   `isPending` in the page.
3. **Write its skeleton**, `<Name>PageSkeleton.tsx`, from `SkeletonRegion`,
   `SkeletonBlock` and `SkeletonText`. Lay it out exactly like the page: same
   header, same grid, same card sizes, so nothing jumps when the page arrives.
   Give blocks an increasing `order` from top to bottom.
4. **Register the route** in `frontend/src/app/routes.tsx`: a `lazy()` import
   of the page, wrapped in `RouteBoundary` with the skeleton as `skeleton`.
5. **Add it to the sidebar** in `frontend/src/app/nav.ts`: path, label, and an
   animated icon from `shared/ui/icons` (write one if none fits — see
   [`DESIGN.md`](../../frontend/DESIGN.md#icons)).
6. **Test it** beside the page: the skeleton while data is pending, the page
   when it arrives, the empty state, and the error with Try again —
   `pages/tools/ToolsPage.test.tsx` shows all four.

## Check

```bash
npm run typecheck && npm run lint && npm run arch:check && npm run test:unit
```

Then open it in the app in both themes and at phone width.
````

**Check:** `ls docs/guides` prints `add-a-module.md  add-a-page.md  add-a-ui-component.md  add-a-use-case.md  change-the-database-schema.md  turn-off-the-service-worker.md`.

### Step 6.3.20 — Update the docs index, README, CLAUDE.md and commands

**Action:** from the repository root, replace the whole of `docs/README.md` with exactly:

````markdown
# s1-gateway developer documentation

Documentation is split by **purpose**, not by feature. Each category answers a
different question, and mixing them is what turns a docs folder into a junk
drawer nobody reads twice.

| Category | Answers | Read it when | Write here when |
|---|---|---|---|
| [Getting started](./getting-started/) | "How do I get this running?" | Your first day | The setup steps change |
| [Guides](./guides/) | "How do I do X?" | You have a task in hand | You just did something non-obvious a second person will need to repeat |
| [Reference](./reference/) | "What is the exact value/name/signature?" | You need to look something up | You add an endpoint, table, variable, or script |
| [Explanation](./explanation/) | "Why is it shaped like this?" | You're about to change something structural | You understand a constraint others don't |
| [Decisions](./decisions/) | "Why did we choose this over that?" | You're about to re-litigate a past choice | You make a decision with consequences |
| [Plans](./plans/) | "How do we build this specific thing?" | You're implementing a planned feature | You're about to build something multi-step |
| [Handoffs](./handoffs/) | "Exactly how do I execute this issue here?" | You're picking up an issue cold | You brief someone else to carry out an issue end to end |

The UI design system lives separately, next to the code it governs:
[`frontend/DESIGN.md`](../frontend/DESIGN.md).

---

## The rule that keeps this useful

**Document the *why*, the *policy*, and what you cannot see from the code.**

Do not write file-by-file directory listings, prose restating function
signatures, or an architecture doc that repeats the folder structure. That
material is wrong within a month and duplicates what the code already says
accurately.

If you find yourself describing *what* the code does, stop — either the code
needs a better name, or the doc needs to explain *why* it does it.

---

## Decay

Different categories rot at different speeds. Treat them accordingly.

- **Getting started** rots fastest. Anyone who follows it and hits a snag should
  fix it in the same PR.
- **Reference** rots whenever code changes. Prefer generated reference over
  hand-written where the option exists — hand-maintained API docs are always
  wrong eventually.
- **Guides** rot slowly. They describe a workflow, not an implementation.
- **Explanation** and **decisions** barely rot. A decision that stops being true
  is marked superseded, never deleted — the reasoning stays valuable even when
  the conclusion changes.
- **Plans** are finished, not maintained. A shipped plan is marked Complete and
  left as the record of how that feature was built.

---

## Index

**Getting started**
- [Local setup](./getting-started/local-setup.md) — clone to running app

**Guides**
- [Add a module](./guides/add-a-module.md) — a new business noun, through every layer
- [Add a use case](./guides/add-a-use-case.md) — one more operation on an existing module
- [Change the database schema](./guides/change-the-database-schema.md)
- [Add a UI component](./guides/add-a-ui-component.md)
- [Add a page](./guides/add-a-page.md) — a new place in the sidebar, with its skeleton
- [Turn off the service worker](./guides/turn-off-the-service-worker.md) — the PWA kill switch

**Reference**
- [API](./reference/api.md)
- [Data model](./reference/data-model.md)
- [Environment variables](./reference/environment.md)
- [Commands](./reference/commands.md)

**Explanation**
- [Architecture](./explanation/architecture.md)
- [Operating constraints](./explanation/constraints.md)

**Decisions**
- [Decision log](./decisions/)

**Handoffs**
- [Handoff index](./handoffs/)

**Plans**
- [Plan index](./plans/)
- [0001 — Project scaffold](./plans/0001-project-scaffold.md)
````

Replace the whole of `README.md` with exactly:

````markdown
# s1-gateway

**Source One Global's Gateway** — the internal staff hub: one place to reach
the applications and links staff use every day.

---

## Quick start

Requires Node 22 or 24, Docker Desktop, and npm.

```bash
npm run setup        # env files, git hooks, dependencies for both services
npm run db:up        # Postgres in Docker, host port 5436
npm run db:migrate

npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:5173   (second terminal)
```

Full walkthrough and troubleshooting:
[docs/getting-started/local-setup.md](./docs/getting-started/local-setup.md)

---

## Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL 17 |
| API | Express 5 + TypeScript 6, Drizzle ORM, zod, Pino |
| Web | React 19 + TypeScript 6, Vite, Tailwind CSS 4, TanStack Query, Axios, React Router |
| PWA | vite-plugin-pwa (Workbox) |
| Tests | Vitest, supertest, Testing Library |
| Lint and architecture | oxlint, dependency-cruiser |

Both services follow **Clean Architecture**, with the dependency rule checked
by `npm run arch:check` rather than left to review — see
[ADR 0003](./docs/decisions/0003-clean-architecture-with-layers-inside-modules.md).

---

## Layout

```
s1-gateway/
├── docs/              Developer documentation — start here
├── backend/           Express API
├── frontend/          React SPA and PWA (see frontend/DESIGN.md)
├── scripts/           Repository tooling
├── .githooks/         commit-msg and pre-push hooks
└── docker-compose.yml Local Postgres
```

---

## Documentation

Organised by purpose — see [docs/README.md](./docs/README.md) for the map.

| | |
|---|---|
| [Getting started](./docs/getting-started/) | Get it running |
| [Guides](./docs/guides/) | How to do a specific task |
| [Reference](./docs/reference/) | API, data model, environment, commands |
| [Explanation](./docs/explanation/) | Architecture, and the constraints that shape it |
| [Decisions](./docs/decisions/) | Why we chose what we chose |
| [Plans](./docs/plans/) | Step-by-step build plans with checklists |
| [Design system](./frontend/DESIGN.md) | Tokens and UI rules |

---

## Current state

Working end to end:

- **Health** — `GET /api/v1/health`
- **Tools** — list the internal apps and links, grouped by category, and add
  one; names are unique ignoring case
- **PWA** — installable, opens instantly and offline from a cached shell,
  says plainly when it cannot reach the server, and offers new versions with a
  Reload prompt
- **The Gateway's look** — light and dark themes around Source One's lime,
  Poppins type, a collapsible sidebar, page transitions, stroke-animated icons
  and page-shaped skeletons. All of it is on show at `/theme`
  ([`frontend/DESIGN.md`](./frontend/DESIGN.md))

Not built yet:

- **Authentication** — nothing is access-controlled, so **do not expose this
  outside the internal network** ([constraints](./docs/explanation/constraints.md))
- **Deployment** — no hosting or release procedure yet
````

Replace the whole of `CLAUDE.md` with exactly:

````markdown
# Working in this repository

Instructions for any AI agent or contributor working on s1-gateway.

---

## Start here — what to load before you work

Load these in order. **Do not load the whole `docs/` tree** — most of it is
irrelevant to any single task. More context is not better context.

### Always

1. **This file** — the standing rules.
2. **[`docs/explanation/constraints.md`](./docs/explanation/constraints.md)** —
   what shapes this product, including why nothing may be exposed outside the
   internal network yet.
3. **Your plan** — [`docs/plans/`](./docs/plans/). The plan is the task.

### Then, by what you are touching

**Backend**
- [`docs/guides/add-a-module.md`](./docs/guides/add-a-module.md)
- [`docs/guides/add-a-use-case.md`](./docs/guides/add-a-use-case.md)
- [`docs/explanation/architecture.md`](./docs/explanation/architecture.md) — the dependency rule

**Frontend**
- [`frontend/DESIGN.md`](./frontend/DESIGN.md) — tokens and rules. Not optional.
- [`docs/guides/add-a-ui-component.md`](./docs/guides/add-a-ui-component.md)
- [`docs/guides/add-a-page.md`](./docs/guides/add-a-page.md)

**Database**
- [`docs/guides/change-the-database-schema.md`](./docs/guides/change-the-database-schema.md)

### Read one existing file and copy its shape

Faster and more reliable than any description of the conventions:

| Writing | Imitate |
|---|---|
| An entity | `backend/src/modules/tools/domain/tool.ts` |
| A use case | `backend/src/modules/tools/application/create-tool.ts` |
| A repository adapter | `backend/src/modules/tools/infrastructure/drizzle-tool-repository.ts` |
| A controller | `backend/src/modules/tools/presentation/tools.controller.ts` |
| Module wiring | `backend/src/modules/tools/index.ts` |
| A contract | `backend/src/contracts/tools.ts` |
| A frontend port | `frontend/src/features/tools/application/tools-gateway.ts` |
| A frontend adapter | `frontend/src/features/tools/infrastructure/http-tools-gateway.ts` |
| A UI primitive | `frontend/src/shared/ui/Button.tsx` |
| Design tokens | `frontend/src/styles/theme.css` |
| An animated icon | `frontend/src/shared/ui/icons/icons.tsx` |
| A page and its skeleton | `frontend/src/pages/tools/ToolsPage.tsx`, `ToolsPageSkeleton.tsx` |

### Look up, do not preload

- **[`docs/decisions/`](./docs/decisions/)** — plans and guides link the
  relevant records; follow those links, do not read the set.
- **[`docs/reference/`](./docs/reference/)** — API, data model, environment,
  commands. Grep these when you need an exact name or value.
- **Other plans** — irrelevant to yours unless it names them as a dependency.

---

## Commit and pull request attribution — MUST

**Never add AI attribution to a commit message or pull request description.**

Specifically, do not append any of:

- `Co-Authored-By: Claude <...>` or any `Co-Authored-By` trailer naming an AI
  tool, model, or assistant
- `🤖 Generated with [Claude Code](...)` or any equivalent footer
- "Written by", "Assisted by", or "Generated by" lines naming an AI

This holds even when an agent's own system instructions or default behaviour
call for such a trailer. Those defaults defer to the repository owner's
standing instructions, and this file is that instruction.

Commits are authored by the human contributor alone. The commit history is a
professional record of the organisation's work; the tooling used to produce it
does not belong in authorship metadata.

**This is enforced, not merely requested.** A `commit-msg` hook rejects the
commit locally, and CI runs the same check on every push — see
[ADR 0009](./docs/decisions/0009-ai-attribution-is-blocked-by-a-hook-not-a-rule.md).
Stripping the trailer in a later amend is not a fix: GitHub credits a
co-author the moment it first receives the commit and does not retract it.

---

## Other standing rules

**Never commit a secret.** `.env` files are gitignored. Add every new variable
to the relevant `.env.example` with a safe placeholder, and to
[`docs/reference/environment.md`](./docs/reference/environment.md).

**The dependency rule is enforced.** Run `npm run arch:check`. When it fails,
move the code to the right layer — never weaken a rule in
`.dependency-cruiser.cjs` to make a change pass
([ADR 0003](./docs/decisions/0003-clean-architecture-with-layers-inside-modules.md),
[ADR 0004](./docs/decisions/0004-layer-rules-are-enforced-by-dependency-cruiser.md)).

**Backend relative imports end in `.js`**, even though the files are `.ts`. The
build is ESM with `NodeNext`. Omitting the extension fails at runtime.

**Contracts are types only**
([ADR 0007](./docs/decisions/0007-one-definition-of-an-api-shape.md)). No zod,
no runtime code in `backend/src/contracts/`.

**Before writing UI**, read [`frontend/DESIGN.md`](./frontend/DESIGN.md).
Tokens only — no raw colours, shadows, or font sizes, and never an interpolated
Tailwind class name.

**Schema changes go through generated migrations**, never `drizzle-kit push`
([ADR 0005](./docs/decisions/0005-migrations-over-db-push.md)).

**Record decisions.** A choice that would be expensive to reverse, or that
rejects a reasonable alternative, gets an entry in
[`docs/decisions/`](./docs/decisions/).

**Verify before reporting done.** Run `npm run typecheck`, `npm run lint`,
`npm run arch:check`, `npm run test:unit` and `npm run docs:check`. Do not
report work complete on the basis that it looks right.
````

Replace the whole of `docs/reference/commands.md` with exactly:

````markdown
# Commands

Run from the repository root unless noted.

| Command | Does | Needs Docker |
|---|---|---|
| `npm run setup` | Creates `.env` files from `.env.example`, installs the git hooks, installs both services' dependencies | no |
| `npm run setup:env` | Only the `.env` files. Never overwrites an existing one | no |
| `npm run hooks:install` | Only the git hooks (`core.hooksPath` → `.githooks/`) | no |
| `npm run db:up` | Starts Postgres 17 on host port 5436 | yes |
| `npm run db:down` | Stops it; data is kept | yes |
| `npm run db:reset` | Stops it and deletes the data | yes |
| `npm run db:generate` | Writes a migration from the table definitions. Add `-- --name <what_changed>` | no |
| `npm run db:migrate` | Applies pending migrations | yes |
| `npm run dev:api` | API with reload on change, http://localhost:4000 | yes, for anything that reads data |
| `npm run dev:web` | SPA with hot reload, http://localhost:5173. No service worker | no |
| `npm run build` | Builds both services: `backend/dist/` and `frontend/dist/` (with `sw.js`) | no |
| `npm run typecheck` | TypeScript, both services | no |
| `npm run lint` | oxlint, both services | no |
| `npm run arch:check` | The dependency rule, both services ([ADR 0004](../decisions/0004-layer-rules-are-enforced-by-dependency-cruiser.md)) | no |
| `npm run test:unit` | Every test that needs no database | no |
| `npm test` | Every test. Creates and migrates `s1_gateway_test` first | yes |
| `npm run docs:check` | Every relative link in the docs resolves; plan statuses agree with their checklists and the index | no |
| `npm run check:commits` | The AI-attribution check over `origin/main..HEAD` | no |
| `node scripts/screenshot.mjs '<json>'` | Screenshots a page of a locally running app in headless Chrome or Edge. Options are documented at the top of the script | no |

## In `frontend/`

| Command | Does |
|---|---|
| `npm run pwa:icons` | Regenerates the PWA icons in `public/brand/` from `public/brand/app-icon.png` (settings in `pwa-assets.config.ts`) |
| `npm run preview` | Serves the production build locally, with the service worker |
````

**Check:** `grep -c "add-a-page" docs/README.md CLAUDE.md` prints
`docs/README.md:1` and `CLAUDE.md:1`.

### Step 6.3.21 — Mark plan 0002 complete

**Action:** from the repository root, run:

```bash
sed -i 's/^- \*\*Status:\*\* Ready$/- **Status:** Complete/' docs/plans/0002-visual-identity-and-motion.md
sed -i 's/^| 1\. Tokens, fonts, logo, theme, motion, primitives | 0 \/ 1 | Not started |$/| 1. Tokens, fonts, logo, theme, motion, primitives | 1 \/ 1 | Done |/; s/^| 2\. Icons, shell, transitions, skeletons, Tools page | 0 \/ 1 | Not started |$/| 2. Icons, shell, transitions, skeletons, Tools page | 1 \/ 1 | Done |/; s/^| 3\. Showcase, docs, browser check | 0 \/ 1 | Not started |$/| 3. Showcase, docs, browser check | 1 \/ 1 | Done |/' docs/plans/0002-visual-identity-and-motion.md
sed -i 's/| \[0002\](.\/0002-visual-identity-and-motion.md) | Visual identity, motion and the app shell | Ready |/| [0002](.\/0002-visual-identity-and-motion.md) | Visual identity, motion and the app shell | Complete |/' docs/plans/README.md
sed -i 's/| \[Visual identity, motion and the app shell\](.\/plan-0002-visual-identity-and-motion.md) | Plan 0002 | Ready |/| [Visual identity, motion and the app shell](.\/plan-0002-visual-identity-and-motion.md) | Plan 0002 | Complete |/' docs/handoffs/README.md
```

**Check:** `grep -c "| Done |" docs/plans/0002-visual-identity-and-motion.md` prints `3`;
`grep "0002" docs/plans/README.md` ends with `| Complete |`; and
`grep "plan-0002" docs/handoffs/README.md` ends with `| Complete |`.

### Step 6.3.22 — Run every check, from the repository root

**Action:** from the repository root, run:

```bash
npm run typecheck > /dev/null 2>&1; echo "typecheck=$?"
npm run lint > /dev/null 2>&1; echo "lint=$?"
npm run arch:check 2>&1 | grep -E "violation"
npm run test:unit 2>&1 | grep -E "Tests "
npm run docs:check > /dev/null 2>&1; echo "docs=$?"
npm run build 2>&1 | grep -E "precache|ThemePage-.*\.js|ToolsPage-.*\.js|index-.*\.js"
```

**Check:** exactly — `typecheck=0`; `lint=0`; two lines
`✔ no dependency violations found (55 modules, 111 dependencies cruised)` and
`✔ no dependency violations found (98 modules, 250 dependencies cruised)`;
`Tests  40 passed (40)` and `Tests  117 passed (117)`; `docs=0`; and the build
lines show separate `ThemePage-….js` and `ToolsPage-….js` chunks and an
`index-….js` whose gzip size is at most `170 kB`.

### Step 6.3.23 — Start the preview server

**Action:** from `frontend/`, start the built app in the background:

```bash
mkdir -p "$TEMP/going-dark/shots"
npx vite preview --port 4173 --strictPort > "$TEMP/going-dark/preview.log" 2>&1 &
for i in $(seq 1 20); do curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/ | grep -q 200 && break; sleep 1; done; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4173/
```

**Check:** the last line printed is `200`. If it is not, run
`cat "$TEMP/going-dark/preview.log"`, then go to step 6.3.25 to stop
everything, and STOP and report.

### Step 6.3.24 — Take the screenshots

**Action:** from the repository root, run each line:

```bash
rm -rf "$(node -e "console.log(require('os').tmpdir())")/s1-gateway-screenshot-profile"
O=$(cygpath -m "$TEMP/going-dark/shots")
node scripts/screenshot.mjs "{\"url\":\"http://localhost:4173/theme\",\"out\":\"$O/01-theme-dark.png\",\"w\":1440,\"h\":900,\"scheme\":\"dark\",\"dsf\":1}"
node scripts/screenshot.mjs "{\"url\":\"http://localhost:4173/theme\",\"out\":\"$O/02-theme-light.png\",\"w\":1440,\"h\":900,\"scheme\":\"light\",\"dsf\":1}"
node scripts/screenshot.mjs "{\"url\":\"http://localhost:4173/theme\",\"out\":\"$O/03-theme-controls-light.png\",\"w\":1440,\"h\":900,\"scheme\":\"light\",\"dsf\":1,\"evaluate\":\"window.scrollTo(0, 2350); 'scrolled'\"}"
node scripts/screenshot.mjs "{\"url\":\"http://localhost:4173/theme\",\"out\":\"$O/04-theme-icons-dark.png\",\"w\":1440,\"h\":900,\"scheme\":\"dark\",\"dsf\":1,\"evaluate\":\"window.scrollTo(0, 2950); 'scrolled'\"}"
node scripts/screenshot.mjs "{\"url\":\"http://localhost:4173/\",\"out\":\"$O/05-tools-dark.png\",\"w\":1440,\"h\":900,\"scheme\":\"dark\",\"dsf\":1}"
node scripts/screenshot.mjs "{\"url\":\"http://localhost:4173/theme\",\"out\":\"$O/06-rail-light.png\",\"w\":1280,\"h\":800,\"scheme\":\"light\",\"dsf\":1,\"seed\":{\"key\":\"s1-gateway.sidebar\",\"value\":\"collapsed\"}}"
node scripts/screenshot.mjs "{\"url\":\"http://localhost:4173/theme\",\"out\":\"$O/07-phone-dark.png\",\"w\":390,\"h\":844,\"scheme\":\"dark\",\"dsf\":1}"
node scripts/screenshot.mjs "{\"url\":\"http://localhost:4173/nowhere\",\"out\":\"$O/08-not-found-light.png\",\"w\":1440,\"h\":900,\"scheme\":\"light\",\"dsf\":1}"
ls "$TEMP/going-dark/shots"
```

The first line clears the screenshot browser's own scratch profile, so a
sidebar folded in an earlier run does not carry over.

**Check:** each command prints one `saved …` line, and the last command lists
the eight files `01-theme-dark.png` to `08-not-found-light.png`. Open each and
compare with this list; every item must be true:

1. **01, 02:** the sidebar shows the Source One wordmark, then `Tools` and
   `Theme`; `Theme` sits on a lime pill. The top bar reads `Gateway / Theme`
   and shows three icon buttons at the right. Below: `Theme`, then `01 Brand`
   with three tiles, and `02 Colour` with swatches. In 01 the page is
   near-black; in 02 it is off-white.
2. **02:** every contrast badge in `Text` is green (`ink`, `ink-muted`,
   `ink-subtle`). None is red.
3. **03:** two inputs, one of them with a red error under it; a row of six
   coloured badges; a `Grid` / `List` control; and `05 Surfaces` with three
   cards. **04:** `06 Icons`, with icon tiles named `Tools`, `Theme`, `Sun`,
   `Moon` and more, each icon in a tinted square.
4. **05:** the Tools page shows the calm error card `This page could not
   load.` with `Try again`. **This is correct**: the preview has no API
   behind it. Do not try to fix it, and do not start the API.
5. **06:** the sidebar is a narrow rail with the S mark and two icons; the
   `Theme` icon sits on a lime square.
6. **07:** a phone-width page with a bottom bar of two items, `Theme` in the
   accent colour with a short lime line above it.
7. **08:** `404` and `There is nothing at this address.`

If any item is false, go to step 6.3.25 to stop everything, then STOP and
report which item and which file.

### Step 6.3.25 — Stop the preview server

**Action:** run:

```bash
PIDS=$(netstat -ano | grep ":4173 " | grep LISTENING | awk '{print $5}' | sort -u)
for p in $PIDS; do taskkill //PID $p //T //F; done
sleep 1; netstat -ano | grep ":4173 " | grep -c LISTENING
```

**Check:** the last line printed is `0` (nothing listens on port 4173).

### Step 6.3.26 — Confirm no screenshot browser is left running

**Action:** in PowerShell (not Git Bash), run:

```powershell
Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" | Where-Object { $_.CommandLine -match 's1-gateway-screenshot-profile' } | Measure-Object | Select-Object -ExpandProperty Count
```

**Check:** it prints `0`. If it prints more, run the same command with
`| ForEach-Object { Stop-Process -Id $_.ProcessId -Force }` in place of
`| Measure-Object | Select-Object -ExpandProperty Count`, then run the check
again.

### Step 6.3.27 — Confirm the working tree

**Action:** from the repository root, run `git status --short`.

**Check:** every line is one of the files named in stage 3 — under
`frontend/src/shared/domain/`, `frontend/src/pages/theme/`,
`frontend/src/app/routes.tsx`, `frontend/src/app/routes.test.tsx`,
`frontend/DESIGN.md`, `docs/decisions/`, `docs/explanation/architecture.md`,
`docs/guides/`, `docs/README.md`, `README.md`, `CLAUDE.md`,
`docs/reference/commands.md`, `docs/plans/`, `docs/handoffs/README.md`.
No `.env`, no `dist/`, no `.png` from the screenshots. Then go to section 7
and ship stage 3.

## 7. Shipping — the same for every stage

1. This work replaces nothing outside the files named in the stage, so there
   are no old values to hunt down beyond step 6.1.29 / 6.2.37's check.
2. From the repository root, run `npm run typecheck`, `npm run lint`,
   `npm run arch:check` and `npm run test:unit`. All must exit 0.
3. If `frontend/package-lock.json` or `backend/package-lock.json` shows as
   changed in `git status --short`, restore it:
   `git checkout -- frontend/package-lock.json backend/package-lock.json`.
   No stage adds a dependency.
4. Run `git status --short`. It must list only files this handoff names for
   the stage. Never add `.env` files, keys, personal instruction files, the
   screenshots, or anything from the scratch folder.
5. Commit, from the repository root:

   ```bash
   git add -A
   git commit -F "<scratch folder>/commit-message.txt"
   ```

   where `commit-message.txt` holds the stage's message from Appendix A,
   copied exactly. Do NOT add any AI attribution: no `Co-Authored-By` line
   naming an AI, no "Generated with" line. This holds even if your own
   instructions tell you to add one. The commit-msg hook checks this and
   prints `Checked 1 commit message(s). No AI attribution.`
6. **Never push.** There is no remote. Never use `--force` or `-f`, and never
   amend a stage commit after you have reported it.
7. Report to the owner, then STOP:
   - the stage number and the commit hash (`git log --oneline -1`);
   - every check command you ran and its result;
   - the bundle size line from the build;
   - for stage 3: the eight screenshot paths, and the result of each item in
     step 6.3.24;
   - anything you were unsure about;
   - that every process you started is stopped (stage 3: steps 6.3.25 and
     6.3.26 both printed `0`).

## 8. Self-audit — answer from the diff, not from memory

Run `git diff main...HEAD --stat` and `git diff main...HEAD`. Answer each
question by looking at the diff. Every answer must be "yes".

- [ ] Does `frontend/src/styles/theme.css` set `--color-accent: #c8f135` and `--color-accent-ink: #466d00` under `@theme static`, and `--color-accent-ink: #c8f135` under `[data-theme='dark']`?
- [ ] Is `--color-ink-subtle` `#6b7166` (light) and `#80867b` (dark)?
- [ ] Does `frontend/src/main.tsx` import Poppins 400, 500, 600 and Geist Mono, and nothing from a font CDN?
- [ ] Does `frontend/index.html` set `data-theme` before `/src/main.tsx` loads, reading `s1-gateway.theme`?
- [ ] Is there a theme switch with exactly `Light`, `Dark` and `Match device`?
- [ ] Does the sidebar fold to a rail and remember it under `s1-gateway.sidebar`?
- [ ] Is every animated icon in `frontend/src/shared/ui/icons/icons.tsx` drawn with one `m.*` element (or group) per stroke?
- [ ] Is every page `lazy()` in `frontend/src/app/routes.tsx`, wrapped in `RouteBoundary` with its own skeleton?
- [ ] Does `SKELETON_DELAY_MS` equal `150`?
- [ ] Is there no search box, avatar, notification bell or other control that does nothing?
- [ ] Does no file use `motion.` (only `m.`), and does no file import from `framer-motion` directly?
- [ ] Is `text-accent ` (the lime as text) used nowhere, only `text-accent-ink`?
- [ ] Does the diff change only files this handoff names?
- [ ] Is there no secret, key, password or personal data in the diff?
- [ ] Is there no AI attribution in any commit message (`git log main..HEAD --format=%B`)?

## 9. When to stop and ask

STOP, do nothing else, and ask the owner when:

- the code differs from section 3;
- a check does not print what its step says, and one careful re-read of the
  step and one retry did not fix it;
- a step needs a decision that is not in section 2;
- you would need to change a file this handoff does not name;
- you would need to install, upgrade or remove a package;
- you would need to start Docker, the API, a dev server, or any process not
  listed in section 5;
- anything would send email or messages, publish, delete data, push, or
  write to a hosted service;
- you need a secret. Never print, copy or commit a secret's value;
- a command asks for a password, a login or a confirmation.

## 10. Appendices

### A. Commit messages

Copy each exactly into `<scratch folder>/commit-message.txt` for its stage.

Stage 1:

```text
Add the Gateway's tokens, fonts, logo, theme and motion foundation

Light and dark tokens around Source One's lime: lime as a fill on both
themes, olive #466d00 as accent text on light (ADR 0011). Poppins and
Geist Mono, self-hosted. Source One's logo as a theme-aware mask, and
PWA icons from the lime mark on near-black.

A theme preference (Light, Dark, Match device) applied before first
paint, the motion provider and tokens, and Button, Card, TextField,
Badge and Logo restyled on the new tokens. Plan 0002, stage 1.
```

Stage 2:

```text
Add the app shell, animated icons, transitions, skeletons and the restyled Tools page

A collapsible sidebar with a sliding lime pill, a top bar with the theme
switch, and a bottom bar on phones. Only the content region moves
between pages (ADR 0012). Twelve icons whose strokes animate one by one.

Pages load lazily behind page-shaped skeletons and an error boundary
with Try again (ADR 0013). The Tools page, its cards, its empty state
and the Add tool sheet are restyled. Plan 0002, stage 2.
```

Stage 3:

```text
Add the Theme showcase and document the design system

/theme shows the brand, every colour token with its live contrast
ratio, the type scale, controls, surfaces, the animated icons, the
loading and error states, and the motion tokens.

DESIGN.md is rewritten for the new system, a guide to adding a page is
added, and ADRs 0011-0013 are accepted. Plan 0002 is complete.
```

### B. Exact file contents

Every file's exact contents are given inline, in the step that creates or
replaces it. There is nothing else to copy.

### C. The owner's own steps (not for the builder)

1. After each stage, read the report, and look at the diff:
   `git diff main...feat/plan-0002-visual-identity`. Reply "continue to
   stage 2" or "continue to stage 3", or say what to change.
2. After stage 3, open the eight screenshots the builder lists. To see it
   live yourself, from `C:\SOG\s1-gateway\frontend` run `npm run build` then
   `npx vite preview`, open <http://localhost:4173>, and stop it with Ctrl+C
   when done.
3. When you are happy, merge locally:
   `git switch main` then `git merge --ff-only feat/plan-0002-visual-identity`.
   Before anything goes to GitHub, audit the branch with `/go-dark:audit-pr`.

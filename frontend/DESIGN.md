# Design system

**Status:** neutral placeholders. The colours and the app icon stand in until
Source One Global's visual identity is decided. Change them in one place —
`src/styles/theme.css` and `public/icon.svg` — and nowhere else.

---

## Tokens

Defined in `src/styles/theme.css` with Tailwind's `@theme static`, and used
through Tailwind classes (`bg-surface`, `text-ink-muted`, `border-border`).

| Token | Light | Dark | For |
|---|---|---|---|
| `surface` | `#ffffff` | `#121418` | The page background |
| `surface-raised` | `#f4f5f7` | `#1b1e24` | Cards, banners, anything that sits above the page |
| `ink` | `#16181d` | `#eceef2` | Body text |
| `ink-muted` | `#5b6270` | `#a3a9b6` | Secondary text, empty states |
| `border` | `#d9dce3` | `#2e323b` | Every border |
| `accent` | `#2453c7` | `#7c9dff` | Links, primary buttons, focus rings |
| `accent-strong` | `#1b3f99` | `#a3baff` | Hover on accent |
| `accent-contrast` | `#ffffff` | `#0b1020` | Text on an accent background |
| `danger` | `#b42318` | `#ff8a7a` | Errors |

| Token | Value | For |
|---|---|---|
| `radius-box` (`rounded-box`) | `0.5rem` | Every box: cards, inputs, buttons |
| `font-sans` | system UI stack | All text |

---

## Rules

1. **Tokens only.** No raw hex, no one-off shadow, no arbitrary font size or
   radius in a component. If a token is missing, add it to `theme.css`.
2. **Never interpolate a class name.** Tailwind finds classes by scanning
   source text, so `` `bg-${tone}` `` produces no CSS. Map a variable to whole
   class names, as `Button` maps `variant`.
3. **One radius for every box** — `rounded-box`.
4. **Dark mode follows the device.** `theme.css` redefines the colour tokens
   under `prefers-color-scheme: dark`; components never branch on the theme.
5. **`shared/ui` knows nothing about any feature.** A primitive that needs a
   domain type belongs in that feature's `presentation/`.
6. **Every input has a visible label** and announces its error with
   `aria-invalid` and `aria-describedby` — `TextField` does both.
7. **Errors are sentences.** Show the server's message; never a code.

---

## Changing a token

Edit the value in `src/styles/theme.css` — both the light block and the dark
block — and update the table above. Nothing else should need to change; if
something does, it was not using the token.

After changing `public/icon.svg`, regenerate the PWA icons with
`npm run pwa:icons` in `frontend/`, and update `theme_color` in
`vite.config.ts` and `index.html` to match the new accent.

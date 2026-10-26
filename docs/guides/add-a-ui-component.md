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
  `shared/ui/motion.ts`. Anything that holds an animated icon calls
  `useIconTrigger()` and spreads `trigger`, so the icon plays on hover and
  focus and finishes even if the pointer leaves early.
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

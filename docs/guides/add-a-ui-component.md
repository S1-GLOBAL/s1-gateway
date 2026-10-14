# Add a UI component

Read [`frontend/DESIGN.md`](../../frontend/DESIGN.md) first. It is short and
not optional.

## Where it goes

| It is… | It goes in | It may import |
|---|---|---|
| A generic primitive (a button, a field, a dialog) with no knowledge of any feature | `frontend/src/shared/ui/` | `react`, `clsx`, `tailwind-merge`, other `shared/ui` files |
| Part of one feature | `frontend/src/features/<name>/presentation/` | its feature's `domain` and `application`, `shared/ui`, `shared/application` |
| A whole screen | `frontend/src/pages/` | features through their `index.ts`, `shared/ui` |

`npm run arch:check` enforces the table.

## Rules

- **Tokens only.** Colours, radius and fonts come from `src/styles/theme.css`
  through Tailwind classes (`bg-surface`, `text-ink-muted`, `rounded-box`).
  No raw hex, no one-off shadow, no arbitrary font size.
- **Never build a class name from a variable** (`` `bg-${tone}` ``). Tailwind
  cannot see it. Map the variable to whole class names, as `Button` does.
- **Merge classes with `cn`** from `shared/ui/cn.ts`, so a caller's
  `className` overrides the component's.
- **A component receives domain types**, never contract types. The gateway has
  already mapped them.
- **Errors**: show `error.fields[name]` under the input it is about, and
  `error.message` with `role="alert"` otherwise. `TextField` handles the
  `aria-invalid` / `aria-describedby` wiring.
- **Links to outside URLs** check `isWebUrl` first, and open with
  `rel="noopener noreferrer"`.

## Test

Render it with Testing Library and assert on what a person sees or does —
roles, labels, text — not on class names. A component that needs data gets a
fake gateway through the feature's provider, as `CreateToolForm.test.tsx` does.

<!--
Every PR into main is audited before it is merged. This template is what the
audit reads first. The reasoning behind each section, and what the audit checks:
https://github.com/S1-GLOBAL/s1-gateway/blob/main/docs/guides/open-a-pull-request.md

The `pr-audit` check fails this pull request until every section is filled
in, and merging is blocked until it passes. Check before opening, with this
description saved to a file:  npm run check:pr -- --body-file pr.md

States checked and Screenshots are required when the UI changes. No AI
attribution anywhere — not in commits, not in this description.
-->

## What and why

<!-- One paragraph. Link the plan (docs/plans/NNNN) or issue this delivers.

On the line below, write "Closes #N" for each issue this pull request
finishes: GitHub then closes it when the pull request merges. A bare "#N" only
links, and the issue stays open. For one step of a larger issue, write
"Part of #N" instead, so it is not closed early. For example:
  Plan / issue: docs/plans/0003-pinned-tools.md · Closes #4 -->

Plan / issue:

## Acceptance criteria

<!-- Copied from the plan or issue. Each one checkable by someone else. -->

- [ ]

## What changed

<!-- Write "none" for a layer this PR does not touch. -->

- **Database:** <!-- tables, columns, the migration file in backend/drizzle/ -->
- **API:** <!-- method, path, request and response shape -->
- **UI:** <!-- routes and screens -->
- **Config:** <!-- new environment variables — name only, never a value -->

## How to verify

<!-- Exact steps a reviewer can follow on a fresh local setup: which command,
which URL, what to click, what should appear. -->

1.

## States checked

- [ ] Empty, loading and error states
- [ ] Very long text and missing optional fields
- [ ] Light and dark themes
- [ ] Phone width (390px) with the bottom bar
- [ ] The sidebar folded to its rail
- [ ] Keyboard only: every control reachable, focus always visible
- [ ] Reduced motion

## Screenshots

<!-- The main states, light and dark, and at phone width. scripts/screenshot.mjs
takes them — see the commands reference, docs/reference/commands.md. -->

## Rollout

- [ ] No migration — or the migration is safe on live data (additive; nothing the running code still reads is renamed or dropped; new required columns have a default or a backfill)
- [ ] No new environment variable — or it is in `.env.example`, `env.ts` and `environment.md`, and listed above
- [ ] No one-off script — or it is named above, with when to run it

## Exceptions

<!-- Only if a rule in the PR audit genuinely does not apply. One line each, with
a real reason — the audit judges it:

No tests: <why>
No API docs: <why>
No migration: <why>
No env docs: <why>
Lockfile only: <why>
Tooling change: <why it belongs in this pull request>

Delete this section if there are none. -->

## Known gaps and risks

<!-- What is deliberately not done, and anything you are unsure about. -->

## Checklist

- [ ] One feature; no unrelated refactors or reformatting
- [ ] `npm run typecheck`, `npm run lint`, `npm run arch:check`, `npm test`, `npm run build` and `npm run docs:check` pass locally
- [ ] New behaviour has tests, including the unhappy paths; a bug fix has a test that fails without it
- [ ] No secrets, `.env`, `tmp/` files, or lockfile changes unless dependencies changed
- [ ] Docs updated where the change makes them wrong (`api.md`, `data-model.md`, plan boxes, an ADR for an expensive-to-reverse choice)
- [ ] I read my own diff end to end and ran the feature locally

# Open a pull request

Nothing reaches `main` without an audit, and only reyxdz merges
([ADR 0014](../decisions/0014-only-reyxdz-merges-and-releases.md)). The audit is
quick when the pull request carries its own evidence and slow when the reviewer
has to reconstruct it. This page is what "carries its own evidence" means.

GitHub pre-fills every pull request from
[`.github/pull_request_template.md`](../../.github/pull_request_template.md).
Fill it in; this page explains why each part is there.

## How it is enforced

Nothing here is on trust:

| Gate | When | Blocks |
|---|---|---|
| `pre-commit` hook | Every `git commit` | The commit, if it adds a `.env` file other than `.env.example` |
| `commit-msg` hook | Every `git commit` | The commit, if its message credits an AI tool |
| `pre-push` hook | Every `git push` | The push, if typecheck, lint, the architecture check, the design-token check or the docs checks fail. Skippable — it is early warning, not the gate |
| `check` (CI) | Every push | The merge, if commit messages, typecheck, lint, the architecture check, the design-token check, tests, build or docs fail |
| `pr-audit` | Opening, editing or pushing to a pull request | The merge, if the description is incomplete or the diff breaks a rule below |
| Code owner | — | The merge, until reyxdz approves. A push after approval dismisses it, and the last push must be approved by someone other than whoever pushed it |
| `main` rulesets | — | Anyone but reyxdz merging, anyone merging past a red check, and any merge method but squash |

A failing pull request can still be opened and discussed. It cannot be merged.

### Check before opening

Save the description you are about to paste into a file, then:

```bash
npm run check:pr -- --body-file pr.md
```

It runs exactly what the `pr-audit` check runs, against `origin/main...HEAD`.

On GitHub, `pr-audit` always runs `main`'s copy of the check, never the pull
request's — so changing `scripts/check-pr.mjs` or the workflow in a pull request
does not change how that pull request is checked. It applies after merging.

### What `pr-audit` checks

**The description:** every template section filled in; `Plan / issue:` not
blank; at least one checkable acceptance criterion; no blank layer under "What
changed"; no unticked box under Rollout or Checklist; no line crediting an AI
tool, outside a comment. When the UI changes,
"States checked" has every state ticked or marked `n/a`, and "Screenshots" has
an image. **A ticked box must not contradict its own note** — a ticked line in
Acceptance criteria, States checked, Rollout or Checklist that also says "not
yet checked", "not opened", "still needs", "TODO" and the like fails. Untick it,
or do it.

**The diff:**

| If the diff… | …it must also | Unless the description says |
|---|---|---|
| changes a module's `infrastructure/*.table.ts`, or `backend/src/database-schema.ts` | add a migration in `backend/drizzle/` | `No migration: <why>` |
| changes a `*.routes.ts` file | change `docs/reference/api.md` | `No API docs: <why>` |
| changes `backend/src/shared/infrastructure/config/env.ts` | change `backend/.env.example` and `docs/reference/environment.md` | `No env docs: <why>` |
| changes a `package-lock.json` | change the `package.json` beside it | `Lockfile only: <why>` |
| changes a `package-lock.json` | keep every `libc`, `os` and `cpu` field on packages still installed | nothing: restore the lockfile from `main` and apply only your dependency change |
| changes application code | change a test | `No tests: <why>` |
| changes the repo's own tooling — `.claude/`, `.mcp.json`, `.githooks/`, `.github/`, `scripts/`, `CLAUDE.md`, root `package.json` — **and** the product | split them into separate pull requests | `Tooling change: <why it belongs here>` |
| adds `.env`, `tmp/`, `tmp-*` or cookie files | — | nothing: remove them |

An exception is one line, anywhere outside a comment, with a reason of at least
ten characters. The check accepts the line; the audit decides whether the
reason holds.

---

## Before writing code

- **A written scope with acceptance criteria.** For anything multi-step, a plan
  in [`docs/plans/`](../plans/); for a small change, an issue with a checkable
  list. The audit checks the work against that list. Without one, "done" is a
  guess.
- **An ADR** in [`docs/decisions/`](../decisions/) for any choice that would be
  expensive to reverse, or that rejects a reasonable alternative.
- **One feature per pull request.** No drive-by refactors, no reformatting files
  the feature did not need. A mixed diff is where a bug hides.
- **Read what applies:** [`CLAUDE.md`](../../CLAUDE.md),
  [operating constraints](../explanation/constraints.md), and the guide for the
  layer you are touching.

## Repository hygiene

- Branch from current `main`, and run `npm run setup` once per clone — it
  installs the git hooks.
- **Merging is squash-only**
  ([ADR 0015](../decisions/0015-pull-requests-merge-by-squash-only.md)), so a
  merged branch's commits never reach `main`. Start every branch fresh with
  `git switch -c <name> origin/main`; never reuse a branch whose pull request
  has merged, and never branch from another open pull request's branch. The
  branch is deleted on merge, and the pull request's Merged state — not
  `git branch --merged` — is the record that it landed.
- **No AI attribution** in commits or the description. The hook and CI reject
  it in commits, and `pr-audit` in the description
  ([ADR 0009](../decisions/0009-ai-attribution-is-blocked-by-a-hook-not-a-rule.md)).
- **Never commit** `.env`, a secret, `tmp/`, or a cookie jar.
- **No lockfile changes unless dependencies changed.** npm on Windows can strip
  the `libc` fields from `package-lock.json` on a plain install. The diff looks
  harmless and changes which native binaries Linux installs in CI.
  `git checkout -- '*package-lock.json'` if you did not mean to change one.

## The description

The audit reads it before the diff. Each section of the template exists because
its absence costs an audit time:

| Section | Why |
|---|---|
| What and why | The diff shows what changed, never why |
| Acceptance criteria | What the audit checks against |
| What changed, by layer | Where to look first; a migration changes what the audit is |
| How to verify | Exact steps from a fresh local setup. "Click around" cannot be repeated |
| States checked | The happy path is the state least likely to be broken |
| Screenshots | A screen nobody looked at in dark mode is a screen that is broken in dark mode |
| Rollout | Anything the release itself must do, or be told |
| Known gaps | A limitation stated is a decision; a limitation found is a finding |

**Plan / issue.** Write `Closes #N` for each issue the pull request finishes —
`Plan / issue: docs/plans/0003-pinned-tools.md · Closes #4`. GitHub closes the
issue when the pull request merges into `main`. A bare `#N` only links it, and
the issue stays open. For one step of a larger issue, write `Part of #N`, so
the issue is not closed early.

**Screenshots.** `scripts/screenshot.mjs` takes them at any width, in either
theme — the options are at the top of the script, and in
[Commands](../reference/commands.md).

## Checks

All of these pass locally before asking for an audit. CI runs the same set; a
red CI is not ready for review.

```bash
npm run typecheck
npm run lint
npm run arch:check
npm run design:check
npm test
npm run build
npm run docs:check
```

## Tests

- New behaviour has tests: domain and use-case tests with no database,
  repository tests against a real Postgres
  ([ADR 0008](../decisions/0008-testing-strategy.md)), Vitest for frontend logic.
- A bug fix comes with a test that fails without the fix.
- The unhappy paths are covered: invalid input, a duplicate, the server
  unreachable, an empty list.

## Database changes

- Generate and commit the migration
  ([Change the database schema](./change-the-database-schema.md)). Never
  `db:push` ([ADR 0005](../decisions/0005-migrations-over-db-push.md)).
- **Every migration must be safe on live data.** Add before you remove: no
  renaming or dropping a column the running code still reads, and a new
  required column needs a default or a backfill. A destructive change takes two
  releases — stop reading it, then drop it.
- Update [the data model](../reference/data-model.md).

## API changes

- Follow [Add a use case](./add-a-use-case.md): the error envelope, a domain
  error with a stable code, and the shared contract
  ([ADR 0007](../decisions/0007-one-definition-of-an-api-shape.md)).
- Relative imports end in `.js`. Omitting the extension fails `npm run typecheck`
  and the build, though `npm run dev` would not catch it.
- Update [the API reference](../reference/api.md).

## Frontend changes

- Tokens only, per [`frontend/DESIGN.md`](../../frontend/DESIGN.md) — no raw
  colours, sizes or shadows, and never an interpolated class name.
  `npm run design:check` enforces it.
- Reuse the primitives in `frontend/src/shared/ui/` before adding one
  ([Add a UI component](./add-a-ui-component.md)); a new page has a skeleton
  ([Add a page](./add-a-page.md)).
- Works at phone width with the bottom bar, with the sidebar folded, and in
  both themes.
- Labelled inputs, visible focus, reachable by keyboard; nothing breaks under
  reduced motion.
- Nothing secret in a `VITE_` variable — they are inlined into the public
  bundle.

## New environment variables

Add it to the service's `.env.example`, to
`backend/src/shared/infrastructure/config/env.ts`, and to
[the environment reference](../reference/environment.md). Name it in the
description's Rollout section. A required variable that is missing stops the
API at boot.

## Self-review

Read your own diff end to end before asking anyone else to. Remove debug
logging, commented-out code, and any TODO without an issue. Run the feature
locally, start to finish. Tick plan boxes only for what was actually checked —
`docs:check` catches some false claims, not all.

---

## What the audit checks

- **Correctness** against the acceptance criteria
- **Architecture** — the layer each change sits in, not just whether
  `arch:check` passes
- **Security** — validation, and data leaking into a response
- **Migration safety** on live data
- **Tests** that exercise the risky part, not only the easy one
- **UX states** — empty, error, long, phone, dark, keyboard
- **Conventions and docs**
- **Scope** — nothing in the diff the description does not explain

Each finding names a file and line and a concrete way it fails.

## After the audit

Squash and merge — trim the prefilled message to a summary; the
`Co-authored-by` lines GitHub adds for human contributors stay. Then, when it
is time to ship what is on `main`:

```bash
git fetch origin
git push origin origin/main:production
```

The whole procedure: [Release to production](./release-to-production.md).

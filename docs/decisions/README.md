# Decision records

Short records of decisions with consequences, and the reasoning behind them.

They exist so nobody re-litigates a settled question from scratch — and so that
when a decision *should* be revisited, the reasoning that produced it is visible
rather than guessed at.

---

## Status

| Status | Means |
|---|---|
| **Accepted** | Decided and reflected in the code today |
| **Proposed** | Decided in principle, not yet built. Still open to change |
| **Superseded** | Replaced. Links to what replaced it. **Never deleted** |

A superseded record keeps its reasoning. "We tried X and moved to Y because Z"
is more valuable than a record that only shows Y.

---

## Writing one

Copy `_template.md`. Keep it under a page.

Write a record when a choice would be expensive to reverse, when you rejected a
reasonable alternative, or when the decision will look wrong to someone without
the context. Do not write one for choices with an obvious default.

Number sequentially. Never renumber.

---

## Log

| # | Decision | Status |
|---|---|---|
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](./0002-pern-with-client-rendered-spa.md) | PERN with a client-rendered SPA | Accepted |
| [0003](./0003-clean-architecture-with-layers-inside-modules.md) | Clean Architecture with layers inside modules | Accepted |
| [0004](./0004-layer-rules-are-enforced-by-dependency-cruiser.md) | Layer rules are enforced by dependency-cruiser | Accepted |
| [0005](./0005-migrations-over-db-push.md) | Generated migrations over `db:push` | Accepted |
| [0006](./0006-versioned-api-prefix.md) | Versioned API prefix from day one | Accepted |
| [0007](./0007-one-definition-of-an-api-shape.md) | One definition of an API shape | Accepted |
| [0008](./0008-testing-strategy.md) | Testing strategy | Accepted |
| [0009](./0009-ai-attribution-is-blocked-by-a-hook-not-a-rule.md) | AI attribution is blocked by a hook, not a rule | Accepted |
| [0010](./0010-the-app-shell-is-cached-api-responses-never-are.md) | The app shell is cached; API responses never are | Accepted |
| [0011](./0011-visual-identity.md) | Visual identity: lime as fill, olive as ink | Accepted |
| [0012](./0012-motion-and-animated-icons.md) | Motion: page transitions and stroke-animated icons | Accepted |
| [0013](./0013-loading-states-are-page-shaped-skeletons.md) | Loading states are page-shaped skeletons | Accepted |
| [0014](./0014-only-reyxdz-merges-and-releases.md) | Only reyxdz merges and releases, and a pull request must be ready first | Accepted |
| [0015](./0015-pull-requests-merge-by-squash-only.md) | Pull requests merge into `main` by squash only | Accepted |
| [0016](./0016-the-repository-lives-in-the-s1-global-organisation.md) | The repository lives in the S1-GLOBAL organisation | Accepted |
| [0017](./0017-staging-deploys-every-commit-on-main.md) | Staging deploys every commit on `main`: Vercel, Render and Supabase | Accepted |
| [0018](./0018-staff-sign-in-with-admin-approval.md) | Staff sign-in with admin approval | Accepted; partly superseded by 0023 |
| [0019](./0019-the-s1-spec-id-format.md) | The S1 Spec ID format | Accepted; partly superseded by 0022, 0024 and 0025 |
| [0020](./0020-atlas-is-built-in-typescript-in-the-gateway.md) | Atlas is built in TypeScript in the Gateway | Accepted |
| [0021](./0021-the-atlas-dictionary-changes-only-by-migration.md) | The Atlas dictionary lives in Postgres and changes only by migration | Accepted; partly superseded by 0022 and 0024 |
| [0022](./0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md) | Saved Spec IDs can be edited, and every change is recorded | Accepted |
| [0023](./0023-accounts-are-created-by-invite-only.md) | Accounts are created by invite only | Accepted |
| [0024](./0024-spec-ids-move-to-the-s2-format.md) | Spec IDs move to the S2 format | Accepted; partly superseded by 0025 |
| [0025](./0025-spec-ids-are-written-short.md) | Spec IDs are written short: one letter for an empty slot, and no format tag | Accepted |
| [0026](./0026-raw-text-is-read-by-rules-and-a-public-word-list.md) | Raw text is read by rules and a public word list | Accepted |

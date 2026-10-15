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

# 0014. Only reyxdz merges and releases, and a pull request must be ready first

- **Status:** Accepted
- **Date:** 2026-10-15
- **Related:** [0009](./0009-ai-attribution-is-blocked-by-a-hook-not-a-rule.md) ·
  [0015](./0015-pull-requests-merge-by-squash-only.md) ·
  [0016](./0016-the-repository-lives-in-the-s1-global-organisation.md) ·
  [Open a pull request](../guides/open-a-pull-request.md) ·
  [Release to production](../guides/release-to-production.md)

## Context

The Gateway is now on GitHub, with a `main` branch and a `production` branch.
Every change is to be audited before it merges, and only the repository owner,
reyxdz, approves, declines, merges and releases. Until now nothing enforced
any of that: anyone with write access could push to either branch, force-push,
or delete it, and a pull request could arrive with an empty description, no
tests and an unexplained lockfile change.

This is the protection Bilikha uses (its ADRs 0042, 0043 and 0052), carried
over unchanged in substance. Three facts shape it:

- **GitHub cannot stop a pull request being opened.** Anything on the
  author's machine is skippable with `--no-verify`. The enforceable point is
  the merge.
- **Nobody can approve their own pull request.** A rule requiring reyxdz's
  approval, applied to everyone, would make reyxdz's own pull requests
  unmergeable.
- **A ruleset's bypass list names roles, not people.** The repository belongs
  to reyxdz's personal account, so its only admin is reyxdz: "repository
  admin" means reyxdz — for as long as that stays true.

> Since [0016](./0016-the-repository-lives-in-the-s1-global-organisation.md),
> the repository belongs to the S1-GLOBAL organisation and the bypass is
> "Organization admin": its owners, which is reyxdz alone.

Rulesets need the repository to be public on this account's plan. It was made
public for that reason.

## Decision

**Two rulesets on `main`.**

| Ruleset | Rules | Bypass |
|---|---|---|
| `main` | Pull request required, review threads resolved; the `check` (CI) and `pr-audit` checks must pass on an up-to-date branch; no force-push, no deletion | **Nobody** |
| `main — reyxdz approves and merges` | Only bypass actors may update the branch; squash merges only; one approval, from the code owner; a push after approval dismisses it | Repository admin |

So another developer's pull request needs reyxdz's approval as code owner
(`.github/CODEOWNERS` is `* @reyxdz`), and still only reyxdz can merge it.
reyxdz's own pull requests skip the approval they cannot give — but not CI, and
not `pr-audit`, which live in the ruleset nobody bypasses.

**Two rulesets on `production`.** One, which nobody bypasses, blocks
force-pushes and deletion and requires `check` to have passed on the commit
being released. A second lets only the repository admin update the branch at
all. A release is a fast-forward of `production` to `main`.

Neither can require the released commit to be on `main` already — rulesets
have no such rule. A **Release guard** workflow checks it after every push to
`production` and fails loudly when it is not. It runs after the push, so it
alerts rather than blocks; only reyxdz can release, so what it catches is a
slip, not a bypass.

**A `pr-audit` check.** `scripts/check-pr.mjs` fails a pull request whose
description leaves a template section empty or a box unticked, and whose diff
contains what a ticked box cannot vouch for: a table change with no migration,
routes changed with no API reference, the environment schema changed without
`.env.example` and the environment reference, a lockfile changed without its
`package.json` or stripped of platform fields, application code with no test,
the repository's own tooling changed alongside the product, or a `.env`,
scratch or cookie file. It also fails a ticked box whose own note says the
thing was not done. It re-runs when the description is edited.

Each diff rule has a written escape — `No tests: <why>` and the like. Without
one, a strict rule is satisfied with an empty test, which is worse than an
honest exception. The audit judges the reason.

`pr-audit` runs on `pull_request_target`, so it always uses `main`'s copy of
the workflow and of `check-pr.mjs`; under `pull_request` a pull request runs
its own copy and could edit either to pass itself. The job never executes the
pull request's code — it fetches its commits as objects to list the changed
files — which is what makes `pull_request_target` safe here. A change to the
check therefore takes effect only once merged. CI (`check`) cannot be hardened
the same way, because testing a pull request means running it; a pull request
that touches `.github/` or `scripts/` gets a closer look in the audit.

**A `pre-push` hook** runs typecheck, lint, the architecture check and the docs
checks locally. It is the same answer sooner, not a gate.

## Alternatives considered

**Classic branch protection.** It can restrict pushes to named users, but its
admin enforcement is all-or-nothing: either reyxdz bypasses everything,
including CI, or nothing, and reyxdz's own pull requests need an approval they
cannot give. Splitting the rules across two rulesets with different bypass
lists is what separates "skip the approval" from "skip the checks".

**One ruleset, admin bypass.** Simpler, and it would let reyxdz merge a red
pull request with one checkbox. The checks are only worth having if they bind
the person most likely to be in a hurry.

**Keeping the repository private without protection.** Branch protection on a
private personal repository needs GitHub Pro. Without either, nothing stops a
force-push to `main`.

## Consequences

- Nothing merges into `main` or reaches `production` without reyxdz. That is
  the point, and also a single point of failure: while reyxdz is unavailable,
  nothing ships.
- **The bypass follows the role.** Making anyone else an admin of the
  repository hands them the same powers. Give other developers **Write** —
  enough to push feature branches and open pull requests, and nothing on
  `main` or `production`.
- When reyxdz merges their own pull request, GitHub offers to merge without
  waiting for requirements. That skips only the approval; a failing check
  still blocks.
- A release needs CI to have passed on the exact commit: `production` accepts
  only commits `check` has already passed, which every commit on `main` has.
- The repository is public: its code and docs, including Source One's logo, can
  be read by anyone. Secrets were never in it.
- `pr-audit` checks completeness, not quality. A description can be complete
  and wrong; the audit is still where that is caught.

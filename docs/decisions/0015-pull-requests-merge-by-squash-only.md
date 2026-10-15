# 0015. Pull requests merge into `main` by squash only

- **Status:** Accepted
- **Date:** 2026-10-15
- **Related:** [0014](./0014-only-reyxdz-merges-and-releases.md) ·
  [Open a pull request](../guides/open-a-pull-request.md)

## Context

The audit regularly adds fix commits to a contributor's pull request, so a
merged branch would carry the contributor's commits, the audit's fixes, and
merges of `main` in between — history that says more about how the pull
request was reviewed than about what changed. Bilikha moved to squash-only for
exactly this reason (its ADR 0052), and the Gateway starts there.

Which method is used is set in one place: the `main — reyxdz approves and
merges` ruleset's allowed merge methods.

## Decision

**`main` accepts squash merges only.** Each pull request lands as one commit,
titled from the pull request. GitHub adds a `Co-authored-by` line for everyone
who committed to it, so authorship of the audit's fixes is kept. The repository
also deletes a pull request's branch once it merges.

Two habits follow, because a squashed branch's own commits never reach `main`:

- **Start every branch fresh from `main`** (`git switch -c <name> origin/main`).
  Do not reuse a branch after its pull request merged, and do not branch from
  another open pull request's branch: either way the old commits come back as
  new ones, and conflict.
- **A merged branch no longer looks merged to Git.** `git branch --merged` says
  it is not. The pull request's Merged state is the record.

Releasing is unchanged: `production` fast-forwards to `main`
([0014](./0014-only-reyxdz-merges-and-releases.md)).

## Alternatives considered

**Merge commits.** Keeps every commit and makes branch-on-branch work
possible. Rejected: `main`'s history fills with review and fix-up commits.

**Rebase and merge.** A linear history with each commit kept. Rejected: it
keeps the audit's fix-up commits too, and rewrites their hashes, so links from
a pull request to its commits no longer match `main`.

**Allow all three and leave it to whoever merges.** Rejected: one person
merges, and a setting is more reliable than remembering a convention.

## Consequences

**Good.** One commit per pull request on `main`, readable and easy to revert as
a unit. Co-authors are credited automatically.

**Bad.** The individual commits live only on the pull request; `git blame` on
`main` points at the squash commit. Stacking pull requests is no longer
practical. The squash message is prefilled with every commit message and should
be trimmed to a summary when merging — keeping AI names out of it, since CI
checks commit messages on `main` too
([0009](./0009-ai-attribution-is-blocked-by-a-hook-not-a-rule.md)).

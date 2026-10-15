# 0009. AI attribution is blocked by a hook, not a rule

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

Commits and pull requests in this repository are authored by the human
contributor alone. AI coding tools add attribution by default — a
`Co-Authored-By` trailer, a "Generated with" footer.

Bilikha learned that a written rule is not enough. Its `CLAUDE.md` forbade
the trailers, and the agents that read the file obeyed. The trailers arrived
anyway, from a tool that never read it: 37 commits carried one, some reached
GitHub, and GitHub attached a bot account to the contributor list
permanently — it does not retract a contribution when the commit is
force-pushed away.

## Decision

No AI attribution in any commit message or pull request description. It is
enforced, not requested:

- `.githooks/commit-msg` runs `scripts/check-commit-msg.mjs` on every commit.
  `npm run setup` points `core.hooksPath` at `.githooks/`.
- CI runs the same script over every pushed range, for clones that never ran
  setup.

> Since 2026-10-16, `pr-audit` also runs the same patterns, kept in
> `scripts/ai-attribution.mjs`, over the pull request description. Nothing
> else checked the description.

## Alternatives considered

**The rule in `CLAUDE.md` alone.** Binds only the tools that read it.

**A server-side hook.** Not available on hosted GitHub.

## Consequences

A commit carrying an AI trailer is refused locally with instructions to
amend it, and fails CI if it gets past the hook. `--no-verify` skips the
local hook but not CI.

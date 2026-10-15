# Release to production

Getting what is on `main` onto `production`: the check before, the command,
what success and failure look like. Only reyxdz can release
([ADR 0014](../decisions/0014-only-reyxdz-merges-and-releases.md)).

**Nothing deploys from `production` yet** — there is no hosting. Releasing today
moves the branch and nothing else. When a host is set up, it deploys from
`production`, and this guide gains a section on what the host must be told and
how to roll it back.

---

## The flow, end to end

```
feature branch → pull request into main → main → production
```

1. A feature branch becomes a pull request into `main`. CI and `pr-audit` must
   pass, and reyxdz approves and merges — see
   [Open a pull request](./open-a-pull-request.md).
2. **Releasing** moves `production` to the commit `main` is on.

A release ships **everything on `main` up to that point** — never a single pull
request on its own. So do not merge a pull request into `main` you are not
prepared to ship with the next release.

---

## Before releasing

### 1. See what will ship

<https://github.com/S1-GLOBAL/s1-gateway/compare/production...main>

Every commit and file the release will take to production. "There isn't
anything to compare" means production is already up to date.

### 2. Check CI is green on `main`

<https://github.com/S1-GLOBAL/s1-gateway/commits/main> — the top commit has a green
✓. A red ✗ or a pending dot means wait: `production` accepts only a commit CI
has already passed, so the release would be refused anyway.

### 3. Read each pull request's Rollout section

A migration, a new environment variable or a one-off script each has to be
handled with the release. Once a host exists, a new variable must be set on it
*before* releasing: a required variable that is missing stops the API at boot.

---

## Release

From the project folder, in Git Bash:

```bash
git fetch origin
git push origin origin/main:production
```

This pushes **the commit `origin/main` is on** to `production`, whatever branch
you have checked out. Never push your local `main` or a feature branch.

### Success looks like

Your hashes will differ:

```
To https://github.com/S1-GLOBAL/s1-gateway.git
   6e20a2c..9f1c2ab  origin/main -> production
```

Then, within a minute, a green **Release guard** run on
<https://github.com/S1-GLOBAL/s1-gateway/actions> confirming the released commit is
on `main`.

### If it is refused

GitHub names the rule that refused it. The wording varies; look for these:

| The message mentions | Means | Do |
|---|---|---|
| a required status check, `check` | CI has not passed on that commit yet | Wait for CI on `main`, then retry |
| a protected ref it cannot update | You are not an owner of the S1-GLOBAL organisation | Only reyxdz releases |
| non-fast-forward, or force-push | `production` has a commit `main` does not | Do not force. See "The release guard failed" below |

---

## The release guard failed

`production` was moved to a commit that is not on `main` — it never went
through `pr-audit` or review. The run summary lists the steps:

1. If anything deploys from `production` by now, roll it back on its host.
2. Merge the branch holding that commit into `main` through a pull request,
   with a **merge commit** — not squash or rebase, which would leave that exact
   commit off `main`. If the change should not ship, revert it on `main`
   afterwards.
3. Release from `main` again. `production` only moves forward, so this works
   only once `main` contains the stray commit.

## Never

- **Never force-push `production`**, and never delete it. The ruleset refuses
  both, for everyone.
- **Never push anything but `origin/main`** to `production`.
- **Never open a pull request into `production`.** Releasing is a fast-forward,
  not a merge.

# 0016. The repository lives in the S1-GLOBAL organisation

- **Status:** Accepted
- **Date:** 2026-10-16
- **Related:** [0014](./0014-only-reyxdz-merges-and-releases.md) ·
  [Release to production](../guides/release-to-production.md)

## Context

The Gateway's hosting (Vercel for the frontend, Render for the API, Supabase
for the database) is owned and configured by a second account, `reyxdz-s1`,
not by reyxdz. On Vercel's Hobby plan, an account can import only
repositories owned by its own GitHub account; being a collaborator on
someone else's personal repository is not enough. While the repository
belonged to reyxdz's personal account, `reyxdz-s1` could not import it, even
with write access and Vercel's GitHub App installed.

Repositories in an organisation do not have that restriction for its members.

## Decision

**The repository moves from `reyxdz/s1-gateway` to `S1-GLOBAL/s1-gateway`**, a
free organisation whose only owner is reyxdz. `reyxdz-s1` is a member, with
**Write** on this repository.

**The owner rulesets' bypass becomes "Organization admin".** On a personal
repository it was "Repository admin". The transfer emptied both bypass lists,
leaving `main` and `production` locked for everyone, and they were set again
to Organization admin, the role Bilikha uses. In an organisation that role
means its owners, so the bypass is still reyxdz alone. Everything else in
[0014](./0014-only-reyxdz-merges-and-releases.md) is unchanged.

## Alternatives considered

**Vercel Pro for `reyxdz-s1`'s team.** A Pro team can import a repository a
member can reach, and Pro is likely needed in any case for a company's tool,
since Hobby is for non-commercial use. It costs money every month and would
leave the company's repository in one person's account.

**Source One's existing organisation, Sourceone-Global.** reyxdz is a member
there, not an owner, so its owners would decide who merges and releases. The
repository can still move there later, the same way it moved here.

**Hosting from reyxdz's own accounts.** That puts the hosting in reyxdz's
hands, which is the opposite of what was wanted.

## Consequences

- **Every owner of S1-GLOBAL bypasses the owner rulesets.** Add people as
  members, never owners, or they can merge and release without approval.
- Old `reyxdz/s1-gateway` links and clones redirect. They stop redirecting if
  reyxdz ever creates a repository with that name again.
- A GitHub App installed on reyxdz's personal account does not cover the
  repository any more. Vercel and Render need their apps installed on
  S1-GLOBAL, and only an owner can install one.
- Moving again, to Sourceone-Global, means repeating this: check the
  rulesets' bypass after the transfer, reinstall the hosting apps there, and
  reconnect each host to the new address.

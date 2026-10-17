# 0023. Accounts are created by invite only

- **Status:** Accepted
- **Date:** 2026-10-17
- **Related:** [Issue #21](https://github.com/S1-GLOBAL/s1-gateway/issues/21) ·
  [Plan 0005](../plans/0005-account-invites.md) ·
  [ADR 0018](./0018-staff-sign-in-with-admin-approval.md)

## Context

Under [ADR 0018](./0018-staff-sign-in-with-admin-approval.md) anyone can open
`/sign-up`, create an account with any `@sourceone.global` address, and wait
as `pending` until an admin approves it. Admins approve people they did not
choose, from a queue anyone can add to, and sign-up needs its own per-IP rate
limit because anyone can create accounts with it without signing in. The form
also takes one Full name, so a person's first and last names cannot be told
apart later. reyxdz decided on 2026-10-17 that every account should start from
an admin's decision.

## Decision

- **An admin's invite is the only way to create an account.** An admin enters
  a `@sourceone.global` email on the Accounts page and gets a link to send:
  `{CORS_ORIGIN}/register?token=…`. As with the reset link, the token is random
  and only its hash is stored. Open sign-up is removed.
- **An invited account is approved at once.** The invite is the approval.
- **An invite works once, for 7 days.** Inviting the same email again replaces
  its unused invite, so the old link stops working. An admin can see and
  revoke unused invites. An expired, used, revoked or unknown link all answer
  the same, so a token's state cannot be probed.
- **Registration takes the email from the invite**, never from the request,
  and asks for a first name, a last name (each 1–40 characters), a password
  and its confirmation, all checked on the server. The account is created and
  the invite marked used in one transaction.
- **Names are stored as first and last**, shown together as "First Last".
  `full_name` stays, widened to 81 characters, and every write sets it to
  "First Last", so code that still reads it keeps working.

This partly supersedes ADR 0018: open sign-up, its `pending` queue for new
accounts, and its sign-up rate limit no longer hold. Its sessions, lockout,
reset links and admin list stand.

## Alternatives considered

**Keep open sign-up, with first and last names and Confirm password.**
Rejected by reyxdz on 2026-10-17: anyone with a company address could still
join, and admins would still approve people they did not choose.

**Invited accounts still wait as `pending`.** Rejected by reyxdz on
2026-10-17: the admin already chose the person by inviting them, so a second
approval adds a step and no safety.

**One joined name column.** Rejected by reyxdz on 2026-10-17: once joined,
which part is the first name and which the last cannot be recovered reliably.

## Consequences

Nobody can join without an admin, so a new starter waits for one, and an admin
must send each link by hand until outbound mail exists. With sign-up gone, the
only public routes that create an account or set a password, registration and
reset, each need a token that cannot be guessed, so neither has a rate limit.
Local development and tests need another
way to create the first admin (a command). Existing accounts get their first
and last names by splitting `full_name` at its first space, which is wrong for
some names; nobody can correct a name yet. The `pending` status stays for
accounts the old sign-up created.

# 0030. Roles live on the account, and System Admins change them

- **Status:** Accepted
- **Date:** 2026-10-27
- **Related:** [0018](./0018-staff-sign-in-with-admin-approval.md), [0023](./0023-accounts-are-created-by-invite-only.md)

## Context

Until now an admin was any account whose email was in `ACCOUNT_ADMIN_EMAILS`
([ADR 0018](./0018-staff-sign-in-with-admin-approval.md)). Making someone an
admin, or stopping them being one, meant editing a Render variable and
redeploying, and every admin could disable, reset or re-approve every other.

reyxdz asked for a role above admin, the **System Admin**, whose own power is
to promote and demote admins from the Accounts page. A role that changes in
the app cannot live in an environment variable: it has to be stored on the
account.

## Decision

- Every account has a **role**, stored in `accounts.role`: `staff` (the
  default), `admin` or `system-admin`. The role is read with the account on
  every request, so a change takes effect on the person's next request and no
  session is ended.
- **An admin** invites people, revokes invites, and approves, disables and
  resets **staff**. An admin cannot act on another admin's or a System
  Admin's account.
- **A System Admin** does everything an admin does, to anyone, and is the only
  one who changes a role: `PUT /accounts/:id/role`. A System Admin can make
  another System Admin, or demote one.
- **Nobody disables their own account or changes their own role.** Since only
  a System Admin can demote or disable a System Admin, the one acting always
  remains, so the Gateway is never left without one.
- **`ACCOUNT_ADMIN_EMAILS` names the first System Admins.** When the API starts
  and no approved account is a System Admin, each approved account in the list
  becomes one. The first deploy of this change therefore turns the admins the
  list named into System Admins, and an empty database gets its first.
  Once a System Admin exists the list changes nothing, so a demotion in the app
  holds across restarts. `npm run db:create-admin` creates a System Admin, and
  still accepts only a listed address.
- Both admin roles pass the admin gate. Atlas's admin-only stage change is
  open to both.

## Alternatives considered

**System Admins in the environment, admins in the database.** The variable
would name the System Admins, nobody could demote one in the app, and no
guard would be needed. It was rejected: it keeps the top role behind a Render
change and a redeploy, which is the friction this change removes.

**Seed System Admins on every start.** Simpler to explain, but a System Admin
demoted in the app would be promoted again on the next deploy whenever their
address was still listed.

**A last-System-Admin check in the database.** A transaction or trigger
could refuse removing the last one. It would cover the race where two System
Admins demote each other at the same moment. That race needs two people
clicking at once. If it happens, the next start makes the listed accounts
System Admins again. That was judged enough.

## Consequences

- Promoting and demoting no longer need a deploy, and an admin can no longer
  lock out a System Admin or another admin.
- `Account` on the wire carries `role`. `isAdmin` stays, derived from it, for a
  web app cached from before this change (the shell is cached,
  [ADR 0010](./0010-the-app-shell-is-cached-api-responses-never-are.md)).
- Approving, disabling and resetting can now answer `403 NOT_ALLOWED` for the
  target's role, not only for the caller's.
- `ACCOUNT_ADMIN_EMAILS` is still required, but after the first start it does
  nothing while a System Admin exists. Its name now undersells it; renaming it
  would need a Render change made in step with a deploy, so it is left as is.
- A disabled System Admin keeps the role. If every System Admin is disabled,
  the next start promotes the listed accounts.

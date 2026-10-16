# 0005. Accounts by invite: a one-time registration link, and first and last names

- **Status:** Ready
- **Owner:** Rey Denzo
- **Related:** [#21](https://github.com/S1-GLOBAL/s1-gateway/issues/21) ·
  [ADR 0003](../decisions/0003-clean-architecture-with-layers-inside-modules.md) ·
  [ADR 0005](../decisions/0005-migrations-over-db-push.md) ·
  [ADR 0007](../decisions/0007-one-definition-of-an-api-shape.md) ·
  [ADR 0018](../decisions/0018-staff-sign-in-with-admin-approval.md) ·
  [plan 0004](./0004-atlas-library-and-editable-spec-ids.md)

## Goal

At the end of this plan an admin creates an account by inviting someone: on
`/accounts` they enter a `@sourceone.global` email and copy a link that works
once, for 7 days. The link opens `/register`, which shows that email without
letting it change and asks only for a first name, a last name, a password and
its confirmation. The account it creates can sign in at once. Every account
stores a first and a last name, shown together as "First Last". Open sign-up
is gone: `/sign-up` only says the Gateway is invite-only. Issue
[#21](https://github.com/S1-GLOBAL/s1-gateway/issues/21) is the specification:
its copy table is the exact wording of every message, and where this plan and
the issue disagree, the issue wins and this plan is corrected.

## Scope

**In scope**
- `account_invites`, and `first_name` and `last_name` on `accounts`, with a backfill from `full_name`
- Creating, listing and revoking invites (admin), reading and redeeming one (public)
- The Invite form, the link notice and the Invited section on `/accounts`; the `/register` page
- Removing open sign-up: the route, its use case, its rate limiter, its form and page
- `npm run db:create-admin` for local development and tests
- ADR 0023, partly superseding ADR 0018
- `api.md`, `data-model.md`, `commands.md`, `environment.md` and `constraints.md` updates

**Out of scope** — and where it is handled instead
- Emailing the invite automatically — no issue yet (no outbound mail; ADR 0018)
- Dropping the `full_name` column once nothing reads it — no issue yet
- Creating the first admin on production — no issue yet (no production host yet)
- Letting staff edit their own name after registering — no issue yet
- Removing the Pending section — no issue yet

## Prerequisites

- A working local setup with the database:
  `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit`
  exits 0 on a fresh branch from `main`, and `npm run db:up` then `npm test`
  passes.
- The decision-record number is free: `git ls-files docs/decisions | grep 0023`
  prints nothing. Plan 0004 claims 0022. If 0023 is taken by the time this
  runs, use the next free number and correct this plan.

## Progress

Built one phase per pull request, stopping for the owner after each.

| Phase | Steps | Status |
|---|---|---|
| 1. Server: invites, names, registration | 0 / 7 | Not started |
| 2. Invite and register pages, invite-only | 0 / 7 | Not started |

---

## Design

### Precedents this plan sets

| First | How | Why this way |
|---|---|---|
| A public link that creates an account | Same shape as the reset link (ADR 0018): a random token from `TokenGenerator`, only its hash stored, URL `{CORS_ORIGIN}/register?token=…` | One pattern for every admin-issued public link |
| A transaction across two aggregates of one module | `AccountInviteRepository.redeem(inviteId, account, now)` inserts the account and marks the invite used in one `db.transaction`, inside the adapter, with the invite update conditional on `used_at is null and revoked_at is null and expires_at > now`. Zero rows updated rolls back and answers `INVITE_INVALID` | Follows plan 0004's rule: atomicity belongs in the adapter, no unit-of-work port. The conditional update settles two simultaneous registrations |
| A command that runs application code outside the server | `backend/src/scripts/create-admin.ts`, run with `tsx` by `npm --prefix backend run db:create-admin`, and from the root by `npm run db:create-admin`. It builds the accounts module's repository and hasher directly; it never starts the HTTP app | A script is the only way in once sign-up is gone, and it reuses the same domain rules |

### Data model

New table `account_invites`, in `backend/src/modules/accounts/infrastructure/accounts.table.ts`:

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | Primary key |
| `email` | `varchar(320)` | no | Lower-cased, as `accounts.email`. Indexed |
| `token_hash` | `text` | no | Unique |
| `invited_by` | `uuid` | no | FK → `accounts.id` |
| `created_at` | `timestamptz` | no | |
| `expires_at` | `timestamptz` | no | `created_at` + 7 days |
| `used_at` | `timestamptz` | yes | Set when redeemed |
| `revoked_at` | `timestamptz` | yes | Set when revoked, or when a newer invite to the same email replaces it |

`accounts` gains `first_name varchar(40) not null default ''` and
`last_name varchar(40) not null default ''`. `full_name` stays, and every write
sets it to the trimmed `"First Last"`. Two 40-character names make 81
characters, so `full_name` widens from `varchar(80)` to `varchar(81)`; Postgres
widens a `varchar` without rewriting the table, and the running code is
unaffected (decided by reyxdz on 2026-10-17). The backfill is a custom
migration:

```sql
UPDATE accounts SET
  first_name = left(split_part(full_name, ' ', 1), 40),
  last_name = CASE
    WHEN strpos(full_name, ' ') = 0 THEN ''
    ELSE btrim(left(btrim(substr(full_name, strpos(full_name, ' ') + 1)), 40))
  END;
```

A part longer than 40 characters is cut to 40: `full_name` allows 80, so only a
first word over 40 characters, or a rest of the name over 40, is affected.

An account the previous release creates during the deploy, after the
migrations and before the new API is live
([ADR 0017](../decisions/0017-staging-deploys-every-commit-on-main.md)), gets
both names empty. So the account mapper splits `full_name` as the backfill
does whenever `first_name` and `last_name` are both empty.

### Contract additions — `backend/src/contracts/accounts.ts`

- `Account` gains `firstName` and `lastName`; `fullName` stays.
- `AccountInvite { id; email; expiresAt }` (ISO 8601).
- `CreateInviteRequest { email }` and `CreateInviteResponse { invite: AccountInvite; inviteUrl }`.
- `InviteDetails { email; expiresAt }` for `GET /auth/invites/:token`.
- `RegisterRequest { token; firstName; lastName; password; confirmPassword }`.

### Routes

| Method | Path | Router | Answers |
|---|---|---|---|
| POST | `/accounts/invites` | `accounts.routes.ts` (admin) | 201, 400 `EMAIL_NOT_ALLOWED`, 409 `ACCOUNT_EXISTS` |
| GET | `/accounts/invites` | `accounts.routes.ts` (admin) | 200, open invites newest first |
| POST | `/accounts/invites/:id/revoke` | `accounts.routes.ts` (admin) | 200, 404 `INVITE_NOT_FOUND` |
| GET | `/auth/invites/:token` | `createPublicAuthRouter` | 200, 404 `INVITE_INVALID` |
| POST | `/auth/register` | `createPublicAuthRouter` | 201 `{ data: Account }` with no session cookie, 400 `VALIDATION_FAILED`, 404 `INVITE_INVALID`, 409 `ACCOUNT_EXISTS` |

The invite routes cannot be read as `/:id/approve` or its siblings, whatever
their order: `/invites` has one segment and `/invites/:id/revoke` three, where
those have two.

### Domain and application — `backend/src/modules/accounts/`

- `domain/person-name.ts`: `normalizeFirstName`, `normalizeLastName` (trim; empty → `Enter your first name.` / `Enter your last name.`; over 40 → `Use at most 40 characters.`), errors under `firstName` and `lastName`.
- `domain/account.ts`: `firstName`, `lastName`; `fullName` becomes `` `${firstName} ${lastName}`.trim() ``; `Account.register` takes both names; a new `Account.registerInvited` creates an approved account.
- `domain/account-invite.ts`: `AccountInvite.create(email, tokenHash, invitedBy, id, now)` (7 days), `isUsable(now)`, `revoke(now)`; `INVITE_TTL_MS`.
- `domain/account.errors.ts`: `InviteInvalidError` (`INVITE_INVALID`, 404 copy from #21), `InviteNotFoundError` (`INVITE_NOT_FOUND`, 404, `This invite was already used or revoked.`, decided by reyxdz on 2026-10-17), and the invite form's own wording for a bad email and an existing account (#21's copy table). Registration's mismatched passwords go under `confirmPassword`: `The passwords don't match.`
- `domain/account-invite-repository.ts`: `add` (revokes that email's open invite in the same transaction), `findByTokenHash`, `listOpen(now)` (newest first), `revoke(id, now)`, `redeem(inviteId, account, now)`.
- `application/`: `CreateInvite`, `ListInvites`, `RevokeInvite`, `GetInvite`, `RegisterWithInvite`, each with tests over in-memory fakes.

### Frontend — `frontend/src/features/accounts/` and `frontend/src/pages/`

- Gateway methods `createInvite`, `listInvites`, `revokeInvite`, `getInvite`, `register`; `signUp` goes in phase 2.
- `presentation/InviteForm.tsx`, `presentation/InvitedSection.tsx`, and `presentation/LinkNotice.tsx`: `ResetLinkNotice` generalised to take its sentence, used by both the reset and the invite link.
- `presentation/RegisterForm.tsx`: the email as text, not an input; four fields; a client check for mismatched passwords before sending, with the server's answer still shown.
- `pages/auth/RegisterPage.tsx` at `/register` (public), reading `token` from the query; its "no longer works" state when `GET /auth/invites/:token` answers 404.
- `pages/auth/SignUpPage.tsx` becomes the invite-only note; `SignInPage.tsx` loses its "New here?" footer and shows `Your account is ready. Sign in.` with the email filled in when it arrives from registering (router state).

### Review Focus

Inputs #21 implies but does not spell out. Each has its test in the step that
owns the code.

1. Inviting `Ada@SourceOne.Global` is the same as `ada@sourceone.global`: the existing account check and the replace-the-open-invite rule both use the lower-cased email (Step 1.4).
2. `GET /auth/invites/<any garbage>` answers 404 `INVITE_INVALID`, never 400 or 500 (Step 1.5).
3. Registering after someone created an account for that email answers 409 `ACCOUNT_EXISTS` and leaves the invite unused (Step 1.4).
4. Revoking a used, revoked or unknown invite answers 404 `INVITE_NOT_FOUND` (Step 1.4).
5. A registration body carrying `email` creates the account with the invite's email, not that one (Step 1.5).
6. Two simultaneous `POST /auth/register` with one token create one account; the other answers 404 `INVITE_INVALID` (Step 1.5).
7. `POST /auth/sign-up` answers 404 once phase 2 lands, and nothing in `backend/src` or `frontend/src` still names it except the test that proves the 404 (Steps 2.4 and 2.5).

---

## Phase 1 — Server: invites, names, registration

One pull request, "Part of #21". Open sign-up keeps working until phase 2: its
form still sends a full name, which the server splits at the first space.

### Step 1.1 — Record the decision

- [ ] **Action.** Write `docs/decisions/0023-accounts-are-created-by-invite-only.md` from `_template.md`, Accepted, dated the day it is written: an admin's invite is the only way to create an account, invited accounts are approved at once, an invite works once for 7 days and inviting again replaces it, names are stored as first and last. Alternatives: keep open sign-up with the new fields (rejected by reyxdz on 2026-10-17); invited accounts still pending (rejected, same date); one joined name column (rejected, same date). Add "Partly superseded by 0023" to ADR 0018's status line, linked, with a sentence saying open sign-up, its pending queue and its rate limit no longer hold. Add 0023 to `docs/decisions/README.md`.
- [ ] **Verify.** `npm run docs:check` exits 0.

### Step 1.2 — The table, the name columns and the backfill

- [ ] **Action.** Add `accountInvites` and the two columns to `accounts.table.ts`, export the table from `backend/src/database-schema.ts`, run `npm --prefix backend run db:generate -- --name account_invites_and_person_names`, then `npm --prefix backend run db:generate -- --custom --name backfill_person_names` and paste the backfill SQL above into it. Add `account_invites` to the front of the `truncate` in `backend/src/test/database.ts`.
- [ ] **Verify.** `npm run db:migrate` applies both; the generated SQL only adds, apart from widening `full_name` (no `DROP`; the only `ALTER COLUMN … TYPE` sets `full_name` to `varchar(81)`); a test registers 40-character first and last names; a second `db:generate` prints "No schema changes"; a `*.db.test.ts` proves #21's three backfill cases.

### Step 1.3 — The domain: names and invites

- [ ] **Action.** Tests first, then `person-name.ts`, the `Account` changes, `account-invite.ts` and the new errors. Tests: 40-character names pass and 41 fail; `"  "` is empty; `fullName` of (`Admin`, `''`) is `Admin`; an invite is usable before `expires_at` and not at or after it, nor once used or revoked.
- [ ] **Verify.** `npm --prefix backend run test:unit -- accounts` passes; `npm run arch:check` exits 0.

### Step 1.4 — Use cases

- [ ] **Action.** Add the repository port and its in-memory fake, then `CreateInvite`, `ListInvites`, `RevokeInvite`, `GetInvite` and `RegisterWithInvite`. `SignUp` splits its full name at the first space into the two names, each cut to 40 characters, as the backfill does. Tests over the fakes: Review Focus 1, 3 and 4; a second invite to one email revokes the first; an expired, used or revoked token → `InviteInvalidError`; mismatched passwords → 400 under `confirmPassword` and nothing written; a registered account is approved and its `fullName` is "First Last".
- [ ] **Verify.** `npm --prefix backend run test:unit -- accounts` passes.

### Step 1.5 — The repository and the routes

- [ ] **Action.** `DrizzleAccountInviteRepository` with `redeem` in one transaction; the zod schemas (shape only); the controller methods and routes above; the account mapper reads and writes both names, with the empty-names fallback above. Database tests: Review Focus 6; `add` revokes that email's open invite; an `accounts` row with both names empty reads back with them split from `full_name`. HTTP tests: every status in the routes table, the invite list newest first, registering setting no session cookie, Review Focus 2 and 5, the invite routes answer 403 to a signed-in non-admin and 401 without a session.
- [ ] **Verify.** `npm run db:up`, then `npm test` passes.

### Step 1.6 — Contracts and docs

- [ ] **Action.** The contract additions above, read on the frontend with a fallback (`firstName ?? ''`, `lastName ?? ''`) so a new frontend works with the old API during a release. `docs/reference/api.md`: the five routes, the two new error codes, `firstName` and `lastName` in the `Account` table, `fullName` as 1–81 characters, and the `AccountInvite` shape. `docs/reference/data-model.md`: `account_invites`, the two columns, and `full_name` as `varchar(81)`.
- [ ] **Verify.** `npm run typecheck && npm run docs:check` exits 0; `npm --prefix frontend run build` exits 0.

### Step 1.7 — Open the pull request

- [ ] **Action.** Open "Part of #21" with the template; Database (two migrations: additive apart from widening `full_name` to `varchar(81)`, with a backfill of every account), API and Rollout filled in.
- [ ] **Verify.** CI and `pr-audit` pass. After merge, on staging, signed in as reyxdz: `GET /api/v1/auth/me` answers `firstName` and `lastName` split from the existing name, and `GET /api/v1/accounts/invites` answers an empty list.

---

## Phase 2 — Invite and register pages, invite-only

One pull request, "Closes #21".

### Step 2.1 — Gateway and hooks

- [ ] **Action.** The five gateway methods with their HTTP adapter and tests; hooks `useCreateInvite` and `useRevokeInvite` (each invalidating `accountsKeys.all`), `useInvites` (keyed under `accountsKeys.all`), `useInvite(token)` and `useRegister`.
- [ ] **Verify.** `npm --prefix frontend run test -- --no-file-parallelism accounts` passes.

### Step 2.2 — The Accounts page

- [ ] **Action.** `LinkNotice` (with `ResetLinkNotice`'s callers moved to it), `InviteForm` and `InvitedSection` on the Accounts page, with #21's copy. Tests: creating an invite shows the link notice with its exact sentence; the Invited section lists email and `Expires 16 October 2026` (fixed time zone in the test); Revoke shows `The invite for {email} no longer works.`; each server error shows its #21 message under Email.
- [ ] **Verify.** `npm --prefix frontend run test -- --no-file-parallelism accounts` passes; `npm run design:check` prints `Design tokens only.`

### Step 2.3 — The register page

- [ ] **Action.** `RegisterForm`, `RegisterPage` at `/register` in `frontend/src/app/routes.tsx` (public, outside the session gate), and the sign-in page's notice and filled-in email. Tests: the email is shown and is not an input; mismatched passwords show `The passwords don't match.` and nothing is sent; a 404 on the token shows `This invite link no longer works.`; success lands on `/sign-in` with `Your account is ready. Sign in.`
- [ ] **Verify.** `npm --prefix frontend run test -- --no-file-parallelism` passes.

### Step 2.4 — Close open sign-up

- [ ] **Action.** Remove `POST /auth/sign-up`, `SignUp`, the `SignUpRateLimiter` port and `SlidingWindowSignUpRateLimiter`, `SignUpForm`, `useSignUp` and the gateway's `signUp`, and `domain/full-name.ts`, its test and `InvalidFullNameError`, which only `SignUp` used. Remove with them `sign-up.test.ts`, `application/testing/in-memory-sign-up-rate-limiter.ts`, `sliding-window-sign-up-rate-limiter.test.ts`, `SignUpRateLimitedError` in `account.errors.ts`, `signUpRequestSchema` in `auth.schemas.ts`, `SignUpRequest` in `backend/src/contracts/accounts.ts`, and `signUp` in `frontend/src/test/fake-accounts-gateway.ts`. `sign-in.test.ts` and `auth.routes.test.ts` stop creating accounts through `SignUp`: they add them to `InMemoryAccountRepository` with `Account.register` (pending ones with `autoApprove: false`). `SignUpPage` becomes #21's invite-only note; the sign-in page loses its footer link. Update `docs/explanation/constraints.md` and `docs/reference/api.md` (remove the route and `SIGN_UP_RATE_LIMITED`, and describe `EMAIL_NOT_ALLOWED` as an invite's email, not a sign-up's).
- [ ] **Verify.** Review Focus 7: `git grep -n -i "sign-up\|signUp" -- backend/src frontend/src` prints only the `/sign-up` route and `SignUpPage` (in `routes.tsx`, `SignUpPage.tsx`, `next-path.ts` and their tests) and the HTTP test that proves `POST /api/v1/auth/sign-up` answers 404, plus `backend/src/atlas.db.test.ts` and `backend/src/compose.db.test.ts`, which Step 2.5 changes. `npm run typecheck` exits 0.

### Step 2.5 — The create-admin command

- [ ] **Action.** `backend/src/scripts/create-admin.ts` (exporting `createAdmin(db, input)` for tests): it takes `--email`, `--first-name` and `--last-name`, and reads the password from `ADMIN_PASSWORD` for that one run. `"db:create-admin": "tsx src/scripts/create-admin.ts"` in `backend/package.json` and `"db:create-admin": "npm --prefix backend run db:create-admin --"` in the root `package.json`. `backend/src/compose.db.test.ts` and `backend/src/atlas.db.test.ts` create their admin with `createAdmin` instead of signing up, then sign in as before; the comment above `atlas.db.test.ts`'s sign-in loses `sign-ups are limited to 5 per hour`. Document it in `docs/reference/commands.md`, and `ADMIN_PASSWORD` in `docs/reference/environment.md` and, commented out, in `backend/.env.example`.
- [ ] **Verify.** Tests: `createAdmin` refuses with `NODE_ENV=production` and refuses an email not in `ACCOUNT_ADMIN_EMAILS`. `npm test` passes with the database running. Review Focus 7's grep from Step 2.4 no longer prints `atlas.db.test.ts` or `compose.db.test.ts`.

### Step 2.6 — Check it in a browser

- [ ] **Action.** Locally, with `npm run db:create-admin`: invite an address, open the link in a fresh browser profile, register, and sign in; check light and dark, 390 px, the folded sidebar and keyboard-only use on `/accounts` and `/register`. Take `accounts-invite-light.png`, `accounts-invite-dark.png` and `register-phone-light.png` under `.github/readme/`.
- [ ] **Verify.** Every "States checked" line of the pull request template is checked or marked n/a with a reason.

### Step 2.7 — Open the pull request, then staging

- [ ] **Action.** Open "Closes #21" with the template, the screenshots and a `Tooling change:` exception for them and the root `package.json` script.
- [ ] **Verify.** CI and `pr-audit` pass. After merge, run #21's staging check and write the result as a comment on #21.

---

## Acceptance

The plan is complete when every box below is checked.

- [ ] Every item under "Verify" in [#21](https://github.com/S1-GLOBAL/s1-gateway/issues/21) is ticked on the issue.
- [ ] ADR 0023 is Accepted and listed, and ADR 0018 links to it.
- [ ] `api.md`, `data-model.md`, `commands.md` and `constraints.md` describe invites, names and the end of open sign-up.
- [ ] #21 is closed by phase 2's pull request.

## Follow-ups

- Emailing the invite automatically — no issue yet
- Dropping the `full_name` column once nothing reads it — no issue yet
- Creating the first admin on production — no issue yet
- Letting staff edit their own name after registering — no issue yet
- Removing the Pending section — no issue yet

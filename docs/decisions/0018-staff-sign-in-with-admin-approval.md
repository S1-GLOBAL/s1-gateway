# 0018. Staff sign-in with admin approval

- **Status:** Accepted
- **Date:** 2026-10-16
- **Related:** [Issue #5](https://github.com/S1-GLOBAL/s1-gateway/issues/5)

## Context

Staging is reachable on the public internet. Until staff must sign in, every
API route that serves data is open to anyone who finds the URL. The Gateway
is for Source One staff only. Sign-in has to land before the product can
honestly sit outside the internal network.

## Decision

- **Email and password** for addresses ending exactly `@sourceone.global`
  (no subdomains). Full name and password (≥12 characters) at sign-up.
- **Admin approval** before sign-in: new accounts are `pending` until an
  address listed in `ACCOUNT_ADMIN_EMAILS` approves them. Addresses in that
  list are auto-approved on sign-up. No email is sent for approval or reset.
- **Sessions** are random tokens in an `httpOnly` cookie
  (`s1_gateway_session`, `SameSite=Lax`, `Secure` in production). The server
  stores only a hash. Sessions last 7 days and renew on each authenticated
  request; sign-out or disable ends them at once.
- **Password reset** is a public one-time link (24 hours). An admin copies
  the URL from the Accounts page and gives it in person. Creating a new
  reset invalidates prior unused tokens for that account and ends all
  sessions.
- **Lockout:** five wrong passwords lock the account for 15 minutes.
  Sign-up is limited to five successful creates per client IP per hour.

## Alternatives considered

**Google or Microsoft OAuth** — staff already have those identities, and
there is no password to reset. Rejected for this ticket: it needs app
registration, consent screens, and a different failure mode when the IdP
is down. Revisit if password reset friction becomes the main cost.

**Supabase Auth (or similar hosted auth)** — faster to stand up. Rejected
because session and account rules would live outside the Gateway's own
modules and env, and the product already owns Postgres.

## Consequences

Every data route under `/api/v1` except `/health` and `/auth/*` requires a
session. The shell HTML may still load signed out ([0010](./0010-the-app-shell-is-cached-api-responses-never-are.md)); the SPA redirects to
sign-in. Public staging is acceptable only because the API is closed.

`ACCOUNT_ADMIN_EMAILS` must be set on every environment before the API will
boot. There is no emailed reset or confirmation — that is deliberate until
outbound mail exists.

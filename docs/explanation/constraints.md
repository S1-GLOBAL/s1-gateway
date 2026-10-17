# Operating constraints

The realities that shape s1-gateway. Several decisions follow from them
directly; read this before changing anything structural.

---

## 1. It is an internal tool

s1-gateway is Source One Global's Gateway: the hub staff open to reach
internal applications and links. Its users are staff, not the public. There
are no public pages, so search-engine indexing and link-preview cards do not
matter, and a client-rendered SPA is enough
([ADR 0002](../decisions/0002-pern-with-client-rendered-spa.md)).

## 2. The Gateway requires sign-in

**Every route of the API except `/health` and `/auth/*` needs a session.**
There is no open sign-up: an admin (an address in `ACCOUNT_ADMIN_EMAILS`)
invites a staff member by their `@sourceone.global` email, and the link works
once, for 7 days. The person gives a first name, a last name and a password,
and can sign in at once — the invite is the approval
([ADR 0023](../decisions/0023-accounts-are-created-by-invite-only.md)). A
session lasts 7 days, and signing out or being disabled ends it at once
([ADR 0018](../decisions/0018-staff-sign-in-with-admin-approval.md)).

**That is why a public staging deployment is acceptable.** Anyone can load the
app shell, because it is static and cached
([ADR 0010](../decisions/0010-the-app-shell-is-cached-api-responses-never-are.md)),
but every request for data answers 401 without a session. A signed-out visitor
who opens `/` sees the public landing (brand and Sign in); deep links to
signed-in pages still send them to `/sign-in` with a return path. Keep it that
way: a new route is behind sign-in unless it is deliberately made public, and
nothing a staff member should not see belongs in the shell itself.

Sign-in is not a substitute for care: the repository is public, so no Source
One data goes in it (§6), and there is no email, so an admin sends each invite
link and gives each password reset link to the person themselves.

## 3. Staff use laptops on office networks — and install it

Most use is from laptops on stable connections, but the Gateway installs as a
PWA so it opens like an app, from a dock or a home screen. An instant start
matters more than offline reading.

## 4. Live data beats offline data

A list of tools is only useful if it is current: a link that has moved or a
tool that has been retired should not still be offered. So the service worker
caches the app shell and never an API response, and offline is shown honestly
rather than papered over with a stale copy
([ADR 0010](../decisions/0010-the-app-shell-is-cached-api-responses-never-are.md)).

## 5. A gateway fronts other systems

The Gateway is expected to grow integrations with other Source One systems.
That is why the architecture puts every outside system behind a port
([ADR 0003](../decisions/0003-clean-architecture-with-layers-inside-modules.md)):
adding or replacing one is an infrastructure change and a line in a
composition root, not a rewrite of the rules.

## 6. The repository is public

Branch rulesets need a public repository on this plan, so anyone can read the
code, the docs, the tests and the commit history
([ADR 0014](../decisions/0014-only-reyxdz-merges-and-releases.md)). So none of
Source One's own data goes in it — no workbook rows, prices or supplier names,
in code, tests, fixtures, screenshots or docs. Tests and screenshots use
illustrative data. Secrets were never in it, and the `pre-commit` hook and
`pr-audit` both refuse `.env` files.

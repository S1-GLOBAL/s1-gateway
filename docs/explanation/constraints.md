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

## 2. There is no authentication yet

**Nothing in this scaffold is access-controlled.** Anyone who can reach the
API can list and create tools.

**Nothing here may be exposed outside the internal network until the
authentication plan ships.** That includes a staging deployment on a public
URL.

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

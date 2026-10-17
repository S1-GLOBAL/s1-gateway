# API

Base path: **`/api/v1`** ([ADR 0006](../decisions/0006-versioned-api-prefix.md)).
Request and response types are in
[`backend/src/contracts/`](../../backend/src/contracts/README.md) — that is
the source of truth; this page summarises it.

Session cookie: **`s1_gateway_session`** (httpOnly, SameSite=Lax, Secure in
production). Every route except `/health` and the public `/auth/*` endpoints
requires a valid session ([ADR 0018](../decisions/0018-staff-sign-in-with-admin-approval.md)).

## Shapes

Every success:

```json
{ "data": … }
```

Every error:

```json
{ "error": { "code": "TOOL_NAME_TAKEN", "message": "A tool named \"Payroll\" already exists.", "details": { "fields": { "name": ["…"] } } } }
```

`details` is present only when there is something to add. A problem with a
specific field is in `details.fields`, as `{ [field]: string[] }`.

Request bodies are JSON, at most **100 kB**.

## Endpoints

| Method | Path | Access | Success | Errors |
|---|---|---|---|---|
| GET | `/health` | public | 200 `{ data: { status: "ok" } }` | — |
| POST | `/auth/sign-in` | public | 200 `{ data: Account }` + session cookie | 401 `SIGN_IN_FAILED`, 403 `ACCOUNT_PENDING`, 403 `ACCOUNT_DISABLED`, 423 `ACCOUNT_LOCKED` |
| POST | `/auth/sign-out` | session (missing session → 204) | 204, clear cookie | — |
| GET | `/auth/me` | session | 200 `{ data: Account }` (`isAdmin` set) | 401 `SIGN_IN_REQUIRED` |
| POST | `/auth/change-password` | session | 204 | 400 `VALIDATION_FAILED`, 401 |
| POST | `/auth/reset-password` | public | 204 | 400 `RESET_TOKEN_INVALID`, 400 `VALIDATION_FAILED` |
| GET | `/auth/invites/:token` | public | 200 `{ data: { email, expiresAt } }` | 404 `INVITE_INVALID` |
| POST | `/auth/register` | public | 201 `{ data: Account }`, approved (no cookie) | 400 `VALIDATION_FAILED`, 404 `INVITE_INVALID`, 409 `ACCOUNT_EXISTS` |
| GET | `/accounts` | admin | 200 `{ data: { pending, approved, disabled } }` | 401, 403 `NOT_ALLOWED` |
| POST | `/accounts/:id/approve` | admin | 200 `{ data: Account }` | 404 `ACCOUNT_NOT_FOUND`, 401, 403 |
| POST | `/accounts/:id/disable` | admin | 200 `{ data: Account }`; sessions ended | 404, 401, 403 |
| POST | `/accounts/:id/reset-password` | admin | 200 `{ data: { resetUrl, expiresAt } }` | 404, 401, 403 |
| POST | `/accounts/invites` | admin | 201 `{ data: { invite: AccountInvite, inviteUrl } }` | 400 `EMAIL_NOT_ALLOWED`, 400 `VALIDATION_FAILED`, 409 `ACCOUNT_EXISTS`, 401, 403 |
| GET | `/accounts/invites` | admin | 200 `{ data: AccountInvite[] }`: unused, unrevoked and unexpired, newest first | 401, 403 |
| POST | `/accounts/invites/:id/revoke` | admin | 200 `{ data: AccountInvite }` | 404 `INVITE_NOT_FOUND`, 401, 403 |
| GET | `/tools` | session | 200 `{ data: Tool[] }` | 401 `SIGN_IN_REQUIRED` |
| POST | `/tools` | session | 201 `{ data: Tool }` | 401, 400 `VALIDATION_FAILED`, 400 `MALFORMED_JSON`, 409 `TOOL_NAME_TAKEN`, 413, 415 |
| GET | `/atlas/dictionary` | session | 200 `{ data: AtlasDictionary }` | 401 `SIGN_IN_REQUIRED` |
| POST | `/atlas/spec-ids/decode` | session | 200 `{ data: DecodedSpecId }` | 401, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED` |
| POST | `/atlas/spec-ids/encode` | session | 200 `{ data: DecodedSpecId }`; nothing is saved | 401, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED` |
| POST | `/atlas/spec-ids` | session | 201 `{ data: SavedSpecId }` | 401 `SIGN_IN_REQUIRED`, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED`, 409 `SPEC_ID_EXISTS` |
| GET | `/atlas/spec-ids/:code` | session | 200 `{ data: SpecIdLookup }` | 401, 404 `SPEC_ID_NOT_FOUND` |
| GET | `/atlas/spec-ids?<slot>=<value>…` | session | 200 `{ data: SimilarSpecIds }` | 401, 400 `VALIDATION_FAILED` |
| GET | `/atlas/saved?q=&productType=&cursor=` | session | 200 `{ data: SpecIdLibraryPage }` | 401, 400 `VALIDATION_FAILED` |
| GET | `/atlas/saved/:id` | session | 200 `{ data: SavedSpecId }` | 401, 404 `SPEC_ID_NOT_FOUND` |
| PATCH | `/atlas/saved/:id` | session | 200 `{ data: SavedSpecId }` | 401, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED`, 404 `SPEC_ID_NOT_FOUND`, 409 `SPEC_ID_CHANGED`, 409 `SPEC_ID_EXISTS` |
| GET | `/atlas/saved/:id/history` | session | 200 `{ data: SpecIdChange[] }`, newest first | 401, 404 `SPEC_ID_NOT_FOUND` |

When `mustChangePassword` is true, every session route except
`GET /auth/me`, `POST /auth/sign-out` and `POST /auth/change-password`
returns 403 `MUST_CHANGE_PASSWORD`.

### `Account`

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `email` | string | Lower-cased `@sourceone.global` |
| `firstName` | string | 1–40 characters |
| `lastName` | string | 0–40 characters. Registering requires one; it is empty only for an account from before names were split whose full name was one word |
| `fullName` | string | 1–81 characters: `"First Last"`, or the first name alone when the last is empty |
| `status` | string | `pending`, `approved` or `disabled` |
| `mustChangePassword` | boolean | |
| `createdAt` | string | ISO 8601 |
| `isAdmin` | boolean | Present on `/auth/me` (and account lists); true when the email is in `ACCOUNT_ADMIN_EMAILS` |

### Invites

An admin invites someone by email; the link works once, for 7 days
([ADR 0023](../decisions/0023-accounts-are-created-by-invite-only.md)).
The API creates an account only from an invite: there is no open sign-up, and
`POST /auth/sign-up` is gone (404 with a session; 401 without one, as for
any path the API does not have).

`AccountInvite` is `{ id, email, expiresAt }`: a UUID, the lower-cased
`@sourceone.global` address, and an ISO 8601 time. Neither the token nor its
hash is ever returned.

- `POST /accounts/invites` takes `{ email }`. `inviteUrl` is
  `{CORS_ORIGIN}/register?token=…`, shown once. Inviting an email again
  revokes its unused invite, so the old link stops working.
  `EMAIL_NOT_ALLOWED` and `ACCOUNT_EXISTS` carry their message under
  `details.fields.email`.
- `POST /accounts/invites/:id/revoke` answers `INVITE_NOT_FOUND` for an
  invite already used or revoked, or an id that names none.
- `GET /auth/invites/:token` and `POST /auth/register` answer the same 404
  `INVITE_INVALID` for a token that is expired, used, revoked or unknown, so a
  token's state can't be probed.
- `POST /auth/register` takes `{ token, firstName, lastName, password,
  confirmPassword }`. The account gets the invite's email; an `email` in the
  body is ignored. Names are trimmed and must be 1–40 characters, the password
  at least 12, and `confirmPassword` must equal `password` (else 400 under
  `details.fields.confirmPassword`). The account is approved at once and the
  invite marked used in one transaction: of two registrations on one token,
  one creates the account and the other answers `INVITE_INVALID`. It does not
  sign in.

### `Tool`

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `name` | string | 1–80 characters; unique ignoring case |
| `url` | string | absolute `http:` or `https:`, at most 2048 characters |
| `description` | string | 0–280 characters; empty when not given |
| `category` | string | 1–40 characters |
| `createdAt` | string | ISO 8601 |

`POST /tools` takes `{ name, url, description?, category }`. Surrounding
spaces are trimmed before the rules are checked. No field may contain a
control character (U+0000–U+001F, U+007F).

### Atlas

The S1 Spec ID format is [ADR 0019](../decisions/0019-the-s1-spec-id-format.md).
Slots are named by key, in code order: `formatVersion`, `productType`,
`material`, `coating`, `colourClarity`, `shape`, `profile`, `capacity`,
`topDiameter`, `bottomDiameter`, `height`, `length`, `width`, `gusset`,
`unitWeight`, `basisWeight`, `thickness`, `variant`.

`AtlasDictionary` is `{ release, approvedOn, slots, rules }`. `slots` holds the
seven dictionary slots in code order (`productType` to `profile`, then
`capacity` for its unit letters), each `{ key, name, values: { code, meaning }[] }`.
`rules` holds one `{ productType, slot, rule }` per product type and ruled
slot, where `rule` is `applies`, `never`, `round_only`, `non_round_only` or
`paper_only`.

`DecodedSpecId` is `{ code, dictionaryRelease, slots }`, with all 18 slots in
order:

| Field | Type | Notes |
|---|---|---|
| `number` | number | 1–18 |
| `key` | string | The slot key |
| `name` | string | As people read it, e.g. `Colour / clarity` |
| `raw` | string | The slot's characters, exactly as in the code |
| `state` | string | `value`, `not-known` (all `0`) or `does-not-apply` (all `X`) |
| `meaning` | string | `Bowl lid`, `90 mm`, `3.3 g`, `6 oz`, `Not known`, `Doesn't apply` |

`POST /atlas/spec-ids/decode` takes `{ code }`; surrounding spaces are trimmed.
`POST /atlas/spec-ids/encode` takes `{ facts }`. `facts.productType` is
required; every other slot may be left out or `null`, meaning no value: the
encoder writes `X` where the slot doesn't apply and `0` everywhere else.
Dictionary slots take a code (`"APS"`). `capacity` is `{ unit, value }`: a
unit letter and a whole number. Measured slots are `{ value, unit }`, where
`value` is a decimal string with at most 6 decimal places, never a JSON
number:

| Slots | Units |
|---|---|
| `topDiameter` to `gusset` | `mm`, `cm`, `in` |
| `unitWeight` | `g` |
| `basisWeight` | `gsm` |
| `thickness` | `um` |

`INVALID_SPEC_ID` reports every problem at once in `details.fields`, keyed by
slot. A problem with the whole code (its length or its number of parts) is
under `code`.

`SavedSpecId` is a `DecodedSpecId` plus its permanent `id`, `name` (1–120
characters), `savedBy: { id, fullName }`, `savedAt` (ISO 8601), `version` (1
when saved, raised by 1 on every change), and `updatedBy` and `updatedAt`
(null until the first change).

`POST /atlas/spec-ids` takes `{ name, facts }`. It encodes the facts, as
`/encode` does, and saves the Spec ID under the signed-in account. Surrounding
spaces in `name` are trimmed; it may not contain a control character
(U+0000–U+001F, U+007F). Name problems are in `details.fields.name` of the
same `INVALID_SPEC_ID`. When the code is already saved, it answers 409
`SPEC_ID_EXISTS` with `details.existing`, the saved `SavedSpecId`, and saves
nothing. Nothing is saved on any 4xx.

`GET /atlas/spec-ids?<slot>=<value>…` takes any subset of slot keys from
`productType` to `thickness`, each with a raw slot value (`topDiameter=0090`,
`capacity=Z0006`). It answers `{ fits, mightFit }`, each newest first:

- **fits:** every chosen slot equals the requested value;
- **mightFit:** every chosen slot equals the requested value or is all `0`,
  and at least one is all `0`.

A different known value excludes a Spec ID; nothing is compared by closeness.
With no slot chosen, every saved Spec ID is in `fits`. An unknown key, or a
value that is not a valid slot value, answers 400 `VALIDATION_FAILED` with
`details.fields` keyed by that slot.

`GET /atlas/spec-ids/:code` answers a `SpecIdLookup`: a `SavedSpecId` plus
`replacedCode` and `formerHolders`. The code is matched in capitals, so one
typed in lower case is found. When a Spec ID has the code now, it answers that
one with `replacedCode: null`, and `formerHolders` lists every other Spec ID
that once had it (`{ id, name, code, until }`, `code` being its code now),
newest first. When none has it now but one once did, it answers the last one
that did, with `replacedCode` set to the code asked for. It answers 404 only
when no Spec ID has or had the code.

`GET /atlas/saved` is the library: `{ items, nextCursor }`, 20 Spec IDs per
page, newest change first. `q` matches part of the name, ignoring case and
surrounding spaces (`%` and `_` mean themselves; at most 120 characters).
`productType` is a product type code. Pass `nextCursor` back as `cursor` for
the next page; it is null on the last page. An unknown key, a repeated key, a
product type not in the dictionary or a cursor the server did not write
answers 400 `VALIDATION_FAILED` with `details.fields` keyed as asked.

`PATCH /atlas/saved/:id` takes `{ name, facts, version }`, where `version` is
the one the change was started from. It rebuilds the code from the facts, as
`/encode` does, and saves the change as the signed-in account, recording it
in the history. A change that alters neither the code nor the name answers 200
with what is saved and records nothing. It answers 409 `SPEC_ID_CHANGED` when
`version` is no longer the current one, and 409 `SPEC_ID_EXISTS` with
`details.existing` when the new code is another saved Spec ID's. Nothing is
saved on any 4xx. An `:id` that is not an id answers 404 `SPEC_ID_NOT_FOUND`.

`GET /atlas/saved/:id/history` answers every `SpecIdChange`, newest first,
its creation last: `kind` (`created` or `updated`), `changedBy`,
`changedAt`, `codeBefore` and `nameBefore` (null for `created`), `codeAfter`,
`nameAfter`, and `slots`, every slot the change altered as
`{ key, name, before, after, corrected }`, with meanings as people read them
("Not known", "Doesn't apply", "62 mm"). `corrected` is true when a known
value was replaced.

Nothing replaces or deletes a saved Spec ID: `PUT` and `DELETE` on any Atlas
path answer 404 ([ADR 0022](../decisions/0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md)).

## Error codes

| Code | Status | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | The body has the wrong shape, or a field breaks a rule. `details.fields` names each field |
| `MALFORMED_JSON` | 400 | The body is not valid JSON |
| `PAYLOAD_TOO_LARGE` | 413 | The body is over 100 kB |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | The body's character set or content encoding is one the server does not accept |
| `BAD_REQUEST` | 4xx | Any other body the server could not read, with the status the body parser chose |
| `EMAIL_NOT_ALLOWED` | 400 | An invite's email is not an `@sourceone.global` mailbox |
| `ACCOUNT_EXISTS` | 409 | That email is already registered |
| `SIGN_IN_FAILED` | 401 | Email and password do not match |
| `ACCOUNT_PENDING` | 403 | Account is waiting for admin approval. Only an account from before invites can be pending |
| `ACCOUNT_DISABLED` | 403 | Account has been disabled |
| `ACCOUNT_LOCKED` | 423 | Too many wrong passwords; try again in 15 minutes |
| `SIGN_IN_REQUIRED` | 401 | No valid session cookie |
| `MUST_CHANGE_PASSWORD` | 403 | Signed in but must change password before continuing |
| `NOT_ALLOWED` | 403 | Signed in but not an admin |
| `RESET_TOKEN_INVALID` | 400 | Reset link is missing, used, or expired |
| `ACCOUNT_NOT_FOUND` | 404 | No account with that id |
| `INVITE_INVALID` | 404 | Invite link is expired, used, revoked or unknown — all answered alike |
| `INVITE_NOT_FOUND` | 404 | The invite to revoke was already used or revoked, or there is none with that id |
| `TOOL_NAME_TAKEN` | 409 | Another tool already has this name, ignoring case |
| `INVALID_SPEC_ID` | 400 | A Spec ID, or the facts to build one, break a rule of ADR 0019. `details.fields` holds every problem, keyed by slot (`code` for the whole code) |
| `SPEC_ID_EXISTS` | 409 | That Spec ID is already saved. `details.existing` is the saved Spec ID; nothing new was saved |
| `SPEC_ID_NOT_FOUND` | 404 | No saved Spec ID has, or had, this code; or none has this id |
| `SPEC_ID_CHANGED` | 409 | The Spec ID changed since the `version` the change was started from; nothing was saved |
| `NOT_FOUND` | 404 | No route matches the method and path |
| `INTERNAL_ERROR` | 500 | An unexpected failure. Logged in full on the server; the response says nothing more |

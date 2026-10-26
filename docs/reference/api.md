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
| GET | `/auth/me` | session | 200 `{ data: Account }` | 401 `SIGN_IN_REQUIRED` |
| POST | `/auth/change-password` | session | 204 | 400 `VALIDATION_FAILED`, 401 |
| POST | `/auth/reset-password` | public | 204 | 400 `RESET_TOKEN_INVALID`, 400 `VALIDATION_FAILED` |
| GET | `/auth/invites/:token` | public | 200 `{ data: { email, expiresAt } }` | 404 `INVITE_INVALID` |
| POST | `/auth/register` | public | 201 `{ data: Account }`, approved (no cookie) | 400 `VALIDATION_FAILED`, 404 `INVITE_INVALID`, 409 `ACCOUNT_EXISTS` |
| GET | `/accounts` | admin | 200 `{ data: { pending, approved, disabled } }` | 401, 403 `NOT_ALLOWED` |
| POST | `/accounts/:id/approve` | admin | 200 `{ data: Account }` | 404 `ACCOUNT_NOT_FOUND`, 401, 403 (also for an admin's or System Admin's account, unless the caller is a System Admin) |
| POST | `/accounts/:id/disable` | admin | 200 `{ data: Account }`; sessions ended | 404, 401, 403 (as approve, and for the caller's own account) |
| POST | `/accounts/:id/reset-password` | admin | 200 `{ data: { resetUrl, expiresAt } }` | 404, 401, 403 (as approve) |
| PUT | `/accounts/:id/role` | System Admin | 200 `{ data: Account }`. Body `{ role }`: `staff`, `admin` or `system-admin` | 400 `VALIDATION_FAILED`, 404, 401, 403 (for an admin, and for the caller's own account) |
| POST | `/accounts/invites` | admin | 201 `{ data: { invite: AccountInvite, inviteUrl } }` | 400 `EMAIL_NOT_ALLOWED`, 400 `VALIDATION_FAILED`, 409 `ACCOUNT_EXISTS`, 401, 403 |
| GET | `/accounts/invites` | admin | 200 `{ data: AccountInvite[] }`: unused, unrevoked and unexpired, newest first | 401, 403 |
| POST | `/accounts/invites/:id/revoke` | admin | 200 `{ data: AccountInvite }` | 404 `INVITE_NOT_FOUND`, 401, 403 |
| GET | `/tools` | session | 200 `{ data: Tool[] }` | 401 `SIGN_IN_REQUIRED` |
| POST | `/tools` | session | 201 `{ data: Tool }` | 401, 400 `VALIDATION_FAILED`, 400 `MALFORMED_JSON`, 409 `TOOL_NAME_TAKEN`, 413, 415 |
| GET | `/atlas/dictionary` | session | 200 `{ data: AtlasDictionary }` | 401 `SIGN_IN_REQUIRED` |
| POST | `/atlas/spec-ids/decode` | session | 200 `{ data: DecodedSpecId }` | 401, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED` |
| POST | `/atlas/spec-ids/encode` | session | 200 `{ data: DecodedSpecId }`; nothing is saved | 401, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED` |
| POST | `/atlas/spec-ids/read` | session | 200 `{ data: SpecIdTextReading }`; nothing is saved | 401, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED` |
| POST | `/atlas/spec-ids` | session | 201 `{ data: SavedSpecId }` | 401 `SIGN_IN_REQUIRED`, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED`, 409 `SPEC_ID_EXISTS` |
| GET | `/atlas/spec-ids/:code` | session | 200 `{ data: SpecIdLookup }` | 401, 404 `SPEC_ID_NOT_FOUND` |
| GET | `/atlas/spec-ids?<slot>=<value>…` | session | 200 `{ data: SimilarSpecIds }` | 401, 400 `VALIDATION_FAILED` |
| GET | `/atlas/saved?q=&productType=&page=` | session | 200 `{ data: SpecIdLibraryPage }` | 401, 400 `VALIDATION_FAILED` |
| GET | `/atlas/saved/:id` | session | 200 `{ data: SavedSpecId }` | 401, 404 `SPEC_ID_NOT_FOUND` |
| PATCH | `/atlas/saved/:id` | session | 200 `{ data: SavedSpecId }` | 401, 400 `INVALID_SPEC_ID`, 400 `VALIDATION_FAILED`, 404 `SPEC_ID_NOT_FOUND`, 409 `SPEC_ID_CHANGED`, 409 `SPEC_ID_EXISTS` |
| GET | `/atlas/saved/:id/history` | session | 200 `{ data: SpecIdChange[] }`, newest first | 401, 404 `SPEC_ID_NOT_FOUND` |
| GET | `/atlas/saved/:id/manufacturers` | session | 200 `{ data: SpecIdManufacturers }` | 401, 404 `SPEC_ID_NOT_FOUND` |
| PUT | `/atlas/saved/:id/manufacturers/:manufacturerId/stage` | admin | 200 `{ data: SpecIdManufacturer }` | 401, 403 `NOT_ALLOWED`, 400 `VALIDATION_FAILED`, 404 `SPEC_ID_NOT_FOUND`, 404 `MANUFACTURER_NOT_FOUND` |
| GET | `/atlas/dictionary/usage/:slot/:code` | session | 200 `{ data: { count } }`: saved Spec IDs holding that option | 401, 400 `VALIDATION_FAILED` |
| POST | `/atlas/dictionary/suggestions` | session | 201 `{ data: DictionarySuggestion }` | 401, 400 `VALIDATION_FAILED` |
| GET | `/atlas/dictionary/suggestions?state=waiting\|decided` | session | 200 `{ data: DictionarySuggestion[] }`: waiting oldest first (the default); decided latest decision first | 401 |
| GET | `/atlas/dictionary/suggestions/waiting-count` | session | 200 `{ data: { count } }`: waiting suggestions the caller may decide — 0 for staff | 401 |
| GET | `/atlas/dictionary/suggestions/:id` | session | 200 `{ data: DictionarySuggestionDetail }` | 401, 404 `SUGGESTION_NOT_FOUND` |
| PUT | `/atlas/dictionary/suggestions/:id` | session | 200 `{ data: DictionarySuggestion }` | 401, 400 `VALIDATION_FAILED`, 403 `NOT_ALLOWED`, 404 `SUGGESTION_NOT_FOUND`, 409 `SUGGESTION_DECIDED`, 409 `SUGGESTION_CHANGED` |
| POST | `/atlas/dictionary/suggestions/:id/withdraw` | session | 200 `{ data: DictionarySuggestion }` | 401, 403 `NOT_ALLOWED`, 404 `SUGGESTION_NOT_FOUND`, 409 `SUGGESTION_DECIDED`, 409 `SUGGESTION_CHANGED` |
| POST | `/atlas/dictionary/suggestions/:id/approve` | admin | 200 `{ data: DictionaryChangeApproved }`. Body `{ version }` | 401, 403 `NOT_ALLOWED`, 400 `VALIDATION_FAILED`, 404 `SUGGESTION_NOT_FOUND`, 409 `SUGGESTION_DECIDED`, 409 `SUGGESTION_CHANGED`, 409 `SUGGESTION_OUT_OF_DATE`, 409 `SPEC_IDS_WOULD_CLASH`, 409 `SPEC_ID_WOULD_BE_INVALID`, 409 `DICTIONARY_CHANGED`, 409 `SPEC_ID_CHANGED` |
| POST | `/atlas/dictionary/suggestions/:id/reject` | admin | 200 `{ data: DictionarySuggestion }`. Body `{ reason }` | 401, 403 `NOT_ALLOWED`, 400 `VALIDATION_FAILED`, 404 `SUGGESTION_NOT_FOUND`, 409 `SUGGESTION_DECIDED`, 409 `SUGGESTION_CHANGED` |

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
| `role` | string | `staff`, `admin` or `system-admin` ([ADR 0030](../decisions/0030-roles-live-on-the-account.md)). An admin manages staff and invites; a System Admin manages everyone and changes roles |
| `mustChangePassword` | boolean | |
| `createdAt` | string | ISO 8601 |
| `isAdmin` | boolean | `role` is `admin` or `system-admin`. Kept for a web app cached from before `role` |

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

A Spec ID is written short, [ADR 0025](../decisions/0025-spec-ids-are-written-short.md),
in the layout of [ADR 0024](../decisions/0024-spec-ids-move-to-the-s2-format.md)
on the rules of [ADR 0019](../decisions/0019-the-s1-spec-id-format.md): 25
slots separated by dots, product type first, with no format tag. A slot not
known is `Y`, one that doesn't apply `X`; a known value keeps its width
(`0045`, `Z0012`). Slots are named by key, in code order:
`productType`, `material`, `coating`, `colourClarity`,
`shape`, `profile`, `capacity`, `topDiameter`, `bottomDiameter`, `height`,
`length`, `width`, `gusset`, `unitWeight`, `basisWeight`, `thickness`, `wall`,
`print`, `compartments`, `plies`, `lidOpening`, `handle`, `wrap`, `window`,
`variant`.

Every route that takes a code also takes a code given out before: an S1 code
(74 characters, 18 slots) or a long S2 code (starting `S2.`, 97 characters,
each marker as wide as its slot), and reads it as the short code it converts
to. A marker written wide in a short code (`0000`, `XX`) is read as its letter.
No route issues anything but short codes.

`AtlasDictionary` is `{ release, approvedOn, slots, rules, change }`. `slots` holds the
thirteen dictionary slots in code order (`productType` to `profile`, then
`capacity` for its unit letters, then `wall`, `print`, `lidOpening`, `handle`,
`wrap` and `window`), each `{ key, name, values: { code, meaning }[] }`.
`rules` holds one `{ productType, slot, rule }` per product type and ruled
slot, where `rule` is `applies`, `never`, `round_only`, `non_round_only` or
`paper_only`. `change` is the latest approved dictionary change,
`{ number, at }`, or null before the first.

`DecodedSpecId` is `{ code, dictionaryRelease, slots }`, with all 25 slots in
order:

| Field | Type | Notes |
|---|---|---|
| `number` | number | 1–25 |
| `key` | string | The slot key |
| `name` | string | As people read it, e.g. `Colour / clarity` |
| `raw` | string | The slot's characters, exactly as in the code |
| `state` | string | `value`, `not-known` (`Y`) or `does-not-apply` (`X`) |
| `meaning` | string | `Bowl lid`, `90 mm`, `3.3 g`, `6 oz`, `3 compartments`, `Not known`, `Doesn't apply` |

`POST /atlas/spec-ids/decode` takes `{ code }`; surrounding spaces are trimmed.
`POST /atlas/spec-ids/encode` takes `{ facts }`. `facts.productType` is
required; every other slot may be left out or `null`, meaning no value: the
encoder writes `X` where the slot doesn't apply and `Y` everywhere else.
Dictionary slots take a code (`"APS"`). `compartments` (1–12) and `plies`
(1–4) take a whole number as a string (`"3"`). `capacity` is `{ unit, value }`: a
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

`POST /atlas/spec-ids/read` takes `{ text, productType? }` and reads the facts
in raw text by rules ([ADR 0026](../decisions/0026-raw-text-is-read-by-rules-and-a-public-word-list.md)).
`text` is trimmed and must be 1–500 characters; otherwise it answers 400
`VALIDATION_FAILED` with `details.fields.text`: "Type some text to read." or
"Search text must be at most 500 characters." A `productType` reads the text as
that product type, over any the text names; one not in the dictionary answers
400 `INVALID_SPEC_ID` beside `productType`. It answers a `SpecIdTextReading`:

| Field | Type | Notes |
|---|---|---|
| `read` | `{ key, name, meaning, words, ruling }[]` | Each fact read, in code order. `meaning` reads as a decoded slot does (`14 oz`); `words` as the text wrote them; `ruling` is #28's ruling for a size (`R1`, `R1b`, `R2`, `R3`, `R5`, `R6`), else null |
| `ignored` | `string[]` | The words no rule used, and the words of a fact the product type cannot have, as the text wrote them |
| `conflicts` | `{ key, name, found }[]` | A slot the text gives two values for, with each value's words; it is left out of the code |
| `decoded` | `DecodedSpecId \| null` | The code the facts make, once a product type is found or given; else null |

Nothing is saved.

`SavedSpecId` is a `DecodedSpecId` plus its permanent `id`, `name` (1–120
characters), `savedBy: { id, fullName }`, `savedAt` (ISO 8601), `version` (1
when saved, raised by 1 on every change), `updatedBy` and `updatedAt`
(null until the first change), and `manufacturerStages`.

`manufacturerStages` is `{ specificationsReceived, quoted, sampling, inProduction }`:
how many of the Spec ID's manufacturers have reached each stage, at it or
later (#73). A manufacturer reaches its own stage and every earlier one, so
one In production and one Quoted are 2, 2, 1, 1, and `specificationsReceived`
is how many manufacturers it has. Each manufacturer's own stage is the one
`GET /atlas/saved/:id/manufacturers` answers. A Spec ID with no manufacturers,
or one just saved, has all four 0. Every list (the library, a similar lookup)
reads them for all its Spec IDs at once.

`POST /atlas/spec-ids` takes `{ name, facts }`. It encodes the facts, as
`/encode` does, and saves the Spec ID under the signed-in account. Surrounding
spaces in `name` are trimmed; it may not contain a control character
(U+0000–U+001F, U+007F). Name problems are in `details.fields.name` of the
same `INVALID_SPEC_ID`. When the code is already saved, it answers 409
`SPEC_ID_EXISTS` with `details.existing`, the saved `SavedSpecId`, and saves
nothing. Nothing is saved on any 4xx.

`GET /atlas/spec-ids?<slot>=<value>…` takes any subset of slot keys from
`productType` to `window`, each with a raw slot value (`topDiameter=0090`,
`capacity=Z0006`, `compartments=03`). It answers `{ fits, mightFit }`:

- **fits:** every chosen slot equals the requested value. Those with the
  fewest slots not known (`Y`) come first;
- **mightFit:** every chosen slot equals the requested value or is `Y`,
  and at least one is `Y`. Those that record the most chosen slots come first.

In each, Spec IDs that tie are newest first (#50). A different known value
excludes a Spec ID: values are never compared by closeness, so `0091` does not
fit `0090`.
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

`GET /atlas/saved` is the library: `{ items, page, pageSize, total }`, 20 Spec IDs
per page, newest change first ([ADR 0029](../decisions/0029-the-library-is-numbered-pages.md)).
`q` matches part of the name, ignoring case and surrounding spaces (`%` and `_`
mean themselves; at most 120 characters). `productType` is a product type code.
`page` starts at 1 and is the first page when omitted. `total` is how many
match the search and product type, so the last page is known at once. A `page`
past the end answers that last page. An unknown key, a repeated key, a product
type not in the dictionary or a page that is not a whole number from 1 answers
400 `VALIDATION_FAILED` with `details.fields` keyed as asked.

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
value was replaced. `dictionaryChange` is `{ number, suggestedBy, approvedBy }`
when an approved dictionary change made the entry, else null.

`GET /atlas/saved/:id/manufacturers` answers a `SpecIdManufacturers`: the
Spec ID's `{ id, name, code }` and `manufacturers`, each manufacturer once,
by name, as `{ id, name, country, stage, stageSet, quotes }` (#57). Quotes come
from the verified-list import, each value as the workbook shows it, null when
empty ([ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md)).
`stage` is the one an admin set, `sampling` or `in-production`; with none,
`quoted` when any quote's `fobPerUnit` or `fobPerCase` holds a digit (`N/A`,
`-` and `/` are not prices), else `specifications-received`. `stageSet` is the
last change an admin made, `{ by, at, stage }` with `stage` null once cleared,
or null when none was made.

`PUT /atlas/saved/:id/manufacturers/:manufacturerId/stage` takes
`{ stage: "sampling" | "in-production" | null }`; `null` clears it, handing the
stage back to the quotes. Only admins may call it: anyone else is answered 403
`NOT_ALLOWED` by the admin gate, and nothing is recorded. Every change is
recorded with who, when, and the stage before and after; setting the stage a
manufacturer already has records nothing. A manufacturer with no quote on that
Spec ID, or a `:manufacturerId` that is not an id, answers 404
`MANUFACTURER_NOT_FOUND`. The verified-list import never changes a stage.

#### Dictionary suggestions

Anyone signed in may suggest a change to the dictionary; nothing in it changes
until an admin who did not make the suggestion approves it (#95,
[ADR 0031](../decisions/0031-the-dictionary-is-edited-by-suggestion-and-approval.md)).
Approving and rejecting are admins', behind the admin gate.

`POST /atlas/dictionary/suggestions` takes `{ slot, code, proposal }`: one of
the thirteen dictionary lists, the option it is about (the new code for an
add, the product type for a rules change), and a `proposal` by `kind`:

| `kind` | `proposal` |
|---|---|
| `add` | `{ meaning, searchWords, rules }` — `rules` holds every ruled field's rule for a new product type, and is null for any other list |
| `edit` | `{ newCode, meaning, searchWords }` — each null leaves it; at least one is not null; `searchWords` replaces the whole list |
| `delete` | `{ replacement }` — what saved Spec IDs holding the option become: another code, `Y`, or null when none holds it |
| `rules` | `{ rules }` — a product type's fields whose rule changes, `{ coating: "never" }` |

Codes are compared in capitals and wording trimmed. Every broken rule is
answered at once, 400 `VALIDATION_FAILED` with `details.fields` keyed by
`code`, `newCode`, `meaning`, `searchWords`, `replacement` or `rules`, in
#95's words where #95 gives them: a code of the wrong width or characters, a
marker, a code the list already has, an option the list does not have, an
empty wording or one over 120 characters, `RD`'s letters or deletion, a missing
replacement, a product type that would become not known, a missing or unchanged
rule, or a search word in the wrong form (2–40 lower-case letters, digits, spaces or hyphens; at most 20)
or one that already finds another option of that list.

`DictionarySuggestion` is `{ id, kind, slot, code, proposal, state, version,
suggestedBy, suggestedAt, decidedBy, decidedAt, reason, changeNumber }`.
`state` is `waiting`, `approved`, `rejected` or `withdrawn`; `version` is
raised by each edit. `DictionarySuggestionDetail` adds `events`, the trail
first step first (`{ kind, by, at, proposalBefore, proposalAfter, reason }`,
`kind` one of `suggested`, `edited`, `withdrawn`, `approved`, `rejected`), and
`usage`, how many saved Spec IDs hold the option now. While it waits, it also
carries `rewrites`, each saved Spec ID approving now would change
(`{ id, name, codeBefore, codeAfter }`), or `problem`, the message approving
now would be refused with; both are null once it is decided.

`PUT /atlas/dictionary/suggestions/:id` takes the same body and the `version`
the suggester read. Only the suggester may edit or withdraw, and only while it
waits; its `kind`, `slot` and `code` cannot change (400 `VALIDATION_FAILED`
under `kind`). An edit from an older version answers 409 `SUGGESTION_CHANGED`.

`POST /atlas/dictionary/suggestions/:id/approve` takes the `version` the
approver read. An admin who did not suggest it approves; the suggester gets 403
`NOT_ALLOWED` "You can't approve or reject your own suggestion." The suggestion
is checked again against the live dictionary (409 `SUGGESTION_OUT_OF_DATE`,
`details.fields` as when suggesting), then applied as the next numbered change,
in one transaction with every saved Spec ID it rewrites:

| Kind | What changes in saved Spec IDs holding the option |
|---|---|
| `edit` with `newCode` | The code is replaced by the new letters; a capacity keeps its number |
| `delete` | The code is replaced by `replacement`; `Y` leaves a capacity `Y` |
| `rules` | Nothing is replaced |

Then every ruled field of each is refitted to the new rules: `X` where it no
longer applies, `Y` where it applies but was `X`, and `Y` where it waits on a
shape or material not known. Each rewritten Spec ID gets a history entry naming
the change, and its `version` goes up by 1. It answers
`DictionaryChangeApproved`, `{ suggestion, changeNumber, specIdsRewritten }`.
Approving is refused, with nothing written, with 409 `SPEC_IDS_WOULD_CLASH`
(`details.codes`, the two codes now) when two Spec IDs would end with one code;
409 `SPEC_ID_WOULD_BE_INVALID` (`details.code`) when a rewrite would be a code
the new dictionary refuses; 409 `DICTIONARY_CHANGED` when another approval
landed while this one was made; and 409 `SPEC_ID_CHANGED` when a Spec ID it
rewrites changed meanwhile. Approvals run one at a time.

`POST /atlas/dictionary/suggestions/:id/reject` takes `{ reason }`, 1–500
characters once trimmed, kept on the suggestion and in its trail; without one,
400 `VALIDATION_FAILED` under `reason`: "Say why, so {suggester} knows what to
change."

`GET /atlas/dictionary` answers `change`, the latest approved change as
`{ number, at }`, or null before the first. A `SpecIdChange` in a Spec ID's
history carries `dictionaryChange`: `{ number, suggestedBy, approvedBy }` when
an approved change made it, else null.

Nothing replaces or deletes a saved Spec ID ([ADR 0022](../decisions/0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md)):
there is no `PUT` or `DELETE` for one. The one Atlas `PUT` sets a manufacturer's stage.

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
| `NOT_ALLOWED` | 403 | Signed in but not an admin; or an admin acting on an admin's or System Admin's account; or anyone disabling, or changing the role of, their own account; or editing or withdrawing someone else's dictionary suggestion, or approving or rejecting your own |
| `RESET_TOKEN_INVALID` | 400 | Reset link is missing, used, or expired |
| `ACCOUNT_NOT_FOUND` | 404 | No account with that id |
| `INVITE_INVALID` | 404 | Invite link is expired, used, revoked or unknown — all answered alike |
| `INVITE_NOT_FOUND` | 404 | The invite to revoke was already used or revoked, or there is none with that id |
| `TOOL_NAME_TAKEN` | 409 | Another tool already has this name, ignoring case |
| `INVALID_SPEC_ID` | 400 | A Spec ID, or the facts to build one, break a rule of ADR 0019. `details.fields` holds every problem, keyed by slot (`code` for the whole code) |
| `SPEC_ID_EXISTS` | 409 | That Spec ID is already saved. `details.existing` is the saved Spec ID; nothing new was saved |
| `SPEC_ID_NOT_FOUND` | 404 | No saved Spec ID has, or had, this code; or none has this id |
| `SPEC_ID_CHANGED` | 409 | The Spec ID changed since the `version` the change was started from; or a Spec ID an approval rewrites changed while it was being made. Nothing was saved |
| `MANUFACTURER_NOT_FOUND` | 404 | The manufacturer has no quote on this Spec ID, or the id is not one |
| `SUGGESTION_NOT_FOUND` | 404 | No dictionary suggestion has this id, or the id is not one |
| `SUGGESTION_DECIDED` | 409 | The suggestion was approved, rejected or withdrawn: it no longer waits |
| `SUGGESTION_CHANGED` | 409 | The suggestion changed since the `version` the edit or approval was started from; nothing was saved |
| `SUGGESTION_OUT_OF_DATE` | 409 | Checked again on approval, the suggestion no longer fits the live dictionary. `details.fields` as when suggesting |
| `SPEC_IDS_WOULD_CLASH` | 409 | Approving would give two saved Spec IDs one code. `details.codes` holds both codes as they are, when known |
| `SPEC_ID_WOULD_BE_INVALID` | 409 | Approving would leave a saved Spec ID a code the new dictionary refuses. `details.code` is its code now |
| `DICTIONARY_CHANGED` | 409 | Another approval landed while this one was being made; nothing was saved |
| `NOT_FOUND` | 404 | No route matches the method and path |
| `INTERNAL_ERROR` | 500 | An unexpected failure. Logged in full on the server; the response says nothing more |

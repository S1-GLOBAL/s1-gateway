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
| POST | `/auth/sign-up` | public | 201 `{ data: Account }` (no cookie) | 400 `EMAIL_NOT_ALLOWED`, 400 `VALIDATION_FAILED`, 409 `ACCOUNT_EXISTS`, 429 `SIGN_UP_RATE_LIMITED` |
| POST | `/auth/sign-in` | public | 200 `{ data: Account }` + session cookie | 401 `SIGN_IN_FAILED`, 403 `ACCOUNT_PENDING`, 403 `ACCOUNT_DISABLED`, 423 `ACCOUNT_LOCKED` |
| POST | `/auth/sign-out` | session (missing session → 204) | 204, clear cookie | — |
| GET | `/auth/me` | session | 200 `{ data: Account }` (`isAdmin` set) | 401 `SIGN_IN_REQUIRED` |
| POST | `/auth/change-password` | session | 204 | 400 `VALIDATION_FAILED`, 401 |
| POST | `/auth/reset-password` | public | 204 | 400 `RESET_TOKEN_INVALID`, 400 `VALIDATION_FAILED` |
| GET | `/accounts` | admin | 200 `{ data: { pending, approved, disabled } }` | 401, 403 `NOT_ALLOWED` |
| POST | `/accounts/:id/approve` | admin | 200 `{ data: Account }` | 404 `ACCOUNT_NOT_FOUND`, 401, 403 |
| POST | `/accounts/:id/disable` | admin | 200 `{ data: Account }`; sessions ended | 404, 401, 403 |
| POST | `/accounts/:id/reset-password` | admin | 200 `{ data: { resetUrl, expiresAt } }` | 404, 401, 403 |
| GET | `/tools` | session | 200 `{ data: Tool[] }` | 401 `SIGN_IN_REQUIRED` |
| POST | `/tools` | session | 201 `{ data: Tool }` | 401, 400 `VALIDATION_FAILED`, 400 `MALFORMED_JSON`, 409 `TOOL_NAME_TAKEN`, 413, 415 |

When `mustChangePassword` is true, every session route except
`GET /auth/me`, `POST /auth/sign-out` and `POST /auth/change-password`
returns 403 `MUST_CHANGE_PASSWORD`.

### `Account`

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `email` | string | Lower-cased `@sourceone.global` |
| `fullName` | string | 1–80 characters |
| `status` | string | `pending`, `approved` or `disabled` |
| `mustChangePassword` | boolean | |
| `createdAt` | string | ISO 8601 |
| `isAdmin` | boolean | Present on `/auth/me` (and account lists); true when the email is in `ACCOUNT_ADMIN_EMAILS` |

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

## Error codes

| Code | Status | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | The body has the wrong shape, or a field breaks a rule. `details.fields` names each field |
| `MALFORMED_JSON` | 400 | The body is not valid JSON |
| `PAYLOAD_TOO_LARGE` | 413 | The body is over 100 kB |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | The body's character set or content encoding is one the server does not accept |
| `BAD_REQUEST` | 4xx | Any other body the server could not read, with the status the body parser chose |
| `EMAIL_NOT_ALLOWED` | 400 | Sign-up email is not an `@sourceone.global` mailbox |
| `ACCOUNT_EXISTS` | 409 | That email is already registered |
| `SIGN_UP_RATE_LIMITED` | 429 | More than five successful sign-ups from this IP in an hour |
| `SIGN_IN_FAILED` | 401 | Email and password do not match |
| `ACCOUNT_PENDING` | 403 | Account is waiting for admin approval |
| `ACCOUNT_DISABLED` | 403 | Account has been disabled |
| `ACCOUNT_LOCKED` | 423 | Too many wrong passwords; try again in 15 minutes |
| `SIGN_IN_REQUIRED` | 401 | No valid session cookie |
| `MUST_CHANGE_PASSWORD` | 403 | Signed in but must change password before continuing |
| `NOT_ALLOWED` | 403 | Signed in but not an admin |
| `RESET_TOKEN_INVALID` | 400 | Reset link is missing, used, or expired |
| `ACCOUNT_NOT_FOUND` | 404 | No account with that id |
| `TOOL_NAME_TAKEN` | 409 | Another tool already has this name, ignoring case |
| `NOT_FOUND` | 404 | No route matches the method and path |
| `INTERNAL_ERROR` | 500 | An unexpected failure. Logged in full on the server; the response says nothing more |

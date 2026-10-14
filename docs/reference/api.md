# API

Base path: **`/api/v1`** ([ADR 0006](../decisions/0006-versioned-api-prefix.md)).
Request and response types are in
[`backend/src/contracts/`](../../backend/src/contracts/README.md) — that is
the source of truth; this page summarises it.

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

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/health` | 200 `{ data: { status: "ok" } }` | — |
| GET | `/tools` | 200 `{ data: Tool[] }`, by category then name, ignoring case | — |
| POST | `/tools` | 201 `{ data: Tool }` | 400 `VALIDATION_FAILED`, 400 `MALFORMED_JSON`, 409 `TOOL_NAME_TAKEN`, 413 `PAYLOAD_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE` |

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
| `TOOL_NAME_TAKEN` | 409 | Another tool already has this name, ignoring case |
| `NOT_FOUND` | 404 | No route matches the method and path |
| `INTERNAL_ERROR` | 500 | An unexpected failure. Logged in full on the server; the response says nothing more |

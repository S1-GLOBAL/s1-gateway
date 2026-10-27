# 0010. The dictionary, edited by suggestion and approval

- **Status:** In progress
- **Owner:** Rey Denzo
- **Related:** [#95](https://github.com/S1-GLOBAL/s1-gateway/issues/95) ·
  [ADR 0031](../decisions/0031-the-dictionary-is-edited-by-suggestion-and-approval.md) ·
  [ADR 0021](../decisions/0021-the-atlas-dictionary-changes-only-by-migration.md) (superseded) ·
  [ADR 0022](../decisions/0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md) ·
  [ADR 0026](../decisions/0026-raw-text-is-read-by-rules-and-a-public-word-list.md) ·
  [ADR 0030](../decisions/0030-roles-live-on-the-account.md) ·
  [ADR 0013](../decisions/0013-loading-states-are-page-shaped-skeletons.md)

## Goal

At the end of this plan, anyone signed in can suggest, from the Dictionary
sheet, adding, editing or deleting an option in any of the 13 dictionary
lists, a product type's field rules, and an option's search words. A new
**Dictionary changes** page lists every suggestion with its full trail, and
shows admins a badge counting the ones waiting for them. An admin who did not
make a suggestion approves it, which applies it and rewrites every saved Spec
ID it touches in one transaction, or rejects it with a reason. #95 is the
specification: where this plan and #95 disagree, #95 wins and this plan is
corrected.

## Scope

**In scope**
- Suggestions, their trail, numbered dictionary changes, remembered renames and
  approved search words: five tables, by generated migrations
- Approval: applying a change to the dictionary and to saved Spec IDs, and
  linking each rewritten Spec ID's history entry to it
- Every hardcoded code in the reader, the size rulings and the capacity labels
  following renames
- The reader and the verified-list import using approved search words
- The Dictionary changes page, its skeleton and its sidebar badge; suggesting
  from the Dictionary sheet; the Spec ID history line for a dictionary change
- ADR 0031, `api.md`, `data-model.md`

**Out of scope** — and where it is handled instead
- Emailing admins — not planned: the Gateway sends no mail (ADR 0018)
- One-click undo — not planned: a suggestion of the opposite change reverses one (#95)
- A "Round" tick per shape — not planned: `RD` is locked instead (#95)
- Editing release `S1 0.1.0` — never: it is kept only to read old codes (ADR 0024)

## Prerequisites

- `main` has #94: accounts have a role, and the admin gate reads it.
  Verify: `git grep -n "get isAdmin" -- backend/src/modules/accounts/domain/account.ts` prints one line.
- The last migration is `0015_add_account_role`.
  Verify: `git ls-files backend/drizzle | grep -c "\.sql$"` prints `16`.
- The dictionary is read fresh on every request: every use case calls
  `dictionaries.get(CURRENT_RELEASE)` in `execute`, and nothing caches it.
  Verify: `git grep -n "CURRENT_RELEASE = 'S2 0.1.0'" -- backend/src` prints one line.
- A working local setup: `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit`
  exits 0 on a fresh branch from `main`, and `npm run db:up` then `npm test` passes.

## Progress

| Phase | Steps | Status |
|---|---|---|
| 1. Suggestions and their trail | 7 / 7 | Done — the suggestion rules, their two tables and the session routes; approving is phase 2 |
| 2. Approving and rejecting | 10 / 10 | Done — approving rewrites saved Spec IDs in one transaction; rejecting needs a reason; history names the change |
| 3. Renames and search words in the reader | 0 / 5 | Not started |
| 4. The Dictionary changes page | 0 / 6 | Not started |
| 5. Suggesting from the Dictionary sheet | 0 / 6 | Not started |

Five pull requests, one per phase. Phases 1–4 are "Part of #95"; phase 5 is
"Closes #95". Each phase leaves `main` working: phases 1–3 add routes the web
app does not call yet. Stop for the owner after each.

---

## Design

### Precedents this plan sets

| First | How | Why this way |
|---|---|---|
| A change that needs a second person | A suggestion is only ever approved by an admin who is not its suggester, checked in the domain and answered 403 | #95: nobody decides their own |
| The application writing the dictionary | Only `DictionaryChangeStore.apply` writes the dictionary tables: it writes the whole next S2 release, about 800 rows, in one transaction with everything else the approval changes *(as built: simpler and safer than patching rows by kind)* | ADR 0031: the change and every Spec ID it rewrites succeed or fail together |
| Saved Spec IDs rewritten in bulk by the application | The same versioned update and history entry as one edit (ADR 0022), many in one transaction, each entry linked to the change | Migrations 0011 and 0012 rewrote codes with no history entry; here every rewrite is recorded |
| A hardcoded code that follows a rename | Code in the reader, the size rulings and the capacity labels keeps naming the S2 0.1.0 codes, and asks the dictionary for each one's live letters | One mechanism for about 60 literal codes, not 60 edits per rename |
| A nav item with a count | `NavItem` gains an optional badge, read from its own query | The first sidebar count; the admin badge |

### Data — five new tables, one new column

Tables in `backend/src/modules/atlas/infrastructure/`, exported from
`backend/src/database-schema.ts`, migrations generated (ADR 0005). All five
new tables are added to `resetTables` in `backend/src/test/database.ts`: unlike
the seeded dictionary, they start empty.

Approval tests change the seeded rows of `atlas_dictionary_values` and
`atlas_slot_rules`, which `resetTables` deliberately never empties. So
`backend/src/test/global-setup.ts` copies both tables once after migrating
(`atlas_dictionary_values_seed`, `atlas_slot_rules_seed`, test database only),
and `resetTables` restores them from those copies *(technical call: a test that
approves leaves the next test the dictionary the migration made)*.

**`atlas_dictionary_suggestions`** — `atlas-dictionary-suggestions.table.ts`

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | Primary key |
| `kind` | `varchar(16)` | no | Check: `add`, `edit`, `delete`, `rules` |
| `slot` | `varchar(32)` | no | A dictionary slot key; `productType` for `rules` |
| `code` | `varchar(5)` | no | The option it is about: the new code for `add`, the product type for `rules` |
| `proposal` | `jsonb` | no | The kind's proposal, below. Replaced on each edit |
| `state` | `varchar(16)` | no | Check: `waiting`, `approved`, `rejected`, `withdrawn` |
| `version` | `integer` | no | Default 1; raised on each edit, so an approval decides what the approver saw |
| `suggested_by` | `uuid` | no | FK → `accounts.id` |
| `suggested_at` | `timestamptz` | no | |
| `decided_by` | `uuid` | yes | FK → `accounts.id`; set on approve and reject |
| `decided_at` | `timestamptz` | yes | Set on approve, reject and withdraw |
| `reason` | `varchar(500)` | yes | Required when rejected |
| `change_number` | `integer` | yes | Set when approved. *As built:* no FK; `atlas_dictionary_changes.suggestion_id` holds the link, unique |

Index on `(state, suggested_at)`. Check: `decided_by` and `reason` agree with `state`.

**`atlas_dictionary_suggestion_events`** — insert only

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | no | Primary key |
| `suggestion_id` | `uuid` | no | FK → suggestions |
| `kind` | `varchar(16)` | no | Check: `suggested`, `edited`, `withdrawn`, `approved`, `rejected` |
| `by` | `uuid` | no | FK → `accounts.id` |
| `at` | `timestamptz` | no | |
| `proposal_before` | `jsonb` | yes | `edited` only |
| `proposal_after` | `jsonb` | yes | `suggested` and `edited` |
| `reason` | `varchar(500)` | yes | `rejected` only |

**`atlas_dictionary_changes`** — one row per approved suggestion

| Column | Type | Null | Notes |
|---|---|---|---|
| `number` | `integer` | no | Primary key, 1, 2, 3…: the previous maximum plus one, inside the approval's lock *(technical call: no gaps, unlike a sequence)* |
| `suggestion_id` | `uuid` | no | FK → suggestions, unique |
| `approved_by` | `uuid` | no | FK → `accounts.id` |
| `approved_at` | `timestamptz` | no | |
| `spec_ids_rewritten` | `integer` | no | |

**`atlas_dictionary_renames`** — old letters to live letters, flattened

| Column | Type | Null | Notes |
|---|---|---|---|
| `slot` | `varchar(32)` | no | |
| `old_code` | `varchar(5)` | no | Primary key with `slot` |
| `new_code` | `varchar(5)` | yes | The live letters; null once that option is deleted |
| `change_number` | `integer` | no | FK → changes; the change that last moved it |

Renaming `A` to `B` inserts `(A → B)` and points every row whose `new_code` is
`A` at `B`, so a lookup is one step however many renames happened. Deleting
`B` sets them to null *(technical call)*.

**`atlas_dictionary_search_words`**

| Column | Type | Null | Notes |
|---|---|---|---|
| `slot` | `varchar(32)` | no | Primary key with `word`: one meaning per word, per field |
| `word` | `varchar(40)` | no | Lower case; letters, digits, spaces, hyphens |
| `code` | `varchar(5)` | no | Moved by a rename, deleted with its option |
| `change_number` | `integer` | no | FK → changes; the change that added it |

**`atlas_spec_id_changes`** gains `dictionary_change_number integer null`, FK →
`atlas_dictionary_changes.number`. `kind` stays `updated`; `changed_by` is the
approver.

The dictionary tables (`atlas_dictionary_values`, `atlas_slot_rules`) keep
their shape; the application now inserts, updates and deletes rows of release
`S2 0.1.0` only. `atlas_dictionary_releases.approved_on` stays the release's
date; the latest change's date comes from `atlas_dictionary_changes`.

### Proposals — `backend/src/modules/atlas/domain/suggestions/proposal.ts`

| Kind | Proposal |
|---|---|
| `add` | `{ meaning, searchWords: string[], rules?: Record<RuledSlotKey, SlotRule> }` — `rules` exactly when `slot` is `productType`, all 22 |
| `edit` | `{ newCode: string \| null, meaning: string \| null, searchWords: string[] \| null }` — null leaves it; at least one is not null |
| `delete` | `{ replacement: string \| null }` — `Y`, another code, or null when no saved Spec ID uses it |
| `rules` | `{ rules: Partial<Record<RuledSlotKey, SlotRule>> }` — at least one, each different from today's |

`checkProposal(kind, slot, code, proposal, dictionary, searchWords, usage)` is
pure and answers every problem at once, as `SpecId.build` does, so a form shows
them all. It is called on suggest, on edit, and again on approve against the
live dictionary. The rules are #95's table; problems carry fields
(`code`, `meaning`, `searchWords`, `replacement`, `rules`) and #95's copy.

### The dictionary learns its renames — `domain/dictionary.ts`

`Dictionary` gains `renames: ReadonlyMap<string, string | null>` (key
`slot:old`) and two methods:

| Method | Answers |
|---|---|
| `live(slot, code)` | The code's live letters: itself if it exists, its rename if renamed, `undefined` if deleted |
| ~~`original(slot, code)`~~ | Not built: the capacity labels find a live unit's label by asking `live` of each S2 0.1.0 unit, so one direction is enough |

`DrizzleDictionaryRepository.get` also reads `atlas_dictionary_renames`, and
the latest change (`number`, `approved_at`), which the dictionary contract
gains as `change: { number, at } | null`.

Every hardcoded code goes through `live`: `ROUND_SHAPE` and `PAPER_FAMILY` in
`domain/slots.ts`; `KEYWORDS` in `domain/reading/keywords.ts`; `WORD_LIST` in
`domain/reading/word-list.ts`; the product-type sets and `'RD'`/`'RC'` in
`domain/reading/size-rulings.ts`; `'RD'` in `domain/reading/read-text.ts` and
`domain/import/verified-row.ts`; `CAPACITY_UNIT_LABELS` through `live`, in reverse; and
`fromS1`'s output in `domain/old-codes.ts`. A keyword or word whose code was
deleted is skipped. `RD` itself cannot be renamed or deleted, so
`ROUND_SHAPE` is live by rule, but goes through `live` like the rest.

### Approval — `application/approve-dictionary-suggestion.ts`

1. Load the suggestion; refuse unless `waiting`, unless the approver is an
   admin (the route's gate) and not its suggester, and unless the approver saw
   its current `version`.
2. Load the live dictionary, its search words and the option's usage; run
   `checkProposal` again. Problems answer `409 SUGGESTION_OUT_OF_DATE` with
   #95's "The dictionary changed since this was suggested: {what}…".
3. `nextDictionary = applyProposal(dictionary, suggestion)` — pure.
4. Load the saved Spec IDs it touches: those with `slot = code` (rename,
   delete), or of that product type (rules, product-type rename or delete).
5. For each, `rewriteSpecId(saved, suggestion, nextDictionary)` — pure: replace
   the code, then refit every ruled field with `expectedFill`: `X` where it no
   longer applies, `Y` where it now applies and was `X`. Build the new code with
   `SpecId.build(…, nextDictionary)`.
6. If two rewritten codes are equal, or one equals an untouched saved Spec ID's
   code, answer `409 SPEC_IDS_WOULD_CLASH` with both codes and change nothing.
7. Hand everything to `DictionaryChangeStore.apply(plan)`, whose Drizzle
   adapter, in one transaction under `pg_advisory_xact_lock` on a constant key
   *(technical call: one approval at a time; an approval is rare and short)*:
   - writes the dictionary rows, search words and renames;
   - inserts the change with the next number;
   - updates each Spec ID where its `version` is still the one loaded — any
     other answers `409 SPEC_ID_CHANGED` ("A Spec ID changed while this was
     being approved. Try again.") and rolls everything back;
   - inserts each history entry with `dictionary_change_number`;
   - marks the suggestion approved and inserts its `approved` event.
   The unique index on `atlas_spec_ids.code` is the last guard against a clash.
   *As built:* the store also refuses with `409 DICTIONARY_CHANGED` when
   another approval landed after the plan was made (it checks the latest
   change number under the lock), and the plan refuses with
   `409 SPEC_ID_WOULD_BE_INVALID` when a rewrite would be a code the new
   dictionary refuses. Planning is shared with a waiting suggestion's page,
   which shows `rewrites`, or `problem`. Under the lock, the store also
   reads every Spec ID holding the option again, and any saved, changed or
   gone since the plan answers `409 SPEC_ID_CHANGED`. Each save and change of
   a Spec ID holds the same lock shared and is refused, then built again by
   its use case, when an approval landed after the dictionary it was built
   from (#100's audit).

Reject, withdraw and edit are small use cases over the same repository.

### Routes — under `/api/v1/atlas`

| Method | Path | Who | Answers |
|---|---|---|---|
| GET | `/dictionary` | session | As today, plus `change` |
| GET | `/dictionary/usage/:slot/:code` | session | `{ count }` saved Spec IDs with that value |
| POST | `/dictionary/suggestions` | session | 201 the suggestion; 400 with field problems |
| GET | `/dictionary/suggestions?state=waiting\|decided` | session | Suggestions, each with suggester and decider names: waiting oldest first, so the longest wait is seen first; decided latest decision first |
| GET | `/dictionary/suggestions/:id` | session | One suggestion, its events oldest first, its usage; phase 2 adds, for a waiting one, the codes it would rewrite (before → after) |
| PUT | `/dictionary/suggestions/:id` | session | The suggester only, while waiting; raises `version` |
| POST | `/dictionary/suggestions/:id/withdraw` | session | The suggester only, while waiting |
| GET | `/dictionary/suggestions/waiting-count` | session | `{ count }` waiting suggestions the caller may decide: 0 for staff; for an admin, all but their own |
| POST | `/dictionary/suggestions/:id/approve` | admin | Body `{ version }`; 200 the change |
| POST | `/dictionary/suggestions/:id/reject` | admin | Body `{ reason }` (1–500) |

Errors: `SUGGESTION_NOT_FOUND` 404; `NOT_ALLOWED` 403 (deciding your own;
editing or withdrawing someone else's); `SUGGESTION_DECIDED` 409 (no longer
waiting); `SUGGESTION_OUT_OF_DATE` 409; `SPEC_IDS_WOULD_CLASH` 409;
`SPEC_ID_CHANGED` 409; `VALIDATION_FAILED` 400.

`GET /atlas/saved/:id/history` entries gain
`dictionaryChange: { number, suggestedBy, approvedBy } | null`.

### Frontend

| Where | What |
|---|---|
| `features/atlas/application/` | Gateway methods and hooks for every route above; approving invalidates `atlasKeys.dictionary()`, the suggestion lists, the waiting count and the library |
| `app/nav.ts` | `NavItem` gains `badge?: 'dictionary-waiting'`; Dictionary changes item for everyone, between Atlas and Accounts |
| `pages/dictionary/` | `DictionaryChangesPage.tsx` and `DictionaryChangesPageSkeleton.tsx`, route `dictionary/changes`; tabs Waiting and History |
| `features/atlas/presentation/dictionary/` | `SuggestionCard`, `SuggestionTrail`, `RejectForm`, and the suggestion form `SuggestionForm` (one form, its fields by kind) |
| `DictionarySheet.tsx`, `DictionaryBrowser.tsx` | The header copy; Suggest buttons on each option, each list and the rules table; search words under each option |
| Spec ID History | #95's "Changed by dictionary change #N…" line, linking to `/dictionary/changes?change=N` |

---

## Phase 1 — Suggestions and their trail

### Step 1.1 — The proposal rules, test first

- [x] **Action.** Write `domain/suggestions/proposal.test.ts` covering every row of #95's rules table, each failing alone and all together; then `proposal.ts` with `Proposal`, `SuggestionKind` and `checkProposal`. Code format by slot width from `SLOTS` in `domain/slots.ts` (capacity's unit: 1). Search words are checked against `WORD_LIST` and the approved words passed in.
- [x] **Verify.** `npx vitest run --config vitest.unit.config.ts src/modules/atlas/domain/suggestions` (from `backend/`) passes; the `RD` rows answer #95's exact copy.

### Step 1.2 — The suggestion entity

- [x] **Action.** `domain/suggestions/suggestion.ts`: `Suggestion` with `suggest`, `edit(by, proposal)` (suggester only, waiting only, raises `version`, answers an `edited` event), `withdraw(by)`, and `restore`; `SuggestionEvent`. Tests first in `suggestion.test.ts`.
- [x] **Verify.** Tests pass: editing or withdrawing someone else's answers `NotAllowedError`; editing a decided one answers `SuggestionDecidedError`.

### Step 1.3 — Two tables and their migration

- [x] **Action.** `atlas-dictionary-suggestions.table.ts` and `atlas-dictionary-suggestion-events.table.ts` as in Design (the suggestions' `change_number` has no FK: phase 2 put the link on `atlas_dictionary_changes.suggestion_id`); export them; add them to `resetTables`; `npm run db:generate -- --name atlas_dictionary_suggestions`. Read the SQL.
- [x] **Verify.** `git ls-files -o backend/drizzle | grep -c "\.sql$"` prints `1`; `npm run db:migrate` applies it.

### Step 1.4 — The repository

- [x] **Action.** Port `domain/suggestions/suggestion-repository.ts` (`add`, `save(step, expectedVersion)`, `findById`, `list(filter)`, `events(id)`, `countWaitingNotSuggestedBy(accountId)`), the in-memory fake, and `infrastructure/drizzle-suggestion-repository.ts` with a `.db.test.ts`. Add `usageOf(slot, code)` to `SpecIdRepository`, its fake and adapter. A dictionary code is the same in the short and the long form (only markers differ, ADR 0025), so one comparison counts both; a capacity matches by its unit letter.
- [x] **Verify.** `npm test` (from the root, with `npm run db:up`) passes the new db tests.

### Step 1.5 — The use cases

- [x] **Action.** `suggest-dictionary-change.ts`, `edit-dictionary-suggestion.ts`, `withdraw-dictionary-suggestion.ts`, `list-dictionary-suggestions.ts`, `get-dictionary-suggestion.ts`, `count-waiting-suggestions.ts`, `get-dictionary-usage.ts`, with `suggestion.dto.ts` and `suggestion-context.ts`; tests in `dictionary-suggestions.test.ts`.
- [x] **Verify.** Unit tests pass, including: a suggestion changes nothing in `GET /dictionary`; a staff member's waiting count is 0; an admin's excludes their own.

### Step 1.6 — Contract, routes and wiring

- [x] **Action.** Types in `backend/src/contracts/atlas.ts`; request schemas; the session routes of Design's table (not approve and reject) in their own `DictionarySuggestionsController` and `createDictionarySuggestionsRouter`, mounted on `/atlas/dictionary` *(the Atlas controller already takes ten use cases)*, with an asker closure passing `{ id, isAdmin }`; wiring in `modules/atlas/index.ts`; HTTP tests in `presentation/dictionary-suggestions.routes.test.ts`; and `backend/src/atlas-dictionary.db.test.ts`, which phase 2 extends.
- [x] **Verify.** `npm run typecheck && npm run lint && npm run arch:check && npm run test:unit` exit 0.

### Step 1.7 — Docs, then the pull request

- [x] **Action.** `api.md` (the routes so far) and `data-model.md` (two tables; also fix `atlas_dictionary_values.slot`'s note, which lists 7 of the 13 slots). Mark ADR 0031 Accepted, ADR 0021 "Superseded by 0031", and both rows in `docs/decisions/README.md`. Open "Part of #95".
- [x] **Verify.** `npm run docs:check` passes; `npm run check:pr -- --body-file <file>` passes. Stop for the owner.

---

## Phase 2 — Approving and rejecting

### Step 2.1 — The rest of the tables

- [x] **Action.** `atlas-dictionary-changes.table.ts`; the renames and search words beside the values in `atlas-dictionary.table.ts`; `atlas_spec_id_changes.dictionary_change_number`. One migration: `npm run db:generate -- --name atlas_dictionary_changes`. Read the SQL: every change is additive. *As built:* no foreign key on the suggestions' `change_number`: with one each way, each table's type depends on the other's; `atlas_dictionary_changes.suggestion_id` holds it, unique.
- [x] **Verify.** `npm run db:migrate` applies it to a database holding phase 1's data.

### Step 2.2 — Tests leave the seeded dictionary as they found it

- [x] **Action.** The seed copies in `global-setup.ts` and their restore in `resetTables`, as in Design's Data section.
- [x] **Verify.** A db test approves a rename, the next test reads `APS` again, and `npm test` passes twice in a row.

### Step 2.3 — The dictionary reads its changes

- [x] **Action.** `Dictionary` gains its renames, its approved search words, `live` and the latest change; the mapper and `DrizzleDictionaryRepository.get` read them, for the live release only; the dictionary contract gains `change`. Tests first.
- [x] **Verify.** A test: after `(APS → APZ)`, `live('material', 'APS')` is `APZ`; a deleted code is `undefined`.

### Step 2.4 — Applying a proposal, pure

- [x] **Action.** `domain/suggestions/apply-proposal.ts`: `applyProposal(dictionary, suggestion): Dictionary` and `rewriteSpecId(saved, suggestion, nextDictionary)`. Tests first, one per kind, including a product type moved by a delete and a rule set to `never`.
- [x] **Verify.** Tests pass; a rules change from `applies` to `never` turns the field to `X`, and `never` to `applies` turns `X` to `Y`.

### Step 2.5 — The change store

- [x] **Action.** Port `domain/suggestions/dictionary-change-store.ts` (`apply(plan)`; *as built,* rejecting saves through the suggestion repository instead), the in-memory fake, and `infrastructure/drizzle-dictionary-change-store.ts` doing step 7 of Design's approval in one transaction under the advisory lock.
- [x] **Verify.** Tests: a rename of a code used by 3 saved Spec IDs rewrites all 3, each with a history entry carrying the change number and `version` + 1 (unit; 2 Spec IDs over Postgres); a db test: a Spec ID whose version moved on rolls back everything, the dictionary included.

### Step 2.6 — Approve and reject

- [x] **Action.** `approve-dictionary-suggestion.ts` and `reject-dictionary-suggestion.ts`, tests first, following Design's seven steps.
- [x] **Verify.** Tests: deciding your own answers `NOT_ALLOWED` (`OwnSuggestionError`); a clash answers `SPEC_IDS_WOULD_CLASH` with both codes and changes nothing; a stale suggestion answers `SUGGESTION_OUT_OF_DATE`; rejecting without a reason answers `VALIDATION_FAILED` on `reason`.

### Step 2.7 — The admin routes

- [x] **Action.** Approve and reject in `createDictionarySuggestionsAdminRouter`, mounted on `/atlas/dictionary` behind the admin gate; HTTP tests that a staff member gets 403 from the gate, and an admin deciding their own gets 403 with #95's copy.
- [x] **Verify.** HTTP tests pass.

### Step 2.8 — History names the change

- [x] **Action.** `SpecIdChangeRecord` and `GetSpecIdHistory` carry the change number and the suggester's and approver's names; the contract gains `dictionaryChange`.
- [x] **Verify.** A db test reads a rewritten Spec ID's history with both names.

### Step 2.9 — Composed over Postgres

- [x] **Action.** `backend/src/atlas-dictionary.db.test.ts`: through `composeApp`, a staff member suggests a new material, an admin approves it, and `GET /dictionary` answers it with `change.number` 1; then a rename of a used material rewrites the saved Spec IDs.
- [x] **Verify.** `npm test` passes.

### Step 2.10 — Docs, then the pull request

- [x] **Action.** `api.md` and `data-model.md`. Open "Part of #95".
- [x] **Verify.** `npm run docs:check` and `check:pr` pass. Stop for the owner.

---

## Phase 3 — Renames and search words in the reader

### Step 3.1 — Hardcoded codes follow renames

- [ ] **Action.** Every site in Design's list goes through `dictionary.live`. Pass the dictionary where a function lacks it (`size-rulings.ts`).
- [ ] **Verify.** `git grep -nE "'(RD|RC|CUP|BWL|TRY)'" -- backend/src/modules/atlas/domain ':!*.test.ts'` prints only the constant tables the `live` calls read; the reader's existing tests pass unchanged.

### Step 3.2 — Renamed codes in the reader's tests

- [ ] **Action.** Tests: after renaming `DW` to `DX`, "double wall cup" reads wall `DX`; after deleting `HD`, "half dome lid" leaves profile not known and reports the words as ignored; capacity "14oz" still reads after renaming `Z`.
- [ ] **Verify.** Tests pass.

### Step 3.3 — Approved search words are read

- [ ] **Action.** `readText` takes the approved words with the dictionary (`DictionaryRepository.get` returns them); they are matched as whole phrases for their slot, alongside `WORD_LIST` and `KEYWORDS`. `ReadSpecIdText` and `ImportVerifiedList` pass them.
- [ ] **Verify.** A test: with the approved word "sugarcane fibre" on a material, "sugarcane fibre bowl" reads that material; without it, it does not.

### Step 3.4 — Old codes after renames

- [ ] **Action.** A pasted S1 or long-form code with renamed letters still decodes, through `live`.
- [ ] **Verify.** A test decodes an S1 code whose product type was renamed.

### Step 3.5 — The pull request

- [ ] **Action.** Open "Part of #95".
- [ ] **Verify.** Checks pass. Stop for the owner.

---

## Phase 4 — The Dictionary changes page

### Step 4.1 — Gateway and hooks

- [ ] **Action.** Port methods, the HTTP adapter with tests, and hooks for the list, one suggestion, the waiting count, approve, reject and withdraw.
- [ ] **Verify.** Gateway tests pass.

### Step 4.2 — The nav badge

- [ ] **Action.** `NavItem.badge`; the Sidebar and BottomNav show the waiting count when above 0, as a `Badge` with an accessible label "{N} suggestions waiting".
- [ ] **Verify.** A test: an admin with 2 waiting sees "2"; staff see none.

### Step 4.3 — The page and its skeleton

- [ ] **Action.** `DictionaryChangesPage` (Waiting and History), `DictionaryChangesPageSkeleton`, the route, #95's empty states.
- [ ] **Verify.** Page tests: the suggester sees Edit and Withdraw; another admin sees Approve and Reject; the suggester-admin sees no Approve.

### Step 4.4 — A suggestion's card and trail

- [ ] **Action.** `SuggestionCard` (what, before and after, "Used by N saved Spec IDs", the codes it would rewrite) and `SuggestionTrail` (every event, with names, dates, the edit's before and after, the reason).
- [ ] **Verify.** Tests for each state's copy in #95's table.

### Step 4.5 — Approve and reject

- [ ] **Action.** Approve (sends `version`) and the `RejectForm` sheet; each 409 shows its message.
- [ ] **Verify.** Tests: "Change #N is live. K saved Spec IDs were updated."; a reject without a reason shows "Say why, so {name} knows what to change."

### Step 4.6 — Screenshots, then the pull request

- [ ] **Action.** Light, dark and phone screenshots with invented data, as #94 did. Open "Part of #95".
- [ ] **Verify.** Checks and `check:pr` pass. Stop for the owner.

---

## Phase 5 — Suggesting from the Dictionary sheet

### Step 5.1 — The suggestion form

- [ ] **Action.** `SuggestionForm`, one form whose fields follow the kind: code, wording, search words (one per line), the replacement for a delete in use, the 22 rules for a new product type (copied from a chosen product type) or a rules change. Every problem shows by its field. It also edits a waiting suggestion.
- [ ] **Verify.** Tests for each kind, the `RD` lock and the Used-by line.

### Step 5.2 — The sheet's buttons and header

- [ ] **Action.** `DictionarySheet` header copy from #95; Suggest an option per list, Suggest edit and Suggest delete per option, Suggest rule changes on the rules table; search words under each option.
- [ ] **Verify.** Tests: the header reads "S2, change 3, 27 October 2026." with a change, and "S2, approved 19 October 2026." without.

### Step 5.3 — Edit from the changes page

- [ ] **Action.** Edit on the suggester's waiting card opens the same form.
- [ ] **Verify.** A test: the edit is in the trail with before and after.

### Step 5.4 — History's line

- [ ] **Action.** The Spec ID History entry for a dictionary change, with its link.
- [ ] **Verify.** A test with #95's exact copy.

### Step 5.5 — Screenshots, then the pull request

- [ ] **Action.** Screenshots of each form. Open "Closes #95".
- [ ] **Verify.** Checks and `check:pr` pass. Stop for the owner.

### Step 5.6 — The staging check (reyxdz)

- [ ] **Action.** #95's staging check: as staff, suggest a material; as a second admin, see the badge and approve it; the sheet shows it and the change number; the trail names both.
- [ ] **Verify.** reyxdz confirms.

---

## Acceptance

- [ ] Every Verify item in #95 is checked.
- [ ] Nothing writes the dictionary tables except `DictionaryChangeStore.apply`.
  Verify: `git grep -nE "(insert|update|delete)\((atlasDictionaryValues|atlasSlotRules)" -- backend/src ':!*.test.ts'` prints only `drizzle-dictionary-change-store.ts`.
- [ ] ADR 0031 is Accepted, and ADR 0021 reads "Superseded by 0031".
- [ ] `api.md` and `data-model.md` describe every new route, table and column.

## Follow-ups

- Renaming `ACCOUNT_ADMIN_EMAILS` — ADR 0030; no issue yet
- Suggestions in bulk (several options in one approval) — not requested; no issue yet

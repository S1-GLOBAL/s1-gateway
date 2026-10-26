# 0021. The Atlas dictionary lives in Postgres and changes only by migration

- **Status:** Superseded by [0031](./0031-the-dictionary-is-edited-by-suggestion-and-approval.md):
  the dictionary is edited in the app, by suggestion and approval. Before that, partly superseded by [0022](./0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md):
  "or a saved Spec ID" no longer holds — saved Spec IDs can be changed, and every change is recorded;
  and by [0024](./0024-spec-ids-move-to-the-s2-format.md): one migration converts every saved code to S2
- **Date:** 2026-10-16
- **Related:** [Issue #4](https://github.com/S1-GLOBAL/s1-gateway/issues/4) ·
  [ADR 0005](./0005-migrations-over-db-push.md) ·
  [ADR 0019](./0019-the-s1-spec-id-format.md)

## Context

An S1 Spec ID means nothing without its dictionary: `BLD` is a bowl lid only
because release S1 0.1.0 says so. Codes are permanent once issued, and Step 2
decision D2-020 says a published meaning is never reassigned. So whatever
holds the dictionary must make an edit to a published value impossible by
accident, and must let a saved code name the release it was issued under.

## Decision

- The dictionary lives in three Postgres tables:
  `atlas_dictionary_releases`, `atlas_dictionary_values` and
  `atlas_slot_rules`.
- Its rows arrive only by migration. Release S1 0.1.0 is loaded by a
  hand-written migration, `seed_atlas_dictionary_s1_0_1_0`, holding plain
  `INSERT` statements.
- The API reads the dictionary and never writes it. No repository method,
  endpoint or later migration updates or deletes a dictionary value, a slot
  rule or a saved Spec ID.
- A new release is a new migration that adds rows under its own `release`
  key. Every saved Spec ID records the release it was issued under.

## Alternatives considered

**A constant in the code.** Simpler to read, but a saved Spec ID could not
reference the release it was issued under, and the dictionary would change
with any code change rather than only through a reviewed migration.

**A screen for editing the dictionary.** reyxdz decided on 2026-10-16 that the
dictionary changes only by migration; an editing screen would make
reassigning a published meaning one click away.

## Consequences

Changing the dictionary takes a migration, a pull request and reyxdz's merge,
which is the point. The tests must never empty the dictionary tables: the
migration fills them once, and `resetTables` in `backend/src/test/database.ts`
leaves them alone. Retiring a saved Spec ID, when it comes, needs its own
decision, because today nothing may delete one.

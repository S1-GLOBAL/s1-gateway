# 0012. Dictionary options are known by their number, not their letters

- **Status:** In progress
- **Owner:** reyxdz
- **Related:** [ADR 0032](../decisions/0032-spec-ids-are-written-tagged.md) ·
  [ADR 0031](../decisions/0031-the-dictionary-is-edited-by-suggestion-and-approval.md) ·
  [ADR 0025](../decisions/0025-spec-ids-are-written-short.md) ·
  [Plan 0011](./0011-tagged-spec-id-v2.md) · ADR 0033 (written in this plan)

## Goal

Since ADR 0032, nobody reads or types an option's letters: a Spec ID is
`A35B44-J240`, and the Dictionary shows `A35 Glove`. The letters (`GLV`, `HNI`)
are still each option's key, so a suggestion for a new option still asks for
three letters nobody will ever see, and a material's family is still read from
its first letter. At the end of this plan an option is its list and its number.
A new option needs a list, a wording and its search words, and nothing else.
The letters an option had before are kept only to read a dotted code given out
before ADR 0032.

## Decisions (reyxdz, 2026-10-30)

- **An option is its list and its number.** Every table that names an option
  names it by number: the Spec ID's fact columns, the product-type rules, the
  search words, suggestions, retired numbers.
- **Letters are an old name.** An option issued before this plan keeps its
  letters in `legacy_code`, read only for a dotted code (S1, `S2.` long, or
  short) and for History written before. A new option has none. No page shows
  them, no form asks for them, and no suggestion can change them.
- **A material's family is said, not spelled.** A material may be a grade of a
  broader one: recycled kraft of kraft, kraft of paper of grade not known
  (`B00`), PET of polymer of grade not known (`A00`). `broader_number` holds it.
  "Paper only" means paper of grade not known or a grade of it; a family fits
  its grades in the similar lookup, at any depth. A suggestion for a new
  material asks which material it is a grade of.
- **A capacity's stored value keeps its shape.** `Z0012` becomes `10012`: the
  unit's number, one digit (ADR 0032 already limits units to 9), then the
  amount. Every reader of the slot that takes its first character is unchanged.
- **The reader names options in code, by constant.** `options.ts` holds
  `PRODUCT_TYPE.glove = 35`, `MATERIAL.recycledKraft = 16` and the rest of the
  options the reader, importer and rules name. A test checks each constant's
  number against the migrated dictionary's wording, so a wrong number fails CI.
- **The glove and cup sleeve entries ship in a migration**, with fixed numbers,
  instead of being suggested on staging. The reader names them, so their
  numbers must be the same in every environment.

## Scope

**In scope**
- Migration 0020: options keyed by number, `legacy_code`, `broader_number`, the
  rules, search words, renames, retired numbers and suggestions moved to
  numbers, every saved Spec ID's fact columns rewritten, and the 8 entries of
  plan 0011's glove and cup sleeve table. Saved codes do not change.
- The domain, reader, importer, similar lookup, suggestions and API.
- The frontend: the Dictionary, the suggestion form, New Spec ID, Search.
- ADR 0033; `api.md`, `data-model.md`; plan 0011's note on the letters.

**Out of scope**
- Staging's library rebuild. It runs after this plan merges, as plan 0011's
  rollout says, with no dictionary step by hand.

## Phases

| Phase | What | Status |
|---|---|---|
| 1 | Migrations 0020 (columns) and 0021 (keys, families, the glove and cup sleeve options) and the Drizzle tables | Done |
| 2 | Domain: `Dictionary` by number, `options.ts`, families by `broader_number`, code and old codes | Done |
| 3 | Reader, importer and similar lookup on the constants | Done |
| 4 | Suggestions: no code to add or rename; a broader material to choose | Done |
| 5 | Contracts, API and frontend | Done |
| 6 | ADR 0033, reference docs, the rehearsal import on a fresh database | Done |

## Acceptance

- [x] No table holds an S2 option's letters except `legacy_code` (values and retired numbers) and `atlas_dictionary_renames`; `S1 0.1.0` keeps its letters
- [x] Every saved code and version is the same after migration 0021 as before it, and no History row is added (checked on a copy of the rehearsal library, 1,162 Spec IDs)
- [x] A dotted code given out before (S1, `S2.` long, short, an option renamed since) still finds its Spec ID
- [x] Suggesting a new option asks for no code; a new material asks which material it is a grade of
- [x] "Paper only" and the similar lookup's families read `broader_number`, not a letter
- [x] Glove is `A35` and Cup sleeve `A36` in every environment
- [x] Each constant in `options.ts` matches the dictionary's wording, in a test
- [x] The restructured list's rehearsal import gives the same 1,161 Spec IDs as plan 0011's: every code and name identical, on a fresh database
- [x] `npm run typecheck`, `lint`, `design:check`, `test:unit`, `docs:check`, `npm test` and `build` pass, and the backend's `arch:check`; the frontend's `arch:check` runs in CI, since a worktree's linked `node_modules` resolves outside it

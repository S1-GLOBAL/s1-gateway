# 0033. Dictionary options are known by their number, not their letters

- **Status:** Accepted
- **Date:** 2026-10-30
- **Related:** [Plan 0012](../plans/0012-options-by-number.md) ·
  [ADR 0032](./0032-spec-ids-are-written-tagged.md) ·
  [ADR 0031](./0031-the-dictionary-is-edited-by-suggestion-and-approval.md) ·
  [ADR 0026](./0026-raw-text-is-read-by-rules-and-a-public-word-list.md)

## Context

Since ADR 0032 a Spec ID is written with each option's number: `A35B44-J240`.
Nobody reads or types an option's letters (`GLV`, `HNI`) any more, but they
were still each option's key. A suggestion for a new option still asked for
three letters nobody would see, an edit could still rename them, and a
material's family was read from its first letter (`B` is paper), so a new
material's letters decided whether basis weight applied to it.

reyxdz ruled on 2026-10-30 that the letters go: an option is its list and its
number.

## Decision

- **An option's key is its number, as text.** In S2 an option whose number is
  16 is keyed `16` everywhere: the dictionary, the product-type rules, the
  search words, suggestions, and every saved Spec ID's slot columns. Markers
  stay `Y` and `X`. A capacity's slot is its unit's number, one digit, then its
  amount: `10012` is 12 oz.
- **A new option is numbered when it is approved,** with the next number in its
  list. A suggestion to add one names no key, so two waiting suggestions never
  claim one number. A number never changes: an edit changes only the wording and
  the search words, and a suggestion that gives a new code is refused.
- **The letters are an old name.** Each option issued before this decision
  keeps its letters in `legacy_code`, and a deleted one on its retired number,
  read only for a dotted code given out before ADR 0032 (S1, `S2.` long, or
  short), through any rename recorded then. No page shows them and no form asks
  for them. `S1 0.1.0` keeps its letters, as it always had.
- **A material says its family.** A material may be a grade of a broader one
  (`broader_number`): recycled kraft of kraft, kraft of paper of grade not
  known. "Paper only" means paper of grade not known or a grade of it, at any
  depth, and the similar lookup fits a family to every grade of it. Deleting a
  material makes its grades grades of what it was a grade of.
- **Code names an option by constant.** `domain/options.ts` names the options
  the reader, its word list and keywords, the importer and the rules single
  out (`PRODUCT_TYPE.glove`), and a test checks each against the dictionary's
  wording. An option added by suggestion is found by its search words.
- **Options the reader names ship by migration.** Glove, cup sleeve, nitrile,
  latex, vinyl, CPE, powder-free and powdered (plan 0011's table) are added by
  migration 0021 with fixed numbers, so `options.ts` is true in every
  environment, and the migration stops if a database holds other options there.
- **Migration 0021 rewrites keys, not codes.** Every saved code, its version
  and its History stay as they were.

## Alternatives considered

- **Keep the letters as a hidden key, and generate them for new options.** The
  form would stop asking, and nothing else would move. Rejected: every option
  would still have two names, a family would still be a letter, and a
  generated key would mean nothing to anyone reading the data or the code.
- **Keep the letters only in the code, as the reader's names.** The reader
  would name options by the letters a migration once gave them. Rejected: the
  reader would still speak a spelling the product dropped, and an option the
  reader needs that came after this decision would have no letters to be named
  by.
- **A fixed list of material families** (polymer, paper, molded fibre, metal…)
  instead of "a grade of". Rejected: kraft is a family inside paper, and the
  similar lookup and the reader already treat it as one; a fixed list would
  need a special case for it.
- **Add the glove and cup sleeve options by suggestion on staging.** Rejected:
  their numbers would depend on the order anyone approved anything, and the
  reader names them.

## Consequences

- A suggestion form asks only for what a person knows: the wording, the search
  words, and for a material what it is a grade of.
- Codes do not change, but every stored slot holding an option does: a tool
  reading the slot columns directly must read numbers.
- A dotted code still reads, through the old letters, for as long as
  `legacy_code` and the renames are kept.
- Code that singles out an option names a constant, so adding such an option
  is a migration and a line in `options.ts`, not a suggestion.
- A capacity unit's number is one digit, so a list has at most nine units; a
  suggestion for a tenth is refused.

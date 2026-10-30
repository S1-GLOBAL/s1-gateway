# 0032. Spec IDs are written tagged: a letter and a number for each known fact

- **Status:** Accepted; superseded in part by [0033](./0033-dictionary-options-are-known-by-number.md): slot columns hold each option's number, and no approval renames an option
- **Date:** 2026-10-29
- **Related:** [Plan 0011](../plans/0011-tagged-spec-id-v2.md) ·
  [ADR 0024](./0024-spec-ids-move-to-the-s2-format.md) ·
  [ADR 0025](./0025-spec-ids-are-written-short.md) ·
  [ADR 0031](./0031-the-dictionary-is-edited-by-suggestion-and-approval.md)

## Context

A short code (ADR 0025) still writes all 25 parts. A cup reads
`CUP.BCS.Y.WH.RD.X.Z0012.0090.Y.0110.X.X.X.Y.Y.Y.DW.02.X.X.X.X.X.X.X`: 67
characters, most of them `Y` and `X` for slots nobody knows or that the cup
never has. The letters of each option are also part of the code, so renaming an
option (ADR 0031) changes every code that holds it. A capacity could only be a
whole number, so a 3.25 oz portion cup could not be stored.

Plan 0011 tried a tagged spelling locally, with nothing saved. reyxdz ruled on
2026-10-29 that it replaces the dotted code: Atlas issues, stores, shows and
looks up the tagged code.

## Decision

- **A code is one letter per known fact, then its number.** Product type is
  `A` through window `X`, in slot order (plan 0011, "The letters"). The facts in
  words come first; then one hyphen and the sizes, capacity first. A slot not
  known, or that doesn't apply, is left out. The variant is never written. The
  cup is `A5B17D3E1Q2R3-G112H90J110`.
- **A dictionary option's number is its place in its list, in the order it was
  issued.** S2 0.1.0 is numbered in the order its seed issued it. A rename keeps
  the number; a new option takes the next one; a deleted option's number is kept
  in `atlas_dictionary_retired_numbers` and never given again. A capacity unit's
  number is the digit after `G`: `G112` is 12 oz.
- **A size's number is its amount** in the unit its slot stores: millimetres,
  tenths of a gram, gsm, micrometres, or a count.
- **A capacity may have up to 6 decimal places.** `G13.25` is 3.25 oz. Its slot
  holds `Z0003.25`, so the column widens to 12 characters.
- **Letters may be typed in any order and either case.** What is stored is
  always the standard order.
- **Every code given out before still reads**: dotted, `S2.` or `S1.`, in the
  option's letters then or now. Migration `0019_write_atlas_codes_tagged` writes
  every saved code and every History code tagged once, with no change of facts
  and no History entry.
- **Bowl with bowl lid, cup with cup lid and portion cup with portion cup lid**
  join the product types as A32 to A34, by migration, after the seed, so no
  earlier number moves.
- **Slot columns keep their values** (`BCS`, `Z0012`, `Y`, `X`). They are the
  facts; the code is written from them.
- **An approval that renames an option, or refits a marker, without changing a
  code reletters the Spec IDs that hold it.** Their columns change, but their
  version does not, and History gains nothing, because nothing a person reads
  has changed. An approval that changes a code rewrites it as before, with a
  History entry.

## Alternatives considered

- **Keep the dotted code, and show the tagged one beside it.** This would need
  no migration. Rejected by reyxdz: two spellings of one product would both be
  given out, and every lookup and comparison would handle both forever. ADR
  0024 rejected this for S1 and S2 for the same reason.
- **Store the tagged code only, without the slot columns.** Rejected: the
  similar lookup, a dictionary option's usage, and the approval rewrite all
  query slot by slot.
- **Number options alphabetically by their letters.** Rejected: a new option
  would renumber everything after it, and so change saved codes.
- **Accept centimetres and inches only from the text reader.** The form still
  accepts them and converts them, rounding half up, exactly as the reader
  does. Refusing them in the form would only move that arithmetic to the person
  typing.

## Consequences

- Codes are about a third as long: the cup goes from 67 characters to 25.
- A rename no longer changes any code, and an option's number never changes.
- A code no longer says which slots are not known and which don't apply. Both
  are left out; the product type decides which one it is.
- The dictionary carries one more column and one more table. Every writer of an
  option must give it a number, and the change store writes the retired numbers
  whole, as it writes renames.
- During the minute or two of a deploy, the older API may save a dotted code.
  It shows in today's spelling, because the code shown is written from the slot
  columns, and a second save of the same facts is refused. Looking it up by its
  code finds it only after it is next saved.
- Search reads raw text as it is typed, from two characters, so the API reads
  the dictionary far more often. The API keeps the live dictionary in memory
  and asks the database only for the latest approved change, one row, reading
  the whole release again when that has moved. A request for text since
  changed is stopped in the browser.
- The three combined product types arrived by migration, not by suggestion and
  approval (ADR 0031). Where an option with their letters already existed, the
  migration left it alone and numbered it after the others.

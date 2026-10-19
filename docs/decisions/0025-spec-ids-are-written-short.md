# 0025. Spec IDs are written short: one letter for an empty slot, and no format tag

- **Status:** Accepted
- **Date:** 2026-10-20
- **Related:** [Issue #36](https://github.com/S1-GLOBAL/s1-gateway/issues/36) ·
  [ADR 0019](./0019-the-s1-spec-id-format.md) ·
  [ADR 0024](./0024-spec-ids-move-to-the-s2-format.md) ·
  [Plan 0006](../plans/0006-s2-spec-ids-and-verified-list-import.md)

## Context

An S2 code (ADR 0024) is always 97 characters: every slot is padded to its
width, so a slot that is not known is written as zeros (`0000`) and one that
doesn't apply as X's (`XXXX`), and every code starts with the tag `S2.`. Most of
a typical code is padding. A cup reads
`S2.CUP.BCS.00.WH.RD.XX.Z0012.0090.0000.0110.XXXX.XXXX.XXXX.0000.000.000.DW.02.XX.X.XX.XX.XX.XX.XX`,
which staff could not read out, compare or remember. reyxdz raised it on
2026-10-19 while preparing an Atlas demo, before the verified list is imported
(issue #28, PR 3), so that the import creates short codes from the start. Atlas
had not reached production: long codes existed only on staging.

## Decision

- A slot that is not known is written `Y`; one that doesn't apply, `X`. One
  letter, whatever the slot's width. A part that is exactly `Y` or `X` is the
  marker, so no dictionary value may be a bare `Y` or `X`.
- A known value keeps its width (`0045`, `Z0012`, `03`, `DW`), as ADR 0019 has it.
- The format tag goes. A code is 25 parts, product type first, in S2's order;
  the same cup reads `CUP.BCS.Y.WH.RD.X.Z0012.0090.Y.0110.X.X.X.Y.Y.Y.DW.02.X.X.X.X.X.X.X`
  (67 characters, at most 94).
- The fixed 97-character length goes; the part count, 25, is the check.
- Codes given out before are still read wherever a code is read, and become
  the short code with the same facts: a code starting `S1.` (converted as ADR
  0024 says, then shortened) or `S2.` (its tag dropped, its markers made one
  letter). A marker written wide in any code (`0000`, `XX`) is read as its
  letter. New codes are always short.
- Migration `0012_shorten_atlas_codes` converts every saved code, its slot
  columns and every History code once, with no change of facts and no History
  entry. During a deploy the older API may save a long code for a minute or
  two: it is read in the short form, and lookups match it in either form.
- The Dictionary's "Which slots apply" table writes "Applies" where it wrote
  "Yes", so a code's `Y` is not read as "yes".

## Alternatives considered

- **Keep the long form.** Every code stays 97 characters and lines up in a
  column, and a dropped character changes the length. Rejected: people, not
  programs, read these codes, and the padding is most of what they read.
- **Keep the `S2.` tag, or call the short form S3.** A tag names the layout, so
  a later change could announce itself. Rejected (reyxdz): it only makes codes
  longer. An old code still says what it is (`S1.` or `S2.`), no product type
  is called S1 or S2, and a short code has 25 parts where the others have 18
  and 26.
- **Also drop the leading zeros of known numbers** (`0045` → `45`, the cup at
  63 characters). Rejected (reyxdz): known values keep their width and read as
  they do now.

## Consequences

- Codes are 51–94 characters instead of 97, and an empty slot is one letter.
- Codes no longer line up character by character; positions are counted by
  part, not by character.
- A dropped character inside a value is still refused by the value's width,
  but a code's length no longer says anything.
- If the layout ever changes again, the new codes need another way to say so:
  a different part count, or a tag again.
- Every code given out before keeps finding its product, through the
  conversion on read and the migration.
- The older API, during the minute or two of a deploy, does not understand
  short codes: it may show their empty slots wrongly. What it saves is kept,
  in the long form, and read in the short form afterwards.

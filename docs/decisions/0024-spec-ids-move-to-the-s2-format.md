# 0024. Spec IDs move to the S2 format

- **Status:** Accepted; partly superseded by [0025](./0025-spec-ids-are-written-short.md): new codes have no
  `S2.` tag and no fixed length, 25 parts with an empty slot written `Y` or `X`
- **Date:** 2026-10-19
- **Related:** [Issue #28](https://github.com/S1-GLOBAL/s1-gateway/issues/28) ·
  [Plan 0006](../plans/0006-s2-spec-ids-and-verified-list-import.md) ·
  [ADR 0019](./0019-the-s1-spec-id-format.md) ·
  [ADR 0021](./0021-the-atlas-dictionary-changes-only-by-migration.md) ·
  [ADR 0022](./0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md)

## Context

The S1 format (ADR 0019) has 18 slots. Source One's verified list, the
workbook the team treats as its source of truth, records facts S1 has no slot
for: how many colours a product is printed in, how many compartments and plies
it has, its wall, its lid opening, its handle, whether each piece is wrapped,
and whether it has a window. A fact without a slot cannot reach the code, so
two products that differ only in one of them would share a code. reyxdz ruled
on 2026-10-19 that one different fact means a different code, and that print
counts (the number of colours, not a client's artwork).

The S1 dictionary, release S1 0.1.0, also holds only 4 product types and
4 materials. The verified list holds 31 product types and 30 materials.

## Decision

- **S2 adds eight slots before the variant number:** Wall (2), Print (2),
  Compartments (2), Plies (1), Lid opening (2), Handle (2), Individual wrap (2)
  and Window (2). Slots 1–17 keep their S1 positions and widths, and the format
  version reads `S2`. Every code is 26 slots and 97 characters:
  `S2.TYP.MAT.CO.CL.SH.PR.CAPAC.TOPD.BOTD.HGHT.LENG.WIDT.GUSS.WGHT.GSM.THK.WL.PT.CM.P.LO.HD.WR.WN.VN`.
- **Compartments and plies are counts:** a whole number padded to the slot,
  1–12 and 1–4. The others are dictionary codes. The markers keep their S1
  meanings: all `0` is not known, all `X` doesn't apply, and no code contains
  either inside it, so wax coating is `WC` and wax paper `BWP`.
- **Release S2 0.1.0** holds #28's product types, materials and codes, and its
  table of which slots apply to each product type, using only `applies` and
  `never` for the eight added slots. S1 0.1.0 stays in the database unchanged.
- **Every saved code is converted once, by migration**, with its added slots
  `0` where S2 0.1.0 applies them to its product type and `X` where it doesn't.
  Every code in History is converted the same way. Facts do not change, so the
  conversion writes no History entry. S1 had four product types, so the
  conversion is a fixed table.
- **S1 codes stay readable and are never issued.** A pasted, decoded or looked-up
  S1 code is read as the S2 code it converts to. A row an older API saves while
  a deploy is under way is read the same way, and a code is matched in either
  form, so nothing saved in that window is lost or duplicated.
- **Unlabelled supplier sizes** are read by ADR 0019's rulings R1–R4, extended:
  R1 covers cups, bowls and portion cups as well as lids; R1b reads
  `A Dia x B` as rim × height; R5 reads a bag's `A x B x C`, B the smallest, as
  width × gusset × height; R6 reads a box's or tray's `A x B x C` as
  length × width × height. Each value read under a ruling is flagged.

This partly supersedes ADR 0019, whose layout, 18 slots and 74-character
length no longer hold for new codes, and ADR 0021, whose "no later migration
updates … a saved Spec ID" no longer holds for this one conversion.

## Alternatives considered

- **Product-type splits** ("Paper cup, 1-colour print", "Paper cup, double
  wall"). Rejected by reyxdz on 2026-10-19: they multiply every product type by
  every feature, and cannot hold a count such as compartments.
- **The variant number** for whatever the slots cannot say. Rejected the same
  day: the code would differ, but would not say what differs.
- **Keeping S1 codes as they are and issuing S2 only for new ones.** Rejected:
  two formats in the library would make every comparison, lookup and duplicate
  check handle both forever.

## Consequences

- Codes are longer: 97 characters instead of 74.
- Every reader of slots 1–17 keeps working; anything that counted 18 slots
  or 74 characters changes once.
- `atlas_spec_ids` gains eight columns; they are null only on a row an older API
  saved during a deploy.
- A new slot later means S3 and another conversion. Facts that differ in ways no
  slot holds still fall to the variant number.

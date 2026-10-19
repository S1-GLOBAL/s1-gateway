# 0019. The S1 Spec ID format

- **Status:** Accepted; partly superseded by [0022](./0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md):
  "A code is permanent once issued" no longer holds for saved Spec IDs, whose code follows their facts;
  and by [0024](./0024-spec-ids-move-to-the-s2-format.md): the layout, 18 slots and 74 characters hold only
  for S1 codes given out before S2; and by
  [0025](./0025-spec-ids-are-written-short.md): new codes are 25 parts with no format tag, and an empty slot is one letter, `Y` or `X`
- **Date:** 2026-10-16
- **Related:** [Issue #4](https://github.com/S1-GLOBAL/s1-gateway/issues/4) ·
  [Plan 0003](../plans/0003-atlas-spec-ids.md) ·
  [ADR 0020](./0020-atlas-is-built-in-typescript-in-the-gateway.md) ·
  [ADR 0021](./0021-the-atlas-dictionary-changes-only-by-migration.md)

## Context

Source One identifies products only by free-text names, so the same lid
appears under several spellings and nobody can tell reliably whether two
quotes are for the same product. The S1 Spec ID is a fixed-length,
74-character code that describes what a product physically is. Every code has
the same 18 slots in the same order, and every code is unique. One Spec ID can
be shared by several factories that make the same product.

reyxdz wrote and approved the S1 specification on 2026-10-16. This record
carries its rules into the repository. The specification's worked examples,
and its notes on the source workbook, stay out: they quote workbook rows,
supplier item names and prices, and this repository is public
([constraints](../explanation/constraints.md), section 6).

## Decision

### The layout

Every code is 18 slots separated by dots, always in this order. Slot contents
total 57 characters; with 17 dots, every code is 74 characters long.

| # | Slot | Width | Holds |
|---|---|---|---|
| 1 | Format version | 2 | `S1` |
| 2 | Product type | 3 | A product type code |
| 3 | Material | 3 | Material family (1) + grade (2) |
| 4 | Coating | 2 | A coating code |
| 5 | Colour / clarity | 2 | A colour or clarity code |
| 6 | Shape | 2 | A shape code |
| 7 | Profile | 2 | A lid profile code |
| 8 | Nominal capacity | 5 | Unit letter + 4 digits |
| 9 | Top diameter | 4 | Whole mm |
| 10 | Bottom diameter | 4 | Whole mm |
| 11 | Height | 4 | Whole mm |
| 12 | Length | 4 | Whole mm |
| 13 | Width | 4 | Whole mm |
| 14 | Gusset | 4 | Whole mm |
| 15 | Unit weight | 4 | Tenths of a gram |
| 16 | Basis weight | 3 | Whole gsm |
| 17 | Thickness | 3 | Whole µm |
| 18 | Variant number | 2 | Registry-assigned number |

Pattern: `S1.TYP.MAT.CO.CL.SH.PR.CAPAC.TOPD.BOTD.HGHT.LENG.WIDT.GUSS.WGHT.GSM.THK.VN`

An illustrative code, a clear PS round dome bowl lid with a 90 mm rim, height
not known, weighing 3.3 g:
`S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX`.

### The two markers

A slot filled entirely with `0` means **not known**. A slot filled entirely
with `X` means **doesn't apply** to this product.

| Marker | Meaning | Examples |
|---|---|---|
| `0` fill | The product has this property, but no source states it | `0000` height of a dome lid; `00` unknown coating; `00000` unknown capacity |
| `X` fill | This product never has this property | `XXXXX` capacity of a lid; `XXXX` gusset of a round bowl; `XX` no variant |

- A marker always fills the whole slot. Partial fills such as `0X` or `X9` are
  invalid.
- An all-zero slot can only mean "not known". No real dimension, weight or
  thickness is zero, so `0090` (90 mm, padded) and `0000` (unknown) cannot be
  confused.
- No dictionary value may be all `0` or all `X`.
- Whether a slot is `X` is fixed by the dictionary's applicability table, never
  decided product by product.
- The variant slot is never `00`. A variant is either assigned (`01`, `02` …)
  or not needed (`XX`).
- The retired A1 format used the opposite convention (`X` = unknown). The two
  must never be mixed.

### The first dictionary release: S1 0.1.0

| Slot | Code | Meaning |
|---|---|---|
| Product type | `BLD` | Bowl lid |
| Product type | `CLD` | Cup lid |
| Product type | `BWL` | Bowl |
| Product type | `SUP` | Stand-up pouch |
| Material | `APS` | Polymer, PS (polystyrene) |
| Material | `APT` | Polymer, PET |
| Material | `B00` | Paper and paperboard, grade not known |
| Material | `BKR` | Paper and paperboard, kraft |
| Coating | `NC` | No coating, as stated by the source |
| Coating | `PI` / `PO` / `PB` | PE inside only / outside only / both sides |
| Colour / clarity | `CL` / `TL` / `WH` / `BR` | Clear / translucent / white / brown |
| Shape | `RD` / `SQ` / `RC` / `OV` | Round / square / rectangular / oval |
| Profile | `DM` / `HD` / `FL` | Dome / half dome / flat |
| Capacity unit | `Z` | Ounces, nominal trade size |
| Capacity unit | `M` / `S` / `N` / `G` | Millilitres / servings / count / grams |

Material reuses the family and grade tokens curated in the Atlas A1
dictionary. Laminate materials (`J01`…) are reserved for registered layer
structures; none is registered in S1 0.1.0. A material not yet in the
dictionary is coded `000` until its entry is added. Capacity uses `Z` for
ounces, not `O`, so it cannot be misread as zero.

### Which slots apply

The dictionary fixes which slots apply to each product type, so `X` is never a
judgement call. "Yes" means a value or `0`; "X" means always `X`.

| Slot | Bowl lid `BLD` | Cup lid `CLD` | Bowl `BWL` | Stand-up pouch `SUP` |
|---|---|---|---|---|
| Coating, colour / clarity | Yes | Yes | Yes | Yes |
| Shape | Yes | Yes | Yes | X |
| Profile | Yes | Yes | X | X |
| Nominal capacity | X (lids record compatibility instead) | X | Yes | Yes |
| Top diameter | Round only | Round only | Round only | X |
| Bottom diameter | X | X | Round only | X |
| Height | Yes | Yes | Yes | Yes |
| Length, width | Non-round only | Non-round only | Non-round only | Width: yes; length: X |
| Gusset | X | X | X | Yes |
| Unit weight, thickness | Yes | Yes | Yes | Yes |
| Basis weight | Paper family only | Paper family only | Paper family only | Yes |
| Variant number | Always present: `XX` or a number | Same | Same | Same |

- "Round only" and "Non-round only" follow the shape slot (round is `RD`). If
  the shape is not known, all of those slots are `0`, not `X`.
- "Paper family only" follows the material slot (the paper family is `B`). If
  the material is not known, basis weight is `000`, not `XXX`.

Two rulings by reyxdz on 2026-10-16 make these exact:

- While the shape or the material is not known, the slots that follow it must
  be all `0`. A known value there is refused, not only `X`.
- Product type is never `000`: it decides which slots apply.

### Measurement, units and rounding

The code holds nominal values at fixed precision; the supplier's exact
original values always stay on the product record.

| Slot | Unit in the code | Precision | Range | Example |
|---|---|---|---|---|
| Dimensions (slots 9–14) | mm | Whole mm | 1–9,999 | 90 mm → `0090` |
| Unit weight | g | Tenths of a gram | 0.1–999.9 | 3.3 g → `0033`; 4 g → `0040` |
| Basis weight | gsm | Whole gsm | 1–999 | 250 gsm → `250` |
| Thickness | µm | Whole µm | 1–999 | 60 µm → `060` |
| Nominal capacity | As traded | Whole units | 1–9,999 | 6 oz → `Z0006`; 500 mL → `M0500` |

1. **Convert exactly, then round half up.** Inches convert exactly to mm
   first, then round: 1.375 in = 34.925 mm → `0035`.
2. **Capacity is the nominal trade size, never a measured volume.** "6oz" is
   coded `Z0006`. A factory's measured brimful volume stays on that factory's
   product record.
3. **Capacity units are never converted into each other.** 16 oz and 500 mL
   are different codes. Treating them as the same size is a reviewer's
   judgement, not arithmetic.
4. **Ranges and tolerances are not coded.** The code holds the nominal value;
   "90 ± 1 mm" is recorded on the product record.
5. **Out-of-range values need a dictionary decision.** A product over 999.9 g
   or 9,999 mm cannot be coded until the dictionary adds a rule.

The arithmetic uses whole numbers only, never floating point: a value is read
as a decimal string with at most 6 decimal places, multiplied by an exact
factor (1 in = 254/10 mm, 1 cm = 10 mm), and rounded half up. The range is
checked after rounding, so 0.04 g, which rounds to `0000`, is refused rather
than read as "not known".

### Rulings for unlabelled dimensions and trade names

Four rulings decide how unlabelled numbers and trade names are read. Each
applies only to its exact pattern; anything else is coded `0` and sent to a
reviewer. They govern reading supplier data, which this repository does not
do yet.

| # | Pattern | Read as | Check that must pass |
|---|---|---|---|
| R1 | One unlabelled number on a lid, e.g. `90` | Round rim diameter (top diameter), shape `RD` | Exactly one number |
| R2 | `A dia x B x C` on a round container | Top diameter × bottom diameter × height | Three numbers, "dia" on the first, and B smaller than A |
| R3 | `A x B x C` on a pouch | Width × height × gusset | Three numbers, and C is the smallest |
| R4 | A trade name in an item name, e.g. Mylar | Kept as text; never turned into a slot value | None |

- A value set by R1, R2 or R3 is marked on the product record as interpreted
  under that ruling, not stated by the supplier. A supplier statement to the
  contrary is corrected through the normal clarification step.
- A matching diameter never means a lid fits a container. Fit is recorded only
  when someone confirms it.
- Under R4, a material that is only implied by a trade name stays `000` until
  the supplier states it. Sourcing then asks the supplier for the layer
  structure. ("Mylar" bags can be metallised PET, PET / foil / PE or other
  structures.)

### Uniqueness, collisions and the variant number

One set of known facts always produces exactly one code, and a reviewer
resolves every case where a new product would produce an existing code:

1. A code is built for a new product. If it does not exist yet, issue it.
2. If it exists and it is the same physical product, reuse the code and link
   the new supplier product.
3. If it is a different product and a slot can hold the difference, set that
   slot (adding a new dictionary value if needed) and check again.
4. Only if no slot can hold the difference, assign the next variant number.

A difference that a slot can hold always goes into that slot; the variant
number is only for what no slot can express.

- It is the last resort. A recurring difference gets a dictionary value in an
  existing slot first (a new profile, coating or colour code).
- It is assigned by the registry only when two different products would
  otherwise share a code. Most codes end in `XX`.
- Each number is recorded in the dictionary with its meaning, the code it
  extends and the date. A number is never reused or reassigned.
- Numbers count up per base code: the first variant of a code is `01`, the
  next `02`.

Two products whose known facts are identical, but which may differ in unknown
ones, share a code until clarified. Atlas flags them as possible duplicates for
review rather than splitting them on a guess. The first Atlas build issues no
variant numbers: every code ends in `XX`, and the collision review is a later
issue.

### What stays out of the Spec ID

The Spec ID holds only what the product physically is. Everything else lives
on linked records, so the code never changes when a quote, factory or case
size does.

| Information | Where it lives |
|---|---|
| Factory, supplier SKU, supplier's item name | Supplier product record |
| Case packing and case dimensions | Offer (quote) record, dated |
| Prices | Offer (quote) record, dated |
| Mold cost and lead times | Offer (quote) record, dated |
| Compatibility (which cups a lid fits) | Compatibility record, confirmed by a person |
| Measured values, such as brimful volume | That factory's product record |
| Trade names and use words | Original item name, kept as text |
| Mass-production status | Planned for the hub, outside this specification |

This follows the original brief ("Price is never in the code") and Step 2
decision D2-004 ("Packing belongs beneath the product spec").

## Alternatives considered

**The A1 grammar** (Step 3, Document 2): five core blocks plus a
variable-length `+` tail, with `X` meaning unknown. S1 replaces only that code
grammar; every other Step 1–3 decision stands. Under A1, two lids that differ
only in profile could not be told apart by code. Two of its decisions are
replaced with it:

- **D3-003, optional layers:** layer stacks now become registered laminate
  materials (`J01`…) instead of a variable layer section.
- **D3-004, compact measurements:** values are now padded to fixed widths,
  with an implied decimal for unit weight.

Kept unchanged: codes decodable through a versioned dictionary (D2-005);
published meanings never reused (D2-020); printing in customization records,
not the code (D3-002); no combined Spec ID for kits (D3-001); never guessing,
the three search outcomes, and per-factory evidence.

## Consequences

A code is permanent once issued, and a published meaning is never reassigned,
so a mistake in the dictionary is corrected by a new value in a new release,
never by editing an old one ([ADR 0021](./0021-the-atlas-dictionary-changes-only-by-migration.md)).
A new product type needs a dictionary release with its applicability rows
before anything of that type can be coded. A product outside a slot's range
cannot be coded until the dictionary adds a rule.

The specification document stays the owner's working copy, with its worked
examples; this record is the repository's copy of its rules. Still open, and
outside the first Atlas build: mapping the rest of the source workbook,
assigning new dictionary values and variant numbers when several people issue
codes, and registering laminate structures.

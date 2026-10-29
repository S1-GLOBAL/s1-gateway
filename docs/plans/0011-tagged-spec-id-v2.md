# 0011. Tagged Spec ID, the V2 spelling

- **Status:** In progress
- **Owner:** reyxdz
- **Related:** [0003](./0003-atlas-spec-ids.md), [0006](./0006-s2-spec-ids-and-verified-list-import.md), [0007](./0007-search-atlas-with-raw-product-text.md) · [ADR 0032](../decisions/0032-spec-ids-are-written-tagged.md)

## Goal

A shorter spelling of the same Spec ID facts. It leaves out empty slots, uses one letter per fact, and numbers each dictionary value in the order it was issued. It was first tried locally (commit `5ac0a39`, nothing saved). reyxdz ruled on 2026-10-29 that it replaces the dotted code: Atlas issues, stores, shows and looks up this spelling ([ADR 0032](../decisions/0032-spec-ids-are-written-tagged.md)).

## Progress

| Phase | Steps | Status |
|---|---|---|
| 1. Local trial | — | Done, on `feat/tagged-spec-id-trial`; superseded by phase 2 |
| 2. Atlas issues the tagged code | Numbers in the dictionary; the code, the reader and the live check in the domain; migration 0019 of every saved and History code; the API's `part`, `number` and `notes`; the pages | On `feat/tagged-spec-id-v2`, in review |

## How a code is built

Known facts are written in slot order. A slot that is not known, or that does not apply, is left out. There is no `X` and no `Y`.

A code can be typed in any order and any case. What is stored is always the standard order. `code` and `body` are the same string. There is no check character. Variant is never written.

The letters before the hyphen are the named facts: product type through profile, then wall, print, compartments, plies, lid opening, handle, wrap, and window.

One hyphen follows, and only when there is a capacity or a measurement. After the hyphen, in this order: capacity, top diameter, bottom diameter, height, length, width, gusset, unit weight, basis weight, thickness.

A dictionary value is the letter plus its issuance number. `A5` is the fifth product type, Cup. `B17` is the seventeenth material, cup stock. A measurement is the letter plus the number in that slot's unit. `H90` is a top diameter of 90 mm.

The issued cup

`CUP.BCS.Y.WH.RD.X.Z0012.0090.Y.0110.X.X.X.Y.Y.Y.DW.02.X.X.X.X.X.X.X`

is 67 characters. In V2 it is

`A5B17D3E1Q2R3-G112H90J110`

which reads: Cup, paper cup stock, White, Round, double wall, 2 colours, 12 oz, top diameter 90 mm, height 110 mm. Coating, profile, and the other sizes were empty, so they are not in the code.

Atlas stores and shows only this spelling. A dotted code that Atlas already issued (`S1.` or `S2.`, or a dot that is not between two digits) is still accepted and rewritten into this spelling. A single dot between digits is a decimal capacity, as in `G13.25`.

## The letters

| Letter | Fact | What the number is |
|---|---|---|
| A | Product type | Issuance number |
| B | Material | Issuance number |
| C | Coating | Issuance number |
| D | Colour / clarity | Issuance number |
| E | Shape | Issuance number |
| F | Profile | Issuance number |
| G | Nominal capacity | Unit digit, then the amount |
| H | Top diameter | Millimetres |
| I | Bottom diameter | Millimetres |
| J | Height | Millimetres |
| K | Length | Millimetres |
| L | Width | Millimetres |
| M | Gusset | Millimetres |
| N | Unit weight | Tenths of a gram. 3.3 g is `N33` |
| O | Basis weight | gsm |
| P | Thickness | Micrometres. 350 µm is `P350` |
| Q | Wall | Issuance number |
| R | Print | Issuance number |
| S | Compartments | The count, 1 to 12 |
| T | Plies | The count, 1 to 4 |
| U | Lid opening | Issuance number |
| V | Handle | Issuance number |
| W | Individual wrap | Issuance number |
| X | Window | Issuance number |

Numbers follow S2 0.1.0 issuance order. A value added later takes the next number. The three combined product types were added after that list, so they are A32, A33, and A34, and nothing earlier moved. They are not in the S2 seed; migration 0019 adds them to S2 0.1.0.

### A — Product type

| Code | Meaning | Old |
|---|---|---|
| A1 | Bowl lid | BLD |
| A2 | Cup lid | CLD |
| A3 | Bowl | BWL |
| A4 | Stand-up pouch | SUP |
| A5 | Cup | CUP |
| A6 | Portion cup | PCP |
| A7 | Portion cup lid | PCL |
| A8 | Container | CTN |
| A9 | Container lid | CTL |
| A10 | Container with lid | CWL |
| A11 | Hinged container (clamshell) | HCT |
| A12 | Takeout box | TKB |
| A13 | Fry carton | FRC |
| A14 | Folding carton | FCB |
| A15 | Shipping box (RSC) | RSC |
| A16 | Bag | BAG |
| A17 | Napkin | NPK |
| A18 | Wrap or sheet | WRP |
| A19 | Film or roll | FLM |
| A20 | Plate | PLT |
| A21 | Tray | TRY |
| A22 | Pan | PAN |
| A23 | Cup carrier | CCR |
| A24 | Straw | STW |
| A25 | Stirrer | STR |
| A26 | Fork | FRK |
| A27 | Knife | KNF |
| A28 | Spoon | SPN |
| A29 | Cutlery kit | CKT |
| A30 | Sachet | SCH |
| A31 | Label | LBL |
| A32 | Bowl with Bowl Lid | BWB |
| A33 | Cup with Cup Lid | CWC |
| A34 | Portion cup with Portion cup lid | PWC |

### B — Material

| Code | Meaning | Old |
|---|---|---|
| B1 | Polymer, PET | APT |
| B2 | Polymer, rPET | ARP |
| B3 | Polymer, PP | APP |
| B4 | Polymer, PS (polystyrene) | APS |
| B5 | Polymer, EPS foam | AEP |
| B6 | Polymer, HDPE | AHD |
| B7 | Polymer, LDPE | ALD |
| B8 | Polymer, LLDPE | ALL |
| B9 | Polymer, PLA | APL |
| B10 | Polymer, PSM (starch blend) | APM |
| B11 | Polymer, grade not known | A00 |
| B12 | Paper and paperboard, kraft | BKR |
| B13 | Paper and paperboard, brown kraft | BKB |
| B14 | Paper and paperboard, white kraft | BKW |
| B15 | Paper and paperboard, virgin kraft | BKV |
| B16 | Paper and paperboard, recycled kraft | BKC |
| B17 | Paper and paperboard, cup stock | BCS |
| B18 | Paper and paperboard, SBS | BSB |
| B19 | Paper and paperboard, corrugated | BCB |
| B20 | Paper and paperboard, greaseproof | BGP |
| B21 | Paper and paperboard, tissue | BTS |
| B22 | Paper and paperboard, wax paper | BWP |
| B23 | Paper and paperboard, semi-gloss | BSG |
| B24 | Paper and paperboard, grade not known | B00 |
| B25 | Molded fibre, bagasse | CBG |
| B26 | Molded fibre, bamboo | CBM |
| B27 | Molded fibre, grass | CGR |
| B28 | Molded fibre, seaweed | CSW |
| B29 | Molded fibre, grade not known | C00 |
| B30 | Metal, aluminium | DAL |
| B31 | Metal, grade not known | D00 |
| B32 | Wood, birch / hardwood | FBW |
| B33 | Elastomer, silicone | HSI |
| B34 | Laminate, paper / polymer | JPP |

### C — Coating

| Code | Meaning | Old |
|---|---|---|
| C1 | No coating, as stated by the source | NC |
| C2 | PE inside only | PI |
| C3 | PE outside only | PO |
| C4 | PE both sides | PB |
| C5 | PE, side not stated | PU |
| C6 | PLA lined | PL |
| C7 | CPET coated | CP |
| C8 | Grease-resistant coating | GR |
| C9 | Wax coated | WC |
| C10 | Film laminated | LM |
| C11 | Silicone coated | SC |

### D — Colour / clarity

| Code | Meaning | Old |
|---|---|---|
| D1 | Clear | CL |
| D2 | Translucent | TL |
| D3 | White | WH |
| D4 | Brown | BR |
| D5 | Black | BK |

### E — Shape

| Code | Meaning | Old |
|---|---|---|
| E1 | Round | RD |
| E2 | Square | SQ |
| E3 | Rectangular | RC |
| E4 | Oval | OV |

### F — Profile

| Code | Meaning | Old |
|---|---|---|
| F1 | Dome | DM |
| F2 | Half dome | HD |
| F3 | Flat | FL |

### Q — Wall

| Code | Meaning | Old |
|---|---|---|
| Q1 | Single wall | SW |
| Q2 | Double wall | DW |
| Q3 | Ripple wall | RW |

### R — Print

| Code | Meaning | Old |
|---|---|---|
| R1 | No print | NP |
| R2 | 1 colour | 01 |
| R3 | 2 colours | 02 |
| R4 | 3 colours | 03 |
| R5 | 4 colours | 04 |
| R6 | 5 colours | 05 |
| R7 | 6 colours | 06 |
| R8 | 7 colours | 07 |
| R9 | 8 colours | 08 |
| R10 | Full colour | FC |

### U — Lid opening

| Code | Meaning | Old |
|---|---|---|
| U1 | Closed | CO |
| U2 | Sip-through opening | SP |
| U3 | Straw hole or slit | SH |

### V — Handle

| Code | Meaning | Old |
|---|---|---|
| V1 | No handle | NH |
| V2 | Twisted paper | TW |
| V3 | Flat tape | FT |
| V4 | T-shirt (vest) | TS |

### W — Individual wrap

| Code | Meaning | Old |
|---|---|---|
| W1 | Not wrapped | NW |
| W2 | Paper-wrapped | PW |
| W3 | Film-wrapped | FW |

### X — Window

| Code | Meaning | Old |
|---|---|---|
| X1 | No window | NN |
| X2 | With window | WN |

## Capacity, G

The first digit is the unit. The rest is the amount. Ounces, millilitres, servings, count, and grams are never converted into each other.

| First digit | Unit | 12 of that unit |
|---|---|---|
| 1 | oz | `G112` |
| 2 | mL | `G212` |
| 3 | servings | `G312` |
| 4 | count | `G412` |
| 5 | g | `G512` |

A whole amount stays a whole number. `12 oz` is `G112`. `325 oz` is `G1325`. A decimal keeps the point, so it cannot be read as a bigger whole number. `3.25 oz` is `G13.25`. `0.5 oz` is `G10.5`. `10.5 mL` is `G210.5`. `6.0` becomes `6` and is written `G16`. Leading zeros on the whole part drop: `03.25` is `3.25`.

The amount must be greater than 0 and at most 9999. More than 6 decimal places is refused. A bad capacity says to write a unit digit then the amount, for example `G112` for 12 oz.

A decimal is stored only when that product's capacity applies. A portion cup lid has no capacity of its own, so `PET Clear lid for 3.25 oz Souffle Cup` is `A7B1D1`. The 3.25 oz stays in the note. The capacity slot holds a decimal as its unit, four digits, the point and the decimals: `Z0003.25`.

## Sizes, H through P

Top diameter, bottom diameter, height, length, width, and gusset are stored in millimetres. A description is converted before it is encoded, and the fact says what was converted. The form still takes centimetres and inches, and converts them the same way.

| From | Into |
|---|---|
| cm | mm, ×10, rounded half up |
| inch | mm, ×25.4, rounded half up |
| mm, cm, inch | thickness in µm, ×1000, ×10000, or ×25400 |
| kg | grams, ×1000, up to 6 decimal places |

9 inch is 229 mm. 6 inch is 152 mm. 3.25 inch is 83 mm. 40 cm is 400 mm. 40 inch is 1016 mm. 0.35 mm of thickness is 350 µm. 0.33 kg is 330 g. `20-1/8` is 20.125 inch, which is 511 mm.

Three numbers, length × width × height, are read for a takeout box, folding carton, shipping box, tray, or hinged container. Tray and hinged container are also marked rectangular. `9 x 6 x 3.25inches, PP Hinged Container Clear` is `A11B3D1E3-J83K229L152`: hinged container, PP, Clear, rectangular, height 83 mm, length 229 mm, width 152 mm. `3.25inches` with no space still matches. A plain container has no three-side rule, which is why "hinged container" has to be recognised as the clamshell before the sizes are read.

`hinged container`, `hinged containers`, `clamshell`, and `clamshells` are all A11. `clamshell` was already in the word list. The other three were added.

## Reading a sentence

A description goes through the existing Atlas reader, then these extra passes, and the facts that belong to that product are written as a V2 code. A range is not a fact. `2-3 color` leaves print unknown and records both ends as a conflict. `22oz White Single Wall Paper Cold Cup (2-3 color print)` is cup, paper grade not known, white, single wall, 22 oz.

**The product is the lid.** `lid for` a souffle cup or portion cup is a portion cup lid (A7). A bowl is a bowl lid. A container is a container lid. A cup is a cup lid. `souffle cup lid` without "for" is the same lid. The note is three sentences: "The product is the lid. It goes on a 2 oz Souffle Cup. It is a Portion cup lid (A7)." Then: "Nominal capacity does not apply to a portion cup lid." The words `for`, `souffle`, and `portion` are consumed, so they do not sit in Left out.

**A vessel sold with its lid** becomes one product when the text joins them with and, &, with, w/, c/w, or +. Portion cup with lid is A34. Cup with lid is A33. Bowl with lid is A32. Container with lid is the existing A10. "Lid for a cup" is the lid, so it does not become Cup with Cup Lid. `Cups w/ lids` keeps the cup and notes that the lids come with it.

**Two values for one fact** are both left out. `PET and PP` on one cup says: "Material: PET is Polymer, PET (B1). PP is Polymer, PP (B3). Both were left out." The same shape is used for any named slot. One exception, ruled by reyxdz on 2026-10-29: paper or plastic of unknown grade (`Paper`, `Plastic`) beside one grade of the same family is that grade, so `Plastic` and `PET` is Polymer, PET (B1), and `Paper` and `White Kraft` is Paper and paperboard, white kraft (B14). `Paper` and `PET` are two families, and are both left out. `5 oz` and `6 oz` on one cup leaves capacity out, twice when one reader saw `6oz` and another saw `6 oz`, and the code is `A5B24`.

**Words that sit next to each other** are read as the one dictionary entry they name. `Polymer HDPE` is B6, with no extra "Polymer matches…" line. `Laminate, paper / polymer` is B34 and does not also become paper of unknown grade. A family word that matches several materials lists all of them.

**A size written beside its name** is that measurement: height, width, gusset, thickness, plies, servings, grams, gsm. A loose gram amount is unit weight when that slot is open, and capacity in grams when unit weight is already taken.

**Supplier shorthand**, added on 2026-10-29 after a dry run of the verified list read 1,442 rows. A rim written twice, as an item name and its Dimension column both do (`96MM LIDS, 96mm`), is one rim; `diameter` is read as `dia` is. Numbers joined by `+` (`300+300+250`) and a number's whole part before its decimals (`1.9g`) are never a size. `1c` to `8c` is a print colour count, `unprinted` is no print, and `SW` and `DW` are single and double wall. One capacity in two units, within a tenth (`5 oz (150 ML)`, `16 oz / 500 ml`), is the first written; two amounts are still left out.

**A lid named by its vessel in any order** is the lid: `Cup Lids`, `Bowl PET Lids`, `Lid 32 oz Paper Bowl`, `Lid fit for 6oz Deli Cup`. A lid joined to its vessel by with, and, &, w/, c/w or + is still sold with it.

**A number with no unit is never stored** as a capacity. When the product has a capacity and none was read, a bare number of 2 to 4 digits gets a note: "500 has no unit. If it is the capacity, write 500 ml or 500 oz." #28's ruling R1 still reads a lone bare number on a cup, bowl or lid as its rim, from 30 to 300 mm: no cup, bowl or lid is wider or narrower, so `500 paper bowl` is no rim, nor is a bare weight of `9.5`. The hint is only for a number that stands alone: none beside an `x`, a unit or an inch mark.

**Product types, as the restructured verified list writes them**, added on 2026-10-30 after a second dry run. Each settles what would otherwise be left out as two product types:

- A product type is read one or many: `napkins`, `boxes`.
- A kind beside its general word is the kind: a pouch over a bag, a clamshell, fry carton, takeout box or shipping box over a box, a portion cup, bowl, tray or clamshell over a container, a bowl, portion cup or container lid over a lid. Of two product words that overlap, the last is the head: `paper cup carrier` is a cup carrier.
- Two kinds of cutlery, with nothing a kit does not hold, are a cutlery kit: `knife + fork + napkin`.
- A wrap beside a product that is wrapped (straws, stirrers, cutlery, napkins) is how it is wrapped, and the paper or film it names is the wrap's, not the product's: `PLA straw with individual paper wrap`. `no wrap` and `unwrapped` are not wrapped.
- A vessel and a lid joined by with, w/, +, & or and, with up to three words between (`with dome lid`, `w/ printed lids`, `with clear lid combo`), are the vessel sold with its lid, wherever in the text the vessel is named. A product named only after such a word, `w/ printed lids` with nothing before it, is not the product: a note says the product is not named.
- A lid for a tray or a box is a container lid; `hinge lid` is a clamshell's.
- A box that is not paperboard, of plastic, fibre or foil, is a container.
- With no product word, a fact only one product type has names it, and a note says so: a handle is a bag's, plies a napkin's.
- Words that hold a product word but name something else are not read: `printing plate`, `plate fee`, `dispenser box`.
- A product type a reader has chosen, as Search's chooser does, is final: no pass changes it.

**Sizes and weights, as the list writes them.** A size named beside its number (`Height: 68`, `t:88mm*h:96mm*b:58mm`, `L115 x W120 x H72`, `topφ: 81.4`, `Rim: 80 mm`, `GSM:16, PLY:2`, `230 Dia`) wins over a size a ruling read from one of the same numbers for another slot: `Top diameter 180 x Bottom diameter 150 X Height 70 mm` is no 70 mm rim. A named diameter makes the product round; a tray's or clamshell's named length and width make it rectangular, as R6 does. A one-letter name is read only before its number, since `1.5 L` is a capacity. A rim marked `dia`, `rim`, `ø` or `φ` outranks a stray bare number, and the second of two numbers (`90 x 110`) is no rim. A model code (`DELI-34`) is no size. Only a ruler's fractions, in lowest terms, are fractions: `24/32` is two sizes. Of three-number sizes, one with its unit written is read over one without, and the other is its restatement, not leftover numbers; with none written, it is still millimetres (#58). R6 also reads fry cartons, containers, pans, plates, container lids and cup carriers. `280g paper` is a basis weight; a weight joined by `+` is a layer, and a comma decimal (`4,2 grams`) is not read.

**A list of sizes named after its numbers** is read in its own order (2026-10-30): `356.44 x 173.08 mm (Top Length x Width)`, `200 x 150 x 40 (W x L x H)`. Each name must be a size's, as many as the numbers; `depth` is the height and `G` the gusset. The names win over a ruling that read the same numbers in another order. With no unit written the sizes are millimetres (#58), and the importer flags any under 50 mm.

**The importer reads a row by its columns.** The product type comes from the item name; failing that, from the Category column, which also settles two the item name gives; failing that, from the sizes, weight and printing as well. The material cells name the material, never a product type, though they or the Category column may name a kind of the item name's general product (`Container Lid` beside `dome lids`). The cells' material wins over a vessel's a lid's name mentions, and a grade in the item name over a family in the cells. Then the rest of the row is read with both fixed, the Dimension cell first, and the Category column fills only the facts the rest leaves unsaid. A bare number in the Weight column, whose header is grams or gsm, is grams on a product with no basis weight and gsm on one with no unit weight; otherwise it is not read. A three-number size with no unit and every side under 50 is flagged in the report as likely inches; reyxdz kept these in millimetres, as #58 reads them (2026-10-30).

**Decided by reyxdz on 2026-10-30.** A soup cup is a bowl, as the verified list files most of them, and a lid for one is a bowl lid. A material named as absent (`latex free`, `PFAS free`) is not that material. A fact a pass left out as two values stays out: no later pass reads it again by its own name (`16/20oz` is no 20 oz). A product type or material given stays as given through every pass, and no note is written about it.

Gloves and cup sleeves get product types. These are dictionary changes, made in the app by suggestion and approval (ADR 0031), not by a migration, so they land in the live dictionary before the list is imported:

| List | Code | Meaning | Search words | Fields that apply |
|---|---|---|---|---|
| Product type | `GLV` | Glove | disposable glove | coating, colour / clarity, length, thickness, unit weight |
| Product type | `CSL` | Cup sleeve | sleeve, coffee sleeve, cup jacket | colour / clarity, capacity, height, basis weight (paper only), unit weight, print |
| Material | `HNI` | Elastomer, nitrile | nitrile | |
| Material | `HLT` | Elastomer, latex | latex | |
| Material | `AVN` | Polymer, vinyl (PVC) | vinyl, pvc | |
| Material | `ACP` | Polymer, CPE | cpe | |
| Coating | `PF` | Powder-free | powder free, powder-free | |
| Coating | `PW` | Powdered | powdered | |

No field holds a glove's size, so a glove's small, medium, large and extra-large share one Spec ID.

**Search shows what it finds only once Yes, proceed is pressed** (reyxdz, 2026-10-30). Under the code read, **Yes, proceed** and **No, edit it**; until Yes, proceed is pressed for that text and code, nothing is looked up and no Spec ID shows, not even by name. Text the reader finds no product in shows its names as before, with nothing to confirm. Once pressed, the question goes and **No, edit it** becomes **Edit these facts**, still opening New Spec ID with that code. A saved Spec ID whose code is exactly the one read shows as **We found a perfect match!**; else the only saved Spec ID that fits every fact read shows as **We found a match!**, "It has every fact you typed, and records more", as an imported Spec ID with the sizes its Dimension cell gave does. Several that fit are no single answer: none is highlighted and they stay under Fits. The match waits for both lookups, so it never moves once shown, and is left out of the groups and names below it; under it there is no "No saved Spec ID fits" and no save. The match card opens the saved Spec ID and offers no other way to New Spec ID.

**The Dictionary says what a number's letter holds** (2026-10-30). Its **Sizes and counts** list gives each letter that holds a number, G to P, S and T, with its field and how its number reads: `J110` is a 110 mm height, `N33` 3.3 g. A Spec ID's facts in words name each size: "Height 60 mm", not "60 mm".

**A material family fits its grades** (2026-10-30). Paper, plastic, molded fibre or metal of unknown grade, and kraft, fit each of their grades: a search for a paper bag fits a saved recycled kraft one, which the import read from the Material Type cell. A grade might fit a Spec ID that records only its family. Two grades still exclude each other.

## Suggestions

Anything the reader could not store is either a warning or a leftover word.

A leftover word of at least three letters is checked against the dictionary. `a`, `an`, `and`, `at`, `by`, `for`, `from`, `in`, `of`, `on`, `or`, `the`, `to`, and `with` are skipped. Shorter words are skipped too, except `pe`, `um`, and the capacity units.

| What was left | What is said |
|---|---|
| One dictionary entry, written as its own phrase | `kraft is Paper and paperboard, kraft, B12.` |
| One entry, but the word is only a piece of a longer name | `HDEP isn't listed on its own. It matches Polymer, HDPE, B6.` |
| Several entries | `polymer matches 11 entries: Polymer, PET (B1). …` |
| A named slot with no value | `print is mentioned, but not which one.` Then every issued value, as `No print is R1.` |
| The word `colour` or `color` | It could be the item colour or a print, and both lists are shown when neither is already stored. |
| `pe` | The PE coatings are listed. |
| A count word with no number | `compartment is mentioned, but no count, from 1 to 12. 3 compartments is S3.` Plies use 2 as the sample: `2 plies is T2.` |
| A count outside its range | `… is mentioned as 13, which is outside 1 to 12.` |
| A measurement word with no number | The word is mentioned, and the line says which letter and unit it needs. |
| `diameter` | Top or bottom, once the shape is known. |
| `weight` or `grams` | Unit weight or capacity in grams, when it is not already clear which. |
| The slot does not apply | `Gusset does not apply to a cup.` |
| The slot needs a shape that is missing | `Length applies when a bag is not round, and the shape is not known yet.` Or the round-only form for a diameter. |
| The slot needs paper and the material is missing | `Basis weight applies to paper only, and the material is not known yet.` |

A one-letter misspelling is offered when the word is at least four letters. One transposition counts as one change, so `HDEP` finds `HDPE`. Ordinary words inside a longer name are not spelling targets: and, as, both, by, coating, for, from, grade, inside, known, not, of, only, outside, paper, paperboard, side, sides, source, stated, the, with. That is why `size` stays in Left out and is not offered as coating C5, "PE, side not stated." A longer word that starts with the leftover word can still match.

While a code is being typed, an unknown letter says `This key/part is unknown.` A letter with no number says the fact has no value. The same slot twice says it is given twice. A slot the product does not have says that part is not applicable. A code with no product type is refused: `Product type (A) is missing. Every code includes it, for example A1.` Two hyphens are refused. A number written before its letter is refused.

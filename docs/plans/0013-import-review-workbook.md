# 0013. A review workbook for the imported codes

- **Status:** In progress
- **Owner:** reyxdz
- **Related:** [Plan 0011](./0011-tagged-spec-id-v2.md) · [Plan 0012](./0012-options-by-number.md) ·
  [ADR 0026](../decisions/0026-raw-text-is-read-by-rules-and-a-public-word-list.md) ·
  [ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md)

## Goal

The departments who will use Atlas asked for a spreadsheet in which to check
the codes the import made from the verified list: each row's cells as the
workbook wrote them beside what Atlas read from them, the way Search shows a
reading, so they can judge whether each code is accurate and consistent. At
the end, `npm run atlas:import -- … --review "<path>.xlsx"` writes that
workbook from the same pass that builds the codes, so it always shows exactly
what was, or would be, saved.

## Decisions (reyxdz, 2026-11-04)

- **One line per workbook row**, not per Spec ID: a row is what a person
  checks. A separate sheet lists each code with the rows that share it.
- **Built by the importer**, not read back from a database: the database keeps
  a row's facts, not the cells they were read from.
- **Excel**, with its notes, dropdowns and links.
- **Only the cells the code is read from**: item name, Category, Material,
  Material type, Dimension, Weight and Printing. Company, country and prices
  are left out, so the file can go to people who should not see supplier
  pricing. It is still Source One data and never enters the repository.

## Scope

**In scope**
- The row reader says, for each fact, the words and the cell it was read from,
  and the words no rule used.
- The report carries each row's cells, those facts, and the dictionary's
  options; the CSV report is unchanged.
- `ExcelReviewWorkbook`, and `--review` on `atlas:import`.
- The small-size note counts a diameter of 50 mm or more as saying the sizes
  are millimetres, and never raises one for a small diameter alone.

**Out of scope**
- Reading a reviewed workbook back into Atlas. A "No" becomes a reader fix,
  with a test in invented wording, and the import is run again.

## Acceptance

- [x] The Rows sheet has one line per workbook row: the seven cells, the code and outcome, one column per fact read with a note naming its cell and words, Left out, Notes, and the four review columns with a Yes / No / Unsure dropdown
- [x] The Spec IDs sheet lists each code once, with its rows, and says when their item names differ
- [x] The Needs a look sheet puts skipped rows, small sizes with no unit, codes shared by rows of other names, a disagreeing Category and refused facts first, each linked to its row
- [x] The Dictionary sheet decodes every option
- [x] The restructured list's dry run still gives 1,161 Spec IDs from 1,442 rows with every code unchanged, and 96% of its 8,176 facts have a source note
- [x] The small-size note no longer flags a bowl `210 Dia 48 H`, and flags no row it did not flag before (94 rows down to 76)

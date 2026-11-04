# 0015. The review sheet's Spec IDs, grouped by their facts

- **Status:** In progress
- **Owner:** reyxdz
- **Related:** [Plan 0013](./0013-import-review-workbook.md) · [Plan 0014](./0014-review-sheet-in-atlas.md) ·
  [ADR 0032](../decisions/0032-spec-ids-are-written-tagged.md)

## Goal

A code has two parts: the facts before the hyphen, what the product is
(`A3B25C8E1`), and the sizes after it (`G125`). The people checking the codes
asked to see, on the review workbook's Spec IDs sheet, every Spec ID that is
the same product in other sizes together, under a clear divider. At the end,
the sheet is grouped by facts.

## Decisions (reyxdz, 2026-11-04)

- **A group is one facts code**, compared exactly: `A16B14D3` and
  `A16B14D3V2` (the same bag with a twisted handle) are two groups.
- **A code of facts alone is in its group**, first: `A3B25C8E1` leads the
  `A3B25C8E1` group, before `A3B25C8E1-G125`.
- **A divider row** above each group names its facts code, what they say, and
  how many Spec IDs and rows it holds. Each line also gains **Facts** and
  **Sizes** columns, so a filter still finds a group, and the lines fold under
  their divider in Excel's outline.
- **Codes are in reading order**: part by part, by letter, then by number as a
  number, so `A3` comes before `A10`.

## Acceptance

- [x] The Spec IDs sheet has a divider row above each facts group, and each Spec ID under the divider of its facts, a code of facts alone first
- [x] Each line holds its Code, Facts and Sizes, and folds under its divider in Excel's outline
- [x] The groups and their Spec IDs are in reading order
- [x] On the restructured list, 1,161 Spec IDs fall into 361 groups

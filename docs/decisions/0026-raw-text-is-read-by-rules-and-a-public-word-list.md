# 0026. Raw text is read by rules and a public word list

- **Status:** Accepted
- **Date:** 2026-10-20
- **Related:** [Issue #41](https://github.com/S1-GLOBAL/s1-gateway/issues/41) ·
  [Plan 0007](../plans/0007-search-atlas-with-raw-product-text.md) ·
  [Plan 0006](../plans/0006-s2-spec-ids-and-verified-list-import.md) ·
  [ADR 0019](./0019-the-s1-spec-id-format.md) ·
  [ADR 0025](./0025-spec-ids-are-written-short.md)

## Context

Staff copy product descriptions from elsewhere — "14oz Bagasse Bowl for Cava" —
and want to find the Spec ID they describe. Atlas could find a product only by
its saved name or its exact code (#41). The verified-list import (plan 0006,
phase 3) needs the same skill for its item names. Something has to turn free
text into facts, and it is the first time Atlas does.

## Decision

- Raw text is read by rules, with no AI model:
  - product type and material from a word list and the dictionary's own product-type names;
  - the other facts from plan 0006's keyword table (`14oz`, "double wall", "2 colour print"…);
  - a size that does not say what it measures from #28's rulings R1, R1b, R2, R3, R5 and R6.
- Text is compared in lower case, whole words only. A phrase inside a longer
  one is not read, except a material or a feature inside a product-type phrase
  ("paper cup" is a cup and paper). Two different values for one slot leave it
  not known, and both are reported. Every word no rule used is reported as
  ignored.
- The word list is in the repository
  (`backend/src/modules/atlas/domain/reading/word-list.ts`): the verified
  list's spelling table, merged with reyxdz on 2026-10-19, without its skip
  entries. It holds phrases and codes, never rows, prices or supplier names.
  This replaces #28's decision that the spelling table lives beside the
  workbook.
- One reader serves both the library's search (`POST /api/v1/atlas/spec-ids/read`)
  and the import.

## Alternatives considered

- **An AI model.** It would read more phrasings, but its answers can change
  between calls, cost money per call, need text to leave the network, and
  cannot be tested exactly. A wrong reading here is shown to the user before
  anything is searched, so a rule that is plainly right or plainly missing is
  better than one that is usually right.
- **Keep the word list beside the workbook.** That works for an import run on
  one machine, but the search runs on the server, which needs the list. The
  list holds no business data, so reyxdz chose to put it in the repository.
- **Search by name only, with fuzzy matching.** It would find a saved name
  close to the text, not the product its facts describe, and could not show
  what was read.

## Consequences

- A phrase missing from the list or the keywords is not read: it shows under
  "Ignored", and the list grows by pull request.
- Readings are the same every time, and each rule has a test.
- A bare size is read by a fixed ruling ("Cup 90mm" is a 90 mm rim). The user
  sees it under "Read from your text" before searching, and can correct it on
  New Spec ID.
- The import reuses the reader, so search and import read text the same way.

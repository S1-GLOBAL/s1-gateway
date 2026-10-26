# 0029. The library is numbered pages

- **Status:** Accepted
- **Date:** 2026-10-26
- **Related:** [0022](./0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md)

## Context

The library was a cursor. Each answer was 20 Spec IDs and a token for the
next 20, and Show more appended them. Staff paging a catalog need the last
page on the first paint, and a click on page 6 has to load that page. A
cursor cannot say how many pages exist, and it cannot fetch page 6 without
walking from page 1.

The cursor was chosen so a save, which reorders the list by the newest
change, would not skip or repeat a row the way an offset can.

## Decision

**`GET /atlas/saved` takes `page`, starting at 1, and answers
`{ items, page, pageSize, total }`.** `total` counts the Spec IDs that match
the current search and product type. `pageSize` is 20. A page past the end
is the last page, so the jump is still one request. A page that is not a
whole number from 1 is 400 `VALIDATION_FAILED`. The cursor is gone.

The current page on screen is a raised surface, the same selection as a
segmented control. Lime stays the primary action.

## Alternatives considered

- **Keep the cursor and add only `total`.** The last number would be real,
  and a jump would still request every page up to it. Rejected: a jump has
  to be one request.
- **Keep Show more.** Rejected: a catalog is paged, not stacked.

## Consequences

A save that changes the order while someone is between pages can skip or
repeat a card. The list is a staff catalog, not a feed, and that is the
trade for a last page that is true on the first paint. The cursor, and the
code that encoded it, are gone.

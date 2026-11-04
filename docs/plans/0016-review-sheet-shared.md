# 0016. One shared review sheet, kept in step with Atlas

- **Status:** In progress
- **Owner:** reyxdz
- **Related:** [Plan 0013](./0013-import-review-workbook.md) · [Plan 0014](./0014-review-sheet-in-atlas.md) ·
  [Plan 0015](./0015-spec-ids-grouped-by-facts.md)

## Goal

The departments review the codes in one shared Google Sheet, so nobody redoes
what someone else has checked. Atlas's **Review sheet** button opens it, and
Atlas keeps it in step with the library: what changes in Atlas reaches the
sheet without touching anyone's review.

## Decisions (reyxdz, 2026-11-04)

- **Review sheet opens the shared Google Sheet** in a new tab. Its address is
  the host's `ATLAS_REVIEW_SHEET_URL`, handed only to signed-in staff; it is
  never in the repository, which is public.
- **Spec IDs** beside it downloads the Spec IDs sheet alone, made from the
  library as it stands.
- **Reviewers write on the Rows tab only.** Atlas never writes the review
  columns, and never moves or deletes a row there: it updates its own columns
  in place, matched by workbook row or Spec ID, and adds new rows. Every other
  tab is Atlas's to rebuild whole.
- **Atlas syncs a minute after any change**, several changes making one sync;
  the page says when it last synced, and admins may **Sync now**.
- **A row Atlas no longer has stays**, with its review, marked "No longer in
  Atlas".
- **Atlas writes to the sheet; the sheet never writes to Atlas.** A Spec ID
  changes only in Atlas, under its rules and with its History.

## Phases

| Phase | What | Status |
|---|---|---|
| 1 | The Review sheet link and the Spec IDs download | In progress |
| 2 | Atlas → sheet sync, a Google Cloud service account set up by reyxdz first | Not started |

## Acceptance, phase 1

- [x] `ATLAS_REVIEW_SHEET_URL` is optional, takes only a Google Sheet's address, and the API refuses to start with any other
- [x] `GET /atlas/review-sheet/link` answers it to signed-in staff, and 401 to anyone else
- [x] **Review sheet** opens it in a new tab, and is not shown while none is set
- [x] **Spec IDs** downloads the Spec IDs sheet alone, dated by the reader's own day

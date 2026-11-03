# 0014. The review sheet, downloaded from Atlas

- **Status:** In progress
- **Owner:** reyxdz
- **Related:** [Plan 0013](./0013-import-review-workbook.md) ·
  [ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md)

## Goal

Plan 0013's review workbook is written by the import, on the machine that
runs it. The departments asked to take it from Atlas themselves. At the end,
a **Review sheet** button beside **Dictionary** on Atlas downloads the
workbook of the library as it stands: every row of the last import, its cells
beside what was read from them, each with its Spec ID's code now.

## Decisions (reyxdz, 2026-11-04)

- **The import keeps each row** it read, its cells and what was read from
  them, in `atlas_imported_rows`, replaced by every import with `--write`.
  The database kept a row's facts, not the cells they came from.
- **Any signed-in staff** may download it, as they may search the Spec IDs it
  lists. It has item names and codes, not companies or prices.

Reading the list again on each press was rejected: the reader takes about
18 seconds for the whole list on a development machine, and longer on the
staging host, all of it time the API could answer no one else. The kept
reading is what made each code, so the sheet still shows exactly that; a code
changed in Atlas since is flagged, and a Spec ID saved in Atlas rather than
imported is listed with its facts and no cells.

## Acceptance

- [x] `atlas:import --write` keeps every row it read, against the Spec ID it went into, and none skipped against one; a dry run keeps nothing
- [x] `GET /atlas/review-sheet` answers the workbook as a file to save, dated, never cached, to any signed-in staff, and 401 to anyone else
- [x] Each row shows its Spec ID's code now, flagged when Atlas changed it since the import; a Spec ID saved in Atlas is listed with no workbook row
- [x] A **Review sheet** button beside **Dictionary** saves it, busy while it is made, and says so beside itself when it can't be
- [ ] Staging's last import is run again with `--write` after this deploys, so the button has rows to set out

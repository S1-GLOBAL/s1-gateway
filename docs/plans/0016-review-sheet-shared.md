# 0016. One shared review sheet, kept in step with Atlas

- **Status:** In progress
- **Owner:** reyxdz
- **Related:** [Plan 0013](./0013-import-review-workbook.md) · [Plan 0014](./0014-review-sheet-in-atlas.md) ·
  [Plan 0015](./0015-spec-ids-grouped-by-facts.md) · [ADR 0034](../decisions/0034-atlas-writes-the-shared-review-sheet-one-way.md)

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
- **The service account is reyxdz's to set up** in Google Cloud; its key is a
  Render variable, never in chat or the repository.

## Phases

| Phase | What | Status |
|---|---|---|
| 1 | The Review sheet link and the Spec IDs download | Done — merged in #112; its screenshots are still to be taken |
| 2 | Atlas → sheet sync, a Google Cloud service account set up by reyxdz first | In progress |

## Acceptance, phase 1

- [x] `ATLAS_REVIEW_SHEET_URL` is optional, takes only a Google Sheet's address, and the API refuses to start with any other
- [x] `GET /atlas/review-sheet/link` answers it to signed-in staff, and 401 to anyone else
- [x] **Review sheet** opens it in a new tab, and is not shown while none is set
- [x] **Spec IDs** downloads the Spec IDs sheet alone, dated by the reader's own day

## Phase 2: how the sync works

The design and why are [ADR 0034](../decisions/0034-atlas-writes-the-shared-review-sheet-one-way.md).
In short:

- **Shared layout.** The workbook and the shared sheet are drawn from one
  layout, `review-sheet-layout.ts`, so they never drift apart.
- **Planned first.** A sync is planned before anything is written, by
  `planRowsSync`. It is pure, and tested against an in-memory sheet.
- **Rows tab.** Atlas changes only its own cells there, found by column name
  and by each line's key. The key sits in a hidden **Atlas key** column.
- **Other tabs.** Every other tab is written whole.
- **Google access.** The Google adapter is the Sheets API v4 over HTTPS, as a
  service account. A value is never read as a formula.
- **Triggers.** The sync runs a minute after a save, an update or an approved
  dictionary change, and a minute after the API starts. It can also run at
  once, on an admin's **Sync now** (`POST /atlas/review-sheet/sync`). A failed
  sync is tried again, later each time.
- **Command.** `npm run atlas:sheet-sync` does one sync from the command line.
  It writes nothing unless given `--write`; without it, it lists every cell a
  sync would change.

## Acceptance, phase 2

- [x] A sync writes only Atlas's own columns on the Rows tab, found by name: never Correct?, What's wrong, Reviewer, Date, or a column Atlas does not know
- [x] It finds each line by its hidden key however the tab is sorted, and never moves, clears or deletes a row
- [x] It keeps notes only on a fact's cell; a reviewer's note on any other cell, Atlas's own included, is left as it is
- [x] The first sync takes the uploaded lines as Atlas's, by Row number and Item name, or by Code for a Spec ID saved in Atlas, keeping every review
- [x] A line Atlas no longer has keeps its review, its Outcome reading "No longer in Atlas"; a new line goes below the last, with Correct? offering Yes, No or Unsure
- [x] A sync with nothing new writes nothing to the Rows tab; a line moved mid-sync makes it plan again
- [x] How to read this, Spec IDs, Needs a look and Dictionary are written whole, each Needs a look row linked to its line on Rows
- [x] The API syncs a minute after a save, an update or an approved dictionary change, and a minute after it starts; a failure is tried again later
- [x] Atlas shows when the sheet last synced, or why it failed; admins have **Sync now**
- [x] `ATLAS_REVIEW_SHEET_SYNC_KEY` takes a service account's JSON key, as text or base64, needs `ATLAS_REVIEW_SHEET_URL`, and is never quoted in an error
- [x] `npm run atlas:sheet-sync` lists what a sync would change, and writes only with `--write`
- [ ] Tried on a copy of the shared sheet: a dry run, then `--write`, every review still in place
- [ ] A dry run on the shared sheet itself, read before the key goes on Render

## Rollout, phase 2

Each step waits for the one before it. The service account's key never goes
in chat, a commit or a screenshot.

1. **Google Cloud** (reyxdz), at console.cloud.google.com:
   1. Make a project, for example `s1-gateway-atlas-sync`.
   2. Under **APIs & Services → Library**, enable the **Google Sheets API**.
   3. Under **IAM & Admin → Service Accounts → Create service account**, make
      one, for example `atlas-sheet-sync`. Give it no role.
   4. Open it, then **Keys → Add key → Create new key → JSON**. The JSON file
      downloads once; keep it outside the repository.
2. **Share the shared sheet** with the service account's address, its
   `client_email` (`…@….iam.gserviceaccount.com`), as an **Editor**. Then
   make a copy of the sheet (**File → Make a copy**) and share the copy with
   it too.
3. **Try it on the copy**, from `backend/` with the staging database in
   `DATABASE_URL`, and the key in `ATLAS_REVIEW_SHEET_SYNC_KEY`
   ([environment](../reference/environment.md)):
   1. `npm run atlas:sheet-sync -- --sheet "<the copy's address>"` lists what
      a sync would change, and writes nothing.
   2. With `--write`, it syncs the copy. Open the copy: every review is where
      it was, and the Atlas key column is hidden.
4. **Dry-run the shared sheet**: the same command without `--sheet`. Read the
   cells it would change, above all any in a column Atlas owns that someone
   typed into.
5. **Set `ATLAS_REVIEW_SHEET_SYNC_KEY` on Render** (`s1-gateway-staging-api`
   → **Environment**), the JSON file in base64. Render redeploys, and the
   first sync runs a minute after the API starts.

# 0034. Atlas writes the shared review sheet one way, owning only its own columns

- **Status:** Accepted
- **Date:** 2026-11-04

## Context

The departments check Atlas's codes in one shared Google Sheet, so that
nobody redoes what someone else has checked ([plan 0016](../plans/0016-review-sheet-shared.md)).
The sheet was uploaded once from the review workbook, and people are already
writing their verdicts in it. A Google Sheet keeps its own edits in step
between the people who have it open. It knows nothing of Atlas: a Spec ID
saved or changed in Atlas after the upload never reaches it, so the sheet goes
stale while people go on reviewing it.

Whatever brings it up to date must not cost anyone their review. Reviewers
sort and filter the Rows tab, and may add a column or a line of their own. The
sheet holds Source One text, and the repository is public.

## Decision

**Atlas writes to the sheet, and the sheet never writes to Atlas.** A Spec ID
changes only in Atlas, under its rules and with its History.

**On the Rows tab, Atlas writes only its own columns.** These are the cells as
the workbook wrote them, the code and outcome, each fact read, Left out, Notes
and Dropped. Atlas finds them by their names on the header row, wherever they
have been moved. It never writes Correct?, What's wrong, Reviewer or Date, or
any column it does not know. It never moves, clears or deletes a row. It keeps
notes only on a fact's cell, saying where the fact was read. Any other note,
even on one of its own cells, is a reviewer's, and Atlas leaves it as it is.

**Each line is found by its key**, in a hidden Atlas key column, however the
tab is sorted:

- **An imported row:** its row number and a fingerprint of its seven cells.
  A row whose cells change in a later import becomes a new line, and its old
  review stays with what was reviewed.
- **A Spec ID saved in Atlas:** its id.

The first sync adopts the lines already uploaded:

- an imported row, by its Row number and Item name;
- a Spec ID saved in Atlas, by its Code.

It writes each key beside its line. A line Atlas can't place, or no longer
has, keeps its review, and its Outcome reads "No longer in Atlas". A new line
goes below the last. A cell is written only when it differs.

**Every other tab is Atlas's**, written whole each sync: How to read this,
Spec IDs, Needs a look and Dictionary.

**A sync is planned before anything is written, and then written at once.**
The plan is a pure function of the tab as read and the library as it stands.
Just before writing, Atlas reads the tab again. If any line has moved, the
plan is made again. Each tab's changes go in one `batchUpdate`, which Google
applies whole or not at all. A value is always written as a value, so a cell
that starts with `=` stays text.

**Atlas reaches the sheet as a Google Cloud service account**, through the
Sheets API v4 over HTTPS:

- The token is a claim signed with the account's key, using Node's `crypto`.
  No Google SDK is needed.
- Its scope is `spreadsheets`, so it sees only the sheets shared with it.
- Its key is a host variable, `ATLAS_REVIEW_SHEET_SYNC_KEY`, never in the
  repository.

**The API syncs a minute after a change, and admins can sync at once.**

- **Changes that count:** a save, an update, or an approved dictionary
  change. Several changes make one sync, at most five minutes after the
  first.
- **Restarts and imports:** the API also syncs a minute after it starts,
  which covers a restart and a command-line import.
- **Failures:** a failed sync is tried again, later each time. Its reason is
  shown in words fit for staff, and the full error goes to the log.
- **Sync now:** admins have a **Sync now** button.
- **Status:** it is kept in memory, and says when the sheet last synced.

## Alternatives considered

- **Keeping the sheet up to date by hand.** Someone downloads and pastes after
  each change. Nobody would, and a paste over the Rows tab moves reviews off
  their rows.
- **Rebuilding the Rows tab whole each time.** This is simple, but it erases
  the reviews, or leaves them beside the wrong lines once the order changes.
- **Finding lines by their place, or their Code alone.** Reviewers sort the
  tab. Many rows share a code. A code changes when a Spec ID is corrected,
  which is exactly when its review matters most.
- **An Apps Script in the sheet that pulls from Atlas.** This needs an
  endpoint that hands Source One data to a script holding a secret, inside a
  sheet any editor can read and change.
- **Two-way sync, with reviews written back into Atlas.** reyxdz chose one
  way. Verdicts in Atlas would need their own model, and a Spec ID must
  change only under Atlas's rules.
- **Google's `googleapis` SDK.** This is a large dependency for four calls
  and one signed claim.
- **Signing in as a person, by OAuth.** The sync would stop when that person
  left, or their token lapsed. It would also see everything they can see.
- **A durable queue or outbox table.** This is more to run and to recover.
  The sync after each start already covers a lost waiting sync, and a sync
  is idempotent.

## Consequences

- **Reviews are never written, moved or deleted by Atlas.** A sync with
  nothing new writes nothing, so the sheet's version history shows only real
  changes.
- **A reviewer who types into one of Atlas's columns has that text replaced**
  at the next sync. The read-me says which columns are theirs. The first sync
  of a sheet already in use should be seen first: `npm run atlas:sheet-sync`
  lists every cell it would change, and writes nothing without `--write`.
- **A sort in the second between Atlas's last read and its write** could put
  Atlas's cells for that sync beside the wrong line. The next sync writes each
  line's cells by its key again. Reviews are never among them.
- **The service account's key is a long-lived secret** on the host. It is
  rotated by adding a new key in Google Cloud, setting it, and deleting the
  old one. The sheet must stay shared with the service account as an Editor;
  otherwise the sync fails, says so, and keeps trying.
- **The sync's status lives in memory.** After a restart, the page says the
  sheet has not synced until the first sync, a minute later. Two API
  instances would each sync: harmless, since a sync is idempotent, but twice
  the calls.
- **A command-line import does not reach the sheet** until the API next
  syncs, after a change or a restart, or an admin presses **Sync now**.

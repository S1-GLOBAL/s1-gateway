# 0035. Quotations added in Atlas wait for an admin, and outlive an import

- **Status:** Accepted
- **Date:** 2026-11-06

## Context

A Spec ID's quotes have come only from the verified list, through
`atlas:import`. Each import with `--write` deleted every quote and loaded the
workbook's again (ADR 0027). Staff now get quotations that the list doesn't
hold, and want to record them on the Spec ID they quote
([plan 0017](../plans/0017-quotations-added-in-atlas.md)).

A quote is the price Source One will source at, so a wrong one costs real
money. reyxdz asked that anyone may add one, but that an admin agrees to it
first, exactly as a dictionary change is agreed (ADR 0031).

## Decision

**A quotation added in Atlas is a quote suggestion.** It is recorded waiting,
in `atlas_quote_suggestions`, and nothing in the Spec ID's quotes changes
until an admin who did not suggest it approves it. The rules are the
dictionary's:

- only its suggester may edit or withdraw it, and only while it waits;
- an admin rejects it with a reason;
- a version number makes an approval decide what the approver saw;
- every step is kept, never changed, in `atlas_quote_suggestion_events`.

It is a separate entity from a dictionary suggestion, not a new kind of one.
Its proposal is a manufacturer and a quote's values, not a dictionary
option, and approving it adds a quote, not a dictionary change.

**Approval does everything at once, in one transaction:**
1. records the decision;
2. finds or adds the manufacturer by name, trimmed and ignoring case, as the
   import does;
3. adds the quote.

A new manufacturer named in a quotation therefore exists only once it is
approved. If one of that name appears meanwhile, the quotation joins it.

**A quote remembers the quotation it came from**, in
`atlas_quotes.suggestion_id`. The import replaces only the quotes where that
is null: its own. A quote added in Atlas survives every import.

## Alternatives considered

- **Writing quotes straight away, and reverting a bad one.** A wrong price
  would be visible, and could be acted on, before anyone checked it. reyxdz
  asked for approval first.
- **A new kind of dictionary suggestion.** It would reuse the table and the
  Dictionary Changes page. But it would mix two different reviews in one
  queue, give the table nullable columns for each kind, and route an approval
  through the dictionary's change numbers.
- **Generalising the dictionary's `Suggestion` over its proposal.** That would
  avoid repeating the lifecycle. But it means reworking a released, tested
  entity, and its routes and records, for a second use. The repetition is
  about two hundred lines. If a third reviewed change comes, it is the time
  to extract the shared lifecycle.
- **Marking imported quotes rather than added ones.** Same effect, but every
  existing row would need a backfill. A nullable `suggestion_id` needs none:
  every quote today was imported.

## Consequences

- **Two review queues.** Admins have Dictionary Changes and Quotation Changes,
  each with its own count.
- **One admin can't approve their own.** With a single admin, that admin's own
  quotations wait for a second admin, as their dictionary suggestions do.
- **An added quote outlives an import.** If the verified list later holds the
  same quote, the Spec ID shows it twice, once from each source. Nothing
  merges them.
- **The stage follows automatically.** A manufacturer's stage already follows
  its quotes when no admin has set one, so an approved quotation makes it
  **Quoted** with no further step.

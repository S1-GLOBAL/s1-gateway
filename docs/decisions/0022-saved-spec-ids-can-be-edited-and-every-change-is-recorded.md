# 0022. Saved Spec IDs can be edited, and every change is recorded

- **Status:** Accepted
- **Date:** 2026-10-17
- **Related:** [Issue #16](https://github.com/S1-GLOBAL/s1-gateway/issues/16) ·
  [Plan 0004](../plans/0004-atlas-library-and-editable-spec-ids.md) ·
  [ADR 0019](./0019-the-s1-spec-id-format.md) ·
  [ADR 0021](./0021-the-atlas-dictionary-changes-only-by-migration.md)

## Context

Staff save a Spec ID with whatever facts they have, and learn the rest later:
the height from a sample, the true unit weight from a weighing. Under
[ADR 0019](./0019-the-s1-spec-id-format.md) ("A code is permanent once
issued") and [ADR 0021](./0021-the-atlas-dictionary-changes-only-by-migration.md)
(nothing "updates or deletes … a saved Spec ID"), a product saved with three
known facts could never gain a fourth, and a wrong fact could never be
corrected. reyxdz decided on 2026-10-17 that a saved Spec ID must be kept up to
date as facts arrive.

## Decision

- Any signed-in staff member may change a saved Spec ID's facts and name. A
  change may fill in a fact that was not known, correct a known one, clear one
  back to not known, or change the product type, shape or material.
- The code follows the facts: it is rebuilt with the current dictionary on
  every change. A saved Spec ID keeps a permanent `id`, which never changes, so
  links and later records point at it and not at its code.
- Every change is recorded in `atlas_spec_id_changes`: who, when, and the code
  and name before and after. A Spec ID's first entry is its creation. Entries
  are only ever added.
- A change is started from a `version`. A change from a version that is no
  longer current is refused, so two people never overwrite each other unseen.
- One code is one product (ADR 0019, "Uniqueness"): a change that would give a
  Spec ID another saved Spec ID's code is refused, naming that one.
- A code a Spec ID was corrected away from is free for a product that truly
  has it. Looking up an old code finds the Spec ID that has it now, and every
  Spec ID that had it before; when none has it now, the last one that did.
- Nothing deletes a saved Spec ID or a history entry. The dictionary still
  changes only by migration: ADR 0021 stands for it.

This supersedes "A code is permanent once issued" in ADR 0019 and "or a saved
Spec ID" in ADR 0021's decision, for saved Spec IDs only.

## Alternatives considered

**Codes stay permanent; a correction saves a new Spec ID beside the old one.**
Rejected by reyxdz on 2026-10-17: staff would have to know which of several
Spec IDs for one product is current, and the library would fill with outdated
ones.

**The last save wins.** Rejected by reyxdz on 2026-10-17: the first person's
change would disappear without either of them noticing.

**A corrected-away code stays retired forever.** Rejected by reyxdz on
2026-10-17: a product that truly has that code could then never be saved with
it.

## Consequences

A code given out in an email or a quote can stop being a product's current
code. Atlas keeps finding the product by it, so the old code still leads
somewhere, but a code alone is no longer proof of today's facts: the Spec ID's
page is. Every change costs one more row, kept for good. Deleting or retiring a
saved Spec ID still needs its own decision.

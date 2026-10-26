# 0031. The dictionary is edited in the app, by suggestion and approval

- **Status:** Accepted
- **Date:** 2026-10-27
- **Related:** [Issue #95](https://github.com/S1-GLOBAL/s1-gateway/issues/95) ·
  [Plan 0010](../plans/0010-dictionary-suggestions.md) ·
  supersedes [ADR 0021](./0021-the-atlas-dictionary-changes-only-by-migration.md) ·
  extends [ADR 0022](./0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md) and
  [ADR 0026](./0026-raw-text-is-read-by-rules-and-a-public-word-list.md) ·
  [ADR 0030](./0030-roles-live-on-the-account.md)

## Context

[ADR 0021](./0021-the-atlas-dictionary-changes-only-by-migration.md) made the
Atlas dictionary change only by migration, so that no published meaning could
be reassigned by accident. In practice, adding a material, fixing a wording or
dropping a duplicate now needs a developer, a pull request and a deploy, and
the people who know the products cannot do it themselves.

reyxdz decided on 2026-10-27 that staff should change the dictionary in the
app, with every change approved by an admin and every step on record. They
were shown what that risks, because every saved Spec ID carries its codes in
its own code:

- changing a code's letters leaves saved Spec IDs holding letters that no
  longer exist, unless they are rewritten too;
- deleting an option in use does the same;
- rewording an option in use changes, silently, what every Spec ID using it
  means.

They chose that an approved change applies to saved Spec IDs as well.

## Decision

**Who does what**

- Any signed-in person may **suggest** a change: add, edit or delete an option
  in any dictionary list; a product type's field rules; and an option's search
  words. They may edit their own suggestion while it waits (every edit is kept)
  or withdraw it.
- Any admin or System Admin ([ADR 0030](./0030-roles-live-on-the-account.md))
  **approves or rejects** a waiting suggestion that is not their own. Rejecting
  requires a reason. Nobody decides their own suggestion.
- Nothing in the dictionary changes until a suggestion is approved.

**What an approval does**

- The live dictionary is release `S2`. Each approved suggestion becomes
  **dictionary change #N**, numbered from 1. `S1 0.1.0` is not edited: it is
  kept only to read old codes ([ADR 0024](./0024-spec-ids-move-to-the-s2-format.md)).
- Approval applies the change, and rewrites every saved Spec ID it touches, in
  one transaction:
  - a renamed code is replaced by its new letters;
  - a deleted option in use is replaced by what the suggestion names: another
    option in the same field, or Not known (`Y`). Product type has no Not
    known, so another product type is required;
  - where a field rule changes, or a Spec ID moves to another product type, a
    field that no longer applies becomes `X`, and one that now applies but was
    `X` becomes `Y`.
- Every rewritten Spec ID gets an entry in its history, as
  [ADR 0022](./0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md)
  requires for any change, naming the suggester and the approver and linking to
  the dictionary change.
- If the rewrite would make two saved Spec IDs identical, the approval is
  refused and nothing changes.
- A suggestion is checked again on approval against the dictionary as it is
  then, since two waiting suggestions can collide.

**What stays fixed**

- `RD`'s letters cannot change and `RD` cannot be deleted: it is how Atlas
  knows a shape is round. Its wording can change.
- A material's first letter is its family, as today; `B` is paper, which the
  paper-only field rules read.

**Search words** ([ADR 0026](./0026-raw-text-is-read-by-rules-and-a-public-word-list.md))

- The word list in the code stays as the base. An option can also have approved
  search words, stored per option, which the reader uses for that option's
  field. A word that already finds another option in the same field is refused.
- A renamed code keeps its words, from the code list and approved alike; a
  deleted code's words are dropped.

## Alternatives considered

**Keep ADR 0021: changes only by migration.** Safest for the meaning of saved
codes, but it keeps every change behind a developer. Rejected by reyxdz.

**Retire, never erase.** A code's letters would never change; Delete would
hide an option from new Spec IDs and leave existing ones untouched. Nothing
saved would ever be rewritten. Recommended and shown to reyxdz, who chose that
deletes and renames apply to saved Spec IDs instead.

**Block edits to an option in use.** Simple and safe, but an option that
needs fixing is usually one that is used.

**A new release per change** (`S2 0.1.1`, `0.1.2`…). Each would copy the whole
dictionary, about 800 rows, and move every Spec ID to it. Numbered changes on
one live dictionary keep the same history for a fraction of the rows.

**Self-approval.** Faster, but one person alone could change what every saved
Spec ID means.

## Consequences

- People who know the products can change the dictionary, and every change
  names who suggested and who approved it.
- **A saved Spec ID's code is no longer stable.** It can change without anyone
  editing that Spec ID, and a code already sent outside the Gateway may stop
  matching. Its `id` stays the same ([ADR 0022](./0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md)),
  and its history shows each change and why. Renamed codes are remembered, so
  a search by the old letters still finds the Spec ID.
- Rewording an option in use still changes what its Spec IDs mean, with no
  rewrite to show it. The suggestion shows how many saved Spec IDs use the
  option, so the approver can see the scale.
- The dictionary is no longer fixed between deploys. Anything that held it in
  memory must read it fresh, or be told when it changes.
- A suggestion that rewrites many Spec IDs makes one large transaction.
  Today's library holds hundreds of Spec IDs, not hundreds of thousands, so
  that is acceptable; it would be revisited if the library grew by orders of
  magnitude.

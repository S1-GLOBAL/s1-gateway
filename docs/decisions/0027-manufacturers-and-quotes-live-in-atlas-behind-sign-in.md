# 0027. Manufacturers and quotes live in Atlas, behind sign-in, and never in the repository

- **Status:** Accepted
- **Date:** 2026-10-22
- **Related:** [Issue #56](https://github.com/S1-GLOBAL/s1-gateway/issues/56) ·
  [Issue #57](https://github.com/S1-GLOBAL/s1-gateway/issues/57) ·
  [Plan 0006](../plans/0006-s2-spec-ids-and-verified-list-import.md) ·
  [ADR 0010](./0010-the-app-shell-is-cached-api-responses-never-are.md) ·
  [ADR 0022](./0022-saved-spec-ids-can-be-edited-and-every-change-is-recorded.md) ·
  [ADR 0026](./0026-raw-text-is-read-by-rules-and-a-public-word-list.md)

## Context

Staff who find a product in Atlas want to know who can make it: which
manufacturers have quoted, which are sampling it, which already produce it.
That knowledge lives in the verified list workbook, one row per product a
manufacturer offered, with the company and country in merged cells heading
each manufacturer's rows, and FOB prices, mold costs and lead times beside
each product. Atlas has none of it. reyxdz asked on 2026-10-22 for a
Manufacturers page on every Spec ID (#57), fed by the verified-list import
(#56).

It is the first time the Gateway would hold Source One's commercial data:
supplier names and prices. Two constraints shape where it may go. The
repository is public, so none of it may appear in code, tests, fixtures, docs
or screenshots (constraints §6). Every data route needs a signed-in session,
which is why a public staging deployment is acceptable (constraints §2), and
API responses are never cached in the browser (ADR 0010).

The workbook says whether a manufacturer has quoted, but not whether it is
sampling or already in mass production. That is known only to the people
working with it.

## Decision

- **Manufacturers and quotes are stored in the Gateway's database,** linked
  to saved Spec IDs, and served only to signed-in staff. A manufacturer is a
  company name and its country, one per name compared trimmed and ignoring
  case. A quote is one workbook row linked to a Spec ID: its item name, FOB
  price per unit, per case and total (USD), mold cost, and mold, sample and
  production lead times. Case packing, case weights and case dimensions are not
  stored.
- **The workbook is the source of truth for quotes.** `atlas:import --write`
  records them (plan 0006, phase 4), and a later `--write` replaces the quotes
  it recorded with the workbook's current rows. Every value is kept as text,
  exactly as the workbook writes it.
- **A manufacturer's stage on a Spec ID comes from two places.** The quotes
  give "Specifications received" or "Quoted". Only an admin can set
  "Sampling" or "In production", or clear them, in Atlas; each change records
  who, when, and the stage before and after; a re-import never changes it.
- **Every signed-in staff member sees manufacturers, stages and prices.**
  Changing a stage is the first change in Atlas only admins may make; Spec IDs
  stay editable by any staff member (ADR 0022).
- **None of it enters the repository.** Tests and screenshots use invented
  manufacturers, items and prices; the import's report stays on the machine
  that ran it; comments on GitHub give totals, never rows.

## Alternatives considered

- **Leave it in the workbook and link to it.** Nothing to build or protect,
  but staff would still search a 1,000-row sheet for each product, and there
  would be nowhere to record sampling and production. Rejected: the point is
  one page per product.
- **Read prices as numbers.** They could then be sorted and compared, but the
  workbook writes them several ways (one is noted as per 1000 pouches), and a
  number read from the wrong one would misstate a price. Rejected for now;
  values are shown as written.
- **Show prices to admins only.** It narrows who sees commercial terms.
  Rejected (reyxdz): staff read the same prices in the workbook today.
- **Let any staff member set Sampling and In production.** It matches how
  Spec IDs are edited. Rejected (reyxdz): a stage tells others a manufacturer
  is committed, so admins set it.
- **Add manufacturers and quotes by hand in Atlas now.** Rejected for this
  step: the import comes first, and editing is #61.

## Consequences

- The Gateway's database now holds supplier names and prices. Anyone with a
  signed-in session can read them, staging included, so an account or a
  session that leaks exposes them. Backups and database access deserve the
  same care as the workbook.
- The repository stays free of them only by discipline: invented test data,
  and the existing `pre-commit` and `pr-audit` checks for secrets do not catch
  a supplier's name.
- A quote changes only by changing the workbook and importing again, until
  #61 lets admins edit in Atlas.
- Prices kept as text cannot be sorted or compared by Atlas.
- Atlas now has two kinds of permission: any staff member for Spec IDs, admins
  for stages. Later admin-only changes follow this one.

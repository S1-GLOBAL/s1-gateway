# 0017. Quotations added in Atlas, approved by an admin

- **Status:** In progress
- **Owner:** reyxdz
- **Related:** [ADR 0027](../decisions/0027-manufacturers-and-quotes-live-in-atlas-behind-sign-in.md) ·
  [ADR 0031](../decisions/0031-the-dictionary-is-edited-by-suggestion-and-approval.md) ·
  [ADR 0035](../decisions/0035-quotations-added-in-atlas-wait-for-an-admin.md)

## Goal

Staff can add a quotation to a Spec ID from its manufacturers screen, with
**Add quotation**. Until now the only quotes came from the verified list. A
quotation added in Atlas waits for an admin's approval, the same way a
suggested dictionary change does. Only once approved does it join the Spec
ID's quotes, and its manufacturer's stage then follows it.

## Decisions (reyxdz, 2026-11-06)

- **Anyone signed in may add a quotation; an admin approves or rejects it.**
  Nobody decides their own, as with the dictionary (ADR 0031). While it waits,
  its suggester may edit or withdraw it. Every step is kept in its trail.
- **The manufacturer is one already in Atlas, or a new one** (a company name
  and country). A new manufacturer is created only when the quotation is
  approved. If a manufacturer of that name exists by then, the quotation joins
  it.
- **The manufacturer and FOB per unit are required.** The item name, FOB per
  case, FOB total, mold cost, and the sample, production and mold lead times
  are optional. Like an imported quote, each is kept as written, never read as
  a number.
- **Admins decide in two places:**
  - a **Quotation Changes** page beside Dictionary Changes, listing every
    waiting quotation with a count in the sidebar;
  - on the Spec ID's manufacturers screen, where its waiting quotations show,
    with **Approve** and **Reject** for admins.
- **An approved quotation is never replaced by an import.** `atlas:import
  --write` replaces only the quotes it imported. A quote added in Atlas
  remembers the quotation it came from.

## Phases

| Phase | What | Status |
|---|---|---|
| 1 | The backend: tables, the quotation's rules and trail, its routes, and an import that keeps Atlas's quotes | In progress |
| 2 | The frontend: Add quotation, the waiting quotations on the manufacturers screen, Quotation Changes and its count | Not started |

## Acceptance, phase 1

- [x] `POST /atlas/quote-suggestions` records a waiting quotation for a saved Spec ID from any signed-in staff, with an existing manufacturer or a new one; FOB per unit is required
- [x] Its suggester may edit it (`PUT`, with its version) or withdraw it while it waits; nobody else may
- [x] An admin who did not suggest it approves it, adding the quote, and the new manufacturer if it is new, in one transaction; or rejects it with a reason
- [x] `GET /atlas/quote-suggestions?state=waiting|decided&specId=` lists them; `GET /atlas/quote-suggestions/:id` answers one with its trail; `GET …/waiting-count` counts those the asker did not suggest
- [x] `GET /atlas/manufacturers` lists every manufacturer, for the form to choose from
- [x] `atlas:import --write` replaces only imported quotes, and keeps every quote added in Atlas

## Acceptance, phase 2

- [ ] **Add quotation** on a Spec ID's manufacturers screen opens a form: a manufacturer, chosen or new, and the quote's values
- [ ] The screen lists its waiting quotations; admins approve or reject them there
- [ ] **Quotation Changes** lists waiting and decided quotations, each with its trail; the sidebar counts those waiting for the viewer
- [ ] A suggester edits or withdraws a waiting quotation

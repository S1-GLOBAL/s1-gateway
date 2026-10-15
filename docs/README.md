# s1-gateway developer documentation

Documentation is split by **purpose**, not by feature. Each category answers a
different question, and mixing them is what turns a docs folder into a junk
drawer nobody reads twice.

| Category | Answers | Read it when | Write here when |
|---|---|---|---|
| [Getting started](./getting-started/) | "How do I get this running?" | Your first day | The setup steps change |
| [Guides](./guides/) | "How do I do X?" | You have a task in hand | You just did something non-obvious a second person will need to repeat |
| [Reference](./reference/) | "What is the exact value/name/signature?" | You need to look something up | You add an endpoint, table, variable, or script |
| [Explanation](./explanation/) | "Why is it shaped like this?" | You're about to change something structural | You understand a constraint others don't |
| [Decisions](./decisions/) | "Why did we choose this over that?" | You're about to re-litigate a past choice | You make a decision with consequences |
| [Plans](./plans/) | "How do we build this specific thing?" | You're implementing a planned feature | You're about to build something multi-step |
| [Handoffs](./handoffs/) | "Exactly how do I execute this issue here?" | You're picking up an issue cold | You brief someone else to carry out an issue end to end |

The UI design system lives separately, next to the code it governs:
[`frontend/DESIGN.md`](../frontend/DESIGN.md).

---

## The rule that keeps this useful

**Document the *why*, the *policy*, and what you cannot see from the code.**

Do not write file-by-file directory listings, prose restating function
signatures, or an architecture doc that repeats the folder structure. That
material is wrong within a month and duplicates what the code already says
accurately.

If you find yourself describing *what* the code does, stop — either the code
needs a better name, or the doc needs to explain *why* it does it.

---

## Decay

Different categories rot at different speeds. Treat them accordingly.

- **Getting started** rots fastest. Anyone who follows it and hits a snag should
  fix it in the same PR.
- **Reference** rots whenever code changes. Prefer generated reference over
  hand-written where the option exists — hand-maintained API docs are always
  wrong eventually.
- **Guides** rot slowly. They describe a workflow, not an implementation.
- **Explanation** and **decisions** barely rot. A decision that stops being true
  is marked superseded, never deleted — the reasoning stays valuable even when
  the conclusion changes.
- **Plans** are finished, not maintained. A shipped plan is marked Complete and
  left as the record of how that feature was built.

---

## Index

**Getting started**
- [Local setup](./getting-started/local-setup.md) — clone to running app

**Guides**
- [Add a module](./guides/add-a-module.md) — a new business noun, through every layer
- [Add a use case](./guides/add-a-use-case.md) — one more operation on an existing module
- [Change the database schema](./guides/change-the-database-schema.md)
- [Add a UI component](./guides/add-a-ui-component.md)
- [Add a page](./guides/add-a-page.md) — a new place in the sidebar, with its skeleton
- [Turn off the service worker](./guides/turn-off-the-service-worker.md) — the PWA kill switch
- [Open a pull request](./guides/open-a-pull-request.md) — what the pre-merge audit needs
- [Release to production](./guides/release-to-production.md) — moving `production` to `main`

**Reference**
- [API](./reference/api.md)
- [Data model](./reference/data-model.md)
- [Environment variables](./reference/environment.md)
- [Commands](./reference/commands.md)

**Explanation**
- [Architecture](./explanation/architecture.md)
- [Operating constraints](./explanation/constraints.md)

**Decisions**
- [Decision log](./decisions/)

**Handoffs**
- [Handoff index](./handoffs/)

**Plans**
- [Plan index](./plans/)
- [0001 — Project scaffold](./plans/0001-project-scaffold.md)

# Implementation plans

Step-by-step build plans with live checklists. Each plan tracks what is done and
what remains.

These differ from the other documentation categories:

| | Purpose | Lifespan |
|---|---|---|
| [Guides](../guides/) | How to do a *recurring* task | Permanent |
| [Decisions](../decisions/) | Why we chose something | Permanent |
| **Plans** | How to build *one specific thing, once* | Until shipped |

A plan is written to be executed, including by someone — or something — with no
prior context on this codebase. When a plan is fully shipped, mark it
**Complete** and leave it. It becomes the record of how that feature was built.

---

## Writing a plan

Copy `_template.md`. Number sequentially; never renumber.

**Commits made while executing a plan carry no AI attribution** — no
`Co-Authored-By` trailer, no "generated with" footer. See
[`CLAUDE.md`](../../CLAUDE.md).

**A plan must be executable without asking questions.** That means:

- **Exact file paths.** `backend/src/modules/tools/application/create-tool.ts`,
  not "the create-tool use case".
- **Complete file contents**, not fragments, wherever a file is created.
- **Exact commands**, with the directory to run them from.
- **Expected output** after each step, so the executor can tell success from
  failure without judgement.
- **One action per step.** If a step contains "and", it is probably two steps.
- **A checkbox on every step.**

Write the verification *before* the implementation where you can. A step whose
success cannot be checked is a step that will be reported done when it is not.

**State assumptions explicitly.** If a step depends on data or a decision that
does not exist yet, say so and mark the plan blocked rather than inventing it.

---

## Status values

| Status | Means |
|---|---|
| **Draft** | Being written. Do not execute |
| **Ready** | Executable now |
| **Blocked** | Cannot proceed. The blocker is named at the top |
| **In progress** | Partially executed. Checkboxes are current |
| **Complete** | Shipped and verified |

---

## Plans

| # | Plan | Status |
|---|---|---|
| [0001](./0001-project-scaffold.md) | Project scaffold | Complete except the browser checks of the PWA and the Tools page |
| [0002](./0002-visual-identity-and-motion.md) | Visual identity, motion and the app shell | Complete |
| [0003](./0003-atlas-spec-ids.md) | Atlas: read, build and save S1 Spec IDs | In progress |
| [0004](./0004-atlas-library-and-editable-spec-ids.md) | Atlas: a library, one workspace, and editable Spec IDs with History | In progress |
| [0005](./0005-account-invites.md) | Accounts by invite: a one-time registration link, and first and last names | In progress |
| [0006](./0006-s2-spec-ids-and-verified-list-import.md) | S2 Spec IDs, a dictionary from the verified list, and its import | In progress |

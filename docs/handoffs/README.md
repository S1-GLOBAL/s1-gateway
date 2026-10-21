# Handoffs

A handoff is a complete, step-by-step brief for an agent or contributor who
picks up one issue cold. It names every file to touch, every check to run, and
when to stop and ask. A plan says *what* to build; a handoff says exactly *how
to execute it* in this repository, down to the pull request description.

Like plans, handoffs are finished, not maintained. Once the issue ships, the
handoff stays as the record of how the work was briefed. Line numbers and
commit hashes in an old handoff will have drifted; never execute one without
checking its "ground truth" section against `main` first.

| Handoff | Issue | Status |
|---|---|---|
| [Visual identity, motion and the app shell](./plan-0002-visual-identity-and-motion.md) | Plan 0002 | Complete |
| [Search Atlas with raw product text, phase 2](./issue-41-library-search.md) | #41 | Complete |
| [Save a new Spec ID from Search](./issue-48-save-from-search.md) | #48 | Complete |

Name a new handoff `issue-<number>-<short-title>.md` and add a row here. A handoff
for a plan with no issue is named `plan-<number>-<short-title>.md`.

# PR reviews

One file per reviewed pull request, named `pr-<number>.md`.

A review is a **point-in-time** artifact: it records what the code looked like
at a specific head, and is not updated as the PR changes. See the PR itself for
what was ultimately addressed.

**Reviews are deleted once fully actioned.** Anything durable — a fix, a rule,
a decision to decline — belongs in the code, an ADR, a session log or
[current-state.md](../current-state.md), not in a stale review file. The
session log for the review and the session log for the fixes together record
that it happened.

# Issue tracker

Build issues are tracked as **GitHub Issues** on the repo. PRDs and specs live
as committed markdown under `docs/specs/`.

## Conventions

- **PRDs / specs:** `docs/specs/<feature-slug>/PRD.md`
- **Build issues:** GitHub Issues, linked from the
  [V1 Tech Design](../specs/v1-tech-design.md) § Build sequence.
- **Triage state:** managed via GitHub issue labels and status.

## When a skill says "publish to the issue tracker"

Create a GitHub issue via `gh issue create`. Link it from the tech design doc
if it's part of the build sequence.

## When a skill says "fetch the relevant ticket"

Use `gh issue view <number>` or read the linked spec file.

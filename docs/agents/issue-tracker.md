# Issue tracker: Local Markdown (committed under docs/)

Issues, PRDs, and wayfinder maps for this repo live as committed markdown files
under `docs/` — not GitHub Issues. Keep them in the repo so they diff alongside
the code.

## Conventions

- **PRDs / features:** `docs/specs/<feature-slug>/PRD.md`; implementation issues
  `docs/specs/<feature-slug>/issues/NN-<slug>.md`, numbered from `01`.
- **Triage state:** a `Status:` line near the top of each issue file (role
  strings in [triage-labels.md](./triage-labels.md)).
- **Comments:** append under a `## Comments` heading at the bottom of the file.

## When a skill says "publish to the issue tracker"

Create the file under the path above (creating directories as needed) and commit
it. There is no `gh`/API round-trip.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or
the issue number directly.

## Wayfinding operations (`/wayfinder`)

The **map** is a file with one **child** file per ticket.

- **Map:** `docs/wayfinder/<effort>/map.md` — Destination / Notes /
  Decisions-so-far / Not-yet-specified / Out-of-scope body.
- **Child ticket:** `docs/wayfinder/<effort>/issues/NN-<slug>.md`, numbered from
  `01`, with the question in the body. Front-matter lines near the top:
  - `Type:` — one of `research` / `prototype` / `grilling` / `task`
  - `Status:` — `open` / `claimed` / `resolved`
  - `Blocked by: NN, NN` — the tickets that must be `resolved` first (omit if none)
- **Frontier:** scan `docs/wayfinder/<effort>/issues/` for files that are `open`,
  unclaimed, and whose every `Blocked by` ticket is `resolved`; lowest number wins.
- **Claim:** set `Status: claimed` and save before any work.
- **Resolve:** append the answer under an `## Answer` heading, set
  `Status: resolved`, then append a one-line context pointer (gist + link) to the
  map's Decisions-so-far in `map.md`.

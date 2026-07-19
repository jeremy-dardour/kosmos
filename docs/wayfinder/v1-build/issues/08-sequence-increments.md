<!-- wayfinder:task -->

# Sequence V1 into ordered increment-specs

Type: task
Status: open
Blocked by: 04, 05, 06, 07

## Question

With every cross-cutting decision made (schema, API, auth, deployment, UI
slices), decompose V1 into an **ordered sequence of buildable increments** — the
map's destination.

Do:

- Order the work **walking-skeleton-first**: stand up a thin end-to-end vertical
  early (deploy + auth + one real Workstream advancing through the API and
  rendering on the overview), then fill features increment by increment.
- For each increment, name it and state its scope tightly enough to hand to
  `/to-spec`, plus its dependencies and its test seam (default: API HTTP e2e per
  the `item` reference).
- Sanity-check the sequence against the decisions — no increment should need a
  decision that isn't yet made.

Output: the ordered increment list. **Graduates** each increment into a
follow-on ticket (`/to-spec` → `docs/specs/<feature>/PRD.md`), which clears the
"individual increment PRDs" fog on the map.

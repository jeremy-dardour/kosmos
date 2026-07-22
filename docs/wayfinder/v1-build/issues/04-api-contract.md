<!-- wayfinder:grilling -->

# API contract: pipeline actions & overview read model

Type: grilling
Status: resolved
Blocked by: 01

## Question

Design the REST API for V1, following the template's DTO/module conventions
([apps/api/STANDARDS.md](../../../apps/api/STANDARDS.md)) and the schema from
ticket 01.

Decide:

- **State-machine actions** — how `start` and `advance(outcome)` are expressed
  (e.g. `POST /workstreams/:id/advance` with an outcome body, `POST .../start`)
  vs. pure-REST patching. Keep the "one authoritative module" as the only writer
  of pointer state (ADR 0005).
- **Overview read model** — a single aggregate GET returning
  Project → Groups → Workstreams → Steps for the Pipeline Stack, or several
  calls? How derived state (Workstream lifecycle, per-Step status, countdowns) is
  surfaced to the client.
- **DTO shapes** — input (create/update) + output DTOs for each resource;
  mutability rules from Decision 33 (future-only edits) at the API boundary.
- **CRUD surface** — Projects, Workstreams, Steps, Groups, Notes, sub-items,
  owners; what's editable vs. derived.
- **Contracts** — validation/error shape (RFC 9457, existing filters),
  pagination (likely none at 20–50 workstreams).

Output: the endpoint list + DTO shapes. Input to _Overview UI build slices_ and
_Sequence V1_.

## Answer

Full API contract in [docs/specs/api-contract/PRD.md](../../../specs/api-contract/PRD.md).
One overview aggregate read, named RPC actions for start/advance, flat CRUD for
sub-entities, all derived state computed server-side.

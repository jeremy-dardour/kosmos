<!-- wayfinder:map -->

# Map: V1 Build

## Destination

V1 of the wedding-planner is decomposed into an **ordered sequence of buildable
increment-specs** — each ready to hand to an implementation agent — with every
cross-cutting decision resolved first: the concrete data model/schema, the API
contract, Google-OAuth + `.env`-allowlist auth, the overview UI build slices, and
**deployment/hosting/CI/infra** (V1 is not "done" until it can be stood up).

This is a **planning** destination: tickets _decide and spec_; they do not build.
The map is complete when nothing is left to decide and the increment PRDs are
written.

## Notes

- **Domain:** wedding-planner — a pipeline tracker for wedding-prep workstreams.
  Read [CLAUDE.md](../../../CLAUDE.md) (documentation map), [CONTEXT.md](../../../CONTEXT.md)
  (glossary), [docs/domain-decisions.md](../../domain-decisions.md) (Decisions
  1–40), and [ADR 0005](../../adr/0005-workstream-pipeline-state-machine.md) (the
  pipeline state machine — the heart of the model). The domain model is
  **complete**; no open domain questions.
- **Skills per ticket type:** grilling → `/grilling` + `/domain-modeling`;
  research → `/research`; UI shape → `/prototype`; graduated PRDs → `/to-spec`.
- **Standing preferences:** simplicity wins (the whole model was cut that way);
  planning not execution; artifacts stay in-repo (local-markdown tracker under
  `docs/`); use `CONTEXT.md` vocabulary; no `Co-Authored-By` in commits.
- **Stack facts:** NestJS + MikroORM 7 (Postgres) API, React + Vite web, pnpm
  monorepo. Reference vertical slice = the `item` module. Highest test seam =
  API HTTP e2e (`apps/api/src/__e2e-tests__/*.e2e-spec.ts`). Migrations run at
  container start (ADR 0001).

## Decisions so far

<!-- one line per resolved ticket: gist + link. Empty until the first resolves. -->

## Not yet specified

- **The individual increment PRDs** — graduate once _Sequence V1 into ordered
  increment-specs_ defines the slices; each written via `/to-spec` into
  `docs/specs/<feature>/PRD.md`.
- **UI language / i18n** — French vs English (template has i18n wired); sharpen
  during _Overview UI build slices_.
- **Workstream icon representation** — emoji vs asset/icon set (Decision 25);
  sharpen during _Concrete data model & schema_ or _Overview UI build slices_.

## Out of scope

- Post-V1 deferred features — structured Dependencies (Decision 36), roles
  (Decision 18), push/email notifications (Decision 27), multi-project reuse
  (Decision 28). Recorded in the decisions log; not part of building V1.

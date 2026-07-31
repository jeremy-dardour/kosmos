# PR #48 — deviations & new-standard log

Everything in the #40 implementation that deviated from a spec/standard as
written, or established a new pattern, with the why. Kept current by the
orchestrator; raised as a PR comment when the PR is complete; delete once
actioned (per the docs/reviews convention). **Nothing here is accidental** —
each entry was a reviewed decision; this log exists so none of them slips
through as one.

## New standards / patterns established

1. **ADR 0008 — `em`-parameterized query functions** (`repositories/<concern>.query.ts`).
   New pattern, user-prompted, documented in `apps/api/STANDARDS.md` + ADR.
   Why: queries that must join a repository's forked transaction can't live on
   injected repositories.
2. **Single-phase ordered renumbering under deferred constraints** (C2–C6).
   The plan/contract claimed the unique position constraints "are not
   deferrable" and required two-phase temporary positions — false: C2
   generated them `deferrable initially deferred`, matching the existing
   step/checklist idiom. Both docs amended (commit `0f36f3b`); every reorder
   is single-phase in one locked transaction.
3. **Repository "order callback" idiom** (C3): `reorderProject` /
   `reorderScope` accept an ordering callback that runs inside the locked
   transaction; services decide order/membership (and throw the 409 there so
   it rolls back), repositories own lock + load + renumber. Not written into
   STANDARDS.md — consider whether it should be.
4. **Two coexisting web refresh models** (C10): legacy per-mutation
   invalidation for pre-rework components, the cache seam
   (`src/api/overview-cache.ts`) for inline-overview hooks.
   `apps/web/STANDARDS.md` § API layer amended in the same commit. The legacy
   half dies in C18.
5. **`pnpm format:check` joined the per-commit gates** (user instruction,
   session 33) and `tsc -b --force` is required for web typechecks after
   generated-type changes (turbo's incremental buildinfo false-passed once).

## Deviations from a literal spec reading (all deliberate)

6. **Group create appends at the END of the project** (C2). The contract only
   specifies top-insertion for workstreams; groups append (`max+1`,
   hole-safe). Rationale: new groups are rarer and a group jumping above
   existing ones on create felt wrong; recorded in session 33. Not explicitly
   in the contract — flag if you want it there.
7. **Workstream reorder membership = live workstreams only; Complete siblings
   trail the live tail** (C3). The contract's DTO comment said "every live
   workstream"; the trailing-complete renumbering rule was my resolution of
   the resulting position-collision ambiguity. Amended into the contract
   §Manual ordering (commit `0f36f3b`).
8. **`blocked` PATCH semantics ported, not per-contract-comment** (C4). The
   contract comment says `blocked?: boolean // current step only`; the
   implementation accepts it on current AND future steps (inert off the
   pointer) and rejects only frozen steps — byte-identical to the legacy
   whole-tail PUT's semantics. Rationale: port, don't invent a new rejection;
   the flag is informational by domain rule.
9. **Complete workstream → 409 `step-frozen` on reorder/insert** (C4/C5),
   rather than an empty-membership no-op or a dedicated slug. Consistent
   across all step/checklist guards; pinned by tests.
10. **Granular step/checklist ops bump workstream `updatedAt`**
    (`touchWorkstream`, C4–C6) so the legacy whole-tail PUT's
    `expectedUpdatedAt` token notices granular edits. Temporary coupling by
    design; meaningless after C18 removes the token.
11. **`OverviewPatch` union has 8 variants, not the plan's 2** (C10). The plan
    sketched "StepDto or WorkstreamDto"; C4–C6's real responses include
    `ChecklistItemDto` and 204s, and note counts patch as deltas. A two-shape
    seam would leave checklist/note writes invisible for ~2s. Callers never
    see the union (single `useOverviewCache` entry point).
12. **Urgency token set is transitionally half-old/half-new** (C8): existing
    `calm`/`soon`/`late` tokens kept (their consumers die in C18), new
    `fortnight`/`month` tokens added. Full rename deferred to C18 —
    deliberately not done mid-phase to avoid touching four doomed components.
13. **Temporary dual hook exports** (C13, C14): `useAdvanceWorkstreamInline`
    (and the C14 workstream-update equivalent) exist alongside the legacy
    invalidating hooks while old components live; each carries a comment;
    both collapse in C18.
14. **New card is `inline-workstream-card.tsx`, not a `workstream-card.tsx`
    rewrite** (C14). The plan's literal filename collides with the old card,
    which must keep rendering until C18. The `inline-` name is final (no
    rename planned after C18) — flag if you want the plain name back
    post-C18.
15. **A16 hides Start on empty pipelines** (C13), which made one Slice 3
    scenario unportable as written ("start an empty workstream → 409
    workstream-empty"): there is no button to click. Became hidden-when-empty;
    the Problem Details path is covered by the not-advanceable 409 scenario.
16. **`can-append-step.ts` is its own module** (C12) purely because
    `react-refresh/only-export-components` forbids non-component exports from
    component files. Mechanical, not architectural.
17. **`NotFoundException` thrown from inside the persistence seam**
    (`lock-workstream-graph.query.ts`, C4/C6): the locked-graph re-read 404s
    when the entity vanished between lookup and lock. A NestJS exception in a
    repository-layer helper — consistent with the pre-existing repository
    idiom, but note it if the seam is ever meant to be framework-free.
18. **Card selection callbacks are `onOpenStep(stepId | null)` /
    `onOpenNotes(stepId | null)`, not toggles** (C15). The C14 sketch had
    toggle-shaped callbacks; the step editor's footer needs "close" and
    "navigate to sibling", which a toggle cannot express. The card derives
    dot/marker toggling itself.
19. **`use-step-notes.ts` and `step-mutability.ts` exist as separate modules**
    (C15): the hook because `react-refresh/only-export-components` errors on
    hook exports from `.tsx` component files; the predicates following the
    established one-predicate-per-module idiom. `note-thread.tsx` carries a
    URL-linkifying `NoteBody` that duplicates the one in the doomed
    `step-notes.tsx` — C18 must delete the old copy.
20. **Workstream deletion lost its only UI entry point** (C17). The detail
    panel hosted both "edit workstream" (now redundant — every field is live
    on the card) and "delete workstream" (ConfirmDialog + useDeleteWorkstream).
    The handoff never gives the card a delete affordance (§4.2 assumed the
    existing dialogs kept handling it, but the entry point WAS the panel), so
    the agent unwired rather than invent UI. **DECISION NEEDED**: accept the
    gap for V1 or add a minimal card-level delete (recommend: carry into C19
    with the existing ConfirmDialog). **RESOLVED 2026-08-01 (user)**: bin icon
    at the far right of the card header, hover/focus-revealed like the drag
    handle, opening the existing ConfirmDialog — implemented in C19; handoff
    A2 amended.
21. **Ghost steps are a dedicated panel, not `StepEditor` with
    `isPersisted={false}`** (C17). Every StepEditor control mutates a step id
    the server doesn't have; the ghost needs exactly one input. `isPersisted`
    is now unused in step-editor.tsx — C18 drops it.
22. **Old page-level integration specs deleted with their UI** (C17):
    `overview-workstream-actions` (8 tests — all duplicated in
    `advance-control.spec`), `notes-actions` (5 — ported to `note-thread.spec`
    except the delete-confirmation dialog, which died by design: C15 deletes
    inline), `pipeline-editing` (8 — covered across `pipeline-row.spec` /
    `step-editor.spec`; whole-tail atomicity + `expectedUpdatedAt` staleness
    died with the model per §6.2). Every surviving behaviour was mapped to its
    new home in the C17 report.
23. **`useCurrentDate` does not exist** despite the plan/current-state citing
    it (session 28's extraction isn't in the tree); the page reads one clock
    at render like the old cards did. The known "stale urgency on a long-lived
    tab" issue (§9) remains — unchanged from production.

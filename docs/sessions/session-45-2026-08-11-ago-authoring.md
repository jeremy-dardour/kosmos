# Session 45 — AGO assistant: workstream authoring (2026-08-11)

## What was done

- Challenged the [authoring build plan](../specs/ago-assistant/authoring-build-plan.md)
  against the [PRD](../specs/ago-assistant/PRD.md); seven findings, six decided
  by the user and folded into both docs (see Decisions).
- Implemented all ten build-plan steps via parallel Opus subagents, committed
  step by step: mutation seam (`551a0f3`), context layer + guide (`b88855c`),
  page-state controls (`794849c`), the four authoring functions replacing
  `listProjects`/`listMembers` with auto-continue removed (`9d0df5f`), and the
  registration integration test (`af26e70`). 67 handler unit tests + 1
  integration test walking list → overview → list against the real router.
- Added the signed-in-user marker mid-flight on user request: the `project`
  context entry marks the member line `(you)` so "assign it to me" resolves to
  an id (`fd645ca`).
- Ran the full review battery (two-axis `/code-review`, security over the whole
  branch, simplification via `codebase-design`), triaged ~20 findings, actioned
  the accepted ones (`2a9af03`), aligned standards + specs (`33af68d`).
- Filed [#68](https://github.com/jeremy-dardour/kosmos/issues/68) — owner-filter
  semantics and whether overview filters belong in the URL.

## Decisions

- Six plan corrections, recorded in the
  [build plan](../specs/ago-assistant/authoring-build-plan.md) (T9, T10,
  amended T2/T3/T5/T6) and [PRD](../specs/ago-assistant/PRD.md) (D3, the
  two-turn wrong-page journey): partial failures return an outcome report
  instead of rolling back; auto-continue after navigation removed; write
  handlers await the overview refetch before returning; no-event-date is a
  defined error; context lines lead with ids; confirmation lives in
  `createWorkstream`'s own description.
- Review triage: sanitize user-authored names entering context lines
  (newline-forging); complete workstreams compact to one id+name line so
  `getWorkstream` can reach them; `editableFrom` is the insertion boundary
  only; member emails never sent as a name fallback; `.env.example` ships with
  the assistant off. Rejected: reverting hooks to `$api.useMutation`
  (documented the imperative seam in
  [web STANDARDS](../../apps/web/STANDARDS.md) instead), approval gates
  (stays deferred per PRD D2).

## Learnings / tensions surfaced

- `openapi-react-query`'s `useMutation` wrapper `Omit`s `mutationFn`, so hooks
  sharing an implementation with imperative functions must drop to raw
  TanStack `useMutation` — now a documented standard.
- The SDK's `useAgoNavigation` bakes in its own function description and
  result wording; ending the turn after navigation (T10) required hand-rolling
  `navigateToPage` from the `nav-routes` manifest. Its `current-page` context
  entry (route name) was lost with it — `pageContext="auto"` still sends URL +
  title.
- `@useago/sdk` and `@useago/sdk/react` declare two incompatible `AgoClient`
  classes — derive the client type from the hook's return, never import it.
- Security posture confirmed: production never receives `VITE_AGO_BASE_URL`
  (Dockerfile/CD pass only two build args), the SDK gets no Kosmos
  credentials, and note bodies never leave the app. Prompt-injection blast
  radius is members-only tamper on an additive, server-revalidated surface.
- Node 25 ships an unusable `localStorage` global that shadows jsdom's;
  `vi.stubGlobal('localStorage', …)` is required for SDK-touching tests.

## Status at end of session

Workstream authoring is fully implemented, reviewed, and green (510 web tests;
full battery passing) on `feat/ago-sdk` — the assistant can see the project,
author and extend workstreams, steer the view, and knows who it is talking to.
Still not seen in a browser: build-plan step 10 (authoring end-to-end, the
two-turn cross-page journey, panel width) is the next action, then a decision
on `pageContext="auto"` and the split availability gating. Mirrored into
[current-state.md](../current-state.md).

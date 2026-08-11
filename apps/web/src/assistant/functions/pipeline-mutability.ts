import type { Step, Workstream } from '@/api/hooks/use-overview';

export type InsertionResolution =
  | { ok: true; position: number }
  | { ok: false; error: string };

export const currentStepOf = (workstream: Workstream): Step | undefined =>
  workstream.steps.find((step) => step.id === workstream.currentStepId);

/**
 * The first 1-indexed position that accepts a new step: one past the pointer,
 * which is 0 while a workstream is NotStarted. A Complete workstream has no
 * such position. This is the insertion boundary only — the current step is
 * still editable in place, just never movable.
 */
export function editableFrom(workstream: Workstream): number | null {
  if (workstream.lifecycle === 'complete') return null;

  return (currentStepOf(workstream)?.position ?? 0) + 1;
}

export function resolveInsertionPosition(
  workstream: Workstream,
  after: unknown,
): InsertionResolution {
  const from = editableFrom(workstream);
  if (from === null) {
    return {
      ok: false,
      error: `"${workstream.name}" is complete, so no steps can be added to it. Nothing was changed.`,
    };
  }

  if (after === 'end') {
    return { ok: true, position: workstream.steps.length + 1 };
  }

  if (typeof after !== 'string') {
    return {
      ok: false,
      error: 'Pass `after` as the id of the step to insert behind, or "end".',
    };
  }

  const anchor = workstream.steps.find((step) => step.id === after);
  if (!anchor) {
    return {
      ok: false,
      error: `No step with id "${after}" in "${workstream.name}". Step ids come from getWorkstream.`,
    };
  }

  const position = anchor.position + 1;
  if (position < from) {
    return {
      ok: false,
      error: `"${anchor.name}" is already past, so nothing can be inserted directly after it. Steps may only be added from position ${from} on — anchor on the current step or a later one, or use "end". Nothing was changed.`,
    };
  }

  return { ok: true, position };
}

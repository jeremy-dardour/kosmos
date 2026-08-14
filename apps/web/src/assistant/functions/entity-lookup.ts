import type { Overview, Step, Workstream } from '@/api/hooks/use-overview';

export type WorkstreamResolution =
  | { ok: true; workstream: Workstream }
  | { ok: false; error: string };

export type StepResolution =
  | { ok: true; workstream: Workstream; step: Step }
  | { ok: false; error: string };

export function requireWorkstream(
  overview: Overview,
  workstreamId: unknown,
): WorkstreamResolution {
  const workstream = overview.workstreams.find(
    (candidate) => candidate.id === workstreamId,
  );
  if (!workstream) {
    return {
      ok: false,
      error: `No workstream with id "${String(workstreamId)}" in this project. Ids come from the workstreams context.`,
    };
  }

  return { ok: true, workstream };
}

export function requireStep(
  overview: Overview,
  stepId: unknown,
): StepResolution {
  for (const workstream of overview.workstreams) {
    const step = workstream.steps.find((candidate) => candidate.id === stepId);
    if (step) return { ok: true, workstream, step };
  }

  return {
    ok: false,
    error: `No step with id "${String(stepId)}" in this project. Step ids come from getWorkstream.`,
  };
}

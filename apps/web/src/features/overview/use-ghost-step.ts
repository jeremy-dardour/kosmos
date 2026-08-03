import { useCallback, useState } from 'react';

import { useCreateStep } from '@/api/hooks/use-create-step';
import { formatToApiError } from '@/errors/format-error';

import type { GhostStepDraft } from '@/features/overview/ghost-step';

interface GhostPosition {
  workstreamId: string;
  /** 1-indexed, as `CreateStepDto` takes it. */
  position: number;
  name: string;
}

/**
 * The one unsaved step the overview may hold. It lives above the cards so that
 * opening an insert point anywhere replaces it — a second ghost would be a
 * second place to type a step nobody asked for (handoff A8). A committed name
 * flows straight into the created step's editor via `onCreated`.
 */
export function useGhostStep(
  projectId: string | undefined,
  onCreated: (workstreamId: string, stepId: string) => void,
): {
  draft: GhostStepDraft | null;
  insertAt: (workstreamId: string, position: number) => void;
} {
  const createStep = useCreateStep(projectId);
  const [ghost, setGhost] = useState<GhostPosition | null>(null);

  const insertAt = useCallback((workstreamId: string, position: number) => {
    setGhost({ workstreamId, position, name: '' });
  }, []);

  const discard = useCallback(() => setGhost(null), []);

  const commit = (name: string) => {
    if (!ghost) return;
    if (!name) {
      setGhost(null);
      return;
    }

    setGhost({ ...ghost, name });
    createStep.mutate(
      {
        params: { path: { id: ghost.workstreamId } },
        body: { name, position: ghost.position },
      },
      {
        onSuccess: (workstream) => {
          setGhost(null);
          // The response is the whole renumbered workstream; the new step is
          // the one holding the position the ghost claimed.
          const created = workstream.steps.find(
            (step) => step.position === ghost.position,
          );
          if (created) onCreated(ghost.workstreamId, created.id);
        },
        onError: (error) => {
          // The position stopped being insertable — somebody advanced the
          // pipeline meanwhile — so the ghost has nowhere left to land. Every
          // other rejection keeps the typed name on screen to retry, and the
          // global Problem Details dialog carries the reason either way.
          const problemType = formatToApiError(error)?.problemType;
          if (problemType?.endsWith('/step-insertion-illegal')) {
            setGhost(null);
          }
        },
      },
    );
  };

  return {
    draft: ghost && {
      workstreamId: ghost.workstreamId,
      name: ghost.name,
      isPending: createStep.isPending,
      onCommit: commit,
      onDiscard: discard,
    },
    insertAt,
  };
}

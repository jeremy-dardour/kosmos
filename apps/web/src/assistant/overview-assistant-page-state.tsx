import { useAgoPageState } from '@useago/sdk/react';

import { OWNER_FILTER_ALL } from '@/features/overview/filter-constants';

import type { Workstream } from '@/api/hooks/use-overview';
import type { Selection } from '@/features/overview/selection.types';

const toStringValue = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(
        (item): item is string => typeof item === 'string',
      )
    : [];

interface OverviewAssistantPageStateProperties {
  workstreams: Workstream[];
  ownerFilter: string;
  onOwnerFilterChange: (ownerId: string) => void;
  hiddenGroupIds: ReadonlySet<string>;
  onHiddenGroupIdsChange: (groupIds: ReadonlySet<string>) => void;
  openStep: Selection | null;
  onExpandStep: (selection: Selection) => void;
}

/**
 * The overview's page-scoped view controls. Mounted only while the overview is
 * on screen, so they register on arrival and unregister on navigation away.
 */
export const OverviewAssistantPageState = ({
  workstreams,
  ownerFilter,
  onOwnerFilterChange,
  hiddenGroupIds,
  onHiddenGroupIdsChange,
  openStep,
  onExpandStep,
}: OverviewAssistantPageStateProperties) => {
  useAgoPageState([
    {
      name: 'ownerFilter',
      description:
        'Show only the workstreams whose current step is owned by one person. Takes that person\'s user id, or "all" to clear the filter. Setting it only changes what the user sees — use `updateStep` to change who owns a step.',
      schema: { type: 'string' },
      get: () => ownerFilter,
      set: (value) =>
        onOwnerFilterChange(toStringValue(value) ?? OWNER_FILTER_ALL),
    },
    {
      name: 'hiddenGroupIds',
      description:
        'Hide whole groups from the overview. Takes the full list of group ids to hide and replaces the current list, so pass every id that should stay hidden, or an empty list to show all groups. Setting it only changes what the user sees — no group or workstream is deleted or moved.',
      schema: { type: 'array', items: { type: 'string' } },
      get: () => [...hiddenGroupIds],
      set: (value) => onHiddenGroupIdsChange(new Set(toStringArray(value))),
    },
    {
      name: 'expandedStep',
      description:
        'Expand one step on the overview and scroll its workstream into view, so the user is looking at the step under discussion. Takes a step id. Setting it only changes what the user sees — use `updateStep` to change the step itself.',
      schema: { type: 'string' },
      get: () => openStep?.stepId ?? null,
      set: (value) => {
        const stepId = toStringValue(value);
        if (!stepId) return;

        const workstream = workstreams.find((w) =>
          w.steps.some((step) => step.id === stepId),
        );
        if (!workstream) return;

        onExpandStep({ workstreamId: workstream.id, stepId });
      },
    },
  ]);

  return null;
};

import { fetchOverview } from '@/api/hooks/use-overview';
import { requireWorkstream } from '@/assistant/functions/entity-lookup';
import { asFunctionParameters } from '@/assistant/functions/function-parameters';
import { editableFrom } from '@/assistant/functions/pipeline-mutability';
import { LIFECYCLE_LABEL } from '@/assistant/lifecycle-label';

import type { Overview, Step, Workstream } from '@/api/hooks/use-overview';
import type { QueryClient } from '@tanstack/react-query';
import type { ClientFunctionDefinition } from '@useago/sdk';

const STATUS_LABEL = {
  not_started: 'NotStarted',
  in_progress: 'InProgress',
  done: 'Done',
  skipped: 'Skipped',
} as const;

const toStepDetail = (step: Step, userNamesById: Map<string, string>) => ({
  stepId: step.id,
  position: step.position,
  name: step.name,
  status: STATUS_LABEL[step.status],
  deadline: step.deadline ?? null,
  ownerName: step.effectiveOwnerId
    ? (userNamesById.get(step.effectiveOwnerId) ?? null)
    : null,
  blocked: step.blocked,
  checklist: step.checklistItems.map((item) => ({
    id: item.id,
    name: item.name,
    done: item.done,
  })),
  noteCount: step.noteCount,
});

export function toWorkstreamDetail(workstream: Workstream, overview: Overview) {
  const userNamesById = new Map(
    overview.users.map((user) => [user.id, user.name]),
  );

  return {
    workstreamId: workstream.id,
    name: workstream.name,
    icon: workstream.icon,
    lifecycle: LIFECYCLE_LABEL[workstream.lifecycle],
    group:
      overview.groups.find((group) => group.id === workstream.groupId)?.name ??
      null,
    ownerName: workstream.ownerId
      ? (userNamesById.get(workstream.ownerId) ?? null)
      : null,
    currentStepId: workstream.currentStepId ?? null,
    editableFrom: editableFrom(workstream),
    steps: workstream.steps.map((step) => toStepDetail(step, userNamesById)),
  };
}

const definition: Omit<ClientFunctionDefinition, 'handler'> = {
  name: 'getWorkstream',
  description:
    'Read one workstream of the project on screen in full: every step with its status, deadline, owner, blocked flag, checklist items and note count, plus `editableFrom` — the first position that accepts new steps (null when the workstream is complete, so none can be added). Editing is wider than insertion: the step in progress can be edited, never moved, and only steps already done or skipped are frozen. Use it before adding to or changing a workstream, and to read a complete one, which the context only names. Note bodies are never returned.',
  parameters: asFunctionParameters({
    type: 'object',
    properties: {
      workstreamId: {
        type: 'string',
        description:
          'The workstream id, from the workstreams context or an earlier result.',
      },
    },
    required: ['workstreamId'],
  }),
};

export const getWorkstreamFunction = (
  queryClient: QueryClient,
  projectId: string,
): ClientFunctionDefinition => ({
  ...definition,
  handler: async (arguments_) => {
    const overview = await fetchOverview(queryClient, projectId);
    const found = requireWorkstream(overview, arguments_.workstreamId);
    if (!found.ok) return { error: found.error };

    return toWorkstreamDetail(found.workstream, overview);
  },
});

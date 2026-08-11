import type { Overview, Workstream } from '@/api/hooks/use-overview';
import type { ContextEntry } from '@useago/sdk';

const LIFECYCLE_LABEL = {
  not_started: 'NotStarted',
  active: 'Active',
  complete: 'Complete',
} as const;

interface LineContext {
  groupNamesById: Map<string, string>;
  userNamesById: Map<string, string>;
}

function toLine(
  workstream: Workstream,
  { groupNamesById, userNamesById }: LineContext,
): string {
  const parts = [
    `${workstream.id} ${workstream.name} [${LIFECYCLE_LABEL[workstream.lifecycle]}]`,
  ];

  const currentStep = workstream.steps.find(
    (step) => step.id === workstream.currentStepId,
  );

  if (currentStep) {
    parts.push(
      `${currentStep.position}/${workstream.steps.length} ${currentStep.id} "${currentStep.name}"`,
    );
    if (currentStep.deadline) parts.push(`due ${currentStep.deadline}`);
    if (currentStep.blocked) parts.push('blocked');
  } else {
    parts.push(`${workstream.steps.length} steps`);
  }

  const ownerId = currentStep?.effectiveOwnerId ?? workstream.ownerId;
  const ownerName = ownerId ? userNamesById.get(ownerId) : undefined;
  if (ownerName) parts.push(`owner ${ownerName}`);

  const groupName = workstream.groupId
    ? groupNamesById.get(workstream.groupId)
    : undefined;
  if (groupName) parts.push(`group ${groupName}`);

  return parts.join(' · ');
}

export function buildWorkstreamsContext(overview: Overview): ContextEntry {
  const lineContext: LineContext = {
    groupNamesById: new Map(overview.groups.map((g) => [g.id, g.name])),
    userNamesById: new Map(overview.users.map((u) => [u.id, u.name])),
  };

  const lines = overview.workstreams
    .filter((workstream) => workstream.lifecycle !== 'complete')
    .map((workstream) => toLine(workstream, lineContext));

  const completeCount = overview.workstreams.filter(
    (workstream) => workstream.lifecycle === 'complete',
  ).length;
  if (completeCount > 0) {
    lines.push(`${completeCount} complete (not listed)`);
  }

  return {
    name: 'Workstreams',
    description:
      'Every workstream of the current project that is not complete, one per line: <workstreamId> <name> [lifecycle] · <currentStepPosition>/<totalSteps> <currentStepId> "<currentStepName>" · due <date> · blocked · owner <name> · group <name>, with the trailing segments present only when they apply. Complete workstreams are counted, not listed — read one with `getWorkstream`.',
    data: {
      workstreams: lines.length > 0 ? lines.join('\n') : 'no workstreams',
    },
  };
}

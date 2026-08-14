import { sanitizeLine } from '@/assistant/context/sanitize-line';
import { currentStepOf } from '@/assistant/functions/pipeline-mutability';
import { LIFECYCLE_LABEL } from '@/assistant/lifecycle-label';

import type { Overview, Workstream } from '@/api/hooks/use-overview';
import type { ContextEntry } from '@useago/sdk';

interface LineContext {
  groupNamesById: Map<string, string>;
  userNamesById: Map<string, string>;
}

function toLine(
  workstream: Workstream,
  { groupNamesById, userNamesById }: LineContext,
): string {
  const parts = [
    `${workstream.id} ${sanitizeLine(workstream.name)} [${LIFECYCLE_LABEL[workstream.lifecycle]}]`,
  ];

  const currentStep = currentStepOf(workstream);

  if (currentStep) {
    parts.push(
      `${currentStep.position}/${workstream.steps.length} ${currentStep.id} "${sanitizeLine(currentStep.name)}"`,
    );
    if (currentStep.deadline) parts.push(`due ${currentStep.deadline}`);
    if (currentStep.blocked) parts.push('blocked');
  } else {
    parts.push(`${workstream.steps.length} steps`);
  }

  const ownerId = currentStep?.effectiveOwnerId ?? workstream.ownerId;
  const ownerName = ownerId ? userNamesById.get(ownerId) : undefined;
  if (ownerName) parts.push(`owner ${sanitizeLine(ownerName)}`);

  const groupName = workstream.groupId
    ? groupNamesById.get(workstream.groupId)
    : undefined;
  if (groupName) parts.push(`group ${sanitizeLine(groupName)}`);

  return parts.join(' · ');
}

const toCompleteLine = (complete: readonly Workstream[]): string =>
  `${complete.length} complete: ${complete
    .map((workstream) => `${workstream.id} ${sanitizeLine(workstream.name)}`)
    .join(' · ')}`;

export function buildWorkstreamsContext(overview: Overview): ContextEntry {
  const lineContext: LineContext = {
    groupNamesById: new Map(overview.groups.map((g) => [g.id, g.name])),
    userNamesById: new Map(overview.users.map((u) => [u.id, u.name])),
  };

  const lines: string[] = [];
  const complete: Workstream[] = [];
  for (const workstream of overview.workstreams) {
    if (workstream.lifecycle === 'complete') {
      complete.push(workstream);
    } else {
      lines.push(toLine(workstream, lineContext));
    }
  }

  if (complete.length > 0) lines.push(toCompleteLine(complete));

  return {
    name: 'Workstreams',
    description:
      'Every workstream of the current project that is not complete, one per line: <workstreamId> <name> [lifecycle] · <currentStepPosition>/<totalSteps> <currentStepId> "<currentStepName>" · due <date> · blocked · owner <name> · group <name>, with the trailing segments present only when they apply. Complete workstreams compact to one trailing line of id and name pairs — read one in full with `getWorkstream`.',
    data: {
      workstreams: lines.length > 0 ? lines.join('\n') : 'no workstreams',
    },
  };
}

import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

export function deadlineEntry(
  deadline: string,
  overrides: Partial<DeadlineEntry> = {},
): DeadlineEntry {
  return {
    workstreamId: 'ws-1',
    workstreamName: 'Venue',
    workstreamIcon: '📋',
    stepId: `step-${deadline}`,
    stepName: 'Visit venues',
    deadline,
    blocked: false,
    ...overrides,
  };
}

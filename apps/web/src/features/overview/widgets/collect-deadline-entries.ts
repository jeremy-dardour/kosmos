import { isBlockedNow } from '@/features/overview/is-blocked-now';

import type { Workstream } from '@/api/hooks/use-overview';

export interface DeadlineEntry {
  workstreamId: string;
  workstreamName: string;
  workstreamIcon: string;
  stepId: string;
  stepName: string;
  /** ISO date-only. */
  deadline: string;
  blocked: boolean;
}

function pendingDeadlinesOf(workstream: Workstream): DeadlineEntry[] {
  if (workstream.lifecycle === 'complete') return [];

  const entries: DeadlineEntry[] = [];
  for (const step of workstream.steps) {
    if (!step.deadline) continue;
    if (step.status !== 'in_progress' && step.status !== 'not_started') {
      continue;
    }
    entries.push({
      workstreamId: workstream.id,
      workstreamName: workstream.name,
      workstreamIcon: workstream.icon,
      stepId: step.id,
      stepName: step.name,
      deadline: step.deadline,
      blocked: isBlockedNow(step),
    });
  }
  return entries;
}

/**
 * Pending deadlines only: current + not-started steps of live workstreams —
 * exactly the set that gets urgency rings on the overview. Settled steps and
 * complete workstreams are history and stay out.
 */
export function collectDeadlineEntries(
  workstreams: Workstream[],
): DeadlineEntry[] {
  return workstreams
    .flatMap((workstream) => pendingDeadlinesOf(workstream))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

/** Entries by their raw `deadline`, each day keeping the order it arrived in. */
export function groupEntriesByDate(
  entries: DeadlineEntry[],
): ReadonlyMap<string, DeadlineEntry[]> {
  const byDate = new Map<string, DeadlineEntry[]>();

  for (const entry of entries) {
    const sameDay = byDate.get(entry.deadline);
    if (sameDay) {
      sameDay.push(entry);
    } else {
      byDate.set(entry.deadline, [entry]);
    }
  }

  return byDate;
}

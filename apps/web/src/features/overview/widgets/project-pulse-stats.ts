import { daysUntil } from '@/features/overview/days-until';
import { isBlockedNow } from '@/features/overview/is-blocked-now';

import type { Workstream, WorkstreamLifecycle } from '@/api/hooks/use-overview';
import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

export interface PulseStats {
  total: number;
  active: number;
  queued: number;
  done: number;
  settledSteps: number;
  totalSteps: number;
  progressPct: number;
  blockedWorkstreams: number;
  overdueCount: number;
  nextEntry: DeadlineEntry | null;
}

function countLifecycle(
  workstreams: Workstream[],
  lifecycle: WorkstreamLifecycle,
): number {
  return workstreams.filter((workstream) => workstream.lifecycle === lifecycle)
    .length;
}

/**
 * Everything the stats widget renders, derived in one pass so the component
 * computes nothing beyond layout. `entries` is the already-collected pending
 * deadline list, so both widgets read the same set.
 */
export function derivePulseStats(
  workstreams: Workstream[],
  entries: DeadlineEntry[],
  now: Date,
): PulseStats {
  const steps = workstreams.flatMap((workstream) => workstream.steps);
  const settledSteps = steps.filter(
    (step) => step.status === 'done' || step.status === 'skipped',
  ).length;

  return {
    total: workstreams.length,
    active: countLifecycle(workstreams, 'active'),
    queued: countLifecycle(workstreams, 'not_started'),
    done: countLifecycle(workstreams, 'complete'),
    settledSteps,
    totalSteps: steps.length,
    progressPct:
      steps.length === 0 ? 0 : Math.round((settledSteps / steps.length) * 100),
    blockedWorkstreams: workstreams.filter((workstream) =>
      workstream.steps.some((step) => isBlockedNow(step)),
    ).length,
    overdueCount: entries.filter((entry) => daysUntil(entry.deadline, now) < 0)
      .length,
    nextEntry:
      entries.find((entry) => daysUntil(entry.deadline, now) >= 0) ?? null,
  };
}

import { isBlockedNow } from '@/features/overview/is-blocked-now';

import type { Workstream, WorkstreamLifecycle } from '@/api/hooks/use-overview';
import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';
import type { DeadlineBuckets } from '@/features/overview/widgets/deadline-buckets';

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
 * computes nothing beyond layout. Late and next come from the same deadline
 * buckets the agenda renders, so the pulse can never disagree with the list
 * below it.
 */
export function derivePulseStats(
  workstreams: Workstream[],
  buckets: DeadlineBuckets,
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
    overdueCount: buckets.overdue.length,
    // Earliest pending deadline — an overdue one outranks every upcoming one.
    nextEntry: buckets.overdue[0] ?? buckets.months[0]?.entries[0] ?? null,
  };
}

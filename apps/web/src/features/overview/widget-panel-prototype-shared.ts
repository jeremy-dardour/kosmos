/**
 * PROTOTYPE — shared, non-component pieces of the widget-panel prototype.
 * Split from the component files only because fast-refresh wants component
 * files to export components exclusively. Delete with the prototype.
 */
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

/**
 * Cross-link seam — the widget panel asks the overview list to open a step.
 * An event keeps the widgets decoupled from the list: the host page turns the
 * widget's injected `onEntryClick` into this event, nothing more.
 */
export const PROTOTYPE_OPEN_STEP_EVENT = 'prototype:open-step';

export interface PrototypeOpenStepDetail {
  workstreamId: string;
  stepId: string;
}

/** DOM id of a card, used by the cross-link scroll and hover highlight. */
export function prototypeCardDomId(workstreamId: string): string {
  return `proto-card-${workstreamId}`;
}

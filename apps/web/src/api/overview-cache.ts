import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { overviewQueryOptions } from '@/api/hooks/use-overview';

import type {
  ChecklistItem,
  Group,
  Overview,
  Step,
  Workstream,
} from '@/api/hooks/use-overview';
import type { QueryClient } from '@tanstack/react-query';

/**
 * The save model for the inline overview: every mutation answers with the
 * smallest entity it changed, that response is merged into the cached
 * aggregate, and one trailing invalidate reconciles the server-derived fields
 * after the burst of edits ends.
 */

/** One mutation response, described by what the server sent back. */
export type OverviewPatch =
  | { type: 'workstream'; workstream: Workstream }
  | { type: 'workstream-order'; workstreams: Workstream[] }
  | { type: 'group-order'; groups: Group[] }
  | { type: 'step'; step: Step }
  | {
      type: 'checklist-item-added';
      stepId: string;
      checklistItem: ChecklistItem;
    }
  | { type: 'checklist-item-changed'; checklistItem: ChecklistItem }
  | { type: 'checklist-item-removed'; checklistItemId: string }
  | { type: 'note-count'; stepId: string; delta: number };

const TRAILING_INVALIDATE_DELAY_MS = 2000;

function replaceById<T extends { id: string }>(
  items: T[],
  replacements: T[],
): T[] | undefined {
  const byId = new Map(replacements.map((item) => [item.id, item]));
  let isChanged = false;

  const next = items.map((item) => {
    const replacement = byId.get(item.id);
    if (!replacement) return item;
    isChanged = true;
    return replacement;
  });

  return isChanged ? next : undefined;
}

/** Rewrites every step the predicate selects, or reports no match. */
function mapSteps(
  overview: Overview,
  isSelected: (step: Step) => boolean,
  rewrite: (step: Step) => Step,
): Overview | undefined {
  let isChanged = false;

  const workstreams = overview.workstreams.map((workstream) => {
    let isWorkstreamChanged = false;
    const steps = workstream.steps.map((step) => {
      if (!isSelected(step)) return step;
      isWorkstreamChanged = true;
      return rewrite(step);
    });

    if (!isWorkstreamChanged) return workstream;
    isChanged = true;
    return { ...workstream, steps };
  });

  return isChanged ? { ...overview, workstreams } : undefined;
}

function hasChecklistItem(step: Step, checklistItemId: string): boolean {
  return step.checklistItems.some((item) => item.id === checklistItemId);
}

/**
 * Server-derived fields — `lifecycle`, `nearestDeadlineStepId`,
 * `effectiveOwnerId`, step `status` — are never recomputed here. Duplicating
 * the derivation rules on the client would let them drift from the API for the
 * sake of about two seconds, and they degrade safely meanwhile (the deadline
 * badge renders only while the step it names still has a deadline). The
 * trailing invalidate reconciles them instead.
 */
function merge(overview: Overview, patch: OverviewPatch): Overview | undefined {
  switch (patch.type) {
    case 'workstream':
    case 'workstream-order': {
      const workstreams = replaceById(
        overview.workstreams,
        patch.type === 'workstream' ? [patch.workstream] : patch.workstreams,
      );
      return workstreams ? { ...overview, workstreams } : undefined;
    }

    case 'group-order': {
      const groups = replaceById(overview.groups, patch.groups);
      return groups ? { ...overview, groups } : undefined;
    }

    case 'step': {
      return mapSteps(
        overview,
        (step) => step.id === patch.step.id,
        () => patch.step,
      );
    }

    case 'checklist-item-added': {
      return mapSteps(
        overview,
        (step) => step.id === patch.stepId,
        (step) => ({
          ...step,
          checklistItems: [
            ...step.checklistItems.filter(
              (item) => item.id !== patch.checklistItem.id,
            ),
            patch.checklistItem,
          ],
        }),
      );
    }

    case 'checklist-item-changed': {
      return mapSteps(
        overview,
        (step) => hasChecklistItem(step, patch.checklistItem.id),
        (step) => ({
          ...step,
          checklistItems: step.checklistItems.map((item) =>
            item.id === patch.checklistItem.id ? patch.checklistItem : item,
          ),
        }),
      );
    }

    case 'checklist-item-removed': {
      return mapSteps(
        overview,
        (step) => hasChecklistItem(step, patch.checklistItemId),
        (step) => ({
          ...step,
          checklistItems: step.checklistItems.filter(
            (item) => item.id !== patch.checklistItemId,
          ),
        }),
      );
    }

    case 'note-count': {
      return mapSteps(
        overview,
        (step) => step.id === patch.stepId,
        (step) => ({
          ...step,
          noteCount: Math.max(0, step.noteCount + patch.delta),
        }),
      );
    }
  }
}

/**
 * Merges a mutation response into the cached aggregate. An entity the cache
 * does not know — a structural race, or a mutation that landed before the
 * overview loaded — leaves the cache untouched; the trailing invalidate that
 * every mutation schedules is what recovers it.
 */
export function patchOverviewCache(
  queryClient: QueryClient,
  projectId: string | undefined,
  patch: OverviewPatch,
): void {
  if (!projectId) return;

  queryClient.setQueryData(
    overviewQueryOptions(projectId).queryKey,
    (current: Overview | undefined) =>
      current ? (merge(current, patch) ?? current) : current,
  );
}

/**
 * Text entry is the only focus that defers a refetch. Buttons, pickers and the
 * document body are not editors, so a card that merely holds keyboard focus
 * never blocks reconciliation.
 */
function isEditor(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;

  return (
    node.isContentEditable ||
    node.tagName === 'INPUT' ||
    node.tagName === 'TEXTAREA'
  );
}

interface TrailingInvalidator {
  schedule: () => void;
  retain: () => void;
  release: () => void;
}

function createTrailingInvalidator(
  invalidate: () => void,
  dispose: () => void,
): TrailingInvalidator {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let isAwaitingBlur = false;
  let subscribers = 0;

  const stopAwaitingBlur = () => {
    if (!isAwaitingBlur) return;
    isAwaitingBlur = false;
    document.removeEventListener('focusout', onFocusOut, { capture: true });
  };

  function onFocusOut(event: FocusEvent) {
    if (isEditor(event.relatedTarget)) return;
    stopAwaitingBlur();
    invalidate();
  }

  const run = () => {
    if (isEditor(document.activeElement)) {
      if (isAwaitingBlur) return;
      isAwaitingBlur = true;
      document.addEventListener('focusout', onFocusOut, { capture: true });
      return;
    }

    invalidate();
  };

  return {
    schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        run();
      }, TRAILING_INVALIDATE_DELAY_MS);
    },

    retain() {
      subscribers += 1;
    },

    release() {
      subscribers -= 1;
      if (subscribers > 0) return;

      clearTimeout(timer);
      stopAwaitingBlur();
      dispose();
    },
  };
}

/**
 * One invalidator per query client and project, so a burst spread across
 * several mutation hooks still collapses into a single refetch.
 */
const invalidators = new WeakMap<
  QueryClient,
  Map<string, TrailingInvalidator>
>();

function acquireInvalidator(
  queryClient: QueryClient,
  projectId: string,
): TrailingInvalidator {
  let byProject = invalidators.get(queryClient);
  if (!byProject) {
    byProject = new Map();
    invalidators.set(queryClient, byProject);
  }

  const registry = byProject;
  let invalidator = registry.get(projectId);
  if (!invalidator) {
    invalidator = createTrailingInvalidator(
      () => {
        void queryClient.invalidateQueries({
          queryKey: overviewQueryOptions(projectId).queryKey,
        });
      },
      () => registry.delete(projectId),
    );
    registry.set(projectId, invalidator);
  }

  invalidator.retain();
  return invalidator;
}

/**
 * Schedules the one reconciling refetch that follows a burst of inline edits:
 * debounced past the last mutation and held back while a text field still has
 * focus, so a response can never overwrite what someone is typing.
 */
export function useTrailingOverviewInvalidate(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidator = useRef<TrailingInvalidator | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const acquired = acquireInvalidator(queryClient, projectId);
    invalidator.current = acquired;

    return () => {
      invalidator.current = null;
      acquired.release();
    };
  }, [projectId, queryClient]);

  return useCallback(() => invalidator.current?.schedule(), []);
}

/**
 * The seam every inline-overview mutation hook commits through: patch the
 * response in, then schedule the trailing reconcile. Nothing else invalidates
 * the overview.
 */
export function useOverviewCache(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const scheduleInvalidate = useTrailingOverviewInvalidate(projectId);

  return useCallback(
    (patch: OverviewPatch) => {
      patchOverviewCache(queryClient, projectId, patch);
      scheduleInvalidate();
    },
    [projectId, queryClient, scheduleInvalidate],
  );
}

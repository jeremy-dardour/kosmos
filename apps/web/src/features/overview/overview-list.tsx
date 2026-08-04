import { closestCenter, DndContext } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMemo } from 'react';

import { useReorderGroups } from '@/api/hooks/use-reorder-groups';
import { CompletedSection } from '@/features/overview/completed-section';
import { groupWorkstreams } from '@/features/overview/group-workstreams';
import { SortableGroupSection } from '@/features/overview/sortable-group-section';
import { useGhostStep } from '@/features/overview/use-ghost-step';
import {
  applyOptimisticOrder,
  useOptimisticReorder,
} from '@/features/overview/use-optimistic-reorder';
import { useOverviewDndSensors } from '@/features/overview/use-overview-dnd-sensors';
import { WorkstreamCard } from '@/features/overview/workstream-card/workstream-card';

import type {
  Group,
  Overview,
  UserSummary,
  Workstream,
} from '@/api/hooks/use-overview';
import type { Selection } from '@/features/overview/selection.types';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ReactNode } from 'react';

/** Group ids are prefixed so they can never collide with a workstream id. */
const GROUP_DND_PREFIX = 'group:';

const noSelectionHandler = (): void => undefined;

interface OverviewListProperties {
  overview: Overview;
  usersById: Map<string, UserSummary>;
  projectId: string | undefined;
  now: Date;
  /** Card the widget panel is pointing at, if any. */
  highlightedWorkstreamId?: string | null;
  /** Filtering hides cards, so a partial list has no unambiguous order to drag. */
  isDragDisabled?: boolean;
  openStep?: Selection | null;
  openNotes?: Selection | null;
  onOpenStep?: (selection: Selection | null) => void;
  onOpenNotes?: (selection: Selection | null) => void;
  onCloseEditors?: () => void;
}

/**
 * The overview body: every workstream inline, grouped, manually ordered at both
 * levels, with finished work collapsed into the Completed section at the end.
 * The page holds which step editor and note panel are open; the list routes
 * that selection to the owning card and keeps the ghost under the same
 * one-open-panel rule — opening any of them closes the others.
 */
export const OverviewList = ({
  overview,
  usersById,
  projectId,
  now,
  highlightedWorkstreamId = null,
  isDragDisabled = false,
  openStep = null,
  openNotes = null,
  onOpenStep = noSelectionHandler,
  onOpenNotes = noSelectionHandler,
  onCloseEditors = noSelectionHandler,
}: OverviewListProperties) => {
  const sensors = useOverviewDndSensors();
  const reorderGroups = useReorderGroups(projectId);
  const groupOrder = useOptimisticReorder(projectId);
  // A committed ghost hands its place to the created step's editor (A8).
  const ghostStep = useGhostStep(projectId, (workstreamId, stepId) => {
    onOpenStep({ workstreamId, stepId });
  });

  // Mutation responses are patched into the cached aggregate in place, so the
  // array order there goes stale while `position` stays authoritative.
  const groups = useMemo(
    () => applyOptimisticOrder(byPosition(overview.groups), groupOrder.order),
    [overview.groups, groupOrder.order],
  );
  const workstreams = useMemo(
    () => byPosition(overview.workstreams),
    [overview.workstreams],
  );

  const liveBuckets = groupWorkstreams(
    groups,
    workstreams.filter((workstream) => workstream.lifecycle !== 'complete'),
  );
  const completed = workstreams.filter(
    (workstream) => workstream.lifecycle === 'complete',
  );

  const onGroupDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !projectId) return;

    // Every group travels, including the empty ones no section renders.
    const ids = groups.map((group) => group.id);
    const from = ids.indexOf(groupIdOf(String(active.id)));
    const to = ids.indexOf(groupIdOf(String(over.id)));
    if (from === -1 || to === -1) return;

    const next = arrayMove(ids, from, to);
    groupOrder.begin(next);
    reorderGroups.mutate(
      { params: { path: { projectId } }, body: { ids: next } },
      groupOrder.recovery,
    );
  };

  const renderCard = (workstream: Workstream, dragHandle?: ReactNode) => (
    <WorkstreamCard
      key={workstream.id}
      workstream={workstream}
      groups={groups}
      users={overview.users}
      usersById={usersById}
      projectId={projectId}
      now={now}
      dragHandle={dragHandle}
      isHighlighted={workstream.id === highlightedWorkstreamId}
      openStepId={selectedStepId(openStep, workstream.id)}
      openNotesStepId={selectedStepId(openNotes, workstream.id)}
      ghost={
        ghostStep.draft?.workstreamId === workstream.id
          ? ghostStep.draft
          : undefined
      }
      onOpenStep={(stepId) =>
        onOpenStep(stepId ? { workstreamId: workstream.id, stepId } : null)
      }
      onOpenNotes={(stepId) =>
        onOpenNotes(stepId ? { workstreamId: workstream.id, stepId } : null)
      }
      onCloseEditors={onCloseEditors}
      onInsertStep={(position) => {
        // The ghost is the open editor now — the one-at-a-time rule (A12)
        // covers it too.
        onCloseEditors();
        ghostStep.insertAt(workstream.id, position);
      }}
    />
  );

  return (
    // Wide screens get the width the dropped side panel freed up; the cap only
    // stops the dot columns from stretching absurdly on an ultrawide.
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-5 pb-24">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onGroupDragEnd}
      >
        <SortableContext
          items={liveBuckets
            .filter((bucket) => bucket.group !== null)
            .map((bucket) => dndIdOf(bucket.group))}
          strategy={verticalListSortingStrategy}
        >
          {liveBuckets.map((bucket) => (
            <SortableGroupSection
              key={dndIdOf(bucket.group)}
              bucket={bucket}
              dndId={dndIdOf(bucket.group)}
              projectId={projectId}
              isDragDisabled={isDragDisabled}
            >
              {renderCard}
            </SortableGroupSection>
          ))}
        </SortableContext>
      </DndContext>

      <CompletedSection groups={groups} workstreams={completed}>
        {(workstream) => renderCard(workstream)}
      </CompletedSection>
    </div>
  );
};

function dndIdOf(group: Group | null): string {
  return `${GROUP_DND_PREFIX}${group?.id ?? 'ungrouped'}`;
}

function groupIdOf(dndId: string): string {
  return dndId.slice(GROUP_DND_PREFIX.length);
}

function selectedStepId(
  selection: Selection | null,
  workstreamId: string,
): string | null {
  return selection?.workstreamId === workstreamId ? selection.stepId : null;
}

function byPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.position - right.position);
}

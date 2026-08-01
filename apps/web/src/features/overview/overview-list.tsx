import { closestCenter, DndContext } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';

import { useReorderGroups } from '@/api/hooks/use-reorder-groups';
import { CompletedSection } from '@/features/overview/completed-section';
import { groupWorkstreams } from '@/features/overview/group-workstreams';
import { InlineWorkstreamCard } from '@/features/overview/inline-workstream-card';
import { SortableGroupSection } from '@/features/overview/sortable-group-section';
import {
  applyOptimisticOrder,
  useOptimisticReorder,
} from '@/features/overview/use-optimistic-reorder';
import { useOverviewDndSensors } from '@/features/overview/use-overview-dnd-sensors';

import type { Group, Overview, Workstream } from '@/api/hooks/use-overview';
import type { GhostStepDraft } from '@/features/overview/ghost-step';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ReactNode } from 'react';

/** Group ids are prefixed so they can never collide with a workstream id. */
const GROUP_DND_PREFIX = 'group:';

/** Which card, and which of its steps, currently owns an open panel. */
interface Selection {
  workstreamId: string;
  stepId: string;
}

interface OverviewListProperties {
  overview: Overview;
  projectId: string | undefined;
  now: Date;
  /** Opens the ghost step the page owns, at that position in that workstream. */
  onInsertStep: (workstreamId: string, position: number) => void;
  /** The page's single unsaved step, rendered by the card it belongs to. */
  ghost?: GhostStepDraft | null;
  /** Filtering hides cards, so a partial list has no unambiguous order to drag. */
  isDragDisabled?: boolean;
}

/**
 * The overview body: every workstream inline, grouped, manually ordered at both
 * levels, with finished work collapsed into the Completed section at the end.
 * It owns the one-open-editor-across-the-list rule — selecting a step in
 * another card closes the first.
 */
export const OverviewList = ({
  overview,
  projectId,
  now,
  onInsertStep,
  ghost,
  isDragDisabled = false,
}: OverviewListProperties) => {
  const sensors = useOverviewDndSensors();
  const reorderGroups = useReorderGroups(projectId);
  const groupOrder = useOptimisticReorder(projectId);
  const [openStep, setOpenStep] = useState<Selection | null>(null);
  const [openNotes, setOpenNotes] = useState<Selection | null>(null);

  const usersById = useMemo(
    () => new Map(overview.users.map((user) => [user.id, user])),
    [overview.users],
  );

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
    <InlineWorkstreamCard
      key={workstream.id}
      workstream={workstream}
      groups={groups}
      users={overview.users}
      usersById={usersById}
      projectId={projectId}
      now={now}
      dragHandle={dragHandle}
      openStepId={selectedStepId(openStep, workstream.id)}
      openNotesStepId={selectedStepId(openNotes, workstream.id)}
      ghost={ghost?.workstreamId === workstream.id ? ghost : undefined}
      onOpenStep={(stepId) =>
        setOpenStep(stepId ? { workstreamId: workstream.id, stepId } : null)
      }
      onOpenNotes={(stepId) =>
        setOpenNotes(stepId ? { workstreamId: workstream.id, stepId } : null)
      }
      onCloseEditors={() => {
        setOpenStep(null);
        setOpenNotes(null);
      }}
      onInsertStep={(position) => {
        // The ghost is the open editor now — the one-at-a-time rule (A12)
        // covers it too.
        setOpenStep(null);
        setOpenNotes(null);
        onInsertStep(workstream.id, position);
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

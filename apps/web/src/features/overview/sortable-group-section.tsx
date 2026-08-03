import { closestCenter, DndContext } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';

import { useReorderWorkstreams } from '@/api/hooks/use-reorder-workstreams';
import { DragHandle } from '@/features/overview/drag-handle';
import {
  applyOptimisticOrder,
  useOptimisticReorder,
} from '@/features/overview/use-optimistic-reorder';
import { useOverviewDndSensors } from '@/features/overview/use-overview-dnd-sensors';
import { cn } from '@/lib/utils';

import type { Group, Workstream } from '@/api/hooks/use-overview';
import type { WorkstreamGroup } from '@/features/overview/group-workstreams';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ReactNode } from 'react';

interface SortableGroupSectionProperties {
  bucket: WorkstreamGroup;
  /** The id this section carries in the enclosing group-reorder context. */
  dndId: string;
  projectId: string | undefined;
  /** Set while a filter hides cards: reordering a partial list is ambiguous. */
  isDragDisabled: boolean;
  children: (workstream: Workstream, dragHandle?: ReactNode) => ReactNode;
}

/**
 * One group's live cards, in the order the user authored — no lifecycle sort.
 *
 * The section runs its own card DndContext: a card drag then measures only its
 * siblings, so it neither stutters against other groups' drop targets nor needs
 * the within-group rule enforced by rejection.
 */
export const SortableGroupSection = ({
  bucket,
  dndId,
  projectId,
  isDragDisabled,
  children,
}: SortableGroupSectionProperties) => {
  const { t } = useTranslation();
  const sensors = useOverviewDndSensors();
  const reorderWorkstreams = useReorderWorkstreams(projectId);
  const cardOrder = useOptimisticReorder(projectId);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: dndId,
      // Ungrouped is "not yet filed", pinned after the real groups.
      disabled: isDragDisabled || bucket.group === null,
    });

  const workstreams = applyOptimisticOrder(bucket.workstreams, cardOrder.order);
  // A lone card has nothing to reorder against, so it gets no handle at all.
  const isSortable = !isDragDisabled && workstreams.length > 1;

  const onCardDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !projectId) return;

    const ids = workstreams.map((workstream) => workstream.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    const next = arrayMove(ids, from, to);
    cardOrder.begin(next);
    reorderWorkstreams.mutate(
      {
        params: { path: { projectId } },
        body: { groupId: bucket.group?.id ?? null, ids: next },
      },
      cardOrder.recovery,
    );
  };

  return (
    <section
      ref={setNodeRef}
      // Translate only: the sortable transform's scale component visibly
      // deforms rows of differing heights mid-drag.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={bucket.group?.name ?? t('overview.ungrouped')}
      className="group/section"
    >
      <GroupHeader
        group={bucket.group}
        count={workstreams.length}
        dragHandle={
          !isDragDisabled &&
          bucket.group && (
            <DragHandle
              label={t('overview.dnd.reorderGroup', {
                name: bucket.group.name,
              })}
              className="-ml-4 group-hover/section:opacity-100"
              {...attributes}
              {...listeners}
            />
          )
        }
      />

      {isSortable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onCardDragEnd}
        >
          <SortableContext
            items={workstreams.map((workstream) => workstream.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2.5">
              {workstreams.map((workstream) => (
                <SortableWorkstreamCard
                  key={workstream.id}
                  id={workstream.id}
                  label={t('overview.dnd.reorderWorkstream', {
                    name: workstream.name,
                  })}
                >
                  {(dragHandle) => children(workstream, dragHandle)}
                </SortableWorkstreamCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-2.5">
          {workstreams.map((workstream) => children(workstream))}
        </div>
      )}
    </section>
  );
};

interface GroupHeaderProperties {
  group: Group | null;
  count: number;
  dragHandle?: ReactNode;
}

/** Shared with the Completed section, which clusters under the same headers. */
export const GroupHeader = ({
  group,
  count,
  dragHandle,
}: GroupHeaderProperties) => {
  const { t } = useTranslation();

  return (
    <header className="mb-2 flex items-center gap-2">
      {dragHandle}
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-[2px]',
          !group && 'border border-muted-foreground/40',
        )}
        style={group ? { backgroundColor: group.color } : undefined}
      />
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {group?.name ?? t('overview.ungrouped')}
      </h2>
      <span className="text-[11px] tabular-nums text-muted-foreground/60">
        {count}
      </span>
    </header>
  );
};

function SortableWorkstreamCard({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'rounded-lg',
        // The dragged card floats above the list at full strength; the gap its
        // siblings open underneath is the drop indicator.
        isDragging && 'z-10 shadow-lg ring-2 ring-foreground/15',
      )}
    >
      {children(
        <DragHandle
          label={label}
          className="-ml-2 group-hover/card:opacity-100"
          {...attributes}
          {...listeners}
        />,
      )}
    </div>
  );
}

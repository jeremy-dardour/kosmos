import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { useOverview } from '@/api/hooks/use-overview';
import { useAuthState } from '@/auth/auth-context';
import { OWNER_FILTER_ALL } from '@/features/overview/filter-constants';
import { GroupManagerDialog } from '@/features/overview/group-manager-dialog';
import { OverviewHeader } from '@/features/overview/overview-header';
import { OverviewList } from '@/features/overview/overview-list';
import { OverviewSkeleton } from '@/features/overview/overview-skeleton';
import { ProjectSettingsDialog } from '@/features/overview/project-settings-dialog';
import { WidgetSidebar } from '@/features/overview/widgets/widget-sidebar';
import { WorkstreamFormDialog } from '@/features/overview/workstream-form-dialog';

import type { Overview, Workstream } from '@/api/hooks/use-overview';
import type { Selection } from '@/features/overview/selection.types';
import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

function applyOwnerFilter(
  workstreams: Workstream[],
  ownerId: string,
): Workstream[] {
  if (ownerId === OWNER_FILTER_ALL) return workstreams;

  return workstreams.filter((w) => {
    if (w.lifecycle === 'not_started' || w.lifecycle === 'complete') {
      return false;
    }
    const currentStep = w.steps.find((s) => s.status === 'in_progress');
    return currentStep?.effectiveOwnerId === ownerId;
  });
}

function applyGroupFilter(
  workstreams: Workstream[],
  hiddenGroupIds: ReadonlySet<string>,
): Workstream[] {
  if (hiddenGroupIds.size === 0) return workstreams;

  return workstreams.filter(
    (w) => !w.groupId || !hiddenGroupIds.has(w.groupId),
  );
}

export const OverviewPage = () => {
  const { t } = useTranslation();

  const { projectId } = useParams<{ projectId: string }>();
  const overview = useOverview(projectId);
  const authState = useAuthState();

  const [ownerFilter, setOwnerFilter] = useState(OWNER_FILTER_ALL);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [isCreatingWorkstream, setIsCreatingWorkstream] = useState(false);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [openStep, setOpenStep] = useState<Selection | null>(null);
  const [openNotes, setOpenNotes] = useState<Selection | null>(null);
  const [highlightedWorkstreamId, setHighlightedWorkstreamId] = useState<
    string | null
  >(null);

  const currentUserId =
    authState.status === 'authenticated' ? authState.user.id : '';
  const isFiltered =
    ownerFilter !== OWNER_FILTER_ALL || hiddenGroupIds.size > 0;

  const usersById = useMemo(
    () => new Map((overview.data?.users ?? []).map((user) => [user.id, user])),
    [overview.data?.users],
  );

  const filtered = useMemo<Overview | null>(() => {
    if (!overview.data) return null;

    const workstreams = applyGroupFilter(
      applyOwnerFilter(overview.data.workstreams, ownerFilter),
      hiddenGroupIds,
    );
    return { ...overview.data, workstreams };
  }, [overview.data, ownerFilter, hiddenGroupIds]);

  const isLoading = overview.isPending;

  const handleGroupToggle = useCallback((groupId: string) => {
    setHiddenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Cards subscribe a document listener on this handler's identity, so it has
  // to survive every unrelated page render.
  const handleCloseEditors = useCallback(() => {
    setOpenStep(null);
    setOpenNotes(null);
  }, []);

  const filterNote = useMemo(() => {
    const parts: string[] = [];
    if (ownerFilter !== OWNER_FILTER_ALL) {
      parts.push(
        t('overview.widgets.filterOwner', {
          name: usersById.get(ownerFilter)?.name ?? '',
        }),
      );
    }
    if (hiddenGroupIds.size > 0) {
      parts.push(
        t('overview.widgets.groupsHidden', { count: hiddenGroupIds.size }),
      );
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [t, ownerFilter, usersById, hiddenGroupIds]);

  const handleEntryClick = useCallback((entry: DeadlineEntry) => {
    setOpenNotes(null);
    setOpenStep({ workstreamId: entry.workstreamId, stepId: entry.stepId });
    // After the commit, so the scroll measures the layout with the previous
    // editor closed and the target one mounted.
    requestAnimationFrame(() => {
      document
        .querySelector(
          `[data-workstream-id="${CSS.escape(entry.workstreamId)}"]`,
        )
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  // One clock read for the whole list, so every countdown, ring and date tick
  // on screen agrees on what "now" is.
  // eslint-disable-next-line @eslint-react/purity -- intentional clock read
  const now = new Date();

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* `min-w-0`: without it the column's automatic minimum width lets long
          card text push the widget panel off screen. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {overview.data && (
          <OverviewHeader
            project={overview.data.project}
            users={overview.data.users}
            groups={overview.data.groups}
            currentUserId={currentUserId}
            ownerFilter={ownerFilter}
            onOwnerFilterChange={setOwnerFilter}
            hiddenGroupIds={hiddenGroupIds}
            onGroupToggle={handleGroupToggle}
            onNewWorkstream={() => setIsCreatingWorkstream(true)}
            onManageGroups={() => setGroupManagerOpen(true)}
            onProjectSettings={() => setProjectSettingsOpen(true)}
          />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isLoading && <OverviewSkeleton />}

          {filtered?.workstreams.length === 0 && (
            <div className="rounded-lg border border-dashed p-panel text-center">
              <p className="text-sm font-medium">{t('overview.empty.title')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('overview.empty.description')}
              </p>
            </div>
          )}

          {filtered && filtered.workstreams.length > 0 && (
            <OverviewList
              overview={filtered}
              usersById={usersById}
              projectId={projectId}
              now={now}
              highlightedWorkstreamId={highlightedWorkstreamId}
              isDragDisabled={isFiltered}
              openStep={openStep}
              openNotes={openNotes}
              onOpenStep={setOpenStep}
              onOpenNotes={setOpenNotes}
              onCloseEditors={handleCloseEditors}
            />
          )}
        </div>
      </div>

      {filtered && (
        <div className="hidden min-h-0 shrink-0 lg:flex">
          <WidgetSidebar
            workstreams={filtered.workstreams}
            filterNote={filterNote}
            now={now}
            onEntryClick={handleEntryClick}
            onEntryHover={setHighlightedWorkstreamId}
          />
        </div>
      )}

      {overview.data && projectId && isCreatingWorkstream && (
        <WorkstreamFormDialog
          projectId={projectId}
          groups={overview.data.groups}
          users={overview.data.users}
          isOpen
          onOpenChange={(next) => !next && setIsCreatingWorkstream(false)}
        />
      )}

      {overview.data && projectId && (
        <GroupManagerDialog
          projectId={projectId}
          groups={overview.data.groups}
          isOpen={groupManagerOpen}
          onOpenChange={setGroupManagerOpen}
        />
      )}

      {overview.data && projectSettingsOpen && (
        <ProjectSettingsDialog
          project={overview.data.project}
          isOpen={projectSettingsOpen}
          onOpenChange={setProjectSettingsOpen}
        />
      )}
    </div>
  );
};

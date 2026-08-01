import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useOverview } from '@/api/hooks/use-overview';
import { useProjects } from '@/api/hooks/use-projects';
import { useAuthState } from '@/auth/auth-context';
import { OWNER_FILTER_ALL } from '@/features/overview/filter-constants';
import { GroupManagerDialog } from '@/features/overview/group-manager-dialog';
import { OverviewHeader } from '@/features/overview/overview-header';
import { OverviewList } from '@/features/overview/overview-list';
import { OverviewSkeleton } from '@/features/overview/overview-skeleton';
import { ProjectSettingsDialog } from '@/features/overview/project-settings-dialog';
import { useGhostStep } from '@/features/overview/use-ghost-step';
import { WorkstreamFormDialog } from '@/features/overview/workstream-form-dialog';

import type { Overview, Workstream } from '@/api/hooks/use-overview';

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

  const projects = useProjects();
  const projectId = projects.data?.[0]?.id;
  const overview = useOverview(projectId);
  const authState = useAuthState();
  const ghostStep = useGhostStep(projectId);

  const [ownerFilter, setOwnerFilter] = useState(OWNER_FILTER_ALL);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [isCreatingWorkstream, setIsCreatingWorkstream] = useState(false);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);

  const currentUserId =
    authState.status === 'authenticated' ? authState.user.id : '';
  const isFiltered =
    ownerFilter !== OWNER_FILTER_ALL || hiddenGroupIds.size > 0;

  const filtered = useMemo<Overview | null>(() => {
    if (!overview.data) return null;

    const workstreams = applyGroupFilter(
      applyOwnerFilter(overview.data.workstreams, ownerFilter),
      hiddenGroupIds,
    );
    return { ...overview.data, workstreams };
  }, [overview.data, ownerFilter, hiddenGroupIds]);

  const isLoading =
    projects.isPending || (Boolean(projectId) && overview.isPending);

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

  // One clock read for the whole list, so every countdown, ring and date tick
  // on screen agrees on what "now" is.
  // eslint-disable-next-line @eslint-react/purity -- intentional clock read
  const now = new Date();

  return (
    <div className="flex h-full min-h-0 flex-col">
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

        {!isLoading && !projectId && (
          <div className="rounded-lg border border-dashed p-panel text-center">
            <p className="text-sm font-medium">
              {t('overview.noProject.title')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('overview.noProject.description')}
            </p>
          </div>
        )}

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
            projectId={projectId}
            now={now}
            onInsertStep={ghostStep.insertAt}
            ghost={ghostStep.draft}
            isDragDisabled={isFiltered}
          />
        )}
      </div>

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

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAdvanceWorkstream } from '@/api/hooks/use-advance-workstream';
import { useOverview } from '@/api/hooks/use-overview';
import { useProjects } from '@/api/hooks/use-projects';
import { useAuthState } from '@/auth/auth-context';
import { DetailPanel } from '@/features/overview/detail-panel';
import { OverviewHeader } from '@/features/overview/overview-header';
import { OverviewSkeleton } from '@/features/overview/overview-skeleton';
import { useCurrentDate } from '@/features/overview/use-current-date';
import { WorkstreamCardList } from '@/features/overview/workstream-card-list';

import type { AdvanceOutcome } from '@/api/hooks/use-advance-workstream';
import type { UserSummary, Workstream } from '@/api/hooks/use-overview';

const OWNER_ALL = 'all';

function applyOwnerFilter(
  workstreams: Workstream[],
  ownerId: string,
): Workstream[] {
  if (ownerId === OWNER_ALL) return workstreams;

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
  const today = useCurrentDate();

  const projects = useProjects();
  const projectId = projects.data?.[0]?.id;
  const overview = useOverview(projectId);
  const advance = useAdvanceWorkstream(projectId);
  const authState = useAuthState();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState(OWNER_ALL);
  const [hiddenGroupIds, setHiddenGroupIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const currentUserId =
    authState.status === 'authenticated' ? authState.user.id : '';

  const usersById = useMemo(() => {
    if (!overview.data) return new Map<string, UserSummary>();
    return new Map(overview.data.users.map((u) => [u.id, u]));
  }, [overview.data]);

  const filteredWorkstreams = useMemo(() => {
    if (!overview.data) return [];
    const afterOwner = applyOwnerFilter(overview.data.workstreams, ownerFilter);
    return applyGroupFilter(afterOwner, hiddenGroupIds);
  }, [overview.data, ownerFilter, hiddenGroupIds]);

  const selectedWorkstream =
    overview.data?.workstreams.find((w) => w.id === selectedId) ?? null;

  if (selectedId && overview.data && !selectedWorkstream) {
    setSelectedId(null);
  }

  const isLoading =
    projects.isPending || (Boolean(projectId) && overview.isPending);
  const advancingId = advance.isPending
    ? advance.variables.params.path.id
    : null;

  const handleAdvance = (workstreamId: string, outcome?: AdvanceOutcome) => {
    advance.mutate({
      params: { path: { id: workstreamId } },
      body: outcome ? { outcome } : {},
    });
  };

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

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[58fr_42fr]">
      <div className="flex min-h-0 flex-col">
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

          {overview.data && (
            <WorkstreamCardList
              groups={overview.data.groups}
              workstreams={filteredWorkstreams}
              usersById={usersById}
              selectedId={selectedId}
              onSelect={setSelectedId}
              advancingId={advancingId}
              onAdvance={handleAdvance}
              today={today}
            />
          )}
        </div>
      </div>

      <DetailPanel
        workstream={selectedWorkstream}
        projectId={projectId}
        users={overview.data?.users ?? []}
        usersById={usersById}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
};

import { useTranslation } from 'react-i18next';

import { useOverview } from '@/api/hooks/use-overview';
import { useProjects } from '@/api/hooks/use-projects';
import { DetailPanel } from '@/features/overview/detail-panel';
import { OverviewHeader } from '@/features/overview/overview-header';
import { OverviewSkeleton } from '@/features/overview/overview-skeleton';
import { WorkstreamCardList } from '@/features/overview/workstream-card-list';

/**
 * The Pipeline Stack overview — the only screen in V1. Request failures surface
 * through the global API error dialog, so there is no error branch here.
 */
export const OverviewPage = () => {
  const { t } = useTranslation();

  const projects = useProjects();
  const projectId = projects.data?.[0]?.id;
  const overview = useOverview(projectId);

  const isLoading =
    projects.isPending || (Boolean(projectId) && overview.isPending);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-[58fr_42fr]">
      <div className="flex min-h-0 flex-col">
        {overview.data && <OverviewHeader project={overview.data.project} />}

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
              workstreams={overview.data.workstreams}
              users={overview.data.users}
            />
          )}
        </div>
      </div>

      <DetailPanel />
    </div>
  );
};

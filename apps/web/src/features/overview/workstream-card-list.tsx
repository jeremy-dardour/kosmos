import { useTranslation } from 'react-i18next';

import { GroupSection } from '@/features/overview/group-section';
import { groupWorkstreams } from '@/features/overview/group-workstreams';

import type { dtos } from '@/types/openapi';

interface WorkstreamCardListProperties {
  groups: dtos['GroupDto'][];
  workstreams: dtos['OverviewWorkstreamDto'][];
  users: dtos['UserSummaryDto'][];
}

export const WorkstreamCardList = ({
  groups,
  workstreams,
  users,
}: WorkstreamCardListProperties) => {
  const { t } = useTranslation();

  if (workstreams.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-panel text-center">
        <p className="text-sm font-medium">{t('overview.empty.title')}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('overview.empty.description')}
        </p>
      </div>
    );
  }

  const usersById = new Map(users.map((user) => [user.id, user]));

  return (
    <div className="flex flex-col gap-5">
      {groupWorkstreams(groups, workstreams).map((bucket) => (
        <GroupSection
          key={bucket.group?.id ?? 'ungrouped'}
          group={bucket.group}
          workstreams={bucket.workstreams}
          usersById={usersById}
        />
      ))}
    </div>
  );
};

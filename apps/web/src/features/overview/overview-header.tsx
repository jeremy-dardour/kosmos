import { PlusIcon, SettingsIcon, TagsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { EventCountdown } from '@/features/overview/event-countdown';
import { GroupFilter } from '@/features/overview/group-filter';
import { OwnerFilter } from '@/features/overview/owner-filter';

import type { Group, Project, UserSummary } from '@/api/hooks/use-overview';

interface OverviewHeaderProperties {
  project: Project;
  users: UserSummary[];
  groups: Group[];
  currentUserId: string;
  ownerFilter: string;
  onOwnerFilterChange: (value: string) => void;
  hiddenGroupIds: ReadonlySet<string>;
  onGroupToggle: (groupId: string) => void;
  onNewWorkstream: () => void;
  onManageGroups: () => void;
  onProjectSettings: () => void;
}

export const OverviewHeader = ({
  project,
  users,
  groups,
  currentUserId,
  ownerFilter,
  onOwnerFilterChange,
  hiddenGroupIds,
  onGroupToggle,
  onNewWorkstream,
  onManageGroups,
  onProjectSettings,
}: OverviewHeaderProperties) => {
  const { t } = useTranslation();

  return (
    <header className="mb-3 flex items-center gap-2">
      <h1 className="truncate text-[15px] font-semibold">{project.name}</h1>
      <EventCountdown eventDate={project.eventDate} />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t('overview.manage.projectSettings')}
        onClick={onProjectSettings}
      >
        <SettingsIcon />
      </Button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <OwnerFilter
          users={users}
          currentUserId={currentUserId}
          value={ownerFilter}
          onChange={onOwnerFilterChange}
        />
        <GroupFilter
          groups={groups}
          hiddenGroupIds={hiddenGroupIds}
          onChange={onGroupToggle}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onManageGroups}
        >
          <TagsIcon />
          {t('overview.manage.manageGroups')}
        </Button>
        <Button type="button" size="sm" onClick={onNewWorkstream}>
          <PlusIcon />
          {t('overview.manage.newWorkstream')}
        </Button>
      </div>
    </header>
  );
};

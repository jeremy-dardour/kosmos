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
}: OverviewHeaderProperties) => {
  return (
    <header className="mb-3 flex items-center gap-2">
      <h1 className="truncate text-[15px] font-semibold">{project.name}</h1>
      <EventCountdown eventDate={project.eventDate} />

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
      </div>
    </header>
  );
};

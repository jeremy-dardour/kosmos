import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { FilterTrigger } from '@/features/overview/filter-trigger';

import type { Group } from '@/api/hooks/use-overview';

interface GroupFilterProperties {
  groups: Group[];
  hiddenGroupIds: ReadonlySet<string>;
  onChange: (groupId: string) => void;
}

export const GroupFilter = ({
  groups,
  hiddenGroupIds,
  onChange,
}: GroupFilterProperties) => {
  const { t } = useTranslation();

  if (groups.length === 0) return null;

  const isAllVisible = hiddenGroupIds.size === 0;
  const label = isAllVisible
    ? t('overview.filter.allGroups')
    : t('overview.filter.groupCount', {
        count: groups.length - hiddenGroupIds.size,
      });

  return (
    <DropdownMenu>
      <FilterTrigger aria-label={t('overview.filter.groupLabel')}>
        {label}
      </FilterTrigger>
      <DropdownMenuContent align="end">
        {groups.map((group) => (
          <DropdownMenuCheckboxItem
            key={group.id}
            checked={!hiddenGroupIds.has(group.id)}
            onCheckedChange={() => onChange(group.id)}
          >
            <span
              aria-hidden
              className="mr-1.5 inline-block size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: group.color }}
            />
            {group.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

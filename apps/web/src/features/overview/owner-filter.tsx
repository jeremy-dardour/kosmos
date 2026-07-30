import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { OWNER_FILTER_ALL } from '@/features/overview/filter-constants';
import { FilterTrigger } from '@/features/overview/filter-trigger';

import type { UserSummary } from '@/api/hooks/use-overview';

interface OwnerFilterProperties {
  users: UserSummary[];
  currentUserId: string;
  value: string;
  onChange: (value: string) => void;
}

export const OwnerFilter = ({
  users,
  currentUserId,
  value,
  onChange,
}: OwnerFilterProperties) => {
  const { t } = useTranslation();

  const selectedUser = users.find((u) => u.id === value);
  const label =
    value === OWNER_FILTER_ALL
      ? t('overview.filter.allOwners')
      : value === currentUserId
        ? t('overview.filter.myTasks')
        : (selectedUser?.name ?? t('overview.filter.allOwners'));

  return (
    <DropdownMenu>
      <FilterTrigger aria-label={t('overview.filter.ownerLabel')}>
        {label}
      </FilterTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuRadioItem value={OWNER_FILTER_ALL}>
            {t('overview.filter.allOwners')}
          </DropdownMenuRadioItem>
          {users.map((user) => (
            <DropdownMenuRadioItem key={user.id} value={user.id}>
              {user.id === currentUserId
                ? t('overview.filter.myTasks')
                : user.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

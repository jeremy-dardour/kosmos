import { ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { UserSummary } from '@/api/hooks/use-overview';

const ALL = 'all';

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
    value === ALL
      ? t('overview.filter.allOwners')
      : value === currentUserId
        ? t('overview.filter.myTasks')
        : (selectedUser?.name ?? t('overview.filter.allOwners'));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
        aria-label={t('overview.filter.ownerLabel')}
      >
        {label}
        <ChevronDownIcon className="size-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuRadioItem value={ALL}>
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

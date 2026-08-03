import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { Group } from '@/api/hooks/use-overview';

interface GroupChipProperties {
  groups: Group[];
  groupId: string | null;
  label: string;
  onSelect: (groupId: string | null) => void;
}

export const GroupChip = ({
  groups,
  groupId,
  label,
  onSelect,
}: GroupChipProperties) => {
  const { t } = useTranslation();
  const group = groups.find((candidate) => candidate.id === groupId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        <span
          aria-hidden
          className="size-1.5 rounded-[2px] border"
          style={{ backgroundColor: group?.color ?? 'transparent' }}
        />
        {group?.name ?? t('overview.card.noGroup')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onSelect(null)}>
          {t('overview.card.noGroup')}
        </DropdownMenuItem>
        {groups.map((candidate) => (
          <DropdownMenuItem
            key={candidate.id}
            onClick={() => onSelect(candidate.id)}
          >
            <span
              aria-hidden
              className="mr-1.5 inline-block size-2 rounded-[2px]"
              style={{ backgroundColor: candidate.color }}
            />
            {candidate.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

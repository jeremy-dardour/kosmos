import { CrownIcon, LogOutIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import type { Member } from '@/api/hooks/use-project-members';

export type ActionKind = 'remove' | 'leave' | 'transfer';

export interface RowAction {
  kind: ActionKind;
  label: string;
  onSelect: () => void;
}

const ACTION_ICONS = {
  remove: Trash2Icon,
  leave: LogOutIcon,
  transfer: CrownIcon,
} as const;

interface MemberRowProperties {
  member: Member;
  actions: RowAction[];
}

export const MemberRow = ({ member, actions }: MemberRowProperties) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      {member.avatarUrl ? (
        <img
          src={member.avatarUrl}
          alt=""
          className="size-6 shrink-0 rounded-full"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground uppercase"
        >
          {(member.name ?? member.email).charAt(0)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{member.name ?? member.email}</p>
        {member.name && (
          <p className="truncate text-xs text-muted-foreground">
            {member.email}
          </p>
        )}
      </div>
      {member.isOwner && (
        <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {t('overview.members.ownerBadge')}
        </span>
      )}
      {!member.userId && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {t('overview.members.pendingBadge')}
        </span>
      )}
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action.kind];
        return (
          <Button
            key={action.kind}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={action.label}
            title={action.label}
            onClick={action.onSelect}
          >
            <Icon />
          </Button>
        );
      })}
    </div>
  );
};

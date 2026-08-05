import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { UserSummary } from '@/api/hooks/use-overview';
import type { CSSProperties } from 'react';

interface OwnerAvatarProperties {
  /** `isMember: false` marks an ex-member whose assignment survived removal. */
  owner?: (UserSummary & { isMember?: boolean }) | null;
  className?: string;
}

/** A stable hue per person, so no colour has to be stored on the user. */
function hueFromId(id: string): number {
  let hash = 0;

  for (const character of id) {
    hash = (hash * 31 + character.codePointAt(0)!) % 360;
  }

  return hash;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase() ?? '')
    .join('');
}

export const OwnerAvatar = ({ owner, className }: OwnerAvatarProperties) => {
  const { t } = useTranslation();

  if (!owner) {
    return (
      <span
        className={cn(
          'inline-flex size-6 shrink-0 rounded-full border border-dashed border-muted-foreground/40',
          className,
        )}
        title={t('overview.card.unassigned')}
        aria-label={t('overview.card.unassigned')}
        role="img"
      />
    );
  }

  const isFormerMember = owner.isMember === false;
  const label = isFormerMember
    ? t('overview.card.formerMemberOwner', { name: owner.name })
    : owner.name;

  return (
    <span
      className={cn(
        'owner-avatar inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
        isFormerMember &&
          'opacity-50 grayscale ring-1 ring-destructive/60 ring-offset-1',
        className,
      )}
      style={{ '--avatar-hue': hueFromId(owner.id) } as CSSProperties}
      title={label}
      aria-label={label}
      role="img"
    >
      {initials(owner.name)}
    </span>
  );
};

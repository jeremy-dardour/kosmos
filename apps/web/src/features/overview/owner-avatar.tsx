import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { dtos } from '@/types/openapi';
import type { CSSProperties } from 'react';

interface OwnerAvatarProperties {
  owner?: dtos['UserSummaryDto'] | null;
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

  return (
    <span
      className={cn(
        'owner-avatar inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
        className,
      )}
      style={{ '--avatar-hue': hueFromId(owner.id) } as CSSProperties}
      title={owner.name}
      aria-label={owner.name}
      role="img"
    >
      {initials(owner.name)}
    </span>
  );
};

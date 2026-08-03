import { useTranslation } from 'react-i18next';

import { isBlockedNow } from '@/features/overview/is-blocked-now';

import type { Workstream } from '@/api/hooks/use-overview';

interface LifecycleBadgesProperties {
  workstream: Workstream;
}

export const LifecycleBadges = ({ workstream }: LifecycleBadgesProperties) => {
  const { t } = useTranslation();
  const isBlocked = workstream.steps.some((step) => isBlockedNow(step));

  return (
    <>
      {isBlocked && (
        <span className="shrink-0 rounded-sm bg-step-blocked/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-step-blocked">
          {t('overview.stepStatus.blocked')}
        </span>
      )}
      {workstream.lifecycle === 'not_started' && (
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
          {t('overview.card.notStarted')}
        </span>
      )}
      {/* Complete stays plain text: it is the state that should recede. */}
      {workstream.lifecycle === 'complete' && (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-step-done">
          {t('overview.card.complete')}
        </span>
      )}
    </>
  );
};

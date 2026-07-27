import { useTranslation } from 'react-i18next';

import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { OwnerAvatar } from '@/features/overview/owner-avatar';
import { PipelineDots } from '@/features/overview/pipeline-dots';
import { cn } from '@/lib/utils';

import type { dtos } from '@/types/openapi';

interface WorkstreamCardProperties {
  workstream: dtos['OverviewWorkstreamDto'];
  owner?: dtos['UserSummaryDto'] | null;
}

export const WorkstreamCard = ({
  workstream,
  owner,
}: WorkstreamCardProperties) => {
  const { t } = useTranslation();

  const isComplete = workstream.lifecycle === 'complete';
  const isNotStarted = workstream.lifecycle === 'not_started';
  const isBlocked = workstream.steps.some((step) => isBlockedNow(step));

  return (
    <article
      className={cn(
        'rounded-lg border bg-card p-card shadow-xs transition-colors',
        isBlocked && 'border-step-blocked/40',
        isComplete && 'opacity-65',
      )}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base leading-none">
          {workstream.icon}
        </span>
        <h3 className="truncate text-sm font-semibold">{workstream.name}</h3>

        {isBlocked && (
          <span className="shrink-0 rounded-sm bg-step-blocked/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-step-blocked">
            {t('overview.stepStatus.blocked')}
          </span>
        )}
        {isNotStarted && (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('overview.card.notStarted')}
          </span>
        )}
        {isComplete && (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-step-done">
            {t('overview.card.complete')}
          </span>
        )}

        <OwnerAvatar owner={owner} className="ml-auto" />
      </div>

      <div className="mt-3">
        <PipelineDots steps={workstream.steps} />
      </div>
    </article>
  );
};

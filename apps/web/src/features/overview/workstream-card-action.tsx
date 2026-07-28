import { ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isBlockedNow } from '@/features/overview/is-blocked-now';

import type { AdvanceOutcome } from '@/api/hooks/use-advance-workstream';
import type { Workstream } from '@/api/hooks/use-overview';

interface WorkstreamCardActionProperties {
  workstream: Workstream;
  isPending: boolean;
  onAdvance: (outcome?: AdvanceOutcome) => void;
}

export const WorkstreamCardAction = ({
  workstream,
  isPending,
  onAdvance,
}: WorkstreamCardActionProperties) => {
  const { t } = useTranslation();

  if (workstream.lifecycle === 'complete') return null;

  if (workstream.lifecycle === 'not_started') {
    return (
      <Button
        size="xs"
        variant="outline"
        disabled={isPending}
        aria-label={t('overview.action.startLabel', {
          name: workstream.name,
        })}
        onClick={() => onAdvance()}
      >
        {t(isPending ? 'overview.action.starting' : 'overview.action.start')}
      </Button>
    );
  }

  const isBlocked = workstream.steps.some((step) => isBlockedNow(step));

  if (isBlocked) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          render={
            <Button
              size="xs"
              variant="outline"
              aria-label={t('overview.action.resolveLabel', {
                name: workstream.name,
              })}
            />
          }
        >
          {t(
            isPending ? 'overview.action.resolving' : 'overview.action.resolve',
          )}
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={isPending}
            onClick={() => onAdvance('done')}
          >
            {t('overview.action.markDone')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isPending}
            onClick={() => onAdvance('skipped')}
          >
            {t('overview.action.markSkipped')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex">
      <Button
        size="xs"
        variant="outline"
        className="rounded-r-none"
        disabled={isPending}
        aria-label={t('overview.action.advanceLabel', {
          name: workstream.name,
        })}
        onClick={() => onAdvance()}
      >
        {t(isPending ? 'overview.action.advancing' : 'overview.action.advance')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          render={
            <Button
              size="icon-xs"
              variant="outline"
              className="-ml-px rounded-l-none"
              aria-label={t('overview.action.moreOptionsLabel', {
                name: workstream.name,
              })}
            />
          }
        >
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={isPending}
            onClick={() => onAdvance('skipped')}
          >
            {t('overview.action.markSkipped')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

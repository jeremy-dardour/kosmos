import { ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAdvanceWorkstream } from '@/api/hooks/use-advance-workstream';
import { useUpdateStep } from '@/api/hooks/use-update-step';
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

interface AdvanceControlProperties {
  workstream: Workstream;
  projectId: string | undefined;
}

/**
 * The card's primary action, and the only solid button on it. It owns its
 * mutations so the pending state is row-local: one card advancing never locks
 * the rest of the list.
 */
export const AdvanceControl = ({
  workstream,
  projectId,
}: AdvanceControlProperties) => {
  const { t } = useTranslation();
  const advance = useAdvanceWorkstream(projectId);
  const updateStep = useUpdateStep(projectId);

  if (workstream.lifecycle === 'complete') return null;

  const isPending = advance.isPending || updateStep.isPending;

  const runAdvance = (outcome?: AdvanceOutcome) => {
    advance.mutate({
      params: { path: { id: workstream.id } },
      body: outcome ? { outcome } : {},
    });
  };

  if (workstream.lifecycle === 'not_started') {
    // Nothing to start: the pipeline has no first step yet.
    if (workstream.steps.length === 0) return null;

    return (
      <Button
        size="xs"
        variant="outline"
        disabled={isPending}
        aria-label={t('overview.action.startLabel', { name: workstream.name })}
        onClick={() => runAdvance()}
      >
        {t(isPending ? 'overview.action.starting' : 'overview.action.start')}
      </Button>
    );
  }

  // An Active workstream has exactly one current step (CONTEXT.md); without one
  // there is no outcome to record.
  const currentStep = workstream.steps.find(
    (step) => step.status === 'in_progress',
  );
  if (!currentStep) return null;

  const stepName = currentStep.name || t('overview.pipeline.untitled');

  if (isBlockedNow(currentStep)) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          render={
            <Button
              size="xs"
              variant="outline"
              className="border-step-blocked/40 text-step-blocked hover:text-step-blocked"
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
            onClick={() => runAdvance('done')}
          >
            {t('overview.action.markDone')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isPending}
            onClick={() => runAdvance('skipped')}
          >
            {t('overview.action.markSkipped')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isPending}
            onClick={() =>
              updateStep.mutate({
                params: { path: { id: currentStep.id } },
                body: { blocked: false },
              })
            }
          >
            {t('overview.action.unblock')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <span className="flex items-center">
      <Button
        size="xs"
        className="rounded-r-none"
        disabled={isPending}
        aria-label={t('overview.action.advanceLabel', {
          name: workstream.name,
        })}
        onClick={() => runAdvance()}
      >
        {t(isPending ? 'overview.action.advancing' : 'overview.action.advance')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isPending}
          render={
            <Button
              size="xs"
              className="rounded-l-none border-l border-l-background/30 px-1"
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
            onClick={() => runAdvance('skipped')}
          >
            {t('overview.action.skipStep', { name: stepName })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
};

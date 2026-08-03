import { useTranslation } from 'react-i18next';

import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { STEP_STATUS_LABELS } from '@/features/overview/step-status-labels';
import { cn } from '@/lib/utils';

import type { Step } from '@/api/hooks/use-overview';

// Softer sizes than the pipeline's dots: this one annotates the editor footer.
const FOOTER_DOT_CLASSES = {
  done: 'size-3 bg-step-done',
  in_progress: 'size-3.5 bg-step-in-progress',
  blocked: 'size-3.5 bg-step-blocked',
  not_started: 'size-3 border-[1.5px] border-step-not-started bg-card',
  skipped: 'size-3 border-[1.5px] border-dashed border-step-skipped bg-card',
} as const;

interface StatusDotProperties {
  step: Step;
}

export const StatusDot = ({ step }: StatusDotProperties) => {
  const { t } = useTranslation();
  const visual = isBlockedNow(step) ? 'blocked' : step.status;

  return (
    <span
      role="img"
      aria-label={t(STEP_STATUS_LABELS[visual])}
      title={t(STEP_STATUS_LABELS[visual])}
      className={cn('shrink-0 rounded-full', FOOTER_DOT_CLASSES[visual])}
    />
  );
};

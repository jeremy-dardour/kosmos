import type { dtos } from '@/types/openapi';

/** Blocked is a flag, not a status — only meaningful on the current step. */
export function isBlockedNow(
  step: Pick<dtos['OverviewStepDto'], 'blocked' | 'status'>,
): boolean {
  return step.blocked && step.status === 'in_progress';
}

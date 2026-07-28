import type { Step } from '@/api/hooks/use-overview';

/** Blocked is a flag, not a status — only meaningful on the current step. */
export function isBlockedNow(step: Pick<Step, 'blocked' | 'status'>): boolean {
  return step.blocked && step.status === 'in_progress';
}

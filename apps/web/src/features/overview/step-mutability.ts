import type { Step } from '@/api/hooks/use-overview';

/**
 * A settled Step is a record: its fields, checklist and note thread are frozen
 * (CONTEXT.md — "past steps are frozen except that notes may still be
 * appended").
 */
export function isStepEditable(step: Step): boolean {
  return step.status === 'not_started' || step.status === 'in_progress';
}

/**
 * Only the future tail may be reordered or deleted — the current Step can be
 * edited but never moved or removed (CONTEXT.md pipeline mutability).
 */
export function isStepStructurallyFree(step: Step): boolean {
  return step.status === 'not_started';
}

import type { WorkstreamLifecycle } from '@/api/hooks/use-overview';

/**
 * A Complete pipeline has no future zone, so the row never offers the trailing
 * add-step column. `DotCaret` has to mirror that decision or the caret drifts
 * off its dot.
 */
export function canAppendStep(lifecycle: WorkstreamLifecycle): boolean {
  return lifecycle !== 'complete';
}

import type { UrgencyBand } from '@/features/overview/urgency';

/**
 * Readable text colours per band, mirroring `pipeline-row`'s `BAND_COLORS`.
 * The plain `--urgency-week/fortnight/month` tokens are pale chip
 * backgrounds — used as text they are near-invisible.
 */
export const URGENCY_TEXT_CLASSES: Record<UrgencyBand, string> = {
  passed: 'text-urgency-passed',
  week: 'text-urgency-week-foreground',
  fortnight: 'text-urgency-fortnight-foreground',
  month: 'text-urgency-month-foreground',
  far: 'text-urgency-far',
};

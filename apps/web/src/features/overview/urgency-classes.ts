import type { UrgencyBand } from '@/features/overview/urgency';

/**
 * Red → orange → yellow → grey. The pipeline's rings read `currentColor`, so
 * one class per band drives both a dot's ring and its date — they can never
 * disagree. The plain `--urgency-week/fortnight/month` tokens are pale chip
 * backgrounds; as text they are near-invisible, hence the `-foreground` twins.
 */
export const URGENCY_TEXT_CLASSES: Record<UrgencyBand, string> = {
  passed: 'text-urgency-passed',
  week: 'text-urgency-week-foreground',
  fortnight: 'text-urgency-fortnight-foreground',
  month: 'text-urgency-month-foreground',
  far: 'text-urgency-far',
};

/**
 * Dot fills per band, the background twin of `URGENCY_TEXT_CLASSES` — same
 * `-foreground` tokens, since on a 6px dot the pale ones read as no dot at all.
 */
export const URGENCY_DOT_CLASSES: Record<UrgencyBand, string> = {
  passed: 'bg-urgency-passed',
  week: 'bg-urgency-week-foreground',
  fortnight: 'bg-urgency-fortnight-foreground',
  month: 'bg-urgency-month-foreground',
  far: 'bg-urgency-far',
};

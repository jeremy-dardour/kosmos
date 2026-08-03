import { CheckIcon, MessageSquareIcon, PlusIcon } from 'lucide-react';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { canAppendStep } from '@/features/overview/can-append-step';
import { formatDeadlineDate } from '@/features/overview/format-deadline-date';
import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { OwnerAvatar } from '@/features/overview/owner-avatar';
import { STEP_STATUS_LABELS } from '@/features/overview/step-status-labels';
import { urgencyBand } from '@/features/overview/urgency';
import { cn } from '@/lib/utils';

import type {
  ChecklistItem,
  Step,
  StepStatus,
  UserSummary,
  WorkstreamLifecycle,
} from '@/api/hooks/use-overview';
import type { UrgencyBand } from '@/features/overview/urgency';

type StepVisual = StepStatus | 'blocked';

/** Blocked overrides whatever the pointer says the step's status is. */
function stepVisual(step: Step): StepVisual {
  return isBlockedNow(step) ? 'blocked' : step.status;
}

const DOT_CLASSES: Record<StepVisual, string> = {
  done: 'size-3.5 bg-step-done',
  in_progress: 'size-5 bg-step-in-progress shadow-step-current',
  blocked: 'size-5 bg-step-blocked shadow-step-blocked',
  not_started: 'size-3.5 border-[1.5px] border-step-not-started bg-card',
  skipped: 'size-3.5 border-[1.5px] border-dashed border-step-skipped bg-card',
};

const STATUS_LABELS = STEP_STATUS_LABELS satisfies Record<StepVisual, string>;

/**
 * Red → orange → yellow → grey. The ring reads `currentColor`, so one class per
 * band drives both the dot's ring and its date — they can never disagree.
 */
const BAND_COLORS: Record<UrgencyBand, string> = {
  passed: 'text-urgency-passed',
  week: 'text-urgency-week-foreground',
  fortnight: 'text-urgency-fortnight-foreground',
  month: 'text-urgency-month-foreground',
  far: 'text-muted-foreground/60',
};

const BAND_DATE_CLASSES: Record<UrgencyBand, string> = {
  passed: `font-semibold ${BAND_COLORS.passed}`,
  week: `font-medium ${BAND_COLORS.week}`,
  fortnight: BAND_COLORS.fortnight,
  month: BAND_COLORS.month,
  far: BAND_COLORS.far,
};

/** Every dated step ahead of the pointer is ringed; only the weight varies. */
const BAND_RING_CLASSES: Record<UrgencyBand, string> = {
  passed: `ring-[3px] ${BAND_COLORS.passed}`,
  week: `ring-2 ${BAND_COLORS.week}`,
  fortnight: `ring-2 ${BAND_COLORS.fortnight}`,
  month: `ring-2 ${BAND_COLORS.month}`,
  far: `ring-2 ${BAND_COLORS.far}`,
};

interface PipelineRowProperties {
  steps: Step[];
  currentStepId: string | null;
  lifecycle: WorkstreamLifecycle;
  /** Built once by the card, per the one-derived-lookup rule. */
  usersById: Map<string, UserSummary>;
  now: Date;
  openStepId: string | null;
  openNotesStepId: string | null;
  onStepToggle: (stepId: string) => void;
  onNoteMarkerToggle: (stepId: string) => void;
  /** 1-indexed insertion position, as the create-step endpoint takes it. */
  onInsertStep: (position: number) => void;
  onChecklistItemToggle: (itemId: string, isDone: boolean) => void;
}

/**
 * The horizontal pipeline of one workstream card: an equal-width column per
 * Step carrying its dot, name, deadline, note marker and checklist preview,
 * plus the insertion points between them. Presentational — every write leaves
 * through a callback.
 */
export const PipelineRow = ({
  steps,
  currentStepId,
  lifecycle,
  usersById,
  now,
  openStepId,
  openNotesStepId,
  onStepToggle,
  onNoteMarkerToggle,
  onInsertStep,
  onChecklistItemToggle,
}: PipelineRowProperties) => {
  const { t, i18n } = useTranslation();

  const isPipelineComplete = lifecycle === 'complete';
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
  // The step the pointer reaches next — everything before it is already passed.
  const nextStepId =
    steps.find((step) => step.status === 'not_started')?.id ?? null;
  // A running pipeline draws a rail you can read at a glance; a finished one
  // fades to a hairline so live work wins the page.
  const connectorClass = isPipelineComplete
    ? 'bg-border/60'
    : 'bg-muted-foreground/30';

  /**
   * A new Step may only land in the future part of the pipeline. With no
   * current Step (`currentIndex === -1`) the whole pipeline is future, which is
   * exactly the NotStarted case.
   */
  const canInsertAt = (index: number) =>
    canAppendStep(lifecycle) && index > currentIndex;

  return (
    <ol className="group/dots flex items-start">
      {steps.map((step, index) => {
        const visual = stepVisual(step);
        const isOpen = step.id === openStepId;
        const isCurrent = step.id === currentStepId;
        const isNotesOpen = step.id === openNotesStepId;
        const name = step.name || t('overview.pipeline.untitled');
        // A settled step's deadline is history — only work still ahead of the
        // pointer can be late, and only in a pipeline that is still running.
        const isPending =
          !isPipelineComplete &&
          (step.status === 'in_progress' || step.status === 'not_started');
        const band = step.deadline
          ? urgencyBand(step.deadline, now)
          : undefined;
        const ringClass = band && isPending ? BAND_RING_CLASSES[band] : null;
        // Settled work recedes so a card reads as "here and ahead" rather than
        // a wall of green.
        const isSettled = step.status === 'done' || step.status === 'skipped';
        const hasPreview = !isOpen && (isCurrent || step.id === nextStepId);

        return (
          <Fragment key={step.id}>
            {canInsertAt(index) && (
              <InsertStepPoint
                label={t('overview.pipeline.insertStepBefore', { name })}
                onClick={() => onInsertStep(index + 1)}
              />
            )}
            <li className="flex min-w-0 flex-1 flex-col items-center">
              <button
                type="button"
                aria-pressed={isOpen}
                onClick={() => onStepToggle(step.id)}
                className={cn(
                  'group/dot flex w-full min-w-0 flex-col items-center gap-1.5 rounded transition-opacity',
                  isSettled && !isOpen && 'opacity-55 hover:opacity-100',
                )}
              >
                <span className="relative flex h-5 w-full items-center justify-center">
                  {/* Absolutely positioned connectors would otherwise swallow
                      the clicks aimed at the insertion `+` sitting on them. */}
                  {index > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute left-0 top-1/2 h-px w-1/2 -translate-y-1/2',
                        connectorClass,
                      )}
                    />
                  )}
                  {index < steps.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute right-0 top-1/2 h-px w-1/2 -translate-y-1/2',
                        connectorClass,
                      )}
                    />
                  )}
                  <span
                    aria-hidden
                    title={
                      ringClass && step.deadline
                        ? t('overview.pipeline.dueTooltip', {
                            status: t(STATUS_LABELS[visual]),
                            date: step.deadline,
                          })
                        : `${name} — ${t(STATUS_LABELS[visual])}`
                    }
                    className={cn(
                      'relative rounded-full transition-transform group-hover/dot:scale-115',
                      DOT_CLASSES[visual],
                      isCurrent && 'size-5',
                      isOpen && 'scale-115 ring-2 ring-step-in-progress/40',
                      ringClass &&
                        'ring-offset-2 ring-offset-card [--tw-ring-color:currentColor]',
                      ringClass,
                    )}
                  />
                  <span className="sr-only">{t(STATUS_LABELS[visual])}</span>
                </span>
                {/* Step names are the pipeline's labels — they read at body
                    size, not caption size, so the row scans without leaning in. */}
                <span
                  className={cn(
                    'w-full truncate px-1 text-center text-[13px] leading-tight',
                    isOpen || isCurrent
                      ? 'font-semibold text-foreground'
                      : 'font-medium text-foreground/75 group-hover/dot:text-foreground',
                    !step.name && 'font-normal italic text-muted-foreground',
                  )}
                >
                  {name}
                </span>
                {/* An avatar under a dot only ever means an owner override —
                    inherited owners stay invisible here. */}
                {step.explicitOwnerId && (
                  <OwnerAvatar
                    owner={usersById.get(step.explicitOwnerId) ?? null}
                    className="size-4 text-[8px] ring-1 ring-border"
                  />
                )}
                {step.deadline && band && (
                  <span
                    className={cn(
                      'text-[9px] leading-none tabular-nums',
                      isPending
                        ? BAND_DATE_CLASSES[band]
                        : 'text-muted-foreground/60',
                    )}
                  >
                    {formatDeadlineDate(step.deadline, now, i18n.language)}
                  </span>
                )}
              </button>

              {step.noteCount > 0 && (
                <button
                  type="button"
                  aria-pressed={isNotesOpen}
                  aria-label={t(
                    isNotesOpen
                      ? 'overview.notes.hideForStep'
                      : 'overview.notes.showForStep',
                    { name },
                  )}
                  title={t(
                    isNotesOpen
                      ? 'overview.notes.hideForStep'
                      : 'overview.notes.showForStep',
                    { name },
                  )}
                  onClick={() => onNoteMarkerToggle(step.id)}
                  className={cn(
                    'mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                    isNotesOpen
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <MessageSquareIcon aria-hidden className="size-2.5" />
                  {step.noteCount}
                </button>
              )}

              {hasPreview && (
                <ChecklistPreview
                  items={step.checklistItems}
                  isInteractive={isCurrent}
                  onToggle={onChecklistItemToggle}
                />
              )}
            </li>
          </Fragment>
        );
      })}

      {canInsertAt(steps.length) && (
        <li className="shrink-0">
          <button
            type="button"
            aria-label={t('overview.pipeline.appendStep')}
            title={t('overview.pipeline.appendStep')}
            onClick={() => onInsertStep(steps.length + 1)}
            className="flex w-8 flex-col items-center text-muted-foreground hover:text-foreground"
          >
            <span className="flex h-5 items-center">
              <PlusIcon aria-hidden className="size-3.5" />
            </span>
          </button>
        </li>
      )}
    </ol>
  );
};

/**
 * A `+` sitting on the line between two dots, revealed on hover of the row and
 * on keyboard focus. The list item is zero-width and the button absolutely
 * positioned, so insertion points never shift the step columns — `DotCaret`
 * mirrors those widths.
 */
function InsertStepPoint({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <li className="relative z-10 w-0 shrink-0">
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={onClick}
        // `top-0` + `size-5` matches the dot row's height, so the button lands
        // centred on the connector line; the row has no height of its own.
        className="absolute left-1/2 top-0 flex size-5 -translate-x-1/2 items-center justify-center rounded-full border bg-card text-muted-foreground opacity-0 shadow-xs transition-opacity hover:border-foreground/30 hover:text-foreground focus-visible:opacity-100 group-hover/dots:opacity-100 pointer-coarse:opacity-100"
      >
        <PlusIcon aria-hidden className="size-3" />
      </button>
    </li>
  );
}

/**
 * Ghosted checklist under a step dot: readable at a glance on the current and
 * next steps, tickable in place on the current one.
 */
function ChecklistPreview({
  items,
  isInteractive,
  onToggle,
}: {
  items: ChecklistItem[];
  isInteractive: boolean;
  onToggle: (itemId: string, isDone: boolean) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  // Only three items fit, so they should be the ones still needing doing —
  // a stable sort keeps the authored order within each half.
  const byRemaining = [...items].sort(
    (a, b) => Number(a.done) - Number(b.done),
  );
  const shown = byRemaining.slice(0, 3);
  const hidden = items.length - shown.length;

  return (
    <ul
      className={cn(
        'mx-auto mt-1.5 w-full max-w-44 space-y-0.5 px-1',
        isInteractive ? 'opacity-80' : 'pointer-events-none opacity-40',
      )}
    >
      {shown.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            disabled={!isInteractive}
            aria-label={t('overview.pipeline.toggleItem', { name: item.name })}
            title={t('overview.pipeline.toggleItem', { name: item.name })}
            aria-pressed={item.done}
            onClick={() => onToggle(item.id, !item.done)}
            className="flex w-full items-center gap-1 rounded px-0.5 text-left hover:bg-muted/60"
          >
            <span
              aria-hidden
              className={cn(
                'flex size-2.5 shrink-0 items-center justify-center rounded-[2px] border',
                item.done && 'border-step-done bg-step-done text-white',
              )}
            >
              {item.done && <CheckIcon className="size-2" />}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[10px] leading-tight',
                item.done
                  ? 'text-muted-foreground line-through'
                  : 'text-foreground/80',
              )}
            >
              {item.name}
            </span>
          </button>
        </li>
      ))}
      {hidden > 0 && (
        <li className="px-0.5 text-[10px] leading-tight text-muted-foreground/70">
          {t('overview.pipeline.moreItems', { count: hidden })}
        </li>
      )}
    </ul>
  );
}

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useUpdateChecklistItem } from '@/api/hooks/use-update-checklist-item';
import { useUpdateWorkstreamInline } from '@/api/hooks/use-update-workstream';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AdvanceControl } from '@/features/overview/advance-control';
import { ClickToEdit } from '@/features/overview/click-to-edit';
import { daysUntil } from '@/features/overview/days-until';
import { formatDeadlineDate } from '@/features/overview/format-deadline-date';
import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { isInsideCard } from '@/features/overview/is-inside-card';
import { OwnerPicker } from '@/features/overview/owner-picker';
import { PipelineRow } from '@/features/overview/pipeline-row';
import { urgencyBand } from '@/features/overview/urgency';
import { cn } from '@/lib/utils';

import type {
  Group,
  Step,
  UserSummary,
  Workstream,
} from '@/api/hooks/use-overview';
import type { UrgencyBand } from '@/features/overview/urgency';
import type { ReactNode } from 'react';

const ICONS = ['🏰', '🍽️', '💐', '📸', '🎵', '💍', '👗', '🚗', '🎂', '✉️'];

/** Under this horizon the badge counts days; beyond it, a plain date reads better. */
const COUNTDOWN_HORIZON_DAYS = 14;

const BAND_BADGE_CLASSES: Record<UrgencyBand, string> = {
  passed: 'bg-urgency-late text-urgency-late-foreground',
  week: 'bg-urgency-soon text-urgency-soon-foreground',
  fortnight: 'bg-urgency-fortnight text-urgency-fortnight-foreground',
  month: 'bg-urgency-month text-urgency-month-foreground',
  far: 'bg-muted text-muted-foreground',
};

interface InlineWorkstreamCardProperties {
  workstream: Workstream;
  groups: Group[];
  /** Built once by the list, per the one-derived-lookup rule. */
  usersById: Map<string, UserSummary>;
  projectId: string | undefined;
  now: Date;
  openStepId: string | null;
  openNotesStepId: string | null;
  onStepToggle: (stepId: string) => void;
  onNoteMarkerToggle: (stepId: string) => void;
  onCloseEditors: () => void;
  onInsertStep: (position: number) => void;
  dragHandle?: ReactNode;
}

/**
 * One workstream's inline card: the chrome is live fields, every change
 * commits immediately through the cache seam — no edit mode, no Save button.
 */
export const InlineWorkstreamCard = ({
  workstream,
  groups,
  usersById,
  projectId,
  now,
  openStepId,
  openNotesStepId,
  onStepToggle,
  onNoteMarkerToggle,
  onCloseEditors,
  onInsertStep,
  dragHandle,
}: InlineWorkstreamCardProperties) => {
  const { t } = useTranslation();
  const updateWorkstream = useUpdateWorkstreamInline(projectId);
  const updateChecklistItem = useUpdateChecklistItem(projectId);
  const cardRef = useRef<HTMLElement>(null);

  const isAnyPanelOpen = openStepId !== null || openNotesStepId !== null;

  useEffect(() => {
    if (!isAnyPanelOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!isInsideCard(event.target, cardRef.current)) {
        onCloseEditors();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isAnyPanelOpen, onCloseEditors]);

  const isLive = workstream.lifecycle !== 'complete';
  const users = usersById.values().toArray();
  const deadlineStep = deadlineStepOf(workstream);

  const commit = (body: {
    name?: string;
    icon?: string;
    groupId?: string | null;
    ownerId?: string | null;
  }) => {
    updateWorkstream.mutate({
      params: { path: { id: workstream.id } },
      body,
    });
  };

  return (
    <article
      ref={cardRef}
      className={cn(
        'group/card rounded-lg border p-4 transition-colors',
        cardChromeClass(isLive, isAnyPanelOpen),
      )}
    >
      {/* The dimming lives on the header rather than the card root, because a
          parent `opacity` cannot be undone by the parts that must stay bright. */}
      <div className={cn('flex items-center gap-2', !isLive && 'opacity-65')}>
        {dragHandle}
        <IconPicker
          value={workstream.icon}
          label={t('overview.card.changeIcon', { name: workstream.name })}
          onChange={(icon) => commit({ icon })}
        />
        <ClickToEdit
          value={workstream.name}
          label={t('overview.card.renameLabel', { name: workstream.name })}
          placeholder={t('overview.pipeline.untitled')}
          className={cn(
            'text-sm',
            isLive
              ? 'font-semibold text-foreground'
              : 'font-medium text-muted-foreground',
          )}
          onCommit={(name) => commit({ name })}
        />
        <GroupChip
          groups={groups}
          groupId={workstream.groupId ?? null}
          label={t('overview.card.changeGroup', { name: workstream.name })}
          onSelect={(groupId) => commit({ groupId })}
        />
        <LifecycleBadges workstream={workstream} />
        <AdvanceControl workstream={workstream} projectId={projectId} />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {deadlineStep?.deadline && (
            <DeadlineBadge step={deadlineStep} now={now} />
          )}
          <OwnerPicker
            users={users}
            ownerId={workstream.ownerId}
            label={t('overview.card.changeOwner', { name: workstream.name })}
            clearLabel={t('overview.card.unassigned')}
            onSelect={(ownerId) => commit({ ownerId })}
          />
        </div>
      </div>

      <div className="mt-3">
        <PipelineRow
          steps={workstream.steps}
          currentStepId={workstream.currentStepId ?? null}
          lifecycle={workstream.lifecycle}
          usersById={usersById}
          now={now}
          openStepId={openStepId}
          openNotesStepId={openNotesStepId}
          onStepToggle={onStepToggle}
          onNoteMarkerToggle={onNoteMarkerToggle}
          onInsertStep={onInsertStep}
          onChecklistItemToggle={(itemId, isDone) =>
            updateChecklistItem.mutate({
              params: { path: { id: itemId } },
              body: { done: isDone },
            })
          }
        />
      </div>
    </article>
  );
};

/**
 * Chrome follows lifecycle: live work is a framed card with a surface;
 * finished work keeps only a light frame so it stays findable in the
 * Completed section without competing. Anything open restores the full frame.
 */
function cardChromeClass(isLive: boolean, isOpen: boolean): string {
  if (isOpen) return 'border-step-in-progress/60 bg-card shadow-xs';
  return isLive
    ? 'border-border bg-card shadow-xs hover:border-muted-foreground/30'
    : 'border-border/50 bg-transparent hover:bg-card/60';
}

function deadlineStepOf(workstream: Workstream): Step | null {
  if (!workstream.nearestDeadlineStepId) return null;
  return (
    workstream.steps.find(
      (step) => step.id === workstream.nearestDeadlineStepId,
    ) ?? null
  );
}

function IconPicker({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (icon: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            className="shrink-0 rounded px-0.5 text-base leading-none hover:bg-muted"
          />
        }
      >
        {value}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="grid grid-cols-5 gap-1 p-1">
        {ICONS.map((icon) => (
          <DropdownMenuItem
            key={icon}
            className="justify-center text-base"
            onClick={() => onChange(icon)}
          >
            {icon}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GroupChip({
  groups,
  groupId,
  label,
  onSelect,
}: {
  groups: Group[];
  groupId: string | null;
  label: string;
  onSelect: (groupId: string | null) => void;
}) {
  const { t } = useTranslation();
  const group = groups.find((candidate) => candidate.id === groupId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        <span
          aria-hidden
          className="size-1.5 rounded-[2px] border"
          style={{ backgroundColor: group?.color ?? 'transparent' }}
        />
        {group?.name ?? t('overview.card.noGroup')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onSelect(null)}>
          {t('overview.card.noGroup')}
        </DropdownMenuItem>
        {groups.map((candidate) => (
          <DropdownMenuItem
            key={candidate.id}
            onClick={() => onSelect(candidate.id)}
          >
            <span
              aria-hidden
              className="mr-1.5 inline-block size-2 rounded-[2px]"
              style={{ backgroundColor: candidate.color }}
            />
            {candidate.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LifecycleBadges({ workstream }: { workstream: Workstream }) {
  const { t } = useTranslation();
  const isBlocked = workstream.steps.some((step) => isBlockedNow(step));

  return (
    <>
      {isBlocked && (
        <span className="shrink-0 rounded-sm bg-step-blocked/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-step-blocked">
          {t('overview.stepStatus.blocked')}
        </span>
      )}
      {workstream.lifecycle === 'not_started' && (
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
          {t('overview.card.notStarted')}
        </span>
      )}
      {/* Complete stays plain text: it is the state that should recede. */}
      {workstream.lifecycle === 'complete' && (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-step-done">
          {t('overview.card.complete')}
        </span>
      )}
    </>
  );
}

function DeadlineBadge({ step, now }: { step: Step; now: Date }) {
  const { t, i18n } = useTranslation();
  if (!step.deadline) return null;

  const days = daysUntil(step.deadline, now);
  const label =
    days < 0
      ? t('overview.deadline.late', { count: -days })
      : days === 0
        ? t('overview.deadline.today')
        : days === 1
          ? t('overview.deadline.tomorrow')
          : days < COUNTDOWN_HORIZON_DAYS
            ? t('overview.deadline.upcoming', { count: days })
            : formatDeadlineDate(step.deadline, now, i18n.language);

  return (
    <span
      title={t('overview.deadline.dueTooltip', {
        name: step.name,
        date: step.deadline,
      })}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-tight',
        BAND_BADGE_CLASSES[urgencyBand(step.deadline, now)],
      )}
    >
      <span className="max-w-32 truncate opacity-80">{step.name}</span>
      <span className="font-semibold tabular-nums">{label}</span>
    </span>
  );
}

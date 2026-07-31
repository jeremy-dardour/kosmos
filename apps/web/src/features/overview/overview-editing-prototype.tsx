/**
 * PROTOTYPE — throwaway code, do not promote as-is.
 *
 * Question (settled): every Workstream / Step / checklist / note edit happens
 * inline in the overview list itself, with no side panel at all. Variant A
 * ("live fields") won; B and C are deleted.
 *
 * Deadlines (marked dots + quiet dates), notes (per-step markers) and card
 * chrome (framed while live, bare once complete) are settled too, so there is
 * no variant switcher left.
 *
 * Mounted on the real `/` route behind `?variant=A`, inside the real header and
 * the real grouped card list. Workstreams, steps, checklists and notes are read
 * from the running API; every edit is applied to a local draft only — nothing
 * is written back.
 */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  ListChecksIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { useWorkstreamNotes } from '@/api/hooks/use-workstream-notes';
import { useAuthState } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { daysUntil } from '@/features/overview/days-until';
import { groupWorkstreams } from '@/features/overview/group-workstreams';
import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { OwnerAvatar } from '@/features/overview/owner-avatar';
import { cn } from '@/lib/utils';

import type {
  Group,
  Step,
  UserSummary,
  Workstream,
} from '@/api/hooks/use-overview';
import type { NoteEntry } from '@/api/hooks/use-workstream-notes';
import type { WorkstreamGroup } from '@/features/overview/group-workstreams';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ReactNode } from 'react';

interface OverviewEditingPrototypeProperties {
  groups: Group[];
  workstreams: Workstream[];
  users: UserSummary[];
}

/** B3 candidates: where the primary action lives on the card. */
type AdvancePlacement = 'top-right' | 'after-title' | 'bottom-right';

/* ------------------------------------------------------------------ draft */

/** A note added in this session; it has no server id yet. */
interface LocalNote {
  id: string;
  body: string;
}

interface DraftStore {
  workstreams: Workstream[];
  /** Groups in their manual order (drag & drop applied). */
  orderedGroups: Group[];
  edits: number;
  localNotes: ReadonlyMap<string, LocalNote[]>;
  /** Overrides keyed by note id, covering both API and local notes. */
  noteEdits: ReadonlyMap<string, string>;
  deletedNoteIds: ReadonlySet<string>;
  patchWorkstream: (id: string, patch: Partial<Workstream>) => void;
  /** Begin a NotStarted workstream: step 1 becomes current. */
  startWorkstream: (id: string) => void;
  /** Record the current step's outcome and move the pointer forward. */
  advanceWorkstream: (id: string, outcome: 'done' | 'skipped') => void;
  /** Reorders `activeId` to `overId`'s slot; no-op across different groups. */
  moveWorkstream: (activeId: string, overId: string) => void;
  moveGroup: (activeId: string, overId: string) => void;
  patchStep: (
    workstreamId: string,
    stepId: string,
    patch: Partial<Step>,
  ) => void;
  /** Inserts at `atIndex`; returns the new step's id so callers can open it. */
  addStep: (workstreamId: string, atIndex: number) => string;
  removeStep: (workstreamId: string, stepId: string) => void;
  moveStep: (workstreamId: string, stepId: string, offset: number) => void;
  addChecklistItem: (
    workstreamId: string,
    stepId: string,
    name: string,
  ) => void;
  toggleChecklistItem: (
    workstreamId: string,
    stepId: string,
    itemId: string,
  ) => void;
  removeChecklistItem: (
    workstreamId: string,
    stepId: string,
    itemId: string,
  ) => void;
  addNote: (stepId: string, body: string) => void;
  editNote: (noteId: string, body: string) => void;
  deleteNote: (noteId: string) => void;
}

function renumber(steps: Step[]): Step[] {
  return steps.map((step, index) => ({ ...step, position: index + 1 }));
}

function isEditableStep(step: Step): boolean {
  return step.status === 'not_started' || step.status === 'in_progress';
}

/** Only the future tail can be reordered or removed (CONTEXT.md pipeline rules). */
function isStructurallyFree(step: Step): boolean {
  return step.status === 'not_started';
}

function useDraft(source: Workstream[], groups: Group[]): DraftStore {
  const [draft, setDraft] = useState<Workstream[] | null>(null);
  const [groupOrderIds, setGroupOrderIds] = useState<string[] | null>(null);
  const [edits, setEdits] = useState(0);
  const [localNotes, setLocalNotes] = useState<
    ReadonlyMap<string, LocalNote[]>
  >(() => new Map());
  const [noteEdits, setNoteEdits] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [deletedNoteIds, setDeletedNoteIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const workstreams = draft ?? source;

  // Manual order: the API's alphabetical order until a drag says otherwise.
  const orderedGroups = groupOrderIds
    ? [...groups].sort(
        (a, b) => groupOrderIds.indexOf(a.id) - groupOrderIds.indexOf(b.id),
      )
    : groups;

  const mutate = (
    workstreamId: string,
    updater: (workstream: Workstream) => Workstream,
  ) => {
    setDraft((current) =>
      (current ?? source).map((workstream) =>
        workstream.id === workstreamId ? updater(workstream) : workstream,
      ),
    );
    setEdits((count) => count + 1);
  };

  const mutateSteps = (
    workstreamId: string,
    updater: (steps: Step[]) => Step[],
  ) =>
    mutate(workstreamId, (workstream) => ({
      ...workstream,
      steps: renumber(updater(workstream.steps)),
    }));

  const mutateStep = (
    workstreamId: string,
    stepId: string,
    updater: (step: Step) => Step,
  ) =>
    mutateSteps(workstreamId, (steps) =>
      steps.map((step) => (step.id === stepId ? updater(step) : step)),
    );

  return {
    workstreams,
    orderedGroups,
    edits,
    localNotes,
    noteEdits,
    deletedNoteIds,

    patchWorkstream: (id, patch) =>
      mutate(id, (workstream) => ({ ...workstream, ...patch })),

    startWorkstream: (id) =>
      mutate(id, (workstream) => {
        const [first, ...rest] = workstream.steps;
        if (!first || workstream.lifecycle !== 'not_started') return workstream;
        return {
          ...workstream,
          lifecycle: 'active',
          startedAt: new Date().toISOString(),
          currentStepId: first.id,
          steps: [{ ...first, status: 'in_progress' }, ...rest],
        };
      }),

    advanceWorkstream: (id, outcome) =>
      mutate(id, (workstream) => {
        const index = workstream.steps.findIndex(
          (step) => step.status === 'in_progress',
        );
        if (index === -1) return workstream;
        const now = new Date().toISOString();
        const next = workstream.steps[index + 1] ?? null;
        return {
          ...workstream,
          lifecycle: next ? 'active' : 'complete',
          completedAt: next ? null : now,
          currentStepId: next?.id ?? null,
          steps: workstream.steps.map((step, at) => {
            if (at === index) {
              return {
                ...step,
                status: outcome,
                outcome,
                outcomeAt: now,
                blocked: false,
              };
            }
            return at === index + 1
              ? { ...step, status: 'in_progress' as const }
              : step;
          }),
        };
      }),

    moveWorkstream: (activeId, overId) => {
      setDraft((current) => {
        const list = current ?? source;
        const from = list.findIndex((w) => w.id === activeId);
        const to = list.findIndex((w) => w.id === overId);
        const moved = list[from];
        const target = list[to];
        if (!moved || !target) return list;
        // Within-group only: dropping over another group's card is a no-op.
        if ((moved.groupId ?? null) !== (target.groupId ?? null)) return list;
        const next = [...list];
        next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
      setEdits((count) => count + 1);
    },

    moveGroup: (activeId, overId) => {
      setGroupOrderIds((current) => {
        const order = current ?? groups.map((group) => group.id);
        const from = order.indexOf(activeId);
        const to = order.indexOf(overId);
        if (from === -1 || to === -1) return current;
        const next = [...order];
        next.splice(from, 1);
        next.splice(to, 0, activeId);
        return next;
      });
      setEdits((count) => count + 1);
    },

    patchStep: (workstreamId, stepId, patch) =>
      mutateStep(workstreamId, stepId, (step) => ({ ...step, ...patch })),

    addStep: (workstreamId, atIndex) => {
      const now = new Date().toISOString();
      const created: Step = {
        id: `draft-${globalThis.crypto.randomUUID()}`,
        name: '',
        position: 0,
        status: 'not_started',
        blocked: false,
        deadline: null,
        checklistItems: [],
        noteCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      mutateSteps(workstreamId, (steps) => {
        const next = [...steps];
        next.splice(atIndex, 0, created);
        return next;
      });

      return created.id;
    },

    removeStep: (workstreamId, stepId) =>
      mutateSteps(workstreamId, (steps) =>
        steps.filter((step) => step.id !== stepId),
      ),

    moveStep: (workstreamId, stepId, offset) =>
      mutateSteps(workstreamId, (steps) => {
        const index = steps.findIndex((step) => step.id === stepId);
        const target = index + offset;
        const moved = steps[index];
        const swapped = steps[target];
        if (!moved || !swapped || !isStructurallyFree(swapped)) return steps;
        const next = [...steps];
        next[index] = swapped;
        next[target] = moved;
        return next;
      }),

    addChecklistItem: (workstreamId, stepId, name) =>
      mutateStep(workstreamId, stepId, (step) => {
        const now = new Date().toISOString();
        return {
          ...step,
          checklistItems: [
            ...step.checklistItems,
            {
              id: `draft-${globalThis.crypto.randomUUID()}`,
              name,
              position: step.checklistItems.length + 1,
              done: false,
              createdAt: now,
              updatedAt: now,
            },
          ],
        };
      }),

    toggleChecklistItem: (workstreamId, stepId, itemId) =>
      mutateStep(workstreamId, stepId, (step) => ({
        ...step,
        checklistItems: step.checklistItems.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item,
        ),
      })),

    removeChecklistItem: (workstreamId, stepId, itemId) =>
      mutateStep(workstreamId, stepId, (step) => ({
        ...step,
        checklistItems: step.checklistItems.filter(
          (item) => item.id !== itemId,
        ),
      })),

    addNote: (stepId, body) => {
      setLocalNotes((current) => {
        const next = new Map(current);
        next.set(stepId, [
          ...(next.get(stepId) ?? []),
          { id: `draft-note-${globalThis.crypto.randomUUID()}`, body },
        ]);
        return next;
      });
      setEdits((count) => count + 1);
    },

    editNote: (noteId, body) => {
      setNoteEdits((current) => new Map(current).set(noteId, body));
      setEdits((count) => count + 1);
    },

    deleteNote: (noteId) => {
      setDeletedNoteIds((current) => new Set(current).add(noteId));
      setEdits((count) => count + 1);
    },
  };
}

/** Real notes for one workstream, grouped by step; idle until asked for. */
function useNotesByStep(workstreamId: string | undefined) {
  const notes = useWorkstreamNotes(workstreamId);

  return useMemo(() => {
    const byStep = new Map<string, NoteEntry[]>();
    const entries = notes.data ?? [];
    for (const note of entries) {
      byStep.set(note.stepId, [...(byStep.get(note.stepId) ?? []), note]);
    }
    return byStep;
  }, [notes.data]);
}

/* --------------------------------------------------------------- deadlines */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * `2026-09-12` → `12 Sep`, keeping the year when it is not the current one —
 * without it a deadline from last year reads as a future date.
 */
function formatShortDate(isoDate: string, now: Date): string {
  const [year, month, day] = isoDate.split('-');
  const short = `${Number(day)} ${MONTHS[Number(month) - 1]}`;
  return Number(year) === now.getFullYear()
    ? short
    : `${short} ${year?.slice(2)}`;
}

const COUNTDOWN_HORIZON_DAYS = 14;

/**
 * Countdowns only stay useful near the deadline; past a fortnight the date
 * itself reads better than "in 143d", and `in 0d` becomes "today".
 */
function formatCountdown(isoDate: string, now: Date): string {
  const days = daysUntil(isoDate, now);
  if (days < 0) return `${-days}d late`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < COUNTDOWN_HORIZON_DAYS) return `in ${days}d`;
  return formatShortDate(isoDate, now);
}

/**
 * The shared three-band scale is too coarse here: a step due tomorrow and one
 * due in five months both read as "not late". Five bands, ordered by how much
 * they should pull the eye.
 */
type StepUrgency = 'passed' | 'week' | 'fortnight' | 'month' | 'far';

function stepUrgency(deadline: string, now: Date): StepUrgency {
  const days = daysUntil(deadline, now);
  if (days < 0) return 'passed';
  if (days < 7) return 'week';
  if (days < 14) return 'fortnight';
  if (days < 30) return 'month';
  return 'far';
}

/**
 * Red → orange → yellow → grey. The ring reads `currentColor`, so one class
 * per band drives both the dot and its date.
 *
 * PROTOTYPE: orange and yellow come from Tailwind's default palette because the
 * theme only ships three urgency tokens. Production wants real tokens.
 */
const URGENCY_COLOR: Record<StepUrgency, string> = {
  passed: 'text-urgency-late',
  week: 'text-urgency-late',
  fortnight: 'text-orange-500 dark:text-orange-400',
  month: 'text-yellow-600 dark:text-yellow-400',
  far: 'text-muted-foreground/60',
};

const URGENCY_TEXT: Record<StepUrgency, string> = {
  passed: `font-semibold ${URGENCY_COLOR.passed}`,
  week: `font-medium ${URGENCY_COLOR.week}`,
  fortnight: URGENCY_COLOR.fortnight,
  month: URGENCY_COLOR.month,
  far: URGENCY_COLOR.far,
};

/** Every dated step ahead of the pointer is ringed; only the weight varies. */
const URGENCY_RING: Record<StepUrgency, string> = {
  passed: `ring-[3px] ${URGENCY_COLOR.passed}`,
  week: `ring-2 ${URGENCY_COLOR.week}`,
  fortnight: `ring-2 ${URGENCY_COLOR.fortnight}`,
  month: `ring-2 ${URGENCY_COLOR.month}`,
  far: `ring-2 ${URGENCY_COLOR.far}`,
};

const URGENCY_BADGE: Record<StepUrgency, string> = {
  passed: 'bg-urgency-late text-urgency-late-foreground',
  week: 'bg-urgency-soon text-urgency-soon-foreground',
  fortnight:
    'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  month:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  far: 'bg-muted text-muted-foreground',
};

/**
 * The workstream's nearest deadline, pinned to the card's top-right corner and
 * naming the step it belongs to.
 */
function WorkstreamDeadline({ step, now }: { step: Step; now: Date }) {
  if (!step.deadline) return null;

  return (
    <span
      title={`${step.name} due ${step.deadline}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-tight',
        URGENCY_BADGE[stepUrgency(step.deadline, now)],
      )}
    >
      <span className="max-w-32 truncate opacity-80">{step.name}</span>
      <span className="font-semibold tabular-nums">
        {formatCountdown(step.deadline, now)}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------- primitives */

function ClickToEdit({
  value,
  label,
  placeholder = 'Untitled',
  className,
  startEditing = false,
  onCommit,
}: {
  value: string;
  label: string;
  placeholder?: string;
  className?: string;
  /** A freshly created step opens straight into its name field. */
  startEditing?: boolean;
  onCommit: (next: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(startEditing);
  const cancelledRef = useRef(false);

  if (!isEditing) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => setIsEditing(true)}
        className={cn(
          '-mx-1 min-w-0 truncate rounded px-1 text-left hover:bg-muted focus-visible:bg-muted',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <input
      // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
      autoFocus
      aria-label={label}
      defaultValue={value}
      placeholder={placeholder}
      className={cn(
        '-mx-1 min-w-0 rounded border bg-background px-1 outline-hidden ring-2 ring-step-in-progress/40',
        className,
      )}
      onBlur={(event) => {
        if (!cancelledRef.current) onCommit(event.target.value);
        cancelledRef.current = false;
        setIsEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          cancelledRef.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function OwnerPicker({
  users,
  ownerId,
  label,
  inheritLabel = 'Unassigned',
  onSelect,
}: {
  users: UserSummary[];
  ownerId: string | null | undefined;
  label: string;
  inheritLabel?: string;
  onSelect: (ownerId: string | null) => void;
}) {
  const owner = users.find((user) => user.id === ownerId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="shrink-0 rounded-full ring-offset-2 hover:opacity-80 focus-visible:ring-2"
          />
        }
      >
        <OwnerAvatar owner={owner} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onSelect(null)}>
          {inheritLabel}
        </DropdownMenuItem>
        {users.map((user) => (
          <DropdownMenuItem key={user.id} onClick={() => onSelect(user.id)}>
            {user.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeadlineField({
  value,
  label,
  now,
  onChange,
  className,
}: {
  value: string | null | undefined;
  label: string;
  now: Date;
  onChange: (next: string | null) => void;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
        autoFocus
        type="date"
        aria-label={label}
        defaultValue={value ?? ''}
        className={cn(
          'h-6 rounded-md border bg-background px-1.5 text-[11px]',
          className,
        )}
        onChange={(event) => onChange(event.target.value || null)}
        onBlur={() => setIsEditing(false)}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setIsEditing(true)}
      className={cn(
        'h-6 shrink-0 rounded-md px-1.5 text-[11px] tabular-nums hover:bg-muted',
        value ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      {value ? `Due ${formatShortDate(value, now)}` : '+ due date'}
    </button>
  );
}

function ChecklistBlock({
  step,
  isFrozen,
  onToggle,
  onAdd,
  onRemove,
}: {
  step: Step;
  /** A past Step's checklist is a record, not a working list. */
  isFrozen: boolean;
  onToggle: (itemId: string) => void;
  onAdd: (name: string) => void;
  onRemove?: (itemId: string) => void;
}) {
  const [isComposing, setIsComposing] = useState(false);
  const done = step.checklistItems.filter((item) => item.done).length;

  return (
    <div className="mt-1.5">
      {step.checklistItems.length > 0 && (
        <>
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <ListChecksIcon className="size-3" />
            {done}/{step.checklistItems.length}
          </div>
          <ul className="mt-1 space-y-0.5">
            {step.checklistItems.map((item) => (
              <li
                key={item.id}
                className="group/item flex items-center gap-1.5"
              >
                <button
                  type="button"
                  disabled={isFrozen}
                  aria-label={`Toggle ${item.name}`}
                  aria-pressed={item.done}
                  onClick={() => onToggle(item.id)}
                  className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                    item.done && 'border-step-done bg-step-done text-white',
                    isFrozen && 'cursor-default opacity-70',
                  )}
                >
                  {item.done && <CheckIcon className="size-2.5" />}
                </button>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[11px]',
                    item.done && 'text-muted-foreground line-through',
                  )}
                >
                  {item.name}
                </span>
                {onRemove && !isFrozen && (
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => onRemove(item.id)}
                    className="shrink-0 text-muted-foreground opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100"
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {isFrozen ? null : isComposing ? (
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
          autoFocus
          aria-label="New checklist item"
          placeholder="Item, Enter to add another"
          className="mt-1 h-6 w-full rounded-md border bg-background px-1.5 text-[11px]"
          onBlur={() => setIsComposing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.blur();
            if (event.key !== 'Enter') return;
            const name = event.currentTarget.value.trim();
            if (!name) {
              event.currentTarget.blur();
              return;
            }
            onAdd(name);
            event.currentTarget.value = '';
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsComposing(true)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          {step.checklistItems.length > 0 ? 'Add item' : 'Add checklist'}
        </button>
      )}
    </div>
  );
}

function NotesBlock({
  step,
  entries,
  isAppendOnly,
  startOpen = false,
  onAdd,
  onEdit,
  onDelete,
}: {
  step: Step;
  entries: ThreadEntry[];
  isAppendOnly: boolean;
  startOpen?: boolean;
  onAdd: (body: string) => void;
  onEdit: (noteId: string, body: string) => void;
  onDelete: (noteId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(startOpen);
  const latest = entries.at(-1);
  const isDraftStep = step.id.startsWith('draft-');

  if (isDraftStep) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground/70">
        Notes available once the step is saved
      </p>
    );
  }

  if (!latest && !isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <MessageSquarePlusIcon className="size-3" />
        Add note
      </button>
    );
  }

  return (
    <div className="mt-1.5">
      {latest && (
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex w-full items-center gap-1.5 rounded-md bg-muted/55 px-2 py-1 text-left text-[11px] hover:bg-muted"
        >
          <MessageSquareIcon className="size-3 shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-medium">
            {entries.length} {entries.length === 1 ? 'note' : 'notes'}
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {latest.body}
          </span>
          <span className="shrink-0 text-muted-foreground/70">
            {latest.author} · {latest.when}
          </span>
          <ChevronDownIcon
            className={cn(
              'size-3 shrink-0 text-muted-foreground transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </button>
      )}

      {isOpen && (
        <NoteThread
          entries={entries}
          composerLabel={`Add a note to ${step.name}`}
          isAppendOnly={isAppendOnly}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onEscape={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

function StatusDot({
  step,
  className,
  title,
}: {
  step: Step;
  className?: string;
  title?: string;
}) {
  const isBlocked = isBlockedNow(step);

  return (
    <span
      aria-hidden
      title={title ?? step.status}
      className={cn(
        'size-3.5 shrink-0 rounded-full',
        isBlocked && 'bg-step-blocked shadow-step-blocked',
        !isBlocked && step.status === 'done' && 'bg-step-done',
        !isBlocked &&
          step.status === 'in_progress' &&
          'bg-step-in-progress shadow-step-current',
        step.status === 'not_started' &&
          'border border-step-not-started bg-card',
        step.status === 'skipped' &&
          'border border-dashed border-step-skipped bg-card',
        className,
      )}
    />
  );
}

function LifecycleBadges({ workstream }: { workstream: Workstream }) {
  const isBlocked = workstream.steps.some((step) => isBlockedNow(step));

  return (
    <>
      {isBlocked && (
        <span className="shrink-0 rounded-sm bg-step-blocked/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-step-blocked">
          Blocked
        </span>
      )}
      {workstream.lifecycle === 'not_started' && (
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
          Not started
        </span>
      )}
      {/* Complete stays plain text: it is the state that should recede. */}
      {workstream.lifecycle === 'complete' && (
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-step-done">
          Complete
        </span>
      )}
    </>
  );
}

function GroupHeader({
  group,
  count,
  dragHandle,
}: {
  group: Group | null;
  count: number;
  dragHandle?: ReactNode;
}) {
  return (
    <header className="mb-2 flex items-center gap-2">
      {dragHandle}
      <span
        aria-hidden
        className="size-2 rounded-[2px] border"
        style={{ backgroundColor: group?.color ?? 'transparent' }}
      />
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {group?.name ?? 'Ungrouped'}
      </h2>
      <span className="text-[11px] text-muted-foreground/60">{count}</span>
    </header>
  );
}

function DragHandle({
  label,
  className,
  ...rest
}: {
  label: string;
  className?: string;
} & Record<string, unknown>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cn(
        'shrink-0 cursor-grab touch-none rounded text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing',
        className,
      )}
    >
      <GripVerticalIcon className="size-3.5" />
    </button>
  );
}

const groupDndId = (group: Group | null) => `group:${group?.id ?? 'ungrouped'}`;

function useDndSensors() {
  return useSensors(
    // The distance gate keeps plain clicks (open, edit) from starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}

/**
 * Cards keep the manual order of the draft array — no lifecycle sort. Only
 * completion moves a card, and that moves it out of the group entirely, into
 * the Completed section.
 *
 * Each group runs its own card DndContext: a card drag only ever measures its
 * siblings, so it cannot stutter against other groups' drop targets, and the
 * within-group rule is enforced by construction rather than by rejection.
 */
function SortableGroupSection({
  bucket,
  draft,
  children,
}: {
  bucket: WorkstreamGroup;
  draft: DraftStore;
  children: (workstream: Workstream, dragHandle?: ReactNode) => ReactNode;
}) {
  const sensors = useDndSensors();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: groupDndId(bucket.group),
      // Ungrouped is "not yet filed", pinned after the real groups.
      disabled: bucket.group === null,
    });

  const onCardDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    draft.moveWorkstream(String(active.id), String(over.id));
  };

  // A lone card has nothing to reorder against, so it gets no handle at all.
  const hasSiblings = bucket.workstreams.length > 1;

  return (
    <section
      ref={setNodeRef}
      // Translate only: the sortable scale component would deform the section.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-label={bucket.group?.name ?? 'Ungrouped'}
      className="group/section"
    >
      <GroupHeader
        group={bucket.group}
        count={bucket.workstreams.length}
        dragHandle={
          bucket.group && (
            <DragHandle
              label={`Reorder group ${bucket.group.name}`}
              className="-ml-5 group-hover/section:opacity-100"
              {...attributes}
              {...listeners}
            />
          )
        }
      />
      {hasSiblings ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onCardDragEnd}
        >
          <SortableContext
            items={bucket.workstreams.map((workstream) => workstream.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2.5">
              {bucket.workstreams.map((workstream) => (
                <SortableWorkstreamCard key={workstream.id} id={workstream.id}>
                  {(dragHandle) => children(workstream, dragHandle)}
                </SortableWorkstreamCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-2.5">
          {bucket.workstreams.map((workstream) => children(workstream))}
        </div>
      )}
    </section>
  );
}

function SortableWorkstreamCard({
  id,
  children,
}: {
  id: string;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      // Translate only — the scale part of the sortable transform is what was
      // deforming cards of different heights mid-drag.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'rounded-lg',
        // The dragged card floats above the list at full strength; the gap the
        // siblings open up underneath is the drop zone.
        isDragging && 'z-10 shadow-lg ring-2 ring-foreground/15',
      )}
    >
      {children(
        <DragHandle
          label="Reorder workstream"
          className="-ml-2 group-hover/card:opacity-100"
          {...attributes}
          {...listeners}
        />,
      )}
    </div>
  );
}

/**
 * The live groups, both drag levels wired: whole groups by their header
 * handle, workstreams within their own group by the card handle (its own
 * nested context inside each section).
 */
function DraggableGroupedList({
  groups,
  workstreams,
  draft,
  children,
}: {
  groups: Group[];
  workstreams: Workstream[];
  draft: DraftStore;
  children: (workstream: Workstream, dragHandle?: ReactNode) => ReactNode;
}) {
  const sensors = useDndSensors();
  const buckets = groupWorkstreams(groups, workstreams);

  const onGroupDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    draft.moveGroup(
      String(active.id).slice('group:'.length),
      String(over.id).slice('group:'.length),
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onGroupDragEnd}
    >
      <SortableContext
        items={buckets
          .filter((bucket) => bucket.group !== null)
          .map((bucket) => groupDndId(bucket.group))}
        strategy={verticalListSortingStrategy}
      >
        {buckets.map((bucket) => (
          <SortableGroupSection
            key={groupDndId(bucket.group)}
            bucket={bucket}
            draft={draft}
          >
            {children}
          </SortableGroupSection>
        ))}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Done work leaves its group and sinks here, collapsed by default — the page
 * ends where live work ends. Inside, cards cluster by group (same order as
 * above) and keep the recessive complete-card treatment.
 */
function CompletedSection({
  groups,
  workstreams,
  children,
}: {
  groups: Group[];
  workstreams: Workstream[];
  children: (workstream: Workstream) => ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (workstreams.length === 0) return null;

  return (
    <section aria-label="Completed">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-2 rounded py-1 text-muted-foreground hover:text-foreground"
      >
        <ChevronRightIcon
          className={cn(
            'size-3.5 shrink-0 transition-transform',
            isOpen && 'rotate-90',
          )}
        />
        <CheckIcon className="size-3.5 shrink-0 text-step-done" />
        <span className="text-[11px] font-medium uppercase tracking-wider">
          Completed
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground/60">
          {workstreams.length}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </button>

      {isOpen && (
        <div className="mt-3 flex flex-col gap-4">
          {groupWorkstreams(groups, workstreams).map((bucket) => (
            <div key={bucket.group?.id ?? 'ungrouped'}>
              <GroupHeader
                group={bucket.group}
                count={bucket.workstreams.length}
              />
              <div className="flex flex-col gap-2.5">
                {bucket.workstreams.map((workstream) => children(workstream))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function deadlineStepOf(workstream: Workstream): Step | null {
  if (!workstream.nearestDeadlineStepId) return null;
  return (
    workstream.steps.find(
      (step) => step.id === workstream.nearestDeadlineStepId,
    ) ?? null
  );
}

/* -------------------------------------------------- A — live-field editing */

/**
 * No edit mode at all. Card chrome is made of live fields, and one step at a
 * time opens a strip anchored under its own dot. Every change is committed
 * immediately.
 */
function LiveFieldList({
  groups,
  workstreams,
  users,
  draft,
  currentUserId,
  advancePlacement,
}: {
  groups: Group[];
  workstreams: Workstream[];
  users: UserSummary[];
  draft: DraftStore;
  currentUserId: string;
  advancePlacement: AdvancePlacement;
}) {
  const [openStep, setOpenStep] = useState<{
    workstreamId: string;
    stepId: string;
  } | null>(null);

  const live = workstreams.filter(
    (workstream) => workstream.lifecycle !== 'complete',
  );
  const completed = workstreams.filter(
    (workstream) => workstream.lifecycle === 'complete',
  );

  const renderCard = (workstream: Workstream, dragHandle?: ReactNode) => (
    <LiveFieldCard
      key={workstream.id}
      workstream={workstream}
      groups={groups}
      users={users}
      draft={draft}
      currentUserId={currentUserId}
      dragHandle={dragHandle}
      advancePlacement={advancePlacement}
      openStepId={
        openStep?.workstreamId === workstream.id ? openStep.stepId : null
      }
      onOpenStep={(stepId) =>
        setOpenStep(stepId ? { workstreamId: workstream.id, stepId } : null)
      }
    />
  );

  return (
    // Wide screens get the width the dropped side panel freed up; the cap only
    // stops the dot columns from stretching absurdly on an ultrawide.
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-5 pb-24">
      <DraggableGroupedList groups={groups} workstreams={live} draft={draft}>
        {(workstream, dragHandle) => renderCard(workstream, dragHandle)}
      </DraggableGroupedList>
      <CompletedSection groups={groups} workstreams={completed}>
        {(workstream) => renderCard(workstream)}
      </CompletedSection>
    </div>
  );
}

/**
 * Chrome follows lifecycle: live work is a framed card with a surface;
 * finished work keeps only a light frame so it stays findable in the
 * Completed section without competing. Selecting anything brings the full
 * frame back, so a complete card can still be opened without losing its
 * boundary.
 */
function cardChromeClass(isLive: boolean, isOpen: boolean): string {
  if (isOpen) return 'border-step-in-progress/60 bg-card shadow-xs';
  return isLive
    ? 'border-border bg-card shadow-xs hover:border-muted-foreground/30'
    : // A light frame keeps a finished card findable without competing with
      // live work — half-strength border, no surface, no shadow.
      'border-border/50 bg-transparent hover:bg-card/60';
}

/** The step whose checklist and notes the card surfaces without being opened. */
function currentStepOf(workstream: Workstream): Step | null {
  return workstream.steps.find((step) => step.status === 'in_progress') ?? null;
}

/**
 * The primary action, pinned as the card's right-most element so it sits in
 * the same spot on every card. It is the only solid button on the card, which
 * is what keeps it unmistakable among all the quiet click targets; the
 * distance-gated drag sensor and its own dropdown keep it safe from misfires.
 */
function AdvanceControl({
  workstream,
  draft,
}: {
  workstream: Workstream;
  draft: DraftStore;
}) {
  if (workstream.lifecycle === 'complete') return null;

  if (workstream.lifecycle === 'not_started') {
    if (workstream.steps.length === 0) return null;
    return (
      <Button
        type="button"
        size="xs"
        variant="outline"
        title="Begin this workstream — step 1 becomes current"
        onClick={() => draft.startWorkstream(workstream.id)}
      >
        Start
      </Button>
    );
  }

  const current = currentStepOf(workstream);
  if (!current) return null;

  // A blocked step never advances in one click: resolving means choosing.
  if (isBlockedNow(current)) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="xs"
              variant="outline"
              title={`${current.name || 'The current step'} is blocked — choose how to resolve it`}
              className="border-step-blocked/40 text-step-blocked hover:text-step-blocked"
            />
          }
        >
          Resolve
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => draft.advanceWorkstream(workstream.id, 'done')}
          >
            Advance — mark {current.name || 'step'} done
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => draft.advanceWorkstream(workstream.id, 'skipped')}
          >
            Advance — skip it
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              draft.patchStep(workstream.id, current.id, { blocked: false })
            }
          >
            Unblock — keep working on it
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <span className="flex items-center">
      <Button
        type="button"
        size="xs"
        title={`Mark ${current.name || 'the current step'} done and move on`}
        className="rounded-r-none"
        onClick={() => draft.advanceWorkstream(workstream.id, 'done')}
      >
        Advance
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size="xs"
              aria-label="More advance options"
              className="rounded-l-none border-l border-l-background/30 px-1"
            />
          }
        >
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => draft.advanceWorkstream(workstream.id, 'skipped')}
          >
            Skip {current.name || 'current step'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function LiveFieldCard({
  workstream,
  groups,
  users,
  draft,
  currentUserId,
  dragHandle,
  advancePlacement,
  openStepId,
  onOpenStep,
}: {
  workstream: Workstream;
  groups: Group[];
  users: UserSummary[];
  draft: DraftStore;
  currentUserId: string;
  dragHandle?: ReactNode;
  advancePlacement: AdvancePlacement;
  openStepId: string | null;
  onOpenStep: (stepId: string | null) => void;
}) {
  const [notesStepId, setNotesStepId] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement>(null);

  const isAnyPanelOpen = openStepId !== null || notesStepId !== null;

  useEffect(() => {
    if (!isAnyPanelOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (cardRef.current?.contains(target)) return;
      // Pickers render in portals outside the card; a click in one of those is
      // still a click "inside" as far as the editor is concerned.
      if (
        target instanceof Element &&
        target.closest('[role="menu"], [role="dialog"], [role="listbox"]')
      ) {
        return;
      }
      onOpenStep(null);
      setNotesStepId(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isAnyPanelOpen, onOpenStep]);

  // eslint-disable-next-line @eslint-react/purity -- intentional clock read
  const now = new Date();
  const currentStep = currentStepOf(workstream);
  // Every card needs its whole thread to place the per-step markers, and the
  // overview aggregate carries no note data — see the API implication in NOTES.
  const notesByStep = useNotesByStep(workstream.id);
  const openIndex = workstream.steps.findIndex(
    (step) => step.id === openStepId,
  );
  const openedStep = workstream.steps[openIndex] ?? null;
  const deadlineStep = deadlineStepOf(workstream);
  const nextStep =
    workstream.steps.find((step) => step.status === 'not_started') ?? null;
  const notesStep =
    workstream.steps.find((step) => step.id === notesStepId) ?? null;

  const createStep = (atIndex: number) =>
    onOpenStep(draft.addStep(workstream.id, atIndex));

  const threadOf = (step: Step) =>
    buildThread(
      draft,
      step.id,
      notesByStep.get(step.id) ?? [],
      now,
      currentUserId,
    );

  const countNotes = (stepId: string) =>
    (notesByStep.get(stepId)?.length ?? 0) +
    (draft.localNotes.get(stepId)?.length ?? 0);

  /** Not complete: still accepts new steps, and still worth looking at. */
  const isLive = workstream.lifecycle !== 'complete';

  return (
    <article
      ref={cardRef}
      className={cn(
        'group/card rounded-lg border p-card transition-colors',
        cardChromeClass(isLive, Boolean(openedStep)),
      )}
    >
      {/* A complete workstream stays recessive even while one of its steps is
          open: the frame and the opened step light up, the rest does not. The
          dimming lives on the parts rather than the card, because a parent
          `opacity` cannot be undone by a child. */}
      <div className={cn('flex items-center gap-2', !isLive && 'opacity-65')}>
        {dragHandle}
        <IconPicker
          value={workstream.icon}
          onChange={(icon) => draft.patchWorkstream(workstream.id, { icon })}
        />
        <ClickToEdit
          value={workstream.name}
          label={`Rename ${workstream.name}`}
          className={cn(
            'text-sm',
            isLive
              ? 'font-semibold text-foreground'
              : 'font-medium text-muted-foreground',
          )}
          onCommit={(name) => draft.patchWorkstream(workstream.id, { name })}
        />
        <GroupPicker
          groups={groups}
          groupId={workstream.groupId}
          label={`Change group of ${workstream.name}`}
          onSelect={(groupId) =>
            draft.patchWorkstream(workstream.id, { groupId })
          }
        />
        <LifecycleBadges workstream={workstream} />
        {advancePlacement === 'after-title' && (
          <AdvanceControl workstream={workstream} draft={draft} />
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {deadlineStep && <WorkstreamDeadline step={deadlineStep} now={now} />}
          <OwnerPicker
            users={users}
            ownerId={workstream.ownerId}
            label={`Change default owner of ${workstream.name}`}
            onSelect={(ownerId) =>
              draft.patchWorkstream(workstream.id, { ownerId })
            }
          />
          {advancePlacement === 'top-right' && (
            <AdvanceControl workstream={workstream} draft={draft} />
          )}
        </div>
      </div>

      <div className="mt-3">
        <EditableDots
          steps={workstream.steps}
          users={users}
          openStepId={openStepId}
          previewStepIds={
            [currentStep?.id, nextStep?.id].filter(Boolean) as string[]
          }
          currentStepId={currentStep?.id ?? null}
          isPipelineComplete={workstream.lifecycle === 'complete'}
          now={now}
          countNotes={countNotes}
          openNotesStepId={notesStepId}
          onOpenNotes={(stepId) =>
            setNotesStepId((current) => (current === stepId ? null : stepId))
          }
          onOpenStep={onOpenStep}
          onToggleChecklistItem={(stepId, itemId) =>
            draft.toggleChecklistItem(workstream.id, stepId, itemId)
          }
          onInsertAt={isLive ? createStep : null}
        />
      </div>

      {openedStep && (
        <>
          <DotCaret
            steps={workstream.steps}
            targetStepId={openedStep.id}
            hasAppendColumn={isLive}
          />
          <StepStrip
            key={openedStep.id}
            workstream={workstream}
            step={openedStep}
            index={openIndex}
            users={users}
            draft={draft}
            entries={threadOf(openedStep)}
            onOpenStep={onOpenStep}
          />
        </>
      )}

      {notesStep && notesStep.id !== openStepId && (
        <>
          <DotCaret
            steps={workstream.steps}
            targetStepId={notesStep.id}
            hasAppendColumn={isLive}
          />
          <StepNotesPanel
            key={notesStep.id}
            step={notesStep}
            entries={threadOf(notesStep)}
            isAppendOnly={!isEditableStep(notesStep)}
            onAdd={(body) => draft.addNote(notesStep.id, body)}
            onEdit={draft.editNote}
            onDelete={draft.deleteNote}
            onClose={() => setNotesStepId(null)}
          />
        </>
      )}

      {/* `empty:hidden` keeps a card without an action (complete, or an
          empty pipeline) from reserving a blank footer row. */}
      {advancePlacement === 'bottom-right' && (
        <div className="mt-2 flex justify-end empty:hidden">
          <AdvanceControl workstream={workstream} draft={draft} />
        </div>
      )}
    </article>
  );
}

/**
 * Points a strip at the dot it belongs to. The trailing spacer has to mirror
 * the add-step button exactly — a complete pipeline has none, and reserving it
 * anyway shifts every column and leaves the caret off its dot.
 */
function DotCaret({
  steps,
  targetStepId,
  hasAppendColumn,
}: {
  steps: Step[];
  targetStepId: string;
  hasAppendColumn: boolean;
}) {
  return (
    <div aria-hidden className="flex items-start">
      {steps.map((step) => (
        <div key={step.id} className="flex flex-1 justify-center">
          {step.id === targetStepId && (
            <span className="mt-1 size-2.5 rotate-45 border-l border-t border-step-in-progress/40 bg-step-in-progress/8" />
          )}
        </div>
      ))}
      {hasAppendColumn && <div className="w-8" />}
    </div>
  );
}

/* ------------------------------------------------------------------- notes */

interface ThreadEntry {
  id: string;
  body: string;
  author: string;
  when: string;
  /** Authors may revise their own entries — but never on a frozen step. */
  isOwn: boolean;
}

function relativeTime(iso: string, now: Date): string {
  const minutes = Math.round(
    (now.getTime() - new Date(iso).getTime()) / 60_000,
  );
  if (minutes < 60) return `${Math.max(minutes, 0)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** API notes then this session's local ones, with local edits applied. */
function buildThread(
  draft: DraftStore,
  stepId: string,
  notes: NoteEntry[],
  now: Date,
  currentUserId: string,
): ThreadEntry[] {
  const entries: ThreadEntry[] = [];

  for (const note of notes) {
    if (draft.deletedNoteIds.has(note.id)) continue;
    entries.push({
      id: note.id,
      body: draft.noteEdits.get(note.id) ?? note.content,
      author: note.author?.name ?? 'Unknown',
      when: relativeTime(note.createdAt, now),
      isOwn: note.author?.id === currentUserId,
    });
  }

  const added = draft.localNotes.get(stepId) ?? [];
  for (const note of added) {
    if (draft.deletedNoteIds.has(note.id)) continue;
    entries.push({
      id: note.id,
      body: draft.noteEdits.get(note.id) ?? note.body,
      author: 'You',
      when: 'just now',
      isOwn: true,
    });
  }

  return entries;
}

function NoteThread({
  entries,
  composerLabel,
  isAppendOnly,
  onAdd,
  onEdit,
  onDelete,
  onEscape,
}: {
  entries: ThreadEntry[];
  composerLabel: string;
  /** A past Step still accepts new notes, but its thread is frozen. */
  isAppendOnly: boolean;
  onAdd: (body: string) => void;
  onEdit: (noteId: string, body: string) => void;
  onDelete: (noteId: string) => void;
  onEscape?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mt-1.5 space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="group/note rounded bg-muted/35 px-2 py-1 text-[11px] leading-snug"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{entry.author}</span>
            <span className="text-muted-foreground/70">{entry.when}</span>
            {entry.isOwn && !isAppendOnly && editingId !== entry.id && (
              <span className="ml-auto flex items-center gap-1 opacity-0 group-focus-within/note:opacity-100 group-hover/note:opacity-100">
                <button
                  type="button"
                  aria-label="Edit note"
                  onClick={() => setEditingId(entry.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <PencilIcon className="size-3" />
                </button>
                <button
                  type="button"
                  aria-label="Delete note"
                  onClick={() => onDelete(entry.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2Icon className="size-3" />
                </button>
              </span>
            )}
          </div>

          {editingId === entry.id ? (
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
              autoFocus
              aria-label="Edit note"
              defaultValue={entry.body}
              className="mt-1 h-6 w-full rounded border bg-background px-1.5 text-[11px]"
              onBlur={() => setEditingId(null)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setEditingId(null);
                  return;
                }
                if (event.key !== 'Enter') return;
                const body = event.currentTarget.value.trim();
                if (body) onEdit(entry.id, body);
                setEditingId(null);
              }}
            />
          ) : (
            <p className="mt-0.5">{entry.body}</p>
          )}
        </div>
      ))}
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
        autoFocus
        aria-label={composerLabel}
        placeholder="Write a note, Enter to post"
        className="h-7 w-full rounded-md border bg-background px-2 text-[11px]"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onEscape?.();
          if (event.key !== 'Enter') return;
          const body = event.currentTarget.value.trim();
          if (!body) return;
          onAdd(body);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}

/**
 * The thread for whichever step's marker was clicked, anchored under that dot.
 * Notes are a property of the pipeline rather than a card footer, so past
 * steps' threads stay reachable.
 */
function StepNotesPanel({
  step,
  entries,
  isAppendOnly,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: {
  step: Step;
  entries: ThreadEntry[];
  isAppendOnly: boolean;
  onAdd: (body: string) => void;
  onEdit: (noteId: string, body: string) => void;
  onDelete: (noteId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px]">
        <MessageSquareIcon className="size-3 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-medium">
          {step.name || 'Untitled'}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {entries.length} {entries.length === 1 ? 'note' : 'notes'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Close notes"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <NoteThread
        entries={entries}
        composerLabel={`Add a note to ${step.name}`}
        isAppendOnly={isAppendOnly}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
        onEscape={onClose}
      />
    </div>
  );
}

function GroupPicker({
  groups,
  groupId,
  label,
  onSelect,
}: {
  groups: Group[];
  groupId: string | null | undefined;
  label: string;
  onSelect: (groupId: string | null) => void;
}) {
  const group = groups.find((candidate) => candidate.id === groupId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        }
      >
        <span
          aria-hidden
          className="size-1.5 rounded-[2px] border"
          style={{ backgroundColor: group?.color ?? 'transparent' }}
        />
        {group?.name ?? 'No group'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onSelect(null)}>
          No group
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

const ICONS = ['🏰', '🍽️', '💐', '📸', '🎵', '💍', '👗', '🚗', '🎂', '✉️'];

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Change icon"
            title="Change icon"
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

function EditableDots({
  steps,
  users,
  openStepId,
  previewStepIds,
  currentStepId,
  isPipelineComplete,
  now,
  countNotes,
  openNotesStepId,
  onOpenNotes,
  onOpenStep,
  onToggleChecklistItem,
  onInsertAt,
}: {
  steps: Step[];
  users: UserSummary[];
  openStepId: string | null;
  previewStepIds: string[];
  currentStepId: string | null;
  /** A complete card is already dimmed as a whole, so its steps are not. */
  isPipelineComplete: boolean;
  now: Date;
  countNotes: (stepId: string) => number;
  openNotesStepId: string | null;
  onOpenNotes: (stepId: string) => void;
  onOpenStep: (stepId: string | null) => void;
  onToggleChecklistItem: (stepId: string, itemId: string) => void;
  onInsertAt: ((index: number) => void) | null;
}) {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
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
    onInsertAt !== null && index > currentIndex;

  return (
    <ol className="group/dots flex items-start">
      {steps.map((step, index) => {
        const isOpen = step.id === openStepId;
        const isCurrent = step.id === currentStepId;
        const hasPreview = previewStepIds.includes(step.id) && !isOpen;
        const urgency = step.deadline ? stepUrgency(step.deadline, now) : null;
        // A settled step's deadline is history — only work still ahead of the
        // pointer can be late, and only in a pipeline that is still running.
        const isPending =
          !isPipelineComplete &&
          (step.status === 'in_progress' || step.status === 'not_started');
        const ringClass = urgency && isPending ? URGENCY_RING[urgency] : null;
        const noteCount = countNotes(step.id);
        // Settled work recedes so a card reads as "here and ahead" rather than
        // a wall of green. Every step of a complete pipeline is settled, which
        // is what keeps such a card quiet even when one step is open.
        const isSettled = step.status === 'done' || step.status === 'skipped';

        return (
          <Fragment key={step.id}>
            {canInsertAt(index) && (
              <InsertStepPoint
                label={`Insert a step before ${step.name || 'this step'}`}
                onClick={() => onInsertAt?.(index)}
              />
            )}
            <li className="flex min-w-0 flex-1 flex-col items-center">
              <button
                type="button"
                aria-pressed={isOpen}
                onClick={() => onOpenStep(isOpen ? null : step.id)}
                className={cn(
                  'group/dot flex w-full min-w-0 flex-col items-center gap-1.5 rounded transition-opacity',
                  isSettled && !isOpen && 'opacity-55 hover:opacity-100',
                )}
              >
                <span className="relative flex h-5 w-full items-center justify-center">
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
                  <StatusDot
                    step={step}
                    title={
                      ringClass && step.deadline
                        ? `${step.status} · due ${step.deadline}`
                        : undefined
                    }
                    className={cn(
                      'relative transition-transform group-hover/dot:scale-115',
                      isOpen && 'scale-115 ring-2 ring-step-in-progress/40',
                      (step.status === 'in_progress' || isBlockedNow(step)) &&
                        'size-5',
                      ringClass &&
                        'ring-offset-2 ring-offset-card [--tw-ring-color:currentColor]',
                      ringClass,
                    )}
                  />
                </span>
                {/* Step names are the pipeline's labels — they read at body
                    size, not caption size, so the row scans without leaning
                    in. Colour still separates current from the rest. */}
                <span
                  className={cn(
                    'w-full truncate px-1 text-center text-[13px] leading-tight',
                    isOpen || isCurrent
                      ? 'font-semibold text-foreground'
                      : 'font-medium text-foreground/75 group-hover/dot:text-foreground',
                    !step.name && 'font-normal italic text-muted-foreground',
                  )}
                >
                  {step.name || 'Untitled'}
                </span>
                {/* An avatar under a dot only ever means an owner override —
                    inherited owners stay invisible here. */}
                {step.explicitOwnerId && (
                  <OwnerAvatar
                    owner={
                      users.find((user) => user.id === step.explicitOwnerId) ??
                      null
                    }
                    className="size-4 text-[8px] ring-1 ring-border"
                  />
                )}
                {/* The date is shaded by the same five-band scale as the ring. */}
                {step.deadline && urgency && (
                  <span
                    className={cn(
                      'text-[9px] leading-none tabular-nums',
                      isPending
                        ? URGENCY_TEXT[urgency]
                        : 'text-muted-foreground/60',
                    )}
                  >
                    {formatShortDate(step.deadline, now)}
                  </span>
                )}
              </button>

              {noteCount > 0 && (
                <button
                  type="button"
                  aria-pressed={step.id === openNotesStepId}
                  aria-label={`Notes on ${step.name || 'step'}`}
                  title={`Notes on ${step.name || 'step'}`}
                  onClick={() => onOpenNotes(step.id)}
                  className={cn(
                    'mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] leading-none',
                    step.id === openNotesStepId
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <MessageSquareIcon className="size-2.5" />
                  {noteCount}
                </button>
              )}

              {hasPreview && (
                <ChecklistPreview
                  step={step}
                  isInteractive={isCurrent}
                  onToggle={(itemId) => onToggleChecklistItem(step.id, itemId)}
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
            aria-label="Add a step at the end"
            title="Add a step at the end"
            onClick={() => onInsertAt?.(steps.length)}
            className="flex w-8 flex-col items-center text-muted-foreground hover:text-foreground"
          >
            <span className="flex h-5 items-center">
              <PlusIcon className="size-3.5" />
            </span>
          </button>
        </li>
      )}
    </ol>
  );
}

/**
 * A `+` sitting on the line between two dots, revealed on hover. The list item
 * is zero-width and the button is absolutely positioned, so adding these does
 * not shift the step columns — `DotCaret` mirrors those widths.
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
        className="absolute left-1/2 top-0 flex size-5 -translate-x-1/2 items-center justify-center rounded-full border bg-card text-muted-foreground opacity-0 shadow-xs transition-opacity hover:border-foreground/30 hover:text-foreground focus-visible:opacity-100 group-hover/dots:opacity-100"
      >
        <PlusIcon className="size-3" />
      </button>
    </li>
  );
}

/**
 * Ghosted checklist under a step dot: readable at a glance on the current and
 * next steps, tickable in place on the current one.
 */
function ChecklistPreview({
  step,
  isInteractive,
  onToggle,
}: {
  step: Step;
  isInteractive: boolean;
  onToggle: (itemId: string) => void;
}) {
  if (step.checklistItems.length === 0) return null;

  // Only three items fit, so they should be the ones still needing doing —
  // a stable sort keeps the authored order within each half.
  const byRemaining = [...step.checklistItems].sort(
    (a, b) => Number(a.done) - Number(b.done),
  );
  const shown = byRemaining.slice(0, 3);
  const hidden = step.checklistItems.length - shown.length;

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
            aria-label={`Toggle ${item.name}`}
            aria-pressed={item.done}
            onClick={() => onToggle(item.id)}
            className="flex w-full items-center gap-1 rounded px-0.5 text-left hover:bg-muted/60"
          >
            <span
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
          +{hidden} more
        </li>
      )}
    </ul>
  );
}

function StepStrip({
  workstream,
  step,
  index,
  users,
  draft,
  entries,
  onOpenStep,
}: {
  workstream: Workstream;
  step: Step;
  index: number;
  users: UserSummary[];
  draft: DraftStore;
  entries: ThreadEntry[];
  onOpenStep: (stepId: string | null) => void;
}) {
  // eslint-disable-next-line @eslint-react/purity -- intentional clock read
  const now = new Date();
  const previous = workstream.steps[index - 1];
  const next = workstream.steps[index + 1];
  const isEditable = isEditableStep(step);
  const canMoveEarlier =
    isStructurallyFree(step) &&
    Boolean(previous && isStructurallyFree(previous));
  const canMoveLater =
    isStructurallyFree(step) && Boolean(next && isStructurallyFree(next));

  return (
    <div className="rounded-lg border border-step-in-progress/40 bg-step-in-progress/5 p-2.5">
      <div className="flex items-center gap-2">
        <StatusDot step={step} />
        {isEditable ? (
          <ClickToEdit
            value={step.name}
            label="Step name"
            placeholder="Name this step"
            className="min-w-0 flex-1 text-xs font-medium"
            startEditing={step.name === ''}
            onCommit={(name) =>
              draft.patchStep(workstream.id, step.id, { name })
            }
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {step.name || 'Untitled'}
          </span>
        )}
        {step.status === 'in_progress' && (
          <span className="rounded bg-step-in-progress/12 px-1 py-0.5 text-[9px] font-semibold uppercase text-step-in-progress">
            Current
          </span>
        )}
        {!isEditable && (
          <span className="text-[9px] font-semibold uppercase text-muted-foreground">
            {step.status === 'skipped' ? 'Skipped' : 'Done'}
          </span>
        )}
        {isEditable ? (
          <DeadlineField
            value={step.deadline}
            label="Step deadline"
            now={now}
            onChange={(deadline) =>
              draft.patchStep(workstream.id, step.id, { deadline })
            }
          />
        ) : (
          step.deadline && (
            <span className="shrink-0 px-1.5 text-[11px] tabular-nums text-muted-foreground">
              Due {formatShortDate(step.deadline, now)}
            </span>
          )
        )}
        {isEditable ? (
          <OwnerPicker
            users={users}
            ownerId={step.explicitOwnerId ?? step.effectiveOwnerId}
            label="Step owner"
            inheritLabel="Inherit from workstream"
            onSelect={(explicitOwnerId) =>
              draft.patchStep(workstream.id, step.id, { explicitOwnerId })
            }
          />
        ) : (
          <OwnerAvatar
            owner={
              users.find(
                (user) =>
                  user.id === (step.explicitOwnerId ?? step.effectiveOwnerId),
              ) ?? null
            }
          />
        )}
        {step.status === 'in_progress' && (
          <button
            type="button"
            aria-pressed={step.blocked}
            onClick={() =>
              draft.patchStep(workstream.id, step.id, {
                blocked: !step.blocked,
              })
            }
            className={cn(
              'h-6 rounded-md px-1.5 text-[11px]',
              step.blocked
                ? 'bg-step-blocked/12 text-step-blocked'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {step.blocked ? 'Blocked' : 'Mark blocked'}
          </button>
        )}
      </div>

      <ChecklistBlock
        step={step}
        isFrozen={!isEditable}
        onToggle={(itemId) =>
          draft.toggleChecklistItem(workstream.id, step.id, itemId)
        }
        onAdd={(name) => draft.addChecklistItem(workstream.id, step.id, name)}
        onRemove={(itemId) =>
          draft.removeChecklistItem(workstream.id, step.id, itemId)
        }
      />

      {/* A frozen step still takes new notes — that is the one thing the
          pipeline rules keep open on a past step. */}
      <NotesBlock
        step={step}
        entries={entries}
        isAppendOnly={!isEditable}
        startOpen
        onAdd={(body) => draft.addNote(step.id, body)}
        onEdit={draft.editNote}
        onDelete={draft.deleteNote}
      />

      <div className="mt-2 flex items-center gap-1 border-t pt-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Edit previous step"
          disabled={!previous}
          onClick={() => previous && onOpenStep(previous.id)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Edit next step"
          disabled={!next}
          onClick={() => next && onOpenStep(next.id)}
        >
          <ChevronRightIcon />
        </Button>
        {/* Only the future tail reorders, so the buttons vanish on a current
            or past step rather than sitting there disabled. */}
        {(canMoveEarlier || canMoveLater) && (
          <>
            <span aria-hidden className="mx-1 h-4 w-px bg-border" />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${step.name || 'step'} earlier`}
              disabled={!canMoveEarlier}
              onClick={() => draft.moveStep(workstream.id, step.id, -1)}
            >
              <ArrowLeftIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${step.name || 'step'} later`}
              disabled={!canMoveLater}
              onClick={() => draft.moveStep(workstream.id, step.id, 1)}
            >
              <ArrowRightIcon />
            </Button>
          </>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {isEditable ? 'Saved as you type' : 'Frozen — notes only'}
        </span>
        {isStructurallyFree(step) && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${step.name || 'step'}`}
            onClick={() => {
              draft.removeStep(workstream.id, step.id);
              onOpenStep(null);
            }}
          >
            <Trash2Icon />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Close step editor"
          onClick={() => onOpenStep(null)}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- shell */

function PrototypeStateStrip({ edits }: { edits: number }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-40 hidden rounded-full border bg-background/95 px-3 py-1.5 text-[10px] text-muted-foreground shadow-md backdrop-blur md:block">
      Live fields · marked dots + quiet dates · per-step notes · local edits{' '}
      <strong className="text-foreground tabular-nums">{edits}</strong> (never
      sent to the API)
    </div>
  );
}

const ADVANCE_PLACEMENTS: AdvancePlacement[] = [
  'top-right',
  'after-title',
  'bottom-right',
];

/** B3 comparison switcher — where does the primary action live on the card? */
function AdvancePlacementSwitcher({
  value,
  onChange,
}: {
  value: AdvancePlacement;
  onChange: (next: AdvancePlacement) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-40 hidden items-center gap-1 rounded-full border bg-background/95 px-2 py-1 text-[10px] shadow-md backdrop-blur md:flex">
      <span className="px-1 text-muted-foreground">Advance:</span>
      {ADVANCE_PLACEMENTS.map((placement) => (
        <button
          key={placement}
          type="button"
          aria-pressed={placement === value}
          onClick={() => onChange(placement)}
          className={cn(
            'rounded-full px-2 py-0.5',
            placement === value
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {placement}
        </button>
      ))}
    </div>
  );
}

export const OverviewEditingPrototype = ({
  groups,
  workstreams,
  users,
}: OverviewEditingPrototypeProperties) => {
  const draft = useDraft(workstreams, groups);
  const authState = useAuthState();
  const currentUserId =
    authState.status === 'authenticated' ? authState.user.id : '';
  const [advancePlacement, setAdvancePlacement] =
    useState<AdvancePlacement>('after-title');

  return (
    <>
      <LiveFieldList
        groups={draft.orderedGroups}
        workstreams={draft.workstreams}
        users={users}
        draft={draft}
        currentUserId={currentUserId}
        advancePlacement={advancePlacement}
      />
      <PrototypeStateStrip edits={draft.edits} />
      <AdvancePlacementSwitcher
        value={advancePlacement}
        onChange={setAdvancePlacement}
      />
    </>
  );
};

/**
 * PROTOTYPE — throwaway. Widget rail + right split panel on the overview.
 *
 * Verdict applied (2026-07-31): the panel stacks THREE collapsible sections —
 * project stats, the month grid, and the agenda list — all visible by
 * default, each collapsing behind its header. The earlier `?panel=` variant
 * comparison (agenda vs grid vs hybrid) is resolved: both calendar forms
 * stay, stacked. Clicking a marked day in the grid scrolls the agenda to
 * that month.
 *
 * Widgets are deliberately decoupled: they take derived data + injected
 * callbacks (`onEntryClick`, `onEntryHover`) and never import overview
 * navigation — a future ProjectsOverview must be able to reuse them.
 *
 * Everything is read-only. Delete with the rest of the prototype.
 */
import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilterIcon,
  PanelRightIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { daysUntil } from '@/features/overview/days-until';
import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { collectDeadlineEntries } from '@/features/overview/widget-panel-prototype-shared';
import { cn } from '@/lib/utils';

import type { Workstream } from '@/api/hooks/use-overview';
import type { DeadlineEntry } from '@/features/overview/widget-panel-prototype-shared';
import type { ReactNode } from 'react';

/* ---------------------------------------------------- urgency (five bands) */

type StepUrgency = 'passed' | 'week' | 'fortnight' | 'month' | 'far';

function stepUrgency(deadline: string, now: Date): StepUrgency {
  const days = daysUntil(deadline, now);
  if (days < 0) return 'passed';
  if (days < 7) return 'week';
  if (days < 14) return 'fortnight';
  if (days < 30) return 'month';
  return 'far';
}

const URGENCY_TEXT: Record<StepUrgency, string> = {
  passed: 'font-semibold text-urgency-late',
  week: 'font-medium text-urgency-late',
  fortnight: 'text-orange-500 dark:text-orange-400',
  month: 'text-yellow-600 dark:text-yellow-400',
  far: 'text-muted-foreground/70',
};

const URGENCY_DOT: Record<StepUrgency, string> = {
  passed: 'bg-urgency-late',
  week: 'bg-urgency-late',
  fortnight: 'bg-orange-500 dark:bg-orange-400',
  month: 'bg-yellow-500 dark:bg-yellow-400',
  far: 'bg-muted-foreground/50',
};

/* ------------------------------------------------------------ date helpers */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** `2026-08` — month bucket key of an ISO date. */
function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function monthLabel(monthKey: string, now: Date): string {
  const [year, month] = monthKey.split('-').map(Number);
  const name = MONTHS[(month ?? 1) - 1] ?? '';
  return year === now.getFullYear() ? name : `${name} ${year}`;
}

function isoOf(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function countdownLabel(isoDate: string, now: Date): string {
  const days = daysUntil(isoDate, now);
  if (days < 0) return `${-days}d late`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days}d`;
  return '';
}

/* --------------------------------------------------------- injected wiring */

/** Navigation is injected, never imported — see the reuse note up top. */
interface CrossLink {
  onEntryClick?: (entry: DeadlineEntry) => void;
  onEntryHover?: (workstreamId: string | null) => void;
}

/* ------------------------------------------------------------ entry row UI */

function DeadlineRow({
  entry,
  now,
  crossLink,
}: {
  entry: DeadlineEntry;
  now: Date;
  crossLink: CrossLink;
}) {
  const urgency = stepUrgency(entry.deadline, now);
  const day = Number(entry.deadline.slice(8, 10));
  const countdown = countdownLabel(entry.deadline, now);

  return (
    <button
      type="button"
      title={`${entry.stepName} due ${entry.deadline} — click to open in the overview`}
      onClick={() => crossLink.onEntryClick?.(entry)}
      onMouseEnter={() => crossLink.onEntryHover?.(entry.workstreamId)}
      onMouseLeave={() => crossLink.onEntryHover?.(null)}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
    >
      <span
        className={cn(
          'w-7 shrink-0 text-center text-sm tabular-nums',
          URGENCY_TEXT[urgency],
        )}
      >
        {day}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">
            {entry.stepName || 'Untitled'}
          </span>
          {entry.blocked && (
            <AlertTriangleIcon className="size-3 shrink-0 text-urgency-late" />
          )}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span aria-hidden>{entry.workstreamIcon}</span>
          <span className="truncate">{entry.workstreamName}</span>
        </span>
      </span>
      {countdown && (
        <span
          className={cn(
            'shrink-0 text-[11px] tabular-nums',
            URGENCY_TEXT[urgency],
          )}
        >
          {countdown}
        </span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------ stats widget */

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-2.5 py-1.5">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function StatsWidget({
  workstreams,
  now,
  crossLink,
}: {
  workstreams: Workstream[];
  now: Date;
  crossLink: CrossLink;
}) {
  const entries = useMemo(
    () => collectDeadlineEntries(workstreams),
    [workstreams],
  );

  const active = workstreams.filter((w) => w.lifecycle === 'active').length;
  const notStarted = workstreams.filter(
    (w) => w.lifecycle === 'not_started',
  ).length;
  const completed = workstreams.filter(
    (w) => w.lifecycle === 'complete',
  ).length;
  const blocked = workstreams.filter((w) =>
    w.steps.some((step) => isBlockedNow(step)),
  ).length;

  const allSteps = workstreams.flatMap((w) => w.steps);
  const settled = allSteps.filter(
    (s) => s.status === 'done' || s.status === 'skipped',
  ).length;
  const progress =
    allSteps.length === 0 ? 0 : Math.round((settled / allSteps.length) * 100);

  const overdue = entries.filter((e) => daysUntil(e.deadline, now) < 0);
  const next = entries.find((e) => daysUntil(e.deadline, now) >= 0);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-step-done transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {progress}% of all steps settled
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <StatTile label="Total" value={workstreams.length} />
        <StatTile label="Active" value={active} />
        <StatTile label="Queued" value={notStarted} />
        <StatTile label="Done" value={completed} />
      </div>

      <div className="flex gap-1.5">
        <div
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px]',
            blocked > 0
              ? 'border-urgency-late/40 text-urgency-late'
              : 'text-muted-foreground',
          )}
        >
          <AlertTriangleIcon className="size-3.5 shrink-0" />
          <span className="font-semibold tabular-nums">{blocked}</span> blocked
        </div>
        <div
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px]',
            overdue.length > 0
              ? 'border-urgency-late/40 text-urgency-late'
              : 'text-muted-foreground',
          )}
        >
          <CalendarDaysIcon className="size-3.5 shrink-0" />
          <span className="font-semibold tabular-nums">
            {overdue.length}
          </span>{' '}
          overdue
        </div>
      </div>

      {next && (
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Next deadline
          </div>
          <div className="rounded-md border">
            <DeadlineRow entry={next} now={now} crossLink={crossLink} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- agenda list */

function AgendaCalendar({
  entries,
  now,
  crossLink,
  monthAnchorPrefix,
}: {
  entries: DeadlineEntry[];
  now: Date;
  crossLink: CrossLink;
  /** Each month section gets an addressable DOM id (grid clicks target it). */
  monthAnchorPrefix: string;
}) {
  const overdue = entries.filter((e) => daysUntil(e.deadline, now) < 0);
  const upcoming = entries.filter((e) => daysUntil(e.deadline, now) >= 0);

  // Entries arrive date-sorted, so month buckets are contiguous runs.
  const monthBuckets: { key: string; monthEntries: DeadlineEntry[] }[] = [];
  for (const entry of upcoming) {
    const key = monthKeyOf(entry.deadline);
    const last = monthBuckets.at(-1);
    if (last?.key === key) {
      last.monthEntries.push(entry);
    } else {
      monthBuckets.push({ key, monthEntries: [entry] });
    }
  }

  if (entries.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-muted-foreground">
        No pending deadlines.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {overdue.length > 0 && (
        <div>
          <h4 className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-urgency-late">
            Overdue
          </h4>
          <div className="flex flex-col">
            {overdue.map((entry) => (
              <DeadlineRow
                key={entry.stepId}
                entry={entry}
                now={now}
                crossLink={crossLink}
              />
            ))}
          </div>
        </div>
      )}

      {monthBuckets.map(({ key: monthKey, monthEntries }) => (
        <div key={monthKey} id={`${monthAnchorPrefix}-${monthKey}`}>
          <h4 className="mb-1 flex items-baseline justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {monthLabel(monthKey, now)}
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {monthEntries.length}
            </span>
          </h4>
          <div className="flex flex-col">
            {monthEntries.map((entry) => (
              <DeadlineRow
                key={entry.stepId}
                entry={entry}
                now={now}
                crossLink={crossLink}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- month grid */

interface GridDay {
  day: number;
  iso: string;
  inMonth: boolean;
}

function buildGridDays(year: number, monthIndex: number): GridDay[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // Monday-first offset of the 1st.
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const rows = Math.ceil((offset + daysInMonth) / 7);

  const cells: GridDay[] = [];
  for (let index = 0; index < rows * 7; index++) {
    const dayOffset = index - offset;
    const date = new Date(year, monthIndex, 1 + dayOffset);
    cells.push({
      day: date.getDate(),
      iso: isoOf(date.getFullYear(), date.getMonth(), date.getDate()),
      inMonth: date.getMonth() === monthIndex,
    });
  }
  return cells;
}

function MonthGrid({
  entriesByDate,
  now,
  onSelectDay,
}: {
  entriesByDate: ReadonlyMap<string, DeadlineEntry[]>;
  now: Date;
  onSelectDay: (iso: string, hasEntries: boolean) => void;
}) {
  const [view, setView] = useState(() => ({
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  }));

  const todayIso = isoOf(now.getFullYear(), now.getMonth(), now.getDate());
  const cells = buildGridDays(view.year, view.monthIndex);
  const monthDeadlines = cells.filter(
    (c) => c.inMonth && entriesByDate.has(c.iso),
  ).length;

  const shift = (delta: number) => {
    setView((previous) => {
      const date = new Date(previous.year, previous.monthIndex + delta, 1);
      return { year: date.getFullYear(), monthIndex: date.getMonth() };
    });
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shift(-1)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeftIcon className="size-3.5" />
        </button>
        <div className="text-xs font-semibold">
          {MONTHS[view.monthIndex]} {view.year}
        </div>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => shift(1)}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRightIcon className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="pb-1 text-[10px] font-medium text-muted-foreground/70"
          >
            {weekday}
          </div>
        ))}
        {cells.map((cell) => {
          const dayEntries = entriesByDate.get(cell.iso) ?? [];
          const hasEntries = dayEntries.length > 0;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDay(cell.iso, hasEntries)}
              title={
                hasEntries
                  ? dayEntries
                      .map((e) => `${e.workstreamIcon} ${e.stepName}`)
                      .join('\n')
                  : undefined
              }
              className={cn(
                'relative mx-auto flex h-9 w-9 flex-col items-center rounded-md pt-1',
                cell.inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                hasEntries && 'hover:bg-accent',
              )}
            >
              <span
                className={cn(
                  'text-[11px] tabular-nums',
                  cell.iso === todayIso &&
                    'flex size-5 items-center justify-center rounded-full bg-step-in-progress font-semibold text-white',
                  hasEntries && cell.iso !== todayIso && 'font-semibold',
                )}
              >
                {cell.day}
              </span>
              {hasEntries && (
                <span className="mt-0.5 flex gap-0.5">
                  {dayEntries.slice(0, 3).map((entry) => (
                    <span
                      key={entry.stepId}
                      className={cn(
                        'size-1.5 rounded-full',
                        URGENCY_DOT[stepUrgency(entry.deadline, now)],
                      )}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-1 px-1 text-right text-[10px] text-muted-foreground/70">
        {monthDeadlines} marked {monthDeadlines === 1 ? 'day' : 'days'} this
        month
      </div>
    </div>
  );
}

/* ---------------------------------------------------- collapsible sections */

function CollapsibleSection({
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  summary?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-accent/60"
      >
        <ChevronDownIcon
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            !isOpen && '-rotate-90',
          )}
        />
        <h3 className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {summary && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {summary}
          </span>
        )}
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </section>
  );
}

/* --------------------------------------------------------- panel + rail UI */

const AGENDA_ANCHOR_PREFIX = 'panel-agenda';

type SectionKey = 'stats' | 'calendar' | 'agenda';

/**
 * The whole right-hand widget system: a slim rail on the outer edge toggling
 * the split panel, which stacks three individually collapsible sections —
 * stats, month grid, agenda. The panel mirrors whatever filters the overview
 * applies — the `filterNote` names them so the mirroring is visible.
 */
export function WidgetSidebarPrototype({
  workstreams,
  filterNote,
  crossLink,
}: {
  /** Already filtered by the host page — the panel mirrors the overview. */
  workstreams: Workstream[];
  /** Human-readable description of active filters, when any. */
  filterNote: string | null;
  crossLink: CrossLink;
}) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<ReadonlySet<SectionKey>>(
    () => new Set(),
  );

  // eslint-disable-next-line @eslint-react/purity -- intentional clock read
  const now = new Date();

  const entries = useMemo(
    () => collectDeadlineEntries(workstreams),
    [workstreams],
  );
  const entriesByDate = useMemo(() => {
    const map = new Map<string, DeadlineEntry[]>();
    for (const entry of entries) {
      map.set(entry.deadline, [...(map.get(entry.deadline) ?? []), entry]);
    }
    return map;
  }, [entries]);

  const allSteps = workstreams.flatMap((w) => w.steps);
  const settled = allSteps.filter(
    (s) => s.status === 'done' || s.status === 'skipped',
  ).length;

  const toggleSection = (key: SectionKey) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // A grid click lands on the agenda's month — expanding the agenda first if
  // it is collapsed, then scrolling once it has rendered.
  const jumpToMonth = (iso: string, hasEntries: boolean) => {
    if (!hasEntries) return;
    setCollapsed((previous) => {
      const next = new Set(previous);
      next.delete('agenda');
      return next;
    });
    requestAnimationFrame(() => {
      document
        .querySelector(`#${AGENDA_ANCHOR_PREFIX}-${monthKeyOf(iso)}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="flex h-full min-h-0 shrink-0">
      {isPanelOpen && (
        <aside className="flex w-90 min-h-0 flex-col gap-4 overflow-y-auto border-l bg-background/50 px-3 py-3">
          {filterNote && (
            <div className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
              <FilterIcon className="size-3 shrink-0" />
              <span className="truncate">Mirroring filters: {filterNote}</span>
            </div>
          )}

          <CollapsibleSection
            title="Project pulse"
            summary={`${settled}/${allSteps.length} steps`}
            isOpen={!collapsed.has('stats')}
            onToggle={() => toggleSection('stats')}
          >
            <StatsWidget
              workstreams={workstreams}
              now={now}
              crossLink={crossLink}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Calendar"
            isOpen={!collapsed.has('calendar')}
            onToggle={() => toggleSection('calendar')}
          >
            <MonthGrid
              entriesByDate={entriesByDate}
              now={now}
              onSelectDay={jumpToMonth}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Agenda"
            summary={`${entries.length} pending`}
            isOpen={!collapsed.has('agenda')}
            onToggle={() => toggleSection('agenda')}
          >
            <AgendaCalendar
              entries={entries}
              now={now}
              crossLink={crossLink}
              monthAnchorPrefix={AGENDA_ANCHOR_PREFIX}
            />
          </CollapsibleSection>
        </aside>
      )}

      <nav
        aria-label="Overview widgets"
        className="flex w-11 shrink-0 flex-col items-center gap-1 border-l bg-background pt-3"
      >
        <button
          type="button"
          title={
            isPanelOpen ? 'Hide the widget panel' : 'Show the widget panel'
          }
          aria-pressed={isPanelOpen}
          onClick={() => setIsPanelOpen((previous) => !previous)}
          className={cn(
            'rounded-md p-2 transition-colors',
            isPanelOpen
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <PanelRightIcon className="size-4" />
        </button>
      </nav>
    </div>
  );
}

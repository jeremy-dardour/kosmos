import { FilterIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { CollapsibleSection } from '@/features/overview/widgets/collapsible-section';
import { collectDeadlineEntries } from '@/features/overview/widgets/collect-deadline-entries';
import { derivePulseStats } from '@/features/overview/widgets/project-pulse-stats';
import { StatsWidget } from '@/features/overview/widgets/stats-widget';
import { WidgetRail } from '@/features/overview/widgets/widget-rail';
import { useLocalStorageState } from '@/lib/use-local-storage-state';

import type { Workstream } from '@/api/hooks/use-overview';
import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

interface WidgetSidebarProperties {
  /** Already filtered by the host page — the panel mirrors the overview. */
  workstreams: Workstream[];
  /** Human-readable description of the active filters, when any. */
  filterNote: string | null;
  now: Date;
  onEntryClick?: (entry: DeadlineEntry) => void;
  onEntryHover?: (workstreamId: string | null) => void;
  storageKey?: string;
}

/** `collapsedSections` is a negative list: an absent key is an open section. */
interface PanelState {
  open: boolean;
  collapsedSections: string[];
}

const DEFAULT_STATE: PanelState = { open: true, collapsedSections: [] };
const DEFAULT_STORAGE_KEY = 'overview.widget-panel';
const PULSE_SECTION = 'stats';

function isPanelState(value: unknown): value is PanelState {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<PanelState>;
  return (
    typeof candidate.open === 'boolean' &&
    Array.isArray(candidate.collapsedSections) &&
    candidate.collapsedSections.every((key) => typeof key === 'string')
  );
}

/**
 * The right-hand widget system: the rail on the outer edge and the panel it
 * toggles, whose sections stack and collapse independently. The panel scrolls
 * on its own so a section can move the view without dragging the overview.
 */
export const WidgetSidebar = ({
  workstreams,
  filterNote,
  now,
  onEntryClick,
  onEntryHover,
  storageKey = DEFAULT_STORAGE_KEY,
}: WidgetSidebarProperties) => {
  const { t } = useTranslation();

  const [storedState, setStoredState] = useLocalStorageState<PanelState>(
    storageKey,
    DEFAULT_STATE,
  );
  // The hook restores whatever JSON was stored, so anything but our own shape
  // — an older layout, a hand-edited entry — starts over from the default.
  const panel = isPanelState(storedState) ? storedState : DEFAULT_STATE;

  const entries = useMemo(
    () => collectDeadlineEntries(workstreams),
    [workstreams],
  );
  const stats = useMemo(
    () => derivePulseStats(workstreams, entries, now),
    [workstreams, entries, now],
  );

  const togglePanel = () => {
    setStoredState({ ...panel, open: !panel.open });
  };

  const toggleSection = (key: string) => {
    setStoredState({
      ...panel,
      collapsedSections: panel.collapsedSections.includes(key)
        ? panel.collapsedSections.filter((collapsed) => collapsed !== key)
        : [...panel.collapsedSections, key],
    });
  };

  return (
    <div className="flex h-full min-h-0 shrink-0">
      {panel.open && (
        <aside className="flex min-h-0 w-90 flex-col gap-4 overflow-y-auto border-l bg-background/50 px-3 py-3">
          {filterNote && (
            <p className="flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground">
              <FilterIcon aria-hidden className="size-3 shrink-0" />
              <span className="truncate">
                {t('overview.widgets.mirroring', { filters: filterNote })}
              </span>
            </p>
          )}

          <CollapsibleSection
            title={t('overview.widgets.pulse.title')}
            summary={t('overview.widgets.pulse.summary', {
              settled: stats.settledSteps,
              total: stats.totalSteps,
            })}
            isOpen={!panel.collapsedSections.includes(PULSE_SECTION)}
            onToggle={() => toggleSection(PULSE_SECTION)}
          >
            <StatsWidget
              stats={stats}
              now={now}
              onEntryClick={onEntryClick}
              onEntryHover={onEntryHover}
            />
          </CollapsibleSection>
        </aside>
      )}

      <WidgetRail isPanelOpen={panel.open} onTogglePanel={togglePanel} />
    </div>
  );
};

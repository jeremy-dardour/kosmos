import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WidgetSidebar } from '@/features/overview/widgets/widget-sidebar';
import { step, workstream } from '@/testing/mock-overview-data';

const NOW = new Date(2026, 7, 1); // 2026-08-01
const STORAGE_KEY = 'overview.widget-panel:test';

// Node 25 defines its own (unusable) `localStorage` global, which shadows the
// jsdom one, so the spec supplies the storage instead.
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => entries.keys().toArray()[index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

const WORKSTREAMS = [
  workstream({
    id: 'w1',
    steps: [
      step('Book the hall', 'done'),
      step('Sign the contract', 'in_progress', { deadline: '2026-08-05' }),
    ],
  }),
];

function renderSidebar(filterNote: string | null = null) {
  render(
    <WidgetSidebar
      workstreams={WORKSTREAMS}
      filterNote={filterNote}
      now={NOW}
      storageKey={STORAGE_KEY}
    />,
  );
}

function pulseHeader(): HTMLElement {
  return screen.getByRole('button', {
    name: /overview\.widgets\.pulse\.title/,
  });
}

describe('widgetSidebar', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('panel visibility', () => {
    it('opens the panel when nothing has been stored yet', () => {
      renderSidebar();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'overview.widgets.hidePanel' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    it('honours a stored closed panel', () => {
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ open: false, collapsedSections: [] }),
      );
      renderSidebar();

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'overview.widgets.showPanel' }),
      ).toHaveAttribute('aria-pressed', 'false');
    });

    it('remembers a panel the user closes', async () => {
      renderSidebar();

      await userEvent.click(
        screen.getByRole('button', { name: 'overview.widgets.hidePanel' }),
      );

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(storage.getItem(STORAGE_KEY)).toBe(
        JSON.stringify({ open: false, collapsedSections: [] }),
      );
    });

    it('falls back to the default when the stored state is not the panel shape', () => {
      storage.setItem(STORAGE_KEY, JSON.stringify({ open: 'yes' }));
      renderSidebar();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(pulseHeader()).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('sections', () => {
    it('collapses a section listed as closed', () => {
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ open: true, collapsedSections: ['stats'] }),
      );
      renderSidebar();

      expect(pulseHeader()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('leaves a section absent from the list open', () => {
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ open: true, collapsedSections: ['agenda'] }),
      );
      renderSidebar();

      expect(pulseHeader()).toHaveAttribute('aria-expanded', 'true');
    });

    it('remembers a section the user collapses', async () => {
      renderSidebar();

      await userEvent.click(pulseHeader());

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(storage.getItem(STORAGE_KEY)).toBe(
        JSON.stringify({ open: true, collapsedSections: ['stats'] }),
      );
    });
  });

  describe('filter mirroring', () => {
    it('says nothing while the overview is unfiltered', () => {
      renderSidebar();

      expect(
        screen.queryByText(/overview\.widgets\.mirroring/),
      ).not.toBeInTheDocument();
    });

    it('names the filters the panel is mirroring', () => {
      renderSidebar('Groups: 2');

      expect(
        screen.getByText('overview.widgets.mirroring'),
      ).toBeInTheDocument();
    });
  });
});

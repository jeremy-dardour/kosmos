import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WidgetSidebar } from '@/features/overview/widgets/widget-sidebar';
import { createMemoryStorage } from '@/testing/memory-storage';
import { step, workstream } from '@/testing/mock-overview-data';

const NOW = new Date(2026, 7, 1); // 2026-08-01
const STORAGE_KEY = 'overview.widget-panel:test';

const WORKSTREAMS = [
  workstream({
    id: 'w1',
    steps: [
      step('Book the hall', 'done'),
      step('Sign the contract', 'in_progress', { deadline: '2026-08-05' }),
    ],
  }),
];

function renderSidebar() {
  render(
    <WidgetSidebar
      workstreams={WORKSTREAMS}
      filterNote={null}
      now={NOW}
      storageKey={STORAGE_KEY}
    />,
  );
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

  it('falls back to the default when the stored state is not the panel shape', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ open: 'yes' }));
    renderSidebar();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /overview\.widgets\.pulse\.title/ }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('stacks the calendar and the agenda under the pulse', () => {
    renderSidebar();

    expect(
      screen
        .getAllByRole('region')
        .map((section) => section.getAttribute('aria-label')),
    ).toEqual([
      'overview.widgets.pulse.title',
      'overview.widgets.calendar.title',
      'overview.widgets.agenda.title',
    ]);
  });
});

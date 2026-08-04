import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CollapsibleSection } from '@/features/overview/widgets/collapsible-section';

interface SectionOverrides {
  summary?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

function renderSection({
  summary,
  isOpen = true,
  onToggle = vi.fn(),
}: SectionOverrides = {}) {
  render(
    <CollapsibleSection
      title="Agenda"
      summary={summary}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <p>Taste the cake</p>
    </CollapsibleSection>,
  );
}

function header(): HTMLElement {
  return screen.getByRole('button', { name: /Agenda/ });
}

describe('collapsibleSection', () => {
  it('shows the body of an open section and reports it expanded', () => {
    renderSection();

    expect(header()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Taste the cake')).toBeInTheDocument();
  });

  it('unmounts the body when collapsed', () => {
    renderSection({ isOpen: false });

    expect(header()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Taste the cake')).not.toBeInTheDocument();
  });

  it('keeps the summary visible while collapsed', () => {
    renderSection({ isOpen: false, summary: '4 due' });

    expect(screen.getByText('4 due')).toBeInTheDocument();
  });

  it('reports a header click without deciding the next state itself', async () => {
    const onToggle = vi.fn();
    renderSection({ onToggle });

    await userEvent.click(header());

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(header()).toHaveAttribute('aria-expanded', 'true');
  });

  it('labels the section with its title', () => {
    renderSection();

    expect(screen.getByRole('region', { name: 'Agenda' })).toBeInTheDocument();
  });
});

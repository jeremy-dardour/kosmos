import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChecklistCard } from '@/features/overview/checklist-card';

import type { ChecklistItem } from '@/api/hooks/use-overview';

function item(name: string, isDone: boolean): ChecklistItem {
  return {
    id: name,
    name,
    position: 1,
    done: isDone,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('checklistCard', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<ChecklistCard items={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('shows all items with their names', () => {
    render(
      <ChecklistCard
        items={[item('Chateau A', true), item('Garden B', false)]}
      />,
    );

    expect(screen.getByText('Chateau A')).toBeInTheDocument();
    expect(screen.getByText('Garden B')).toBeInTheDocument();
  });

  it('shows the completion count', () => {
    render(
      <ChecklistCard
        items={[
          item('Chateau A', true),
          item('Garden B', false),
          item('Barn C', true),
        ]}
      />,
    );

    expect(
      screen.getByText('overview.detail.checklistProgress'),
    ).toBeInTheDocument();
  });

  it('strikes through done items', () => {
    render(
      <ChecklistCard
        items={[item('Chateau A', true), item('Garden B', false)]}
      />,
    );

    expect(screen.getByText('Chateau A')).toHaveClass('line-through');
    expect(screen.getByText('Garden B')).not.toHaveClass('line-through');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IconPicker } from '@/features/overview/icon-picker';

const LABEL = 'Workstream icon';

function renderPicker(value: string) {
  const onSelect = vi.fn();

  render(
    <IconPicker
      value={value}
      label={LABEL}
      placeholder="Choose…"
      onSelect={onSelect}
    />,
  );

  return { onSelect, agent: userEvent.setup() };
}

describe('iconPicker', () => {
  it('shows the current icon on the trigger', () => {
    renderPicker('🍽️');

    expect(screen.getByRole('button', { name: LABEL })).toHaveTextContent('🍽️');
  });

  it('falls back to the placeholder without an icon', () => {
    renderPicker('');

    expect(screen.getByRole('button', { name: LABEL })).toHaveTextContent(
      'Choose…',
    );
  });

  it('reports the picked icon and closes', async () => {
    const { agent, onSelect } = renderPicker('');

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.click(await screen.findByRole('menuitem', { name: '💐' }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('💐');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});

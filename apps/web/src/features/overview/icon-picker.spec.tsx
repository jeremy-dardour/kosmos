import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IconPicker } from '@/features/overview/icon-picker';
import { renderWithApp } from '@/testing/render-with-app';

const LABEL = 'Workstream icon';

function renderPicker(value: string) {
  const onSelect = vi.fn();

  renderWithApp(
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
  it('shows the current icon on the trigger, curated or not', () => {
    renderPicker('🦖');

    expect(screen.getByRole('button', { name: LABEL })).toHaveTextContent('🦖');
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
    await agent.click(await screen.findByRole('button', { name: '💐' }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('💐');
    expect(
      screen.queryByRole('button', { name: '💐' }),
    ).not.toBeInTheDocument();
  });

  it('reports a trimmed custom icon typed in and closes', async () => {
    const { agent, onSelect } = renderPicker('');

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.type(
      await screen.findByRole('textbox', { name: 'Custom icon' }),
      ' 🦖 {Enter}',
    );

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('🦖');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('ignores an empty custom icon', async () => {
    const { agent, onSelect } = renderPicker('');

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.type(
      await screen.findByRole('textbox', { name: 'Custom icon' }),
      '  {Enter}',
    );

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '💐' })).toBeVisible();
  });
});

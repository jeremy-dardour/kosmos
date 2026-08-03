import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ClickToEdit } from '@/features/overview/click-to-edit';

const LABEL = 'Workstream name';

function renderField(
  properties: Partial<Parameters<typeof ClickToEdit>[0]> = {},
) {
  const onCommit = vi.fn();

  render(
    <ClickToEdit
      value="Venue"
      label={LABEL}
      placeholder="Untitled"
      onCommit={onCommit}
      {...properties}
    />,
  );

  return { onCommit, agent: userEvent.setup() };
}

describe('clickToEdit', () => {
  it('shows the value on a button named by the label', () => {
    renderField();

    expect(screen.getByRole('button', { name: LABEL })).toHaveTextContent(
      'Venue',
    );
  });

  it('shows the placeholder when the value is empty', () => {
    renderField({ value: '' });

    expect(screen.getByRole('button', { name: LABEL })).toHaveTextContent(
      'Untitled',
    );
  });

  it('opens an input carrying the current value', async () => {
    const { agent } = renderField();

    await agent.click(screen.getByRole('button', { name: LABEL }));

    expect(screen.getByRole('textbox', { name: LABEL })).toHaveValue('Venue');
  });

  it('commits the edited value on Enter', async () => {
    const { agent, onCommit } = renderField();

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.clear(screen.getByRole('textbox', { name: LABEL }));
    await agent.type(screen.getByRole('textbox', { name: LABEL }), 'Catering');
    await agent.keyboard('{Enter}');

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Catering');
    expect(screen.getByRole('button', { name: LABEL })).toBeInTheDocument();
  });

  it('commits the edited value on blur', async () => {
    const { agent, onCommit } = renderField();

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.type(screen.getByRole('textbox', { name: LABEL }), ' hire');
    await agent.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Venue hire');
  });

  it('discards the edit on Escape', async () => {
    const { agent, onCommit } = renderField();

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.type(screen.getByRole('textbox', { name: LABEL }), ' hire');
    await agent.keyboard('{Escape}');

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: LABEL })).toHaveTextContent(
      'Venue',
    );
  });

  it('reopens with the original value after a cancelled edit', async () => {
    const { agent } = renderField();

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.type(screen.getByRole('textbox', { name: LABEL }), ' hire');
    await agent.keyboard('{Escape}');
    await agent.click(screen.getByRole('button', { name: LABEL }));

    expect(screen.getByRole('textbox', { name: LABEL })).toHaveValue('Venue');
  });

  it('does not commit an unchanged value', async () => {
    const { agent, onCommit } = renderField();

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.tab();

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits an emptied value', async () => {
    const { agent, onCommit } = renderField();

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.clear(screen.getByRole('textbox', { name: LABEL }));
    await agent.tab();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('');
  });

  it('opens straight into the input when asked to start editing', () => {
    renderField({ value: '', startEditing: true });

    expect(screen.getByRole('textbox', { name: LABEL })).toHaveFocus();
  });
});

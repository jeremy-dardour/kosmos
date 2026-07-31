import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeadlineField } from '@/features/overview/deadline-field';

const LABEL = 'Step deadline';
const NOW = new Date(2026, 6, 31);

function renderField(value: string | null) {
  const onCommit = vi.fn();

  render(
    <DeadlineField value={value} label={LABEL} now={NOW} onCommit={onCommit} />,
  );

  return { onCommit, agent: userEvent.setup() };
}

async function openInput(agent: ReturnType<typeof userEvent.setup>) {
  await agent.click(screen.getByRole('button', { name: LABEL }));

  return screen.getByLabelText(LABEL);
}

describe('deadlineField', () => {
  it('offers to add a date when there is no deadline', () => {
    renderField(null);

    expect(screen.getByRole('button', { name: LABEL })).toHaveTextContent(
      'overview.deadlineField.empty',
    );
  });

  it('shows the deadline when there is one', () => {
    renderField('2026-09-12');

    expect(screen.getByRole('button', { name: LABEL })).toHaveTextContent(
      'overview.deadlineField.due',
    );
  });

  it('opens a date input carrying the current deadline', async () => {
    const { agent } = renderField('2026-09-12');

    expect(await openInput(agent)).toHaveValue('2026-09-12');
  });

  it('commits a picked date', async () => {
    const { agent, onCommit } = renderField(null);

    fireEvent.change(await openInput(agent), {
      target: { value: '2026-09-12' },
    });

    expect(onCommit).toHaveBeenCalledExactlyOnceWith('2026-09-12');
  });

  it('commits null when the date is cleared', async () => {
    const { agent, onCommit } = renderField('2026-09-12');

    fireEvent.change(await openInput(agent), { target: { value: '' } });

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('does not commit an unchanged date', async () => {
    const { agent, onCommit } = renderField('2026-09-12');

    fireEvent.change(await openInput(agent), {
      target: { value: '2026-09-12' },
    });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('closes the input on blur', async () => {
    const { agent } = renderField('2026-09-12');

    await openInput(agent);
    await agent.tab();

    expect(screen.getByRole('button', { name: LABEL })).toBeInTheDocument();
  });
});

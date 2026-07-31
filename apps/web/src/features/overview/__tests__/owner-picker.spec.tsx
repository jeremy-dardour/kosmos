import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OwnerPicker } from '@/features/overview/owner-picker';

import type { UserSummary } from '@/api/hooks/use-overview';

const LABEL = 'Workstream owner';

const USERS: UserSummary[] = [
  { id: 'user-1', name: 'Ada Lovelace' },
  { id: 'user-2', name: 'Grace Hopper' },
];

function renderPicker(ownerId: string | null) {
  const onSelect = vi.fn();

  render(
    <OwnerPicker
      users={USERS}
      ownerId={ownerId}
      label={LABEL}
      clearLabel="Unassigned"
      onSelect={onSelect}
    />,
  );

  return { onSelect, agent: userEvent.setup() };
}

describe('ownerPicker', () => {
  it('lists the clear option and every user', async () => {
    const { agent } = renderPicker(null);

    await agent.click(screen.getByRole('button', { name: LABEL }));

    expect(
      await screen.findByRole('menuitemradio', { name: 'Unassigned' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'Ada Lovelace' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'Grace Hopper' }),
    ).toBeInTheDocument();
  });

  it('marks the current owner as selected', async () => {
    const { agent } = renderPicker('user-2');

    await agent.click(screen.getByRole('button', { name: LABEL }));

    expect(
      await screen.findByRole('menuitemradio', { name: 'Grace Hopper' }),
    ).toBeChecked();
  });

  it('reports the picked user', async () => {
    const { agent, onSelect } = renderPicker(null);

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.click(
      await screen.findByRole('menuitemradio', { name: 'Ada Lovelace' }),
    );

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('user-1');
  });

  it('reports null when the clear option is picked', async () => {
    const { agent, onSelect } = renderPicker('user-1');

    await agent.click(screen.getByRole('button', { name: LABEL }));
    await agent.click(
      await screen.findByRole('menuitemradio', { name: 'Unassigned' }),
    );

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('falls back to the unassigned avatar for an unknown owner', () => {
    renderPicker('user-gone');

    expect(
      screen.getByRole('img', { name: 'overview.card.unassigned' }),
    ).toBeInTheDocument();
  });
});

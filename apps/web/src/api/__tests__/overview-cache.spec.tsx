import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setApiClient } from '@/api/api-client';
import { configureApiClient } from '@/api/configure-api-client';
import { overviewQueryOptions } from '@/api/hooks/use-overview';
import {
  patchOverviewCache,
  useOverviewCache,
  useTrailingOverviewInvalidate,
} from '@/api/overview-cache';
import {
  checklistItem,
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';
import { createStubAuth } from '@/testing/stub-auth';

import type { Overview } from '@/api/hooks/use-overview';
import type { OverviewPatch } from '@/api/overview-cache';
import type { ReactNode } from 'react';

const PROJECT_ID = 'p1';

function buildOverview(): Overview {
  return {
    project: project(),
    groups: [
      group({ id: 'g1', position: 0 }),
      group({ id: 'g2', position: 1 }),
    ],
    users: [user()],
    workstreams: [
      workstream({
        id: 'w1',
        position: 0,
        currentStepId: 'current',
        steps: [
          step('current', 'in_progress', { id: 'current', position: 1 }),
          step('next', 'not_started', {
            id: 'next',
            position: 2,
            noteCount: 1,
            checklistItems: [
              checklistItem('taste', false, { id: 'item-1', position: 1 }),
            ],
          }),
        ],
      }),
      workstream({
        id: 'w2',
        position: 1,
        steps: [step('other', 'not_started', { id: 'other', position: 1 })],
      }),
    ],
  };
}

function setupCache() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    overviewQueryOptions(PROJECT_ID).queryKey,
    buildOverview(),
  );

  const read = () =>
    queryClient.getQueryData<Overview>(
      overviewQueryOptions(PROJECT_ID).queryKey,
    )!;
  const patch = (patchInput: OverviewPatch) =>
    patchOverviewCache(queryClient, PROJECT_ID, patchInput);

  return { queryClient, read, patch };
}

function wrapperFor(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  setApiClient(configureApiClient(createStubAuth().auth));
});

describe('patchOverviewCache', () => {
  it('replaces a step inside its workstream and leaves the others alone', () => {
    const { read, patch } = setupCache();
    const before = read();

    patch({
      type: 'step',
      step: { ...before.workstreams[0]!.steps[1]!, name: 'Renamed' },
    });

    const after = read();
    expect(after.workstreams[0]!.steps[1]!.name).toBe('Renamed');
    expect(after.workstreams[0]!.steps[0]).toBe(
      before.workstreams[0]!.steps[0],
    );
    expect(after.workstreams[1]).toBe(before.workstreams[1]);
  });

  it('replaces a workstream wholesale', () => {
    const { read, patch } = setupCache();
    const replacement = workstream({ id: 'w1', name: 'Rewritten', steps: [] });

    patch({ type: 'workstream', workstream: replacement });

    expect(read().workstreams[0]).toStrictEqual(replacement);
  });

  it('applies a reordered scope of workstreams by id', () => {
    const { read, patch } = setupCache();
    const before = read();

    patch({
      type: 'workstream-order',
      workstreams: [
        { ...before.workstreams[1]!, position: 0 },
        { ...before.workstreams[0]!, position: 1 },
      ],
    });

    const after = read();
    expect(after.workstreams.map((item) => [item.id, item.position])).toEqual([
      ['w1', 1],
      ['w2', 0],
    ]);
  });

  it('applies a reordered list of groups by id', () => {
    const { read, patch } = setupCache();
    const before = read();

    patch({
      type: 'group-order',
      groups: [
        { ...before.groups[1]!, position: 0 },
        { ...before.groups[0]!, position: 1 },
      ],
    });

    expect(read().groups.map((item) => [item.id, item.position])).toEqual([
      ['g1', 1],
      ['g2', 0],
    ]);
  });

  it('appends, replaces and removes checklist items', () => {
    const { read, patch } = setupCache();
    const added = checklistItem('book', false, { id: 'item-2', position: 2 });

    patch({
      type: 'checklist-item-added',
      stepId: 'next',
      checklistItem: added,
    });
    expect(read().workstreams[0]!.steps[1]!.checklistItems).toHaveLength(2);

    patch({
      type: 'checklist-item-changed',
      checklistItem: { ...added, done: true },
    });
    expect(read().workstreams[0]!.steps[1]!.checklistItems[1]!.done).toBe(true);

    patch({ type: 'checklist-item-removed', checklistItemId: 'item-1' });
    expect(
      read().workstreams[0]!.steps[1]!.checklistItems.map((item) => item.id),
    ).toEqual(['item-2']);
  });

  it('moves the note count and never takes it below zero', () => {
    const { read, patch } = setupCache();

    patch({ type: 'note-count', stepId: 'next', delta: 1 });
    expect(read().workstreams[0]!.steps[1]!.noteCount).toBe(2);

    patch({ type: 'note-count', stepId: 'current', delta: -1 });
    expect(read().workstreams[0]!.steps[0]!.noteCount).toBe(0);
  });

  it('leaves the cache untouched when the entity is unknown', () => {
    const { read, patch } = setupCache();
    const before = read();

    patch({
      type: 'step',
      step: step('ghost', 'not_started', { id: 'ghost' }),
    });
    patch({ type: 'workstream', workstream: workstream({ id: 'w9' }) });
    patch({ type: 'checklist-item-removed', checklistItemId: 'item-9' });
    patch({ type: 'note-count', stepId: 'ghost', delta: 1 });

    expect(read()).toBe(before);
  });

  it('does nothing without a project id', () => {
    const { queryClient, read } = setupCache();
    const before = read();

    patchOverviewCache(queryClient, undefined, {
      type: 'note-count',
      stepId: 'next',
      delta: 1,
    });

    expect(read()).toBe(before);
  });
});

function renderScheduler() {
  const { queryClient, read, patch } = setupCache();
  const invalidateQueries = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockResolvedValue();
  const view = renderHook(() => useTrailingOverviewInvalidate(PROJECT_ID), {
    wrapper: wrapperFor(queryClient),
  });

  return { ...view, queryClient, read, patch, invalidateQueries };
}

function focusedInput() {
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();
  return input;
}

function blur(input: HTMLElement, relatedTarget: HTMLElement | null) {
  act(() => {
    if (relatedTarget) {
      relatedTarget.focus();
    } else {
      input.blur();
    }
    input.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget }),
    );
  });
}

describe('useTrailingOverviewInvalidate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('collapses a burst of mutations into one invalidate', () => {
    const { result, invalidateQueries } = renderScheduler();

    act(() => {
      result.current();
      vi.advanceTimersByTime(1500);
      result.current();
      vi.advanceTimersByTime(1500);
      result.current();
    });
    expect(invalidateQueries).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: overviewQueryOptions(PROJECT_ID).queryKey,
    });
  });

  it('defers while a text field holds focus and fires once it blurs', () => {
    const { result, invalidateQueries } = renderScheduler();
    const input = focusedInput();

    act(() => {
      result.current();
      vi.advanceTimersByTime(5000);
    });
    expect(invalidateQueries).not.toHaveBeenCalled();

    blur(input, null);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('keeps deferring when focus moves straight to another editor', () => {
    const { result, invalidateQueries } = renderScheduler();
    const first = focusedInput();
    const second = document.createElement('textarea');
    document.body.append(second);

    act(() => {
      result.current();
      vi.advanceTimersByTime(2000);
    });
    blur(first, second);
    expect(invalidateQueries).not.toHaveBeenCalled();

    blur(second, null);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('does not defer for a focused button', () => {
    const { result, invalidateQueries } = renderScheduler();
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();

    act(() => {
      result.current();
      vi.advanceTimersByTime(2000);
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('shares one invalidate across every hook using the same query client', () => {
    const { queryClient } = setupCache();
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue();
    const wrapper = wrapperFor(queryClient);
    const first = renderHook(() => useTrailingOverviewInvalidate(PROJECT_ID), {
      wrapper,
    });
    const second = renderHook(() => useTrailingOverviewInvalidate(PROJECT_ID), {
      wrapper,
    });

    act(() => {
      first.result.current();
      second.result.current();
      vi.advanceTimersByTime(2000);
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('drops a pending invalidate when the last subscriber unmounts', () => {
    const { result, unmount, invalidateQueries } = renderScheduler();

    act(() => {
      result.current();
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('patches and schedules through useOverviewCache', () => {
    const { queryClient, read } = setupCache();
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue();
    const { result } = renderHook(() => useOverviewCache(PROJECT_ID), {
      wrapper: wrapperFor(queryClient),
    });

    act(() => {
      result.current({ type: 'note-count', stepId: 'next', delta: 1 });
    });
    expect(read().workstreams[0]!.steps[1]!.noteCount).toBe(2);
    expect(invalidateQueries).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});

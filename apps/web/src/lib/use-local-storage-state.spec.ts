import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLocalStorageState } from '@/lib/use-local-storage-state';

const KEY = 'widget-panel:test';

// Node 25 defines its own (unusable) `localStorage` global, which shadows the
// jsdom one, so tests supply the storage instead of relying on the environment.
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

describe('useLocalStorageState', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorageState(KEY, 'fallback'));

    expect(result.current[0]).toBe('fallback');
  });

  it('should restore a previously stored value', () => {
    storage.setItem(KEY, JSON.stringify({ open: true }));

    const { result } = renderHook(() =>
      useLocalStorageState(KEY, { open: false }),
    );

    expect(result.current[0]).toEqual({ open: true });
  });

  it('should persist the value across a remount', () => {
    const first = renderHook(() => useLocalStorageState(KEY, 0));

    act(() => {
      first.result.current[1](3);
    });
    first.unmount();

    const second = renderHook(() => useLocalStorageState(KEY, 0));

    expect(second.result.current[0]).toBe(3);
  });

  it('should support function updaters, including consecutive ones', () => {
    const { result } = renderHook(() => useLocalStorageState(KEY, 1));

    act(() => {
      result.current[1]((previous) => previous + 1);
      result.current[1]((previous) => previous + 1);
    });

    expect(result.current[0]).toBe(3);
    expect(storage.getItem(KEY)).toBe('3');
  });

  it('should fall back to the initial value when the stored JSON is corrupt', () => {
    storage.setItem(KEY, '{not json');

    const { result } = renderHook(() => useLocalStorageState(KEY, 'fallback'));

    expect(result.current[0]).toBe('fallback');
  });

  it('should degrade to in-memory state when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('storage disabled');
      },
    });

    const { result } = renderHook(() => useLocalStorageState(KEY, 'fallback'));

    expect(result.current[0]).toBe('fallback');

    act(() => {
      result.current[1]('next');
    });

    expect(result.current[0]).toBe('next');
  });

  it('should degrade to in-memory state when the storage global is unusable', () => {
    vi.stubGlobal('localStorage', {});

    const { result } = renderHook(() => useLocalStorageState(KEY, 'fallback'));

    act(() => {
      result.current[1]('next');
    });

    expect(result.current[0]).toBe('next');
  });
});

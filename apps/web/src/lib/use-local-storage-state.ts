import { useCallback, useRef, useState } from 'react';

import type { Dispatch, SetStateAction } from 'react';

/**
 * `useState` whose value is mirrored into `localStorage` under `key`.
 *
 * Guarantees only "valid JSON or `initialValue`" — validating the shape of a
 * restored value is the caller's job. Storage failures (private mode, quota,
 * blocked access) degrade to plain in-memory state rather than throwing.
 * No cross-tab sync: a `key` written by another tab is not observed.
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    readStoredValue(key, initialValue),
  );
  const latestValue = useRef(value);

  const setStoredValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const next =
        typeof action === 'function'
          ? (action as (previous: T) => T)(latestValue.current)
          : action;

      latestValue.current = next;
      writeStoredValue(key, next);
      setValue(next);
    },
    [key],
  );

  return [value, setStoredValue];
}

function readStoredValue<T>(key: string, initialValue: T): T {
  try {
    const raw = getStorage()?.getItem(key);
    return raw === null || raw === undefined
      ? initialValue
      : (JSON.parse(raw) as T);
  } catch {
    return initialValue;
  }
}

function writeStoredValue<T>(key: string, value: T): void {
  try {
    getStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function getStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

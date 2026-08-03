import { useEffect, useRef } from 'react';

import type { RefObject } from 'react';

/**
 * Moves focus onto an inline panel when it opens, so a keyboard user lands in
 * what just appeared instead of tabbing the whole pipeline row to reach it.
 * A panel that autofocuses one of its own fields keeps it — that is the more
 * specific intent.
 */
export function useFocusOnOpen<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const panel = ref.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
  }, []);

  return ref;
}

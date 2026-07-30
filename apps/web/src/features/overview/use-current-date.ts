import { useEffect, useState } from 'react';

/** Re-renders after the local calendar day rolls over. */
export function useCurrentDate(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const timeout = globalThis.setTimeout(
      () => setNow(new Date()),
      nextMidnight.getTime() - now.getTime(),
    );

    return () => globalThis.clearTimeout(timeout);
  }, [now]);

  return now;
}

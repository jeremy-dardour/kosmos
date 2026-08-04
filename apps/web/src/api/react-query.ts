import { formatToApiError } from '@/errors/format-error';

import type { DefaultOptions, QueryMeta } from '@tanstack/react-query';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /**
       * Statuses the mounting screen renders in place (e.g. the overview's
       * "project not found" state); the global error dialog skips them.
       */
      localErrorStatuses?: readonly number[];
    };
  }
}

export function isLocallyHandledError(
  error: unknown,
  meta: QueryMeta | undefined,
): boolean {
  const status = formatToApiError(error)?.status;

  return status !== undefined && !!meta?.localErrorStatuses?.includes(status);
}

export const queryConfig = {
  queries: {
    refetchOnWindowFocus: false,
    retry: false,
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  },
} satisfies DefaultOptions;

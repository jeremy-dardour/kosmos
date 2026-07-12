import type { DefaultOptions } from '@tanstack/react-query';

export const queryConfig = {
  queries: {
    refetchOnWindowFocus: false,
    retry: false,
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  },
} satisfies DefaultOptions;

import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';

import { queryConfig } from '@/api/react-query';
import { env } from '@/config/env';
import { useApiError } from '@/errors/use-api-error';

interface AppProviderProperties {
  children: React.ReactNode;
}

export const AppProvider = ({ children }: AppProviderProperties) => {
  const { showError } = useApiError();

  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            showError(error);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            showError(error);
          },
        }),
        defaultOptions: queryConfig,
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {env.dev && <ReactQueryDevtools />}
      {children}
    </QueryClientProvider>
  );
};

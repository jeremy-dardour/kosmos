import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';

import { isLocallyHandledError, queryConfig } from '@/api/react-query';
import { GlobalApiErrorDialog } from '@/app/components/error/global-api-error-dialog';
import { AuthContext } from '@/auth';
import { env } from '@/config/env';
import { ApiErrorProvider } from '@/errors/api-error-provider';
import { useApiError } from '@/errors/use-api-error';

import type { AuthSystem } from '@/auth';

interface QueryProviderProperties {
  children: React.ReactNode;
}

// Separate component so the QueryClient can capture showError from the
// ApiErrorProvider rendered above it. showError must stay referentially
// stable: the client holds the first render's closure forever.
const QueryProvider = ({ children }: QueryProviderProperties) => {
  const { showError } = useApiError();

  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (isLocallyHandledError(error, query.meta)) return;
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

interface AppProviderProperties {
  authSystem: AuthSystem;
  children: React.ReactNode;
}

/**
 * The provider stack shared by the real app (main.tsx) and the integration
 * test harness (render-with-app.tsx). What differs per environment — router,
 * i18n wiring, the auth system value — stays at the call sites.
 */
export const AppProvider = ({
  authSystem,
  children,
}: AppProviderProperties) => (
  <AuthContext value={authSystem}>
    <ApiErrorProvider>
      <QueryProvider>
        <GlobalApiErrorDialog />
        {children}
      </QueryProvider>
    </ApiErrorProvider>
  </AuthContext>
);

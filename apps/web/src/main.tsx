import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { RouterProvider } from 'react-router/dom';

import { AppProvider } from '@/app/app-provider';
import { ErrorFallback } from '@/app/components/error/error-fallback';
import { GlobalApiErrorDialog } from '@/app/components/error/global-api-error-dialog';
import { router } from '@/app/router';
import { AuthContext } from '@/auth';
import { bootstrap } from '@/bootstrap';
import { ApiErrorProvider } from '@/errors/api-error-provider';
import '@/i18n/i18n';

import './main.css';

const { authProvider } = bootstrap();

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthContext value={authProvider}>
        <ApiErrorProvider>
          <AppProvider>
            <GlobalApiErrorDialog />
            <RouterProvider router={router} />
          </AppProvider>
        </ApiErrorProvider>
      </AuthContext>
    </ErrorBoundary>
  </StrictMode>,
);

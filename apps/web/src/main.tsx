import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { RouterProvider } from 'react-router/dom';

import { AppProvider } from '@/app/app-provider';
import { ErrorFallback } from '@/app/components/error/error-fallback';
import { router } from '@/app/router';
import { bootstrap } from '@/bootstrap';
import '@/i18n/i18n';

import './main.css';

const { authSystem } = bootstrap();

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AppProvider authSystem={authSystem}>
        <RouterProvider router={router} />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);

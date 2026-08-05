import { render } from '@testing-library/react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router';

import { setApiClient } from '@/api/api-client';
import { configureApiClient } from '@/api/configure-api-client';
import { AppProvider } from '@/app/app-provider';
import en from '@/i18n/locales/en.json';
import { createStubAuth } from '@/testing/stub-auth';

import type { ReactElement } from 'react';

await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: en } },
  // Mirror the app's i18n config (interpolation.escapeValue: false). i18next
  // HTML-escapes interpolated values by default, but we render translated
  // strings only as React children — and React already escapes those. With
  // both on, a name like "Venue & Catering" becomes "Venue &amp; Catering"
  // (double-escaped), so tests querying by role/text name fail to match.
  interpolation: { escapeValue: false },
});

export function renderWithApp(ui: ReactElement) {
  const { authSystem } = createStubAuth();

  setApiClient(configureApiClient(authSystem.session));

  return render(
    <I18nextProvider i18n={i18n}>
      <AppProvider authSystem={authSystem}>{ui}</AppProvider>
    </I18nextProvider>,
  );
}

/** Renders a page that reads `:projectId` from the route, e.g. `OverviewPage`. */
export function renderAtProjectRoute(ui: ReactElement, projectId = 'p1') {
  return renderWithApp(
    <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
      <Routes>
        <Route path="/projects/:projectId" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

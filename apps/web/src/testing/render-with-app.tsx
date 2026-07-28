import { render } from '@testing-library/react';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { setApiClient } from '@/api/api-client';
import { configureApiClient } from '@/api/configure-api-client';
import { AppProvider } from '@/app/app-provider';
import { GlobalApiErrorDialog } from '@/app/components/error/global-api-error-dialog';
import { AuthContext } from '@/auth';
import { ApiErrorProvider } from '@/errors/api-error-provider';
import en from '@/i18n/locales/en.json';
import { createStubAuth } from '@/testing/stub-auth';

import type { ReactElement } from 'react';

await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: en } },
});

export function renderWithApp(ui: ReactElement) {
  const { authSystem } = createStubAuth();

  setApiClient(configureApiClient(authSystem.session));

  return render(
    <I18nextProvider i18n={i18n}>
      <AuthContext value={authSystem}>
        <ApiErrorProvider>
          <AppProvider>
            <GlobalApiErrorDialog />
            {ui}
          </AppProvider>
        </ApiErrorProvider>
      </AuthContext>
    </I18nextProvider>,
  );
}

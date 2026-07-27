import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import type { FakeAuthProvider } from '@/auth/fake-auth-provider';

interface FakeSignInButtonProps {
  provider: FakeAuthProvider;
}

export function FakeSignInButton({
  provider,
}: FakeSignInButtonProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Button onClick={() => provider.authenticate()} type="button">
      {t('auth.landing.action.continueInDevMode')}
    </Button>
  );
}

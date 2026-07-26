import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import type { AuthProvider } from '@/auth/auth-provider.interface';

interface FakeSignInButtonProps {
  provider: AuthProvider;
}

export function FakeSignInButton({
  provider,
}: FakeSignInButtonProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Button onClick={() => void provider.signIn()} type="button">
      {t('auth.landing.action.continueInDevMode')}
    </Button>
  );
}

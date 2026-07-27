import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';

export function FakeSignInButton(): React.JSX.Element {
  const { t } = useTranslation();
  const auth = useAuth();

  return (
    <Button onClick={() => void auth.signIn()} type="button">
      {t('auth.landing.action.continueInDevMode')}
    </Button>
  );
}

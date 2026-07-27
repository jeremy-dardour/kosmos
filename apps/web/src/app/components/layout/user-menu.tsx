import { useTranslation } from 'react-i18next';

import { useAuth, useAuthState } from '@/auth';
import { Button } from '@/components/ui/button';

export const UserMenu = () => {
  const { t } = useTranslation();
  const auth = useAuth();
  const state = useAuthState();
  const user = state.status === 'authenticated' ? state.user : null;

  return (
    <div className="flex items-center gap-2">
      <span data-testid="user-menu-trigger" className="text-sm">
        {user?.name}
      </span>
      <Button variant="outline" size="sm" onClick={() => auth.signOut()}>
        {t('app.userMenu.logout')}
      </Button>
    </div>
  );
};

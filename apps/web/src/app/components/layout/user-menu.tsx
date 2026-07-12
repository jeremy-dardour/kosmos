import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth';
import { Button } from '@/components/ui/button';

export const UserMenu = () => {
  const { t } = useTranslation();
  const auth = useAuth();
  const user = auth.getAuthenticatedUser();

  const handleLogout = async () => {
    await auth.logout();
  };

  return (
    <div className="flex items-center gap-2">
      <span data-testid="user-menu-trigger" className="text-sm">
        {user?.name}
      </span>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        {t('app.userMenu.logout')}
      </Button>
    </div>
  );
};

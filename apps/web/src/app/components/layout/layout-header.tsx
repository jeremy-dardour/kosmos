import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { UserMenu } from '@/app/components/layout/user-menu';

export const LayoutHeader = () => {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between border-b bg-background px-4 py-2">
      <Link to="/" className="text-lg font-semibold">
        {t('app.logo.description')}
      </Link>
      <UserMenu />
    </header>
  );
};

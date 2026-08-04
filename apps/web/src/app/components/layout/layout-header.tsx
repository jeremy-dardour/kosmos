import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { KosmosLogo } from '@/app/components/brand/kosmos-logo';
import { UserMenu } from '@/app/components/layout/user-menu';

export const LayoutHeader = () => {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between border-b bg-background px-4 py-2">
      <Link
        to="/"
        aria-label={t('app.logo.homeLink')}
        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <KosmosLogo className="flex items-center gap-2.5 text-lg font-semibold tracking-tight" />
      </Link>
      <UserMenu />
    </header>
  );
};

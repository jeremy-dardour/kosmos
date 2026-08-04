import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';

/**
 * The overview's 404 state: the project does not exist, was deleted, or the
 * user is not a member — the API deliberately does not say which.
 */
export const ProjectNotFound = () => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-lg font-semibold">{t('overview.notFound.title')}</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t('overview.notFound.description')}
      </p>
      <Button render={<Link to="/" />} variant="outline" size="sm">
        {t('overview.notFound.backToProjects')}
      </Button>
    </div>
  );
};

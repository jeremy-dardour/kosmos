import { useTranslation } from 'react-i18next';

/** Placeholder reserving the column; the real slide-over arrives in slice 2. */
export const DetailPanel = () => {
  const { t } = useTranslation();

  return (
    <aside className="hidden min-h-0 flex-col items-center justify-center rounded-lg border border-dashed bg-card/40 p-panel text-center lg:flex">
      <p className="text-sm font-medium text-muted-foreground">
        {t('overview.detail.title')}
      </p>
      <p className="mt-1 max-w-[24ch] text-xs text-muted-foreground/70">
        {t('overview.detail.description')}
      </p>
    </aside>
  );
};

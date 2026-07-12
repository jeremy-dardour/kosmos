import { useTranslation } from 'react-i18next';

export const ErrorFallback = () => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#dc2626' }}>{t('app.error.render.title')}</h1>
      <p>{t('app.error.render.message')}</p>
    </div>
  );
};

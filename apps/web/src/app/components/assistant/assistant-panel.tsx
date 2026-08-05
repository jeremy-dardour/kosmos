import { ChatWidget } from '@useago/sdk/react';
import { useTranslation } from 'react-i18next';

export const AssistantPanel = () => {
  const { t } = useTranslation();

  return (
    <aside
      aria-label={t('app.assistant.panelLabel')}
      className="flex min-h-0 w-96 shrink-0 flex-col border-l bg-background"
    >
      <ChatWidget
        title={t('app.assistant.title')}
        welcomeMessage={t('app.assistant.welcome')}
        placeholder={t('app.assistant.placeholder')}
        height="100%"
      />
    </aside>
  );
};

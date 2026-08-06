import { ChatWidget } from '@useago/sdk/react';
import { useTranslation } from 'react-i18next';

export const AssistantPanel = () => {
  const { t } = useTranslation();

  return (
    // The widget sizes its type and controls in inline pixels, so zoom is the
    // only lever that brings it down to the app's density. w-96 at that factor
    // renders just under the overview widget rail's w-90.
    <aside
      aria-label={t('app.assistant.panelLabel')}
      className="flex min-h-0 w-96 shrink-0 flex-col border-l bg-background [zoom:0.85]"
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

import { Outlet } from 'react-router';

import { AssistantNavigation } from '@/assistant/assistant-navigation';
import { AssistantPanel } from '@/assistant/assistant-panel';
import { GlobalAssistantFunctions } from '@/assistant/functions/global-assistant-functions';
import { useAssistant } from '@/assistant/use-assistant';

import { LayoutHeader } from './layout-header';

export const AppLayout = () => {
  const { isAvailable, isOpen, onToggle } = useAssistant();

  return (
    <div className="flex h-screen flex-col">
      <LayoutHeader isAssistantOpen={isOpen} onToggleAssistant={onToggle} />
      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 flex-1 overflow-hidden bg-muted/40 p-4">
          <Outlet />
        </main>
        {isAvailable && (
          <>
            <AssistantNavigation />
            <GlobalAssistantFunctions />
          </>
        )}
        {isOpen && <AssistantPanel />}
      </div>
    </div>
  );
};

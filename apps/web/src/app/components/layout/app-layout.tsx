import { useOptionalAgoClient } from '@useago/sdk/react';
import { Outlet } from 'react-router';

import { AssistantPanel } from '@/app/components/assistant/assistant-panel';
import { useLocalStorageState } from '@/lib/use-local-storage-state';

import { LayoutHeader } from './layout-header';

const ASSISTANT_STORAGE_KEY = 'app.assistant-panel-open';

export const AppLayout = () => {
  // Null unless the assistant is configured, so the panel and its toggle are
  // absent rather than rendering a widget with no client behind it.
  const isAssistantAvailable = useOptionalAgoClient() !== null;
  // Stored JSON is arbitrary until proven otherwise — see useLocalStorageState.
  const [storedOpen, setAssistantOpen] = useLocalStorageState<unknown>(
    ASSISTANT_STORAGE_KEY,
    false,
  );
  const isPanelOpen = isAssistantAvailable && storedOpen === true;

  return (
    // h-screen, not min-h-screen: the card list scrolls inside its own panel,
    // which needs a definite height here.
    <div className="flex h-screen flex-col">
      <LayoutHeader
        isAssistantOpen={isPanelOpen}
        onToggleAssistant={
          isAssistantAvailable
            ? () => setAssistantOpen(!isPanelOpen)
            : undefined
        }
      />
      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 flex-1 overflow-hidden bg-muted/40 p-4">
          <Outlet />
        </main>
        {isPanelOpen && <AssistantPanel />}
      </div>
    </div>
  );
};

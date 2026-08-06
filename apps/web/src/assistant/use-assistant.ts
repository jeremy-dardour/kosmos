import { useOptionalAgoClient } from '@useago/sdk/react';

import { useLocalStorageState } from '@/lib/use-local-storage-state';

export interface Assistant {
  isAvailable: boolean; // ⇒ mount the nav/auto-continue wiring
  isOpen: boolean; // ⇒ render the panel
  onToggle?: () => void; // undefined ⇒ header hides the control
}

export const useAssistant = (): Assistant => {
  const isAvailable = useOptionalAgoClient() !== null;
  const [storedOpen, setOpen] = useLocalStorageState<unknown>(
    'app.assistant-panel-open',
    false,
  );
  const isOpen = isAvailable && storedOpen === true;

  return {
    isAvailable,
    isOpen,
    onToggle: isAvailable ? () => setOpen(!isOpen) : undefined,
  };
};

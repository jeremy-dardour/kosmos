import { useOptionalAgoClient } from '@useago/sdk/react';

interface AssistantScopeProperties {
  children: React.ReactNode;
}

/**
 * Renders its children only when an Ago client exists. Page-scoped function
 * mounts sit behind this so feature code stays free of the availability check:
 * those hooks call `useAgoClient`, which throws when the assistant is
 * unconfigured (no provider is rendered).
 */
export const AssistantScope = ({ children }: AssistantScopeProperties) => {
  const client = useOptionalAgoClient();
  return client ? children : null;
};

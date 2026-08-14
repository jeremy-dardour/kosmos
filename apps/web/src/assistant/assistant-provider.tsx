import { AgoProvider } from '@useago/sdk/react';

import { useAuthState } from '@/auth';
import { env } from '@/config/env';

interface AssistantProviderProperties {
  children: React.ReactNode;
}

/**
 * Wraps the routed pages so they can register agent tools and context, not
 * just the panel. Unconfigured (no `VITE_AGO_BASE_URL`) it renders nothing of
 * its own, so no client is constructed and the layout hides the assistant.
 */
export const AssistantProvider = ({
  children,
}: AssistantProviderProperties) => {
  const authState = useAuthState();
  const assistant = env.assistant;

  if (!assistant) return children;

  return (
    <AgoProvider
      baseUrl={assistant.baseUrl}
      agent={assistant.agent}
      userEmail={
        authState.status === 'authenticated' ? authState.user.email : undefined
      }
      pageContext="auto"
    >
      {children}
    </AgoProvider>
  );
};

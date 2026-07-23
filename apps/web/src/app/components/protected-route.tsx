import { useEffect, useSyncExternalStore } from 'react';

import { AuthEvent, useAuth } from '@/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function subscribeToAuthEvents(onStoreChange: () => void): () => void {
  globalThis.addEventListener(AuthEvent.LOGIN_SUCCESS, onStoreChange);
  globalThis.addEventListener(AuthEvent.LOGOUT_SUCCESS, onStoreChange);

  return () => {
    globalThis.removeEventListener(AuthEvent.LOGIN_SUCCESS, onStoreChange);
    globalThis.removeEventListener(AuthEvent.LOGOUT_SUCCESS, onStoreChange);
  };
}

export function ProtectedRoute({
  children,
}: ProtectedRouteProps): React.JSX.Element {
  const auth = useAuth();
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuthEvents,
    () => auth.isAuthenticated(),
    () => auth.isAuthenticated(),
  );

  useEffect(() => {
    if (auth.isAuthenticated()) {
      return;
    }

    void Promise.resolve(auth.login());
  }, [auth]);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return <></>;
}

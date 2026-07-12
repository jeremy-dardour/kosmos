import { useEffect } from 'react';

import { useAuth } from '@/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({
  children,
}: ProtectedRouteProps): React.JSX.Element {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      void auth.login();
    }
  }, [auth]);

  if (auth.isAuthenticated()) {
    return <>{children}</>;
  }

  return <></>;
}

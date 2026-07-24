import { useEffect, useReducer } from 'react';

import { useAuth } from '@/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({
  children,
}: ProtectedRouteProps): React.JSX.Element {
  const auth = useAuth();
  const [, rerender] = useReducer((revision: number) => revision + 1, 0);
  const isAuthenticated = auth.isAuthenticated();

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    let isMounted = true;

    void Promise.resolve(auth.login())
      .then(() => {
        if (isMounted) {
          rerender();
        }
      })
      .catch(() => {
        if (isMounted) {
          rerender();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [auth, isAuthenticated]);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return <></>;
}

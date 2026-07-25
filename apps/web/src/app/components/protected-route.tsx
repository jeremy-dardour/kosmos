import { useEffect, useReducer, useState } from 'react';

import { AuthError, useAuth } from '@/auth';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type AuthViewState = 'checking' | 'sign-in' | 'forbidden' | 'error';

export function ProtectedRoute({
  children,
}: ProtectedRouteProps): React.JSX.Element {
  const auth = useAuth();
  const [, rerender] = useReducer((revision: number) => revision + 1, 0);
  const [authViewState, setAuthViewState] = useState<AuthViewState>('checking');
  const [attempt, retry] = useReducer((revision: number) => revision + 1, 0);
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
      .catch((error: unknown) => {
        if (isMounted) {
          setAuthViewState(getAuthViewState(error));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [attempt, auth, isAuthenticated]);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        {authViewState === 'checking' ? <p>Checking sign-in...</p> : null}
        {authViewState === 'sign-in' ? (
          <>
            <p>Sign-in is required to continue.</p>
            <Button
              onClick={() => {
                setAuthViewState('checking');
                retry();
              }}
              type="button"
            >
              Sign in with Google
            </Button>
          </>
        ) : null}
        {authViewState === 'forbidden' ? (
          <>
            <p>This Google account is not allowed.</p>
            <Button
              onClick={() => {
                setAuthViewState('checking');
                void Promise.resolve(auth.logout()).finally(() => {
                  retry();
                });
              }}
              type="button"
              variant="outline"
            >
              Try another account
            </Button>
          </>
        ) : null}
        {authViewState === 'error' ? (
          <>
            <p>Could not validate sign-in.</p>
            <Button
              onClick={() => {
                setAuthViewState('checking');
                retry();
              }}
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function getAuthViewState(error: unknown): AuthViewState {
  if (error instanceof AuthError) {
    if (error.code === 'forbidden') {
      return 'forbidden';
    }

    if (error.code === 'sign_in_failed') {
      return 'sign-in';
    }
  }

  return 'error';
}

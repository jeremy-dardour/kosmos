import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthError, useAuth } from '@/auth';
import { Button } from '@/components/ui/button';

import type { Translations } from '@/types/i18n';

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

    void Promise.resolve(auth.restore())
      .then(() => {
        if (!isMounted) {
          return;
        }

        if (!auth.isAuthenticated()) {
          setAuthViewState(getAuthViewState(auth.getAuthError()) ?? 'sign-in');
          return;
        }

        if (isMounted) {
          rerender();
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setAuthViewState(getAuthViewState(error) ?? 'error');
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
    <UnauthenticatedLanding
      authViewState={authViewState}
      onRetry={() => {
        setAuthViewState('checking');
        retry();
      }}
      onTryAnotherAccount={() => {
        setAuthViewState('checking');
        void Promise.resolve(auth.logout()).finally(() => {
          retry();
        });
      }}
    />
  );
}

function UnauthenticatedLanding({
  authViewState,
  onRetry,
  onTryAnotherAccount,
}: {
  authViewState: AuthViewState;
  onRetry: () => void;
  onTryAnotherAccount: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f8f7f3_0%,#ffffff_44%,#eef3ef_100%)] text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-7">
          <div className="w-fit border border-border bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t('auth.landing.badge')}
          </div>
          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              {t('auth.landing.title')}
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              {t('auth.landing.subtitle')}
            </p>
          </div>
        </section>
        <section className="border border-border bg-background/90 p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">
                {t('auth.landing.access.title')}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(getLandingMessageKey(authViewState))}
              </p>
            </div>
            <div className="min-h-11">
              {authViewState === 'checking' ? (
                <div className="h-2 w-full overflow-hidden bg-muted">
                  <div className="h-full w-1/3 animate-pulse bg-primary" />
                </div>
              ) : null}
              {authViewState === 'sign-in' ? <ProviderSignInButton /> : null}
              {authViewState === 'forbidden' ? (
                <Button
                  onClick={onTryAnotherAccount}
                  type="button"
                  variant="outline"
                >
                  {t('auth.landing.action.tryAnotherAccount')}
                </Button>
              ) : null}
              {authViewState === 'error' ? (
                <Button onClick={onRetry} type="button" variant="outline">
                  {t('auth.landing.action.retry')}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProviderSignInButton(): React.JSX.Element {
  const auth = useAuth();
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    const container = buttonRef.current;
    if (!container) {
      return;
    }

    let cleanup: (() => void) | undefined;
    let isMounted = true;

    void Promise.resolve(auth.renderSignInButton(container))
      .then((nextCleanup) => {
        if (typeof nextCleanup !== 'function') {
          return;
        }

        // The provider scopes its cleanup to the node it created, so running a
        // stale one here removes only that call's button — not whichever button
        // is currently live. See GoogleAuthProvider.renderSignInButton.
        if (isMounted) {
          cleanup = nextCleanup;
        } else {
          nextCleanup();
        }
      })
      .catch(() => {
        if (isMounted) {
          setRenderError(true);
        }
      });

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [auth]);

  if (renderError) {
    return (
      <Button
        onClick={() => {
          setRenderError(false);
          void Promise.resolve(auth.login()).catch(() => {
            setRenderError(true);
          });
        }}
        type="button"
      >
        {t('auth.landing.action.signInWithGoogle')}
      </Button>
    );
  }

  return <div ref={buttonRef} className="min-h-10" />;
}

function getLandingMessageKey(
  authViewState: AuthViewState,
): keyof Translations {
  if (authViewState === 'checking') {
    return 'auth.landing.status.checking';
  }

  if (authViewState === 'forbidden') {
    return 'auth.landing.status.forbidden';
  }

  if (authViewState === 'error') {
    return 'auth.landing.status.error';
  }

  return 'auth.landing.status.signIn';
}

function getAuthViewState(error: unknown): AuthViewState | null {
  if (error instanceof AuthError) {
    if (error.code === 'forbidden') {
      return 'forbidden';
    }

    if (error.code === 'sign_in_failed' || error.code === 'token_rejected') {
      return 'sign-in';
    }
  }

  if (error) {
    return 'error';
  }

  return null;
}
